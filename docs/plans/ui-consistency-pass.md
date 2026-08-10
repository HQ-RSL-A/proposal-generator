# Plan — UI consistency pass (full systematization)

Status (2026-08-09): **Phases 0-1 SHIPPED**. **Phase 2 waves 1-3 + the signing-surface
wave ALL MERGED + deployed** (waves 2-3 + signing surface went out 03:19 on Rahul's
blanket go — the entire Card adoption chain + THE status tone scale are live; e2e
rehearsal PASSED, see log 03:13, incl. Stripe test pay + executed PDF with matching
content hash). Checkpoint note that survives the merge: danger/warning timeline tones
weren't exercisable locally (no bounced/declined/expired rows). Rahul's pending action
items + the full status snapshot: log 2026-08-09 03:19. Two [TEST] rows sit in prod;
e2eCleanup only after his phone walk.
**Waves 4+5 MERGED + deployed 2026-08-09 ~16:40 after Rahul's local review** ("yes and
yes"; logs 15:52 + 16:15 + 16:45), and the smooth-scroll route-transition fix his
review surfaced (header actions hidden on proposal-page load →
`data-scroll-behavior="smooth"` on `<html>`) **MERGED + deployed ~16:50 on his "Go
ahead"**. Only ONE [TEST] row remains in prod (his VIEWED phone-walk row); the
rehearsal row was deleted on his ask.
**Wave 6 (type/color hygiene — Phase 2 item 5) MERGED + deployed on his go** (log
17:05): transition-all retired from the 4 ui primitives (box-shadow excluded so focus
rings snap), ring unification on ring-foreground/10, bg-white → bg-card, text-white
on primary → token, #00C2FF → --chart-2, CardTitle overrides dropped,
signatureSettings eyebrows onto the CardLabel standard. Landing's two text-[15px]
wait for Phase 3's landing pass.
**Wave 7 (dashboard motion + skeletons — Phase 2 items 6-7) MERGED + deployed
2026-08-09 ~17:55 on Rahul's "Looks good"** (log 17:40): filter-change 150ms
crossfade, `.stagger-children` metric-card entrance stagger, sticky-header
backdrop-blur dropped (bg-card/95), new `ui/skeleton` + route-level loading
skeletons for dashboard and proposal detail (group spinner stays elsewhere).
**PHASE 2 IS COMPLETE.** Branch is even with `main`.
Wave 4 (primitives adoption — Phase 2 item 3): proposals list → real ui/table
(semantics; row-overlay link verified clickable), dashboard filter → ui/tabs
(arrow-key + Enter activation, Badge counts, wave-1 pill look kept), both native
selects → ui/select (numeric interval via Base UI `items`; also fixes their h-9-beside-
h-8-Input drift), Remove-signer + avatar-menu aria-labels with TooltipProvider mounted
in AppShell (delay 0→600ms, instant-subsequent verified), Void dialog → DialogFooter.
Wave 5 (one confirm + one async pattern — Phase 2 item 4): Button `loading` prop
(spinner + preserved label, data-loading hides sibling icons), `ui/confirm-dialog`
promise API + host in AppShell replacing the deleted `brandConfirm` (opens on a fresh
task — the requesting click otherwise reads as an outside press and insta-dismisses),
per-action/per-row pending keys in proposalActions/teamSettings/partyList, label-swap
buttons (send/save/signature/retry) → `loading`, sign-in Google button pending via
`useFormStatus` (Phase 3's sign-in item, done early). Signing files untouched —
signingExperience's pending buttons + signatureModal's footer wait for a
rehearsal-gated wave.
**The rehearsal-gated signing wave is MERGED + deployed (2026-08-09 22:13 on
Rahul's "Look good. Merge"; built + fully rehearsed 22:07)**: ui/dialog sheet mode
pins a DialogFooter child below the scroll area; signatureModal adopt CTA → banded
DialogFooter + `loading` (safe-area-absorbing band); signingExperience
Finish/decline → `loading` with stable labels, decline dialog rows → DialogFooter,
chip text-white → token; proposalView bg-white/text-white →
bg-card/text-primary-foreground. Full e2e rehearsal PASSED **including the webhook
leg** (stripe listen --api-key needs no CLI login — recipe in the
chrome-testing-quirks memory): SIGNED/PAID, cert hash == content hash, all 4 emails
DELIVERED, jobs DONE attempts=1. Both temp rows deleted by id-scoped cascade (his
phone-walk row is the sole [TEST] row). Details: log 2026-08-09 22:07 + 22:13.
**Phase 3 is BUILT in one wave (2026-08-09 22:48, unmerged, pending Rahul's
checkpoint)** — /docs completeness (Fifteen→Fourteen fix, IMPORT_KEYS drift guard +
"What the import box reads" table, paste-dialect discount example, cadence caveats),
sweep (copy chip recipe, emerald→success, public 15px→text-base), guardrails (the
table below + CLAUDE.md UI Conventions + AGENTS.md mirror), and the full a11y pass:
Lighthouse landing/sign-in 100 (sign-in gained its `<main>`), signing 98 (noindex by
design; heading-order deferred — signing file), axe 0 on /docs, /dashboard, and
/proposals/new across all form states after: `--accent-foreground` → #0062D6,
`--success` → #047857 (both AA now; toasts moved onto the tokens), tab/chip text →
foreground/70, 18 label associations + 11 toggle names + counter contrast in the form.
Open items for later: proposalView heading-order tag swap (next rehearsal-gated wave),
white-on-amber warning toast (~2.1:1 — Rahul's design call). Details: log 22:48.
**RESUME POINT — next: Rahul's checkpoint of the Phase 3 wave → his "merge" go.
After that the plan is COMPLETE** (only the two open items above remain).
**Added 2026-08-09 by Rahul — BOTH DONE 2026-08-09** (log 02:50): PDF reviewed (cert
font-name leak fixed; page numbers / Notes-page flow / footnote anchors / footer naming
are open decisions for Rahul), copy pass done (3 email tightenings + em dash fix;
everything else verified on voice; ESIGN consent untouched). Workflow rhythm: work in
waves on this branch, `npm test` (306) + `npm run build` (the type gate) per wave, visual
checkpoint with Rahul, HE says "merge" (main auto-deploys). Signing-flow tests use the $1
rehearsal: `e2eSeed` → re-price to 3×$1 tiers (temp script; see log 2026-08-08) →
`e2eSend`; DATABASE_URL must be the aws-1 session pooler (direct host is IPv6-only).
Decisions locked with Rahul 2026-08-08: **client signing flow first** after foundation ·
**full systematization** (not a surface pass) · **light-only** (dark mode code removed) ·
**implement in phases**, each phase gated by build + tests + visual pass before merge
(`main` auto-deploys — nothing merges without Rahul's go). Added mid-planning by Rahul:
**proposal-form input fields clip long text** — pulled into Phase 0 as a workflow bug.

Grounded in a six-dimension code audit (toasts/feedback, cards, buttons/forms,
overlays/async states, tokens/typography, motion) run 2026-08-08. Every claim below has
file:line evidence from that audit; re-confirm exact lines at build time.

---

## What the audit found (condensed)

**Healthy foundations — keep and build on:**
- `brandToast` discipline is total: 32 call sites, zero raw-sonner bypasses (`src/lib/toast.tsx`).
- Base UI primitives are modern and correct (focus traps, `data-open` animation wiring,
  origin-aware popovers, `active:scale-[0.98]` on Button).
- PDF + emails mirror the brand tokens exactly (best-behaved surfaces in the repo).
- Neutrals are token-clean almost everywhere (`text-muted-foreground` ×108; raw gray
  classes ≈ 5 total). Admin shell (`appShell.tsx`) enforces one container rhythm.
- Fonts load correctly (Satoshi local, Inter google, `display: swap`).

**Three drift engines (why it reads inconsistent):**

1. **Primitives exist but aren't adopted.** 32 distinct hand-rolled card recipes across
   ~40 sites (34% Card adoption); the proposals list is a hand-rolled div grid while
   `ui/table.tsx` serves only the docs page; the dashboard filter reimplements tabs with
   no ARIA/keyboard support (`proposalsPanel.tsx:75`); `ui/select.tsx` (201 lines),
   `ui/tooltip.tsx` (66 lines), `DialogFooter`, and the `link` Button variant have zero
   importers while raw `<select>`s and bare text-buttons ship instead.
2. **Broken status tokens made hardcoding rational.** `--destructive #FF6B6B` (2.8:1)
   and `--success #10B981` (2.6:1) fail WCAG AA as text, so the codebase voted them out:
   four greens, three reds, and per-file color maps (`statusChip.tsx` 25 raw classes,
   `auditTimeline.tsx` 24 = 49% of all raw palette usage). Same state, different hue per
   screen: EXPIRED = orange chip / rose timeline / amber outcome; PROCESSING = sky / amber.
3. **Async and edge states were never systematized.** Zero `loading.tsx` / `error.tsx` /
   `not-found.tsx` in the whole App Router (client-facing `/sign` + `/pay` crash to Next's
   unbranded screen); zero visible spinners; four pending-button conventions (one of which
   — `busy` — shows nothing); guidance rendered in red error chrome (6 of 18 error toasts);
   two confirmation systems (toast-confirm for Delete-draft vs Dialog for the less
   destructive Void).

**Outright bugs (Phase 0):** toasts follow the OS theme (dark toasts on light app —
`ui/sonner.tsx:8` + no ThemeProvider); Retry-job discards its result (both call sites) and
`retryJob` revalidates `/health`, a page that is only a redirect; `partyList` renders an
empty white box on DRAFT; uncaught `navigator.clipboard.writeText` (`partyList.tsx:79`);
signing `scrollIntoView` bypasses `prefers-reduced-motion` (`signingExperience.tsx:31,136`);
proposal-form single-line Inputs clip sentence-length content in narrow grid cells.

---

## Design decisions (the system we converge on)

**Color.** One family per meaning, token-backed, AA-compliant:
- `--destructive: #DC2626` (red-600 — what toast error already uses) + subtle pair
  `--destructive-subtle: #FEE2E2` / `--destructive-subtle-foreground: #B91C1C`.
- `--success: #059669` (emerald-600 — what chips/toasts already use) + `#D1FAE5`/`#047857`.
- `--warning: #F59E0B` stays (fills/icons only — never text on white) + `#FEF3C7`/`#B45309`.
- Rose→red migration happens where chips are re-tokened (Phase 2); visually near-identical.
- Name the dashboard's five bespoke grays into two tokens: `--surface-raised: #FCFCFD`,
  `--border-subtle: #EEF1F6`; delete the rest.
- Kill `--danger` (dup), all 8 `--sidebar-*` (no sidebar exists); keep `--chart-*` and
  point `sparkline.tsx` at them.

**Elevation.** Rings for admin chrome, borders for document surfaces — but as *variants of
one Card*, not two dialects: `flat` (ring-1 ring-foreground/10), `outlined` (border),
`raised` (.document-page shadow), `floating` (action-bar shadow). Ring opacity unifies on
`/10`; `/[0.07]`, `ring-black/5`, `ring-black/10` retire.

**Radius.** Containers use `lg | xl | 2xl` bound to card size; arbitrary `[14px]`,
`[11px]`, `[10px]` retire (they are sub-pixel re-inventions of existing steps).

**Type.** h1 = `font-heading text-2xl font-bold` (admin) / existing hero scales (public);
card titles = CardTitle default (drop the 14 redundant `text-base` overrides); one eyebrow
primitive `CardLabel` = `font-tag text-[11px] font-semibold uppercase tracking-widest`
(replaces 9 treatments, 4 sizes, 4 trackings); `font-black` reserved for the landing hero +
proposal document title only. The ~30 arbitrary `text-[N.Npx]` sizes in
`metrics.tsx`/`proposalsPanel.tsx` map back to the scale.

**Motion** (per Emil Kowalski's framework, already partially adopted via
`--ease-out-strong`): overlays enter ~180ms on `--ease-out-strong`, exit ~120ms (today:
100ms symmetric on CSS `ease` — reads as flicker); press feedback (`active:scale`) on every
tappable card/tile, not just Button; `transition-all` retires for named property lists
(`button.tsx:7` transitions box-shadow on every focus); tooltips get a ~600ms first-open
delay (today 0 — flickers on cursor pass); state swaps (action-bar labels, filter changes,
Draw/Type tab) get transitions instead of hard cuts; everything respects
`prefers-reduced-motion`.

**Feedback.** Severity means something: `error` = something failed; `warning` = you must
act (unpicked plan, empty signature); `info`/`brand` = progress and guidance. One confirm
primitive (`ConfirmDialog`, Dialog-based, focus-trapped) replaces `brandConfirm` toasts;
one async convention: `Button loading` prop (spinner + preserved label) driven by
`useTransition`/`useActionState` per control — no shared `busy` that dims whole panels.
Toasts carry `role="status"` / `aria-live` so the signing ceremony's toast-borne guidance
is announced.

**Light-only.** next-themes uninstalled; Toaster forced light; the 17 dead `dark:` variants
across 9 `ui/*` files removed; `@custom-variant dark` removed. Client documents read as
paper; admin is one look.

---

## Phase 0 — Correctness + foundation (this branch, first merge)

No visual redesign; fixes only. Every item independently verifiable.

1. **Tokens** (`globals.css`): retarget `--destructive`/`--success`; add the three subtle
   pairs + `--surface-raised`/`--border-subtle`; delete `--danger`, `--sidebar-*`,
   `.gradient-blue`, `.gradient-text`, `.scrollbar-none` (grep-verify 0 uses first);
   move `--ease-out-strong` into the main `:root`; retarget `--font-mono` to
   `ui-monospace` (Geist Mono was never loaded); `motion-reduce` opt-out for the global
   `main` fadeIn.
2. **Kill the OS-theme toast leak**: `ui/sonner.tsx` drops `useTheme` → `theme="light"`;
   `layout.tsx` Toaster drops dead `richColors`, sets `position="top-center"` (the position
   every toast already hardcodes). Uninstall `next-themes`; strip `dark:` variants from
   `button/input/select/textarea/checkbox/switch/tabs/badge/dropdown-menu`.
3. **Route state files**: root `not-found.tsx` + `error.tsx` + `global-error.tsx`
   (branded, no emojis); `(admin)/loading.tsx` (covers all admin routes);
   `sign/[token]/loading.tsx` + `error.tsx` and `pay/[token]/loading.tsx` + `error.tsx` —
   client-facing error pages reuse the OutcomeCard look and show only `SUPPORT_EMAIL`.
4. **Retry-job feedback**: shared `RetryJobButton` client component (pending state +
   success/error toast) replacing both fire-and-forget forms
   (`proposals/[id]/page.tsx:141`, `systemHealth.tsx:104`); fix `retryJob`'s
   `revalidatePath("/health")` to the surfaces that render it.
5. **partyList**: DRAFT empty state ("Recipients appear here once the proposal is sent");
   wrap the clipboard write in try/catch with an error toast.
6. **Reduced-motion scroll**: `scrollIntoView` helper honors `prefers-reduced-motion`
   (`behavior: "auto"`) at `signingExperience.tsx:31` and `:136`.
7. **Proposal-form input clipping (Rahul's report)**: add `autoGrow` to `ui/textarea.tsx`
   (rows=1, height tracks scrollHeight); flip sentence-length fields from `Input` →
   auto-growing textarea: non-multiline token fields (titles, At-a-Glance trio), pricing
   `Label` / `Shown to client` / `Discount reason`, add-on name/description, future-item
   `Starts` note, case-study link stays Input. Numeric/short fields stay `Input`.

**Verify:** `npm test` (278) · `npm run build` · dev-server visual pass of the new
loading/error/404 pages + the form fields at 1280/390 · no PDF change (pdfSmoke not needed).

## Phase 1 — Client signing flow

The revenue path: what a prospect sees between opening the link and paying.

1. **Signature modal**: enter 180ms `--ease-out-strong` / exit 120ms (via `dialog.tsx`
   data-state durations — benefits all dialogs); animate the Draw↔Type swap (TabsContent
   fade + height transition); bottom-sheet presentation below `sm` (slide-up, drag
   affordance) — the modal is the core mobile signing surface.
2. **Press feedback + focus**: tier cards, add-on rows, "Tap to place your signature"
   slots, font-picker tiles get `active:scale-[0.98]` + named transition properties +
   `focus-visible` rings (they are buttons with no focus treatment today —
   `proposalView.tsx:136,218,387`; `signatureModal.tsx:231`).
3. **Floating "next field" chip**: animated mount/exit (translate+fade+scale ≥0.95, never
   from 0), label crossfade on swap ("Place your signature" → "One more signature left"),
   `env(safe-area-inset-bottom)` on chip + action bar (currently sits under the iOS home
   indicator).
4. **Action bar**: state-label transitions (Ready to sign → Review and sign → Finish &
   Submit), submit spinner via the new Button `loading` prop, progress line surfaced on
   mobile (today `hidden sm:block`), `aria-live` on the status line.
5. **Toast severity remap** on signing: unpicked-plan / empty-signature / empty-name →
   `warning`; progress stays `brand`; `role="status"` + `aria-live="polite"` added inside
   `brandToast`/`brandConfirm` cards.
6. **Signing shell**: `sign/layout.tsx` (currently a pass-through) owns the
   `min-h-screen bg-surface` + gutter so signing/outcome/pay stop re-inventing the frame;
   signing page gets the same entry fade admin pages already have.
7. **Unify the duplicated font-picker tile** (`signatureSettings.tsx:125` ≡
   `signatureModal.tsx:236`) into one component (also used by Phase 2 settings).

**Verify:** build + tests · Chrome mobile-viewport walk of the full ceremony (adopt →
place → submit) + reduced-motion pass · rehearsal against a `[TEST]` seed if flows changed.

## Phase 2 — Admin systematization

1. **Card API** (`ui/card.tsx`): `variant` (flat/outlined/raised/floating) · `tone`
   (default/muted/warning/danger/accent/dashed) · `size` (sm/md/lg + `padding={false}`) ·
   `hoverable` · `selected` · plus `CardLabel`. Migrate in payoff order:
   `dashboard/metrics.tsx` + `proposalsPanel.tsx` (kills the self-contradicting dashboard,
   3 arbitrary radii, the half-step spacing grid) → the 11 copies of
   `rounded-lg border border-border p-3` → `proposalView` interior blocks (tone/selected) →
   `outcomeCard` (raised) + signing action bar (floating).
2. **Status system**: token-backed tone maps in ONE place (`statusChip.tsx` exports the
   scale); `auditTimeline`, `outcomeCard`, `systemHealth` consume it — fixes EXPIRED/
   PROCESSING contradictions and the raw `SESSION_EXPIRED` enum leak
   (`systemHealth.tsx:136`); `sparkline.tsx` → `--chart-*`.
3. **Real primitives in**: proposals list → `ui/table.tsx` (semantics + keeps the mobile
   card list); dashboard filter pills → `ui/tabs.tsx` (keyboard/ARIA; count badges via
   `Badge`); native `<select>`s → `ui/select.tsx` (`teamSettings.tsx:159`,
   `proposalForm.tsx:728`); icon buttons get `aria-label` + `ui/tooltip.tsx` (delay fixed
   0 → ~600ms, instant on subsequent); dialogs adopt `DialogFooter`.
4. **One confirm + one async pattern**: `ConfirmDialog` replaces `brandConfirm` (Delete
   draft, Mark as paid; Void/Decline keep their richer dialogs on the same primitive);
   Button `loading` prop everywhere (`proposalActions`, `teamSettings` per-row — not
   panel-wide `busy` —, `partyList`, forms, sign-in Google button).
5. **Type + color hygiene**: heading normalization; drop the 14 `text-base` CardTitle
   overrides; arbitrary px sizes → scale; `bg-white` → `bg-card` (15); `text-white` on
   primary → `text-primary-foreground` (7); `transition-all` → named lists (6);
   `#00C2FF` literals → `--chart-2`; ring-recipe unification.
6. **Dashboard motion**: filter-change crossfade (the most-used admin interaction is a
   hard cut today); optional subtle stagger on first paint of metric cards; drop
   `backdrop-blur` from the sticky header (`appShell.tsx:36` — per-scroll-frame repaint
   for marginal effect at `bg-white/80`; use `bg-white/95`).
7. **Skeletons**: `(admin)/loading.tsx` upgraded from spinner to layout skeletons for
   dashboard (KPI strip + table) and proposal detail.

**Verify:** build + tests · visual pass dashboard/proposals/detail/settings at 1280/390 ·
keyboard-only walk (tabs, table, menus, dialogs).

## Phase 3 — Sweep + guardrails

0. **/docs completeness audit (Rahul, 2026-08-08):** verify the in-app `/docs` page lets
   an agent reproduce EVERY form capability in import JSON — all token fields, tiered +
   flat pricing, add-ons, deposits, later-phase (futureItems) lines, discounts, track
   record/case studies, manual invoice — with a copy-paste example per shape. Cross-check
   against `src/lib/types.ts` + the `infer*FromImport` helpers; extend the compile-time
   drift guard where a shape isn't covered.
1. Kill remaining one-off recipes surfaced by Phases 1–2 (grep-driven: arbitrary radii,
   `ring-black/*`, stray `p-*` steps, leftover raw palette classes outside the status maps).
2. `docs/` + landing + sign-in aligned to the same primitives (docs headings, copy chip
   focus ring, sign-in pending state).
3. Guardrails so drift stays dead: extend this file with the "which primitive for what"
   table; add a short "UI conventions" section to CLAUDE.md (tokens only, no raw palette
   outside status maps; Card/CardLabel/ConfirmDialog/Button-loading are mandatory;
   new routes ship loading+error states).
4. Full-app visual regression pass + `prefers-reduced-motion` audit + a11y spot-check
   (axe on dashboard, form, signing).

---

## Which primitive for what (the standing system — Phase 3 guardrail)

| Need | Use | Never |
| --- | --- | --- |
| Container / panel | `Card` (`variant` flat/outlined/raised/floating · `tone` · `size` · `selected`) | hand-rolled `rounded-* border p-*` divs |
| Eyebrow / section label | `CardLabel` | bespoke uppercase/tracking spans |
| Status color | the `StatusTone` scale exported by `statusChip.tsx` | raw palette classes (`rose-*`, `emerald-*`, `sky-*`, …) |
| Confirmation | `confirmDialog()` for simple; `Dialog` + `DialogFooter` for richer flows (Void, Decline) | toast confirms, hand-rolled action rows |
| Async pending | `Button loading` (spinner + preserved label) with per-action/per-row pending keys | label swaps, panel-wide `busy` |
| Dialog actions | `DialogFooter` (banded; pins below the scroll area in sheet mode) | `flex justify-end` rows |
| Tabular data | `ui/table` | div grids |
| Filter / tab bars | `ui/tabs` (+ `Badge` counts) | hand-rolled pill rows |
| Selects | `ui/select` | native `<select>` |
| Icon-only buttons | `aria-label` + `ui/tooltip` (600ms first-open, instant subsequent) | unlabeled icon buttons |
| Toasts | `brandToast` with severity semantics (error = failed · warning = you must act · brand/info = guidance) | raw sonner, guidance in error chrome |
| Programmatic scroll | `appScrollBehavior()` | raw `behavior: "smooth"` |
| Motion | `--ease-out-strong`, named transition properties, `motion-reduce`/`prefers-reduced-motion` guards | `transition-all`, unguarded animations |
| Text size | the type scale (CardLabel/CardTitle defaults; admin h1 = `font-heading text-2xl font-bold`) | new `text-[Npx]` |
| Color | tokens only (`bg-card`, `text-primary-foreground`, `--chart-*`) | `bg-white`, `text-white`, hex literals |

### Sanctioned exceptions (grep hits that are correct — do not "fix")

- `statusChip.tsx` solid PAID chip: `bg-success text-white` (no `--success-foreground` token; the one deliberate white-on-color chip).
- `lib/toast.tsx`: `text-white` + `bg-white/20` (alpha overlays on colored toast surfaces).
- Landing hero `text-[clamp(…)]` + `font-black` (the hero scale; `font-black` is hero + proposal document title only).
- Primitive-internal micro details: checkbox `rounded-[4px]`, tooltip arrow `rounded-[2px]`, button sm `rounded-[min(var(--radius-md),12px)]` + `text-[0.8rem]`, CardLabel `text-[11px]`, font-tag `text-[10px]`.
- Document prose `text-[15px]` in `proposalView` (the paper reading size; the PDF mirrors it).

### Import-docs drift guard

The /docs page is compile-time-typed against BOTH `TokensJson` (`FIELD_META`) and
`IMPORT_KEYS` from `src/lib/importPricing.ts` (`IMPORT_META`). Teaching the import box a
new top-level key means adding it to `IMPORT_KEYS` and documenting it, or the build fails.

## Risks / watchpoints

- **`main` auto-deploys.** All work stays on `ui/consistency-pass`; Rahul gates every
  merge. Never `vercel deploy` from the branch.
- **Signing flow is legally load-bearing.** Phase 1 touches presentation only — the
  two-place ceremony, ESIGN consent, token/hash logic stay byte-identical. Any change to
  signing files re-runs the e2e rehearsal scripts before merge.
- **PDF is out of scope** — no `src/components/pdf` changes in any phase (its tokens
  already match). If a shared constant ever moves, run `pdfSmoke` + visual Read.
- **Tests query the form** (`proposalForm.test.tsx`); Input→Textarea flips keep
  accessible roles (`textbox` matches both) but run the suite after each flip.
- **Color-token retargets repaint every consumer** — that is the point, but eyeball the
  three surfaces where `text-destructive` is load-bearing (form errors, decline flows,
  dead-jobs card) after the swap.
- The audit's file:line refs age as the branch progresses; trust the pattern, re-grep the
  line.
