// Domain types shared across web rendering, PDF rendering, actions, and APIs.

/** The tokens JSON produced by the generateProposal Claude Code skill. Dotted keys are intentional. */
export interface TokensJson {
  "Client.ProposalTitle": string;
  "Client.FirstName": string;
  "Client.LastName": string;
  "Client.Company": string;
  "Client.ProblemTitle": string;
  "Client.ProblemText": string;
  "Client.SolutionTitle": string;
  "Client.SolutionText": string;
  "Client.AtGlanceServices": string;
  "Client.AtGlanceInvestment": string;
  "Client.AtGlanceTimeline": string;
  "Client.ScopeItems": string;
  "Client.TimelineItems": string;
  "Client.InvestmentDetails": string;
  "Client.InvestmentNote": string;
  "Document.CreatedDate": string;
  "Client.ValidUntil": string;
}

export const TOKEN_KEYS: (keyof TokensJson)[] = [
  "Client.ProposalTitle",
  "Client.FirstName",
  "Client.LastName",
  "Client.Company",
  "Client.ProblemTitle",
  "Client.ProblemText",
  "Client.SolutionTitle",
  "Client.SolutionText",
  "Client.AtGlanceServices",
  "Client.AtGlanceInvestment",
  "Client.AtGlanceTimeline",
  "Client.ScopeItems",
  "Client.TimelineItems",
  "Client.InvestmentDetails",
  "Client.InvestmentNote",
  "Document.CreatedDate",
  "Client.ValidUntil",
];

/**
 * An optional per-line discount. Purely additive metadata: it never changes what's charged.
 * `amountCents` on the priced line is ALWAYS the net (post-discount) amount — the source of
 * truth that effectiveCheckout / Stripe / deposit / Notion all read. The original (pre-discount)
 * price is derived as `line.amountCents + discount.amountCents` (see originalCents in currency.ts).
 */
export interface Discount {
  /** The discount amount in integer cents (positive). */
  amountCents: number;
  /** What the discount is for, shown to the client, e.g. "Loyalty discount". */
  reason: string;
}

export interface OneTimeItem {
  /** Net (post-discount) amount in integer cents — exactly what Stripe charges. */
  amountCents: number;
  displayString: string;
  label: string;
  /** Optional discount applied to reach amountCents. Display + record only; never re-applied. */
  discount?: Discount | null;
}

export interface RecurringItem extends OneTimeItem {
  /** 1 = monthly, 3 = quarterly, 12 = annual */
  intervalMonths: 1 | 3 | 12;
}

export interface TierConfig {
  /** Stable slug, e.g. "tier-growth" */
  id: string;
  label: string;
  recommended: boolean;
  /** Bullet list shown in the pricing table */
  includes: string[];
  oneTime: OneTimeItem | null;
  recurring: RecurringItem | null;
}

export type PaymentMethodOption = "card" | "us_bank_account";

export interface AddOn {
  /** Stable slug, unique within a config, e.g. "addon-rush". */
  id: string;
  label: string;
  /** Shown to the client and on receipts. */
  displayString: string;
  /** Net (post-discount) amount in integer cents — exactly what Stripe charges. */
  amountCents: number;
  /** null = one-time charge; 1 | 3 | 12 = recurring on the same model as tiers. */
  intervalMonths: 1 | 3 | 12 | null;
  /** Optional discount applied to reach amountCents. Display + record only; never re-applied. */
  discount?: Discount | null;
}

/**
 * A priced line shown for information only — a later phase or future service (e.g. an ongoing
 * retainer that starts after launch). NEVER billed: it lives outside `effectiveCheckout` by
 * design, so it can't reach Stripe. Display + send-time validation treat it like any priced line.
 */
export interface FutureItem {
  /** Stable slug, unique within a config, e.g. "future-seo". */
  id: string;
  label: string;
  /** Shown to the client; must match amountCents to the cent. */
  displayString: string;
  amountCents: number;
  /** null = one-time; 1 | 3 | 12 = recurring cadence (shown, never charged). */
  intervalMonths: 1 | 3 | 12 | null;
  /** When it begins, e.g. "After launch" or "Q3 2026". */
  startsNote: string;
  /** Optional discount for display consistency. Never charged (FutureItems skip checkout). */
  discount?: Discount | null;
}

export interface DepositConfig {
  /** Integer percent (1..99). Applies to the one-time build fee only. Default 50. */
  depositPercent: number;
}

export interface PaymentConfig {
  currency: "usd";
  paymentMethods: PaymentMethodOption[];
  /** Flat pricing — mutually exclusive with tiers */
  oneTime: OneTimeItem | null;
  recurring: RecurringItem | null;
  /** Tiered pricing — client picks one on the signing page */
  tiers: TierConfig[] | null;
  preferAch: boolean;
  /** Global optional add-ons offered on top of the selected tier or flat price. */
  addOns?: AddOn[] | null;
  /** When set, only this fraction of the one-time build fee is charged at signing. */
  deposit?: DepositConfig | null;
  /** Display-only future/Phase-2 lines: shown with pricing, never charged (excluded from checkout). */
  futureItems?: FutureItem[] | null;
  /**
   * When true, the full pricing renders and the proposal signs normally, but no Stripe checkout is
   * created — the owner invoices manually and later marks it paid. Optional/absent = normal checkout.
   */
  manualInvoice?: boolean;
}

export interface TrackRecordCaseStudy {
  /** Display text for the result. */
  text: string;
  /** Link to the case study. Optional: renders as a link when set, plain text when "". */
  href: string;
}

/** Per-proposal "Our Track Record". Heading + disclaimer stay fixed; these two are editable. */
export interface TrackRecordConfig {
  /** Optional lead-in line; rendered only when non-empty. */
  intro: string;
  /** Empty = the section (and its disclaimer footnote) is hidden. */
  caseStudies: TrackRecordCaseStudy[];
}

