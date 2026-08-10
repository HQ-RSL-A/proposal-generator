"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { appScrollBehavior } from "@/lib/reducedMotion";
import { MAX_LINE_LABEL_CHARS, MAX_PROPOSAL_TITLE_CHARS } from "@/lib/constants";
import { brandToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { GrowingInput } from "@/components/ui/growing-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createProposal, updateProposal } from "@/actions/proposals";
import { normalizeImportedTokens } from "@/lib/validation";
import { moneyDraftIssues, hasMoneyDraftIssue } from "@/lib/moneyDraft";
import { formatPricedLine, parseCentsFromDisplayString } from "@/lib/currency";
import { inferFlatPricingFromImport, summarizeImportedDiscounts } from "@/lib/importPricing";
import {
  TOKEN_KEYS,
  type AddOn,
  type DepositConfig,
  type Discount,
  type FutureItem,
  type OneTimeItem,
  type PaymentConfig,
  type RecurringItem,
  type TierConfig,
  type TokensJson,
  type TrackRecordConfig,
} from "@/lib/types";
import {
  MAX_CASE_STUDIES,
  SUGGESTED_CASE_STUDIES,
  SUGGESTED_INTRO,
} from "@/lib/trackRecord";

type PricingMode = "flat" | "tiers" | "signOnly";

const INTERVAL_ITEMS = [
  { value: 1, label: "Month" },
  { value: 3, label: "Quarter" },
  { value: 12, label: "Year" },
] as const;

/**
 * A draft money line in the form. `amountCents` is always the NET (what Stripe charges).
 * When `discountEnabled`, the admin types the list price and a discount; net = list - discount
 * (handled in MoneyFields). On save, `discountCents`/`discountReason` become the line's
 * `discount`; the original is derived as net + discount, never stored.
 */
interface MoneyDraft {
  label: string;
  displayString: string;
  amountCents: number;
  discountEnabled?: boolean;
  discountCents?: number;
  discountReason?: string;
}

interface RecurringDraft extends MoneyDraft {
  intervalMonths: 1 | 3 | 12;
}

interface FormState {
  title: string;
  tokens: Record<string, string>;
  /** Per-proposal "Our Track Record" - intro + case studies. Empty hides the section. */
  trackRecordIntro: string;
  caseStudies: CaseStudyDraft[];
  pricingMode: PricingMode;
  oneTimeEnabled: boolean;
  oneTime: MoneyDraft;
  recurringEnabled: boolean;
  recurring: RecurringDraft;
  tiers: TierDraft[];
  /** Global optional add-ons; apply across flat + tiers, not sign-only. */
  addOns: AddOnDraft[];
  /** Display-only future / Phase-2 lines; shown with pricing, never charged. */
  futureItems: FutureItemDraft[];
  depositEnabled: boolean;
  depositPercent: number;
  methods: { card: boolean; ach: boolean };
  preferAch: boolean;
  /** Manual-invoice mode: pricing shows + signs, but no Stripe checkout (owner invoices, marks paid). */
  manualInvoice: boolean;
}

interface AddOnDraft {
  id: string;
  label: string;
  displayString: string;
  amountCents: number;
  isRecurring: boolean;
  intervalMonths: 1 | 3 | 12;
  discountEnabled?: boolean;
  discountCents?: number;
  discountReason?: string;
}

interface FutureItemDraft {
  id: string;
  label: string;
  displayString: string;
  amountCents: number;
  isRecurring: boolean;
  intervalMonths: 1 | 3 | 12;
  startsNote: string;
}

interface CaseStudyDraft {
  text: string;
  href: string;
}

interface TierDraft {
  id: string;
  label: string;
  recommended: boolean;
  includesText: string;
  oneTimeEnabled: boolean;
  oneTime: MoneyDraft;
  recurringEnabled: boolean;
  recurring: RecurringDraft;
}

const emptyMoney = { label: "", displayString: "", amountCents: 0 };

function blankAddOn(): AddOnDraft {
  return {
    id: "",
    label: "",
    displayString: "",
    amountCents: 0,
    isRecurring: false,
    intervalMonths: 1,
  };
}

function blankFutureItem(): FutureItemDraft {
  return {
    id: "",
    label: "",
    displayString: "",
    amountCents: 0,
    isRecurring: false,
    intervalMonths: 1,
    startsNote: "",
  };
}

function blankCaseStudy(): CaseStudyDraft {
  return { text: "", href: "" };
}

function slugifyAddOn(label: string, index: number): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `addon-${slug || index + 1}`;
}

function slugifyFutureItem(label: string, index: number): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `future-${slug || index + 1}`;
}

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

// ---- Discount <-> draft helpers. amountCents is always the NET; the original is net + discount.

/** The 3 draft discount fields from a stored Discount (or none). */
function discountToDraft(d: Discount | null | undefined): {
  discountEnabled: boolean;
  discountCents: number;
  discountReason: string;
} {
  return {
    discountEnabled: !!d,
    discountCents: d?.amountCents ?? 0,
    discountReason: d?.reason ?? "",
  };
}

function moneyToDraft(m: OneTimeItem): MoneyDraft {
  return {
    label: m.label,
    displayString: m.displayString,
    amountCents: m.amountCents,
    ...discountToDraft(m.discount),
  };
}

function recurringToDraft(r: RecurringItem): RecurringDraft {
  return { ...moneyToDraft(r), intervalMonths: r.intervalMonths };
}

/** Build a stored Discount from a draft, or null when disabled / zero. */
function draftToDiscount(d: {
  discountEnabled?: boolean;
  discountCents?: number;
  discountReason?: string;
}): Discount | null {
  return d.discountEnabled && (d.discountCents ?? 0) > 0
    ? { amountCents: d.discountCents!, reason: (d.discountReason ?? "").trim() }
    : null;
}

