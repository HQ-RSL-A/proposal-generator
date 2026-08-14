# brain.md - proposal-generator

Reference material. Rules live in `CLAUDE.md`.

## Stack

Next.js 16 App Router + TS · Prisma 7 + `@prisma/adapter-pg` → Supabase Postgres
(**dedicated `proposals` schema**, Prisma `multiSchema` - schema-qualified SQL works through
the pooler, no `search_path` games) · NextAuth v5 Google OAuth (`hd: rsla.io`) · Vercel Blob
(private) · shadcn/ui base-nova + Tailwind 4 · `@react-pdf/renderer` · Stripe Checkout ·
Resend (+svix webhooks) · Notion API (raw fetch) · Vitest.

## Flow (happy path)

1. Import tokens JSON from the `generateProposal` skill (or fill the form) → draft.
2. Send: content frozen to `frozenContent` + `contentHash` (SHA-256 of stable JSON),
   Rahul's saved signature applied as `PRE_APPLIED` Party+Signature, client parties created
   with hashed tokens, invites emailed (Resend, link = `/sign/<rawToken>`).
3. Client opens link → `PAGE_VIEWED` audit (status → VIEWED) → picks tier if tiered +
   toggles any optional add-ons → adopts a signature once (draw via signature_pad / type via
   4 Google handwriting fonts → PNG) + ESIGN consent → **places it in two spots** (Proposal
   Acceptance + the "Agreed and Accepted" block after MSA §37; tap times stored as
   `Signature.stampedProposalAt/stampedAgreementAt`, migration 0004) →
   `POST /api/sign/[token]`. Changing the tier OR the add-on selection after adoption resets
   the ceremony (price/consent changed). No auto-scroll to fields; a chip + the action-bar
   button lead the signer there.
4. Sign API: serializable transaction - one-shot party claim (`signedAt IS NULL` guard),
   signature row, remaining-signer count; persists `selectedTierId` + `selectedAddOnIds`; last
   signer flips status → SIGNED and (unless sign-only or manual-invoice) gets the Stripe Checkout URL built by
   `effectiveCheckout` (base tier/flat + selected add-ons; inline `price_data`; subscription
   mode when recurring present; ACH supported; `idempotencyKey` per proposal+generation). Each
   Stripe line's product **name is the line label verbatim** (the name typed in the form, no
   proposal-title suffix); the proposal title rides in the session / subscription / payment-intent
   `metadata` instead. Built by the pure, tested `buildLineItems` in `stripe.ts`.
5. Webhook `checkout.session.completed`/`async_payment_succeeded` → `applyPaidState`
   (guarded) → Payment row, receipts, Notion CRM update, Stripe customer metadata
   (`proposal_url`, `signed_pdf`, `agreement_version`, `content_hash` - MSA §11 chargeback
   evidence).
6. PDF job renders proposal + MSA + signatures + **signature certificate** (signer table
   with IP/UA/consent timestamps, content hash, MSA hash, event log) → private Blob →
   executed-copy emails to all parties.

## Proposal template (tokens fill blanks)

`buildProposalSections` (`proposalContent.ts`) is the single source of truth for both the web
(`ProposalView`) and PDF renders, so the signed PDF matches what the signer saw. The proposal is a
**fixed template**: the greeting (`Hi {first},`), the contact line (phone + team@rsla.io), the
sign-off (`Thanks, / Rahul L.`), every heading + intro/outro, the How-to-Proceed steps (which vary
by checkout mode), the Acceptance + execution text, the fine-print notes, and the MSA are all
hard-coded there. **Tokens only fill the blanks** - and `Client.ProblemText` / `Client.SolutionText`
are **body paragraphs only** (the platform wraps the greeting before + sign-off after). The skill's
content script must never write greetings/sign-offs/contact info into those tokens, or the client
sees them twice. Surfaced for clients on `/docs` and in the skill's `platformImportSchema.md`.

## Add-ons + deposit

Two optional fields on `PaymentConfig` (both inside the `paymentConfig`/`frozenContent` JSON,
no schema column of their own):

- **`addOns: AddOn[]`** - a global list the client multi-selects on the signing page (max 10,
  unique ids). Each is one-time (`intervalMonths: null`) or recurring (1|3|12). The selection
  is recorded on **`Proposal.selectedAddOnIds`** (jsonb, migration 0005) at sign time, parallel
  to `selectedTierId`. Importable via the `Investment.AddOns` key.
