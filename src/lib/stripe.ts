import Stripe from "stripe";
import type { EffectiveCheckout, PaymentConfig } from "@/lib/types";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

const intervalMap: Record<1 | 3 | 12, { interval: "month" | "year"; interval_count: number }> = {
  1: { interval: "month", interval_count: 1 },
  3: { interval: "month", interval_count: 3 },
  12: { interval: "year", interval_count: 1 },
};

/**
 * Maps the resolved checkout to Stripe line_items. Pure + exported for testing.
 * The Stripe product name is the line LABEL verbatim (the name Rahul typed under Investment) —
 * no proposal-title suffix. The proposal title rides in the session metadata instead, so the
 * dashboard stays searchable. unit_amount is the net amountCents (discounts already applied).
 */
export function buildLineItems(
  checkout: EffectiveCheckout,
  currency: PaymentConfig["currency"]
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  return checkout.lineItems.map((li) => ({
    quantity: 1,
    price_data: {
      currency,
      unit_amount: li.amountCents,
      ...(li.intervalMonths !== null ? { recurring: intervalMap[li.intervalMonths] } : {}),
      product_data: { name: li.label },
    },
  }));
}

/** Find-or-create the Stripe customer for a payer, keyed by email. */
export async function findOrCreateCustomer(input: {
  email: string;
  name: string;
}): Promise<Stripe.Customer> {
  const stripe = getStripe();
  const existing = await stripe.customers.list({ email: input.email, limit: 1 });
  if (existing.data.length > 0) return existing.data[0];
  return stripe.customers.create({ email: input.email, name: input.name });
}

/**
 * Builds the Checkout Session at last-sign time with inline price_data —
 * Products/Prices are created only for what the client actually selected,
 * never orphaned for unselected tiers.
 */
export async function createCheckoutSession(input: {
  proposalId: string;
  proposalTitle: string;
  customerId: string;
  checkout: EffectiveCheckout;
  paymentConfig: PaymentConfig;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const { checkout, paymentConfig } = input;
  const items = checkout.lineItems;
  if (items.length === 0) {
    throw new Error("createCheckoutSession called with no line items");
  }

  // A recurring line forces subscription mode (one-time lines then land on the first
  // invoice). The deposit path carries no recurring line, so it stays in payment mode and
  // never opens a subscription.
  const hasRecurring = items.some((li) => li.intervalMonths !== null);
  const mode: Stripe.Checkout.SessionCreateParams.Mode = hasRecurring
    ? "subscription"
    : "payment";

  const lineItems = buildLineItems(checkout, paymentConfig.currency);

  const paymentMethodTypes = [...paymentConfig.paymentMethods];
  if (paymentConfig.preferAch && paymentMethodTypes.includes("us_bank_account")) {
    paymentMethodTypes.sort((a) => (a === "us_bank_account" ? -1 : 1));
  }

  // The product names are now just the line labels, so the proposal title rides in metadata to
  // keep the Stripe dashboard / payment searchable by deal.
  const metadata = { proposalId: input.proposalId, proposalTitle: input.proposalTitle };

  const params: Stripe.Checkout.SessionCreateParams = {
    mode,
    customer: input.customerId,
    line_items: lineItems,
    payment_method_types:
      paymentMethodTypes as Stripe.Checkout.SessionCreateParams.PaymentMethodType[],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata,
  };

  if (paymentMethodTypes.includes("us_bank_account")) {
    params.payment_method_options = {
      us_bank_account: {
        financial_connections: { permissions: ["payment_method"] },
      },
    };
  }

  if (mode === "subscription") {
    params.subscription_data = { metadata };
  } else {
    params.payment_intent_data = { metadata };
  }

  return stripe.checkout.sessions.create(params, {
    idempotencyKey: input.idempotencyKey,
  });
}

/** Chargeback evidence per MSA §11 — attached to the customer once the signed PDF exists. */
export async function attachCustomerMetadata(
  customerId: string,
  metadata: {
    proposal_url: string;
    signed_pdf: string;
    agreement_version: string;
    content_hash: string;
    proposal_id: string;
  }
): Promise<void> {
  await getStripe().customers.update(customerId, { metadata });
}

export async function retrieveSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  return getStripe().checkout.sessions.retrieve(sessionId);
}