/** A draft money line -> the stored OneTimeItem, stripping draft-only discount fields. */
function buildMoney(m: MoneyDraft): OneTimeItem {
  return {
    label: m.label,
    displayString: m.displayString,
    amountCents: m.amountCents,
    discount: draftToDiscount(m),
  };
}

function buildRecurring(m: RecurringDraft): RecurringItem {
  return { ...buildMoney(m), intervalMonths: m.intervalMonths };
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
    oneTime: config.oneTime
      ? moneyToDraft(config.oneTime)
      : { ...emptyMoney, label: "One-time build" },
    recurringEnabled: Boolean(config.recurring),
    recurring: config.recurring
      ? recurringToDraft(config.recurring)
      : { ...emptyMoney, label: "Monthly retainer", intervalMonths: 1 },
    tiers:
      config.tiers?.map((tier) => ({
        id: tier.id,
        label: tier.label,
        recommended: tier.recommended,
        includesText: tier.includes.join("\n"),
        oneTimeEnabled: Boolean(tier.oneTime),
        oneTime: tier.oneTime ? moneyToDraft(tier.oneTime) : { ...emptyMoney, label: "Setup" },
        recurringEnabled: Boolean(tier.recurring),
        recurring: tier.recurring
          ? recurringToDraft(tier.recurring)
          : { ...emptyMoney, label: "Monthly retainer", intervalMonths: 1 },
      })) ?? [],
    addOns:
      config.addOns?.map((a) => ({
        id: a.id,
        label: a.label,
        displayString: a.displayString,
        amountCents: a.amountCents,
        isRecurring: a.intervalMonths !== null,
        intervalMonths: (a.intervalMonths ?? 1) as 1 | 3 | 12,
        ...discountToDraft(a.discount),
      })) ?? [],
    futureItems:
      config.futureItems?.map((f) => ({
        id: f.id,
        label: f.label,
        displayString: f.displayString,
        amountCents: f.amountCents,
        isRecurring: f.intervalMonths !== null,
        intervalMonths: (f.intervalMonths ?? 1) as 1 | 3 | 12,
        startsNote: f.startsNote,
      })) ?? [],
    depositEnabled: Boolean(config.deposit),
    depositPercent: config.deposit?.depositPercent ?? 50,
    methods: {
      card: config.paymentMethods.includes("card"),
      ach: config.paymentMethods.includes("us_bank_account"),
    },
    preferAch: config.preferAch,
    manualInvoice: Boolean(config.manualInvoice),
  };
}

function trackRecordToState(tr: TrackRecordConfig | null | undefined): Partial<FormState> {
  if (!tr) return {};
  return {
    trackRecordIntro: tr.intro,
    caseStudies: tr.caseStudies.map((cs) => ({ text: cs.text, href: cs.href })),
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
      addOns: null,
      deposit: null,
      futureItems: null,
    };
  }

  // Add-ons + deposit are config-level and apply across flat and tiers.
  const cleanedAddOns: AddOn[] = state.addOns
    .filter((a) => a.label.trim() || a.displayString.trim() || a.amountCents > 0)
    .map((a, i) => ({
      id: a.id || slugifyAddOn(a.label, i),
      label: a.label,
      displayString: a.displayString,
      amountCents: a.amountCents,
      intervalMonths: a.isRecurring ? a.intervalMonths : null,
      discount: draftToDiscount(a),
    }));
  const addOns = cleanedAddOns.length > 0 ? cleanedAddOns : null;

  // Display-only future lines: cleaned like add-ons, but they never flow into checkout.
  const cleanedFutureItems: FutureItem[] = state.futureItems
    .filter((f) => f.label.trim() || f.displayString.trim() || f.amountCents > 0)
    .map((f, i) => ({
      id: f.id || slugifyFutureItem(f.label, i),
      label: f.label,
      displayString: f.displayString,
      amountCents: f.amountCents,
      intervalMonths: f.isRecurring ? f.intervalMonths : null,
      startsNote: f.startsNote,
    }));
  const futureItems = cleanedFutureItems.length > 0 ? cleanedFutureItems : null;

  if (state.pricingMode === "tiers") {
    const tiers: TierConfig[] = state.tiers.map((tier) => ({
      id: tier.id,
      label: tier.label,
      recommended: tier.recommended,
      includes: tier.includesText
        .split("\n")
        .map((line) => line.replace(/^\s*[•\-–]\s*/, "").trim())
        .filter(Boolean),
      oneTime: tier.oneTimeEnabled ? buildMoney(tier.oneTime) : null,
      recurring: tier.recurringEnabled ? buildRecurring(tier.recurring) : null,
    }));
    // Deposit needs a one-time on at least one tier.
    const tiersHaveOneTime = tiers.some((t) => t.oneTime);
    // Manual invoice collects nothing online, so a deposit (a Stripe-charge concept) never applies.
    const deposit: DepositConfig | null =
      state.depositEnabled && tiersHaveOneTime && !state.manualInvoice
        ? { depositPercent: state.depositPercent }
        : null;
    return {
      currency: "usd",
      paymentMethods: methods.length ? methods : ["card"],
      oneTime: null,
      recurring: null,
      tiers,
      preferAch: state.preferAch,
      addOns,
      deposit,
      futureItems,
      manualInvoice: state.manualInvoice,
    };
  }

  const oneTime = state.oneTimeEnabled ? buildMoney(state.oneTime) : null;
  // Manual invoice collects nothing online, so a deposit (a Stripe-charge concept) never applies.
  const deposit: DepositConfig | null =
    state.depositEnabled && oneTime && !state.manualInvoice
      ? { depositPercent: state.depositPercent }
      : null;
  return {
    currency: "usd",
    paymentMethods: methods.length ? methods : ["card"],
    oneTime,
    recurring: state.recurringEnabled ? buildRecurring(state.recurring) : null,
    tiers: null,
    preferAch: state.preferAch,
    addOns,
    deposit,
    futureItems,
    manualInvoice: state.manualInvoice,
  };
}

