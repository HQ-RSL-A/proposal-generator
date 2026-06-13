# LOG.md — proposalGenerator

## 2026-06-13 — Unified post-sign payment copy (status-based, method-agnostic)

Rahul: combine the messaging, don't distinguish by payment method. The duplicate copy on
`/sign/[token]/paid` and `/pay/[token]` (invalid link, payment confirmed, payment
clearing) now lives in `src/lib/outcomeCopy.ts` as a single source, so they can't drift.
Dropped the "bank transfer / ACH" wording and the bank icon (Landmark -> Clock);
messaging is keyed to STATUS (confirmed vs still clearing), never the method. Kept one
accuracy guardrail: a payment still clearing reads "Your payment is on its way", not
"you're all set" (card clears instantly, a transfer takes a day or two). `/pay` "Already
paid" now matches the `/paid` success. Emails left as is (they already fire only on
actual settlement, so they're status-based already). (3bd0378)

## 2026-06-13 — Post-sign outcome screens polished

`OutcomeCard` (shared by signed / paid / declined / expired / pay-recovery) now uses the
brand dot-pattern backdrop, a gentle fade+zoom entrance (reduced-motion safe), and
tighter mobile padding. One change lifts all five screens. Tier-card stacking and the
decline dialog were reviewed on mobile (fine, no changes). Client post-sign emails are
being verified live by Rahul via the [TEST] proposal in his inbox. (1480621)

## 2026-06-13 — Signing polish round 2 (pricing scroll, badge, CTA fade, caret)

More phone-test feedback from Rahul, all built + shipped:

- Empty-plan prompt now scrolls to the pricing cards (`data-tier-anchor` moved off the
  whole-doc wrapper onto TierCards) instead of a random spot. (cc77ecb)
- Recommended tier no longer pre-highlighted; only the actively chosen tier highlights;
  the recommendation is shown by its badge. (cc77ecb)
- Tier badge "Most popular" -> "Recommended" on the web and in the PDF; PDF highlight
  aligned to the web (only the selected tier highlights). Verified the PDF via pdfSmoke
  with a non-recommended selection: the RECOMMENDED label renders cleanly. (fbb5a3a)
- Adopt-signature CTA is dimmed until name/title/company/signature/consent are all in,
  then lights up. Still tappable while dimmed so an early tap surfaces the inline field
  errors. (fbb5a3a)
- Fixed the caret rendering below short inputs on mobile: `text-base` line-height (24px)
  overflowed the `h-8` box (22px). Tightened the shared Input line-height. (fbb5a3a)

## 2026-06-13 — Signing redesign shipped + phone-test fixes (bar, toasts, validation)

Deployed the signing redesign (commits 002f245, then fixes below) and Rahul tested it on
his phone against a seeded [TEST] Brightline draft sent to rahul.lalia23@gmail.com.
Feedback addressed, each built + shipped:

- **Action bar elevated** (1e0f371). It blended into the white document (translucent
  edge-to-edge bar). Now a rounded, opaque, shadowed floating island lifted off the page
  with margin around it.
- **Branded toasts** (1e0f371). Top-center toasts looked like stock sonner. Now
  `toast.custom` with Anchor Blue for guidance and red for errors, with an icon.
- **Signature modal validation** (this commit). A missing field used to just leave the
  Adopt button disabled with no explanation. Now tapping Adopt surfaces an inline error
  under each empty field (name, title, company, drawn signature, consent), clearing as
  each is fixed. Uses the Input's built-in aria-invalid destructive styling.

Build green, 47 tests pass throughout. Open: the [TEST] Brightline draft + Rahul's sent
copy are still in prod; clean up when he is done testing.

## 2026-06-13 — Signing flow redesign (mobile-first) built

Implemented the approved signing UX rework. View-state only: the one-shot sign
transaction, stamp timestamps, tier-reset, and decline flow are untouched. Build green,
47 tests pass. NOT visually QA'd live yet (signing page is token-gated, best tested on a
real phone) and not committed/deployed.

- CTA states: "Ready to sign" (opens the collect modal) -> "Review and sign" (jumps to
  the active field) -> "Finish & Submit" / "Finish & continue to payment".
- New `activePlace` drives an attention ring on the exact field to sign next, so the
  (kept) auto-advance scroll lands on an obviously highlighted target instead of a blind
  jump to the bottom. That reconciles "auto-advance" with the old "don't just yank me
  down" complaint.
