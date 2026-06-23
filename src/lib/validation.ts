import { z } from "zod";
import { TOKEN_KEYS, type PaymentConfig, type TokensJson } from "@/lib/types";
import { displayMatchesCents, formatCents } from "@/lib/currency";
import { MAX_LINE_LABEL_CHARS, MAX_PROPOSAL_TITLE_CHARS, STRIPE_MIN_CHARGE_CENTS } from "@/lib/constants";
import { MAX_CASE_STUDIES } from "@/lib/trackRecord";
import { humanizeZodError } from "@/lib/zodErrors";

// ---------- Tokens JSON ----------

const nonEmpty = z.string().trim().min(1);
/** A charged-line label becomes a Stripe product name; cap it under Stripe's limit (RSL-36). */
const lineLabel = z.string().trim().min(1).max(MAX_LINE_LABEL_CHARS);
/** Tokens allowed to be blank or omitted (e.g. a client known only by first name). */
const OPTIONAL_TOKEN_KEYS = new Set<string>(["Client.LastName"]);
const optionalText = z.string().trim().optional();

const titleSchema = nonEmpty.max(MAX_PROPOSAL_TITLE_CHARS);
export const tokensJsonSchema = z
  .object(
    Object.fromEntries(
      TOKEN_KEYS.map((k) => [
        k,
        OPTIONAL_TOKEN_KEYS.has(k)
          ? optionalText
          : k === "Client.ProposalTitle"
            ? titleSchema
            : nonEmpty,
      ])
    ) as Record<string, z.ZodTypeAny>
  )
  // Older skill outputs carry extra keys (e.g. Client.CaseStudy); accept and drop them.
  .catchall(z.unknown())
  .transform((parsed) => {
    const clean = {} as TokensJson;
    for (const key of TOKEN_KEYS) clean[key] = String(parsed[key] ?? "").trim();
    return clean;
  });

/**
 * The skill omits Client.ValidUntil / Document.CreatedDate in some older outputs.
 * Import fills them: CreatedDate = today, ValidUntil = today + 30 days.
 */
export function normalizeImportedTokens(raw: unknown): {
  tokens: TokensJson | null;
  errors: string[];
} {
  if (typeof raw !== "object" || raw === null) {
    return { tokens: null, errors: ["Pasted content is not a JSON object."] };
  }
  const candidate = { ...(raw as Record<string, unknown>) };
  const today = new Date();
  const validUntil = new Date(today);
  validUntil.setDate(validUntil.getDate() + 30);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  if (!candidate["Document.CreatedDate"]) candidate["Document.CreatedDate"] = fmt(today);
  if (!candidate["Client.ValidUntil"]) candidate["Client.ValidUntil"] = fmt(validUntil);

  const result = tokensJsonSchema.safeParse(candidate);
  if (!result.success) {
    return {
      tokens: null,
      errors: [humanizeZodError(result.error)],
    };
  }
  return { tokens: result.data, errors: [] };
}

// ---------- Track record ----------

// A case study link is optional: blank renders as plain text, otherwise it must be a full URL.
const caseStudyHrefSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || z.url().safeParse(v).success, {
    message: "Each case study link must be a full URL or left blank.",
  });

const trackRecordCaseStudySchema = z.object({
  text: nonEmpty,
  href: caseStudyHrefSchema,
});

/** Per-proposal Track Record. Intro may be empty; an empty caseStudies list hides the section. */
export const trackRecordConfigSchema = z.object({
  intro: z.string().trim(),
  caseStudies: z.array(trackRecordCaseStudySchema).max(MAX_CASE_STUDIES),
});

// ---------- Payment config ----------

// Optional per-line discount. amountCents on the line is already the NET, so a positive integer
// discount + a positive net means the original (net + discount) is always > 0 — no extra net guard
// is needed beyond the int().positive() on each line's amountCents.
const discountSchema = z
  .object({
    amountCents: z.number().int().positive(),
    reason: nonEmpty,
  })
  .nullable()
  .optional();