function stateToTrackRecord(state: FormState): TrackRecordConfig {
  const caseStudies = state.caseStudies
    .map((cs) => ({ text: cs.text.trim(), href: cs.href.trim() }))
    .filter((cs) => cs.text.length > 0);
  return { intro: state.trackRecordIntro.trim(), caseStudies };
}

/**
 * Parse an optional import discount on a priced line. The line's `price` is treated as the LIST
 * price; net = list - discount. Returns the draft fields (net amount + discount), or null.
 */
export function importDiscount(
  rawDiscount: unknown,
  listCents: number,
  intervalMonths: 1 | 3 | 12 | null
): {
  amountCents: number;
  displayString: string;
  discountEnabled: true;
  discountCents: number;
  discountReason: string;
} | null {
  const obj =
    rawDiscount && typeof rawDiscount === "object" && !Array.isArray(rawDiscount)
      ? (rawDiscount as Record<string, unknown>)
      : null;
  if (!obj) return null;
  const cents =
    typeof obj.amountCents === "number" && Number.isInteger(obj.amountCents) && obj.amountCents > 0
      ? obj.amountCents
      : typeof obj.amount === "string"
        ? parseCentsFromDisplayString(obj.amount)
        : null;
  const reason = typeof obj.reason === "string" ? obj.reason.trim() : "";
  if (!cents || cents <= 0 || cents >= listCents || !reason) return null;
  const net = listCents - cents;
  return {
    amountCents: net,
    displayString: formatPricedLine(net, intervalMonths),
    discountEnabled: true,
    discountCents: cents,
    discountReason: reason,
  };
}