- Floating pointer chip above the action bar leads the signer to the next or missed field
  (tap to scroll), with press feedback; shows only during placement.
- Signing toasts moved to top-center with clearer copy, stable ids, and longer durations
  so the guidance stops getting missed; the persistent chip + ring are the primary guide.

Files: signingExperience.tsx (phase-derived `activePlace`, chip, toast positions, button
labels), proposalView.tsx (SigningInteraction.activePlace + active-field ring). Decisions
+ plan in docs/plans/signingFlowRedesign.md.

Next: visual QA on a real phone, then commit + deploy. Admin-side action toasts (PDF /
self-refresh) redesign still open.

## 2026-06-13 — Built the three safe quick wins (audit icons, /docs, logo-only)

Per Rahul's go-ahead ("safe quick wins now"). All in the working tree, verified, NOT
yet committed or deployed.

- **Audit-trail icons** — `auditTimeline.tsx` EVENT_META now maps each of the 24 event
  types to a lucide icon (emoji strings gone), with tone colors (emerald for
  signed/paid, red for failed/declined/voided/expired/bounced, muted otherwise). Kept
  the unknown-type fallback (Dot). Internal admin view only.
- **/docs page** — new team-gated `src/app/(admin)/docs/page.tsx` documenting the import
  schema with generic names (Acme Corp / Jordan Avery). The field table is derived from
  `TOKEN_KEYS` and `FIELD_META` is typed `Record<keyof TokensJson>`, so the build fails
  if types.ts drifts. Added a "Docs" nav item (all roles). Covers TokensJson, every
  PaymentConfig shape, Investment.Structure, and the gotchas.
- **Logo-only** — removed the wordmark `<span>`s from the landing header and the app
  nav; emails + PDF were already logomark-only. Net: 2 deletions.

Verified: `npm run build` green (13 routes incl. /docs), `npm test` 47/47.

Decisions captured for the later builds: signing redesign uses **auto-advance** to the
next field (Rahul overrode my tap rec); dashboard KPIs = **all 6**; /docs = team-gated.

Shipped: committed (1386023) + deployed to proposals.rsla.io (smoke-checked: landing
200, /docs gated 307, logomark 200). Not pushed to origin yet (ask-first).

## 2026-06-13 — Planning sweep: research-backed plans for all no-input items

Rahul asked to plan + research everything that doesn't need his input (incl. nicer
landing/login/dashboard), make the docs page generic, add a Stripe-swap guide + a
"receipt on every transaction" task, and not touch anything risky without thinking it
through. Ran four parallel research agents (sonnet) over the actual code + best
practices. No app code changed this session — plans only, per his "don't proceed if it
might alter something" guardrail.

Produced 5 docs:

- `docs/plans/signingFlowRedesign.md` — mobile signing rework (collect-then-place,
  "Ready to sign" → "Review and sign", a "next field" chip replacing the auto-scroll),
  toast redesign (top-center, persistent, role=alert), audit-trail lucide icons.
  Phase enum is client-only; the one-shot sign transaction + stamp timestamps untouched.
- `docs/plans/visualRedesign.md` — landing (prestige product page), sign-in (dark
  split), dashboard (6-KPI ops view, all computable from current schema), logo-only
  (net = 2 JSX deletions; emails/PDF already correct).
- `docs/plans/transactionReceipts.md` — **found a real gap:** subscription RENEWALS
  fire no receipt (no `invoice.paid` handler). Plan: branded Resend receipts on every
  type, Stripe emails off, add `invoice.paid` (billing_reason guard) + set
  `receipt_email`. Live webhook is **6 events, not 5**.
- `docs/plans/tokenSchemaDocsPage.md` — generic `/docs` page, team-gated, table driven
  off an exhaustive `Record<keyof TokensJson>` so it can't drift from types.ts. Noted
  ROADMAP drift (both date fields self-heal; recurring regex matches mo/quarter/yr too).
- `docs/stripeKeySwapGuide.md` — full swap runbook (Rahul does dashboard key+webhook,
  Claude does env swap + deploy + verify; $1 live smoke test + rollback).

