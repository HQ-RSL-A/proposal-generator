# Backlog Remediation (RSL-36 to RSL-39) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the four open backlog issues Sid filed 2026-06-22 from his June 19 new-feature audit — all input-bounds / validate-on-read / authoring-UX hardening around the discount + manual-invoice + last-name-optional features.

**Architecture:** Each issue is an independent, mostly-mechanical fix grounded against verified current code. The throughline is the RSL-30 pattern already in the codebase: **bound a Stripe-bound or user-entered value at authoring time with a humanized error, never let it surface as a Stripe exception or a runtime TypeError downstream.** No schema migration, no money-math change, no change to what a client is charged or shown.

**Tech Stack:** Next.js 16 App Router + TS, Zod 4 validation (`src/lib/validation.ts`), Vitest (node + `// @vitest-environment jsdom` for component tests via RTL + `@testing-library/user-event`), Stripe Checkout (`src/lib/stripe.ts`), Prisma 7 / Supabase.

## Global Constraints

- **Money is integer cents everywhere.** Never floats. Display strings live alongside cents; a line's `amountCents` is ALWAYS the NET (post-discount) charged amount — the source of truth `effectiveCheckout` / Stripe / deposit / Notion all read. Do not change any amount math.
- **No emojis anywhere** (emails, subjects, screens, PDF). No em/en dashes in any user-facing copy (admin form text included) — use short sentences and ranges as "X to Y" per `my-business/brand-guidelines/voice-dna.md`.
- **Sent proposals are immutable.** None of these changes mutate sent content. RSL-39 only hardens the frozen-content READ path.
- **No schema migration.** Nothing here touches the Prisma schema or the DB.
- **TDD, one issue per commit.** Branch `audit/backlog-rsl-36-39` cut from `main`. Failing test first, minimal implementation, green, commit. Each task ends independently shippable.
- **`main` is git-linked to Vercel — pushing `main` auto-deploys to production.** Do NOT push without Rahul's explicit OK. Verify locally only until then.
- **Verification gate before any push:** `npm test` (full suite green), `npm run build` (prisma generate + next build), `npx eslint src` (0 errors). RSL-39 additionally requires `npx tsx scripts/pdfSmoke.ts` + a visual Read of the output (it touches `proposalContent.ts`, which feeds the PDF).
- **Reference values (Stripe limits):** `product_data.name` caps at ~250 chars; a metadata value caps at 500. The deposit line wraps a label as `` `${pct}% deposit on ${label}` `` (`src/lib/types.ts:262`), adding ~15 chars (`pct` is 1 to 99).

---

## File Structure

| File | Responsibility | Touched by |
|---|---|---|
| `src/lib/constants.ts` | Add `MAX_LINE_LABEL_CHARS`, `MAX_PROPOSAL_TITLE_CHARS` | RSL-36 |
| `src/lib/validation.ts` | `.max()` on line labels + proposal title; explicit net-positive invariant comment + superRefine | RSL-36, RSL-38 |
| `src/lib/stripe.ts` | `buildLineItems` over-long-label backstop (RSL-30-style throw) | RSL-36 |
| `src/lib/moneyDraft.ts` (new) | Pure `moneyDraftIssues()` — single source for the form's mismatch / net-too-low / blank-reason checks | RSL-38 |
| `src/components/proposals/proposalForm.tsx` | `MoneyFields` uses `moneyDraftIssues` + renders blank-reason warning; `handleSave` gates on it; `handleImport` surfaces discount review | RSL-38, RSL-37 |
| `src/lib/signingService.ts` | `frozenTokens` coerces every token key to a trimmed string on read (RSL-21 spirit) | RSL-39 |
| `src/lib/clientName.ts` | `clientFullName` tolerates undefined inputs | RSL-39 |
| `src/lib/proposalContent.ts` | Coerce direct `tokens[...].trim()` sites | RSL-39 |
| `src/lib/importPricing.ts` | `summarizeImportedDiscounts()` — review strings for imported discounts | RSL-37 |
| `src/app/(admin)/docs/page.tsx` | Document the two discount import dialects | RSL-37 |
| Test files (extend): `validation.test.ts`, `stripe.test.ts`, `moneyDraft.test.ts` (new), `proposalForm.test.tsx`, `signingService.test.ts`, `clientName.test.ts`, `proposalContent.test.ts`, `importPricing.test.ts` | | all |

---

## Task 1: RSL-36 — Bound Stripe-bound inputs at authoring time (Medium, Bug)

**Why it matters:** A line `label` flows verbatim into Stripe `product_data.name` and `Client.ProposalTitle` flows into `session.metadata`. Neither has a `.max()`. An over-long value makes `stripe.checkout.sessions.create` throw inside `ensureCheckoutSession` on the client's pay route — i.e. AFTER they've signed. Same failure shape as the RSL-30 sub-50c floor; same fix shape (bound at save, with a backstop in `buildLineItems`).