/** Best-effort mapping of the skill's Investment.Structure to tier drafts. */
function inferTiersFromImport(raw: Record<string, unknown>): TierDraft[] | null {
  const structure = raw["Investment.Structure"] as
    | {
        type?: string;
        tiers?: {
          name: string;
          price: string;
          includes: string[];
          recommended?: boolean;
          discount?: unknown;
        }[];
      }
    | undefined;
  if (structure?.type !== "tiers" || !structure.tiers?.length) return null;
  return structure.tiers.map((tier) => {
    const cents = parseCentsFromDisplayString(tier.price) ?? 0;
    const isRecurring = /\/\s*(mo|month|quarter|yr|year)/i.test(tier.price);
    // A tier discount applies to whichever line its single price represents.
    const disc = importDiscount(tier.discount, cents, isRecurring ? 1 : null);
    const active: MoneyDraft = disc
      ? {
          label: "",
          displayString: disc.displayString,
          amountCents: disc.amountCents,
          discountEnabled: true,
          discountCents: disc.discountCents,
          discountReason: disc.discountReason,
        }
      : { label: "", displayString: tier.price, amountCents: cents };
    const plain = { displayString: tier.price, amountCents: cents };
    return {
      id: `tier-${tier.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      label: tier.name,
      recommended: Boolean(tier.recommended),
      includesText: (tier.includes ?? []).join("\n"),
      oneTimeEnabled: !isRecurring && cents > 0,
      oneTime: isRecurring
        ? { label: "One-time", ...plain }
        : { ...active, label: "One-time" },
      recurringEnabled: isRecurring,
      recurring: isRecurring
        ? { ...active, label: "Monthly retainer", intervalMonths: 1 as const }
        : { label: "Monthly retainer", ...plain, intervalMonths: 1 as const },
    };
  });
}

/** Best-effort mapping of the skill's Investment.AddOns to add-on drafts. */
function inferAddOnsFromImport(raw: Record<string, unknown>): AddOnDraft[] | null {
  const list = raw["Investment.AddOns"] as
    | { name: string; price: string; discount?: unknown }[]
    | undefined;
  if (!Array.isArray(list) || list.length === 0) return null;
  return list.slice(0, 10).map((addOn, i) => {
    const cents = parseCentsFromDisplayString(addOn.price) ?? 0;
    const isRecurring = /\/\s*(mo|month|quarter|yr|year)/i.test(addOn.price);
    const disc = importDiscount(addOn.discount, cents, isRecurring ? 1 : null);
    return {
      id: slugifyAddOn(addOn.name, i),
      label: addOn.name,
      displayString: disc ? disc.displayString : addOn.price,
      amountCents: disc ? disc.amountCents : cents,
      isRecurring,
      intervalMonths: 1 as const,
      ...(disc
        ? {
            discountEnabled: true,
            discountCents: disc.discountCents,
            discountReason: disc.discountReason,
          }
        : {}),
    };
  });
}

/** Best-effort mapping of the skill's Investment.FutureItems to display-only future-line drafts. */
function inferFutureItemsFromImport(raw: Record<string, unknown>): FutureItemDraft[] | null {
  const list = raw["Investment.FutureItems"] as
    | { name: string; price: string; starts?: string }[]
    | undefined;
  if (!Array.isArray(list) || list.length === 0) return null;
  return list.slice(0, 6).map((item, i) => {
    const cents = parseCentsFromDisplayString(item.price) ?? 0;
    const isRecurring = /\/\s*(mo|month|quarter|yr|year)/i.test(item.price);
    return {
      id: slugifyFutureItem(item.name, i),
      label: item.name,
      displayString: item.price,
      amountCents: cents,
      isRecurring,
      intervalMonths: 1 as const,
      startsNote: item.starts ?? "",
    };
  });
}

/** Optional Investment.DepositPercent (1..99) from the skill import. */
function inferDepositFromImport(raw: Record<string, unknown>): number | null {
  const value = raw["Investment.DepositPercent"];
  const num = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(num)) return null;
  const pct = Math.round(num);
  return pct >= 1 && pct <= 99 ? pct : null;
}

/** Optional Content.TrackRecord from the import: an intro plus case studies (text + url). */
function inferTrackRecordFromImport(
  raw: Record<string, unknown>
): { intro: string; caseStudies: CaseStudyDraft[] } | null {
  const block = raw["Content.TrackRecord"] as
    | { intro?: string; caseStudies?: { text?: string; url?: string; href?: string }[] }
    | undefined;
  if (!block || !Array.isArray(block.caseStudies)) return null;
  const caseStudies = block.caseStudies
    .map((cs) => ({ text: (cs.text ?? "").trim(), href: (cs.url ?? cs.href ?? "").trim() }))
    .filter((cs) => cs.text.length > 0)
    .slice(0, MAX_CASE_STUDIES);
  if (caseStudies.length === 0) return null;
  return { intro: (block.intro ?? "").trim(), caseStudies };
}

/** Live character (and optional word) count. `max` marks the send-blocking limits from
 * validation - near-limit turns amber, over-limit red (imports can exceed; typing can't). */
function FieldCounter({ value, max, words }: { value: string; max?: number; words?: boolean }) {
  const chars = value.length;
  const wordCount = words ? (value.trim() ? value.trim().split(/\s+/).length : 0) : null;
  const over = max !== undefined && chars > max;
  const near = max !== undefined && !over && chars >= max * 0.9;
  return (
    <span
      className={cn(
        "shrink-0 text-xs tabular-nums",
        over
          ? "font-medium text-destructive"
          : near
            ? "text-warning-subtle-foreground"
            : "text-muted-foreground"
      )}
    >
      {wordCount !== null ? `${wordCount} words · ` : ""}
      {chars}
      {max !== undefined ? ` / ${max}` : ""} chars
    </span>
  );
}

function LabelRow({
  label,
  htmlFor,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <Label className="text-xs" htmlFor={htmlFor}>
        {label}
      </Label>
      {children}
    </div>
  );
}

/* multiline: real paragraphs (Textarea). grow: single-line semantics but sentence-length
   values — renders as a wrapping GrowingInput so nothing clips out of view. */
const tokenFieldGroups: { heading: string; fields: { key: keyof TokensJson; label: string; multiline?: boolean; grow?: boolean; max?: number }[] }[] = [
  {
    heading: "Client",
    fields: [
      { key: "Client.FirstName", label: "First name" },
      { key: "Client.LastName", label: "Last name (optional)" },
      { key: "Client.Company", label: "Company" },
      { key: "Client.ProposalTitle", label: "Proposal title", grow: true, max: MAX_PROPOSAL_TITLE_CHARS },
    ],
  },
  {
    heading: "At a Glance",
    fields: [
      { key: "Client.AtGlanceServices", label: "What we're building", multiline: true },
      { key: "Client.AtGlanceInvestment", label: "Investment summary", grow: true },
      { key: "Client.AtGlanceTimeline", label: "Timeline summary", grow: true },
      { key: "Document.CreatedDate", label: "Created date" },
      { key: "Client.ValidUntil", label: "Valid until" },
    ],
  },
  {
    heading: "Narrative",
    fields: [
      { key: "Client.ProblemTitle", label: "Problem title", grow: true },
      { key: "Client.ProblemText", label: "Problem text", multiline: true },
      { key: "Client.SolutionTitle", label: "Solution title", grow: true },
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

export function MoneyFields({
  value,
  onChange,
  withInterval,
  withDiscount,
}: {
  value: {
    label: string;
    displayString: string;
    amountCents: number;
    intervalMonths?: 1 | 3 | 12;
    discountEnabled?: boolean;
    discountCents?: number;
    discountReason?: string;
  };
  onChange: (next: typeof value) => void;
  withInterval?: boolean;
  withDiscount?: boolean;
}) {
  // Instance-scoped ids: MoneyFields mounts several times per form (flat, per tier).
  const uid = React.useId();
  const discountOn = Boolean(withDiscount && value.discountEnabled);
  const discountCents = value.discountCents ?? 0;
  // amountCents is the NET; the list price is what the client would pay without the discount.
  const listCents = value.amountCents + discountCents;
  const cadence = withInterval ? (value.intervalMonths ?? 1) : null;

  const { mismatch, netTooLow, reasonMissing } = moneyDraftIssues(value, Boolean(withDiscount));

  // Editing the list price or the discount recomputes the net + the client-facing display string.
  const setList = (dollars: string) => {
    const newList = Math.max(0, Math.round(Number(dollars || 0) * 100));
    const net = Math.max(0, newList - discountCents);
    onChange({ ...value, amountCents: net, displayString: formatPricedLine(net, cadence) });
  };
  const setDiscount = (dollars: string) => {
    const newDiscount = Math.max(0, Math.round(Number(dollars || 0) * 100));
    const net = Math.max(0, listCents - newDiscount);
    onChange({ ...value, amountCents: net, discountCents: newDiscount, displayString: formatPricedLine(net, cadence) });
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-12">
        <div className="col-span-2 sm:col-span-4">
          <LabelRow label={`Label${withDiscount ? " (name on Stripe)" : ""}`} htmlFor={`${uid}-label`}>
            <FieldCounter value={value.label} max={MAX_LINE_LABEL_CHARS} />
          </LabelRow>
          <GrowingInput
            id={`${uid}-label`}
            value={value.label}
            maxLength={MAX_LINE_LABEL_CHARS}
            onChange={(e) => onChange({ ...value, label: e.target.value })}
            placeholder="Website build"
          />
        </div>
        {discountOn ? (
          <>
            <div className="col-span-1 sm:col-span-3">
              <Label className="text-xs" htmlFor={`${uid}-list`}>List price ($)</Label>
              <Input
                id={`${uid}-list`}
                type="number"
                min={0}
                step="0.01"
                value={listCents ? (listCents / 100).toString() : ""}
                onChange={(e) => setList(e.target.value)}
              />
            </div>
            <div className="col-span-1 sm:col-span-3">
              <Label className="text-xs" htmlFor={`${uid}-discount`}>Discount ($)</Label>
              <Input
                id={`${uid}-discount`}
                type="number"
                min={0}
                step="0.01"
                value={discountCents ? (discountCents / 100).toString() : ""}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>
          </>
        ) : (
          <>
            <div className="col-span-2 sm:col-span-4">
              <Label className="text-xs" htmlFor={`${uid}-display`}>Shown to client</Label>
              <GrowingInput
                id={`${uid}-display`}
                value={value.displayString}
                onChange={(e) => {
                  const displayString = e.target.value;
                  const cents = parseCentsFromDisplayString(displayString);
                  onChange({ ...value, displayString, amountCents: cents ?? value.amountCents });
                }}
                placeholder="$1,997"
              />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <Label className="text-xs" htmlFor={`${uid}-charged`}>Charged ($)</Label>
              <Input
                id={`${uid}-charged`}
                type="number"
                min={0}
                step="0.01"
                value={value.amountCents ? (value.amountCents / 100).toString() : ""}
                onChange={(e) =>
                  onChange({ ...value, amountCents: Math.round(Number(e.target.value || 0) * 100) })
                }
              />
            </div>
          </>
        )}
        {withInterval ? (
          <div className="col-span-1 sm:col-span-2">
            <Label className="text-xs" htmlFor={`${uid}-interval`}>Every</Label>
            <Select
              items={INTERVAL_ITEMS}
              value={value.intervalMonths ?? 1}
              onValueChange={(interval) =>
                onChange({ ...value, intervalMonths: interval as 1 | 3 | 12 })
              }
            >
              <SelectTrigger id={`${uid}-interval`} aria-label="Billing interval" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVAL_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {discountOn ? (
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-12">
          <div className="sm:col-span-8">
            <Label className="text-xs" htmlFor={`${uid}-reason`}>Discount reason (shown to client)</Label>
            <GrowingInput
              id={`${uid}-reason`}
              value={value.discountReason ?? ""}
              onChange={(e) => onChange({ ...value, discountReason: e.target.value })}
              placeholder="Loyalty discount"
            />
          </div>
          <div className="sm:col-span-4">
            <p className="text-xs text-muted-foreground">
              Charged on Stripe:{" "}
              <span className="font-medium text-foreground">
                {formatPricedLine(value.amountCents, cadence)}
              </span>
            </p>
          </div>
        </div>
      ) : null}

      {withDiscount ? (
        <div className="flex items-center gap-2">
          <Switch
            aria-label="Apply a discount"
            checked={discountOn}
            onCheckedChange={(v) => {
              if (v) {
                onChange({
                  ...value,
                  discountEnabled: true,
                  discountCents: value.discountCents ?? 0,
                  discountReason: value.discountReason ?? "",
                });
              } else {
                // Removing the discount restores the list price as the charged amount.
                onChange({
                  ...value,
                  discountEnabled: false,
                  amountCents: listCents,
                  discountCents: 0,
                  discountReason: "",
                  displayString: formatPricedLine(listCents, cadence),
                });
              }
            }}
          />
          <Label className="text-xs">Apply a discount</Label>
        </div>
      ) : null}

      {mismatch ? (
        <p data-pricing-issue className="text-xs text-destructive">
          Display says {value.displayString} but {(value.amountCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} will be charged. Make them match before sending.
        </p>
      ) : null}
      {netTooLow ? (
        <p data-pricing-issue className="text-xs text-destructive">The discount can&apos;t be the whole price.</p>
      ) : null}
      {reasonMissing ? (
        <p data-pricing-issue className="text-xs text-destructive">Add a reason for the discount. The client sees it.</p>
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
  initialTrackRecord,
}: {
  mode: "create" | "edit";
  proposalId?: string;
  initialTitle?: string;
  initialTokens?: Record<string, string>;
  initialConfig?: PaymentConfig | null;
  initialTrackRecord?: TrackRecordConfig | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [importText, setImportText] = React.useState("");
  const [state, setState] = React.useState<FormState>(() => ({
    title: initialTitle ?? "",
    tokens: initialTokens ?? blankTokens(),
    trackRecordIntro: "",
    caseStudies: [],
    pricingMode: "flat",
    oneTimeEnabled: false,
    oneTime: { ...emptyMoney, label: "One-time build" },
    recurringEnabled: true,
    recurring: { ...emptyMoney, label: "Monthly retainer", intervalMonths: 1 },
    tiers: [blankTier(0), blankTier(1), blankTier(2)],
    addOns: [],
    futureItems: [],
    depositEnabled: false,
    depositPercent: 50,
    methods: { card: true, ach: false },
    preferAch: false,
    manualInvoice: false,
    ...configToState(initialConfig ?? null),
    ...trackRecordToState(initialTrackRecord ?? null),
  }));

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  // Deposit applies only to a one-time build fee (flat or on a tier).
  const hasOneTime =
    (state.pricingMode === "flat" && state.oneTimeEnabled) ||
    (state.pricingMode === "tiers" && state.tiers.some((t) => t.oneTimeEnabled));

  function handleImport(overrideText?: string) {
    let raw: unknown;
    try {
      raw = JSON.parse(overrideText ?? importText);
    } catch {
      brandToast("warning", "That isn't valid JSON.");
      return;
    }
    const { tokens, errors } = normalizeImportedTokens(raw);
    if (!tokens) {
      brandToast("warning", `Import failed: ${errors[0]}`);
      return;
    }
    // Recognized non-token keys are enumerated in IMPORT_KEYS (lib/importPricing).
    // Teach the import a new key → add it there and document it in /docs, or the
    // docs page stops compiling.
    const rawObj = raw as Record<string, unknown>;
    const inferredTiers = inferTiersFromImport(rawObj);
    // Flat pricing only when the deal isn't tiered; tiers always win.
    const inferredFlat = inferredTiers ? null : inferFlatPricingFromImport(rawObj);
    const inferredAddOns = inferAddOnsFromImport(rawObj);
    const inferredFutureItems = inferFutureItemsFromImport(rawObj);
    const inferredDeposit = inferDepositFromImport(rawObj);
    const inferredTrackRecord = inferTrackRecordFromImport(rawObj);
    const nextState: FormState = {
      ...state,
      title: tokens["Client.ProposalTitle"],
      tokens: tokens as unknown as Record<string, string>,
      ...(inferredTiers
        ? { pricingMode: "tiers" as PricingMode, tiers: inferredTiers }
        : {}),
      ...(inferredFlat
        ? {
            pricingMode: "flat" as PricingMode,
            oneTimeEnabled: Boolean(inferredFlat.oneTime),
            oneTime: inferredFlat.oneTime ? moneyToDraft(inferredFlat.oneTime) : state.oneTime,
            recurringEnabled: Boolean(inferredFlat.recurring),
            recurring: inferredFlat.recurring
              ? recurringToDraft(inferredFlat.recurring)
              : state.recurring,
            ...(inferredFlat.methods ? { methods: inferredFlat.methods } : {}),
            ...(inferredFlat.preferAch !== null ? { preferAch: inferredFlat.preferAch } : {}),
          }
        : {}),
      ...(inferredAddOns ? { addOns: inferredAddOns } : {}),
      ...(inferredFutureItems ? { futureItems: inferredFutureItems } : {}),
      ...(inferredDeposit ? { depositEnabled: true, depositPercent: inferredDeposit } : {}),
      // Top-level `manualInvoice: true` flows for flat and tiered alike (independent of pricing shape).
      ...(typeof rawObj.manualInvoice === "boolean" ? { manualInvoice: rawObj.manualInvoice } : {}),
      ...(inferredTrackRecord
        ? {
            trackRecordIntro: inferredTrackRecord.intro,
            caseStudies: inferredTrackRecord.caseStudies,
          }
        : {}),
    };
    setState(nextState);
    const extras = [
      inferredTiers ? `${inferredTiers.length} pricing tiers` : null,
      inferredFlat ? "flat pricing" : null,
      inferredAddOns ? `${inferredAddOns.length} add-ons` : null,
      inferredFutureItems ? `${inferredFutureItems.length} later-phase items` : null,
      inferredDeposit ? `${inferredDeposit}% deposit` : null,
      inferredTrackRecord ? `${inferredTrackRecord.caseStudies.length} case studies` : null,
    ].filter(Boolean);
    const discountSummary = summarizeImportedDiscounts(stateToConfig(nextState));
    const discountNote = discountSummary.length
      ? ` Discounts: ${discountSummary.join("; ")}. Confirm the net is right.`
      : "";
    brandToast(
      "success",
      (extras.length
        ? `Imported with ${extras.join(", ")}. Review the amounts.`
        : "Imported. Set up pricing below.") + discountNote
    );
    // Land the admin at the start of the filled-in proposal, not the import box.
    requestAnimationFrame(() => {
      document
        .querySelector("[data-import-scroll-target]")
        ?.scrollIntoView({ behavior: appScrollBehavior(), block: "start" });
    });
  }

  async function handleSave() {
    const discountDrafts = [
      state.pricingMode === "flat" && state.oneTimeEnabled ? state.oneTime : null,
      state.pricingMode === "flat" && state.recurringEnabled ? state.recurring : null,
      ...(state.pricingMode === "tiers"
        ? state.tiers.flatMap((t) => [
            t.oneTimeEnabled ? t.oneTime : null,
            t.recurringEnabled ? t.recurring : null,
          ])
        : []),
      ...state.addOns,
    ].filter((d): d is NonNullable<typeof d> => d !== null);

    if (discountDrafts.some((d) => hasMoneyDraftIssue(d, true))) {
      brandToast("warning", "Fix the highlighted pricing issues before saving.");
      // The advisories can sit several cards below the fold — take the admin to the first one.
      requestAnimationFrame(() => {
        document
          .querySelector("[data-pricing-issue]")
          ?.scrollIntoView({ behavior: appScrollBehavior(), block: "center" });
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: state.title || state.tokens["Client.ProposalTitle"] || "Untitled proposal",
        tokens: state.tokens,
        paymentConfig: stateToConfig(state),
        trackRecord: stateToTrackRecord(state),
      };
      const result =
        mode === "create"
          ? await createProposal(payload)
          : await updateProposal({ id: proposalId!, ...payload });
      if (!result.ok) {
        brandToast("error", result.error);
        return;
      }
      brandToast("success", mode === "create" ? "Proposal created" : "Saved");
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
    <div className="space-y-5">
      {mode === "create" ? (
        <Card>
          <CardHeader>
            <CardTitle>Import from generate-proposal skill</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              onPaste={(e) => {
                // Pasting a full tokens JSON fills the form immediately — no extra click.
                // Anything that isn't valid JSON pastes normally (partial edits).
                const text = e.clipboardData.getData("text");
                try {
                  JSON.parse(text);
                } catch {
                  return;
                }
                e.preventDefault();
                setImportText(text);
                handleImport(text);
              }}
              placeholder='Paste the tokens JSON ({"Client.ProposalTitle": ...}) — it fills the form on paste'
              aria-label="Tokens JSON to import"
              className="min-h-24 font-mono text-xs"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleImport()}
              disabled={!importText.trim()}
            >
              Parse &amp; fill form
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {tokenFieldGroups.map((group, groupIndex) => (
        <Card
          key={group.heading}
          {...(groupIndex === 0 ? { "data-import-scroll-target": "", className: "scroll-mt-20" } : {})}
        >
          <CardHeader>
            <CardTitle>{group.heading}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {group.fields.map((field) => (
              <div
                key={field.key}
                className={
                  field.multiline || field.grow ? "col-span-2 space-y-1.5" : "space-y-1.5"
                }
              >
                <LabelRow label={field.label} htmlFor={`tf-${field.key}`}>
                  {field.multiline || field.grow ? (
                    <FieldCounter
                      value={state.tokens[field.key] ?? ""}
                      max={field.max}
                      words={field.multiline}
                    />
                  ) : null}
                </LabelRow>
                {field.multiline ? (
                  <Textarea
                    id={`tf-${field.key}`}
                    value={state.tokens[field.key] ?? ""}
                    onChange={(e) =>
                      set("tokens", { ...state.tokens, [field.key]: e.target.value })
                    }
                    className="min-h-24"
                  />
                ) : field.grow ? (
                  <GrowingInput
                    id={`tf-${field.key}`}
                    value={state.tokens[field.key] ?? ""}
                    maxLength={field.max}
                    onChange={(e) =>
                      set("tokens", { ...state.tokens, [field.key]: e.target.value })
                    }
                  />
                ) : (
                  <Input
                    id={`tf-${field.key}`}
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
          <CardTitle>Our Track Record</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Case studies shown on the proposal. Leave it empty to hide the whole section. The
            heading and the results-vary disclaimer are added for you.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="tr-intro">Intro (optional lead-in above the case studies)</Label>
            <Textarea
              id="tr-intro"
              value={state.trackRecordIntro}
              onChange={(e) => set("trackRecordIntro", e.target.value)}
              className="min-h-20"
              placeholder="We build marketing infrastructure for service businesses..."
            />
          </div>
          {state.caseStudies.map((cs, index) => (
            <Card key={index} variant="outlined" size="sm" className="gap-2 px-(--card-spacing)">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">Case study {index + 1}</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() =>
                    set("caseStudies", state.caseStudies.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor={`cs-${index}-text`}>Result</Label>
                <Textarea
                  id={`cs-${index}-text`}
                  value={cs.text}
                  onChange={(e) => {
                    const caseStudies = [...state.caseStudies];
                    caseStudies[index] = { ...cs, text: e.target.value };
                    set("caseStudies", caseStudies);
                  }}
                  className="min-h-16"
                  placeholder="A local restaurant went from 14 to 132 reviews in 60 days."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor={`cs-${index}-url`}>Link URL (optional)</Label>
                <GrowingInput
                  id={`cs-${index}-url`}
                  value={cs.href}
                  onChange={(e) => {
                    const caseStudies = [...state.caseStudies];
                    caseStudies[index] = { ...cs, href: e.target.value };
                    set("caseStudies", caseStudies);
                  }}
                  placeholder="https://rsla.io/work/..."
                />
              </div>
            </Card>
          ))}
          <div className="flex flex-wrap gap-2">
            {state.caseStudies.length < MAX_CASE_STUDIES ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => set("caseStudies", [...state.caseStudies, blankCaseStudy()])}
              >
                Add case study
              </Button>
            ) : null}
            {state.caseStudies.length === 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    trackRecordIntro: prev.trackRecordIntro || SUGGESTED_INTRO,
                    caseStudies: SUGGESTED_CASE_STUDIES.map((cs) => ({
                      text: cs.text,
                      href: cs.href,
                    })),
                  }))
                }
              >
                Load suggested examples
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Checkout: what the client pays after signing</CardTitle>
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
              <Card variant="outlined" size="sm" className="gap-2 px-(--card-spacing)">
                <div className="flex items-center gap-2">
                  <Switch
                    aria-label="One-time amount due at checkout"
                    checked={state.oneTimeEnabled}
                    onCheckedChange={(v) => set("oneTimeEnabled", Boolean(v))}
                  />
                  <Label>One-time amount due at checkout</Label>
                </div>
                {state.oneTimeEnabled ? (
                  <MoneyFields value={state.oneTime} onChange={(v) => set("oneTime", v)} withDiscount />
                ) : null}
              </Card>
              <Card variant="outlined" size="sm" className="gap-2 px-(--card-spacing)">
                <div className="flex items-center gap-2">
                  <Switch
                    aria-label="Recurring subscription starting at checkout"
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
                    withDiscount
                  />
                ) : null}
              </Card>
            </div>
          ) : null}

          {state.pricingMode === "tiers" ? (
            <div className="space-y-4">
              {state.tiers.map((tier, index) => (
                <Card key={index} variant="outlined" size="sm" className="px-(--card-spacing)">
                  <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-12">
                    <div className="col-span-2 sm:col-span-5">
                      <LabelRow label="Tier name" htmlFor={`tier-${index}-name`}>
                        <FieldCounter value={tier.label} />
                      </LabelRow>
                      <GrowingInput
                        id={`tier-${index}-name`}
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
                    <div className="col-span-1 flex items-center gap-2 pb-1.5 sm:col-span-4">
                      <Checkbox
                        aria-label="Most popular tier"
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
                    <div className="col-span-1 pb-1 text-right sm:col-span-3">
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
                    <Label className="text-xs" htmlFor={`tier-${index}-includes`}>Includes (one per line)</Label>
                    <Textarea
                      id={`tier-${index}-includes`}
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
                        aria-label="Tier one-time price"
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
                        withDiscount
                      />
                    ) : null}
                    <div className="flex items-center gap-2">
                      <Switch
                        aria-label="Tier recurring price"
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
                        withDiscount
                      />
                    ) : null}
                  </div>
                </Card>
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
            <Card variant="outlined" size="sm" className="gap-2 px-(--card-spacing)">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={state.manualInvoice}
                  onCheckedChange={(v) => set("manualInvoice", Boolean(v))}
                />
                <span className="text-sm font-medium">
                  Don&apos;t collect payment — I&apos;ll invoice manually
                </span>
              </label>
              <p className="text-xs text-muted-foreground">
                The full pricing still shows on the proposal and PDF and the client signs as normal,
                but no online checkout runs. The deal counts toward your dashboard revenue right away;
                mark it paid once you&apos;ve collected.
              </p>
            </Card>
          ) : null}

          {state.pricingMode !== "signOnly" && !state.manualInvoice ? (
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4 md:gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  aria-label="Accept card payments"
                  checked={state.methods.card}
                  onCheckedChange={(v) => set("methods", { ...state.methods, card: Boolean(v) })}
                />
                <Label className="text-sm">Card</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  aria-label="Accept ACH bank transfer"
                  checked={state.methods.ach}
                  onCheckedChange={(v) => set("methods", { ...state.methods, ach: Boolean(v) })}
                />
                <Label className="text-sm">ACH bank transfer</Label>
              </div>
              {state.methods.ach ? (
                <div className="flex items-center gap-2">
                  <Switch aria-label="Prefer ACH" checked={state.preferAch} onCheckedChange={(v) => set("preferAch", Boolean(v))} />
                  <Label className="text-sm">Prefer ACH (6+ month contracts)</Label>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {state.pricingMode !== "signOnly" ? (
        <Card>
          <CardHeader>
            <CardTitle>Add-ons and deposit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Optional add-ons</p>
                <p className="text-xs text-muted-foreground">
                  The client can toggle these on top of the price they pick. Each is one-time or
                  recurring.
                </p>
              </div>
              {state.addOns.map((addOn, index) => (
                <Card key={index} variant="outlined" size="sm" className="gap-2 px-(--card-spacing)">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        aria-label="Recurring add-on"
                        checked={addOn.isRecurring}
                        onCheckedChange={(v) => {
                          const addOns = [...state.addOns];
                          addOns[index] = { ...addOn, isRecurring: Boolean(v) };
                          set("addOns", addOns);
                        }}
                      />
                      <Label className="text-xs">Recurring</Label>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => set("addOns", state.addOns.filter((_, i) => i !== index))}
                    >
                      Remove
                    </Button>
                  </div>
                  <MoneyFields
                    value={{
                      label: addOn.label,
                      displayString: addOn.displayString,
                      amountCents: addOn.amountCents,
                      intervalMonths: addOn.intervalMonths,
                      discountEnabled: addOn.discountEnabled,
                      discountCents: addOn.discountCents,
                      discountReason: addOn.discountReason,
                    }}
                    onChange={(v) => {
                      const addOns = [...state.addOns];
                      addOns[index] = {
                        ...addOn,
                        label: v.label,
                        displayString: v.displayString,
                        amountCents: v.amountCents,
                        intervalMonths: (v.intervalMonths ?? addOn.intervalMonths) as 1 | 3 | 12,
                        discountEnabled: v.discountEnabled,
                        discountCents: v.discountCents,
                        discountReason: v.discountReason,
                      };
                      set("addOns", addOns);
                    }}
                    withInterval={addOn.isRecurring}
                    withDiscount
                  />
                </Card>
              ))}
              {state.addOns.length < 10 ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => set("addOns", [...state.addOns, blankAddOn()])}
                >
                  Add add-on
                </Button>
              ) : null}
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <div>
                <p className="text-sm font-medium">Later phases (display-only)</p>
                <p className="text-xs text-muted-foreground">
                  Shown with pricing but never charged at signing — for Phase 2 or future services
                  that start later. You bill these separately when they begin.
                </p>
              </div>
              {state.futureItems.map((item, index) => (
                <Card
                  key={index}
                  variant="outlined"
                  size="sm"
                  dashed
                  className="gap-2 px-(--card-spacing)"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        aria-label="Recurring later-phase line"
                        checked={item.isRecurring}
                        onCheckedChange={(v) => {
                          const futureItems = [...state.futureItems];
                          futureItems[index] = { ...item, isRecurring: Boolean(v) };
                          set("futureItems", futureItems);
                        }}
                      />
                      <Label className="text-xs">Recurring</Label>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() =>
                        set(
                          "futureItems",
                          state.futureItems.filter((_, i) => i !== index)
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                  <MoneyFields
                    value={{
                      label: item.label,
                      displayString: item.displayString,
                      amountCents: item.amountCents,
                      intervalMonths: item.intervalMonths,
                    }}
                    onChange={(v) => {
                      const futureItems = [...state.futureItems];
                      futureItems[index] = {
                        ...item,
                        label: v.label,
                        displayString: v.displayString,
                        amountCents: v.amountCents,
                        intervalMonths: (v.intervalMonths ?? item.intervalMonths) as 1 | 3 | 12,
                      };
                      set("futureItems", futureItems);
                    }}
                    withInterval={item.isRecurring}
                  />
                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor={`future-${index}-starts`}>Starts</Label>
                    <GrowingInput
                      id={`future-${index}-starts`}
                      value={item.startsNote}
                      placeholder="After launch"
                      onChange={(e) => {
                        const futureItems = [...state.futureItems];
                        futureItems[index] = { ...item, startsNote: e.target.value };
                        set("futureItems", futureItems);
                      }}
                    />
                  </div>
                </Card>
              ))}
              {state.futureItems.length < 6 ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => set("futureItems", [...state.futureItems, blankFutureItem()])}
                >
                  Add later-phase item
                </Button>
              ) : null}
            </div>

            {!state.manualInvoice ? (
            <div className="space-y-2 border-t border-border pt-4">
              <div className="flex items-center gap-2">
                <Switch
                  aria-label="Charge a deposit only at signing"
                  checked={state.depositEnabled}
                  disabled={!hasOneTime}
                  onCheckedChange={(v) => set("depositEnabled", Boolean(v))}
                />
                <Label>Charge a deposit only at signing</Label>
              </div>
              {!hasOneTime ? (
                <p className="text-xs text-muted-foreground">
                  Add a one-time build fee (flat, or on at least one tier) to use a deposit.
                </p>
              ) : state.depositEnabled ? (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-28">
                    <Label className="text-xs">Deposit %</Label>
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={state.depositPercent}
                      onChange={(e) =>
                        set(
                          "depositPercent",
                          Math.min(99, Math.max(1, Math.round(Number(e.target.value) || 0)))
                        )
                      }
                    />
                  </div>
                  <p className="flex-1 text-xs text-muted-foreground">
                    Only this share of the one-time build fee is charged at signing. The rest is
                    collected later, and any monthly retainer is deferred and started when the build
                    is done.
                  </p>
                </div>
              ) : null}
            </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-end gap-2 pb-12">
        <Button variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button onClick={handleSave} loading={saving}>
          {mode === "create" ? "Create draft" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