const oneTimeItemSchema = z.object({
  amountCents: z.number().int().positive(),
  displayString: nonEmpty,
  label: lineLabel,
  discount: discountSchema,
});

const recurringItemSchema = oneTimeItemSchema.extend({
  intervalMonths: z.union([z.literal(1), z.literal(3), z.literal(12)]),
});

const tierConfigSchema = z.object({
  id: nonEmpty,
  label: nonEmpty,
  recommended: z.boolean(),
  includes: z.array(z.string().trim().min(1)),
  oneTime: oneTimeItemSchema.nullable(),
  recurring: recurringItemSchema.nullable(),
});

const addOnSchema = z.object({
  id: nonEmpty,
  label: lineLabel,
  displayString: nonEmpty,
  amountCents: z.number().int().positive(),
  intervalMonths: z.union([z.literal(1), z.literal(3), z.literal(12)]).nullable(),
  discount: discountSchema,
});

const futureItemSchema = z.object({
  id: nonEmpty,
  label: nonEmpty,
  displayString: nonEmpty,
  amountCents: z.number().int().positive(),
  intervalMonths: z.union([z.literal(1), z.literal(3), z.literal(12)]).nullable(),
  startsNote: nonEmpty,
  discount: discountSchema,
});

const depositConfigSchema = z.object({
  depositPercent: z.number().int().min(1).max(99),
});

export const paymentConfigSchema = z
  .object({
    currency: z.literal("usd"),
    paymentMethods: z.array(z.enum(["card", "us_bank_account"])).min(1),
    oneTime: oneTimeItemSchema.nullable(),
    recurring: recurringItemSchema.nullable(),
    tiers: z.array(tierConfigSchema).min(2).max(4).nullable(),
    preferAch: z.boolean(),
    addOns: z.array(addOnSchema).max(10).nullable().optional(),
    deposit: depositConfigSchema.nullable().optional(),
    futureItems: z.array(futureItemSchema).max(6).nullable().optional(),
    manualInvoice: z.boolean().optional(),
  })
  .superRefine((config, ctx) => {
    const hasFlat = Boolean(config.oneTime || config.recurring);
    const hasTiers = Boolean(config.tiers && config.tiers.length > 0);
    if (hasFlat && hasTiers) {
      ctx.addIssue({
        code: "custom",
        message: "Use either flat pricing (one-time/recurring) or tiers, not both.",
      });
    }
    if (hasTiers) {
      const tierIds = new Set(config.tiers!.map((t) => t.id));
      if (tierIds.size !== config.tiers!.length) {
        ctx.addIssue({ code: "custom", message: "Tier ids must be unique." });
      }
      if (config.tiers!.filter((t) => t.recommended).length > 1) {
        ctx.addIssue({ code: "custom", message: "Only one tier can be recommended." });
      }
      for (const tier of config.tiers!) {
        if (!tier.oneTime && !tier.recurring) {
          ctx.addIssue({
            code: "custom",
            message: `Tier "${tier.label}" needs a one-time or recurring amount.`,
          });
        }
      }
    }
    if (config.addOns && config.addOns.length > 0) {
      const ids = config.addOns.map((a) => a.id);
      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({ code: "custom", message: "Add-on ids must be unique." });
      }
    }
    if (config.futureItems && config.futureItems.length > 0) {
      const ids = config.futureItems.map((f) => f.id);
      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({ code: "custom", message: "Future item ids must be unique." });
      }
    }
    if (config.deposit) {
      const hasFlatOneTime = Boolean(config.oneTime);
      const hasTierOneTime = config.tiers?.some((t) => t.oneTime) ?? false;
      if (!hasFlatOneTime && !hasTierOneTime) {
        ctx.addIssue({
          code: "custom",
          message:
            "A deposit needs a one-time build fee. Add a one-time amount, or add it to at least one tier.",
        });
      }
    }
  });