- **`deposit: { depositPercent }`** (1-99, default 50) - only meaningful with a one-time build
  fee. When set, the signing checkout charges **only** the deposit as a single one-time line in
  `payment` mode; the retainer and any recurring add-ons are **deferred** (no subscription
  opens at signing). The balance + retainer are collected manually for now - **no
  payments-schema change**, still one `Payment` row, `amountTotalCents` = the deposit.
  Importable via `Investment.DepositPercent`.

**`effectiveCheckout(config, tierId, addOnIds)`** (`src/lib/types.ts`) is the charge resolver
that applies all of this. **`effectiveLineItems` is left untouched** and still returns the full
base amounts - the Notion CRM sync uses it so it records full contract value (base + add-ons, net
of any discount, since `amountCents` is the net), never the deposit. The deposit payment schedule is communicated via `computeDepositSchedule`
(shown on the proposal, PDF, the `/paid` screen, and the receipt). All documented on `/docs`.

## Discounts

Any charged line (flat one-time/recurring, a tier's one-time/recurring, each add-on; plus FutureItems
for display) can carry an optional `discount: { amountCents, reason }` (`Discount` in
`src/lib/types.ts`). **The line's `amountCents` is ALWAYS the NET (post-discount) charged amount** -
the existing source of truth - so `effectiveCheckout`, Stripe `unit_amount`, the deposit % (taken on
the net one-time), and the Notion contract value are all **unchanged**. The discount is additive
metadata: the original is derived as `amountCents + discount.amountCents` (`originalCents` /
`discountDisplay` in `currency.ts`). In the form you turn on "Apply a discount" and enter the **list
price + a fixed-$ discount + a reason**; the app stores the net and shows the client "was -> now
(reason)" on tier cards, add-on rows, future-phase rows, and a **flat-pricing block** that renders
only when a flat line is discounted (flat prices otherwise live in free-text copy). Web + PDF render
identically (shared `discountDisplay`). Rules: fixed-$ only for v1 (percent is a trivial follow-up);
a discount on a recurring line is an ongoing reduced rate ("first N cycles" = Stripe-coupon territory,
out of scope); **no Stripe Coupons** (charge the net directly, like the deposit). Validation requires
a positive discount + non-empty reason, enforced by `paymentConfigSchema` at save AND send. Importable
via `discount: { amount, reason }` on `Investment.Structure` tiers / `Investment.AddOns` (price = list),
or the internal flat shape's `discount: { amountCents, reason }` (amountCents = net).

## Track Record

"Our Track Record" is per-proposal editable: `Proposal.trackRecord` jsonb column
(`TrackRecordConfig { intro, caseStudies: [{ text, href }] }` in `src/lib/types.ts`), frozen into
`frozenContent.trackRecord` at send and covered by the content hash like tokens/paymentConfig. The
fixed heading + results-vary disclaimer live in `src/lib/trackRecord.ts` alongside `SUGGESTED_*`
reference data, `LEGACY_TRACK_RECORD`, and `resolveTrackRecord()` (null = legacy/pre-migration ->
the original 3 case studies; an explicit, even empty, config is respected). Editable = intro + case
studies (URL optional -> link when set, plain text when blank; max 6). **An empty case-study list
hides the whole section**, and footnote numbering is computed in `buildProposalSections` so the
disclaimer is note 1 only when the section shows (otherwise scope/timeline/investment renumber).
Read frozen-first via `frozenTrackRecord(proposal)` (`signingService.ts`). Importable via the
`Content.TrackRecord` key (`{ intro, caseStudies: [{ text, url }] }`).

## Users & roles

- `User` table is the sign-in allowlist (rsla.io Google accounts only; no passwords by
  design). Roles: ADMIN (everything) / MEMBER (create, send, manage; no void/delete,
  no settings, no team management). Owner seeded: lalia@rsla.io (ADMIN).
- Avatar + name sync from Google on each sign-in. Add teammates in /settings; no invite
  email needed.
- Routes: `/` public landing → `/dashboard` (team) → `/settings` (admin; General + System
  tabs - System absorbed the old `/health` page, which now redirects to
  `/settings?tab=system`); plus `/docs` (team-gated, in-app token-schema reference).
