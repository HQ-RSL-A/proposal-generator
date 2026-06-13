# LOG.md — proposalGenerator

## 2026-06-13 — Rehearsal bug: success page died after token rotation (fixed + shipped)

Rahul's prod rehearsal surfaced a race at the payment landing: checkout's
success_url carries the last signer's token; five seconds after signing, the
executed-copy email rotated the payer's token (to mint its Complete Payment
button), so finishing checkout 42 seconds later landed on "This link isn't
valid". Payment, receipts, Notion, metadata all unaffected.

Fix (1a95e48, deployed): generatePdf skips rotation + button when the payer is
the last signer (their checkout is in flight; session-expiry recovery covers
abandonment) and the email reassures instead; success_url now appends
?session_id={CHECKOUT_SESSION_ID} and /paid resolves the proposal by session id
whenever the path token is dead. Verified on prod against the real failed
session: dead token + session id renders "You're all set"; dead token alone
still gates. Fresh [TEST] draft re-seeded for the payment-leg re-test.

## 2026-06-12 — Design system pass: emails, PDF, two-place signing, footnotes, alerts

Big batch from Rahul's review of the first executed document:

- **Email design system rebuilt**: real logomark.png header (hosted), zero emojis anywhere,
  flowy conversational copy, reply-to + footer = team@rsla.io (Google group, THE support
  address; lalia@ stays recipient-only for admin alerts). Subject convention locked:
  client = `[Status] Document · RSL/A`, admin = `[Status] Company | Document`. Attachment
  renamed to `{Title} - Fully Signed - {Company} x RSLA.pdf` (company skipped if already in
  the title).
- **Two-place signing ceremony** (DocuSign-style, Rahul picked over single-stamp): adopt
  once → tap the Proposal Acceptance field → tap the Agreed and Accepted field after MSA
  §37 → Finish. Client-side tap times stored on Signature
  (`stampedProposalAt/stampedAgreementAt`, migration 0004 applied), certificate prints the
  placement line. Tier change after adoption resets the ceremony (consent restated the old
  price). Walked end to end in Chrome on the demo seed; submit path left for the prod
  rehearsal.
- **Web document now mirrors the PDF**: "Agreed and Accepted" execution block renders after
  the MSA on the signing page AND dashboard preview (was PDF-only — that was the missing
  "second space to sign"). All applied signatures now visible everywhere via token-gated
  `/api/sign/[token]/signature/[partyId]` + admin `/api/proposals/[id]/signature/[partyId]`;
  drafts show empty slots built from tokens (parties only exist after send).
- **Footnotes, product-page style**: the four `*` fine-print lines became numbered
  superscript anchors (web: smooth-scroll, PDF: internal links) resolving in a Notes block
  after Acceptance. MSA deliberately untouched (selective emphasis in legal text invites
  weight arguments; attorney review pending).
- **PDF redesigned Stripe-clean** (modeled on rslaTools invoice generator): Inter body
  (statics extracted losslessly from the official Inter.ttc — never convert outlines) +
  Satoshi headings, hairline At-a-Glance def list, slate headings (blue reserved for
  links/accents), case-study links now blue + underlined and the footer rsla.io link blue
  (the "links don't look like links" fix), refined tier cards, certificate kept in the
  approved industry format. 18 pages, verified visually.
- **Admin failure alerting**: `sendSystemAlert` (direct Resend, queue-independent, deduped
  by idempotency key) fires on job DEAD, cron failure (hour-bucketed), and email bounce.
  Health page moved to Settings → System tab (`/health` redirects, nav entry removed);
  alert emails deep-link `/settings?tab=system`.
- **Outcome screens**: paid page is confident now (no "or finishing up"), offers "Download
  your signed agreement" via new token-gated `/api/sign/[token]/document`, no Stripe-invoice
  mention; all emoji icons → lucide; support email everywhere.
- **UI pass**: favicon + navbar + landing + sign-in all use the real logomark (fake
  icon.svg/logomark.svg deleted), navbar wordmark and mark sized up, queue-backed action
  toasts now explain what happens next (PDF toast + self-refresh at 8s/25s).
