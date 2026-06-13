# ROADMAP.md — proposalGenerator

Open and planned work. Shipped history lives in [`LOG.md`](LOG.md); rules in
[`CLAUDE.md`](CLAUDE.md); architecture in [`BRAIN.md`](BRAIN.md).

## Go-live blockers (only thing gating real revenue)

- [ ] **Stripe live-key swap.** Create live restricted key `proposalGenerator-live`
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

- [ ] **Receipts / invoices on every transaction (launch-critical).** Every paying
      client must get a receipt or invoice for every charge: one-time, the first
      subscription charge, every subscription RENEWAL, and ACH (which clears days
      later). Likely a mix of Stripe email settings + setting the customer/receipt
      email at checkout + an `invoice.paid` to Resend receipt for renewals. Must not
      break paid-state guards, webhook idempotency, or the queue-backed side-effect
      rule. Plan: [`docs/plans/transactionReceipts.md`](docs/plans/transactionReceipts.md).

## Planned enhancements (added 2026-06-13)

- [ ] **Mobile optimization, whole app.** Both the client-facing surfaces (proposal
      document, signing ceremony, signature modal, outcome/pay screens, emails) and
      the internal app (dashboard, proposal form, detail tabs, settings) need to work
      cleanly across phone/tablet/desktop. Priority on the client signing flow — that
      is where most clients actually open the link. Audit each breakpoint; the
      two-place signature fields, the tier cards, the sticky action bar, and the wide
      dashboard table are the likeliest trouble spots.

- [ ] **Landing page + dashboard design pass.** Push both past the current clean-but-
      plain state. Dashboard: add useful metrics/KPIs (candidates: win rate =
      signed ÷ sent, total contracted value, avg time-to-sign, avg time-to-pay,
      this-month vs last-month signed/collected, MRR from recurring deals, oldest
      open proposal). Decide which KPIs are decision-useful before building cards for
      all of them.

- [x] **Token-schema docs page (in-app, agent-friendly).** DONE 2026-06-13 — built as
      team-gated `/docs`, generic examples, field table auto-derived from `TOKEN_KEYS`
      (compile-time drift guard). In working tree, not yet deployed. A `/docs` (or better-named)
      route documenting the proposal token schema + payment-config shape + a copy-paste
      example, so other AI agents (the `generate-proposal` skill, or any agent) can
      produce a valid import JSON without reading the source. Decide gating: team-only
      vs public reference (no secrets either way). See "Proposal creation: do you have
      to paste JSON?" below for the content this page should carry.

## Client experience and polish (added 2026-06-13)

From Rahul's mobile signing test. The first item overlaps "Mobile optimization,
whole app" above but is the detailed redesign of the signing interaction itself,
not just responsive breakpoints. Build-time decisions flagged inline.

- [ ] **Signing ceremony UX redesign (mobile-first).** The current
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

- [ ] **Notification / toast redesign (mobile + desktop).** The cards that tell a
      signer what to do (e.g. "tap into the fields to add your signature") are
      getting missed: they sit bottom-right, vanish too fast, and read as
      low-priority. Make in-flow guidance prominent and persistent: reposition to
      center (or another clearly visible spot), hold long enough to actually read
      (action-critical ones may need manual dismissal), and rewrite the copy to
      state the next action plainly. Tune for both phone and desktop. Covers the
      signing-flow guidance toasts and the general action toasts (PDF generating,
      self-refresh, etc.).

- [x] **Audit trail: professional icons, no emojis.** DONE 2026-06-13 (lucide icons +
      tone colors; in working tree, not yet deployed). The audit trail / event log
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
- [ ] **In-app AI proposal generation.** The V1 fast-follow: generate the token JSON
      from a transcript inside the app instead of via the external skill.
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
instant tiered test proposal (Brightline Test Co, 3 tiers). It deliberately omits the two
date fields so every import gets fresh dates and is always signable. Add an optional
`Investment.Structure` block (`type: "tiers"`, `tiers[].name/price/includes/recommended`,
prices ending `/month` register as recurring) to auto-fill pricing; drop it to import text
only and set pricing in the form.

**Pricing is configured separately** (in the form's Checkout section, or inferred from
extra keys in the import) and stored as `PaymentConfig`: flat (`oneTime`/`recurring`),
tiered (`tiers[]`, client picks one), or sign-only. Money is always integer
`amountCents` plus a `displayString`. This is the content the planned `/docs` page should
render for agents.