/**
 * Every amount that can become a charged Stripe line across all selectable combinations: each
 * tier's first charged line (the deposit `round(pct x oneTime / 100)` when a deposit is set,
 * else the one-time) plus its recurring, the flat one-time/recurring, and each individually
 * selectable add-on. `futureItems` are display-only (never charged) and excluded. Mirrors
 * effectiveCheckout's deposit math so the floor agrees with the real charge (RSL-30).
 */
function chargedAmountsForFloor(config: PaymentConfig): { label: string; amountCents: number }[] {
  const out: { label: string; amountCents: number }[] = [];
  const depositPct = config.deposit?.depositPercent ?? null;

  const addBase = (
    oneTime: { amountCents: number; label: string } | null,
    recurring: { amountCents: number; label: string } | null
  ) => {
    if (oneTime) {
      if (depositPct != null && oneTime.amountCents > 0) {
        out.push({
          label: `${depositPct}% deposit on "${oneTime.label}"`,
          amountCents: Math.round((oneTime.amountCents * depositPct) / 100),
        });
      } else {
        out.push({ label: `"${oneTime.label}"`, amountCents: oneTime.amountCents });
      }
    }
    if (recurring) out.push({ label: `"${recurring.label}"`, amountCents: recurring.amountCents });
  };

  if (config.tiers && config.tiers.length > 0) {
    for (const tier of config.tiers) addBase(tier.oneTime, tier.recurring);
  } else {
    addBase(config.oneTime, config.recurring);
  }
  for (const addOn of config.addOns ?? []) {
    out.push({ label: `"${addOn.label}"`, amountCents: addOn.amountCents });
  }
  return out;
}

/**
 * Send-time validation: every display string must match its structured cents, and every charged
 * line must clear Stripe's $0.50 minimum. Catches "edited the display but not the amount" and
 * "a discount/deposit drove a charge below what Stripe will accept" before the proposal goes out.
 */
export function validatePaymentConfigForSend(config: PaymentConfig): string[] {
  const errors: string[] = [];
  const check = (item: { displayString: string; amountCents: number; label: string } | null) => {
    if (!item) return;
    if (!displayMatchesCents(item.displayString, item.amountCents)) {
      errors.push(
        `Price mismatch on "${item.label}": display shows "${item.displayString}" but the stored amount is ${(item.amountCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}.`
      );
    }
  };
  check(config.oneTime);
  check(config.recurring);
  for (const tier of config.tiers ?? []) {
    check(tier.oneTime);
    check(tier.recurring);
  }
  for (const addOn of config.addOns ?? []) {
    check(addOn);
  }
  for (const item of config.futureItems ?? []) {
    check(item);
  }
  // Manual-invoice proposals never reach Stripe, so the $0.50 card-charge floor doesn't apply.
  // The display<->cents integrity checks above still run — the priced config is what ships + signs.
  if (!config.manualInvoice) {
    for (const { label, amountCents } of chargedAmountsForFloor(config)) {
      if (amountCents < STRIPE_MIN_CHARGE_CENTS) {
        errors.push(
          `${label} charges ${formatCents(amountCents)}, below the ${formatCents(STRIPE_MIN_CHARGE_CENTS)} minimum a card charge allows. Raise the amount or drop the discount/deposit.`
        );
      }
    }
  }
  return errors;
}

// ---------- Parties ----------

export const partyInputSchema = z.object({
  name: nonEmpty,
  email: z.string().trim().toLowerCase().pipe(z.email()),
  payer: z.boolean(),
});

export const partiesSchema = z
  .array(partyInputSchema)
  .min(1, "At least one client signer is required.")
  .max(5)
  .superRefine((parties, ctx) => {
    const emails = new Set(parties.map((p) => p.email));
    if (emails.size !== parties.length) {
      ctx.addIssue({ code: "custom", message: "Each signer needs a unique email." });
    }
    if (parties.filter((p) => p.payer).length !== 1) {
      ctx.addIssue({ code: "custom", message: "Exactly one signer must be the payer." });
    }
  });
