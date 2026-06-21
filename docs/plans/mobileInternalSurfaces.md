# Plan — Mobile pass for the internal admin surfaces

## Context

The client-facing surfaces (signing ceremony, signature modal, tier/outcome/pay screens),
the dashboard (table → card list), and the app nav/shell (hamburger) were all made
mobile-clean on 2026-06-13. The ROADMAP "Mobile optimization, internal app" item has three
surfaces still open: the **proposal form**, the **proposal detail / tabs**, and **settings**.
This plan audits them (done — three parallel reads, 2026-06-20) and scopes the fixes.

Bar: "clean + usable on a phone, matching the app's existing compact aesthetic." These are
**internal team surfaces**, so this is not a WCAG tap-target overhaul — it's fixing layout
that crushes or overflows below the breakpoint. Pure presentational Tailwind className changes;
no logic, data, or schema.

## Patterns to reuse (already shipped — don't reinvent)

- **Breakpoint:** `md:` (768px) is the desktop cutover across the app. Standardize on it
  (some form/settings grids currently cut over at `sm:` 640px — fine to keep, but new stacks use `md:`).
- **Table → cards** (`src/components/dashboard/proposalsPanel.tsx`): `hidden md:block` table +
  `space-y-2.5 md:hidden` card list; card = `rounded-xl bg-card px-4 py-3.5 ring-1 ring-foreground/10 transition-transform active:scale-[0.98]`.
- **Stack-then-row:** `flex flex-col gap-3 md:flex-row md:items-center` for rows that currently force horizontal.
- **Mobile-full buttons:** `flex-1 sm:flex-none` so button groups stretch on mobile (`signingExperience.tsx`).
- **Responsive grid:** mobile `grid-cols-1`, desktop `sm:/md:grid-cols-N` — never a cramped `grid-cols-2` on mobile.

## Surface 1 — Proposal form (`src/components/proposals/proposalForm.tsx`) — biggest

**P0 (real crush):**
- `MoneyFields` grid (line ~655) and the tier editor grid (line ~1136) are `grid grid-cols-2 ... sm:grid-cols-12`
  → on a phone every label/input pair is jammed into a 2-col staircase. Change to
  `grid-cols-1 sm:grid-cols-12` so each field is full width on mobile and the 12-col row only
  kicks in at `sm`. Re-check the `col-span-*` children read cleanly when stacked (name / amount /
  interval / remove).

**P1 (rows that don't collapse):**
- Payment-methods row (line ~1259): `flex flex-wrap gap-6` → `gap-3 md:gap-6` so the Card/ACH/Prefer-ACH
  controls wrap without a 24px gap forcing odd breaks.
- Deposit-% row (line ~1461): keep `w-28` input but ensure the row is `flex-wrap` so the input + helper
  text don't collide at 390px.

**P2 (optional polish — confirm before doing):**
- Sticky bottom action bar on mobile for Save/Cancel (mirror the signing flow's floating bar) so a long
  form doesn't require scrolling to the bottom to save. Nice-to-have, slightly more involved.
- Label legibility (`text-xs`): leave as-is to match app density unless you want a bump.

## Surface 2 — Proposal detail / tabs (`src/app/(admin)/proposals/[id]/page.tsx` + components)

In better shape than the form; `partyList` already does `flex-col sm:flex-row`.

**P0:**
- Tab strip — 4 tabs (Preview / Parties / Audit trail / Documents) with `w-full sm:w-fit` + `flex-1 whitespace-nowrap`
  compress and clip on a phone (`tabs.tsx` + page.tsx:~151). Fix: make `TabsList` horizontally scrollable on
  mobile (`overflow-x-auto`, triggers `shrink-0`, `w-full sm:w-fit`) so all four labels stay readable. (Alt:
  icon + shorter labels — recommend the scroll, keeps wording.)

**P1:**
- Documents row (page.tsx:~226): truncate the doc title and go `flex-col md:flex-row` so the Download button
  stops crushing the title/metadata.
- Party actions (`partyList.tsx:~61`): let Copy-link / Remind wrap or stretch (`flex-wrap` / `flex-1 sm:flex-none`)
  when the card is stacked.

**P2:**
- Audit detail line (`auditTimeline.tsx:~132`): add `break-words` for very long metadata strings.
- Header action bar (`proposalActions.tsx:~85`): already `flex-wrap`; optional tidy (e.g. full-width on mobile).

## Surface 3 — Settings (`teamSettings.tsx`, `systemHealth.tsx`, `signatureSettings.tsx`)

Settings tabs are only 2 (General / System) → no tab overflow.

**P1:**
- Add-teammate form (`teamSettings.tsx:~143`): `grid-cols-2 sm:grid-cols-12` → `grid-cols-1 sm:grid-cols-12`
  (same fix as the form grids); the Role select + Add button get full width on mobile.
- Team user-row buttons (`teamSettings.tsx:~102`): the make-admin / remove buttons stay inline when the row
  stacks — let them wrap or go full-width on mobile.
- System-health list rows (`systemHealth.tsx:~90/124/152/179`): `flex justify-between` crushes the Retry
  button against long text → `flex-col md:flex-row`. Lower priority (System tab is admin + desktop-mostly).

**P2:**
- Signature font grid (`signatureSettings.tsx:~118`, `grid-cols-2`): fine inside the modal (it scales down); leave.

## Explicitly skip (false positives / out of scope)

- **Signature pad `h-44`** (`signaturePadCanvas.tsx:~76`): the audit flagged the fixed height, but this canvas
  is the same one used in the signing ceremony, which was already phone-tested and works. Width re-fits via
  `ResizeObserver`. Leave it.
- **Blanket 44px tap targets + larger label text:** would diverge from the app's deliberate compact density —
  the *already-shipped* mobile surfaces (dashboard cards, signing bar) use `sm` buttons and `text-xs`. Not doing
  unless explicitly wanted.

## Execution notes

- Presentational Tailwind only; no logic/data/schema/test changes.
- Use **emilDesignEng** for any interaction bits (the optional sticky action bar's transition, tap feedback),
  per workspace convention.
- Touch ~6 files: `proposalForm.tsx`, `proposals/[id]/page.tsx`, `ui/tabs.tsx` (or a local wrapper),
  `partyList.tsx`, `auditTimeline.tsx`, `teamSettings.tsx`, `systemHealth.tsx`.

## Verification

- Admin surfaces are Google-auth-gated, so direct live screenshots need a session. Verify via Chrome DevTools
  at **390px and 768px** against a local dev server (`npm run dev`, :1235) with a local login, or a throwaway
  public preview route with mock data (the approach used for the dashboard upgrade). Walk: form (all sections +
  pricing modes), detail (all 4 tabs), settings (both tabs + add-teammate).
- Confirm desktop (≥md) is visually unchanged.
- `npm run build` + `eslint src` clean. No unit tests (presentational).

## Rollout

- One commit, ship via `main` (git-linked auto-deploy). Tick the ROADMAP "Mobile optimization, internal app"
  sub-items (form / detail tabs / settings) and add a LOG entry.

## Suggested execution order

1. **P0** (form grids + detail tab strip) — the only genuine "looks broken on a phone" items.
2. **P1** (collapsing flex rows in form / detail / settings).
3. **P2** (sticky save bar, break-words, etc.) — only if wanted.
