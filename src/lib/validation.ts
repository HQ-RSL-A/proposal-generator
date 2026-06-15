import { z } from "zod";
import { TOKEN_KEYS, type PaymentConfig, type TokensJson } from "@/lib/types";
import { displayMatchesCents } from "@/lib/currency";
import { MAX_CASE_STUDIES } from "@/lib/trackRecord";

// ---------- Tokens JSON ----------

const nonEmpty = z.string().trim().min(1);

export const tokensJsonSchema = z
  .object(
    Object.fromEntries(TOKEN_KEYS.map((k) => [k, nonEmpty])) as Record<
      keyof TokensJson,
      typeof nonEmpty
    >
  )
  // Older skill outputs carry extra keys (e.g. Client.CaseStudy); accept and drop them.
  .catchall(z.unknown())
  .transform((parsed) => {
    const clean = {} as TokensJson;
    for (const key of TOKEN_KEYS) clean[key] = (parsed[key] as string).trim();
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
      errors: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
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

const oneTimeItemSchema = z.object({
  amountCents: z.number().int().positive(),
  displayString: nonEmpty,
  label: nonEmpty,
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
  label: nonEmpty,
  displayString: nonEmpty,
  amountCents: z.number().int().positive(),
  intervalMonths: z.union([z.literal(1), z.literal(3), z.literal(12)]).nullable(),
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
 * Send-time validation: every display string must match its structured cents.
 * Catches the "edited the display but not the amount" class of mistakes.
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