- **demoSeed.ts renamed to Brightline Test Co** — it still carried the real Scorpion name;
  completing a signature on it would have re-triggered the Notion CRM overwrite.
- Verified: tsc, lint, 47 tests, production build, pdfSmoke + visual read, Chrome
  walkthrough of the full ceremony, zero console errors.

**Shipped same day**: committed (78369d6) and deployed to proposals.rsla.io via
`vercel deploy --prod` (the Vercel project is CLI-deployed, NOT git-linked — a push alone
does not deploy). Post-deploy hotfix 0a13c06: the middleware matcher excluded static assets
by exact filename (icon.svg/logomark.svg), so the renamed .png logo + favicon 307'd to
sign-in on prod while dev looked fine (Vercel runs middleware before public/ assets; next
dev serves public/ first). Matcher now excludes by extension. Verified on prod: assets 200,
landing/sign-in render, dashboard still auth-gated, screenshots in .tmp/shots.

**Open**: Rahul's [TEST] Brightline rehearsal on the new build (draft
"[TEST] Full Rehearsal: Brightline Test Co" is seeded and ready to send), then live-key
swap. team@rsla.io group exists (confirmed).

## 2026-06-11 — Initial build (full V1 codebase)

Planned and built the PandaDoc-replacement e-signing tool end-to-end in one session:

- **Plan**: explored `generateProposal` skill + expenseVault conventions; decisions locked
  with Rahul: V1 imports skill JSON (in-app AI generation = fast-follow), RSL/A signature
  auto-applies at send, per-proposal payment config, Resend for email.
- **Foundation**: Next 16 + Prisma 7 multiSchema (`proposals` schema in the shared Supabase
  project — free org is at the 2-project cap), NextAuth clone, middleware, migration SQL
  with RLS, seed (MSA v3 from msaV3.md + AdminSettings).
- **Backend**: signing service (serializable last-signer transaction, one checkout session
  per proposal), Stripe Checkout (inline price_data, subscription mode, ACH + async
  payments), webhook handlers with `WebhookEvent` dedupe + status guards, reconcile cron,
  daily expiry/reminder cron, `PendingJob` queue (after() + SKIP LOCKED sweep + backoff),
  Resend with EmailLog idempotency keys + svix webhook, Notion CRM sync (paid = full
  update, signed = note), PDF generation (@react-pdf, shared section builder, signature
  certificate page), token rotation rule (every token-bearing email mints a fresh link).
- **UI**: dashboard, proposal form (paste-JSON import with tier inference, payment config
  editor with display↔cents validation), send flow, detail page (preview/parties/audit/
  documents + dead-job retries), signing experience (document view, tier picker, draw/typed
  signature modal with ESIGN consent, decline), outcome pages, /pay recovery, settings
  (saved signature), /health.
- **Verification**: 47 Vitest tests green (incl. real MSA: 37 sections parse + tokens merge
  clean; real Scorpion fixture imports), `tsc` clean, ESLint clean, production build green
  (27 routes), dev-server smoke: sign-in 200, middleware redirect works, DB connectivity
  confirmed (P2021 = migration not yet applied, by design).

**Open**: DB placement confirmation (migration ready to run), then Rahul's manual setup:
Stripe keys/webhooks/ACH, Resend account + send.rsla.io DNS, Google OAuth client, Notion
integration + DB connect, Vercel project + domain + env. See README checklist.

## 2026-06-12 — Visual demo + signing-consent hardening

- Seeded a demo proposal (`scripts/demoSeed.ts` — runs without Blob/Resend/Stripe) and
  walked the signing experience in Chrome: full document render (37 MSA sections, merged
  data), tier selection, signature modal (draw + 4 typed fonts), ESIGN consent. Screenshots
  in `docs/screenshots/`.
- Investigated phantom TIER_SELECTED audit events: DOM-order sweep of tier buttons ~500ms
  apart, only under the chrome-devtools MCP browser, never reproduced with a click listener
  armed, never persisted to DB (provably client-state only). Concluded automation-environment
  artifact, not an app bug.
