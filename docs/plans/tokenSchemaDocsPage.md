# Plan — In-app token-schema docs page

Status: SHIPPED 2026-06-13 — team-gated `/docs`, live on prod. Low risk (new route). Requirement from Rahul: content +
all examples must be **generic / industry-standard**, never a real or test client name
(use "Acme Corp", contact "Jordan Avery", etc.). Source of truth = `src/lib/types.ts`.

---

## Decisions

**[DECIDE] Route + gating.** Rec: **`/docs`, team-gated** (inside the `(admin)`
layout). Nothing secret is on it, but the audience is the team + our own agents, not
prospects; gating gives it the app shell, full width, and zero auth complexity. One
line flips it public later (and that needs a middleware-matcher exclusion — BRAIN.md
gotcha — so gated is also the safer default).

## Code-verified schema (drift from ROADMAP noted)

`TokensJson` — 17 keys. **15 required**, 2 optional at import:
- `Client.ProposalTitle, FirstName, LastName, Company, ProblemTitle, ProblemText,
  SolutionTitle, SolutionText, AtGlanceServices, AtGlanceInvestment, AtGlanceTimeline,
  ScopeItems, TimelineItems, InvestmentDetails, InvestmentNote` — required.
- `Document.CreatedDate` — optional, defaults to **today** if absent.
- `Client.ValidUntil` — optional, defaults to **today +30 days** if absent.

Normalization (`normalizeImportedTokens`, `src/lib/validation.ts`):
- `ScopeItems` / `TimelineItems` are newline lists; `•`, `-`, `–` prefixes stripped.
- `ProblemText` / `SolutionText` split on blank lines into paragraphs.
- Extra keys (legacy `Client.CaseStudy`, etc.) silently dropped.

**ROADMAP drift to fix on the page:** ROADMAP implies only `Client.ValidUntil`
self-heals — in fact **both** date fields default. And the recurring-detection regex
matches `/mo`, `/month`, `/quarter`, `/yr`, `/year` (case-insensitive), not just
"/month".

`Investment.Structure` (import-only, pre-fills the pricing UI; not part of TokensJson):
`{ type: "tiers", tiers: [{ name, price, includes[], recommended }] }`. `type` must be
exactly `"tiers"`; 2–4 tiers; ≤1 recommended; price parsed to cents; all inferred
tiers get `intervalMonths: 1` (quarterly/annual must be set in the form).

`PaymentConfig` shapes: **flat** (`oneTime` and/or `recurring`), **tiered** (`tiers[]`,
2–4, client picks one), **sign-only** (all null). Money is integer `amountCents` +
`displayString`; send-time validation rejects if they drift >$0.01.

## Page outline
1. What this is + how import works (paste → pre-fills form → editable).
2. `TokensJson` field table (key, required?, description, example) + the normalization
   notes.
3. `PaymentConfig` shapes with a full generic copy-paste JSON per shape (flat one-time,
   flat recurring, combo, tiered, sign-only).
4. `Investment.Structure` optional block + the recurring patterns + the
   intervalMonths:1 caveat.
5. Gotchas (displayString↔cents parity, 2–4 tiers, exactly 1 recommended, `type` must
   be `"tiers"`, extra keys dropped).

## Implementation
- New file `src/app/(admin)/docs/page.tsx` — Server Component, no client JS.
- **No MDX** (not configured). Render the field table by iterating `TOKEN_KEYS`
  imported from `@/lib/types`, paired with a `FIELD_META` object typed as
  `Record<keyof TokensJson, FieldMeta>` — the exhaustive type makes `npm run build`
  fail if `types.ts` adds/removes a key, so the page can't silently drift.
- `PaymentConfig` examples are static JSON blocks in `<pre><code>` (Zod is the real
  validator; no syntax-highlighter needed).
- Add a "Docs" nav item in `appShell.tsx` (visible to all roles; MEMBERs create
  proposals too).

## Risks
- New route, low risk. If ever made public, add `docs` to the middleware matcher
  exclusion (BRAIN.md gotcha) or it 307s to sign-in on prod.
- Sync: the exhaustive-Record type is the guard (compile-time). Optional Vitest test
  as belt-and-suspenders.
- `Investment.Structure` lives in the separate `generateProposal` skill — if that skill
  changes its output shape, this page needs a manual update.