**Files:**
- Modify: `src/lib/constants.ts` (after `STRIPE_MIN_CHARGE_CENTS`)
- Modify: `src/lib/validation.ts:10` area (add `lineLabel`), `:93-98` (`oneTimeItemSchema.label`), `:113-120` (`addOnSchema.label`), `:15-27` (`tokensJsonSchema` title key)
- Modify: `src/lib/stripe.ts:28-50` (`buildLineItems`, beside the RSL-30 throw at `:37`)
- Test: `src/lib/validation.test.ts`, `src/lib/stripe.test.ts`

**Interfaces:**
- Produces: `MAX_LINE_LABEL_CHARS = 200`, `MAX_PROPOSAL_TITLE_CHARS = 200` (from `@/lib/constants`). `buildLineItems` throws on a label longer than `MAX_LINE_LABEL_CHARS`.

- [ ] **Step 1: Write the failing validation tests**

In `src/lib/validation.test.ts`, append a new describe (uses the existing `flatConfig` + `scorpionFixture`):

```ts
describe("input length caps (RSL-36)", () => {
  it("rejects a line label longer than the Stripe-safe cap", () => {
    const longLabel = "x".repeat(201);
    const bad = { ...flatConfig, oneTime: { ...flatConfig.oneTime!, label: longLabel } };
    expect(paymentConfigSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts a line label at the cap", () => {
    const maxLabel = "x".repeat(200);
    const ok = { ...flatConfig, oneTime: { ...flatConfig.oneTime!, label: maxLabel } };
    expect(paymentConfigSchema.safeParse(ok).success).toBe(true);
  });

  it("rejects an add-on label longer than the cap", () => {
    const bad = {
      ...flatConfig,
      addOns: [{ id: "a1", label: "y".repeat(201), displayString: "$10", amountCents: 1000, intervalMonths: null }],
    };
    expect(paymentConfigSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a proposal title longer than the cap", () => {
    const longTitle = "x".repeat(201);
    const { tokens, errors } = normalizeImportedTokens({ ...scorpionFixture, "Client.ProposalTitle": longTitle });
    expect(tokens).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/validation.test.ts`
Expected: the four new cases FAIL (over-long inputs currently pass `nonEmpty`).

- [ ] **Step 3: Add the constants**

In `src/lib/constants.ts`, after the `STRIPE_MIN_CHARGE_CENTS` export:

```ts
/**
 * A line label flows verbatim into the Stripe Checkout product name (product_data.name, ~250-char
 * cap) and the deposit line wraps it as `{pct}% deposit on {label}` (+~15 chars); Client.ProposalTitle
 * flows into the session metadata (500-char cap). Cap both well under those limits at authoring time
 * so an over-long admin input fails on SAVE with a humanized error, never as a Stripe exception on
 * the client's pay attempt after they have signed (RSL-36, sibling of the RSL-30 floor above).
 */
export const MAX_LINE_LABEL_CHARS = 200;
export const MAX_PROPOSAL_TITLE_CHARS = 200;
```

- [ ] **Step 4: Enforce the caps in validation.ts**

Add the import (extend the existing constants import on line 4):

```ts
import { MAX_LINE_LABEL_CHARS, MAX_PROPOSAL_TITLE_CHARS, STRIPE_MIN_CHARGE_CENTS } from "@/lib/constants";
```

Below `const nonEmpty = z.string().trim().min(1);` (line 10), add:

```ts
/** A charged-line label becomes a Stripe product name; cap it under Stripe's limit (RSL-36). */
const lineLabel = z.string().trim().min(1).max(MAX_LINE_LABEL_CHARS);
```

Change `label: nonEmpty` to `label: lineLabel` in `oneTimeItemSchema` (line ~96; this propagates to `recurringItemSchema` and both tier charged lines via `.extend`) and in `addOnSchema` (line ~116). Leave `tierConfigSchema.label` (the tier display name, not a Stripe product name) and `futureItemSchema.label` (never charged) as `nonEmpty`.

In `tokensJsonSchema`, cap the title key. Replace the `TOKEN_KEYS.map(...)` row (lines ~17-19):

```ts
const titleSchema = nonEmpty.max(MAX_PROPOSAL_TITLE_CHARS);
export const tokensJsonSchema = z
  .object(
    Object.fromEntries(
      TOKEN_KEYS.map((k) => [
        k,
        OPTIONAL_TOKEN_KEYS.has(k)
          ? optionalText
          : k === "Client.ProposalTitle"
            ? titleSchema
            : nonEmpty,
      ])
    ) as Record<string, z.ZodTypeAny>
  )
```

(Keep the `.catchall(...)` + `.transform(...)` that follow unchanged. The caps are now enforced anywhere these schemas are `.parse()`d — save AND update AND send, in `src/actions/proposals.ts:52-53,86-87,140-141`.)

- [ ] **Step 5: Run the validation tests to verify they pass**

Run: `npx vitest run src/lib/validation.test.ts`
Expected: PASS (including the existing discount / floor / token cases — confirm no regression).