/** Immutable snapshot taken at send time. The legal record. */
export interface FrozenContent {
  proposalId: string;
  versionNumber: number;
  tokens: TokensJson;
  paymentConfig: PaymentConfig;
  trackRecord: TrackRecordConfig;
  msaVersionId: string;
  msaVersionLabel: string;
  msaSha256: string;
}

/** True when nothing is collected at checkout (sign-only proposals, invoiced separately). */
export function isSignOnly(config: PaymentConfig): boolean {
  return !config.oneTime && !config.recurring && (!config.tiers || config.tiers.length === 0);
}

/**
 * Manual-invoice mode: pricing is shown and signed, but nothing is charged at checkout — the owner
 * invoices manually and marks it paid later. Guarded by `!isSignOnly` so a stray flag on a $0
 * config degrades to plain sign-only (NOT_REQUIRED) rather than a meaningless MANUAL_INVOICE state.
 */
export function isManualInvoice(config: PaymentConfig): boolean {
  return config.manualInvoice === true && !isSignOnly(config);
}

/** No Stripe checkout follows signing — either nothing is priced, or it's manual-invoice. */
export function skipsCheckout(config: PaymentConfig): boolean {
  return isSignOnly(config) || config.manualInvoice === true;
}

/** The amounts that apply once a tier is (or isn't) selected. */
export function effectiveLineItems(
  config: PaymentConfig,
  selectedTierId: string | null
): { oneTime: OneTimeItem | null; recurring: RecurringItem | null } {
  if (config.tiers && config.tiers.length > 0) {
    const tier = config.tiers.find((t) => t.id === selectedTierId);
    if (!tier) return { oneTime: null, recurring: null };
    return { oneTime: tier.oneTime, recurring: tier.recurring };
  }
  return { oneTime: config.oneTime, recurring: config.recurring };
}

/** A single thing Stripe charges at signing. intervalMonths null = one-time. */
export interface CheckoutLineItem {
  /** Net (post-discount) amount in cents — discounts are already baked into the line amounts. */
  amountCents: number;
  label: string;
  intervalMonths: 1 | 3 | 12 | null;
  isDeposit: boolean;
  isAddOn: boolean;
}

export interface EffectiveCheckout {
  /** What Stripe charges at signing. */
  lineItems: CheckoutLineItem[];
  /** True when the deposit transform collapsed the charge to a single one-time deposit. */
  depositActive: boolean;
  /** Deposit amount in cents, or null when deposit is not active. */
  depositAmountCents: number | null;
  /** One-time build fee minus the deposit (collected later; never charged here). */
  remainingAfterDepositCents: number | null;
  /** Base recurring item deferred when deposit is active (for schedule copy only). */
  deferredRecurring: RecurringItem | null;
}

/**
 * Resolves the full set of line items to charge at signing: base tier/flat amount(s)
 * plus selected add-ons, with the deposit transform applied.
 *
 * When deposit is active (config.deposit set AND an effective one-time build fee exists),
 * the charge collapses to a single one-time deposit line; the base recurring AND any
 * recurring add-ons are deferred (not charged at signing), so the Stripe session stays in
 * "payment" mode and no subscription opens. One-time add-ons are still charged.
 *
 * effectiveLineItems is intentionally left untouched for callers that need full base
 * amounts (e.g. the Notion CRM sync records contract value, not the deposit).
 */
export function effectiveCheckout(
  config: PaymentConfig,
  selectedTierId: string | null,
  selectedAddOnIds: string[]
): EffectiveCheckout {
  const base = effectiveLineItems(config, selectedTierId);
  const lineItems: CheckoutLineItem[] = [];

  const depositActive = Boolean(
    config.deposit && base.oneTime && base.oneTime.amountCents > 0
  );

  let depositAmountCents: number | null = null;
  let remainingAfterDepositCents: number | null = null;
  let deferredRecurring: RecurringItem | null = null;

  if (depositActive && base.oneTime) {
    const pct = config.deposit!.depositPercent;
    depositAmountCents = Math.round((base.oneTime.amountCents * pct) / 100);
    remainingAfterDepositCents = base.oneTime.amountCents - depositAmountCents;
    deferredRecurring = base.recurring;
    lineItems.push({
      amountCents: depositAmountCents,
      label: `${pct}% deposit on ${base.oneTime.label}`,
      intervalMonths: null,
      isDeposit: true,
      isAddOn: false,
    });
    // base.recurring is intentionally deferred (not pushed).
  } else {
    if (base.oneTime) {
      lineItems.push({
        amountCents: base.oneTime.amountCents,
        label: base.oneTime.label,
        intervalMonths: null,
        isDeposit: false,
        isAddOn: false,
      });
    }
    if (base.recurring) {
      lineItems.push({
        amountCents: base.recurring.amountCents,
        label: base.recurring.label,
        intervalMonths: base.recurring.intervalMonths,
        isDeposit: false,
        isAddOn: false,
      });
    }
  }

  // Append selected add-ons. When deposit is active, recurring add-ons defer too.
  for (const addOn of config.addOns ?? []) {
    if (!selectedAddOnIds.includes(addOn.id)) continue;
    if (depositActive && addOn.intervalMonths !== null) continue;
    lineItems.push({
      amountCents: addOn.amountCents,
      label: addOn.label,
      intervalMonths: addOn.intervalMonths,
      isDeposit: false,
      isAddOn: true,
    });
  }

  return {
    lineItems,
    depositActive,
    depositAmountCents,
    remainingAfterDepositCents,
    deferredRecurring,
  };
}
