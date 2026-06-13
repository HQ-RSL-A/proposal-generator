# Plan — A receipt/invoice on every transaction

Status: SHIPPED 2026-06-13. The `invoice.paid` renewal handler is in and deployed;
one-time / first-charge / ACH receipts were already covered by `applyPaidState`. The live
webhook subscribes `invoice.paid` at the Stripe swap (already in the runbook's 6 events).
**`receipt_email` was intentionally skipped** — the customer already carries the email,
the §11 chargeback evidence is the attached customer metadata, and `receipt_email` would
risk a double receipt if Stripe's own email setting is ever turned on.

---

## The gap (what's broken today)

| Transaction type | Today | Verdict |
|---|---|---|
| One-time (payment mode) | branded `payment_received_client` email fires | OK, but `receipt_email` not set explicitly on the PaymentIntent |
| Subscription first charge | `checkout.session.completed` → same branded email | OK |
| **Subscription RENEWAL (monthly MRR)** | **nothing — no `invoice.paid` handler exists** | **BROKEN: recurring clients get charged silently, every month, forever** |
| ACH (delayed) | `async_payment_succeeded` → branded email on settlement | OK |

The renewal blind spot is the real problem and it scales with MRR — the more recurring
clients we sign, the more silent charges go out. Webhook currently handles
`checkout.session.{completed,async_payment_succeeded,async_payment_failed,expired}` +
`invoice.payment_failed`. It does **not** handle `invoice.paid`.

## Recommended approach: Resend-branded for everything, Stripe emails OFF

We already send branded emails from proposals@rsla.io with an audit trail
(`EmailLog`). Keeping one consistent sender beats mixing in Stripe's unbranded hosted
emails (and avoids double-delivery). So: send our own on every charge type, and leave
Stripe's customer emails off.

## Code changes (3)

1. **Set `receipt_email` on `payment_intent_data`** at checkout creation
   (`src/lib/stripe.ts` → `createCheckoutSession`, payment mode). Thread the payer's
   email through from `signingService.ts` (already resolves the payer + customer).
   Gives Stripe the email on the PaymentIntent for chargeback evidence (MSA §11)
   without triggering a Stripe email. *Not a paid-state path — safe.*

2. **Add an `invoice.paid` webhook handler** (`src/app/api/webhooks/stripe/route.ts`)
   for renewals only:
   - guard `billing_reason === "subscription_cycle"` (skips the first invoice, which
     `checkout.session.completed` already covers → no double-send);
   - look up the `Payment` by `stripeSubscriptionId`;
   - log a `PAYMENT_PAID` (kind: renewal) event;
   - inside `after()`, enqueue a `SEND_EMAIL` `payment_received_client` job
     (queue-backed) + admin notice;
   - does **not** call `applyPaidState` (status is already PAID; renewals don't change
     paymentStatus).
   Idempotent via `recordWebhookOnce`; mirrors the existing `invoice.payment_failed`
   pattern.

3. **Register `invoice.paid`** on the live webhook → the live endpoint subscribes to
   **6 events**, not 5 (the 5 above + `invoice.paid`). Reflected in the swap runbook.

## Stripe dashboard config (at swap time)
- Emails → "Successful payments": **OFF** (we send branded receipts).
- Emails → "Failed payments": **OFF** (we send `payment_failed_client`).
- Billing → subscriptions "Send invoices and receipts": **OFF** (the `invoice.paid`
  handler covers renewals).

## Optional polish (decide later)
The current `payment_received_client` is a friendly confirmation, not a formal receipt
(no number / line items / receipt link). Optional upgrade: include the Stripe
`receipt_url` / `hosted_invoice_url` in the email, or attach a PDF receipt. Not
required to close the gap; flag for after launch.

## Risks
- Preserve webhook idempotency (`recordWebhookOnce`) and paid-state guards
  (`updateMany where paymentStatus != PAID`). The renewal handler must not flip
  paymentStatus or re-run paid side effects.
- Keep side effects queue-backed (`PendingJob` + `after()` + `runJobNow`); never block
  the webhook on email.
- The `billing_reason` guard is what prevents double-charging emails on the first
  cycle — verify it with a Stripe test event before relying on it.
