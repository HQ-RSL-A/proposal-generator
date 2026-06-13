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
   adopts a signature once (draw via signature_pad / type via 4 Google handwriting fonts →
   PNG) + ESIGN consent → **places it in two spots** (Proposal Acceptance + the
   "Agreed and Accepted" block after MSA §37; tap times stored as
   `Signature.stampedProposalAt/stampedAgreementAt`, migration 0004) →
   `POST /api/sign/[token]`. Changing the tier after adoption resets the ceremony.
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

## Users & roles

- `User` table is the sign-in allowlist (rsla.io Google accounts only; no passwords by
  design). Roles: ADMIN (everything) / MEMBER (create, send, manage; no void/delete,
  no settings, no team management). Owner seeded: lalia@rsla.io (ADMIN).
- Avatar + name sync from Google on each sign-in. Add teammates in /settings; no invite
  email needed.
- Routes: `/` public landing → `/dashboard` (team) → `/settings` (admin; General + System
  tabs — System absorbed the old `/health` page, which now redirects to
  `/settings?tab=system`); plus `/docs` (team-gated, in-app token-schema reference).

## Copy rules

All user-facing text follows `myBusiness/brandGuidelines/voiceDna.md`: no em/en dashes
anywhere, short conversational sentences, no hype or AI-flag words, ranges as "X to Y".
**No emojis anywhere** (emails, subjects, screens, PDF). Support address on every public
surface is `team@rsla.io` (`SUPPORT_EMAIL` in `src/lib/constants.ts`; it's a Google group).
`ADMIN_EMAIL` (lalia@rsla.io) is recipient-only, never displayed. Post-sign
outcome-screen copy is shared in `src/lib/outcomeCopy.ts` and keyed to payment STATUS
(confirmed vs clearing), never the payment method (no card/ACH wording).

## Email conventions

- Subjects: client `[Status] {Document} · RSL/A`; admin `[Status] {Company} | {Document}`.
  No emojis, no amounts, status survives mobile truncation.
- Reply-to on every send: team@rsla.io. From stays `proposals@rsla.io`.
- Executed-PDF attachment + token-gated download share
  `executedPdfFilename()`: `{Title} - Fully Signed - {Company} x RSLA.pdf` (company part
  dropped when the title already contains it).
- `sendSystemAlert` (email.tsx): direct Resend send (bypasses the job queue on purpose),
  deduped via idempotency key. Fires on job DEAD (jobs.ts), cron failure (cronAuth.ts,
  hour-bucketed), email bounce (resend webhook). Links to `/settings?tab=system`.

## Status model

- Signers provide title + company in the signature modal (required;
  `Signature.signerTitle/signerCompany`, migration 0003); shown as "Name / Title, Company"
  in signature blocks and the certificate. Admin pre-applied = "Managing Member, RSL/A LLC".
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
**One deliberate exception:** the executed-copy email never rotates the payer's token when
the payer was the last signer — their checkout is in flight and Stripe's success_url carries
that token (rotating it stranded a paying client on "link isn't valid" once). Belt and
suspenders: success_url appends `?session_id={CHECKOUT_SESSION_ID}` and `/sign/[token]/paid`
resolves the proposal by session id whenever the path token is dead.

## Reliability

- `PendingJob` queue (SEND_EMAIL / NOTION_SYNC / STRIPE_METADATA / GENERATE_PDF):
  `after()` runs `runJobNow` immediately; `*/5min` cron sweeps with
  `FOR UPDATE SKIP LOCKED`; backoff 2^n·30s capped 1h; DEAD after 5 tries → `/health` +
  retry buttons (also on the proposal page).
- `WebhookEvent` unique `externalId` = dedupe for Stripe + Resend (+ synthetic
  `reconcile_<sessionId>` ids).
- Client receipt on every paid transaction: `applyPaidState` emails
  `payment_received_client` on one-time / first-charge / ACH settlement; subscription
  RENEWALS are caught by the `invoice.paid` handler (guarded to
  `billing_reason: subscription_cycle` so the first charge never double-sends). Live
  webhook = 6 events (the original 5 + `invoice.paid`).
- Crons (`vercel.json`): process-jobs (*/5m), reconcile-payments (4h — polls Stripe for
  stuck AWAITING/PROCESSING/SESSION_EXPIRED, heals missed webhooks), daily 13:00 UTC
  (expiry + 3-day/1-day reminders). All Bearer `CRON_SECRET`; runs logged to `CronLog`.
- Email log: `EmailLog` rows, Resend message id, delivered/opened/bounced via svix webhook;
  bounce flags the party in the dashboard.

## Database

- Supabase project `bjqouysamajtmghyztoa` (shared with expenseVault), **schema `proposals`**
  (free-tier org is at its 2-project cap; the schema is fully isolated and portable —
  `pg_dump --schema=proposals` to move it to its own project later).
- Migrations: hand SQL in `prisma/migrations/` — `0001_init.sql` (schema + RLS; PostgREST
  can't reach the schema and RLS is deny-all on top), `0002`/`0003` (users/roles, signer
  title+company), `0004_signature_stamps.sql` (two-place ceremony timestamps). All applied.
- Apply: `npx prisma db execute --file prisma/migrations/<file>.sql`; fresh DB also needs
  `npx prisma db seed` (MSA v3 + AdminSettings).

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | .env + Vercel | Supabase direct (local) |
| `DATABASE_URL_POOLER` | Vercel only | Supabase pooler (prod; direct host doesn't resolve from Vercel) |
| `AUTH_SECRET` / `AUTH_TRUST_HOST` | .env + Vercel | NextAuth |
| `GOOGLE_CLIENT_ID/SECRET` | .env + Vercel | OAuth client "Proposal Generator" (rsla-2026) |
| `BLOB_READ_WRITE_TOKEN` | .env + Vercel | Private Blob (signatures, PDFs) |
| `STRIPE_SECRET_KEY` | .env + Vercel | **Currently TEST mode everywhere** (sandbox key; webhook `we_1ThbkhE1rrZiCLVQEdLERe0Y`). Live swap = new live key + recreate webhook + 2 env values |
| `STRIPE_WEBHOOK_SECRET` | .env (stripe listen) / Vercel | Webhook signing |
| `RESEND_API_KEY` / `RESEND_WEBHOOK_SECRET` | .env + Vercel | Email + svix |
| `RESEND_FROM` | set | `Rahul Lalia, RSL/A <proposals@rsla.io>` (root domain verified on Resend; tracking off — click tracking would rewrite signing links) |
| `NOTION_API_KEY` | .env + Vercel | Internal integration `proposalGenerator` |
| `CRON_SECRET` | Vercel | Cron auth |
| `NEXT_PUBLIC_APP_URL` | .env + Vercel | Link construction (`https://proposals.rsla.io`) |

## PDF engine constraints (hard-won)

- **Never put a dynamic render-callback Text (page numbers) inside a `fixed` element.**
  react-pdf corrupts layout boxes ("unsupported number: -9.6e21") when page content flows
  across many sheets. Footers are static-only; there are no page numbers by design.
- Flowing text blocks (MSA paragraphs/bullets, narrative paragraphs) render `wrap={false}`
  so elements relocate whole instead of splitting mid-element.
- Satoshi registers from the original OTFs (they were never the crash cause; a TTF
  conversion attempt corrupted the lowercase "i" glyph — don't convert).
- Verify any PDF change with `npx tsx scripts/pdfSmoke.ts` and Read the output.
- Fonts: Satoshi (headings, original OTFs) + Inter (body, statics extracted losslessly from
  the official Inter.ttc into `public/fonts/`). Same pairing as the web app.
- Signed PDF layout: cover (logomark.png) → narrative → scope/timeline → investment +
  How to Proceed + Acceptance signatures → numbered Notes block (destinations for the
  superscript note markers; internal links) → MSA + "Agreed and Accepted" execution block
  after §37 (second signing place) → E-Signature Certificate (bordered, industry format:
  reference, sent/viewed/signed timestamps, placement line, IP, signature images,
  completion line, ESIGN statement + SHA-256). No user-agent strings or raw event logs in
  the client-facing document. Links render blue (case studies underlined; footer rsla.io).
- Attachment + token-gated download share `executedPdfFilename()`:
  `{Title} - Fully Signed - {Company} x RSLA.pdf`.

## Gotchas

- **Vercel project is CLI-deployed, not git-linked**: pushing to GitHub does NOT deploy.
  Ship with `vercel deploy --prod --yes` from the project root.
- **Middleware runs before `public/` assets on Vercel** (next dev serves them first), so
  the auth matcher excludes static assets by extension. Never re-add filename-specific
  exclusions; renamed assets will 307 to sign-in on prod only.

- **Blob auth is OIDC** (`BLOB_STORE_ID` + ambient `VERCEL_OIDC_TOKEN`); there is no static
  RW token. Local dev needs the store connection's Development environment enabled in the
  Vercel dashboard, plus `vercel env pull` (12h token). `blob.ts` uses the SDK's private
  `get`/`put`.
- Supabase pooler host is **aws-1**-us-west-1.pooler.supabase.com (aws-0 returns
  "tenant not found" and crashes sign-in via the auth allowlist lookup).
- **Test/seed data must use fake company names.** The Notion paid-sync matches CRM pages by
  company name; a demo with a real client name overwrote the real Scorpion CRM row once.
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