- [ ] **Step 6: Write the failing buildLineItems backstop test**

In `src/lib/stripe.test.ts`, inside `describe("buildLineItems", ...)`, add (mirrors the RSL-30 floor test at line 34):

```ts
it("throws when a line label exceeds the Stripe product-name cap (backstop, RSL-36)", () => {
  const config: PaymentConfig = {
    ...base,
    oneTime: { amountCents: 900000, displayString: "$9,000", label: "x".repeat(201) },
    recurring: null,
    tiers: null,
  };
  expect(() => buildLineItems(effectiveCheckout(config, null, []), "usd")).toThrow(/RSL-36|label/);
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run src/lib/stripe.test.ts`
Expected: the new case FAILS (no length guard yet; the line builds fine).

- [ ] **Step 8: Add the backstop in stripe.ts**

In `src/lib/stripe.ts`, extend the constants import to include `MAX_LINE_LABEL_CHARS`, then inside `buildLineItems`' loop, beside the RSL-30 floor throw (around line 37), add:

```ts
if (li.label.length > MAX_LINE_LABEL_CHARS) {
  throw new Error(
    `Refusing to build a Stripe line whose label exceeds ${MAX_LINE_LABEL_CHARS} chars: "${li.label.slice(0, 40)}..." (RSL-36)`
  );
}
```

- [ ] **Step 9: Run the stripe tests to verify they pass**

Run: `npx vitest run src/lib/stripe.test.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/lib/constants.ts src/lib/validation.ts src/lib/validation.test.ts src/lib/stripe.ts src/lib/stripe.test.ts
git commit -m "fix(proposals): RSL-36 cap Stripe-bound label + title length at save

An unbounded line label (-> Stripe product_data.name) or proposal title
(-> session metadata) could throw inside checkout AFTER the client signs.
Cap both well under Stripe's limits at authoring time with a humanized
error; backstop the label in buildLineItems (RSL-30 pattern).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: RSL-38 — Gate the discount form on its own advisories + make the net-positive invariant explicit (Low, Improvement)

**Why it matters:** `MoneyFields` computes `mismatch` / `netTooLow` but renders them as advisory `<p>` only — `handleSave` never checks them, and a blank discount reason has no inline warning at all. Bad data still can't persist (the server `discountSchema` rejects it), so this is UX-completeness: avoid a needless server round-trip + a generic toast. Separately, the "discount can't exceed the price" invariant is emergent (a side effect of each line's `amountCents.int().positive()`); a future line type that forgot `positive()` would silently allow a negative total.

**Files:**
- Create: `src/lib/moneyDraft.ts`
- Test: `src/lib/moneyDraft.test.ts`
- Modify: `src/components/proposals/proposalForm.tsx:642-650` (MoneyFields advisories), `:798-801` (after the netTooLow `<p>`), `:923-950` (`handleSave`)
- Modify: `src/lib/validation.ts:82-91` (comment) + `:149` superRefine; Test: `src/lib/validation.test.ts`

**Interfaces:**
- Produces: `moneyDraftIssues(value, withDiscount): { mismatch: boolean; netTooLow: boolean; reasonMissing: boolean }` and `hasMoneyDraftIssue(value, withDiscount): boolean` from `@/lib/moneyDraft`.
- Consumes (Task 1): none.

- [ ] **Step 1: Write the failing pure-helper tests**

Create `src/lib/moneyDraft.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { moneyDraftIssues, hasMoneyDraftIssue } from "@/lib/moneyDraft";

