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

export interface OneTimeItem {
  amountCents: number;
  displayString: string;
  label: string;
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

export interface PaymentConfig {
  currency: "usd";
  paymentMethods: PaymentMethodOption[];
  /** Flat pricing — mutually exclusive with tiers */
  oneTime: OneTimeItem | null;
  recurring: RecurringItem | null;
  /** Tiered pricing — client picks one on the signing page */
  tiers: TierConfig[] | null;
  preferAch: boolean;
}

/** Immutable snapshot taken at send time. The legal record. */
export interface FrozenContent {
  proposalId: string;
  versionNumber: number;
  tokens: TokensJson;
  paymentConfig: PaymentConfig;
  msaVersionId: string;
  msaVersionLabel: string;
  msaSha256: string;
}

/** True when nothing is collected at checkout (sign-only proposals, invoiced separately). */
export function isSignOnly(config: PaymentConfig): boolean {
  return !config.oneTime && !config.recurring && (!config.tiers || config.tiers.length === 0);
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