ROADMAP updated: 2 new tasks added earlier (Stripe-swap guide, receipts), blocker
corrected to 6 webhook events, and a "Detailed plans" index added. Open decisions for
Rahul: visual direction per page, the dashboard KPI set, docs-page gating, and the
three signing-redesign choices (button copy, affordance style, tap-vs-auto-advance).

## 2026-06-13 — Backlog grew: client-experience polish (Rahul mobile test)

Four new ROADMAP items under "Client experience and polish", from Rahul testing
the signing flow on a phone:

- **Signing ceremony UX redesign (mobile-first)** — collect name/title/signature
  FIRST under a "Ready to sign" button, then the button flips to "Review and Sign"
  and enters a tap-to-place mode (signature already adopted, just stamp fields). A
  floating "jump to next field" pointer replaces the auto-scroll-to-bottom and also
  catches any field left unsigned. Goal: foolproof for non-technical/older signers.
- **Toast / notification redesign** — in-flow guidance ("tap the fields to sign")
  is missed: bottom-right, too brief, low-priority feel. Make prominent +
  persistent, recenter, rewrite copy. Mobile + desktop.
- **Audit trail icons** — swap emojis for clean SVG/lucide icons per event type.
- **Logo-only branding** — RSL/A logomark with no adjacent text everywhere, hero
  first, then navbar/emails/PDF/sign-in.

No code yet — backlog capture only. Build-time questions (button copy, pointer
style, auto-advance vs tap) noted inline in ROADMAP.

## 2026-06-13 — Backlog groomed + reusable test token + GEMINI.md

- **ROADMAP.md created** (open/planned work, linked from README). Three new items from
  Rahul: (1) whole-app mobile optimization across screen sizes, client signing flow first;
  (2) landing + dashboard design pass with decision-useful KPIs (win rate, contracted
  value, time-to-sign/pay, MRR); (3) an in-app `/docs` page documenting the token schema
  for AI agents. Go-live blocker (Stripe live-key swap) and eventual items (attorney MSA
  v4, in-app AI generation, orphaned-blob cleanup) also tracked there.
- **Answered: pasting JSON is optional.** `/proposals/new` has a labeled input for every
  field; the JSON paste only pre-fills them (it's the `generate-proposal` skill's output).
  Captured the 17-key `TokensJson` + `PaymentConfig` schema in ROADMAP's reference section.
- **docs/testProposalTokens.json** — reusable tiered test token (Brightline Test Co,
  3 tiers). Deliberately omits the two date fields so `normalizeImportedTokens` defaults
  them fresh (+30d) on every import, keeping it always signable. Validated against the real
  importer. Paste into the import box to spin up a full test proposal instantly.
- **GEMINI.md created**, mirroring CLAUDE.md (project folder had none; CLAUDE.md gained the
  no-emoji, two-place-ceremony, token-rotation-exception, font, and deploy-command rules
  this session).

Next: Stripe live-key swap is the only thing gating real revenue. For the planned work,
mobile-first is the suggested start (touches the live client experience; design pass can
ride along). Dashboard KPIs need Rahul's pick of which metrics matter most before building.

## 2026-06-13 — Cleared all test data from prod (pre-launch clean slate)

Rahul asked to clear the dashboard before the first real deal. Deleted all 5
test/demo proposals from the prod DB (`.tmp/clearTestData.ts`, gitignored):
2 [DEMO] (Brightline voided, Scorpion signed/paid), 3 [TEST] rehearsals
(signed/paid). Cascade removed their parties, signatures, audit events, email
logs, payments, documents, and jobs; also cleared 67 WebhookEvent dedup rows
(no FK to proposal) and nulled the self-referencing `parentId` revision links
first (no cascade on that relation). `proposals remaining: 0`.

Caveats: signature PNGs + executed PDFs remain in Vercel Blob as orphans
(harmless, tiny, private — deterministic paths if a purge is ever wanted).
Stripe still holds the test-mode customers/sessions/payments from these runs;
they clear naturally on the live-key swap (separate live data store). All
Stripe work (live keys, webhook, ACH) deferred by Rahul.

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

**Re-test PASSED (Rahul, prod):** full loop on the new build end to end — sign
both places → pay (4242) → "You're all set" with a working download button,
executed copy delivered. The token-rotation race is closed. The entire
PandaDoc-replacement flow is now verified in production. Only remaining work:
the Stripe live-key swap (live restricted key → recreate webhook in live mode
→ swap STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET on Vercel).

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
