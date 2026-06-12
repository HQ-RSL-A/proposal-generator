"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createProposal, updateProposal } from "@/actions/proposals";
import { normalizeImportedTokens } from "@/lib/validation";
import { parseCentsFromDisplayString } from "@/lib/currency";
import { TOKEN_KEYS, type PaymentConfig, type TierConfig, type TokensJson } from "@/lib/types";

type PricingMode = "flat" | "tiers" | "signOnly";

interface FormState {
  title: string;
  tokens: Record<string, string>;
  pricingMode: PricingMode;
  oneTimeEnabled: boolean;
  oneTime: { label: string; displayString: string; amountCents: number };
  recurringEnabled: boolean;
  recurring: {
    label: string;
    displayString: string;
    amountCents: number;
    intervalMonths: 1 | 3 | 12;
  };
  tiers: TierDraft[];
  methods: { card: boolean; ach: boolean };
  preferAch: boolean;
}

interface TierDraft {
  id: string;
  label: string;
  recommended: boolean;
  includesText: string;
  oneTimeEnabled: boolean;
  oneTime: { label: string; displayString: string; amountCents: number };
  recurringEnabled: boolean;
  recurring: {
    label: string;
    displayString: string;
    amountCents: number;
    intervalMonths: 1 | 3 | 12;
  };
}

const emptyMoney = { label: "", displayString: "", amountCents: 0 };

function blankTier(index: number): TierDraft {
  return {
    id: `tier-${index + 1}`,
    label: "",
    recommended: index === 1,
    includesText: "",
    oneTimeEnabled: false,
    oneTime: { ...emptyMoney, label: "Setup" },
    recurringEnabled: true,
    recurring: { ...emptyMoney, label: "Monthly retainer", intervalMonths: 1 },
  };
}

function blankTokens(): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const key of TOKEN_KEYS) tokens[key] = "";
  const today = new Date();
  const validUntil = new Date(today);
  validUntil.setDate(validUntil.getDate() + 30);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  tokens["Document.CreatedDate"] = fmt(today);
  tokens["Client.ValidUntil"] = fmt(validUntil);
  return tokens;
}

function configToState(config: PaymentConfig | null): Partial<FormState> {
  if (!config) return {};
  const mode: PricingMode = config.tiers?.length
    ? "tiers"
    : config.oneTime || config.recurring
      ? "flat"
      : "signOnly";
  return {
    pricingMode: mode,
    oneTimeEnabled: Boolean(config.oneTime),
    oneTime: config.oneTime ?? { ...emptyMoney, label: "One-time build" },
    recurringEnabled: Boolean(config.recurring),
    recurring: config.recurring ?? { ...emptyMoney, label: "Monthly retainer", intervalMonths: 1 },
    tiers:
      config.tiers?.map((tier) => ({
        id: tier.id,
        label: tier.label,
        recommended: tier.recommended,
        includesText: tier.includes.join("\n"),
        oneTimeEnabled: Boolean(tier.oneTime),
        oneTime: tier.oneTime ?? { ...emptyMoney, label: "Setup" },
        recurringEnabled: Boolean(tier.recurring),
        recurring: tier.recurring ?? {
          ...emptyMoney,
          label: "Monthly retainer",
          intervalMonths: 1,
        },
      })) ?? [],
    methods: {
      card: config.paymentMethods.includes("card"),
      ach: config.paymentMethods.includes("us_bank_account"),
    },
    preferAch: config.preferAch,
  };
}

function stateToConfig(state: FormState): PaymentConfig {
  const methods: PaymentConfig["paymentMethods"] = [];
  if (state.methods.card) methods.push("card");
  if (state.methods.ach) methods.push("us_bank_account");

  if (state.pricingMode === "signOnly") {
    return {
      currency: "usd",
      paymentMethods: methods.length ? methods : ["card"],
      oneTime: null,
      recurring: null,
      tiers: null,
      preferAch: state.preferAch,
    };
  }
  if (state.pricingMode === "tiers") {
    const tiers: TierConfig[] = state.tiers.map((tier) => ({
      id: tier.id,
      label: tier.label,
      recommended: tier.recommended,
      includes: tier.includesText
        .split("\n")
        .map((line) => line.replace(/^\s*[•\-–]\s*/, "").trim())
        .filter(Boolean),
      oneTime: tier.oneTimeEnabled ? { ...tier.oneTime } : null,
      recurring: tier.recurringEnabled ? { ...tier.recurring } : null,
    }));
    return {
      currency: "usd",
      paymentMethods: methods.length ? methods : ["card"],
      oneTime: null,
      recurring: null,
      tiers,
      preferAch: state.preferAch,
    };
  }
  return {
    currency: "usd",
    paymentMethods: methods.length ? methods : ["card"],
    oneTime: state.oneTimeEnabled ? { ...state.oneTime } : null,
    recurring: state.recurringEnabled ? { ...state.recurring } : null,
    tiers: null,
    preferAch: state.preferAch,
  };
}

