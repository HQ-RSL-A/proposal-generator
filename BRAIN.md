# BRAIN.md — proposalGenerator

Reference material. Rules live in `CLAUDE.md`.

## Stack

Next.js 16 App Router + TS · Prisma 7 + `@prisma/adapter-pg` → Supabase Postgres
(**dedicated `proposals` schema**, Prisma `multiSchema` — schema-qualified SQL works through
the pooler, no `search_path` games) · NextAuth v5 Google OAuth (`hd: rsla.io`) · Vercel Blob
(private) · shadcn/ui base-nova + Tailwind 4 · `@react-pdf/renderer` · Stripe Checkout ·
Resend (+svix webhooks) · Notion API (raw fetch) · Vitest.

## Flow (happy path)

1. Import tokens JSON from the `generateProposal` skill (or fill the form) → draft.
2. Send: content frozen to `frozenContent` + `contentHash` (SHA-256 of stable JSON),
   Rahul's saved signature applied as `PRE_APPLIED` Party+Signature, client parties created
   with hashed tokens, invites emailed (Resend, link = `/sign/<rawToken>`).
3. Client opens link → `PAGE_VIEWED` audit (status → VIEWED) → picks tier if tiered →
   signature modal (draw via signature_pad / type via 4 Google handwriting fonts → PNG) +
   ESIGN consent → `POST /api/sign/[token]`.
4. Sign API: serializable transaction — one-shot party claim (`signedAt IS NULL` guard),
   signature row, remaining-signer count; last signer flips status → SIGNED and (unless
   sign-only) gets the Stripe Checkout URL (inline `price_data`; subscription mode when
   recurring present; ACH supported; `idempotencyKey` per proposal+generation).
5. Webhook `checkout.session.completed`/`async_payment_succeeded` → `applyPaidState`
   (guarded) → Payment row, receipts, Notion CRM update, Stripe customer metadata
   (`proposal_url`, `signed_pdf`, `agreement_version`, `content_hash` — MSA §11 chargeback
   evidence).
6. PDF job renders proposal + MSA + signatures + **signature certificate** (signer table
   with IP/UA/consent timestamps, content hash, MSA hash, event log) → private Blob →
   executed-copy emails to all parties.

## Status model

- `status`: DRAFT → SENT → VIEWED → PARTIALLY_SIGNED → SIGNED | DECLINED | EXPIRED | VOIDED
- `paymentStatus`: NOT_REQUIRED | AWAITING | PROCESSING (ACH in transit) | PAID | FAILED |
  SESSION_EXPIRED
- Revise = new Proposal row (`parentId`, versionNumber+1); old one voided + tokens expired.

## Token lifecycle

256-bit random hex in URL; DB stores SHA-256 (`Party.signingTokenHash`, unique-indexed
lookup). Reusable for viewing until signed; sign action is one-shot. Expiry =
`validUntil` (end-of-day America/New_York). Post-signature the token stays valid for the
confirmation page and `/pay/[token]` recovery. **Every token-bearing email rotates first** —
latest email always has the live link; failed sends retry via job with `needsToken: true`.

## Reliability

- `PendingJob` queue (SEND_EMAIL / NOTION_SYNC / STRIPE_METADATA / GENERATE_PDF):
  `after()` runs `runJobNow` immediately; `*/5min` cron sweeps with
  `FOR UPDATE SKIP LOCKED`; backoff 2^n·30s capped 1h; DEAD after 5 tries → `/health` +
  retry buttons (also on the proposal page).
- `WebhookEvent` unique `externalId` = dedupe for Stripe + Resend (+ synthetic
  `reconcile_<sessionId>` ids).
- Crons (`vercel.json`): process-jobs (*/5m), reconcile-payments (4h — polls Stripe for
  stuck AWAITING/PROCESSING/SESSION_EXPIRED, heals missed webhooks), daily 13:00 UTC
  (expiry + 3-day/1-day reminders). All Bearer `CRON_SECRET`; runs logged to `CronLog`.
- Email log: `EmailLog` rows, Resend message id, delivered/opened/bounced via svix webhook;
  bounce flags the party in the dashboard.

## Database

- Supabase project `bjqouysamajtmghyztoa` (shared with expenseVault), **schema `proposals`**
  (free-tier org is at its 2-project cap; the schema is fully isolated and portable —
  `pg_dump --schema=proposals` to move it to its own project later).
- Migration: `prisma/migrations/0001_init.sql` (includes `CREATE SCHEMA` + RLS enables;
  PostgREST can't reach the schema — not in the exposed list — and RLS is deny-all on top).
- Apply: `npx prisma db execute --file prisma/migrations/0001_init.sql` then `npx prisma db seed`.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | .env + Vercel | Supabase direct (local) |
| `DATABASE_URL_POOLER` | Vercel only | Supabase pooler (prod; direct host doesn't resolve from Vercel) |
| `AUTH_SECRET` / `AUTH_TRUST_HOST` | .env + Vercel | NextAuth |
| `GOOGLE_CLIENT_ID/SECRET` | .env + Vercel | OAuth client "Proposal Generator" (rsla-2026) |
| `BLOB_READ_WRITE_TOKEN` | .env + Vercel | Private Blob (signatures, PDFs) |
| `STRIPE_SECRET_KEY` | .env (test) / Vercel (live) | Restricted key, Checkout W scope |
| `STRIPE_WEBHOOK_SECRET` | .env (stripe listen) / Vercel | Webhook signing |
| `RESEND_API_KEY` / `RESEND_WEBHOOK_SECRET` | .env + Vercel | Email + svix |
| `RESEND_FROM` | optional | Default `Rahul Lalia, RSL/A <proposals@send.rsla.io>` |
| `NOTION_API_KEY` | .env + Vercel | Internal integration `proposalGenerator` |
| `CRON_SECRET` | Vercel | Cron auth |
| `NEXT_PUBLIC_APP_URL` | .env + Vercel | Link construction (`https://proposals.rsla.io`) |

## Gotchas

- `fetchPrivateBlob` authorizes with the RW token against private Blob URLs — verify on the
  first real upload (isolated in `src/lib/blob.ts` if the auth shape needs adjusting).
- `outputFileTracingIncludes` ships `public/fonts/**` so @react-pdf can register Satoshi in
  serverless functions; don't remove it.
- Base UI buttons compose via `render={<Link/>}`, not Radix's `asChild`.
- `Json` columns need `as unknown as T` casts; helpers `frozenTokens`/`frozenPaymentConfig`
  read frozen-first.
- ACH microdeposits: session completes with `payment_status=unpaid` → PROCESSING is a
  first-class state, not an error. `async_payment_succeeded` lands days later.
- Skill JSON sometimes lacks `Client.ValidUntil` and carries legacy `Client.CaseStudy` —
  import normalizes both.

## Related

- Content pipeline: `myBusiness/skills/skills/generateProposal/` (tokens JSON producer;
  its `.tmp/*_proposalTokens.json` files import directly).
- MSA source of truth: `scripts/templateBuild/msaV3.md` in that skill → copied to
  `prisma/content/msaV3.md` here for seeding. Attorney review pending
  (`attorneyReview.md`); revised text ships as MsaVersion v4.
- Prior art / conventions: `internalTools/expenseVault` (vault.rsla.io).