- Hardening anyway: the signature modal now restates the selected tier + price at the
  moment of consent ("You're signing for: Growth — $3,000/month").

## 2026-06-12 — SaaS layer + voice DNA pass

- Users + roles: `User` allowlist table (Google-only sign-in, rsla.io lock kept), ADMIN/
  MEMBER roles, team management in /settings (add, role change, remove access, last-admin
  guard), profile card with Google avatar. Members can't void/delete/manage settings
  (enforced in actions, hidden in UI).
- Routes: public landing page at `/` ("Send it. They sign. You get paid."), dashboard moved
  to /dashboard, role-gated nav, account dropdown with sign out.
- Voice DNA pass over every user-facing string (emails, signing pages, toasts, PDF labels):
  killed all em/en dashes, rewrote subjects and copy conversational per
  brandGuidelines/voiceDna.md.
- Fixes: Base UI `nativeButton={false}` on link-rendered buttons, favicon (app/icon.svg),
  sign-out via next-auth/react. Verified: tsc, lint, 47 tests, build (29 routes), landing
  public + dashboard gated smoke test.

## 2026-06-13 — Launch debugging: deploy, sign-in, PDF engine

- Vercel deploy fixed (lazy Prisma client; env vars pushed via CLI; aws-1 pooler URL after
  ENOTFOUND tenant error crashed sign-in). Domain proposals.rsla.io live (CNAME at
  Hostinger). Blob = OIDC auth (BLOB_STORE_ID + VERCEL_OIDC_TOKEN, no static token);
  blob.ts rewritten to SDK get/put. Stripe test mode fully wired (key validated, webhook
  endpoint we_1Thbkh… created via API, secrets on Vercel). Resend verified at root rsla.io;
  sender proposals@rsla.io; tracking off by choice (click tracking would rewrite signing
  links). Account-menu crash fixed (GroupLabel outside Menu.Group throws in Base UI).
- First live deal loop proven on the demo proposal: tier select → sign → checkout (4242) →
  paid. Notion sync wrote to the REAL Scorpion CRM page (demo reused a real company name);
  restored with Rahul's approval (Monthly 497, Contract Start 2026-03-10, test note
  deleted). Test/seed data uses fake company names from now on.
- PDF engine crash ("unsupported number: -9.6e21") root-caused by elimination: not fonts
  (TTF conversion kept anyway), not page-splitting (atomic blocks kept anyway), not
  hyphenation (disabled anyway). Actual cause: dynamic render-callback Text (page numbers)
  inside the fixed footer corrupts layout boxes on long flowing pages. Footer is static
  now; scripts/pdfSmoke.ts is the regression check. All GENERATE_PDF jobs DONE; executed
  PDF (98 KB) in Blob; fully_signed_admin DELIVERED to lalia@rsla.io with attachment.

## 2026-06-13 (cont.) — Executed-PDF redesign per Rahul's first-document review

- Real Logomark.png on cover + certificate (was a styled-text brandmark).
- Signature modal now requires full name → title → company (company prefilled); stored on
  Signature (migration 0003) and rendered as "Name / Title, Company" everywhere.
- "Agreed and Accepted" execution block added after MSA §37 reproducing both signatures
  (§37 already provides the one-signature-executes-both mechanism).
- Certificate retitled "E-Signature Certificate" and redesigned to the industry format
  (researched PandaDoc/DocuSign): bordered frame, reference, sent/viewed/signed timestamps,
  IP, signature images, completion line, ESIGN statement + SHA-256 integrity line. Dropped
  user-agent strings + raw event log from the client-facing document.
- Footer: "{Company} · Proposal & Service Agreement" + rsla.io link.
- Root-caused the "DomInIque" glyph bug: the earlier OTF→TTF conversion corrupted lowercase
  "i"; original Satoshi OTFs restored (they were never the crash cause).
- Initials through the agreement: recommended against (hash + certificate already prove
  integrity; ESIGN/UETA don't require them; friction on mobile).
- Demo PDF regeneration queued (email dedupe guard prevents re-sends). Fresh [TEST]
  Brightline draft seeded for the full rehearsal with the new design.