/** Best-effort mapping of the skill's Investment.Structure to tier drafts. */
function inferTiersFromImport(raw: Record<string, unknown>): TierDraft[] | null {
  const structure = raw["Investment.Structure"] as
    | { type?: string; tiers?: { name: string; price: string; includes: string[]; recommended?: boolean }[] }
    | undefined;
  if (structure?.type !== "tiers" || !structure.tiers?.length) return null;
  return structure.tiers.map((tier) => {
    const cents = parseCentsFromDisplayString(tier.price) ?? 0;
    const isRecurring = /\/\s*(mo|month|quarter|yr|year)/i.test(tier.price);
    return {
      id: `tier-${tier.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      label: tier.name,
      recommended: Boolean(tier.recommended),
      includesText: (tier.includes ?? []).join("\n"),
      oneTimeEnabled: !isRecurring && cents > 0,
      oneTime: { label: "One-time", displayString: tier.price, amountCents: cents },
      recurringEnabled: isRecurring,
      recurring: {
        label: "Monthly retainer",
        displayString: tier.price,
        amountCents: cents,
        intervalMonths: 1 as const,
      },
    };
  });
}

const tokenFieldGroups: { heading: string; fields: { key: keyof TokensJson; label: string; multiline?: boolean }[] }[] = [
  {
    heading: "Client",
    fields: [
      { key: "Client.FirstName", label: "First name" },
      { key: "Client.LastName", label: "Last name" },
      { key: "Client.Company", label: "Company" },
      { key: "Client.ProposalTitle", label: "Proposal title" },
    ],
  },
  {
    heading: "At a Glance",
    fields: [
      { key: "Client.AtGlanceServices", label: "What we're building", multiline: true },
      { key: "Client.AtGlanceInvestment", label: "Investment summary" },
      { key: "Client.AtGlanceTimeline", label: "Timeline summary" },
      { key: "Document.CreatedDate", label: "Created date" },
      { key: "Client.ValidUntil", label: "Valid until" },
    ],
  },
  {
    heading: "Narrative",
    fields: [
      { key: "Client.ProblemTitle", label: "Problem title" },
      { key: "Client.ProblemText", label: "Problem text", multiline: true },
      { key: "Client.SolutionTitle", label: "Solution title" },
      { key: "Client.SolutionText", label: "Solution text", multiline: true },
    ],
  },
  {
    heading: "Scope & Timeline",
    fields: [
      { key: "Client.ScopeItems", label: "Scope items (one per line, • optional)", multiline: true },
      { key: "Client.TimelineItems", label: "Timeline items (one per line)", multiline: true },
    ],
  },
  {
    heading: "Investment copy",
    fields: [
      { key: "Client.InvestmentDetails", label: "Investment details (pricing lines, or tier table lead-in)", multiline: true },
      { key: "Client.InvestmentNote", label: "Investment note (ROI framing, payment terms)", multiline: true },
    ],
  },
];

function MoneyFields({
  value,
  onChange,
  withInterval,
}: {
  value: { label: string; displayString: string; amountCents: number; intervalMonths?: 1 | 3 | 12 };
  onChange: (next: typeof value) => void;
  withInterval?: boolean;
}) {
  const parsed = parseCentsFromDisplayString(value.displayString);
  const mismatch = parsed !== null && Math.abs(parsed - value.amountCents) > 1;
  return (
    <div className="grid grid-cols-12 items-end gap-2">
      <div className="col-span-4">
        <Label className="text-xs">Label</Label>
        <Input
          value={value.label}
          onChange={(e) => onChange({ ...value, label: e.target.value })}
          placeholder="Website build"
        />
      </div>
      <div className="col-span-4">
        <Label className="text-xs">Shown to client</Label>
        <Input
          value={value.displayString}
          onChange={(e) => {
            const displayString = e.target.value;
            const cents = parseCentsFromDisplayString(displayString);
            onChange({ ...value, displayString, amountCents: cents ?? value.amountCents });
          }}
          placeholder="$1,997"
        />
      </div>
      <div className="col-span-2">
        <Label className="text-xs">Charged ($)</Label>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={value.amountCents ? (value.amountCents / 100).toString() : ""}
          onChange={(e) =>
            onChange({ ...value, amountCents: Math.round(Number(e.target.value || 0) * 100) })
          }
        />
      </div>
      {withInterval ? (
        <div className="col-span-2">
          <Label className="text-xs">Every</Label>
          <select
            className="border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm"
            value={value.intervalMonths ?? 1}
            onChange={(e) =>
              onChange({ ...value, intervalMonths: Number(e.target.value) as 1 | 3 | 12 })
            }
          >
            <option value={1}>Month</option>
            <option value={3}>Quarter</option>
            <option value={12}>Year</option>
          </select>
        </div>
      ) : null}
      {mismatch ? (
        <p className="col-span-12 text-xs text-destructive">
          Display says {value.displayString} but {(value.amountCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} will be charged. Make them match before sending.
        </p>
      ) : null}
    </div>
  );
}

export function ProposalForm({
  mode,
  proposalId,
  initialTitle,
  initialTokens,
  initialConfig,
}: {
  mode: "create" | "edit";
  proposalId?: string;
  initialTitle?: string;
  initialTokens?: Record<string, string>;
  initialConfig?: PaymentConfig | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [importText, setImportText] = React.useState("");
  const [state, setState] = React.useState<FormState>(() => ({
    title: initialTitle ?? "",
    tokens: initialTokens ?? blankTokens(),
    pricingMode: "flat",
    oneTimeEnabled: false,
    oneTime: { ...emptyMoney, label: "One-time build" },
    recurringEnabled: true,
    recurring: { ...emptyMoney, label: "Monthly retainer", intervalMonths: 1 },
    tiers: [blankTier(0), blankTier(1), blankTier(2)],
    methods: { card: true, ach: false },
    preferAch: false,
    ...configToState(initialConfig ?? null),
  }));

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  function handleImport() {
    let raw: unknown;
    try {
      raw = JSON.parse(importText);
    } catch {
      toast.error("That isn't valid JSON.");
      return;
    }
    const { tokens, errors } = normalizeImportedTokens(raw);
    if (!tokens) {
      toast.error(`Import failed: ${errors[0]}`);
      return;
    }
    const inferredTiers = inferTiersFromImport(raw as Record<string, unknown>);
    setState((prev) => ({
      ...prev,
      title: tokens["Client.ProposalTitle"],
      tokens: tokens as unknown as Record<string, string>,
      ...(inferredTiers
        ? { pricingMode: "tiers" as PricingMode, tiers: inferredTiers }
        : {}),
    }));
    toast.success(
      inferredTiers
        ? `Imported with ${inferredTiers.length} pricing tiers. Review the amounts.`
        : "Imported. Set up pricing below."
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        title: state.title || state.tokens["Client.ProposalTitle"] || "Untitled proposal",
        tokens: state.tokens,
        paymentConfig: stateToConfig(state),
      };
      const result =
        mode === "create"
          ? await createProposal(payload)
          : await updateProposal({ id: proposalId!, ...payload });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(mode === "create" ? "Proposal created" : "Saved");
      router.push(
        mode === "create" && result.data
          ? `/proposals/${(result.data as { id: string }).id}`
          : `/proposals/${proposalId}`
      );
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {mode === "create" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import from generate-proposal skill</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='Paste the tokens JSON ({"Client.ProposalTitle": ...})'
              className="min-h-28 font-mono text-xs"
            />
            <Button variant="secondary" size="sm" onClick={handleImport} disabled={!importText.trim()}>
              Parse &amp; fill form
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {tokenFieldGroups.map((group) => (
        <Card key={group.heading}>
          <CardHeader>
            <CardTitle className="text-base">{group.heading}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {group.fields.map((field) => (
              <div
                key={field.key}
                className={field.multiline ? "col-span-2 space-y-1" : "space-y-1"}
              >
                <Label className="text-xs">{field.label}</Label>
                {field.multiline ? (
                  <Textarea
                    value={state.tokens[field.key] ?? ""}
                    onChange={(e) =>
                      set("tokens", { ...state.tokens, [field.key]: e.target.value })
                    }
                    className="min-h-24"
                  />
                ) : (
                  <Input
                    value={state.tokens[field.key] ?? ""}
                    onChange={(e) =>
                      set("tokens", { ...state.tokens, [field.key]: e.target.value })
                    }
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checkout: what the client pays after signing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Tabs value={state.pricingMode} onValueChange={(v) => set("pricingMode", v as PricingMode)}>
            <TabsList>
              <TabsTrigger value="flat">Flat pricing</TabsTrigger>
              <TabsTrigger value="tiers">Tiers (client picks)</TabsTrigger>
              <TabsTrigger value="signOnly">Sign-only</TabsTrigger>
            </TabsList>
          </Tabs>

          {state.pricingMode === "flat" ? (
            <div className="space-y-4">
              <div className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={state.oneTimeEnabled}
                    onCheckedChange={(v) => set("oneTimeEnabled", Boolean(v))}
                  />
                  <Label>One-time amount due at checkout</Label>
                </div>
                {state.oneTimeEnabled ? (
                  <MoneyFields value={state.oneTime} onChange={(v) => set("oneTime", v)} />
                ) : null}
              </div>
              <div className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={state.recurringEnabled}
                    onCheckedChange={(v) => set("recurringEnabled", Boolean(v))}
                  />
                  <Label>Recurring subscription (starts at checkout)</Label>
                </div>
                {state.recurringEnabled ? (
                  <MoneyFields
                    value={state.recurring}
                    onChange={(v) => set("recurring", v as FormState["recurring"])}
                    withInterval
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          {state.pricingMode === "tiers" ? (
            <div className="space-y-4">
              {state.tiers.map((tier, index) => (
                <div key={index} className="space-y-3 rounded-lg border border-border p-3">
                  <div className="grid grid-cols-12 items-end gap-2">
                    <div className="col-span-5">
                      <Label className="text-xs">Tier name</Label>
                      <Input
                        value={tier.label}
                        onChange={(e) => {
                          const tiers = [...state.tiers];
                          tiers[index] = {
                            ...tier,
                            label: e.target.value,
                            id: `tier-${e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-") || index + 1}`,
                          };
                          set("tiers", tiers);
                        }}
                        placeholder="Growth"
                      />
                    </div>
                    <div className="col-span-4 flex items-center gap-2 pb-1.5">
                      <Checkbox
                        checked={tier.recommended}
                        onCheckedChange={(v) => {
                          const tiers = state.tiers.map((t, i) => ({
                            ...t,
                            recommended: i === index ? Boolean(v) : false,
                          }));
                          set("tiers", tiers);
                        }}
                      />
                      <Label className="text-xs">Most popular</Label>
                    </div>
                    <div className="col-span-3 pb-1 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => set("tiers", state.tiers.filter((_, i) => i !== index))}
                        disabled={state.tiers.length <= 2}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Includes (one per line)</Label>
                    <Textarea
                      value={tier.includesText}
                      onChange={(e) => {
                        const tiers = [...state.tiers];
                        tiers[index] = { ...tier, includesText: e.target.value };
                        set("tiers", tiers);
                      }}
                      className="min-h-20"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={tier.oneTimeEnabled}
                        onCheckedChange={(v) => {
                          const tiers = [...state.tiers];
                          tiers[index] = { ...tier, oneTimeEnabled: Boolean(v) };
                          set("tiers", tiers);
                        }}
                      />
                      <Label className="text-xs">One-time</Label>
                    </div>
                    {tier.oneTimeEnabled ? (
                      <MoneyFields
                        value={tier.oneTime}
                        onChange={(v) => {
                          const tiers = [...state.tiers];
                          tiers[index] = { ...tier, oneTime: v };
                          set("tiers", tiers);
                        }}
                      />
                    ) : null}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={tier.recurringEnabled}
                        onCheckedChange={(v) => {
                          const tiers = [...state.tiers];
                          tiers[index] = { ...tier, recurringEnabled: Boolean(v) };
                          set("tiers", tiers);
                        }}
                      />
                      <Label className="text-xs">Recurring</Label>
                    </div>
                    {tier.recurringEnabled ? (
                      <MoneyFields
                        value={tier.recurring}
                        onChange={(v) => {
                          const tiers = [...state.tiers];
                          tiers[index] = { ...tier, recurring: v as TierDraft["recurring"] };
                          set("tiers", tiers);
                        }}
                        withInterval
                      />
                    ) : null}
                  </div>
                </div>
              ))}
              {state.tiers.length < 4 ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => set("tiers", [...state.tiers, blankTier(state.tiers.length)])}
                >
                  Add tier
                </Button>
              ) : null}
            </div>
          ) : null}

          {state.pricingMode === "signOnly" ? (
            <p className="text-sm text-muted-foreground">
              No checkout after signing. You&apos;ll invoice separately (per-phase deals). The
              signing flow ends on a confirmation page.
            </p>
          ) : null}

          {state.pricingMode !== "signOnly" ? (
            <div className="flex flex-wrap items-center gap-6 border-t border-border pt-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={state.methods.card}
                  onCheckedChange={(v) => set("methods", { ...state.methods, card: Boolean(v) })}
                />
                <Label className="text-sm">Card</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={state.methods.ach}
                  onCheckedChange={(v) => set("methods", { ...state.methods, ach: Boolean(v) })}
                />
                <Label className="text-sm">ACH bank transfer</Label>
              </div>
              {state.methods.ach ? (
                <div className="flex items-center gap-2">
                  <Switch checked={state.preferAch} onCheckedChange={(v) => set("preferAch", Boolean(v))} />
                  <Label className="text-sm">Prefer ACH (6+ month contracts)</Label>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 pb-12">
        <Button variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : mode === "create" ? "Create draft" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