describe("moneyDraftIssues", () => {
  it("flags a display/charged mismatch only when no discount is on", () => {
    expect(moneyDraftIssues({ displayString: "$1,000", amountCents: 90000 }, false).mismatch).toBe(true);
    // With a discount on, the display tracks the net, so mismatch is suppressed.
    const discounted = { displayString: "$750", amountCents: 75000, discountEnabled: true, discountCents: 25000, discountReason: "x" };
    expect(moneyDraftIssues(discounted, true).mismatch).toBe(false);
  });

  it("flags net-too-low when the discount is the whole price or more", () => {
    const value = { displayString: "$0", amountCents: 0, discountEnabled: true, discountCents: 100000, discountReason: "x" };
    expect(moneyDraftIssues(value, true).netTooLow).toBe(true);
  });

  it("flags a blank reason when a discount is enabled", () => {
    const value = { displayString: "$750", amountCents: 75000, discountEnabled: true, discountCents: 25000, discountReason: "  " };
    expect(moneyDraftIssues(value, true).reasonMissing).toBe(true);
  });

  it("is clean for a well-formed discounted line", () => {
    const value = { displayString: "$750", amountCents: 75000, discountEnabled: true, discountCents: 25000, discountReason: "Loyalty" };
    expect(hasMoneyDraftIssue(value, true)).toBe(false);
  });

  it("ignores discount fields when withDiscount is false", () => {
    const value = { displayString: "$1,000", amountCents: 100000, discountEnabled: true, discountCents: 100000, discountReason: "" };
    expect(hasMoneyDraftIssue(value, false)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/moneyDraft.test.ts`
Expected: FAIL with "Failed to resolve import @/lib/moneyDraft".

- [ ] **Step 3: Create the pure helper**

Create `src/lib/moneyDraft.ts` (this is the EXACT logic currently inline in `MoneyFields` at lines 642-650, plus the new `reasonMissing`):

```ts
import { parseCentsFromDisplayString } from "@/lib/currency";

/** The discount-aware fields of a single money draft in the proposal form. */
export interface MoneyDraftLike {
  displayString: string;
  /** Always the NET (post-discount) amount in cents. */
  amountCents: number;
  discountEnabled?: boolean;
  discountCents?: number;
  discountReason?: string;
}

export interface MoneyDraftIssues {
  /** Display string does not match the charged net (only checked when no discount is on). */
  mismatch: boolean;
  /** The discount is the whole list price or more, so the net is zero or negative. */
  netTooLow: boolean;
  /** A discount is enabled but its (client-visible) reason is blank. */
  reasonMissing: boolean;
}

/**
 * Single source of truth for the form's per-line money advisories. MoneyFields renders each flag
 * inline; handleSave gates the save on any of them so a known-bad line never makes a server round
 * trip (RSL-38). amountCents is the net; the list price is net + discount.
 */
export function moneyDraftIssues(value: MoneyDraftLike, withDiscount: boolean): MoneyDraftIssues {
  const discountOn = Boolean(withDiscount && value.discountEnabled);
  const discountCents = value.discountCents ?? 0;
  const listCents = value.amountCents + discountCents;
  const parsed = parseCentsFromDisplayString(value.displayString);
  return {
    mismatch: !discountOn && parsed !== null && Math.abs(parsed - value.amountCents) > 1,
    netTooLow: discountOn && discountCents > 0 && discountCents >= listCents,
    reasonMissing: discountOn && (value.discountReason ?? "").trim().length === 0,
  };
}

export function hasMoneyDraftIssue(value: MoneyDraftLike, withDiscount: boolean): boolean {
  const issues = moneyDraftIssues(value, withDiscount);
  return issues.mismatch || issues.netTooLow || issues.reasonMissing;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/moneyDraft.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing component test for the blank-reason warning**

In `src/components/proposals/proposalForm.test.tsx`, add to the `describe("MoneyFields discount inputs (RSL-33)", ...)` block (the `Harness` controlled wrapper already exists at the top of the file):

```ts
it("warns inline when a discount is enabled with a blank reason (RSL-38)", async () => {
  const user = userEvent.setup();
  render(<Harness initial={{ label: "Build", displayString: "$1,000", amountCents: 100000 }} />);
  await user.click(screen.getByRole("switch")); // enable discount; reason starts blank
  expect(screen.getByText(/reason for the discount/i)).toBeInTheDocument();
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/components/proposals/proposalForm.test.tsx`
Expected: the new case FAILS (no blank-reason warning rendered today).

- [ ] **Step 7: Wire MoneyFields + handleSave to the helper**

In `src/components/proposals/proposalForm.tsx`:

1. Add the import near the other `@/lib` imports:

```ts
import { moneyDraftIssues, hasMoneyDraftIssue } from "@/lib/moneyDraft";
```

2. In `MoneyFields`, replace the two inline derivations (lines 649-650):

```ts
const mismatch = !discountOn && parsed !== null && Math.abs(parsed - value.amountCents) > 1;
const netTooLow = discountOn && discountCents > 0 && discountCents >= listCents;
```

with a single call (keep the `parsed` const above it; it is still used elsewhere if referenced — if not, it can be removed):

```ts
const { mismatch, netTooLow, reasonMissing } = moneyDraftIssues(value, Boolean(withDiscount));
```

3. After the `netTooLow` advisory block (lines 799-801), add the blank-reason warning:

```tsx
{reasonMissing ? (
  <p className="text-xs text-destructive">Add a reason for the discount. The client sees it.</p>
) : null}
```

4. In `handleSave` (line 923), before building `payload`, gate on the helper. Gather every discount-capable draft from `state` (the charged lines rendered with `withDiscount`) and block if any is bad:

```ts
const discountDrafts = [
  state.oneTimeEnabled ? state.oneTime : null,
  state.recurringEnabled ? state.recurring : null,
  ...state.tiers.flatMap((t) => [
    t.oneTimeEnabled ? t.oneTime : null,
    t.recurringEnabled ? t.recurring : null,
  ]),
  ...state.addOns,
].filter((d): d is NonNullable<typeof d> => d !== null);

if (discountDrafts.some((d) => hasMoneyDraftIssue(d, true))) {
  brandToast("error", "Fix the highlighted pricing issues before saving.");
  return;
}
```

> Confirm the exact `state` field names against the live file before/while editing (verified present: `state.oneTime`/`state.oneTimeEnabled`, `state.recurring`, `state.tiers[].oneTime`/`.oneTimeEnabled`/`.recurring`/`.recurringEnabled`, `state.addOns`). Include every draft that renders a `<MoneyFields withDiscount>`; omit sign-only and futureItems (no discount UI).

- [ ] **Step 8: Run the component tests to verify they pass**

Run: `npx vitest run src/components/proposals/proposalForm.test.tsx`
Expected: PASS (the new blank-reason case plus the existing RSL-33/34 cases).

- [ ] **Step 9: Write the failing validation test that pins the net-positive invariant**

In `src/lib/validation.test.ts`, inside `describe("paymentConfigSchema discounts", ...)` (it already defines `withDiscount`), add:

```ts
it("rejects a discounted line whose net is zero (net-positive invariant, RSL-38)", () => {
  const zeroNet = { ...flatConfig, oneTime: { ...flatConfig.oneTime!, amountCents: 0, discount: { amountCents: 99700, reason: "All of it" } } };
  expect(paymentConfigSchema.safeParse(zeroNet).success).toBe(false);
});
```

- [ ] **Step 10: Run it (it should already pass) and make the invariant explicit**

Run: `npx vitest run src/lib/validation.test.ts`
Expected: this case PASSES today (rejected by `amountCents.int().positive()`). The test PINS the behavior so a future loosening breaks it.

Now make the invariant load-bearing and self-documenting. Replace the misleading comment above `discountSchema` (lines 82-84) with:

```ts
// Optional per-line discount. The line's amountCents is the NET actually charged; this records the
// saving as additive metadata (original = net + discount). NET-POSITIVE INVARIANT: a charged line's
// net must stay > 0 — enforced per-field by amountCents.int().positive() AND re-asserted in
// paymentConfigSchema.superRefine below so it does not rely on any single downstream positive()
// (a future charged-line type that forgot positive() is still caught) (RSL-38).
```

Then, inside the existing `paymentConfigSchema.superRefine((config, ctx) => { ... })` (starts line 149), append a charged-line net check before the closing brace:

```ts
const chargedLines = [
  config.oneTime,
  config.recurring,
  ...(config.tiers ?? []).flatMap((t) => [t.oneTime, t.recurring]),
  ...(config.addOns ?? []),
];
for (const line of chargedLines) {
  if (line && line.discount && line.amountCents <= 0) {
    ctx.addIssue({ code: "custom", message: `"${line.label}" has a discount that leaves no charge. Lower the discount.` });
  }
}
```

- [ ] **Step 11: Run the full validation + form suites to verify green**

Run: `npx vitest run src/lib/validation.test.ts src/lib/moneyDraft.test.ts src/components/proposals/proposalForm.test.tsx`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add src/lib/moneyDraft.ts src/lib/moneyDraft.test.ts src/components/proposals/proposalForm.tsx src/components/proposals/proposalForm.test.tsx src/lib/validation.ts src/lib/validation.test.ts
git commit -m "fix(proposals): RSL-38 gate discount form on its advisories + explicit net-positive invariant

handleSave now blocks (no server round-trip) when any priced line has a
display/charged mismatch, a discount >= price, or a blank reason; the
blank-reason case gets an inline warning it lacked. Extracted the checks
to a pure moneyDraft helper (single source). Made the net-positive
invariant explicit in paymentConfigSchema instead of emergent from positive().

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: RSL-39 — Validate-on-read for frozen tokens (Low, Bug — latent crash)

**Why it matters:** `frozenTokens` (`signingService.ts:439-442`) casts `frozenContent.tokens` with NO re-parse — unlike its neighbor `frozenPaymentConfig`, which validates shape on read (RSL-21). `proposalContent.ts` then calls `tokens["Client.LastName"].trim()` (`:180`) and `clientFullName(...)` (`:175`) assuming a string. A legacy snapshot predating the `Client.LastName` token, or a hand-edited DB row missing the key, yields `undefined.trim()` -> TypeError, crashing the signing page / PDF job. Latent today (no app path produces an absent key) but a hard 500 on that edge. Fix = extend the RSL-21 validate-on-read spirit to tokens (coerce every key to a trimmed string at the read boundary), plus defensive coercion at the two helper sites.

**Files:**
- Modify: `src/lib/signingService.ts:439-442` (`frozenTokens`); the file already imports `TokensJson` — add `TOKEN_KEYS`.
- Modify: `src/lib/clientName.ts:2-7` (`clientFullName`)
- Modify: `src/lib/proposalContent.ts:180,188` (direct `.trim()` sites)
- Test: `src/lib/signingService.test.ts`, `src/lib/clientName.test.ts`, `src/lib/proposalContent.test.ts`

**Interfaces:**
- Produces: `frozenTokens(proposal)` returns a `TokensJson` with every `TOKEN_KEYS` entry guaranteed present as a trimmed string (never `undefined`).

- [ ] **Step 1: Write the failing frozenTokens test**

In `src/lib/signingService.test.ts`, add `frozenTokens` to the existing import block (the one importing `frozenPaymentConfig` at line ~41-44) and add a describe (mirrors the `frozenPaymentConfig — validate shape on read (RSL-21)` block; uses the existing `makeProposal` factory + `asJson` helper):

```ts
describe("frozenTokens — coerce missing keys on read (RSL-39)", () => {
  it("returns an empty string for an absent token key instead of undefined", () => {
    const partial = { "Client.FirstName": "Christian", "Client.Company": "Valley Oak Landscape Co" };
    const proposal = makeProposal({ frozenContent: { tokens: partial } as never, tokens: asJson(partial) });
    const tokens = frozenTokens(proposal);
    expect(tokens["Client.LastName"]).toBe("");
    expect(tokens["Client.FirstName"]).toBe("Christian");
  });

  it("trims and preserves present values", () => {
    const proposal = makeProposal({ frozenContent: null, tokens: asJson({ "Client.FirstName": "  Dominique  " }) });
    expect(frozenTokens(proposal)["Client.FirstName"]).toBe("Dominique");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/signingService.test.ts`
Expected: FAIL — `tokens["Client.LastName"]` is currently `undefined`, not `""`.

- [ ] **Step 3: Harden frozenTokens**

In `src/lib/signingService.ts`, add `TOKEN_KEYS` to the `@/lib/types` import, then replace `frozenTokens` (lines 439-442):

```ts
export function frozenTokens(proposal: Proposal): TokensJson {
  const frozen = proposal.frozenContent as { tokens?: Record<string, unknown> } | null;
  const raw = (frozen?.tokens ?? proposal.tokens ?? {}) as Record<string, unknown>;
  // Validate-on-read (RSL-39, same spirit as frozenPaymentConfig/RSL-21): a legacy snapshot
  // predating a token, or a hand-edited row, can be missing a key. Coerce every key to a trimmed
  // string (mirrors tokensJsonSchema's transform) so a downstream `tokens[key].trim()` can never hit
  // undefined and 500 the signing page / PDF job.
  const clean = {} as TokensJson;
  for (const key of TOKEN_KEYS) clean[key] = String(raw[key] ?? "").trim();
  return clean;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/signingService.test.ts`
Expected: PASS (confirm the rest of the file's suite is still green — coercion is a no-op for already-valid snapshots).

- [ ] **Step 5: Write the failing clientName + proposalContent tests**

In `src/lib/clientName.test.ts`, add to `describe("clientFullName", ...)`:

```ts
test("tolerates an undefined last name without throwing", () => {
  expect(clientFullName("Christian", undefined as unknown as string)).toBe("Christian");
});
```

In `src/lib/proposalContent.test.ts`, add to `describe("buildProposalSections", ...)` (the `tokens` / `paidConfig` / `trackRecord` / `msa` fixtures already exist):

```ts
it("does not throw when the Client.LastName key is absent entirely (RSL-39)", () => {
  const withoutLast = { ...tokens } as Record<string, unknown>;
  delete withoutLast["Client.LastName"];
  expect(() =>
    buildProposalSections({
      tokens: withoutLast as TokensJson,
      paymentConfig: paidConfig,
      trackRecord,
      msaBodyMarkdown: msa,
    })
  ).not.toThrow();
});
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npx vitest run src/lib/clientName.test.ts src/lib/proposalContent.test.ts`
Expected: both new cases FAIL with a TypeError on `.trim()` of undefined.

- [ ] **Step 7: Coerce the helper + direct sites**

In `src/lib/clientName.ts`, make `clientFullName` tolerate non-strings (keep the string signature; coerce at runtime):

```ts
export function clientFullName(firstName: string, lastName: string): string {
  return [firstName, lastName]
    .map((part) => String(part ?? "").trim())
    .filter((part) => part.length > 0)
    .join(" ");
}
```

In `src/lib/proposalContent.ts`, coerce the two direct token reads so they are safe regardless of caller. Line ~180:

```ts
const lastNameBlank = String(tokens["Client.LastName"] ?? "").trim().length === 0;
```

Line ~188:

```ts
const firstName = String(tokens["Client.FirstName"] ?? "").trim();
```

- [ ] **Step 8: Run them to verify they pass**

Run: `npx vitest run src/lib/clientName.test.ts src/lib/proposalContent.test.ts`
Expected: PASS.

- [ ] **Step 9: PDF smoke (required — proposalContent feeds the PDF)**

Run: `npx tsx scripts/pdfSmoke.ts`
Expected: renders without error. Then Read the output PDF and confirm the party line + body are intact (the change is defensive coercion; output for valid tokens is unchanged).

- [ ] **Step 10: Commit**

```bash
git add src/lib/signingService.ts src/lib/signingService.test.ts src/lib/clientName.ts src/lib/clientName.test.ts src/lib/proposalContent.ts src/lib/proposalContent.test.ts
git commit -m "fix(proposals): RSL-39 validate-on-read for frozen tokens (no LastName crash)

frozenTokens now coerces every token key to a trimmed string on read
(RSL-21 spirit), so a legacy/hand-edited snapshot missing Client.LastName
no longer hits undefined.trim() and 500s the signing page / PDF job.
Belt-and-suspenders: clientFullName and the two direct trim() sites in
proposalContent tolerate undefined.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: RSL-37 — Surface the resolved discount net on import + document the two dialects (Low, Improvement)

**Why it matters:** The same "price + discount" import is read in OPPOSITE directions by block: `importDiscount` (tiers/add-ons) treats the line price as LIST and computes `net = list - discount` (shape `{ amount, reason }`); flat `readDiscount` (`importPricing.ts:30-40`) takes `amountCents` verbatim as already-NET (shape `{ amountCents, reason }`). A skill or human emitting the wrong shape for the wrong block over/under-charges versus intent (no client-facing divergence — the client always pays what they are shown).

**Design decision (confirm with Rahul):** These are two *legitimately different dialects* — the human-authoring keys (`Investment.Structure` tiers / `Investment.AddOns`, list-minus) vs. the platform's own internal config dump (flat `oneTime`/`recurring` with an already-net `amountCents`). **Unifying them would break the internal round-trip**, so this task takes Sid's other option: make the resolved net **unmissable on review** and **document both dialects**, rather than change semantics. If Rahul would rather force one dialect (a larger change touching the skill + `/docs` + a possible re-charge of any existing flat-discount import), stop and re-scope.

**Files:**
- Modify: `src/lib/importPricing.ts` (add `summarizeImportedDiscounts`)
- Test: `src/lib/importPricing.test.ts`
- Modify: `src/components/proposals/proposalForm.tsx:905-921` (`handleImport` toast)
- Modify: `src/app/(admin)/docs/page.tsx` (discount section — document the two dialects)

**Interfaces:**
- Produces: `summarizeImportedDiscounts(config: PaymentConfig): string[]` — one `"{label}: was {original}, now {net} ({reason})"` line per charged line carrying a positive discount; `[]` when none.

- [ ] **Step 1: Write the failing helper test**

In `src/lib/importPricing.test.ts`, append:

```ts
import { summarizeImportedDiscounts } from "@/lib/importPricing";
import type { PaymentConfig } from "@/lib/types";

describe("summarizeImportedDiscounts (RSL-37)", () => {
  const base: Pick<PaymentConfig, "currency" | "paymentMethods" | "preferAch" | "tiers" | "recurring"> = {
    currency: "usd",
    paymentMethods: ["card"],
    preferAch: false,
    tiers: null,
    recurring: null,
  };

  it("returns a was/now/reason line per discounted charged line", () => {
    const config = {
      ...base,
      oneTime: { amountCents: 75000, displayString: "$750", label: "Setup", discount: { amountCents: 25000, reason: "Loyalty" } },
    } as PaymentConfig;
    expect(summarizeImportedDiscounts(config)).toEqual(["Setup: was $1,000, now $750 (Loyalty)"]);
  });

  it("returns an empty list when nothing is discounted", () => {
    const config = { ...base, oneTime: { amountCents: 75000, displayString: "$750", label: "Setup" } } as PaymentConfig;
    expect(summarizeImportedDiscounts(config)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/importPricing.test.ts`
Expected: FAIL with "summarizeImportedDiscounts is not a function".

- [ ] **Step 3: Implement the helper**

In `src/lib/importPricing.ts`, add the imports and the export (reuses the tested `originalCents` / `formatCents` from `currency.ts`):

```ts
import { formatCents, originalCents, parseCentsFromDisplayString } from "@/lib/currency";
import type { AddOn, OneTimeItem, PaymentConfig, RecurringItem } from "@/lib/types";
```

```ts
/**
 * Human review lines for every charged line that imported with a positive discount, so a mis-shaped
 * discount (the two-dialect footgun, RSL-37) is unmissable in the post-import toast. Reuses the same
 * originalCents/formatCents the renderers use, so "was X, now Y" matches what the client will see.
 */
export function summarizeImportedDiscounts(config: PaymentConfig): string[] {
  const lines: (OneTimeItem | RecurringItem | AddOn)[] = [
    config.oneTime,
    config.recurring,
    ...(config.tiers ?? []).flatMap((t) => [t.oneTime, t.recurring]),
    ...(config.addOns ?? []),
  ].filter((l): l is OneTimeItem | RecurringItem | AddOn => !!l && !!l.discount && l.discount.amountCents > 0);

  return lines.map(
    (l) => `${l.label}: was ${formatCents(originalCents(l))}, now ${formatCents(l.amountCents)} (${l.discount!.reason})`
  );
}
```

> If `AddOn` / `RecurringItem` are not already exported from `@/lib/types`, import the ones that are and widen the array type to the common `{ label: string; amountCents: number; discount?: ... }` shape — the function only reads `label`, `amountCents`, `discount`.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/importPricing.test.ts`
Expected: PASS.

- [ ] **Step 5: Surface it in the import toast**

In `src/components/proposals/proposalForm.tsx` `handleImport` (the toast is built around lines 905-921), import `summarizeImportedDiscounts`, compute the summary from the config the import resolved to, and fold it into the existing success toast. After the `extras` are assembled and the config is in hand (use the same resolved config that feeds `setState` / `stateToConfig`):

```ts
const discountSummary = summarizeImportedDiscounts(stateToConfig(nextState));
const discountNote = discountSummary.length ? ` Discounts: ${discountSummary.join("; ")}. Confirm the net is right.` : "";
brandToast(
  "success",
  (extras.length ? `Imported with ${extras.join(", ")}. Review the amounts.` : "Imported. Set up pricing below.") + discountNote
);
```

> Confirm the local variable that holds the about-to-be-set form state in `handleImport` (referred to here as `nextState`) and that `stateToConfig` is in scope — both are used elsewhere in the file. If `handleImport` sets state in pieces rather than one `nextState`, build the `PaymentConfig` from the inferred flat/tier/add-on pieces instead and pass that to `summarizeImportedDiscounts`.

- [ ] **Step 6: Document the two dialects**

In `src/app/(admin)/docs/page.tsx`, in the discount section, add a short clarification (no em dashes, plain copy):

> Two discount shapes, one per block. Tiered and add-on discounts use `discount: { amount, reason }` where the line `price` is the LIST and the app subtracts the discount. Flat `oneTime` / `recurring` discounts use `discount: { amountCents, reason }` where the line `amountCents` is already the NET and the discount is recorded for display only. The import toast lists each resolved "was X, now Y" so you can confirm the net before sending.

- [ ] **Step 7: Verify the build + lint (no test for the doc/toast copy)**

Run: `npx vitest run src/lib/importPricing.test.ts && npx eslint src/lib/importPricing.ts src/components/proposals/proposalForm.tsx "src/app/(admin)/docs/page.tsx"`
Expected: tests PASS, eslint 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/importPricing.ts src/lib/importPricing.test.ts src/components/proposals/proposalForm.tsx "src/app/(admin)/docs/page.tsx"
git commit -m "fix(proposals): RSL-37 surface resolved discount net on import + document dialects

The two import discount dialects (tiered/add-on list-minus vs flat
already-net) are legitimately different (human keys vs internal config
dump), so rather than unify and break the round-trip, the post-import
toast now lists each 'was X, now Y (reason)' and /docs spells out which
shape each block uses, so a mis-shaped discount is obvious on review.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> Follow-up (skills tree, not this repo, optional): mirror the dialect note in the skill's `my-business/skills/skills/generateProposal/references/platformImportSchema.md`.

---

## Final Verification (before any push)

- [ ] `npm test` — full suite green (expect ~+15 tests across the four tasks).
- [ ] `npm run build` — prisma generate + next build clean.
- [ ] `npx eslint src` — 0 errors (10 pre-existing test-file warnings are the known baseline).
- [ ] `npx tsx scripts/pdfSmoke.ts` + visual Read — clean (RSL-39 touches the PDF's upstream content builder).
- [ ] Confirm no schema migration was introduced (`git diff --stat prisma/` empty).

## Ship + Close-out (needs Rahul's OK)

- [ ] **Push to `main`** only on Rahul's explicit go — `main` is git-linked, so the push auto-deploys to `proposals.rsla.io`. Smoke prod after: landing 200, dashboard 307, unauthed `/api/.../pdf` 401.
- [ ] **Linear:** move RSL-36, RSL-37, RSL-38, RSL-39 to Done with a one-line resolution comment each (commit + behavior). These are Sid's tickets — writing to them needs Rahul's OK (same gate as the wave-8 close-out).
- [ ] **LOG.md** entry; check the RSL-37 design decision was confirmed.

## Self-Review Notes (author)

- **Spec coverage:** RSL-36 (label `.max` + title `.max` + buildLineItems backstop) ✓; RSL-37 (review surface + docs, dialects intentionally not unified) ✓; RSL-38 (handleSave gate + blank-reason inline + explicit invariant) ✓; RSL-39 (frozenTokens coerce + clientFullName + proposalContent sites) ✓.
- **Decisions flagged:** RSL-37 (surface-not-unify) is the one product judgment — flagged inline. RSL-38's superRefine is defensive future-proofing (existing `positive()` already rejects net<=0); the pinning test guards the behavior regardless.
- **Watch-outs:** `frozenTokens` now trims on read — a no-op for already-valid snapshots (the write-time transform already trimmed), but re-run the full `signingService` + `proposalContent` suites to confirm. The `handleSave` draft-gathering and `handleImport` config accessor are the two spots whose exact `state` field names must be confirmed against the live file (verified-present names listed inline).
- **No placeholders / type consistency:** `moneyDraftIssues(value, withDiscount)` and `summarizeImportedDiscounts(config)` signatures are used identically wherever referenced; constants `MAX_LINE_LABEL_CHARS` / `MAX_PROPOSAL_TITLE_CHARS` defined in Task 1, consumed in Tasks 1.
