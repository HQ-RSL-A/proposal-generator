# ROADMAP.md — proposalGenerator

Open and planned work. Shipped history lives in [`LOG.md`](LOG.md); rules in
[`CLAUDE.md`](CLAUDE.md); architecture in [`BRAIN.md`](BRAIN.md).

## Go-live blockers (only thing gating real revenue)

- [ ] **Stripe live-key swap.** Create live restricted key `proposalGenerator-live`
      (scopes: Checkout Sessions W, Customers R+W, Products R+W, Prices R+W,
      Subscriptions R+W, PaymentIntents R, Invoices R) + live webhook endpoint to
      `proposals.rsla.io/api/webhooks/stripe` (5 events) + ACH on (optional). Then
      swap `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` on Vercel and redeploy.
      Rahul creates the key/webhook in the dashboard (secrets are shown once,
      unreadable via API); Claude does the env swap + verify. Deferred by Rahul.

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

- [ ] **Token-schema docs page (in-app, agent-friendly).** A `/docs` (or better-named)
      route documenting the proposal token schema + payment-config shape + a copy-paste
      example, so other AI agents (the `generate-proposal` skill, or any agent) can
      produce a valid import JSON without reading the source. Decide gating: team-only
      vs public reference (no secrets either way). See "Proposal creation: do you have
      to paste JSON?" below for the content this page should carry.

## Eventual / backlog

- [ ] **Attorney MSA review → v4.** When revised text lands, seed a new `MsaVersion`
      v4 row (no code change). Signed docs keep their signed version.
- [ ] **In-app AI proposal generation.** The V1 fast-follow: generate the token JSON
      from a transcript inside the app instead of via the external skill.
- [ ] **Orphaned-blob cleanup (low priority).** Test-run signature PNGs + PDFs remain in
      Vercel Blob after the DB clear; tiny + private. Purge script if ever wanted.

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
