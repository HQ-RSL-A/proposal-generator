import Stripe from "stripe";
import type { OneTimeItem, PaymentConfig, RecurringItem } from "@/lib/types";

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
  oneTime: OneTimeItem | null;
  recurring: RecurringItem | null;
  paymentConfig: PaymentConfig;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const { oneTime, recurring, paymentConfig } = input;
  if (!oneTime && !recurring) {
    throw new Error("createCheckoutSession called with no line items");
  }

  const mode: Stripe.Checkout.SessionCreateParams.Mode = recurring ? "subscription" : "payment";

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  if (recurring) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: paymentConfig.currency,
        unit_amount: recurring.amountCents,
        recurring: intervalMap[recurring.intervalMonths],
        product_data: { name: `${recurring.label} · ${input.proposalTitle}` },
      },
    });
  }
  if (oneTime) {
    // In subscription mode a one-time line item lands on the first invoice.
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: paymentConfig.currency,
        unit_amount: oneTime.amountCents,
        product_data: { name: `${oneTime.label} · ${input.proposalTitle}` },
      },
    });
  }

  const paymentMethodTypes = [...paymentConfig.paymentMethods];
  if (paymentConfig.preferAch && paymentMethodTypes.includes("us_bank_account")) {
    paymentMethodTypes.sort((a) => (a === "us_bank_account" ? -1 : 1));
  }

  const params: Stripe.Checkout.SessionCreateParams = {
    mode,
    customer: input.customerId,
    line_items: lineItems,
    payment_method_types:
      paymentMethodTypes as Stripe.Checkout.SessionCreateParams.PaymentMethodType[],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: { proposalId: input.proposalId },
  };

  if (paymentMethodTypes.includes("us_bank_account")) {
    params.payment_method_options = {
      us_bank_account: {
        financial_connections: { permissions: ["payment_method"] },
      },
    };
  }

  if (mode === "subscription") {
    params.subscription_data = { metadata: { proposalId: input.proposalId } };
  } else {
    params.payment_intent_data = { metadata: { proposalId: input.proposalId } };
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
