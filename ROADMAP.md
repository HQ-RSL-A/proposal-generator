# ROADMAP.md — proposalGenerator

Open and planned work. Shipped history lives in [`LOG.md`](LOG.md); rules in
[`CLAUDE.md`](CLAUDE.md); architecture in [`BRAIN.md`](BRAIN.md).

## Go-live blockers (only thing gating real revenue)

- [x] **Stripe live-key swap.** DONE 2026-06-15 — live key active on Vercel Production and
      verified by a live $1 smoke test (real card -> signature-verified `checkout.session.completed`
      webhook -> PAID -> client+admin receipts + executed PDF; Notion no-op on the fake company;
      $1 left un-refunded per Rahul). **Residual CLEARED 2026-06-15:** live endpoint confirmed
      (dashboard) to subscribe all 6 events; the subscription / ACH / renewal / failure / expiry
      webhook paths were verified in a local Stripe sandbox + a real sandbox hosted-checkout
      subscription pay (card 4242 -> PAID + receipts; see LOG). Safe to send recurring/ACH proposals.
      Original spec: Create live restricted key `proposalGenerator-live`
      (scopes: Checkout Sessions W, Customers R+W, Products R+W, Prices R+W,
      Subscriptions R+W, PaymentIntents R, Invoices R) + live webhook endpoint to
      `proposals.rsla.io/api/webhooks/stripe` (**6 events** — the existing 5 plus
      `invoice.paid` for renewal receipts) + ACH on (optional). Then
      swap `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` on Vercel and redeploy.
      Rahul creates the key/webhook in the dashboard (secrets are shown once,
      unreadable via API); Claude does the env swap + verify. Deferred by Rahul.

- [ ] **Stripe live-key swap guide (runbook).** A step-by-step doc that walks Rahul
      through creating the live restricted key + live webhook in the Stripe
      dashboard, then Claude does the Vercel env swap + verify, with a rollback
      path. Runbook: [`docs/stripeKeySwapGuide.md`](docs/stripeKeySwapGuide.md).
      Written ahead of time; the swap itself still waits until everything else is
      locked and loaded.

- [x] **Receipts / invoices on every transaction (launch-critical).** DONE 2026-06-13.
      The `invoice.paid` renewal handler sends the branded receipt for every subscription
      renewal; one-time, first charge, and ACH were already covered by `applyPaidState`.
      Guarded to `billing_reason: subscription_cycle` so the first charge never
      double-sends; does not touch paid-state; idempotent + queue-backed. `receipt_email`
      skipped (redundant with the customer email + double-send risk; §11 evidence is the
      customer metadata). The live webhook subscribes `invoice.paid` at the Stripe swap.
      Plan: [`docs/plans/transactionReceipts.md`](docs/plans/transactionReceipts.md).

## Payments: add-ons + deposit (added 2026-06-13)

- [x] **Optional add-ons.** DONE 2026-06-13 (built + verified; pending commit/deploy). Global
      add-on list on `PaymentConfig` (each one-time or recurring); client multi-selects on the
      signing page and they stack as extra Stripe line items. New `effectiveCheckout` resolver,
      `Proposal.selectedAddOnIds` (migration 0005), rendered web + PDF, importable via
      `Investment.AddOns`. Max 10.
- [x] **50% deposit (configurable %).** DONE 2026-06-13 (built + verified; pending
      commit/deploy). When on, the signing checkout charges only the deposit on the one-time
      build fee in payment mode; the retainer (and recurring add-ons) are deferred, started
      manually later. No payments-schema change. Payment schedule shown on proposal/PDF/`/paid`
      + receipt; Notion records full contract value. Eventual upgrade (tool-driven balance +
      retainer auto-start) tracked under Eventual / backlog.

## Planned enhancements (added 2026-06-13)

- [ ] **Mobile optimization, internal app.** The client-facing surfaces (signing
      ceremony, signature modal, tier cards, outcome/pay screens) were made mobile-clean
      2026-06-13. The **dashboard** is now mobile-clean too (2026-06-13): the wide table
      becomes a tappable card list below md, plus a compact KPI strip. The **app nav/shell**
      is mobile-friendly too (2026-06-13): below md the nav links + New Proposal + account
      collapse into one hamburger. STILL OPEN: the proposal form, the detail tabs, and
      settings. Audit each breakpoint.

- [x] **Landing + sign-in + dashboard design pass.** DONE 2026-06-13. Landing rebuilt
      bolder (gradient display headline, floating mock proposal card, radial glows, gradient
      feature chips); sign-in is now a dark split panel (Deep Slate left + logomark, white
      right, white-only on mobile); dashboard expanded to the 6 KPIs (win rate, contracted
      one-time, MRR, signed this month vs last, avg time-to-sign, oldest open), all computed
      from current data. Public pages verified in Chrome DevTools at 1280px + 390px.

