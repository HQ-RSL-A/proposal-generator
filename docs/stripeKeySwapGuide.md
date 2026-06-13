# Stripe live-key swap runbook — proposalGenerator (proposals.rsla.io)

Written 2026-06-13. Stripe is in TEST mode everywhere today. This is a one-way door:
the live secret key and webhook secret are shown **once** and can't be read back via
API. Go in order; don't skip verification. **Rahul** does the dashboard steps (1–3, 6);
**Claude** does the Vercel env swap + deploy + verify (4–5, 7–8).

What changes: two Vercel env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) + one
redeploy. No DB changes. Test-mode customers/sessions stay in their separate universe.

---

## Prerequisite (do first)
The receipts work must be deployed **before** this swap (see
`docs/plans/transactionReceipts.md`) — specifically the `invoice.paid` handler, because
Step 2 registers `invoice.paid` on the live webhook.

Pre-swap checklist:
- [ ] `invoice.paid` handler + `receipt_email` change merged and deployed
- [ ] No proposals stuck in `AWAITING` / `PROCESSING` (a mid-ACH swap would verify the
      async event with the wrong webhook secret)
- [ ] All `PendingJob`s DONE (`/settings?tab=system`)
- [ ] A test-mode checkout still works end-to-end right before the swap
- [ ] Resend sender `proposals@rsla.io` verified

---

## Step 1 — Create the live restricted key (Rahul, Stripe dashboard)
1. dashboard.stripe.com → switch to **Live** mode (top-left).
2. Developers → API keys → Restricted keys → **Create restricted key**.
3. Name: `proposalGenerator-live`. Permissions (all others Off):
   - Checkout Sessions: **Write**
   - Customers: **Read + Write**
   - Products: **Read + Write**
   - Prices: **Read + Write**
   - Subscriptions: **Read + Write**
   - Payment Intents: **Read**
   - Invoices: **Read**
4. Create → **copy the `rk_live_…` key now** (only shown once) into a local note.

## Step 2 — Create the live webhook (Rahul, Stripe dashboard)
1. Still in Live mode: Developers → Webhooks → **Add endpoint**.
2. URL: `https://proposals.rsla.io/api/webhooks/stripe`
3. Select **these 6 events**:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
   - `invoice.payment_failed`
   - `invoice.paid`  ← new; needed for subscription-renewal receipts
4. Add endpoint → Reveal signing secret → **copy the `whsec_…`** into your note.

## Step 3 — (Optional) enable ACH on the live account (Rahul)
Settings → Payment methods → US bank account → enable (complete identity verification
if prompted). If you skip ACH, make sure live proposals don't offer `us_bank_account`
or checkout will fail for it.

## Step 4 — Swap the Vercel env vars (Claude)
```bash
vercel env rm STRIPE_SECRET_KEY production --yes
vercel env rm STRIPE_WEBHOOK_SECRET production --yes
vercel env add STRIPE_SECRET_KEY production      # paste rk_live_...
vercel env add STRIPE_WEBHOOK_SECRET production  # paste whsec_...
vercel env ls production | grep STRIPE           # confirm both present
```

## Step 5 — Deploy (Claude)
```bash
vercel deploy --prod --yes   # the project is NOT git-linked; this is the only ship path
```

## Step 6 — Set live email settings so we don't double-send (Rahul)
Matches `docs/plans/transactionReceipts.md` (we send branded Resend receipts):
- Settings → Emails → "Successful payments": **OFF**
- Settings → Emails → "Failed payments": **OFF**
- Settings → Billing → subscriptions "Send invoices and receipts": **OFF**

## Step 7 — Verify with minimal real money (Claude + Rahul)
1. Create a live proposal: fake company ("Lalia Live Test"), yourself as client signer
   (an email you control), one-time **$1.00**, no recurring. Send it.
2. Open the invite, complete the two-place ceremony → you should land on real
   `checkout.stripe.com` (confirms the live key works).
3. Pay $1.00 with a real card → it appears in Stripe (Live) → Payments in seconds.
4. Stripe (Live) → Webhooks → your endpoint → Recent deliveries: `checkout.session.
   completed` returned **200**.
5. Dashboard shows the proposal **PAID**; `/settings?tab=system` has no DEAD jobs.
6. Payer inbox gets `[Payment received] … · RSL/A` within ~2 min.
7. Clean up: void the test proposal; refund the $1.00 in Stripe.

## Step 8 — Verify the renewal path (can't wait a billing cycle)
Stripe (Live) → Webhooks → your endpoint → **Send test event** → `invoice.paid`. It
should deliver **200** (the handler breaks out cleanly when no matching subscription
exists — no side effects). On the first real renewal a month later, confirm the client
gets a `[Payment received]` email.

---

## Rollback
- **Invalid signature / webhook not delivering** → wrong `whsec_`; redo Step 4 with the
  correct secret, redeploy.
- **Checkout fails with a Stripe API/permission error** → add the missing scope to
  `proposalGenerator-live` (no new key needed) and redeploy, or temporarily swap back
  to the test key/secret (test webhook id `we_1ThbkhE1rrZiCLVQEdLERe0Y`; grab its
  signing secret from the test-mode dashboard) and redeploy.
- **Proposals stuck in AWAITING** → the reconcile-payments cron (every 4h) heals missed
  webhooks, or trigger it now:
  `curl -H "Authorization: Bearer $CRON_SECRET" https://proposals.rsla.io/api/cron/reconcile-payments`
- Rollback is safe: proposals are immutable once sent and paid-state is status-guarded,
  so switching keys never corrupts DB state.

## After the swap — update BRAIN.md
Record the live webhook endpoint id, and note `STRIPE_SECRET_KEY` =
`rk_live_…` (`proposalGenerator-live`) + `STRIPE_WEBHOOK_SECRET` = live `whsec_…` on
Vercel production. Test keys stay in `.env.local` for local dev.
