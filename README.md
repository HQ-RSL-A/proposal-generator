# Proposal Generator

RSL/A's self-hosted PandaDoc replacement: branded web proposals + Master Services
Agreement, multi-party e-signing (drawn or typed signatures, ESIGN consent, full audit
trail), instant Stripe Checkout after the final signature, executed PDF with a signature
certificate, automated emails (Resend), and Notion CRM sync.

**Live:** `proposals.rsla.io` (Vercel) · **Dev:** `npm run dev` → localhost:1235

Docs: [`CLAUDE.md`](CLAUDE.md) (rules) · [`BRAIN.md`](BRAIN.md) (architecture reference) ·
[`LOG.md`](LOG.md) (history)

## One-time setup checklist

### 1. Database (Supabase — shared project, `proposals` schema)

```bash
npx prisma db execute --file prisma/migrations/0001_init.sql
npx prisma db seed       # MSA v3 + AdminSettings
```

### 2. Google OAuth

Cloud project `rsla-2026` → new OAuth client **"Proposal Generator"**
- Origins: `http://localhost:1235`, `https://proposals.rsla.io`
- Redirects: `…/api/auth/callback/google` on both
- → `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`

### 3. Stripe

- Test mode + live mode: create restricted keys named `proposalGenerator-{test,live}` with
  scopes: **Checkout Sessions W, Customers RW, Products RW, Prices RW, Subscriptions RW,
  PaymentIntents R, Invoices R** → `STRIPE_SECRET_KEY`
- Webhook endpoint (both modes): `https://proposals.rsla.io/api/webhooks/stripe` with events
  `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`, `checkout.session.expired`,
  `invoice.payment_failed` → `STRIPE_WEBHOOK_SECRET`
- Enable ACH: Settings → Payment methods → Bank debits (US)
- Local dev: `stripe listen --forward-to localhost:1235/api/webhooks/stripe`

### 4. Resend

- Add domain **`send.rsla.io`**; add the DKIM/SPF/MX records Resend generates to rsla.io DNS
- API keys (prod + dev) → `RESEND_API_KEY`
- Webhook: `https://proposals.rsla.io/api/webhooks/resend` with `email.delivered`,
  `email.opened`, `email.bounced`, `email.complained` → `RESEND_WEBHOOK_SECRET`

### 5. Notion

- Create internal integration **`proposalGenerator`** → `NOTION_API_KEY`
- Connect it to the *Clients & Prospect Tracker* DB (••• → Connections)
- Confirm properties exist: Status (Select w/ "Client"), Contract Start (Date),
  Monthly Fee (Number), One-Time Fee (Number)

### 6. Vercel

- New project on this repo, domain `proposals.rsla.io` (CNAME → Vercel)
- Set all env vars from `env.example` (+ `DATABASE_URL_POOLER`, `CRON_SECRET`)
- Crons come from `vercel.json` (requires Pro for the 5-minute job cadence)

### 7. First run

1. `/settings` → save your signature (sending is blocked without it)
2. Create a test proposal to your own inbox → sign → pay with Stripe test card `4242…`
3. Check `/health` — jobs, emails, crons all green