- [x] **Token-schema docs page (in-app, agent-friendly).** DONE 2026-06-13 — built as
      team-gated `/docs`, generic examples, field table auto-derived from `TOKEN_KEYS`
      (compile-time drift guard). Shipped to prod. A `/docs` (or better-named)
      route documenting the proposal token schema + payment-config shape + a copy-paste
      example, so other AI agents (the `generate-proposal` skill, or any agent) can
      produce a valid import JSON without reading the source. Decide gating: team-only
      vs public reference (no secrets either way). See "Proposal creation: do you have
      to paste JSON?" below for the content this page should carry.

## Client experience and polish (added 2026-06-13)

From Rahul's mobile signing test. The first item overlaps "Mobile optimization,
whole app" above but is the detailed redesign of the signing interaction itself,
not just responsive breakpoints. Build-time decisions flagged inline.

- [x] **Signing ceremony UX redesign (mobile-first).** DONE 2026-06-13 (shipped,
      phone-tested with Rahul; auto-advance chosen). Built details in
      docs/plans/signingFlowRedesign.md. Original spec: The current
      adopt-then-place flow loses less tech-savvy signers on phones (an older or
      non-technical client gets confused about what to tap). Rework the sequence so
      it is foolproof:
      - **Collect first.** The primary button starts as **"Ready to sign"**;
        tapping it opens the modal to capture name + title + company + signature
        (draw or type) + ESIGN consent FIRST, before any placement.
      - **Then place.** Once info + signature are captured, the button changes to
        **"Review and Sign"**; tapping it enters placement mode where the signer
        only taps each field to stamp the already-adopted signature (nothing to
        re-enter — "we have your info and your signature, just tap the fields").
      - **Guide to the next field.** After stamping the first field, do NOT
        auto-scroll all the way to the bottom. Show a small floating "jump to next
        field" affordance (an on-screen pointer/chip — mobile has no hover) that
        scrolls to and highlights the next empty signature field.
      - **Catch misses.** If a required field is left unsigned, the same
        pointer/icon appears and routes the signer straight to the empty field
        before they can Finish.
      - Applies to both placements (Proposal Acceptance + the MSA "Agreed and
        Accepted" block) and must work cleanly on phone, tablet, and desktop.
      - Open before build: exact copy for the two button states; what the pointer
        affordance looks like (animated chevron vs labeled chip); whether
        placement auto-advances focus to the next field or waits for a tap.

- [x] **Notification / toast redesign (mobile + desktop).** DONE 2026-06-13. The signing-flow
      guidance + error toasts were branded first (blue/red `toast.custom`, top-center); the
      admin-side action toasts (void / revise / delete / PDF generate + regenerate +
      self-refresh, via `proposalActions`) now use the same look. Extracted into a shared
      `brandToast` helper (`src/lib/toast.tsx`, tones brand/success/error/info) that both the
      signing flow and admin actions call, so nothing reads as stock sonner.

- [x] **Audit trail: professional icons, no emojis.** DONE 2026-06-13 (lucide icons +
      tone colors; shipped to prod). The audit trail / event log
      (internal proposal detail view) currently uses emojis for event types.
      Replace with clean SVG icons (lucide or similar) per event type for a
      professional look, consistent with the no-emoji rule on client-facing
      surfaces.

- [x] **Logo-only RSL/A branding everywhere.** DONE 2026-06-13 (landing + nav
      wordmarks removed; emails/PDF were already logomark-only). Present the RSL/A logomark on its
      own with no accompanying text wherever the brand appears (landing page hero
      first, then navbar, emails, PDF, sign-in). Audit every logo placement and
      drop the adjacent wordmark/tagline so the mark stands alone.

## Eventual / backlog

- [ ] **Attorney MSA review → v4.** When revised text lands, seed a new `MsaVersion`
      v4 row (no code change). Signed docs keep their signed version.
- [ ] **In-app AI proposal generation** (planned; V1 fast-follow). Move the AI step inside the
      app. Today the external `/generate-proposal` skill turns a Circleback transcript into a
      tokens JSON that you paste into `/proposals/new`; instead, a "Generate with AI" panel on
      `/proposals/new` takes a pasted transcript (later: a Circleback meeting picker), a server
      route calls Claude with the skill's prompt using `TokensJson` (`src/lib/types.ts`) as a
      structured-output / tool-use schema (forced-valid, can't drift from app types;
      `validation.ts` re-checks), and the result flows through the existing
      `normalizeImportedTokens` path to pre-fill the form. Always generate -> pre-fill ->
      human edits -> send (never auto-send).
      - Open decisions: (1) input source — paste vs upload vs direct Circleback pull (pull needs
        Circleback creds in app env); (2) scope — narrative only, or also propose pricing
        (tiers / flat / add-ons / deposit); (3) model + Anthropic key on Vercel (Opus for
        quality vs Sonnet for cost).
      - Cleanest first cut: paste transcript -> narrative only -> pre-fill, pricing still set by
        hand; layer in the Circleback pull + AI-suggested pricing after the core feels right.
- [ ] **Tool-driven deposit balance + retainer start.** The automated version of the deposit
      feature: a "Request balance" action that opens a second Stripe checkout for the remaining
      build fee, and a one-click retainer start when the build completes. Needs a payments-schema
      change (one-to-many `Payment` + deposit-aware statuses). v1 collects both manually.
- [ ] **Orphaned-blob cleanup (low priority).** Test-run signature PNGs + PDFs remain in
      Vercel Blob after the DB clear; tiny + private. Purge script if ever wanted.

## Detailed plans (added 2026-06-13)

Research-backed, code-grounded plans with file refs, risks, and open decisions:

- [`docs/plans/signingFlowRedesign.md`](docs/plans/signingFlowRedesign.md) — mobile
  signing ceremony rework + toast/notification redesign + audit-trail icons.
- [`docs/plans/visualRedesign.md`](docs/plans/visualRedesign.md) — landing, sign-in,
  dashboard redesign + dashboard KPIs + logo-only branding audit.
- [`docs/plans/transactionReceipts.md`](docs/plans/transactionReceipts.md) — a
  receipt/invoice on every transaction (found a real gap: subscription **renewals**
  send nothing today; needs an `invoice.paid` handler).
- [`docs/plans/tokenSchemaDocsPage.md`](docs/plans/tokenSchemaDocsPage.md) — the in-app
  `/docs` schema reference (generic, industry-standard names).
- [`docs/stripeKeySwapGuide.md`](docs/stripeKeySwapGuide.md) — step-by-step live-key
  swap runbook.

---

## Reference: proposal creation — do you have to paste JSON?

**No.** The JSON paste is an optional shortcut, not the only path. On `/proposals/new`
the "Import from generate-proposal skill" card lets you paste a tokens JSON to pre-fill
everything at once, but every field below it is also a normal labeled input you can type
by hand. The paste exists only because the `/generate-proposal` skill turns a sales-call
transcript into that JSON, which saves retyping.

**The schema an agent must produce** (source of truth: `src/lib/types.ts`):

`TokensJson` — 17 string keys (all required):

```json
{
  "Client.ProposalTitle": "Growth Marketing System for Acme Co",
  "Client.FirstName": "Jordan",
  "Client.LastName": "Avery",
  "Client.Company": "Acme Co",
  "Client.ProblemTitle": "Inconsistent lead flow despite strong demand",
  "Client.ProblemText": "Two to three paragraphs, blank-line separated.",
  "Client.SolutionTitle": "A system that runs itself",
  "Client.SolutionText": "What you'd build, blank-line separated paragraphs.",
  "Client.AtGlanceServices": "Website rebuild + rotating monthly marketing",
  "Client.AtGlanceInvestment": "Three options, $1,800 to $4,500/month",
  "Client.AtGlanceTimeline": "Website live in 2 to 3 weeks",
  "Client.ScopeItems": "• Item one\n• Item two\n• Item three",
  "Client.TimelineItems": "• Week 1: ...\n• Week 2: ...",
  "Client.InvestmentDetails": "Pick the option that fits where you are:",
  "Client.InvestmentNote": "Monthly fees are billed in advance each cycle.",
  "Document.CreatedDate": "June 13, 2026",
  "Client.ValidUntil": "July 13, 2026"
}
```

Notes: `ScopeItems`/`TimelineItems` are newline lists (`•`, `-`, or `–` prefixes are
stripped). `ProblemText`/`SolutionText` split on blank lines into paragraphs. Import
normalization tolerates a missing `Client.ValidUntil` (defaults +30 days) and ignores a
legacy `Client.CaseStudy` field.

**Ready-to-use test token:** [`docs/testProposalTokens.json`](docs/testProposalTokens.json)
— paste into the "Import from generate-proposal skill" box on `/proposals/new` for an
instant tiered test proposal (Brightline Test Co, 3 tiers + 2 add-ons). It deliberately omits the two
date fields so every import gets fresh dates and is always signable. Add an optional
`Investment.Structure` block (`type: "tiers"`, `tiers[].name/price/includes/recommended`,
prices ending `/month` register as recurring) to auto-fill pricing; drop it to import text
only and set pricing in the form.

**Pricing is configured separately** (in the form's Checkout section, or inferred from
extra keys in the import) and stored as `PaymentConfig`: flat (`oneTime`/`recurring`),
tiered (`tiers[]`, client picks one), or sign-only. Money is always integer
`amountCents` plus a `displayString`. Two optional extras stack on any shape:
`addOns[]` (client multi-selects; `Investment.AddOns` import key) and `deposit`
(`depositPercent` 1-99 on the one-time build fee; `Investment.DepositPercent` import key).
The in-app `/docs` page renders all of this for agents (kept in sync with `src/lib/types.ts`).