- **Authz is re-validated per request at every data-access point** (not at login). Pages +
  server actions call `requireUser`/`requireAdmin`; API routes call `getActiveApiUser` (returns
  null → 401) - all re-read the live `User` row + `active` flag, so deactivating/deleting a user
  revokes access immediately despite the ~30-day JWT. Each admin RSC page guards itself (the
  `(admin)` layout does NOT gate child fetches). Of the party utilities, `getFreshSigningLink`
  (copy-link - returns a usable signing URL) and `updatePartyEmail` (repoints the signer) are
  **ADMIN-only**; `remindParty` is **MEMBER-allowed** (it only re-emails the existing signer, so it
  can't change who signs). `middleware.ts` is a **UX-only cookie-presence** fast-path, NOT JWT
  validation (auth.ts pulls Prisma → not Edge-safe) - never rely on it for authorization; the guards
  above are the real gate. (Wave-6 audit hardening RSL-11/12/26; remind relaxed to MEMBER in the
  RSL-12 refinement.)

## Copy rules

All user-facing text follows `my-business/brand-guidelines/voice-dna.md`: no em/en dashes
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
- A party **decline** terminates SENT / VIEWED / **PARTIALLY_SIGNED** → DECLINED (committed
  signatures preserved as a record; every party must sign for the contract to execute). A fully
  SIGNED proposal is never declined - it can only be VOIDED. (RSL-20 refinement.)
- `paymentStatus`: NOT_REQUIRED | AWAITING | PROCESSING (ACH in transit) | PAID | FAILED |
  SESSION_EXPIRED | MANUAL_INVOICE
- **MANUAL_INVOICE** (manual-invoice mode, `PaymentConfig.manualInvoice` - migration 0007): set by
  the form toggle ("Don't collect payment - I'll invoice manually") **or** an importable top-level
  `manualInvoice: true` key (flat or tiered alike; handled in `proposalForm.handleImport`). The
  proposal shows full pricing (any shape) and signs normally but **never touches Stripe**; the owner
  invoices offline and the only path to PAID is the admin **Mark as paid** action (`markPaidManually`
  - idempotent, logs `PAYMENT_PAID {kind:"manual"}`, Notion "paid" sync, **no** client email / Stripe
  metadata / Payment row). Counts toward contracted/MRR at signing (revenue keys on `status === SIGNED`,
  not PAID) and shows under the dashboard "to invoice" strip (`awaiting_invoice`). Helpers:
  `isManualInvoice()` / `skipsCheckout()` in `types.ts`.
- Revise = new Proposal row (`parentId`, versionNumber+1); old one voided + tokens expired.

## Token lifecycle

256-bit random hex in URL; DB stores SHA-256 (`Party.signingTokenHash`, unique-indexed
lookup). Reusable for viewing until signed; sign action is one-shot. Expiry =
`validUntil` (end-of-day America/New_York). Post-signature the token stays valid for the
confirmation page and `/pay/[token]` recovery. **Every token-bearing email rotates first** -
latest email always has the live link; failed sends retry via job with `needsToken: true`.
**One deliberate exception:** the executed-copy email never rotates the payer's token when
the payer was the last signer - their checkout is in flight and Stripe's success_url carries
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
- Crons (`vercel.json`): process-jobs (*/5m), reconcile-payments (4h - polls Stripe for
  stuck AWAITING/PROCESSING/SESSION_EXPIRED, heals missed webhooks), daily 13:00 UTC
  (expiry + 3-day/1-day reminders). All Bearer `CRON_SECRET`; runs logged to `CronLog`.
- Email log: `EmailLog` rows, Resend message id, delivered/opened/bounced via svix webhook;
  bounce flags the party in the dashboard.

## Database

- Supabase project `bjqouysamajtmghyztoa` (shared with expense-vault), **schema `proposals`**
  (free-tier org is at its 2-project cap; the schema is fully isolated and portable -
  `pg_dump --schema=proposals` to move it to its own project later).
- Migrations: hand SQL in `prisma/migrations/` - `0001_init.sql` (schema + RLS; PostgREST
  can't reach the schema and RLS is deny-all on top), `0002`/`0003` (users/roles, signer
  title+company), `0004_signature_stamps.sql` (two-place ceremony timestamps),
  `0005_addons_deposit.sql` (`Proposal.selectedAddOnIds` jsonb),
  `0006_track_record.sql` (`Proposal.trackRecord` jsonb). All applied.
- Apply: `npx prisma db execute --file prisma/migrations/<file>.sql`; fresh DB also needs
  `npx prisma db seed` (MSA v3 + AdminSettings).

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | .env + Vercel | Supabase direct (local) |
| `DATABASE_URL_POOLER` | Vercel only | Supabase pooler (prod; direct host doesn't resolve from Vercel) |
| `AUTH_SECRET` / `AUTH_TRUST_HOST` | .env + Vercel | NextAuth |
| `GOOGLE_CLIENT_ID/SECRET` | .env + Vercel | OAuth client "Proposal Generator" (rsla-2026) |
| `BLOB_STORE_ID` (+ ambient `VERCEL_OIDC_TOKEN`) | Vercel runtime | Private Blob auth (signatures, PDFs) - OIDC, **no static `BLOB_READ_WRITE_TOKEN`** exists (the local `.env` var is empty/legacy). Admin/delete = dashboard; see Gotchas |
| `STRIPE_SECRET_KEY` | .env + Vercel | **LIVE on Vercel Production (sk_live) since 2026-06-12; local/dev stays TEST.** The live webhook delivers + signature-verifies on prod (proven by a $1 smoke test 2026-06-15: `checkout.session.completed` verified -> PAID -> receipt + executed PDF; Notion no-op on the fake company). Old test-mode webhook `we_1ThbkhE1rrZiCLVQEdLERe0Y` **disabled 2026-08-13** (e2e rehearsals' test events kept hitting prod, which verifies the live whsec -> can never pass -> Stripe failing-webhook emails; local rehearsals use `stripe listen`. Re-enable it in the test dashboard only for a live->test rollback). **All 6 live events confirmed (dashboard) + recurring/ACH/renewal verified 2026-06-15** in a local sandbox + a real sandbox hosted-checkout subscription pay. Invoice handlers read both the legacy top-level `invoice.subscription` and the new nested `invoice.parent.subscription_details.subscription`, so the `2026-05-27.dahlia` API version is safe to adopt |
| `STRIPE_WEBHOOK_SECRET` | .env (stripe listen) / Vercel | Webhook signing |
| `RESEND_API_KEY` / `RESEND_WEBHOOK_SECRET` | .env + Vercel | Email + svix |
| `RESEND_FROM` | set | `Rahul Lalia, RSL/A <proposals@rsla.io>` (root domain verified on Resend; tracking off - click tracking would rewrite signing links) |
| `NOTION_API_KEY` | .env + Vercel | Internal integration `proposalGenerator` |
| `CRON_SECRET` | Vercel | Cron auth |
| `NEXT_PUBLIC_APP_URL` | .env + Vercel | Link construction (`https://proposals.rsla.io`) |

## PDF engine constraints (hard-won)

- **Never use a dynamic render-callback Text marked `fixed` AT ALL — nested in a fixed
  element OR standalone.** react-pdf corrupts layout boxes ("unsupported number:
  -9.6e21"; standalone reproduced 2026-08-09 at -2.07e21) when page content flows across
  many sheets. Footers are static-only. Page numbers exist anyway: `stampPageNumbers`
  (`src/lib/stampPageNumbers.ts`, pdf-lib) draws "Page N of M" on the finished bytes
  post-render — generatePdf and pdfSmoke both apply it.
- Flowing text blocks (MSA paragraphs/bullets, narrative paragraphs) render `wrap={false}`
  so elements relocate whole instead of splitting mid-element.
- Satoshi registers from the original OTFs (they were never the crash cause; a TTF
  conversion attempt corrupted the lowercase "i" glyph - don't convert).
- Verify any PDF change with `npx tsx scripts/pdfSmoke.ts` and Read the output.
- Fonts: Satoshi (headings, original OTFs) + Inter (body, statics extracted losslessly from
  the official Inter.ttc into `public/fonts/`). Same pairing as the web app.
- Signed PDF is a **paginated replica of the web signing document** (`ProposalView`): the same
  design tokens (Anchor Blue headings + bullets, Satoshi/Inter, accent cards), a bordered
  At-a-Glance table, rounded signature cards, tier "Recommended" pill + selected white-check,
  add-on checkboxes, an accent payment-schedule box, and numbered step circles. Three logical
  `<Page>`s: the proposal body flows continuously (cover → At a Glance → narrative →
  scope/timeline → investment → How to Proceed → Acceptance signatures → numbered Notes), the MSA
  + "Agreed and Accepted" execution block (after §37) on a fresh page, then the E-Signature
  Certificate (bordered, industry format: reference, sent/viewed/signed timestamps, placement
  line, IP, signature images, completion line, ESIGN statement + SHA-256). Pagination uses
  `wrap={false}` on short atomic blocks + `minPresenceAhead` (~72pt) on headings so no section
  splits across a page and no heading orphans (Acceptance heading + signatures stay together).
  No user-agent strings or raw event logs in the client-facing document. Links render blue
  (case studies underlined; footer rsla.io).
- Attachment + token-gated download share `executedPdfFilename()`:
  `{Title} - Fully Signed - {Company} x RSLA.pdf`.

## Gotchas

- **Vercel project is git-linked to `main`**: pushing to `main` auto-deploys to production.
  `vercel deploy --prod --yes` also deploys the current directory manually (e.g. a worktree) - but
  never manually deploy a branch behind `main`, it supersedes and reverts main's live deploy.
- **Middleware runs before `public/` assets on Vercel** (next dev serves them first), so
  the auth matcher excludes static assets by extension. Never re-add filename-specific
  exclusions; renamed assets will 307 to sign-in on prod only.
- **`MANUAL_INVOICE` is a "no-Stripe" status, not "payment pending."** It's neither AWAITING nor
  PAID, so a *blacklist* check like `paymentStatus !== "NOT_REQUIRED" && !== "PAID"` wrongly treats it
  as payment-due and would leak a checkout/payment link to the client (the trap fixed in
  `generatePdf.ts` for the `fully_signed_client` email). Client payment surfaces *whitelist*
  AWAITING/SESSION_EXPIRED/FAILED so they skip it automatically - but any new blacklist must exclude
  MANUAL_INVOICE too. Use `skipsCheckout(config)` for "no checkout after signing."

- **Blob auth is OIDC** (`BLOB_STORE_ID` + ambient `VERCEL_OIDC_TOKEN`); there is no static
  RW token. Local dev needs the store connection's Development environment enabled in the
  Vercel dashboard, plus `vercel env pull` (12h token). `blob.ts` uses the SDK's private
  `get`/`put`.
- **Update (2026-06-21):** `.env` now carries a static `BLOB_READ_WRITE_TOKEN`, so laptop scripts +
  CLI **can** write and delete blobs (verified this session: `e2eSend` writes the admin-sig PNG,
  `e2eCleanup` / `blobSweep` delete) - `@vercel/blob` prefers it over OIDC. This supersedes the "no
  static RW token" line above and the "CLI delete doesn't work locally" note below **while that token
  is present**.
- **Blob write lifecycle:** a draft writes **nothing** to Blob - the first artifact is
  RSL/A's signature PNG stamped at **send** (`sendProposal`); each client signature PNG lands
  as that party signs; the executed `signed.pdf` after all sign. Paths:
  `proposals/{id}/signatures/{partyId}.png`, `proposals/{id}/v{n}/signed.pdf`, plus the
  proposal-independent `settings/admin-signature.png` (your saved template).
- **Deleting/admin-ing blobs from a laptop does NOT work via CLI** (confirmed 2026-06-15):
  the locally-minted OIDC token is *development*-scoped and the store rejects it ("OIDC …
  not enabled for the development environment"), and there's no static RW token to pull
  (`vercel env run/pull` don't expose one - it's runtime-only). To delete, either use the
  **Vercel dashboard Blob browser** or generate a one-off RW token in the dashboard and run
  `vercel blob del <pathname> --rw-token <token>` (CLI ≥ 54). "Folders" are just key
  prefixes - deleting the contents removes the folder.
- **NEVER bulk-delete the `proposals/` prefix while any live proposal exists.** Those keys
  (`proposals/{id}/signatures/{partyId}.png`, `proposals/{id}/v{n}/signed.pdf`) are real
  signature PNGs + executed PDFs - MSA §11 chargeback evidence on executed contracts, not
  test junk. A `proposals/{id}/…` blob is an **orphan only when no `Proposal` row has that
  `id`** (`Proposal.id` is a cuid string - `prisma/schema.prisma`); DB-verify the `{id}`
  before any `del`. Always keep `settings/` (the saved admin-signature template). The old
  "delete the whole `proposals/` prefix" shortcut was a clean-slate-only move (DB at 0
  proposals); a 2026-06-19 spot-check found leftover blobs that map to live rows, so
  eyeballing "orphan" in the store is unsafe - cross-check the DB first.
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
- Skill JSON sometimes lacks `Client.ValidUntil` and carries legacy `Client.CaseStudy` -
  import normalizes both.

## Related

- Content pipeline: `my-business/skills/skills/generateProposal/` (tokens JSON producer;
  its `.tmp/*_proposalTokens.json` files import directly).
- MSA source of truth: `scripts/templateBuild/msaV3.md` in that skill → copied to
  `prisma/content/msaV3.md` here for seeding. Attorney review pending
  (`attorneyReview.md`); revised text ships as MsaVersion v4.
- Prior art / conventions: `internal-tools/expense-vault` (vault.rsla.io).
