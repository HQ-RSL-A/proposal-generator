# Proposal Generator

RSL/A's self-hosted PandaDoc replacement: branded web proposals + Master Services
Agreement, multi-party e-signing with a two-place ceremony (adopt once, sign the Proposal
Acceptance and the Agreement execution; drawn or typed, ESIGN consent, full audit trail),
instant Stripe Checkout after the final signature, executed PDF with an e-signature
certificate, automated emails (Resend, reply-to `team@rsla.io`), Notion CRM sync, and
admin failure alerts (dead jobs, cron crashes, bounces).

**Live:** [proposals.rsla.io](https://proposals.rsla.io) (Vercel) - running in **Stripe
test mode** until the live-key swap · **Dev:** `npm run dev` → localhost:1235

Docs: [`CLAUDE.md`](CLAUDE.md) (rules) · [`brain.md`](brain.md) (architecture reference) ·
[`log.md`](log.md) (history) · [`ROADMAP.md`](ROADMAP.md) (open + planned work, token schema)

## Everyday commands

```bash
npm run dev                       # localhost:1235
npm test                          # vitest (pure logic)
npm run build                     # prisma generate + next build
npx tsx scripts/pdfSmoke.ts       # render the full PDF locally (required after PDF changes)
npx tsx scripts/emailPreview.tsx  # render all 14 emails to docs/emailPreviews/
npx tsx scripts/e2eSeed.ts        # fresh [TEST] rehearsal draft (fake company names only)
vercel deploy --prod --yes        # manual deploy of the CWD; main is git-linked, pushing main also ships
```

## One-time setup checklist (done; kept for rebuilds)

### 1. Database (Supabase - shared project, `proposals` schema)

```bash
npx prisma db execute --file prisma/migrations/0001_init.sql   # then 0002..0004 in order
npx prisma db seed                                             # MSA v3 + AdminSettings
```

### 2. Google OAuth

Cloud project `rsla-2026` → OAuth client **"Proposal Generator"**
- Origins: `http://localhost:1235`, `https://proposals.rsla.io`
- Redirects: `…/api/auth/callback/google` on both
- → `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`

### 3. Stripe

- Restricted keys `proposalGenerator-{test,live}` with scopes: **Checkout Sessions W,
  Customers RW, Products RW, Prices RW, Subscriptions RW, PaymentIntents R, Invoices R**
  → `STRIPE_SECRET_KEY` (currently the TEST key everywhere; live swap = new key +
  recreate the webhook in live mode + 2 Vercel env values)
- Webhook endpoint: `https://proposals.rsla.io/api/webhooks/stripe` with events
  `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`, `checkout.session.expired`,
  `invoice.payment_failed` → `STRIPE_WEBHOOK_SECRET`
- Enable ACH: Settings → Payment methods → Bank debits (US)
- Local dev: `stripe listen --forward-to localhost:1235/api/webhooks/stripe`

### 4. Resend

- Domain: the root **`rsla.io`** is verified; sender is `proposals@rsla.io`
  (`RESEND_FROM`). Click/open tracking stays OFF - link rewriting would break signing URLs.
- API key → `RESEND_API_KEY`
- Webhook: `https://proposals.rsla.io/api/webhooks/resend` with `email.delivered`,
  `email.opened`, `email.bounced`, `email.complained` → `RESEND_WEBHOOK_SECRET`
- Reply-to + public support address everywhere: `team@rsla.io` (Google group,
  `SUPPORT_EMAIL` in `src/lib/constants.ts`)

### 5. Notion

- Internal integration **`proposalGenerator`** → `NOTION_API_KEY`, connected to the
  *Clients & Prospect Tracker* DB (Status, Contract Start, Monthly Fee, One-Time Fee)
- Sync matches CRM pages by company name - **test data must use fake company names**

### 6. Vercel

- Project `proposal-generator`, domain `proposals.rsla.io` (CNAME at Hostinger)
- **`main` is git-linked to Vercel** - pushing `main` auto-deploys production; `vercel deploy --prod --yes` manually ships the CWD (worktrees only)
- Env vars per `brain.md` table (+ `DATABASE_URL_POOLER` on the **aws-1** pooler host,
  `CRON_SECRET`); Blob auth is OIDC (`BLOB_STORE_ID`, no static token - local dev needs
  the store's Development env enabled + `vercel env pull`)
- Crons come from `vercel.json` (process-jobs */5m, reconcile-payments 4h, daily 13:00 UTC)

### 7. First run

1. `/settings` → save your signature (sending is blocked without it)
2. Send a `[TEST]` proposal to your own inbox → sign both places → pay with `4242…`
3. Check **Settings → System** - jobs, emails, crons all green (failures also email the
   admin automatically)
