# log.md - proposal-generator

## 2026-08-09 17:55 PT - Wave 7 MERGED on Rahul's "Looks good" - PHASE 2 COMPLETE

All of Phase 2 is now live: Card system, status tone scale, primitives (table/tabs/
select/tooltip/DialogFooter), ConfirmDialog + Button `loading`, type/color hygiene,
dashboard motion + skeletons. Branch `ui/consistency-pass` is even with `main`.
Remaining per the plan's RESUME POINT: (1) the rehearsal-gated signing wave
(signatureModal DialogFooter, ceremony pending buttons -> `loading`, proposalView
bg-white/text-white; full e2e rehearsal before merge), then (2) Phase 3 (docs
completeness audit -> one-off sweep + docs/landing/sign-in alignment -> guardrails +
full regression/a11y pass). Rahul's manual items live in his Notion tracker (phone
walk of the one remaining [TEST] row, e2eCleanup after, stripe login, 4 PDF
decisions, vercel CLI upgrade).

## 2026-08-09 17:40 PT - Phase 2 wave 7: dashboard motion + skeletons (Phase 2 COMPLETE pending this merge)

Wave 6 merged + deployed on Rahul's go right before this. Wave 7 built on
`ui/consistency-pass`, **unmerged, pending his checkpoint** - Phase 2 items 6-7, the
last Phase 2 wave:

- **Filter-change crossfade**: the proposals results region (table/mobile
  list/empty state) remounts keyed by filter with a 150ms fade-in on
  --ease-out-strong instead of a hard cut. motion-reduce: none.
- **Metric-card entrance stagger**: new `.stagger-children` utility in globals
  (240ms rise+fade per card, 40ms steps, `backwards` fill, wrapped in
  prefers-reduced-motion: no-preference) applied to the dashboard metrics grid.
  Deliberately tiny - it rides on top of main's existing fadeIn.
- **Sticky header**: backdrop-blur dropped, bg-white/80 -> bg-card/95 (the blur
  repainted every scroll frame for a near-invisible effect; plan item 6).
- **Skeletons**: new `ui/skeleton` primitive (pulse = opacity-only, reduced-motion
  safe) + route-level loading.tsx for dashboard (header, hero + 4 KPI cards in the
  real grid, pill bar, 6-row table ghost) and proposals/[id] (title/chips/meta,
  actions, tab bar, raised document-card ghost). The group-level spinner stays for
  settings/docs/new/edit/send.

Verification note for future sessions (now also in the chrome-testing-quirks
memory): the occluded automation window FREEZES CSS animation clocks, so
screenshots catch animations mid-flight forever. Verified end-states via the Web
Animations API instead (getAnimations().finish() -> all 5 cards at opacity 1,
transform none; filter swap correct after finish). Skeletons verified two ways:
the streamed HTML carries the loading shells (62 skeleton nodes on /dashboard, 17
on detail, aria-labels present), and both shells were extracted from the stream
and mounted in-page for visual screenshots - proportions mirror the real layouts,
no reflow jump. 306/306 vitest + clean build.

With this merged, Phase 2 is DONE. Remaining: the rehearsal-gated signing wave,
then Phase 3.

## 2026-08-09 17:05 PT - Phase 2 wave 6: type/color hygiene sweep

Scroll fix merged + deployed on Rahul's "Go ahead" right before this. Wave 6 built on
`ui/consistency-pass`, **unmerged, pending his checkpoint** - the Phase 2 item 5 list,
re-grepped against today's tree (much of the audit's inventory was already killed by
earlier waves: admin h1s all normalized, metrics/proposalsPanel arbitrary px gone,
page-level arbitrary radii gone):

- **transition-all retired (4 ui primitives)**: button, tabs trigger, switch, badge ->
  named property lists. Deliberate detail: box-shadow is EXCLUDED so focus rings snap
  instantly (the audit's complaint was transition-all animating the ring on every
  focus); the dashboard filter pills keep their reviewed shadow crossfade via their
  own className.
- **Ring unification**: ring-black/5 (Card floating variant, sign-in art panel) +
  ring-black/10 (brandToast) -> ring-foreground/10. Zero ring-black left.
- **bg-white -> bg-card (6 sites)**: landing CTA, SignInButton, proposal-detail
  documents list, partyList x2 (+ hover pairs). Pixel-identical (--card is #FFFFFF).
  Kept on purpose: appShell bg-white/80 (changes with the motion wave's backdrop-blur
  drop) and toast bg-white/20 (alpha overlay on colored surfaces).
- **text-white on bg-primary -> text-primary-foreground** (settings + appShell avatar
  fallbacks). statusChip's solid bg-success text-white stays (no --success-foreground
  token exists). Signing files untouched as always.
- **#00C2FF literals -> bg-(--chart-2)** (landing glow x2; same hex, now tokened).
- **14 redundant `CardTitle className="text-base"` dropped** across 7 files (it IS the
  default).
- **signatureSettings eyebrows onto the standard**: "Current signature" -> CardLabel;
  the font-picker tile label gets CardLabel's exact classes inline (a <p> inside
  <button> is invalid HTML, so the span stays a span). proposalForm's char counter
  text-[11px] -> text-xs.
- Left for Phase 3's landing/docs pass: the two public text-[15px] body sizes.

Verified: 306/306 vitest, clean build, visual pass of settings (eyebrow change is the
only intended visible diff) + dashboard. Landing/sign-in redirect while authed; their
swaps are same-value token substitutions covered by the build.

Also this hour, logged for completeness: waves 4+5 merged after Rahul's local review;
rehearsal [TEST] row deleted on his ask (phone-walk row kept); scroll-to-top fix
shipped. Memory (chrome-testing-quirks) gained the occluded-window rAF/smooth-scroll
gotcha.

## 2026-08-09 16:45 PT - Waves 4+5 MERGED + deployed; scroll-to-top fix; rehearsal row deleted

Rahul reviewed waves 4+5 locally ("yes and yes") -> merged to `main` (fast-forward,
auto-deploy). Two follow-ups from his review, both done:

**1. Deleted last night's rehearsal row on his ask.** Targeted cascade delete of the
SIGNED/AWAITING [TEST] row only (executed PDF + 2 signature blobs + 4 webhook events +
DB cascade). His VIEWED phone-walk row is UNTOUCHED and is now the only [TEST] row in
prod; dashboard metrics cleaned up with it (fake $497/mo left MRR). His Notion
e2eCleanup task description updated to match.

**2. His bug report: proposal-page header actions (Send/Edit/Delete/Revise) sometimes
hidden on load, must scroll up.** Root cause is the documented workspace gotcha
(reference_nextjsGotchas, hit on Sunrise 2026-06): `html { scroll-behavior: smooth }`
turns the App Router's route-transition scroll-to-top into an animation that gets
interrupted, landing the new page scrolled down. Extra color from this session: in an
occluded window, smooth scrolls never progress AT ALL (scrollTo sat at 0 for 900ms
while behavior:instant worked) - which is also why it was intermittent for him. Fix:
Next 16's official remedy, `data-scroll-behavior="smooth"` on `<html>` (layout.tsx) -
Next suspends smooth scrolling during route transitions so the reset is instant.
In-page smooth scrolling (signing flow's scrollIntoView etc.) is unaffected. Verified
in the harshest case: occluded window, dashboard scrolled to 215px, click a row ->
new page lands at scrollY 0, action buttons visible. 306/306 vitest + clean build.
Committed on `ui/consistency-pass`, pending his go.

## 2026-08-09 16:15 PT - Phase 2 wave 5: ConfirmDialog + Button `loading` (one confirm, one async pattern)

Built on `ui/consistency-pass` on top of wave 4, **unmerged, pending Rahul's checkpoint**
(waves 4+5 will checkpoint together). Also this session: Rahul's 6 open action items
filed into his Notion tracker (Lalia's Tasks) per his ask.

- **`ui/button` grows the `loading` prop**: spinner + preserved label, disables while
  pending, and a `data-loading` rule hides any other icon in the button so spinner and
  icon never stack. `ui/spinner` now tags itself `data-slot="spinner"` (that's what the
  rule keys on).
- **`ui/confirm-dialog` (new)**: promise-based `confirmDialog()` + `<ConfirmDialogHost>`
  mounted in AppShell - the Dialog-primitive replacement for the toast-based
  `brandConfirm`, which is now deleted from `lib/toast`. Focus-trapped, Esc/backdrop =
  cancel, tone danger/default drives the icon chip + confirm-button variant, DialogFooter
  band. One real bug found + fixed while verifying: the dialog opened and instantly
  dismissed itself - the click that requests the confirm was still bubbling when the
  dialog mounted, so Base UI read that same click as an outside press. Fix: the host
  opens on a fresh task (`setTimeout 0`, not rAF - rAF stalls in occluded windows).
- **Adoption**: proposalActions Delete-draft + Mark-as-paid run through confirmDialog
  (Void/Decline keep their richer dialogs); the shared `busy` there became a per-action
  `pendingKey` so exactly the clicked button spins (delete / generate-pdf /
  regenerate-pdf / mark-paid / revise / void). teamSettings: panel-wide `busy` ->
  per-row `busyKey` (`user:role`, `user:active`, `add`) - one row locking no longer
  freezes the whole team card. partyList: per-action keys (`party:copy`,
  `party:remind`). sendForm ("Sending..."), proposalForm ("Saving..."),
  signatureSettings ("Saving..."), retryJobButton ("Retrying...") all drop label-swap
  for `loading` with stable labels. sign-in: new `SignInButton` client island wires
  `useFormStatus` so the Google button shows the redirect as pending (Phase 3's
  sign-in item, done early since the prop landed).
- Signing files untouched (signingExperience's two pending buttons wait for a
  rehearsal-gated wave).

Verified: 306/306 vitest + clean build. Chrome walk on a fresh e2eSeed [TEST] draft:
Delete -> ConfirmDialog (danger chip, footer band) -> confirm -> spinner path ->
"Draft deleted" toast -> dashboard, seeded row gone (cleaned itself up). Prod is back
to exactly the two original [TEST] rows; the VIEWED phone-walk row was never touched.
CSS probe confirmed the data-loading rule compiles (spinner shows, sibling icon hides).

## 2026-08-09 15:52 PT - Phase 2 wave 4: primitives adoption (table, tabs, select, tooltip, DialogFooter)

Session resumed from the 03:19 snapshot. Action-item scan on resume: BOTH [TEST] rows
still in prod (phone walk + e2eCleanup pending), Stripe CLI still logged out (no
config.toml at all), Vercel CLI still 54.14.0 - all six items remain open.

Wave 4 built on `ui/consistency-pass`, **unmerged, pending Rahul's checkpoint** - the
plan's Phase 2 item 3, all five zero-importer primitives now adopted:

- **proposals list -> ui/table** (`proposalsPanel.tsx`): the hand-rolled desktop div
  grid is now a real `<table>` (thead/th/tbody semantics) inside the same lg Card -
  fr ratios became fixed-layout % widths, CardLabel headers kept, border-border-subtle
  + hover:bg-surface + the row-overlay Link preserved (`relative` on `<tr>` verified
  clickable in Chrome). Mobile card list untouched.
- **dashboard filter -> ui/tabs** (Base UI): arrow-key roving focus + Enter/Space
  activation (manual-activation ARIA tabs pattern), focus ring, aria-selected - the
  wave-1 pill look preserved via className overrides (twMerge); counts moved onto
  `Badge` (secondary, accent/primary when active). The primitive's `transition-all`
  is overridden with the named property list locally; the ui/tabs file itself gets
  cleaned in the hygiene wave.
- **native selects -> ui/select** (both sites): Settings team Role
  (`teamSettings.tsx`) and pricing "Every" interval (`proposalForm.tsx`, numeric
  1|3|12 values via Base UI `items` prop so the trigger shows Month/Quarter/Year).
  Bonus fix: the raw selects were h-9 next to h-8 Inputs - the primitive's h-8
  default kills that misalignment.
- **icon buttons**: send-form Remove-signer gets `aria-label` + `ui/tooltip`;
  appShell's avatar menu trigger gets `aria-label="Account"` (no tooltip on
  click-to-open menus). TooltipProvider now mounts in AppShell; the provider default
  delay 0 -> 600ms (first open waits, adjacent tooltips within the timeout open
  instantly - both verified). copyableCode already had aria-label (docs surface,
  Phase 3). Only other icon-only controls live in signing files - out of this wave.
- **DialogFooter**: the Void dialog's hand-rolled action row -> the banded footer
  primitive. signatureModal is a signing file - deferred to a rehearsal-gated wave.

Verified: 306/306 vitest + clean `npm run build` + Chrome walk at 1280 and 570 (the
extension's viewport floor; 390 not reachable) - tabs click/keyboard, table row click
-> detail, both select popups, tooltip delay/instant-subsequent/anchoring, Void dialog
opened + cancelled (never confirmed), mobile card list intact. Housekeeping in the same
push: `components.json` shadcn registry list committed (was sitting uncommitted from
the /ui stack), react-bits MCP logs (`mcp-server*.log`) gitignored.

## 2026-08-09 03:19 PT - STATUS SNAPSHOT: session wrap, everything merged + deployed

Rahul's instruction: merge and deploy all work to date, log status + his action items.
The signing-surface wave (below, rehearsal PASSED) merges to `main` with this entry.

**Shipped to prod this session (2026-08-09, overnight):**
1. Phase 2 wave 1 - dashboard onto Card/CardLabel (metrics + proposalsPanel).
2. Phase 2 wave 2 - THE status tone scale (statusChip exports; timeline/outcome/
   systemHealth consume; sparklines on chart tokens; EXPIRED/VIEWED/VOIDED/PROCESSING
   contradictions resolved; SESSION_EXPIRED enum leak dead).
3. Phase 2 wave 3 - all 12 hand-rolled `rounded-lg border p-3` recipes onto Card;
   outcomeCard shell raised.
4. Executed-PDF review (fix shipped: certificate no longer prints the signature font
   name) + client-facing copy pass on voice DNA (3 email tightenings, em dash fix;
   ESIGN consent untouched).
5. Signing-surface wave - proposalView interiors + eyebrows onto Card/CardLabel, action
   bar floating; e2e rehearsal passed end to end (sign -> Stripe test pay -> executed
   PDF with matching content hash).

**RAHUL'S ACTION ITEMS (manual, in rough priority order):**
1. **Real-phone walk of your pending [TEST] rehearsal row** (the VIEWED one, valid
   Sep 8, 3 x $1 tiers). Reminder: prod checkout = LIVE Stripe = a real $1 charge.
2. **After that walk: `npx tsx scripts/e2eCleanup.ts`** - deletes BOTH [TEST] rows
   (yours + tonight's SIGNED/AWAITING rehearsal row) plus their blobs. Until then,
   tonight's row will sit in Settings -> System "Signed but unpaid" - known, ignore.
3. **`stripe login`** (interactive browser auth) - the CLI's device auth expired
   tonight; needed for any future local webhook rehearsal. ~1 minute.
4. **Four PDF decisions** (from the 02:50 review): (a) add "Page N of M" page numbers?
   (needs an investigation first - the standard react-pdf technique is the exact
   render-callback-in-fixed pattern that corrupted long documents before); (b) let the
   Notes flow after Acceptance instead of a near-empty page; (c) move footnote anchors
   off section headings; (d) footer says "Proposal & Service Agreement" while the MSA
   titles itself "Master Services Agreement". Say yes/no per item whenever.
5. **Visual checkpoint at your leisure** (everything is live): dashboard, proposal
   form boxes, Settings -> System, a signing link, an outcome page. States not yet seen
   with real data: the amber attention banner, warn Oldest-open tile, danger/warning
   timeline tones (bounced/declined/expired events).
6. Optional: `npm i -g vercel@latest` (CLI 54.14.0 -> 58.x, nagged by tooling).

**REMAINING WORK (in planned order - docs/plans/ui-consistency-pass.md):**
- Phase 2 rest: (1) primitives adoption (proposals table -> ui/table, dashboard filter
  -> ui/tabs, native selects -> ui/select, tooltips on icon buttons, DialogFooter);
  (2) ConfirmDialog replacing brandConfirm + Button `loading` everywhere;
  (3) type/color hygiene (headings, arbitrary px, transition-all, #00C2FF, rings);
  (4) dashboard motion + skeletons.
- Phase 3: /docs completeness audit (Rahul's 08-08 item), one-off sweep, guardrails
  (conventions table + CLAUDE.md UI section), full visual regression + reduced-motion +
  a11y pass.
- PDF page numbers etc. per Rahul's decisions above.

## 2026-08-09 03:13 PT - Signing-surface Card wave + full e2e rehearsal (sign -> pay)

Waves 3 + PDF/copy merged and deployed on Rahul's go. This wave (committed on
`ui/consistency-pass`, **unmerged, pending his checkpoint**) finishes the Card adoption
chain on the signing surface - presentation only, ceremony logic untouched:

- **proposalView**: pricing rows + later-phase rows (dashed) + at-a-glance table wrapper
  + deposit-schedule banner (tone=accent - the tone map IS the old recipe) + signature
  slots (active ring preserved via className) → Card outlined; the five hand-rolled
  eyebrows (Pricing / Optional add-ons / Later phases / Payment schedule / Notes) →
  CardLabel; document shell + sign-here button `bg-white` → `bg-card`. Tier cards and
  add-on rows stay real buttons/labels - they already carry the exact classes Card's
  `selected` state was extracted from; swapping them for divs would trade a11y for API
  purity.
- **signingExperience**: the action bar div → `Card variant="floating" size="lg"` (the
  floating variant was literally defined from this element's shadow recipe).

**E2E rehearsal (the plan's gate for signing-file changes), fresh [TEST] seed:**
e2eSeed → e2eSend → Chrome walk: adopt (typed, ESIGN consent) → stamp Acceptance →
stamp MSA execution → Finish & continue to payment → Stripe TEST checkout (Sandbox
badge, correct line items $997 + $497/mo) → paid via Link sandbox (code 000000, test
card 4242) → `/paid?session_id=` safety net rendered "You're all set" on the new raised
Card. e2eVerify: consent + both stamp timestamps recorded, ALL_SIGNED, executed PDF
isFinal with **SHA-256 == send-time content hash**, fully_signed client+admin emails
DELIVERED, GENERATE_PDF + NOTION_SYNC jobs DONE attempts=1. The real-pipeline
certificate shows the fixed "Typed electronic signature" (no font-name leak). Notes:
(1) `paymentStatus` stays AWAITING locally by design - Stripe CLI device auth was gone,
so no valid webhook listener; the webhook leg is untouched by this wave and was
live-verified 2026-06-19. (2) Chrome walk detour: a password-manager extension's popup
poisoned the first checkout tab (every CDP action erred "Cannot access a
chrome-extension:// URL"); recovered by closing the tab and reopening via
`/pay/<token>`, which correctly REUSED the same open session (RSL-7 idempotency
observed working).

**Two [TEST] rows now sit in prod:** Rahul's earlier VIEWED one (his pending real-phone
walk) + this wave's SIGNED/AWAITING one. e2eCleanup removes BOTH by title - run it only
after his phone walk. Verified: 306/306 vitest + clean build before the walk.

## 2026-08-09 02:50 PT - Executed-PDF review + client-facing copy pass (Rahul's 2 items)

Order picked per Rahul's "your call": these two before the signing-surface Card wave, so
copy + Card changes to the signing screens share one e2e rehearsal later.

**PDF review (all 20 pages of `pdfSmoke.pdf` read visually).** Verdict: healthy - the
proposal pages have full web parity (tier cards, Recommended badge, strikethrough promos,
payment schedule callout), the MSA sets cleanly, and the certificate carries the SHA-256
fingerprint + ESIGN/ESRA/UETA line. One real bug FIXED: the certificate's typed-signature
method line leaked the signature FONT name into the legal artifact ("Typed electronic
signature (Caveat)" - a client reads "caveat" as a warning). `generatePdf.ts` now emits
"Typed electronic signature"; the pdfSmoke fixture carried the same hardcoded string and
was aligned (that's why the first re-render still showed it). pdfSmoke re-run + visual
Read of p20 green. **Open PDF decisions for Rahul (not done, his call):**
(1) no page numbers anywhere - "Page N of M" is standard for a 20-page executed
agreement, but react-pdf's page-number technique is exactly the render-callback-in-fixed
pattern CLAUDE.md bans (it corrupted long documents before), so it needs its own careful
investigation; (2) the Notes page sits ~85% empty on its own page - could flow after
Acceptance instead; (3) footnote superscripts attach to section headings ("Our Track
Record¹"); (4) footer reads "Proposal & Service Agreement" while the document titles
itself "Master Services Agreement" - naming nit, legal-adjacent so untouched.

**Copy pass (voice DNA loaded via /brand).** Honest verdict: the client-facing surfaces
were already written in the target register (Phase 0/1 work) - short sentences, no
corporate speak, human framing ("No hard feelings", "nothing you did was lost", "which
was the hard part"). What changed: three email tightenings (reminder drops "from our
side"; the fully-signed no-link payment paragraph un-hedged into short sentences; payment
receipt leads with "Work begins right away"); the one em dash in client copy
(`pay/[token]/error.tsx`) split into two sentences per the no-dash rule. Verified
conforming, no changes needed: all 15 subjects follow the locked `[Status] ...`
convention, signing toasts/ceremony labels (feel-tested with Rahul in Phase 1), outcome
pages incl. the shared `outcomeCopy.ts`, root 404/error, email footer. ESIGN consent
language deliberately untouched (legally load-bearing). Previews re-rendered (14).

Verified: 306/306 vitest, clean build, pdfSmoke + certificate page visual read.
Committed on `ui/consistency-pass` (waves 3 + this one pending a combined checkpoint).

## 2026-08-09 02:36 PT - Phase 2 wave 3: the 12 hand-rolled card recipes onto Card

Wave 2 merged + deployed on Rahul's go (READY in 44s). Two new work items from him
tracked in ROADMAP + the plan: **executed-PDF review** and **client-facing copy pass**
(14 emails, signing toasts/guidance, outcome/error pages - voice DNA applies).

Wave 3 built on `ui/consistency-pass`, **unmerged, pending his checkpoint**: every
`rounded-lg border border-border p-3` recipe is now `<Card variant="outlined" size="sm">`
with padding driven by `px-(--card-spacing)` - the audit counted 11; a 12th surfaced
(future-items box, same recipe with `border-dashed`, grep missed the word order) and
uses the Card API's `dashed` prop:

- `proposalForm.tsx` (7): case studies, flat one-time, flat recurring, tier boxes
  (`space-y-3` → the sm Card's own gap-3), manual-invoice, add-ons, future items
  (dashed).
- `sendForm.tsx` (1): signer rows (grid layout preserved - `grid` overrides the Card's
  flex via twMerge).
- `systemHealth.tsx` (4): dead jobs, stuck payments (Link now wraps the Card;
  hover:border-primary/50 kept with a real transition-colors), email bounces, cron runs.
- `outcomeCard.tsx` shell: `document-page + rounded-2xl + border + bg-card + p-6` →
  `<Card variant="raised" size="lg">` (the raised variant IS the document-page shadow;
  `.document-page` class stays for the signing document itself).

Deliberately deferred to the next wave: `proposalView` interiors + the signing action
bar (floating) - those are signing files, so that wave runs the e2e rehearsal before
merging per plan risk rules.

Verified: 306/306 vitest, clean build, Chrome pass (new-proposal form pricing boxes,
settings System rows, /sign/bad-token outcome shell - all render identically).

## 2026-08-09 02:26 PT - Phase 2 wave 2: status system unified (one tone scale)

Wave 1 merged + auto-deployed on Rahul's go (deploy `j1aatx95v` READY in 37s - auto-deploy
verified per his ask). Wave 2 built on `ui/consistency-pass`, **unmerged, pending his
checkpoint**:

- **`statusChip.tsx` now exports THE status scale**: `StatusTone`
  (neutral/brand/info/engaged/success/warning/danger) with `chip` + `icon` class flavors,
  plus `PROPOSAL_STATUS_META` / `PAYMENT_STATUS_META` (label + tone per enum value).
  success/warning/danger ride the theme tokens; blue (info) and violet (engaged) are
  sanctioned raw hues defined only there. Semantic fixes: EXPIRED + SESSION_EXPIRED →
  warning (orange dies), VIEWED → engaged violet (was indigo, contradicting the violet
  timeline), VOIDED → neutral (was gray chip / rose timeline), PROCESSING → info (was
  sky chip / amber timeline). PAID keeps the one solid chip (`solid` flag).
- **`auditTimeline.tsx`**: local 8-hue TONE_STYLE deleted; EVENT_META tones are now
  StatusTones (24 raw palette classes gone; slate/cyan/indigo/orange retired - icons
  carry event identity, tone carries meaning: info = mechanics, engaged = client
  touches, success = milestones, warning = expiry/reminders, danger = failures,
  neutral = records incl. VOIDED).
- **`outcomeCard.tsx`**: toneStyles → the scale's `icon` flavor via a TONE_MAP
  (public OutcomeTone API unchanged; `info` → `brand` = accent/primary); icon circle
  gains the timeline's ring-1; `bg-white` → `bg-card`.
- **`systemHealth.tsx`**: the raw `SESSION_EXPIRED` enum leak is dead - "Signed but
  unpaid" rows render `<PaymentChip>` (real labels, real tones: FAILED red, PROCESSING
  blue, not blanket amber); cron ok/failed badges consume the scale.
- **`sparkline.tsx`**: hex ramps → `var(--chart-1)`/`var(--chart-3)` at rising
  fillOpacity (0.28/0.5/1); line default → `var(--chart-1)`. No raw chart hexes left.

Verified: 306/306 vitest, clean build, Chrome pass - dashboard chips (Viewed violet,
solid Paid), Charette audit trail (full ceremony reads: blue mechanics / violet views /
green milestones / neutral records; Checkout-created now info not amber), settings
System panel (ok badges on success tokens), /sign/bad-token OutcomeCard (neutral +
ring). Not exercised live: danger/warning timeline events (no bounced/declined/expired
rows). Also observed: the daily cron pruned 295 CronLog rows - the 30-day purge from
the 08-08 Disk-IO fix is confirmed working in prod.

Next per plan: remaining Card adoption (11× `rounded-lg border p-3` recipe,
proposalView interiors, outcomeCard raised variant, action bar floating).

## 2026-08-09 02:06 PT - Phase 2 wave 1: dashboard migrated onto Card/CardLabel

First Phase 2 wave on `ui/consistency-pass` (plan: `docs/plans/ui-consistency-pass.md`),
building on the committed Card variant API: `dashboard/metrics.tsx` +
`dashboard/proposalsPanel.tsx` no longer hand-roll a single surface.

- **metrics.tsx**: the local `CARD` recipe and the private `CardLabel` clone (10.5px /
  0.08em - the "self-contradiction" with the canonical 11px/tracking-widest) are gone.
  Every tile is `Card size="lg" hoverable` + one `CardContent`; the warn state of
  OldestOpen is `tone="warning"`. Raw ambers/emeralds/roses moved to the
  warning/success/destructive token families; the hero gradient's `#F4F8FF` stop is now
  `var(--accent)`; `rounded-[10px]`, `text-[40px]`, and the redundant arbitrary trackings
  (font-heading already bakes -0.02em) retired; quarter-step spacing snapped to the scale
  (internal rhythm converges on mt-3).
- **proposalsPanel.tsx**: attention banner → `Card tone="warning"` (kills
  `rounded-[14px]`; dot is `bg-warning ring-warning/20`); desktop table + empty state →
  `Card size="lg"` with cell padding driven by the card's own `px-(--card-spacing)`;
  header cells → shared `CardLabel`; mobile rows → `Card` inside the Link (press scale
  stays on the Link - `:active` doesn't propagate down); the five bespoke grays
  (#EEF1F6/#FCFCFD/#E9EDF3/#F4F6F9/#F4F8FF) → `border-subtle`/`surface-raised`/accent;
  filter pill track `rounded-[11px]` → `rounded-xl` + `bg-border-subtle`, active pill
  `bg-white` → `bg-card`, bespoke shadow → `shadow-sm`, easing → `ease-out-strong`
  (full Tabs conversion stays in Phase 2 step 3).
- Verified: 306/306 vitest + clean `next build`; Chrome visual pass at 1280 and mobile
  width (macOS Chrome min-window floors the viewport at ~570px - still the sub-`md`
  layout; real 390 comes with Rahul's phone walk) - hero/KPI/table/mobile cards/empty
  state all checked. Not exercised (no attention rows in DB): the warning banner and warn
  OldestOpen - same committed tone map, eyeball at the checkpoint.

**Pending Rahul's visual checkpoint; merge on his go.** Next per plan: status-system
unification (statusChip exports the scale; systemHealth enum leak; sparkline → chart
tokens).

Phase 1 wave 2, iterated live with Rahul on localhost (fresh $1 rehearsal, mobile
emulation): the signature modal is a **bottom sheet below `sm`** via an opt-in
`presentation="sheet"` mode on `DialogContent` (slide-up 320ms/200ms, grabber bar,
safe-area padding, 85dvh cap; centered dialog unchanged from `sm` up and for all other
dialogs). Two fixes from his walk: (1) the sheet itself no longer scrolls - content
scrolls in an inner wrapper so the close X + grabber stay pinned; (2) the mobile bar line
is an explicit `Step N of 3` readout (`mobileStatus`) - the desktop statusLine's "Valid
until ..." opener truncated into a date note at phone widths and read as nothing. Also:
the three action-bar CTA states fade in on swap. Rahul approved both on retest; merged to
`main` on his go (this entry ships in that merge). Phase 2 (admin systematization) is next
per `docs/plans/ui-consistency-pass.md`.

## 2026-08-09 - Phase 1 feel-tested with Rahul end-to-end; tuned, merged, deployed

Rahul walked the full $1 rehearsal locally (sign -> Stripe test checkout -> /paid ->
executed PDF + receipt emails) and drove three tuning rounds on feel:
- **Motion softened globally:** page fade 150->400ms with a 6px rise, dialog enter
  180->240ms / exit 160ms, tier/add-on/slot/font-tile transitions 150->200ms, all on
  `--ease-out-strong` (now a `@theme` utility).
- **Draw<->Type finally natural:** the harshness was the modal resizing instantly between
  different-height panels - new `AnimatedHeight` wrapper in `signatureModal.tsx`
  (ResizeObserver + 300ms height glide) under the existing fade/slide.
- **No-tier attention, three iterations:** pulsing ring on the grid (too transient) ->
  persistent group frame (collided with card edges + Recommended badge, read as layered
  behind) -> **final: the tier cards themselves light amber** (`[data-attention] > button`
  border + soft glow, animated by the cards' own transitions), staying lit until
  `handleTierSelect` clears it. Toast (amber warning) + scroll + lit cards = one moment.
- Rehearsal tooling: `e2eSeed` draft re-priced to 3 x $1.00 one-time tiers via a temp
  script (deleted after use); `stripe listen` verified against the env webhook secret.
- Note: `AGENTS.md` mirror appeared this session (correct CLAUDE.md copy, H1 only diff) -
  kept, per workspace convention.

**Merged to `main` and auto-deployed** after Rahul's full-flow sign-off (this entry ships
in that merge). Wave 2 next: mobile bottom-sheet signature modal, action-bar label
transitions, mobile progress line, font-picker dedupe. A fresh $1 rehearsal gets re-sent
against prod for Rahul's real-phone walk (prod = LIVE Stripe - a completed pay is a real
$1 charge). Prior local [TEST] row purged via `e2eCleanup`.

## 2026-08-08 23:15 PT - Phase 0 merged + deployed; Phase 1 wave 1 (signing-flow polish) built

Phase 0 + the form follow-up ff-merged to `main` (`f4d2df1`) and auto-deployed; prod smoke
green (landing 200, branded 404 where `notFound()` fires - unknown paths still 307 to
sign-in via the auth middleware, pre-existing and correct). Note: cosmetic toast-severity
and inline-feedback line numbers cited in the plan have shifted with these edits.

**Phase 1 wave 1 (branch `ui/consistency-pass`, per `docs/plans/ui-consistency-pass.md`):**
- Dialogs (all four consumers incl. the signature modal): enter 180ms / exit 120ms on
  `--ease-out-strong` (was 100ms symmetric on CSS `ease` - read as flicker). The easing
  token is now a real Tailwind utility (`ease-out-strong`, registered in `@theme`).
- Press feedback + keyboard focus on every client-facing tappable that lacked both: tier
  cards, add-on rows (focus via `has-[:focus-visible]`), the dashed signature slots, and
  the modal font tiles - `active:scale`, named transition properties, `focus-visible`
  rings.
- Floating "next field" chip no longer pops: stays mounted through the adopted phase,
  slides/fades in and out (200ms ease-out-strong), keeps its last label while exiting,
  and sits above the iOS home indicator (`env(safe-area-inset-bottom)`; root layout now
  exports `viewport-fit=cover`). Action bar got the same safe-area padding.
- Submit buttons show a real Spinner ("Submitting…", "Applying signature…").
- Signing page is a `<main>` (semantic + picks up the global entry fade admin always had).
- Toast severity now means something: guidance ("Select a plan", "Draw your signature
  first", invalid/failed import JSON, pricing-gate) moved error->warning (amber, the
  previously-unused tone); genuine failures stay red. `brandToast` cards announce via
  `role="status"` + `aria-live`.
- Pricing-gate toast now also scrolls to the first `[data-pricing-issue]` advisory
  (they could sit below the fold; matches the signing page's tier-scroll pattern).
- Tab panels (all Tabs consumers, incl. Draw<->Type in the modal) fade in 150ms instead
  of hard-cutting.

Verified: 306/306 vitest + full `next build` type-check. STILL OPEN in Phase 1: mobile
bottom-sheet presentation for the signature modal, action-bar label transitions between
the three CTA states, a mobile-visible progress line, font-picker tile dedupe
(signatureSettings = signatureModal), signing shell consolidation into `sign/layout.tsx`.

## 2026-08-08 22:45 PT - UI consistency audit + plan; Phase 0 built on `ui/consistency-pass`

Rahul flagged inconsistent UI (toasts, cards, et al) + proposal-form fields clipping long
text. Ran a six-dimension parallel code audit (feedback/toasts, cards, buttons/forms,
overlays/async states, tokens/typography/dark-mode, motion). Verdict: strong foundations
(zero raw-sonner bypasses, Base UI primitives, token-exact PDF/emails) undermined by three
drift engines - unadopted primitives (32 hand-rolled card recipes, div-grid proposals
table, dead `select`/`tooltip`/`DialogFooter`), broken status tokens (`--destructive
#FF6B6B` 2.8:1 and `--success #10B981` 2.6:1 fail WCAG as text, so 4 greens + 3 reds ship;
EXPIRED renders orange/rose/amber by surface), and unsystematized async states (zero
loading/error/not-found files, zero spinners, toast severity flattened). Full findings +
target system + 4 phases: `docs/plans/ui-consistency-pass.md`. Decisions locked with Rahul:
client signing flow first, full systematization, light-only, phased merges he gates.

**Phase 0 built (branch `ui/consistency-pass`, pending Rahul's visual review + merge):**
- Tokens: `--destructive` -> #DC2626, `--success` -> #059669, added
  `-subtle`/`-subtle-foreground` pairs (danger/success/warning) + `--surface-raised` +
  `--border-subtle`; deleted `--danger` dup, 8 dead sidebar tokens, dead gradient/scrollbar
  utilities; `--ease-out-strong` consolidated into `:root`; `main` fadeIn gets
  reduced-motion opt-out.
- Killed the OS-theme toast leak (`ui/sonner.tsx` forced light; macOS-dark users were
  getting dark toasts); Toaster mount de-lied (`richColors bottom-right` -> real
  `top-center`); uninstalled `next-themes`; stripped all 17 dead `dark:` variants + the
  `dark` custom-variant (light-only is now explicit).
- Route states: branded root `not-found`/`error`/`global-error`, `(admin)` loading +
  error (in-shell), `sign/[token]` + `pay/[token]` loading + error (OutcomeCard-styled,
  SUPPORT_EMAIL only) - clients no longer see Next's raw crash screen on the money path.
- `RetryJobButton` (settings/): the two fire-and-forget Retry forms (proposal detail,
  system health) now show pending + success/error toasts; `retryJob` revalidates
  `/settings` instead of the redirect-stub `/health`.
- `partyList`: DRAFT proposals get a real empty state (was a bare bordered box); clipboard
  failure on Copy-link now toasts instead of silently stranding a rotated token.
- Signing scroll honors `prefers-reduced-motion` (JS `scrollIntoView` was bypassing the
  CSS gate).
- **Form fields (Rahul's report):** new `ui/growing-input.tsx` - single-line semantics
  (Enter blocked, pasted newlines collapse) on the auto-growing Textarea
  (`field-sizing-content`), so long values wrap instead of clipping. Applied to proposal
  title, at-a-glance summaries, problem/solution titles, pricing label/shown-to-client/
  discount reason, tier name, future-item starts note, case-study URL.

Verified: 306/306 vitest, `next build` clean, dev smoke (branded 404 renders, landing +
sign-in 200). No PDF changes. Next: Phase 1 (client signing flow polish) after merge.

**Same-session follow-up (Rahul's form feedback, 23:00 PT):** title-class fields
(proposal/problem/solution titles, at-a-glance summaries) now span the full form width and
auto-expand; token text fields show live counters (`FieldCounter`: chars, + words on
paragraph fields, `N / 200` where validation enforces a cap - title + Stripe line label,
which also get native `maxLength`; imported over-limit values flag red). Pasting a tokens
JSON into the import box now fills the form instantly (onPaste parse; invalid JSON pastes
normally) and auto-scrolls to the first proposal card (`data-import-scroll-target`,
reduced-motion aware via new shared `src/lib/reducedMotion.ts`, which signingExperience
now also uses). Merge still pending Rahul's review.

Supabase warned that the shared free-tier Nano project (`bjqouysamajtmghyztoa`, also hosts
expenseVault) is depleting its Disk IO Budget. Diagnosis (pg_stat_statements/pg_stat_io): the
biggest app-side writer was **this app's `process-jobs` cron logging a `CronLog` row every
5 minutes, 24/7** - 9.7k rows, ~98 MB of WAL, since each tiny INSERT lands right after a
5-min checkpoint and forces full-page writes. Reads were a non-issue (15 MB DB, 100% cache hit).

Fix: `src/lib/cronLogPolicy.ts` (`shouldWriteCronLog`, pure + vitest'd) - failures and runs
that did work always log; quiet runs collapse to **one heartbeat row per day**; the first
success after a failure always logs so the health panel shows recovery. `logCronRun` gained
`opts.noop`; process-jobs passes `ran===0 && failed===0`, reconcile-payments passes
`stuck.length===0`, daily always logs. The daily cron now also **prunes CronLog rows older
than 30 days** (audit tables - AuditEvent/EmailLog/WebhookEvent - deliberately untouched).
`systemHealth.tsx` reaches `take: 30` deep so uneven per-path volume can't crowd a cron out
of the panel. Expected: ~288 CronLog writes/day → ~10. Polling itself stays at */5 (claim/reap
UPDATEs that match 0 rows write no WAL - the ticks are nearly free once the INSERT is gone).

**Deployed + verified same day:** commit `34f3487` → `dpl_3wH6gLvYhs3mL3r6s8K4fwayfr9r` READY
on proposals.rsla.io (22:33 UTC). Post-deploy, three cron ticks (22:35/22:40/22:45) returned
200 in Vercel logs while the CronLog row count stayed frozen at 9,754 and zero failure rows
appeared - quiet runs suppressed exactly as designed. First 30-day purge lands at the next
13:00 UTC daily run.

Remaining levers live outside this repo: free-plan Nano baseline churn (~25 WAL write ops/sec
at idle) is Supabase platform behavior - Rahul chose to stay on the free plan for now, so the
watch item is the dashboard's Disk IO Budget chart over the next days. Full investigation
logged in expenseVault's LOG.md (2026-07-15).

## 2026-07-11 - scripts/exportDraftPdf.ts: unsigned "bare doc" export for any proposal

New utility (pdfSmoke pattern): renders a proposal's CURRENT document (frozen content if present, else live tokens) through the real `ProposalPdf` with `signers: []` and an empty certificate, so signature cards come out blank ("Date: ____"). The unconditional trailing E-Signature Certificate page must be stripped downstream (pypdf: drop last page; assert it contains "E-Signature Certificate" first). Built for Select Landscape (email attachment before send).

Run: `npx tsx scripts/exportDraftPdf.ts <proposalId> <outPath>`. Gotcha: the local `.env` `DATABASE_URL` uses the Supabase DIRECT host, which is IPv6 only and unreachable from IPv4 networks (P1001). Override with the session pooler: `postgresql://postgres.bjqouysamajtmghyztoa:<pw>@aws-1-us-west-1.pooler.supabase.com:5432/postgres` (aws-1, not aws-0; see BRAIN.md).

## 2026-06-24 - Competitive teardown: Cited Co proposal platform (research, no app changes)

Captured a live Cited Co client proposal (`clients.citedco.ai/proposal/1f19369a4b22873142e187bd`)
and saved a full teardown + the raw served code under `docs/competitiveResearch/citedCo/`.
Findings: their whole agency (marketing site, SEO blog, proposals, contracts/e-sign, intake,
client portal + AI-visibility product) runs as one **Lovable**-built React/Vite SPA on
**Supabase** (6 public edge functions), sourced from **Airtable**, billed via **QuickBooks**
(no Stripe), deployed on Cloudflare. Same core concept as ours (structured JSON of copy +
pricing with `{{merge}}` tokens, rendered on a custom domain, homegrown e-sign), but their
public `proposals-public` function leaks lead PII + the raw `contract_sign_token` (validates
our hashed-token/rotation design by contrast). Worth borrowing: the live-metrics case-study
block and single-tier pricing layout. No code in this repo changed. Saved artifacts: pretty
`proposalData.json`, the 1.99 MB app bundle, CSS, Lovable analytics scripts, og + hero images.

## 2026-06-22 - Backlog RSL-36..39 fixed + deployed (Sid's Jun-19 new-feature audit leftovers)

Sid filed four more issues 2026-06-22 from his Jun-19 new-feature audit (discounts / manual-invoice /
LastName-optional) - "confirmed but never filed" in that pass, all Backlog, net-new beyond the closed
RSL-6..35 waves. Found by re-listing the team (the standing "re-check before declaring all clear" pattern).
Planned, then executed subagent-driven (fresh implementer + spec/quality review per issue, whole-branch
review, one fix-wave). Plan: [`docs/plans/backlogRsl36-39.md`](docs/plans/backlogRsl36-39.md). Branch
`audit/backlog-rsl-36-39`, ff-merged to `main`, deployed.

- **RSL-36 (Medium)** - capped charged-line labels + `Client.ProposalTitle` with Zod `.max()`
  (`MAX_LINE_LABEL_CHARS`/`MAX_PROPOSAL_TITLE_CHARS` = 200), enforced at save AND send (the schemas
  `proposals.ts` parses), with a humanized error instead of a mid-checkout Stripe throw; backstop in
  `buildLineItems` (RSL-30 pattern). Commit `2e31c07`.
- **RSL-38 (Low)** - `handleSave` now blocks client-side on any priced-line advisory (display/charged
  mismatch, discount >= price, blank reason) via a new pure `moneyDraft.ts` (single source shared with
  `MoneyFields`); inline blank-reason warning added; net-positive invariant made explicit in
  `paymentConfigSchema.superRefine` + pinned by a test. Commit `35462cd`.
- **RSL-39 (Low, latent)** - `frozenTokens` validates-on-read (coerces every token key to a trimmed
  string, RSL-21 spirit) so a legacy/hand-edited snapshot missing `Client.LastName` can't 500 the signing
  render / PDF job; defensive coercion also at `clientFullName` + the two `proposalContent.ts` trim sites.
  pdfSmoke confirmed. Commit `d0b14e8`.
- **RSL-37 (Low)** - kept the two import discount dialects distinct by design (human authoring keys =
  list-minus vs the internal config dump = already-net; unifying would break the round-trip). Instead the
  post-import toast lists each resolved "was X, now Y (reason)" via `summarizeImportedDiscounts`, and
  `/docs` documents both shapes. Commit `1801ce1`.

**The process caught a real bug.** The integrated `npm run build` gate found a type error all four per-task
reviews + vitest missed (vitest does not type-check): RSL-37's toast assembly put draft-typed
`inferredTiers`/`inferredAddOns` into a `PaymentConfig`. The fix-wave (`cc4cb7a`) routed the summary through
the canonical `stateToConfig` (which also made tier/add-on discounts actually summarize), plus **N1**: the
RSL-36 backstop now guards Stripe's real 250-char product-name limit on the effective (deposit-wrapped) label
via `STRIPE_MAX_PRODUCT_NAME_CHARS`, while the schema keeps the 200-char source cap - closing a narrow band
(~186-200 char label + deposit) that saved fine but could still throw at the client's checkout. Whole-branch
review (opus) + fix re-review both Approved, 0 Critical / 0 Important. **Lesson:** every task's verification
must include `npm run build` (tsc), not just `vitest` - vitest strips types without checking.

**Verified (integrated, controller-run):** `npm run build` PASS, `npm test` 299/299, `eslint src` 0 errors,
`pdfSmoke` 3/3. No schema migration. Nothing changed what a client is charged or shown - caps reject at
authoring, the discount gate is client-side UX, the invariant is explicit-but-redundant, and the import-toast
and `frozenTokens` reads are read-only.

**Status:** SHIPPED - `main` ff `5ea4d0f..cc4cb7a` (6 commits: plan doc + RSL-36/38/39/37 + fix-wave), pushed
to origin; Vercel git deploy auto-triggered; prod smoke green (landing 200 / dashboard 307 / unauthed
`/api/.../pdf` 401). Linear **RSL-36..39 moved to Done** with resolution comments. Branch kept as the record.
Deferred cosmetic minors (signOnly gate not explicitly scoped - no regression/no charge impact; a tier/add-on
test using `[0]` vs `.some()`; constant ordering) - none ship-blocking.

## 2026-06-21 - Docs sync: manual-invoice + discounts + the "tokens fill blanks" model

Brought every doc surface up to date with the two recent features (manual-invoice mode, per-line
discounts) and documented the placeholder model Rahul flagged. No code changes - docs only.

- **In-app `/docs` page** (`src/app/(admin)/docs/page.tsx`): added a "What the tokens fill (and what
  they don't)" section up top (template is fixed; greeting/contact/sign-off/headings/MSA are
  hard-coded; `ProblemText`/`SolutionText` are body paragraphs only); added a **Manual invoice**
  pricing block (`manualInvoice: true`, distinct from sign-only) with an example; added a **discount**
  code example to the existing discount section; folded discounts + manualInvoice into the pricing
  intro's "optional fields" list. Lint + `tsc --noEmit` clean.
- **Skill `references/platformImportSchema.md`**: mirrored the above - new "What the tokens fill"
  section, **Discounts** and **Manual invoice** subsections under the stack-on blocks, payment-landing
  note in the pricing intro, and discount/manual rules in the enforced-at-send list.
- **Skill `SKILL.md`**: Phase-1 pricing decision now asks shape + how-payment-lands + discounts;
  Phase-2 extras list gains `discount` and `manualInvoice`; new Critical Rule "tokens fill blanks, not
  scaffolding"; Required Inputs rows for collect-online-vs-manual and discounts; Phase-3 send step
  notes the checkout skip for manual-invoice/sign-only.
- **BRAIN.md**: noted `manualInvoice` is importable via the top-level key (not just the form toggle),
  and added a "Proposal template (tokens fill blanks)" reference note pointing at `proposalContent.ts`.
- Verified from source: `manualInvoice` flows on import via `proposalForm.handleImport` (top-level
  `rawObj.manualInvoice`, flat or tiered); `importDiscount` accepts `amount` as a `$`-string or
  `amountCents` int + a required `reason`, must be < line price. "Send email or no email" = the
  manual-invoice (no-checkout, no payment email) path vs the default Stripe flow.
- **Shipped:** proposalGenerator commit `5ea4d0f` pushed to `main` -> Vercel production deploy Ready,
  so `/docs` is live on proposals.rsla.io. Skill files committed locally as `eec3701` (they live in
  the umbrella `~/lalia`, which is local-only with no remote, so there's no push; the skill is already
  active via its `~/.claude/skills/` symlink).
- **Open for Rahul:** "send email or no email" was documented as the manual-invoice mode (no checkout,
  no payment email). If he instead meant a separate "send the signing link without emailing the
  client" option, that does NOT exist today (`sendProposal` always emails every signer) and would be
  a build, not a doc fix.

## 2026-06-21 - Deleted two test proposals (+ all metadata/blobs) at Rahul's request

Cleaned two proposals off prod so they stop carrying dashboard metrics:

- **Fieldshare Marketing Retainer** (`cmqkncxl5…`, SIGNED/PAID). Was a test - client "Chris Kam" =
  Rahul's own `rahul.lalia23@gmail.com`, marked PAID via the new **manual-invoice** flow (no Stripe
  session/customer/Payment row, no Notion page), so nothing real to orphan. Removed its executed PDF
  + 2 signature PNGs, cascade row (parties/signatures/audit/emails/jobs), and 6 webhook events.
- **Valley Oak v1** (`cmqg642cx…`, DECLINED). Removed cascade row + 1 admin-sig blob + 4 webhook events.

**Kept Valley Oak v2** (`cmqhcsadf…`, VIEWED) - its `parentId` (→ v1) was explicitly nulled *before*
deleting v1 so the delete could never touch it (the self-relation has no explicit `onDelete`). Verified:
v2 survives, both targets gone, 0 blobs left for either id. DB now holds exactly 1 proposal (VO v2), so
contracted/MRR/win-rate recompute clean. No Stripe or Notion cleanup was needed (neither carried any).

## 2026-06-21 - Manual-invoice (no-checkout) pricing mode - DEPLOYED to prod

New pricing mode: a proposal can show its full pricing (amount + duration), sign normally, and **skip
Stripe checkout** - the owner invoices manually and later clicks **Mark as paid**. Decoupled "show a
price" from "charge a price" via one toggle, instead of bolting amounts onto the empty sign-only branch.

**Decisions (with Rahul):** full pricing model (toggle works on flat/tiered/recurring/add-ons); counts
as contracted/MRR immediately + a "Mark as paid" admin action; generic post-sign confirmation (no
payment link / invoice language); mark-as-paid is internal only (no client email).

**Shape:**
- `PaymentConfig.manualInvoice?: boolean` (back-compat optional) + helpers `isManualInvoice()` /
  `skipsCheckout()` in `types.ts`. New `PaymentStatus.MANUAL_INVOICE` (migration `0007`, already applied
  to the prod DB - additive `ALTER TYPE ... ADD VALUE`, harmless to live rows).
- Signing: last signer with a manual config sets `MANUAL_INVOICE` and never mints a Stripe session
  (`signingService.ts`). Pricing rendering + dashboard revenue math unchanged (revenue already counts on
  `status === SIGNED`).
- **No-payment-leak pass** (the careful part): `generatePdf` `paymentPending` excludes `MANUAL_INVOICE`
  so the `fully_signed_client` email stays link-free; sign-page `willCheckout` via `skipsCheckout`;
  `proposalContent` "How to Proceed" gets a generic, payment-free variant; `/pay` shows a benign
  "nothing to pay here" for `MANUAL_INVOICE`.
- Form: a "Don't collect payment - I'll invoice manually" checkbox in the Checkout card (flat/tiers),
  hides payment methods + deposit when on; import accepts top-level `manualInvoice: true`.
- Dashboard: `awaiting_invoice` attention reason ("N to invoice") + "Awaiting invoice" status chip.
  Admin send-summary + signed-admin email get manual-invoice copy.
- **Mark as paid** (`markPaidManually` action + button on the signed detail page): ADMIN-only,
  status-guarded + idempotent `MANUAL_INVOICE → PAID`, logs `PAYMENT_PAID {kind:"manual"}`, syncs Notion
  "paid" - **no** Stripe metadata, **no** receipt emails, **no** `Payment` row (that table is Stripe-only).

**Verified:** `npm run build` green; `npm test` 278/278 (added helper truth-table, validation floor-skip,
dashboard counting/attention tests); `pdfSmoke` + `emailPreview` clean; rendered a manual-invoice PDF and
visually confirmed the Investment section shows "$9,000 one-time / $2,000/month" and the How-to-Proceed
steps are payment-free.

**Live rehearsal DONE 2026-06-21 (prod, fake co "Brightline Test Co") - all green.** Seed → auth-less
send (`e2eSend`) → signed via the live `/api/sign` endpoint on `proposals.rsla.io`. Post-sign:
`paymentStatus=MANUAL_INVOICE`, **no Stripe session/customer, no Payment row**; `fully_signed_client`
+ `fully_signed_admin` DELIVERED (no payment link); executed PDF generated (real doc shows
"$9,000 / $2,000/month" + payment-free How-to-Proceed); deployed `/signed` is generic (no "Complete
payment") and
`/pay` returns HTTP 200 "nothing to pay" (no Stripe redirect); dashboard counted it ($9,000 + $2,000/mo)
under `awaiting_invoice`. Then **Mark as paid** (faithful `markPaidManually` body - same lib calls,
skipping only `requireAuth`/`revalidatePath`, exactly how `e2eSend` mirrors the send): idempotent
`MANUAL_INVOICE → PAID` (2nd call no-ops), exactly one `PAYMENT_PAID{kind:manual}`,
`NOTION_SYNCED{kind:paid}`, **no receipt email / no Stripe metadata / no Payment row**, `awaiting_invoice`
cleared, revenue still counted. Test row + blobs cleaned up; store clean; no real CRM row touched.

**Status:** DEPLOYED + live-verified - `main` ff `b864595..e73dd20`, Vercel `dpl_5ksv…` READY →
`proposals.rsla.io` (landing 200 / dashboard 307 / unauthed `/api/.../pdf` 401). Back-compat safe (the
new path only activates when the admin ticks the toggle).

## 2026-06-21 - Wrap: GEMINI.md synced to CLAUDE.md (git-linked drift) + blobSweep in Commands

Session wrap. The mobile pass (P0+P1) shipped and was **phone-verified 2026-06-21** (folded into the
entry below). Two doc-accuracy fixes at wrap:

- **GEMINI.md was out of sync with CLAUDE.md on deployment** - it still claimed "the Vercel project is
  NOT git-linked; push alone deploys nothing" and lacked the git-linked rule (the same stale footgun
  corrected in the Stripe runbook on 2026-06-19). Mirrored CLAUDE.md: added the "`main` is git-linked →
  pushing `main` auto-deploys" rule and fixed the Commands deploy line.
- Added `npx tsx scripts/blobSweep.ts` to the Commands block in both CLAUDE.md and GEMINI.md (the script
  was promoted to `scripts/` this session).

No other rule/scope changes. In-app AI generation + tool-driven deposit balance/retainer remain **parked**
per Rahul (captured in ROADMAP + the plan file); manual deposit collection stays.

## 2026-06-20 - Mobile pass SHIPPED (P0 + P1) + blobSweep promoted to scripts/

Executed the mobile plan ([`docs/plans/mobileInternalSurfaces.md`](docs/plans/mobileInternalSurfaces.md)),
P0 + P1, presentational Tailwind only (no logic/data/schema). 4 component files + 1 script:

- **P0** - form pricing grids (`proposalForm.tsx` MoneyFields + tier editor) `grid-cols-2` →
  `grid-cols-1 sm:grid-cols-12` (fields stack full-width on a phone instead of a 2-col staircase);
  detail **4-tab strip** (`proposals/[id]/page.tsx`) → mobile horizontal scroll (`overflow-x-auto`,
  triggers `flex-none`, restored to `flex-1` at `sm`).
- **P1** - form payment-methods row `gap-6` → `gap-3 md:gap-6`; detail documents row + settings
  add-teammate grid + the 3 system-health rows stack on mobile (`flex-col md:flex-row`).
- **Skipped as genuine non-issues:** deposit row (already `flex-wrap` + `flex-1` helper), party-actions
  and team-user-row buttons (already stack at `sm`; two small buttons fit), signature-pad `h-44` (shared
  with the phone-tested signing flow). No 44px tap-target / bigger-text overhaul (keeps the app's shipped
  compact density).
- **blobSweep promoted** `.tmp/` → `scripts/blobSweep.ts` - the documented DB-verified cleanup is now one
  command (`npx tsx scripts/blobSweep.ts` dry-run; `APPLY=1` to delete).

**Verified:** `npm run build` green + `eslint src` 0 errors (10 pre-existing test-file warnings only).
**Desktop (≥md) is provably unchanged** - every edit only adds mobile-first base classes overridden back
to the originals at `sm`/`md`. **Phone-verified 2026-06-21** - Rahul confirmed the form, a proposal detail, and settings look good on a
real phone (the headless gap was only that authed admin screens need a Google session, so they couldn't be
screenshotted locally at build time). P2 (sticky mobile save bar) deferred as optional.

## 2026-06-20 - Mobile pass: internal admin surfaces audited + planned (no code yet)

Audited the three still-open mobile surfaces (proposal form, detail/tabs, settings) via three
parallel reads and wrote a prioritized plan:
[`docs/plans/mobileInternalSurfaces.md`](docs/plans/mobileInternalSurfaces.md). Findings: the
proposal form is the only thing that genuinely looks broken on a phone - the pricing grids
(MoneyFields + tier editor) are `grid-cols-2` on mobile, jamming fields into a 2-col staircase
(fix = `grid-cols-1 sm:grid-cols-12`); the detail view is mostly fine except the 4-tab strip
compressing (fix = horizontal scroll); settings are minor (add-teammate grid + a few flex rows).
Two calls: skipped the signature-pad `h-44` flag (false positive - the same canvas the signing
flow already phone-tested) and deliberately NOT doing a 44px tap-target / bigger-text overhaul
(would diverge from the app's shipped compact density). Scope tiers: P0 (grid crushes + tab
strip) / P1 (collapsing rows) / P2 (optional sticky save bar). Presentational Tailwind only,
~6 files; awaiting a go + scope to execute. ROADMAP mobile item updated to point at the plan.

## 2026-06-19 - Fieldshare lineage collapse + first DB-verified blob sweep

Two prod data operations (no code shipped). Both put today's doc-accuracy fix into practice
and validated it.

- **Fieldshare Marketing Retainer: 3 versions collapsed to 1.** Rahul asked to delete v2 + v1
  and make v3 the new v1. Inspected first (`.tmp/inspectFieldshare.ts`): v1 (`cmqgb4fbu…`) and
  v2 (`cmqiflptt…`) were both VOIDED ("Superseded by revision"), carrying only Rahul's
  PRE_APPLIED admin signature - the client signers (Chris Kam / Sid Satoskar, fieldshare.io)
  never signed, no payments, no executed PDFs. v3 (`cmqkncxl5…`) was a clean never-sent DRAFT.
  Collapsed via a guarded transaction (`.tmp/fieldshareCollapse.ts`, aborts on any non-admin
  signature or payment): detached v3 (versionNumber=1, parentId=null), then deleted v2 + v1
  (cascade cleaned parties / admin sigs / audit / emails). One Fieldshare row remains: DRAFT
  v1, root. This was a deliberate hand-SQL bypass of the app's `deleteDraft` guard (which only
  deletes DRAFTs) - fine, voided revisions aren't deletable in-app and nothing was executed.
- **First DB-verified orphaned-blob sweep (`.tmp/blobSweep.ts`).** Listed every `proposals/`
  blob, grouped by `{id}`, kept only ids with a live Proposal row. The result proved the
  reframed-doc point exactly: the store held just **4** `proposals/` blobs - **2 belong to live
  proposals** (`cmqg642cx…`, `cmqhcsadf…`, KEPT) and **2 were true orphans** (the Fieldshare
  v1/v2 admin sigs just orphaned by the delete). The old LOG's "4 orphans from prior rehearsals"
  was wrong (already swept); a blanket "delete the `proposals/` prefix" would have destroyed the
  2 real signature blobs. Deleted the 2 orphans (86.7KB); re-run shows 0 orphans, 2 kept. Blob
  access used the wave-8 `BLOB_READ_WRITE_TOKEN` in `.env` (OIDC stays commented in `.env.local`).
  Throwaway scripts left in `.tmp/` (gitignored); `blobSweep.ts` is promotable to `scripts/` if
  we want the documented sweep one-command runnable.

## 2026-06-19 - Doc-accuracy pass: blob "delete the prefix" footgun + Stripe runbook reconcile

Two pieces of standing documentation contradicted reality and read as safe-but-destructive
instructions. Fixed both - docs only, no code/schema, nothing here is served (no prod impact).

- **Blob "orphan" footgun.** BRAIN's Blob gotcha told you to "delete the `proposals/` prefix"
  to clean up - safe only in its original clean-slate context (DB at 0 proposals), but a
  standing landmine now: those keys are real signature PNGs + executed PDFs (MSA §11 evidence)
  on live contracts. A 2026-06-19 spot-check found leftover blobs mapping to **live `Proposal`
  rows**, so "orphan" can't be eyeballed. Reframed across three files: BRAIN gotcha now says
  NEVER bulk-delete the prefix + defines orphan as "no `Proposal` row owns the `{id}`" (cuid);
  ROADMAP "Orphaned-blob cleanup" rewritten as a DB-verified safe procedure (still low
  priority); the two LOG handoffs that said "delete the prefix" got dated corrections (history
  preserved, instruction superseded).
- **Stripe live-key runbook reconcile.** `docs/stripeKeySwapGuide.md` was pre-swap tense though
  the swap shipped + was verified 2026-06-15. Added a Status: COMPLETED banner (now an as-built
  config + rollback reference), and fixed a stale Step-5 line that still claimed "the project is
  NOT git-linked; this is the only ship path" (`main` IS git-linked - the exact false claim
  behind the earlier prod-revert). Checked the ROADMAP runbook box. The runbook's content (6
  events, scopes, ACH, rollback) was already accurate.

Verified: only 4 doc files changed (`git diff --stat`), every `proposals/` prefix mention now
carries a DON'T/superseded caveat, no "NOT git-linked" left in `docs/`. Not committed (no commit
requested; `main` is git-linked, so a push would trigger a no-op rebuild).

## 2026-06-19 - RSL-34 / RSL-35: discount cadence + PDF discount a11y (Sid /review follow-ups)

Sid's `/review` pass on the per-line-discount feature (commit `05342ed`) filed two more issues -
**RSL-34** (Medium, Bug) + **RSL-35** (Low, a11y) - surfaced when Rahul asked to confirm Sid's backlog
was clear. Both fixed TDD-style and deployed.

- **RSL-34 - discounted recurring lines dropped the /month cadence.** A per-line discount overwrote a
  line's `displayString` with `formatCents(net)` (cadence-less), and that string feeds the e-sign
  **consent restatement** - so a discounted $600/month tier read "Growth at $600" in the *binding*
  text. (The charge was always the correct net; only the legal-surface text was wrong.) All four
  producers in `proposalForm.tsx` now use `formatPricedLine(net, interval)`: the two `MoneyFields`
  editors (`setList`/`setDiscount`), the discount toggle-off, and the skill-import path (interval
  threaded through `importDiscount`, now exported). Extracted the consent restatement to a pure
  `buildSelectedSummary()` in `signingOutcome.ts` so the binding text is unit-tested. The flat-import
  path (`importPricing.ts`) was already clean (it preserves the source displayString) - no RSL-36.
- **RSL-35 - PDF discount note lacked was/now a11y context.** The web `DiscountNote` already carries
  an `aria-label` (RSL-33); react-pdf can't, so the PDF twin (`ProposalPdf.tsx`) now prefixes a literal
  "was " before the struck original. `pdfSmoke` gained a discounted recurring line; visual Read confirms
  "was $3,500/month" struck.

**272 tests** (+8: producer cadence interactive+import, consent-summary), tsc + `next build` + eslint(src,
0 err) clean; no schema migration. Gate proportionate to display-only changes (unit + `pdfSmoke` visual;
the money path is untouched and was fully rehearsed earlier today). **Linear:** RSL-34 + RSL-35 Done.
**Browser-verified on live prod (post-deploy):** seeded a discounted-recurring tiered `[TEST]` proposal,
opened its signing page on `proposals.rsla.io`, and confirmed the Growth tier renders "$600/month ·
Was $700/month, now $600/month" and the adopt-modal **consent restatement reads "Growth at $5,000 +
$600/month"** - the `/month` cadence is present on the binding text (the bug would read "...+ $600").
`[TEST]` data + blob cleaned, throwaway seed removed. (The form *producer* path stays login-gated →
covered by the 5 unit tests; the deployed *consumer*/consent rendering is now eyes-on confirmed.)

## 2026-06-19 - Wave 8: Sid's re-verification follow-ups (RSL-27..33) SHIPPED to prod

Sid re-verified the completed 21-issue audit at HEAD `05342ed` and filed **7 new issues** (RSL-27..33):
3 "residuals" (the same bug class the audit already fixed, surviving in a sibling code path the original
patch didn't sweep) + 4 new-feature bugs (from `05342ed` discounts/decline + `8359612` LastName-optional).
All fixed TDD-style and **deployed**: branch `audit/wave8-rsl-27-33`, three themed commits - `69fe9d3`
(exactly-once side effects), `fcae3e9` (money/CRM), `d088737` (legal-text + UI tests) - ff-merged to `main`
(`05342ed..d088737`), Vercel git deploy `9lmckinns` (`dpl_6bjwp5Fp…`) READY → proposals.rsla.io (landing 200,
dashboard/docs/health 307, bad-token document route 404). **264 tests** (+63), tsc + `next build` + eslint(src)
clean; no schema migration. Plan: `~/.claude/plans/create-a-plan-to-warm-kay.md`.

- **RSL-27 (High) - client receipt durable.** `applyPaidState` now enqueues the client receipt
  unconditionally and resolves the payer INSIDE the `SEND_EMAIL` job (`resolvePartyByRole`), so a transient
  payer lookup can't strand it (no payer = clean no-op; a throw retries via the queue). `paymentState.ts` + `jobRunner.ts`.
- **RSL-28 - webhook first-send idempotency.** `payment_failed_client` / `payment_link` first-sends carry a
  deterministic `emailkey-<event.id>-<template>` Resend key (a reaper re-run reuses it → no double-deliver);
  `sendTemplateEmail` gained an optional `idempotencyKey`.
- **RSL-29 - CRM monthly fee.** `jobRunner` derives the monthly fee via the shared `monthlyRecurringCents`
  util (the RSL-18 source of truth) - quarterly/annual retainers + recurring add-ons normalize instead of $0.
- **RSL-30 - Stripe $0.50 floor.** `validatePaymentConfigForSend` enumerates every charged amount across all
  selectable combos (each tier's first charged line incl. the deposit, recurring, flat lines, add-ons;
  `futureItems` excluded) and blocks sub-50c at authoring; `buildLineItems` throws as a backstop. `STRIPE_MIN_CHARGE_CENTS`.
- **RSL-31 - MSA legal-text.** The blank-surname gap-collapse is scoped to the single party-line run
  (`First , Company`), never document-wide; attorney text stays byte-identical (surname-present unchanged).
  `pdfSmoke` now renders a blank-surname variant.
- **RSL-32 - decline exactly-once.** `declineProposal` claims via a `declinedAt`-null guarded `updateMany` +
  returns `firstDecline`; the route emails `declined_admin` only on the first decline; the post-commit log is
  wrapped in `safeLogEvent`. Client `handleDecline` gained a `catch` + branches on `data.code` (extracted pure
  `declineOutcome`).
- **RSL-33 - UI test coverage.** jsdom + RTL harness (per-file `@vitest-environment jsdom` opt-in; node stays
  default). Component tests for decline routing, `MoneyFields` discount inputs, `DiscountNote`/`FlatPricing`;
  struck-price `aria-label` (a11y); `readDiscount` via `inferFlatPricingFromImport`.

**Rehearsal (Stripe test-mode, local dev against prod DB).** Verified LIVE: **RSL-32** - a double-submitted
decline produced exactly one `PARTY_DECLINED` + one `declined_admin` email (Resend SENT); the 2nd submit
returned `code:declined`. **RSL-27 + RSL-29** - fired a real HMAC-signed `checkout.session.completed` at the
webhook → PAID + `Payment` row + **both receipts DELIVERED** (the client receipt resolved-in-job to the client
inbox) + `NOTION_SYNCED` (quarterly $300/qtr → $100/mo). `[TEST]` rows cleaned up (cascade); dashboard/DB clean.

**Rehearsal COMPLETED - full sign → Checkout → executed-PDF UI walk (2026-06-19).** The piece blocked since
Wave 4 is now done. **Blob unblock:** the store has no static token by design (prod = ambient OIDC, see
`src/lib/blob.ts`), but dev-env OIDC isn't enabled for it, so a `vercel env pull` token 403s
("OIDC … not enabled for the development environment"). Fix: a static `BLOB_READ_WRITE_TOKEN` in `.env` +
commenting out `VERCEL_OIDC_TOKEN` in `.env.local` - the `@vercel/blob` resolver prefers OIDC whenever both
OIDC vars are present, so it must be absent for the token to win. **Walk:** `e2eSeed` → `e2eSend` (new;
faithfully mirrors `sendProposal` minus `requireAuth`/`revalidatePath` - freeze, hash via `computeContentHash`,
admin pre-sign copied from `AdminSettings`, client token via `generateSigningToken`) → headless Chrome (Chrome
DevTools MCP) drove `/sign/<token>`: adopt typed signature (Dancing Script), two-place stamp (Proposal
Acceptance + MSA execution), ESIGN consent, Finish → real Stripe **test** Checkout (card 4242, phone required) →
`customer.subscription.created` + `payment_intent.succeeded` → `/paid` (`success_url` carried token +
`session_id`). **Verified via `e2eVerify`:** `paymentStatus=PAID`, `amountTotalCents=149400` ($997 + $497),
subscription `sub_…`; **all 4 emails DELIVERED** incl. `payment_received_client` (RSL-27); **6 PendingJobs DONE,
attempts=1** (GENERATE_PDF, NOTION_SYNC×2, STRIPE_METADATA, SEND_EMAIL×2); clean audit trail (…ALL_SIGNED →
CHECKOUT_CREATED → … → PAYMENT_PAID…); `notionPageId` null (fake co → no real CRM row touched). **Executed PDF**
(19pp): both signatures in BOTH spots + E-Signature Certificate; **content-integrity SHA-256 == send-time
`contentHash`** (`a21497b2…`). **RSL-30** floor passed at checkout. **Not exercised** (happy-path monthly run):
RSL-28 (fail/link-email dedup) + RSL-29 (quarterly/annual $/mo) - both unit-tested; RSL-29 also covered by the
partial pass above. **Cleanup:** `[TEST]` proposal cascade-deleted + its 3 blobs + 11 webhook events; dev +
stripe listen stopped; `STRIPE_WEBHOOK_SECRET` cleared; `BLOB_READ_WRITE_TOKEN` kept for future local runs
(commented note in `.env`). Helpers kept: `scripts/e2eSend.ts`, `e2eVerify.ts`, `e2eCleanup.ts`. Loose end:
4 orphaned signature blobs from PRIOR rehearsals still sit in the store (their proposals were deleted, blobs
never swept) - candidate for a one-off `del`. **Correction (2026-06-19):** a later spot-check found the
leftover signature blobs under inspection map to **live `Proposal` rows**, not deleted ones - so "orphan"
can't be assumed by eyeballing the store. Cross-check each blob's `{id}` against the DB (`Proposal.id`, a
cuid) before any `del`; never bulk-delete the `proposals/` prefix. Safe procedure now in ROADMAP + the BRAIN
Blob gotcha.
**Limitation:** the literal Stripe Checkout UI couldn't be driven locally - the local `BLOB_READ_WRITE_TOKEN`
can't write to the prod Blob store, so *signing* fails locally (Blob is prod-only by design). Worked around by
driving the webhook directly (the identical post-Checkout code path; the only un-exercised surface is Stripe's
hosted card page, which holds no wave-8 logic). The full sign→checkout UI walk on a valid-Blob env stays on the
ROADMAP rehearsal item. **Linear:** RSL-29 marked Done; the other six are pending (permission gate on writing
others' tickets - awaiting Rahul's OK).

## 2026-06-19 - Decline confirmation + Stripe product naming + per-line discounts (SHIPPED to prod)

Three features Rahul requested, all touching the signing / money path. Built, self-audited, and
**deployed to prod 2026-06-19**: committed `05342ed`, pushed to `main` (`07e972d..05342ed`), Vercel
git deploy `nzs7n1x01` READY and serving proposals.rsla.io (landing 200, sign-in 200, dashboard/docs
307 auth-gated, unauthed `/api/.../pdf` 401). Plan: `~/.claude/plans/parsed-giggling-graham.md`.

- **Decline confirmation (Feature 1).** A real signer once declined by accident when he meant to go
  back. The decline dialog (`signingExperience.tsx`) is now two-stage: pick a reason -> **Continue**
  -> a hard "Are you sure? This permanently declines and notifies RSL/A. You can't undo this." gate
  where only **Yes, decline** commits (**Go back** is the prominent default). No server/API change.

- **Stripe product name = the line label (Feature 2).** `stripe.ts` previously named the Stripe
  product `"{label} · {proposalTitle}"`; now it's **exactly the label** Rahul types per line. The
  proposal title moved into the Checkout Session/subscription/payment-intent `metadata` so the
  dashboard stays searchable. Extracted a pure, exported `buildLineItems(checkout, currency)` for
  unit testing (asserts product name == label, unit_amount == net).

- **Per-line discounts (Feature 3).** Enter the **list price + a fixed-$ discount + a reason**; the
  app charges the **net** and shows the client "was -> now (reason)". **Design keystone:** each
  line's `amountCents` stays the NET (the existing source of truth), and `discount: { amountCents,
  reason }` is **additive metadata** (original = net + discount, derived). So **no amount math
  changed** - `effectiveCheckout`, Stripe `unit_amount`, the deposit %, and the Notion contract
  value all already key off `amountCents` (= net). Touched: `types.ts` (Discount + optional field on
  OneTimeItem/AddOn/FutureItem; RecurringItem + tiers inherit), `currency.ts` (`originalCents`,
  `hasDiscount`, `discountDisplay`), `validation.ts` (discountSchema), `proposalForm.tsx`
  (MoneyFields "Apply a discount" sub-section: list price + discount + reason + computed "Charged on
  Stripe"; state hydrate/build via `moneyToDraft`/`buildMoney`/`draftToDiscount`), `proposalContent.ts`
  (flat one-time/recurring now surfaced in the investment section), web `proposalView.tsx` +
  `ProposalPdf.tsx` (was/now/reason inline on tiers + add-ons; a new structured **Pricing** block for
  flat deals that renders only when a flat line is discounted), import inference (flat passthrough +
  `Investment.Structure`/`Investment.AddOns` `discount: { amount, reason }`), `/docs`,
  `testProposalTokens.json` (Logo refresh now $800 list - $200 = $600), jobRunner comment.

**Decisions:** fixed-$ discount only for v1 (percent is a trivial follow-up); a discount on a
recurring line is an ongoing reduced rate ("first N cycles" = Stripe-coupon territory, out of scope);
no Stripe Coupons (charge the net directly, like the deposit feature); **future items get no discount
FORM UI** (display-only lines - you don't set a discount there in the builder), but the renderers DO
show one if present (forward-compat / hand-authored); the label hint reads "(name on Stripe)" on every
charged line.

**Self-audit (adversarial, 3 parallel reviewers + grep):** money path, web/PDF parity, decline, Stripe
naming, and import all reviewed. Confirmed: nothing reads the old Stripe product-name format back
(webhook/reconcile/receipts key off `metadata.proposalId` / session id); an empty discount reason is
blocked at save AND send by `paymentConfigSchema` with a clean "Reason is required." message
(humanizeZodError). Two consistency gaps found and FIXED: (1) `FutureItem.discount` was allowed by the
type/schema but rendered nowhere - now rendered on web + PDF (closed the set-but-not-shown gap); (2) PDF
discount note used a double space vs the web's single - matched. Re-verified: tsc, 215 tests, eslint 0
errors, pdfSmoke re-read (tier/add-on/flat/future discounts all show was -> now + reason, parity holds).

**Verified:** `tsc` clean, **215 tests** (+14: currency discount helpers, validation discount schema,
effectiveCheckout net-invariance + discounted-future-item-never-charged, `buildLineItems`), `eslint
src` 0 errors, `npm run build` green, and `pdfSmoke` rendered + visually Read - the Growth tier shows
$6,000 with $7,000 struck + "Launch promo", the Rush add-on shows $800 with $1,000 struck +
"First-time client", deposit correctly = 50% of the net $6,000. (pdfSmoke fixture now carries a
discount as permanent regression coverage.)

**Next:** fold these into the **deferred Stripe test-mode + e2e rehearsal** before the next real send
(now also covers: Stripe shows the label as product name + charges the net discounted amount; the
two-stage decline gate). See ROADMAP.

## 2026-06-18 - Audit remediation COMPLETE (Wave 7) + RSL-12/20 product refinements

**All 21 audit issues (RSL-6..26) are now fixed AND deployed to prod - the audit is complete.**
Wave 7 - the last wave - plus two product refinements shipped this session. **Deployed 2026-06-18:**
`main` fast-forwarded `a2cb293..6a13c14` and pushed; Vercel deploy `o6frxybnr` READY, aliased to
proposals.rsla.io (landing 200 / dashboard 307 auth-gated / unauthed `/api/.../pdf` 401). Verified
pre-push: **201 tests**, `tsc`, `next build`, `eslint src` (0 errors) all clean. No schema migration.

- **Wave 7 (RSL-23, RSL-19) - commit `2c9264d`.** RSL-23 (`dates.ts`): replaced the hand-rolled
  April-October DST month band (treated all of March as EST, mis-set early Nov) with an Intl
  `America/New_York` offset sampled at noon UTC, so end-of-day expiry instants are correct on DST
  edge days (Mar 9-31, early Nov). RSL-19 (`rateLimit.ts`): throttled TTL eviction so the in-memory
  Map can't grow unbounded under distinct/spoofed keys; per-instance scope **documented as
  deliberate** (the 256-bit signing token is the real auth boundary - abuse-dampening, not authz) +
  a `rateLimitSize()` introspection. Lean option per the spec. +7 tests.
- **RSL-12 + RSL-20 product refinements - commit `70d812c`.** Both resolve the product decision
  their issue flagged (issues already Done; defect already fixed in Waves 6/2). **RSL-12:**
  `remindParty` drops the ADMIN gate (keeps `requireAuth`) - a reminder only re-emails the signer's
  existing address, so any active teammate may send one; copy-link (`getFreshSigningLink`) +
  email-repoint (`updatePartyEmail`) stay ADMIN-only. **RSL-20:** `declineProposal` now also moves
  PARTIALLY_SIGNED → DECLINED (every party must sign to execute, so one decline ends the deal);
  committed signatures are preserved, a fully SIGNED proposal stays excluded (VOID only). Reuses the
  existing DECLINED enum value - no migration.

**Linear:** **all 21 issues (RSL-6..26) are now Done**, each with a resolution comment. RSL-23 +
RSL-19 moved to Done on this deploy; RSL-12/RSL-20 carry follow-up comments noting the refined
behavior.

**Repo housekeeping (done this session):** removed the stale 1.2GB `.claude/worktrees/dashboard-upgrade`
worktree (verified fully merged + clean first), then fixed the bare-`eslint` noise at its root - the
config's root-anchored `.next/**` missed nested build output, so added `**/.next/**`, `.claude/**`, and
the vendored `docs/mockups/**` to `eslint.config.mjs` ignores (commit `55bb0d0`); bare `eslint` is now
0 errors, matching `eslint src`. Deleted stale merged branches `worktree-dashboard-upgrade`
(local+remote) and `fix-future-item-currency` (local); **kept `audit/remediation`** (local+`origin`) as
the audit record - delete once prod is proven stable.

**Next (deferred, per Rahul):** the **Stripe test-mode rehearsal + full e2e rehearsal** are the only
open item - run before the next real send (Wave 4's money-path is live but not yet exercised e2e). See
ROADMAP.

## 2026-06-17 - Security/correctness audit remediation (Sid's RSL-6..26) - IN PROGRESS

Working through Siddharth Rodrigues' ("Sid") 21-issue security + correctness audit, filed as
Linear issues **RSL-6 → RSL-26** (team RSL/A); each has a full remediation spec in Linear.
Plan file: `~/.claude/plans/please-create-a-plan-humble-gosling.md`. Branch: **`audit/remediation`**
(cut from `main`). Cadence: **one wave per commit, paused for review before each commit**; `main`
is git-linked, so each merge auto-deploys to prod.

**Session decisions:** single operator today → authz holes (RSL-11/12/26) are cheap hardening,
deferred to Wave 6. Added a **Prisma-mock test seam** (Wave 0) so handler/queue/authz paths get real
regression tests: `src/lib/__mocks__/prisma.ts` (mockDeep), `src/test/db.ts` (`prismaMock` +
auto-reset), `src/test/factories.ts`; per-test `auth`/`after`/stripe/resend/notion mocks at first use.

**Waves (0 enabler + 7 fix + deferred verification):**

- ✅ **Wave 0 - test seam.** Commit `864cb97`.
- ✅ **Wave 1 - payment exactly-once (RSL-6, RSL-8).** Commit `3d4f9f3`. RSL-6: webhook + reconcile now
  **process-then-record** (`wasWebhookProcessed`/`markWebhookProcessed` in `paymentState.ts`) so a
  transient failure heals on Stripe's retry; atomic paid-guard preserved. RSL-8: receipts are durable
  `SEND_EMAIL` jobs + the deposit-note read is non-fatal.
- ✅ **Wave 2 - signing-path integrity (RSL-9, RSL-10, RSL-21, RSL-7, RSL-20).** Commit `6765282`, all
  in `signingService.ts`. RSL-9: post-commit `safeLogEvent` + checkout build wrapped (recoverable,
  never rejects a committed sign). RSL-10: per-submit blob key `{partyId}-{uuid}.png`. RSL-21:
  `frozenPaymentConfig` shape-guards tiers/addOns → `SigningError("config_error")`; `resolveTrackRecord`
  falls back to legacy on a malformed value. RSL-7: `ensureCheckoutSession` reuse-or-refuse + key
  `checkout-{id}-g{generation}` (generation = CHECKOUT_CREATED count, never the session id).
  RSL-20 (**product default - confirm**): decline records the party but only flips SENT/VIEWED →
  DECLINED; a committed signature is never reverted.
- ✅ **Wave 3 - legal-text fidelity (RSL-17, RSL-25).** Commit `7ea8812`.
  `parseMsa.ts`: one whitespace-tolerant `tokenPattern()` (`/\{\{\s*([\w.]+)\s*\}\}/g`, a fresh RegExp per
  call so there's no shared `lastIndex`) now backs BOTH `replaceTokens` and `findUnreplacedTokens`, so a
  `{{ spaced }}` token is filled or flagged - never shipped raw into the signed MSA (RSL-17a); `parseRuns`
  toggles bold per `**` and drops an unclosed odd `**` instead of leaking it / dropping the legit pair
  (RSL-17b). `proposalContent.ts`: `splitBulletString` strips a dash marker only when followed by whitespace
  (a leading minus like `-5%` survives the sign-flip) and treats em-dash the same as en-dash (RSL-25).
- ✅ **Wave 4 - side-effect reliability (RSL-13, RSL-16, RSL-15, RSL-14, RSL-22).** Commit `20b93d9`.
  **RSL-13** (`jobRunner.ts`/`jobs.ts`): `processDueJobs` isolates `await failJob`
  in its own try/catch (one job's bookkeeping failure can't abort the batch) and reaps stuck PROCESSING rows
  via new `reapStuckJobs` (>5min → PENDING) before each claim; `runJobNow` gained the `scheduledAt <= NOW()`
  due-gate so an immediate run can't defeat backoff. **RSL-16** (`cron/daily`): per-iteration try/catch in the
  expire AND reminder loops (one email failure no longer aborts the rest), and the reminder dedup is keyed per
  `(party, daysLeft)` via the `REMINDER_SENT` audit event in a sub-24h window, so a 3-day reminder no longer
  eats the 1-day nudge. **RSL-15** (`notion.ts`/`jobRunner.ts`): `findCrmPage` exact-matches the company title
  (one match wins, zero → null, >1 → refuse loudly) instead of `contains`→`results[0]` (the Scorpion incident);
  NOTION_SYNC paid append is idempotent via a `NOTION_SYNCED`/kind marker checked before the append. **RSL-14**
  (`partyTokens.ts`/`generatePdf.ts`/`jobRunner.ts`/`signingService.ts`/`pay` page): one shared
  `isPayerTokenInFlight` guard (payer identity + AWAITING/PROCESSING, never signer order) replaces the fragile
  last-signer-by-`signedAt` heuristic - the executed-copy email and the SEND_EMAIL retry never rotate the
  payer's live token; the cancel_url now carries `session_id` and `/pay` self-heals by it like `/paid`.
  **RSL-22** (`generatePdf.ts`): executed-copy dedup is now per-party on the client email row, so a failed
  admin send no longer re-mails every client on regeneration. +14 tests (178 total); `tsc`, `next build`,
  and eslint all clean.
- ✅ **Wave 5 - dashboard correctness (RSL-18, RSL-24).** Commit `0749262`.
  **RSL-18** (`dashboardMetrics.ts` + `dashboard/page.tsx`): MRR period-normalization now lives in one shared
  util - `monthlyRecurringCents` folds 1/3/12-month retainers + recurring add-ons to a monthly figure
  (`amountCents / intervalMonths`), so a $300/qtr or $12k/yr retainer contributes $100/$1,000 instead of $0;
  the page mapper calls the util instead of re-deriving MRR (the family-principle "single source of truth").
  **RSL-24** (`dashboardMetrics.ts`): `mrrSeries` now buckets half-open (`< end`, dropping the `min(end,now)`
  cutoff) so a boundary-signed deal lands in the SAME month as `signedSeries`; the stale-open strip uses a
  continuous day comparison (`ageMs > 14d`) matching the headline's already-continuous warn, so the oldest
  open deal surfaces the instant it crosses 14 days (was lagging ~24h via `floor(days) > 14`). +5 tests
  (183 total); `tsc` + `next build` + eslint clean. Existing 19 dashboard tests unchanged. **Folded in** (same
  commit, same file, non-audit): the deal-list column renders the real billing cadence via `formatPricedLine`
  (e.g. "$300/quarter") instead of a hardcoded "/mo".
- ✅ **Wave 6 - authz re-validation (RSL-11, RSL-12, RSL-26).** Commit `128f21f`, **deployed to prod
  2026-06-17** (`main` ff `0749262..a2cb293`, `dpl_J5wGN6Jk5uU17wqpSd55joRUq9Z2` READY; prod 401s an
  unauthed `/api/.../pdf`, confirming the RSL-11 guard is live).
  **RSL-11** (`authGuard.ts` + 3 API routes): new `getActiveApiUser` re-checks the live User row + `active`
  flag per request and returns null → 401; the pdf / signature / settings-signature routes use it instead of
  the login-time `email.endsWith("@rsla.io")` allowlist, so an offboarded/deactivated account with a valid
  JWT loses access to executed PDFs + signature PII immediately. **RSL-12** (`proposals.ts`): `remindParty`,
  `getFreshSigningLink`, `updatePartyEmail` now carry the `actor.role !== "ADMIN"` gate (matching
  `users.ts`/`settings.ts`), so a MEMBER can no longer repoint a signer's email / rotate the token / mint a
  signing invite - i.e. can't change who executes the contract. **RSL-26** (3 admin pages + middleware): each
  RSC page (`dashboard`/`edit`/`send`) calls `requireUser()` before its own prisma fetch (a child segment
  renders before the layout body, so the `(admin)` layout guard alone left the fetch ungated); middleware is
  **documented as a UX-only cookie-presence fast-path** - real authz is re-validated at every data-access
  point (per-page/route/action), so a forged cookie is rejected the moment it hits a guarded surface. Edge JWT
  validation was deliberately NOT added (auth.ts pulls Prisma, which isn't Edge-safe; getting it wrong risks
  locking out the team). +10 tests (193 total); `tsc` + `next build` + eslint clean. No schema migration.
- ✅ **Wave 7 - dates + rate-limit (RSL-23, RSL-19).** Commit `2c9264d` (2026-06-18). `dates.ts`: Intl
  `America/New_York` offset sampled at noon UTC replaces the DST month band - correct on Mar 9-31 /
  early-Nov edges. `rateLimit.ts`: throttled TTL eviction bounds the Map; per-instance scope
  documented as deliberate (256-bit token is the real boundary) + `rateLimitSize()`. +7 tests.

**Status:** **Waves 0-6 deployed to prod - 19 of 21 audit issues LIVE.** 2026-06-17, two prod pushes this
session: `6765282..0749262` (waves 3-5, `dpl_ETk…`) then `0749262..a2cb293` (wave 6, `dpl_J5wGN…`), both
READY; `proposals.rsla.io` serving (landing 200, dashboard 307 auth-gated, unauthed `/api/.../pdf` 401).
193 tests + `tsc` + `next build` + eslint clean. Branch `audit/remediation` is now **pushed to GitHub**
(`origin/audit/remediation`) so the work is backed up; `origin/main` = `a2cb293`. Only **Wave 7 (RSL-23
dates, RSL-19 rate-limit)** remains. No schema migration anywhere in waves 3-6 (the NOTION_SYNC and reminder
idempotency markers reuse the `AuditEvent` table; the stuck-job reaper reuses `PendingJob.processingAt`;
waves 5-6 are pure arithmetic / guards). NOTE: the LOG snapshot baked into the `a2cb293` deploy still reads
"wave 6 not deployed" - corrected here on the branch; rides to `main` with the wave-7 push (LOG is internal,
not served).

**Open decisions for next session:** (a) **RSL-12 scope** - remind/copy-link/repoint are now all ADMIN-only
in prod; confirm that's wanted, or relax remind/copy-link to MEMBER and keep only the email-repoint
admin-gated; (b) **Wave 7 (RSL-23, RSL-19)** is the last wave (RSL-19 needs a product call: shared store vs
accept per-instance); (c) the **deferred verification** below still stands (Stripe test-mode + e2e rehearsal,
move fixed RSL issues to Done in Linear).
**Caveat:** waves 3-5 are unit-tested against the prisma-mock seam and shipped ahead of the deferred
Stripe test-mode + e2e rehearsal below - notably Wave 4's payer-token/queue changes touch the live money
path, now in prod but not yet exercised end-to-end. Run that rehearsal before relying on it for a real send.

**Deferred verification (after ALL waves, per Rahul):** (1) **Stripe test-mode rehearsal** - a real
test-mode sign→checkout→pay on a fake-company proposal (RSL-6/7/8/9 touch the live money flow, not yet
exercised end to end); (2) move fixed RSL issues to **Done** in Linear; (3) full e2e rehearsal
(`e2eSeed` → sign drawn+typed → pay → executed PDF + cert via `pdfSmoke` → 14 emails via `emailPreview`
→ Notion fake company → dashboard).

## 2026-06-15 - Later phases: currency formatting + em-dash removal

Two bugs in the "Later phases" (FutureItems) section, reported on a live proposal: a future-item
amount typed as a bare number ("1250") rendered as "1250" (not "$1,250"), and the disclaimer carried
an em dash.

- **Currency:** both renderers showed `item.displayString` raw, so a malformed display string leaked
  through. New `formatPricedLine(amountCents, intervalMonths)` in `currency.ts` derives the display
  from cents (the validated source of truth) and appends the cadence for recurring lines
  ("$1,250/month"). Web (`proposalView`) and PDF (`ProposalPdf`) both use it, so they stay identical.
- **Em dash:** the FutureItems disclaimer "Shown for planning - billed separately..." now reads
  "Shown for planning. Billed separately..." in both renderers (no em/en dash in client-facing copy).
- **Note:** add-ons render `displayString` the same way (same latent issue if a bare number is typed);
  left as-is since not reported. Easy follow-up with the same helper.
- **Verified:** 129 tests (+3, TDD'd), tsc + eslint clean, `pdfSmoke` visually checked - Later phases
  shows "$1,500/month" / "$3,000" and the period-form disclaimer.
- **Status:** committed + pushed to `main` (auto-deploys to prod).

## 2026-06-15 - Last name is now optional (first name + company on the contract)

Some prospects are known only by a first name, but `Client.LastName` was required, so saving or
sending blocked with "Last name is required." Made it optional end to end.

- **Validation:** `Client.LastName` accepts blank or omitted (`OPTIONAL_TOKEN_KEYS`); first name and
  company stay required. The token transform tolerates a missing key.
- **Legal rendering (the decision):** when the surname is blank, the executed MSA party line and the
  acceptance block identify the Client as **first name + company** (Rahul's call). New helper
  `src/lib/clientName.ts`: `clientFullName` (drops a blank surname) and `collapseNameFieldGap`
  (removes the gap an empty merge leaves, e.g. "Christian , Co" to "Christian, Co"). The collapse
  runs **only when the surname is blank**, so normal proposals render byte-identically. No change to
  the attorney-owned MSA wording.
- **Polish:** admin dashboard/detail/send name strings use `clientFullName` (no dangling space); the
  form field reads "Last name (optional)"; `/docs` marks it optional.
- **Verified:** 126 tests (+11, TDD'd), tsc + eslint clean, `pdfSmoke` regression clean, and a
  blank-surname PDF visually checked - page 4 party line reads "Christian, Valley Oak Landscape Co
  (the Client)." with the cover, MSA body, and footers intact.
- **Status:** committed + pushed to `main` (auto-deploys to prod).

## 2026-06-15 - Validation errors now read in plain English (was raw Zod JSON)

Saving or sending a proposal with an empty field dumped a raw Zod 4 issue array at the user
(`[{ "code": "too_small", "path": ["Client.LastName"] ... }]`) - `errorMessage()` returned
`ZodError.message`, which Zod 4 stringifies to JSON. Surfaced by an empty `Client.LastName`.

- **New `src/lib/zodErrors.ts` → `humanizeZodError`** (pure, TDD'd, +8 tests). Maps the field path to
  a sentence-case label (`Client.LastName` -> "Last name") and the Zod code to plain phrasing
  ("is required", "must be at most N characters"); falls back to `"<Field>: <message>"` otherwise;
  de-dupes repeated lines.
- **Wired into** the save/send actions (`proposals.ts` `errorMessage`, gated on `instanceof ZodError`)
  and the import parser (`validation.ts` `normalizeImportedTokens`) so paste errors are friendly too.
  Result: "Last name is required." instead of the JSON blob.
- **Verified:** 115 tests green (+8), tsc + eslint clean, before/after demo on the exact LastName error.
- **Status:** committed + pushed to `main` (auto-deploys to prod). Admin user-management form still
  shows one semi-raw Zod message - left for a separate pass.

## 2026-06-15 - Flat pricing now imports from pasted JSON (was tiers-only)

A flat deal generated in the platform's internal `PaymentConfig` shape (top-level `oneTime` /
`recurring` / `paymentMethods` / `preferAch`, `tiers: null`) pasted with all copy filled but the
**pricing blank** - the import box only inferred `Investment.Structure` (tiers), so flat amounts had
to be hand-typed. Surfaced by a Valley Oak proposal ($13,700 build + $1,250/mo) that "wouldn't parse
the pricing part."

- **New `src/lib/importPricing.ts` → `inferFlatPricingFromImport`** (pure, exported, unit-tested -
  unlike the sibling `infer*FromImport` helpers that live un-tested inside `proposalForm.tsx`).
  Reads `oneTime` / `recurring` / `paymentMethods` / `preferAch`; trusts a positive-integer
  `amountCents`, else derives cents from the `displayString`; coerces `intervalMonths` to 1|3|12;
  defaults labels. Returns null when the deal is tiered (tiers win) or carries no flat amount, so it
  never clobbers an empty pricing section.
- **Wired into `handleImport`**: flat path runs only when no tiers were inferred; sets
  `pricingMode: "flat"`, enables the one-time/monthly lines, applies methods + preferAch, and adds a
  "flat pricing" chip to the success toast. TDD'd - **+9 tests → 107 total**.
- **`/docs` updated**: the Pricing section now states flat pricing imports from top-level
  oneTime/recurring, not just Investment.Structure.
- **Verified:** 107 tests green, `tsc --noEmit` clean, eslint clean on changed files. No money-path
  behavior changed (effectiveCheckout/validation untouched); this only pre-fills the reviewable form.
- **Status:** on branch `feat-flat-pricing-import`, **not committed, not deployed** - awaiting review.

## 2026-06-15 - Display-only "Later phases" line items (Phase-2 pricing, never billed)

Answer to "how do I show a future service with pricing but not charge for it?" (e.g. monthly SEO
that starts after the build). The billing path has no scheduled-start support - a recurring add-on
bills at signing - so this adds a separate, **display-only** line type instead.

- **`PaymentConfig.futureItems`** (new `FutureItem`: label, displayString, amountCents,
  intervalMonths, startsNote). It's its **own field that `effectiveCheckout` never reads**, so it
  can't reach Stripe - unbillable by construction, locked by a guard test.
- **Validation:** shape + unique ids + cap 6 (zod) and `displayString`↔`amountCents` at send time,
  same guard as every other priced line. TDD'd - **+5 tests → 98 total**.
- **Render:** a dashed "Later phases" block in *Your Investment*, **identical on web + PDF**
  (`proposalView` + `ProposalPdf`), labelled "Shown for planning - billed separately when each
  begins, not collected today." Each row shows the price + a "Starts: …" note.
- **Admin form:** a repeater under Add-ons (label / price / recurring toggle / Starts). Scope is
  **global + display-only** (Rahul's call); not offered on sign-only.
- **Import + docs:** `Investment.FutureItems` import inference (mirrors `Investment.AddOns`) so the
  generate-proposal skill can emit them. `/docs` ("Proposal import schema") updated for accuracy -
  futureItems in the PaymentConfig section, a Later-phases example, the `Investment.FutureItems`
  import block, and a gotcha. Every code block on `/docs` now has a **click-to-copy** button
  (`CopyableCode`). NB: the skill prompt itself still needs a separate update to start emitting them.
- **Verified:** 98 tests, build clean, `pdfSmoke` OK + visual Read of the PDF, a web-render
  screenshot (web = PDF), and a docs-page screenshot (copy buttons + futureItems content render).
- **Status:** committed + pushed to `main` (which auto-deploys), confirmed with an explicit
  `vercel deploy --prod`. Live on `proposals.rsla.io`.

## 2026-06-15 - Dashboard visual upgrade (deployed to prod; merged into main alongside the PDF rebuild)

Executed the Claude Design "Insightful" dashboard upgrade in an isolated git worktree. Turned out
to be **~90% a visual/layout job, not a data project** - the old dashboard already computed every
metric the mockup shows (win rate, contracted one-time, MRR, signed-this-month vs last, avg
time-to-sign, oldest-open). Two decisions were Rahul's: **Satoshi + Inter** font direction, and
**real-but-hide-if-sparse** sparklines.

- **Fonts - retired Space Grotesk.** `--font-tag` / `.font-tag` repointed to Inter and the
  `Space_Grotesk` import dropped from `layout.tsx`; the 7 `font-tag` consumers inherit it for free.
  Note this also restyles the small uppercase labels on the **client-facing** proposal view +
  signing modal (Inter instead of Space Grotesk) - judged more consistent, not flagged as blocking.
  Now a clean two-font stack (Satoshi display + Inter everything).
- **New pure module `src/lib/dashboardMetrics.ts` (TDD, +19 tests).** 6-month MRR stock series +
  signed/avg-sign flow series, month-over-month MRR delta, attention detection (signed+awaiting/
  failed payment, or open > 14d), filter predicates + counts, and `hasSparklineSignal` (a sparkline
  shows only with ≥2 non-zero points, so it never renders fake data). The page does the
  Prisma→`NormalizedProposal` extraction (same money math as before) and feeds this module.
- **New components.** `sparkline.tsx` (SVG bar + line, server-rendered), `metrics.tsx` (MRR 2×2
  hero with delta pill + nested contracted-one-time + bar sparkline; calm Win-rate/Signed/Avg cards;
  amber Oldest-open warn card), `proposalsPanel.tsx` (client island: attention strip + segmented
  filter tabs with live counts + desktop table + mobile cards; "Review" jumps to the
  Needs-attention filter). Shell/top-nav left untouched (already matched the mockup).
- **emilDesignEng polish.** `.card-hover` lift gated behind `(hover: hover) and (pointer: fine)` +
  nulled under `prefers-reduced-motion`, easing moved to the existing `--ease-out-strong`; filter
  tabs transition named props instead of `all`; removed a no-op `width` transition on the win-rate
  bar. Arbitrary spacing classes converted to Tailwind v4 canonical fractions (lint clean).
- **Verified.** `npm test` 93 pass (was 74), `npm run build` clean, and the rendered dashboard
  screenshotted at desktop + mobile against the mockup (faithful) via a throwaway public preview
  route with mock data (deleted after). Real-data correctness covered by the unit tests + build
  (the authed `/dashboard` needs a Google session, so it wasn't screenshotted directly).
- **Design source** archived to `docs/mockups/dashboardUpgrade/` (camelCased; `support.js` kept so
  the `.dc.html` files still render; Downloads folder cleared).
- **Status:** committed + pushed. My first prod deploy (`dpl_7ccVDmbU2yyXjDDbymUx5BCodWLJ`) shipped
  the dashboard from a branch point (`da33518`) that predated the PDF rebuild below - which had
  already landed on `main` + been deployed - so it briefly reverted the PDF rebuild on prod. Fixed by
  merging the PDF rebuild into this branch and redeploying the combined build, then fast-forwarding
  `main`. End state: `main` = prod = dashboard + PDF rebuild.
- **Root cause + doc fix:** the project is git-linked to `main` (pushing `main` auto-deploys to
  prod) - the "not git-linked" notes in CLAUDE.md/BRAIN.md were stale and led to the manual
  stale-branch deploy that caused the revert. Both corrected.

## 2026-06-15 - Executed PDF rebuilt as a paginated replica of the web signing doc

Rahul: the emailed/downloaded PDF didn't match the web signing document. Rewrote the PDF renderer
(`src/components/pdf/ProposalPdf.tsx`, **presentational only** - no data/logic change; the shared
`ProposalSections` builder and the web `ProposalView` are untouched) into a faithful, paginated
replica of the web doc.

- **Parity:** section headings + all MSA sub-headings are now Anchor Blue (`#0070F3`) with blue
  bullets; At-a-Glance is a bordered rounded table (surface label column, sentence-case labels);
  signatures are rounded bordered cards; tier cards carry a filled "Recommended" pill + a
  selected white-check; add-ons are checkboxes; the deposit schedule is an accent box;
  How-to-Proceed steps are numbered blue circles. Spacing/type matched to the web tokens
  (Satoshi `-0.02em`, 10pt body).
- **Pagination:** collapsed the 6 hard page-groups into a continuous flow - 3 logical `<Page>`s
  (proposal body flows cover→acceptance→notes, MSA on a fresh page, then the certificate).
  `wrap={false}` on short atomic blocks + `minPresenceAhead` ~72pt on headings -> no section splits
  across a page and no orphaned headings (the Acceptance heading + its signature cards no longer
  split across pages 4/5; page 1 is no longer ~60% blank). Validated against the `@react-pdf/layout`
  engine; the footer stays a static `fixed` element (no render-callback -> no `-9.6e21` corruption).
- **Cosmetic pass (Rahul's review):** At-a-Glance corners now round (`overflow: hidden` clips the
  label fill); step numbers center + the tier/add-on white checkmarks render (`lineHeight: 1`);
  footer `rsla.io` confirmed live + canonical. The green signature blocks in the smoke render are
  fixture placeholders (`fakeSignaturePng`) - real signed PDFs use the actual signature.
- **Verified:** `pdfSmoke` both variants render with no overflow warnings + visually read;
  production build green; 74 tests pass. Plan: `~/.claude/plans/cozy-jingling-pudding.md`.

## 2026-06-15 - Recurring + ACH + renewal verification (local sandbox, PASSED)

Closed the only go-live residual: the never-exercised subscription / ACH / renewal webhook paths
are now proven. All run in a local Stripe **Sandbox** (the `sk_test` key Rahul pasted into local
`.env`; a hard `sk_test` guard in the harness blocked any live call) - **prod live key untouched**.

- **Setup:** installed the Stripe CLI; `stripe listen --api-key <sandbox>` forwarded to
  `localhost:1235` and minted the `whsec` (written to local `.env`); dev booted on :1235.
  Confirmed first there was **no deploy gap** - prod serves the polished `--radius:.5rem` and the
  latest prod deploy postdates every source commit; the earlier "NOT committed/deployed" LOG line
  was stale (corrected).
- **Session building (real test Stripe via `createCheckoutSession`):** recurring config -> mode
  `subscription`, two line items ($997 one-time + $497/mo recurring); deposit config -> mode
  `payment` (no subscription opens). 4/4.
- **Webhook matrix (correctly-signed synthetic events -> the live dev route):** first charge
  (`checkout.session.completed` -> PAID + `Payment.stripeSubscriptionId` + client/admin receipts),
  renewal (`invoice.paid`/subscription_cycle -> receipt, stays PAID, no double-send), ACH (unpaid
  -> PROCESSING -> `async_payment_succeeded` -> PAID), failures (`async_payment_failed`,
  `invoice.payment_failed`), expiry (-> SESSION_EXPIRED + relink), idempotency (replay ->
  `{duplicate:true}`, no double receipt). All correct. The two transient "PENDING" jobs were correct
  behavior, not bugs (Resend 5/sec rate-limit on the email burst -> queue retries;
  `STRIPE_METADATA` waits for the executed PDF).
- **API version `2026-05-27.dahlia`:** the invoice handlers read the subscription id from BOTH the
  old top-level `invoice.subscription` and the new nested
  `invoice.parent.subscription_details.subscription`. Verified the nested shape fires the renewal +
  invoice-failed handlers (3/3) and a no-sub invoice no-ops gracefully -> **the Dahlia API update is
  safe to take.**
- **Real hosted-checkout end-to-end (sandbox, card 4242):** Rahul paid a real subscription checkout;
  real Stripe payloads flowed `stripe listen` -> handler -> **PAID**, `Payment` with the real
  `sub_…`, client+admin receipts SENT, Notion no-op (fake co). The real first-charge `invoice.paid`
  correctly did NOT double-send (the `subscription_cycle` guard held on a real payload).
- **Live endpoint:** Rahul confirmed in the Stripe dashboard that the prod `proposals.rsla.io`
  webhook subscribes all 6 events. So one-time (prod $1 test) + recurring + ACH are covered live.
- **Cleanup:** sandbox subscription canceled; all `[TEST-MX]`/`[TEST-R2]` proposals removed
  (dashboard back to 0 proposals); a handful of inert webhook dedup rows from the session remain
  (harmless, joins the existing orphaned-row backlog - a precise purge was declined by the auto-mode
  guard, left for an authorized cleanup). Local `.env` keeps the sandbox `sk_test` key (gitignored)
  with `STRIPE_WEBHOOK_SECRET` reset to empty (refill from `stripe listen` next time). Reusable
  harness kept at `.tmp/paymentMatrix.ts` + `.tmp/test2.ts`.
- **Net:** recurring + ACH proposals are safe to send for real. The PandaDoc replacement is now
  verified across one-time, subscription, and ACH. Not committed (docs only this session).

## 2026-06-15 - Go-live verification + live $1 smoke test (PASSED)

Verified the tool is production-ready for real proposals. Key finding: prod Stripe is **LIVE** (a
`cs_live_` checkout session was created on prod today), resolving the only go-live blocker.

- **Confirmed without exposing secrets:** prod `STRIPE_SECRET_KEY` is live (a `cs_live_` session +
  `cus_` customer on a prod-signed proposal); both Stripe env vars set on Vercel Production; webhook
  endpoint live + signature-verifying (unsigned -> 400 "Missing signature", bogus -> 400 "Invalid
  signature"); handler covers the 6 events, idempotent + paid-state guarded; routes + auth gating
  healthy; Ready prod deploy + clean tree at 75fba62.
- **Live $1 smoke test (real card):** seeded a $1 one-time, card-only
  `[TEST] Brightline Test Co` draft via `.tmp/liveSmokeSeed.ts` (the stock `e2eSeed.ts` is
  test-mode: $997+$497/mo and tells you to use 4242, which is declined on live). Rahul sent -> signed
  -> paid $1. Full chain landed: SIGNED + **paymentStatus PAID**, Payment row ($1, `cs_live_`/`pi_`,
  no subscription), **`stripe checkout.session.completed` signature-verified in prod** (the
  webhook-secret-match proof), GENERATE_PDF/NOTION_SYNC/STRIPE_METADATA all DONE first try, executed
  PDF in Blob (156KB, hashed), all 5 emails delivered (incl client + admin receipts). Notion sync =
  no-op (`findCrmPage` returns null for the fake company; it never creates pages).
- **Cleanup (clean slate for go-live):** deleted the 2 inert `[DEMO]` Brightline rows, the smoke-test
  row, and all 3 `Connect Health` proposals on Rahul's request -> **dashboard now empty (0 proposals)**.
  The 3 Connect Health rows turned out to be Rahul's own rehearsals (client signer =
  `laliarahul2396@gmail.com`, names "RL-testing"/"RJ Dowell"), NOT a real client send -- this corrects
  the 2026-06-14 note that called the ConnectHealth one "the one real prospect." Left untouched:
  pre-existing `cmqewz3l` orphan webhook rows + orphaned test blobs (both harmless, backlog).
- **Decisions:** refund of the live $1 smoke charge SKIPPED per Rahul (left as-is).
  `.tmp/liveSmokeSeed.ts` kept (gitignored) for future live re-tests.
- **Next (deferred to 2026-06-16):** recurring/ACH proposal smoke test + independently confirm the
  live endpoint subscribes all 6 events (only `checkout.session.completed` has fired so far) + ACH.
  The one-time card path is fully proven; safe to send one-time/card proposals now.
- **Note:** BRAIN/ROADMAP/LOG edits this session are uncommitted (no commit requested).

## 2026-06-15 - UI/UX polish pass (tighter & crisper, whole web app)

Harmonized the web app's visual details (Rahul: rounded corners, spacing, text, toast cards).
Direction: **tighter & crisper**; scope: whole web app except the PDF. Purely presentational, no
logic touched, 74 tests still green.

- **Tokens** ([globals.css](src/app/globals.css)): base `--radius` 10px -> 8px (sharpens the whole
  `rounded-*` family via the `@theme` scale), crisper `.card-hover` shadow.
- **Button** ([button.tsx](src/components/ui/button.tsx)): `active:scale-[0.98]` press feedback
  (was a 1px nudge) so every button responds to press (emilDesignEng).
- **Toasts** ([toast.tsx](src/lib/toast.tsx)): crisper branded card (`rounded-2xl`->`xl`, tighter
  padding, smaller icon chip, `shadow-xl`->`lg`) + a new `warning` tone (amber). Migrated the **5
  files still firing raw sonner** (teamSettings, signatureSettings, sendForm, proposalForm,
  partyList) to `brandToast`, so every toast is the branded top-center card (kills the
  branded-vs-stock split and the bottom-right/top-center position split).
- **Spacing:** signing-doc section rhythm `mt-12 mb-4` -> `mt-9 mb-3`
  ([proposalView](src/components/proposal/proposalView.tsx) `SectionHeading`); form label->input
  gaps `space-y-1` -> `space-y-1.5`; every page wrapper unified to `space-y-5` (dashboard,
  settings, detail, send, systemHealth, proposalForm) + import textarea `min-h-28`->`24`.
- **Verified:** lint clean, 74 tests, production build green. Visual via Chrome DevTools: signing
  page (tighter rhythm + crisp tier cards), landing + sign-in (crisper button/panel radius). Admin
  screens are Google-auth-gated (verified by build; Rahul to eyeball live). **Committed (`75fba62`)
  and deployed to prod 2026-06-15** (deploy created 01:34 PDT, aliased to proposals.rsla.io; verified
  live serving the polished `--radius:.5rem`). The earlier "NOT committed/deployed" note was stale.

## 2026-06-15 - Per-proposal editable Track Record (text + URL)

"Our Track Record" was a hardcoded constant shown identically on every proposal (the restaurant /
salon / software case studies). Made it per-proposal editable, mirroring the add-ons lifecycle.

- **Data model:** new `Proposal.trackRecord` jsonb column (`0006_track_record.sql`, applied to
  prod), `TrackRecordConfig { intro, caseStudies: [{ text, href }] }` in types.ts, added to
  `FrozenContent` so it freezes + hashes at send like tokens/paymentConfig. `trackRecord.ts` now
  exports the fixed heading + disclaimer, `SUGGESTED_*` reference data, `LEGACY_TRACK_RECORD`, and
  `resolveTrackRecord()` (null -> legacy 3, explicit/even-empty -> as-is). `frozenTrackRecord()`
  helper in signingService.ts.
- **Decisions (Rahul):** editable = intro + case studies (text + optional URL); heading +
  disclaimer stay fixed; new proposals **start blank** and zero case studies **hides the whole
  section**. Legacy/pre-migration rows fall back to the original 3 so the one in-flight proposal
  (ConnectHealth) is unchanged.
- **Dynamic footnotes:** numbering is now computed in `buildProposalSections` - the disclaimer is
  note 1 only when the section shows; otherwise scope/timeline/investment renumber 1/2/3. The
  disclaimer marker moved onto the section heading (robust to an empty intro).
- **Form:** new "Our Track Record" card (intro + repeatable text/URL rows, max 6, add/remove,
  "Load suggested examples"); `Content.TrackRecord` import key (accepts `url` or `href`); threaded
  through create/update/send/revise + the edit page.
- **Renderers:** web + PDF guard the block (hidden when empty), render link-or-plain per row; no
  style changes (links already blue/underlined). `/docs` gained a Content.TrackRecord section;
  testProposalTokens.json carries a block.
- **Verified:** 74 tests (was 65; +9 - schema, present/absent renumber, legacy fallback), pdfSmoke
  rendered both states to docs/pdfSmoke.pdf + pdfSmoke-empty.pdf and visually read (links, heading
  marker, plain-text bullet, renumbering all correct), lint clean, production build green, migration
  applied + Prisma client regenerated. Committed (`ff675ce`), pushed to
  `HQ-RSL-A/proposal-generator` main, deployed to proposals.rsla.io (landing 200, /docs +
  /dashboard gated 307). In-app click-through (auth-gated) left for Rahul to test.

## 2026-06-15 (cont.) - Shipped the polish; wiped prod proposals; external-cleanup status

- The polish above shipped: commit `289dcc2`, live on prod (proposals.rsla.io,
  `dpl_DcDHLPmZdt…`, Ready). Local `npm run build` + in-browser QA passed first. (A concurrent
  Claude session's `e44b238 import flat pricing` had landed on `main` moments earlier and
  swept up the LOG note + its own files - unrelated; left untouched. Scope your commits to
  your own files and `git fetch` before pushing - the tree changes under you here.)
- **Deleted ALL proposals from prod at Rahul's request** (both were his tests):
  `Valley Oak Landscape Co` (SIGNED, payment AWAITING, 2 sigs + executed PDF) and
  `Meridian Test Co` (VOIDED). Confirmed scope first because one looked like a real signed
  contract; Rahul confirmed both disposable. Hard-deleted by id in a txn; `onDelete: Cascade`
  cleared every child (verified 0 parties/sigs/docs/payments/jobs/events/emails). One-off
  list/delete scripts removed after.
- External cleanup:
  - **Notion - nothing to clean (no-op).** The sync only *updates* an existing CRM row matched
    by company name in DB `2e6fbb11…806d`; neither company had a row. The
    "Proposal for Christian (Valley Oak Landscape Co)" page is Rahul's real **high-priority
    task** in Lalia's Tasks - left untouched (so Valley Oak/Christian is a real lead he tested
    the tool with).
  - **Blob - PENDING (handoff).** Orphaned `proposals/{id}/…` signature PNGs + Valley Oak
    `signed.pdf` remain (private, now unreferenced). Cannot delete from CLI - local OIDC is
    development-scoped and the store rejects it; no static RW token exists. **Next step:** in
    the Vercel dashboard Blob browser delete the `proposals/` prefix (KEEP
    `settings/admin-signature.png`), or paste a dashboard RW token and I'll
    `vercel blob del`. (Details now in BRAIN Gotchas.) **Superseded (2026-06-19):** do NOT
    blanket-delete the `proposals/` prefix - a later spot-check found leftover blobs mapping to
    live `Proposal` rows, so DB-verify each `{id}` first (orphan only if no `Proposal` row owns
    it). See the reframed ROADMAP cleanup item + the BRAIN Blob gotcha.
  - **Stripe - left to auto-expire.** Any unpaid live Checkout Session from the Valley Oak
    test self-expires (~24h); declined to pull the live key (safety guard + needless exposure).
- Upgraded Vercel CLI 53.1.1 → 54.14.0 (adds blob `--oidc-token`/`--store-id` flags).
- BRAIN.md updated: Blob write-lifecycle + the CLI-can't-delete-locally reality, and the
  env-var table corrected (no static `BLOB_READ_WRITE_TOKEN`; OIDC via `BLOB_STORE_ID`).
## 2026-06-15 - Proposal-detail polish (delete confirm + audit trail)

- Delete-draft no longer fires the browser's native `confirm()` "system card". New
  `brandConfirm()` in `src/lib/toast.tsx` renders a top-center card in the same family as
  `brandToast` (dark info-tone fill, icon badge, title/description) with Keep / Delete
  buttons (active:scale press feedback). Returns a `Promise<boolean>`; resolves false on
  cancel/dismiss/timeout, true on confirm. `proposalActions.tsx` awaits it before deleting.
- Audit timeline (`auditTimeline.tsx`) rebuilt from the `border-l … -left-[31px]`
  magic-number layout to a per-row flex layout. Connector is `left-3.5 -translate-x-1/2`
  under a 28px badge, so the line threads exactly through every icon center - verified in a
  real browser: badge-center minus line-center delta = 0px on every row (the prior
  off-center complaint is gone).
- Icons are now color-coded SVG badges by event family (slate/blue/violet/indigo/emerald/
  amber/rose/cyan) - tinted fill + saturated glyph + faint ring - replacing the flat mono
  icons. Bigger badges (h-7) and cleaner spacing.
- Verified via a throwaway no-auth `/devpreview` route (deleted after QA) since the admin
  view is Google-OAuth gated; screenshots + DOM measurements confirmed centering, colors,
  and that the confirm buttons dismiss/resolve correctly. No console errors.

## 2026-06-14 - Post-ship cleanup (prod proposals + dead component)

- Cleared the prod DB to a clean slate for the real pipeline. Deleted 3 test proposals -
  "Ongoing SEO Phase II" and "Lauda Lasun" (both SBC, SIGNED/PAID in test-mode Stripe) and the
  "[TEST] Brightline" rehearsal - plus 33 webhook dedup rows; cascade removed their parties,
  signatures, audit events, emails, payments, documents, and jobs. **Kept the one real
  prospect: "Website Stabilization & Refresh for ConnectHealth Staff" (VIEWED).** Script:
  `.tmp/keepOneProposal.ts` (gitignored) - keep-by-title with a one-keeper safety abort + dry-run.
- Deleted the now-unused `signInVisual.tsx` (replaced by the sign-in abstract art panel). It was
  already unimported, so no redeploy was needed.
- Note: deleting those test proposals orphaned their signature PNGs / executed PDFs in Vercel
  Blob (harmless, tiny, private) - this is the backlog "orphaned-blob cleanup" item.

## 2026-06-14 - Landing + sign-in premium redesign (shipped + deployed)

Rahul flagged the landing + sign-in as generic. Reworked both to "light but premium"
(his pick over dark / bold-blue). Committed `8a3266a`, pushed to
`HQ-RSL-A/proposal-generator` main, deployed to prod via `vercel deploy --prod`.

- **Landing** (`page.tsx`): dropped the gradient-text cliche for an oversized Satoshi
  headline with a single Anchor Blue accent line; a visible spotlight wash; the dashboard
  screenshot (`docs/mockups/dashboardMockupPro.png` to `public/appPreview.png`, KPI cards with
  sparkline trends) as a glowing cursor-tilt centerpiece (new client `landing/appPreview.tsx`,
  spring tilt + entrance, reduced-motion safe); the generic 3-feature grid replaced with
  editorial 01/02/03 steps that map to the headline (in-view `landing/reveal.tsx`); a trust
  strip; the white (canonical) Google CTA. Removed the "Internal tool for the RSL/A team" eyebrow.
- **Sign-in** (`sign-in/page.tsx`): first mirrored the landing; then reworked toward a
  21st.dev reference (easemize/sign-in default) as a split with a "Welcome" form + art panel,
  no testimonial. Final per Rahul: LIGHT-themed form (re-unified with the landing) + an
  on-brand abstract art panel. The art is original, generated via Gemini
  `gemini-3-pro-image-preview` (glass ribbons in blue/cyan/indigo/violet, 896x1200) to
  `public/signinArt.png`, `object-cover`. `signInVisual.tsx` (old tilt card) is now unused.
- **Motion** (emilDesignEng): strong ease-out `cubic-bezier(0.23,1,0.32,1)`, staggered hero
  entrance, CTA lift/press (`.cta-lift` in `globals.css`, shadow no longer hardcoded blue),
  tilt spring `{stiffness:150,damping:20,mass:0.5}`; transform/opacity only. New shared
  `googleG.tsx`.

Verified in Chrome at 1440px + 390px (landing hero/steps, sign-in both themes), lint clean,
65 tests, production build green. Open follow-up: delete the now-unused `signInVisual.tsx`;
optionally regenerate the sign-in art.

## 2026-06-14 - Session wrap (big session, all shipped + pushed)

Everything below from 2026-06-13/14 is committed, pushed to `HQ-RSL-A/proposal-generator`
(main in sync), and deployed to proposals.rsla.io. Per-feature detail in the entries below;
this is the cold-start summary.

Shipped this session:

- **Optional add-ons + 50% deposit** (new payment capabilities). Add-ons: global, one-time or
  recurring, client multi-selects. Deposit: charges only the deposit on the one-time build fee
  (payment mode), defers the retainer + recurring add-ons; balance collected manually (no
  payments-schema change). New `effectiveCheckout` resolver, `Proposal.selectedAddOnIds`
  (migration 0005). See BRAIN.md "Add-ons + deposit".
- **Signing fixes:** signature pad re-fits on rotation (ink tracks the finger); no more
  auto-scroll to fields (chip + button lead instead); action bar no longer crushed on mobile.
- **Mobile pass, whole app:** dashboard (card list), nav (hamburger), and the internal forms /
  detail tabs / settings are responsive.
- **`/docs`** documents add-ons + deposit + the `Investment.AddOns`/`DepositPercent` import keys.
- **Design pass:** bolder landing (centered gradient hero + a browser-framed app snapshot on a
  glow), a lighter **interactive** sign-in (cursor-tilt proposal card via `motion`, left panel;
  Google button right), 6-KPI dashboard (win rate, contracted one-time, MRR, signed this month
  vs last, avg time-to-sign, oldest open).
- **Admin toasts** unified into a shared `brandToast` helper (`src/lib/toast.tsx`); the signing
  flow uses it too. The pre-existing `signatureModal` lint error is fixed - `npm run lint` is green.

Decisions: deposit = tool charges deposit only, build-fee only, retainer deferred (minimal, no
schema change); sign-in went dark-split → then reworked to the lighter interactive split per
Rahul's 21st.dev reference; dashboard KPIs = all 6.

Left (both Rahul's call): (1) **Stripe live-key swap** - the only revenue blocker (runbook at
`docs/stripeKeySwapGuide.md`). (2) Clear the **[TEST] "Brightline"** proposal from the prod DB.
Backlog (ROADMAP): attorney MSA v4, in-app AI generation, tool-driven deposit balance + retainer
auto-start, orphaned-blob cleanup.

## 2026-06-13 - Sign-in: lighter interactive split (replaces the dark split)

Rahul linked a 21st.dev "animated characters login" and asked to adapt it lighter, with the
interactive element on one side and just the Google button. Since we have no password field
(and cartoon characters are off-brand), adapted the concept, not the cartoons: a light split.
Left (desktop only) is a soft `surface -> accent` gradient + faint dot texture holding an
interactive proposal card (`signInVisual.tsx`, a client component using `motion`) that tilts
toward the cursor (spring-smoothed rotateX/rotateY + a glow that drifts behind it), reduced-
motion safe. Right is the white sign-in: logomark + "RSL/A Proposals" + the Google button +
trust line. Mobile shows the form only (visual hidden below lg). The `auth()` redirect +
`signIn("google")` server action are untouched. Verified the layout in Chrome DevTools at
1280px and confirmed the tilt fires (the card's computed transform is a rotated matrix3d).
Build + lint clean. Supersedes the dark-split sign-in from the design pass.

## 2026-06-13 - Landing snapshot hero + signature-modal lint fix

- **Lint fix.** `signatureModal.tsx` reset-on-open moved off `useEffect` to the
  "adjust state during render" pattern (track `prevOpen`, reset errors + drawn when it flips).
  Same behavior, no cascading re-render, and it clears the only `npm run lint` error
  (pre-existing `react-hooks/set-state-in-effect`). `npm run lint` is now green.
- **Landing redesign (snapshot hero).** Modeled on the 21st.dev hero Rahul linked: replaced
  the two-column hero with a centered hero (eyebrow pill + big gradient headline + subtext +
  single CTA) and a large **browser-framed app snapshot** below it on a glow. The snapshot is
  div-built (window chrome with a `proposals.rsla.io/sign` URL pill) showing a mock signing
  doc: logomark + Signed chip, content lines, the 3 tier cards (Growth highlighted +
  RECOMMENDED), and a cursive signature block + "$3,000 paid" badge. Entrance animation only
  (removed the now-unused `floaty` keyframe). Verified in Chrome DevTools at 1280px + 390px.

Build + lint + 65 tests green.

## 2026-06-13 - Admin action toasts: shared branded toast helper (Phase D)

Extracted the signing flow's branded `toast.custom` into `src/lib/toast.tsx` as `brandToast`
(top-center, icon, tone = brand/success/error/info) and pointed both the signing flow and the
admin actions at it, so admin feedback reads as deliberate instead of stock sonner.
`signingExperience.tsx` dropped its local `signToast` (and the now-unused toast/cn/Check/
TriangleAlert imports) and calls `brandToast` (identical markup, so the verified signing
behavior is unchanged). `proposalActions.tsx` (the void / revise / delete / PDF-generate /
regenerate + self-refresh actions all run through `run()`) now uses `brandToast` for its
success/error toasts. Build + lint clean, 65 tests green. Phase D, the last of the plan.

## 2026-06-13 - Design pass: bolder landing, dark-split sign-in, 6-KPI dashboard (Phase C)

Decisions: landing = bolder/more visual, sign-in = dark split, dashboard = all 6 KPIs.
Verified the two public pages in Chrome DevTools at 1280px + 390px; dashboard is auth-gated
(build-verified).

- **Landing (`app/page.tsx`)** - soft radial glows behind the hero, a big display headline
  with the last line in `.gradient-text`, a two-column hero with a floating div-built mock
  proposal card (logomark, Signed chip, a cursive signature, a "$3,000 paid" badge;
  `.animate-floaty` 6s, motion-safe; entrance via tw-animate-css), and bolder feature cards
  with gradient-blue icon chips. Logomark-only header kept.
- **Sign-in (`app/sign-in/page.tsx`)** - full-bleed two-panel: left Deep Slate panel with a
  blue radial glow + logomark + tagline, right white panel with the subtitle + Google button +
  a trust line. Mobile collapses to the white panel. The `auth()` redirect and the
  `signIn("google")` server action are untouched.
- **Dashboard (`app/(admin)/dashboard/page.tsx`)** - replaced the 3 ops stats with the 6-KPI
  set (win rate, contracted one-time, MRR, signed this month vs last, avg time to sign, oldest
  open), responsive `grid-cols-2 lg:grid-cols-3`. `StatCard` gained a context sub-line and an
  amber tone for an oldest-open over 14 days. All computed from the already-fetched array (+
  `new Date()`); MRR counts signed recurring deals + recurring add-ons, contracted counts
  one-time build fees + one-time add-ons. Added a count line above the list.

Added a motion-safe `floaty` keyframe to globals.css. Build + lint clean, 65 tests green.
Phase C of the plan.

## 2026-06-13 - /docs updated for add-ons + deposit (Phase B)

The agent-facing import-schema page predated add-ons/deposit. `src/app/(admin)/docs/page.tsx`
now documents both: the **Pricing (PaymentConfig)** section gained an "Optional add-ons" block
(`addOns[]`, one-time or recurring, multi-select, max 10, unique ids) and a "Deposit" block
(`deposit.depositPercent` 1-99 on the one-time build fee; retainer + recurring add-ons deferred
so only the deposit is charged at signing), plus a new "Investment.AddOns and deposit" import
block (`Investment.AddOns`, `Investment.DepositPercent`) mirroring `Investment.Structure`, and
two new gotchas. `docs/testProposalTokens.json` gained two add-ons (one one-time, one recurring)
so the ready-to-use token exercises them; ROADMAP's reference section updated to match. Build +
lint clean, test token is valid JSON. Phase B of the plan.

## 2026-06-13 - Mobile pass: internal forms + detail + settings (Phase A)

Continued the internal-app mobile pass. The recurring offender was `grid grid-cols-12` (and a
couple of `grid-cols-2`) that never collapsed, plus right-aligned button clusters crushing the
left text at 390px. Fixes:

- `proposalForm.tsx` - token field cards `grid-cols-1 sm:grid-cols-2`; `MoneyFields`
  `grid-cols-2 sm:grid-cols-12` (Label/Shown full-width, Charged + interval share a row on
  mobile); tier header stacks on mobile. Add-on rows inherit the MoneyFields fix.
- `sendForm.tsx` - party row `grid-cols-2 sm:grid-cols-12`: name + email full-width, payer +
  delete share a row on mobile.
- `teamSettings.tsx` - user rows stack the action buttons under the identity on mobile
  (`flex-col sm:flex-row`); "Add a teammate" grid responsive.
- `partyList.tsx` - party rows stack Copy link + Remind under the name on mobile.
- `systemHealth.tsx` - email-issue row wraps long content; cron row gets `min-w-0` + truncate
  so long paths don't overflow.
- `proposals/[id]/page.tsx` - detail `TabsList` is `w-full sm:w-fit` (even full-width tab bar
  on mobile, fit-content on desktop).

Build + lint clean, 65 tests green. Auth-gated screens, so verified by build; confirm on a
real phone. Shipped as Phase A of the approved 4-phase plan (mobile -> docs -> design pass ->
admin toasts).

## 2026-06-13 - Mobile: nav hamburger + signing action bar no longer crushed

Two phone fixes, both verified at a 390px viewport in Chrome DevTools (signing page loaded
via demoSeed; desktop re-checked at 1280px; demo proposal deleted from prod after).

- **Nav (`appShell.tsx`).** The header crammed logo + 3 text nav links + a full "New Proposal"
  button + avatar into one row and overflowed on mobile. Now: the horizontal nav + New Proposal
  button + avatar menu are `hidden md:*`, and below md a single hamburger (Menu icon) dropdown
  holds New proposal + the nav links + account + sign out. Desktop unchanged.
- **Signing action bar (`signingExperience.tsx`).** The bar's left block (signer name + status)
  got crushed to nothing by the buttons on a phone (what read as the "name cut off"). On mobile
  that block is now `hidden sm:block` and the buttons own the bar (`flex-1`), so the primary CTA
  is a full-width tap target; "Finish & continue to payment" shortens to "Finish & pay" on
  mobile. The floating chip + toasts already carry the guidance the status line gave. Desktop
  keeps name + status + buttons.

Build + lint clean. The nav fix is auth-gated so it was verified by code + build (the signing
bar was verified visually); confirm the nav hamburger on a real phone.

## 2026-06-13 - Dashboard mobile: card list instead of the wide table

Rahul: the dashboard should be simpler to use on mobile. The 5-column proposals table
cramped/overflowed on a phone. `dashboard/page.tsx` now computes each proposal's display row
once, then renders two views: the full table on `md+` (`hidden md:block`), and a tappable
card list below `md` (`md:hidden`) where each proposal is a card showing title (+version),
client + company, status/payment chips, the deal amount, and valid-until. The KPI row went
from stacked full-width cards to a compact 3-up strip on mobile (icon hidden, smaller
label/value), roomy cards on desktop. Added a header "New proposal" button (icon-only on
mobile). Press feedback on the cards (active:scale-[0.98], 150ms ease-out, per emilDesignEng);
no entrance animation (list is seen constantly); hover ring auto-gated by Tailwind v4's
hover media query. Build + lint clean. Scope: dashboard only; the rest of the internal-app
mobile pass (proposal form, detail tabs, settings) is still open. The 6-KPI "ops command
center" desktop redesign remains a separate task (awaiting visual sign-off). Verify on a
real phone.

## 2026-06-13 - Signing: no auto-scroll to signature fields (reverses earlier auto-advance)

Rahul: tapping a "tap to sign" box shouldn't auto-scroll the page; the signer should scroll
themselves or tap the button to jump to the next box. Reverses the earlier "auto-advance for
placement (Rahul)" call. In `signingExperience.tsx`: removed the post-adopt scroll-to-first
(handleAdopt) and the post-stamp scroll-to-next (handleStamp). The persistent floating chip
and the action-bar "Review and sign" button remain as the manual jump-to-field controls (both
still call scrollToSlot), and the toasts now point to scrolling/the button. handleStamp also
restructured to set state + toast outside the updater. Build + lint + 65 tests green.

## 2026-06-13 - Fix: signature pad misaligned after rotating the phone

Rahul on mobile: open /settings (or the signing modal), rotate to landscape, draw with a
finger -> the ink lands away from the finger, offset growing toward the right. Root cause in
`signaturePadCanvas.tsx`: the canvas backing store (canvas.width/height + ctx DPR scale) was
sized once on mount. Rotating changes the canvas CSS width but not the backing store, so the
alignment invariant `canvas.width === offsetWidth * ratio` breaks and signature_pad maps
touches to the wrong place. Fix: re-fit on every size change via ResizeObserver (+ a window
resize listener), recomputing width/height/ratio and preserving strokes with toData/fromData.
Also made the handle's `isEmpty` toData-based, since signature_pad keeps `_isEmpty` true after
fromData (would otherwise read empty after a re-fit restored the drawing). Build + lint clean.
Fixes both the admin saved-signature pad and the client signing modal.

## 2026-06-13 - Optional add-ons + 50% deposit (shipped to prod)

Two new payment capabilities, both extending the one resolver -> Stripe -> render surface.
Plan + decisions in `~/.claude/plans/need-to-add-a-fuzzy-hickey.md`. Build green, 65/65 tests
(was 47, +18), pdfSmoke rendered + visually read (add-ons table + payment schedule render
clean, no layout corruption).

- **Add-ons.** New `AddOn` type on `PaymentConfig` (global list; each one-time OR recurring).
  New `effectiveCheckout(config, tierId, addOnIds)` sibling to `effectiveLineItems` (the latter
  untouched so Notion still reads full base amounts) returns the full charge set with the
  deposit transform applied. Client multi-selects via checkboxes after the tier cards
  (`AddOnPicker` in proposalView), selection recorded on `Proposal.selectedAddOnIds` at sign
  time (migration 0005, jsonb default `[]`), parallel to `selectedTierId`. Toggling add-ons
  resets the two-place ceremony like a tier change. Rendered in web + PDF + admin preview;
  importable from the skill JSON via `Investment.AddOns`.
- **Deposit.** New `PaymentConfig.deposit { depositPercent }` (default 50). When set and an
  effective one-time build fee exists, the signing checkout charges ONLY the deposit as a
  single one-time line in `mode: "payment"` - the retainer (and any recurring add-ons) are
  DEFERRED, so no subscription opens at signing. Rahul collects the balance + starts the
  retainer manually (the chosen minimal approach; no payments-schema change, still one Payment
  row, `amountTotalCents` = the deposit). Payment schedule communicated on proposal/PDF/the
  `/paid` screen ("Deposit received, we're underway") + a deposit line on the receipt email.
  Notion CRM records the FULL contract value (base + add-ons), never the deposit.
- **Decisions** (from Rahul): tool charges deposit only; deposit on the build fee only;
  retainer deferred. Defaults taken: recurring add-ons also deferred under a deposit (session
  always payment-mode); max 10 add-ons; deposit configurable 1-99%.
- **Files:** types.ts (resolver), validation.ts, stripe.ts, signingService.ts,
  proposalContent.ts, proposalForm.tsx, proposalView.tsx, signingExperience.tsx, sign route +
  page, ProposalPdf.tsx + pdfSmoke, generatePdf.ts, admin detail page, outcomeCopy.ts + paid
  page, jobRunner.ts (Notion), email.tsx + templates.tsx (receipt), paymentState.ts. Migration
  `0005_addons_deposit.sql` applied to prod DB (additive, idempotent). New
  `effectiveCheckout.test.ts` + extended validation tests.
- **Open:** NOT committed or deployed yet. Pre-existing lint error in `signatureModal.tsx`
  (untouched by this work; newer react-hooks set-state-in-effect rule) is the only `npm run
  lint` failure. Manual e2e (configure -> send -> sign -> pay) still to do against a [TEST] draft.

## 2026-06-13 - Session wrap: client experience + receipts shipped; visual redesign next

Big session, all shipped to prod across many deploys (latest 9cdf60f). Done tonight:

- Planning sweep: 5 plan docs (`docs/plans/*`) + the Stripe key-swap runbook.
- Quick wins: audit-trail lucide icons, team-gated `/docs` schema page, logo-only branding.
- Signing flow redesign, mobile-first + phone-tested with Rahul: Ready to sign -> Review
  and sign -> Finish, active-field ring, floating pointer chip, auto-advance, branded
  top-center toasts, elevated floating action bar, inline field validation,
  faded-until-valid CTA, caret fix, Recommended badge (web + PDF), scroll-to-pricing, no
  pre-highlight on the recommended tier.
- Post-sign outcome screens polished (OutcomeCard: dot texture, entrance, mobile) and
  payment copy unified + made status-based (`src/lib/outcomeCopy.ts`), method-agnostic.
- Receipts on every transaction: `invoice.paid` renewal handler (the launch-critical gap).

Decisions: auto-advance for placement (Rahul); all 6 dashboard KPIs; `/docs` team-gated;
`receipt_email` skipped (double-send risk; §11 evidence is the customer metadata); payment
messaging keyed to status, not method.

NEXT UP (open work, full detail in `ROADMAP.md`):

1. Landing + sign-in + dashboard design pass + the 6 KPIs - Rahul's flagged next. Plan +
   KPIs decided (`docs/plans/visualRedesign.md`); confirm visual direction per page, then
   build via the design skills.
2. Mobile optimization of the INTERNAL app (dashboard table, proposal form, detail tabs,
   settings). Client-facing surfaces are already done.
3. Admin-side action toasts (PDF / self-refresh) - the last slice of the toast pass.
4. Stripe live-key swap - the only go-live blocker (Rahul's step; runbook ready; it also
   subscribes `invoice.paid` live).
5. Eventual: attorney MSA v4, in-app AI generation, orphaned-blob cleanup.

HEADS UP: a [TEST] "Brightline" proposal + Rahul's sent copy are still in PROD (kept for
testing) - clear before launch (the `.tmp/clearTestData.ts` pattern). Commits this session
are local + deployed via Vercel CLI; NOT pushed to GitHub origin yet (ask-first).

## 2026-06-13 - Receipts on every transaction: invoice.paid renewal handler

Closed the launch-critical silent-renewal gap. Added an `invoice.paid` case to the Stripe
webhook that, for `billing_reason: "subscription_cycle"` only (so the first charge -
covered by checkout.session.completed - never double-sends), maps the invoice to its
proposal via `stripeSubscriptionId`, logs a PAYMENT_PAID (kind: subscription_renewal)
event, and sends the branded `payment_received_client` receipt + admin notice for that
month's amount. Does NOT touch paymentStatus (already PAID); idempotent via
`recordWebhookOnce`; emails via the self-healing `sendTemplateEmail`. Mirrors the existing
`invoice.payment_failed` + `applyPaidState` patterns.

Coverage is now complete: one-time, first subscription charge, and ACH were already
covered by `applyPaidState`; renewals were the missing piece. `receipt_email` on the
PaymentIntent was intentionally skipped (redundant with the customer email, risks a double
receipt; §11 evidence is the customer metadata). The live webhook subscribes `invoice.paid`
at the Stripe swap (runbook already lists 6 events). Build green, 47 tests pass. Verify a
real renewal via a Stripe test event (runbook step 8) or the first live cycle.

## 2026-06-13 - Unified post-sign payment copy (status-based, method-agnostic)

Rahul: combine the messaging, don't distinguish by payment method. The duplicate copy on
`/sign/[token]/paid` and `/pay/[token]` (invalid link, payment confirmed, payment
clearing) now lives in `src/lib/outcomeCopy.ts` as a single source, so they can't drift.
Dropped the "bank transfer / ACH" wording and the bank icon (Landmark -> Clock);
messaging is keyed to STATUS (confirmed vs still clearing), never the method. Kept one
accuracy guardrail: a payment still clearing reads "Your payment is on its way", not
"you're all set" (card clears instantly, a transfer takes a day or two). `/pay` "Already
paid" now matches the `/paid` success. Emails left as is (they already fire only on
actual settlement, so they're status-based already). (3bd0378)

## 2026-06-13 - Post-sign outcome screens polished

`OutcomeCard` (shared by signed / paid / declined / expired / pay-recovery) now uses the
brand dot-pattern backdrop, a gentle fade+zoom entrance (reduced-motion safe), and
tighter mobile padding. One change lifts all five screens. Tier-card stacking and the
decline dialog were reviewed on mobile (fine, no changes). Client post-sign emails are
being verified live by Rahul via the [TEST] proposal in his inbox. (1480621)

## 2026-06-13 - Signing polish round 2 (pricing scroll, badge, CTA fade, caret)

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

## 2026-06-13 - Signing redesign shipped + phone-test fixes (bar, toasts, validation)

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

## 2026-06-13 - Signing flow redesign (mobile-first) built

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

## 2026-06-13 - Built the three safe quick wins (audit icons, /docs, logo-only)

Per Rahul's go-ahead ("safe quick wins now"). All in the working tree, verified, NOT
yet committed or deployed.

- **Audit-trail icons** - `auditTimeline.tsx` EVENT_META now maps each of the 24 event
  types to a lucide icon (emoji strings gone), with tone colors (emerald for
  signed/paid, red for failed/declined/voided/expired/bounced, muted otherwise). Kept
  the unknown-type fallback (Dot). Internal admin view only.
- **/docs page** - new team-gated `src/app/(admin)/docs/page.tsx` documenting the import
  schema with generic names (Acme Corp / Jordan Avery). The field table is derived from
  `TOKEN_KEYS` and `FIELD_META` is typed `Record<keyof TokensJson>`, so the build fails
  if types.ts drifts. Added a "Docs" nav item (all roles). Covers TokensJson, every
  PaymentConfig shape, Investment.Structure, and the gotchas.
- **Logo-only** - removed the wordmark `<span>`s from the landing header and the app
  nav; emails + PDF were already logomark-only. Net: 2 deletions.

Verified: `npm run build` green (13 routes incl. /docs), `npm test` 47/47.

Decisions captured for the later builds: signing redesign uses **auto-advance** to the
next field (Rahul overrode my tap rec); dashboard KPIs = **all 6**; /docs = team-gated.

Shipped: committed (1386023) + deployed to proposals.rsla.io (smoke-checked: landing
200, /docs gated 307, logomark 200). Not pushed to origin yet (ask-first).

## 2026-06-13 - Planning sweep: research-backed plans for all no-input items

Rahul asked to plan + research everything that doesn't need his input (incl. nicer
landing/login/dashboard), make the docs page generic, add a Stripe-swap guide + a
"receipt on every transaction" task, and not touch anything risky without thinking it
through. Ran four parallel research agents (sonnet) over the actual code + best
practices. No app code changed this session - plans only, per his "don't proceed if it
might alter something" guardrail.

Produced 5 docs:

- `docs/plans/signingFlowRedesign.md` - mobile signing rework (collect-then-place,
  "Ready to sign" → "Review and sign", a "next field" chip replacing the auto-scroll),
  toast redesign (top-center, persistent, role=alert), audit-trail lucide icons.
  Phase enum is client-only; the one-shot sign transaction + stamp timestamps untouched.
- `docs/plans/visualRedesign.md` - landing (prestige product page), sign-in (dark
  split), dashboard (6-KPI ops view, all computable from current schema), logo-only
  (net = 2 JSX deletions; emails/PDF already correct).
- `docs/plans/transactionReceipts.md` - **found a real gap:** subscription RENEWALS
  fire no receipt (no `invoice.paid` handler). Plan: branded Resend receipts on every
  type, Stripe emails off, add `invoice.paid` (billing_reason guard) + set
  `receipt_email`. Live webhook is **6 events, not 5**.
- `docs/plans/tokenSchemaDocsPage.md` - generic `/docs` page, team-gated, table driven
  off an exhaustive `Record<keyof TokensJson>` so it can't drift from types.ts. Noted
  ROADMAP drift (both date fields self-heal; recurring regex matches mo/quarter/yr too).
- `docs/stripeKeySwapGuide.md` - full swap runbook (Rahul does dashboard key+webhook,
  Claude does env swap + deploy + verify; $1 live smoke test + rollback).

ROADMAP updated: 2 new tasks added earlier (Stripe-swap guide, receipts), blocker
corrected to 6 webhook events, and a "Detailed plans" index added. Open decisions for
Rahul: visual direction per page, the dashboard KPI set, docs-page gating, and the
three signing-redesign choices (button copy, affordance style, tap-vs-auto-advance).

## 2026-06-13 - Backlog grew: client-experience polish (Rahul mobile test)

Four new ROADMAP items under "Client experience and polish", from Rahul testing
the signing flow on a phone:

- **Signing ceremony UX redesign (mobile-first)** - collect name/title/signature
  FIRST under a "Ready to sign" button, then the button flips to "Review and Sign"
  and enters a tap-to-place mode (signature already adopted, just stamp fields). A
  floating "jump to next field" pointer replaces the auto-scroll-to-bottom and also
  catches any field left unsigned. Goal: foolproof for non-technical/older signers.
- **Toast / notification redesign** - in-flow guidance ("tap the fields to sign")
  is missed: bottom-right, too brief, low-priority feel. Make prominent +
  persistent, recenter, rewrite copy. Mobile + desktop.
- **Audit trail icons** - swap emojis for clean SVG/lucide icons per event type.
- **Logo-only branding** - RSL/A logomark with no adjacent text everywhere, hero
  first, then navbar/emails/PDF/sign-in.

No code yet - backlog capture only. Build-time questions (button copy, pointer
style, auto-advance vs tap) noted inline in ROADMAP.

## 2026-06-13 - Backlog groomed + reusable test token + GEMINI.md

- **ROADMAP.md created** (open/planned work, linked from README). Three new items from
  Rahul: (1) whole-app mobile optimization across screen sizes, client signing flow first;
  (2) landing + dashboard design pass with decision-useful KPIs (win rate, contracted
  value, time-to-sign/pay, MRR); (3) an in-app `/docs` page documenting the token schema
  for AI agents. Go-live blocker (Stripe live-key swap) and eventual items (attorney MSA
  v4, in-app AI generation, orphaned-blob cleanup) also tracked there.
- **Answered: pasting JSON is optional.** `/proposals/new` has a labeled input for every
  field; the JSON paste only pre-fills them (it's the `generate-proposal` skill's output).
  Captured the 17-key `TokensJson` + `PaymentConfig` schema in ROADMAP's reference section.
- **docs/testProposalTokens.json** - reusable tiered test token (Brightline Test Co,
  3 tiers). Deliberately omits the two date fields so `normalizeImportedTokens` defaults
  them fresh (+30d) on every import, keeping it always signable. Validated against the real
  importer. Paste into the import box to spin up a full test proposal instantly.
- **GEMINI.md created**, mirroring CLAUDE.md (project folder had none; CLAUDE.md gained the
  no-emoji, two-place-ceremony, token-rotation-exception, font, and deploy-command rules
  this session).

Next: Stripe live-key swap is the only thing gating real revenue. For the planned work,
mobile-first is the suggested start (touches the live client experience; design pass can
ride along). Dashboard KPIs need Rahul's pick of which metrics matter most before building.

## 2026-06-13 - Cleared all test data from prod (pre-launch clean slate)

Rahul asked to clear the dashboard before the first real deal. Deleted all 5
test/demo proposals from the prod DB (`.tmp/clearTestData.ts`, gitignored):
2 [DEMO] (Brightline voided, Scorpion signed/paid), 3 [TEST] rehearsals
(signed/paid). Cascade removed their parties, signatures, audit events, email
logs, payments, documents, and jobs; also cleared 67 WebhookEvent dedup rows
(no FK to proposal) and nulled the self-referencing `parentId` revision links
first (no cascade on that relation). `proposals remaining: 0`.

Caveats: signature PNGs + executed PDFs remain in Vercel Blob as orphans
(harmless, tiny, private - deterministic paths if a purge is ever wanted).
Stripe still holds the test-mode customers/sessions/payments from these runs;
they clear naturally on the live-key swap (separate live data store). All
Stripe work (live keys, webhook, ACH) deferred by Rahul.

## 2026-06-13 - Rehearsal bug: success page died after token rotation (fixed + shipped)

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

**Re-test PASSED (Rahul, prod):** full loop on the new build end to end - sign
both places → pay (4242) → "You're all set" with a working download button,
executed copy delivered. The token-rotation race is closed. The entire
PandaDoc-replacement flow is now verified in production. Only remaining work:
the Stripe live-key swap (live restricted key → recreate webhook in live mode
→ swap STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET on Vercel).

## 2026-06-13 (cont.) - Executed-PDF redesign per Rahul's first-document review

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

## 2026-06-13 - Launch debugging: deploy, sign-in, PDF engine

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

## 2026-06-12 - Design system pass: emails, PDF, two-place signing, footnotes, alerts

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
  the MSA on the signing page AND dashboard preview (was PDF-only - that was the missing
  "second space to sign"). All applied signatures now visible everywhere via token-gated
  `/api/sign/[token]/signature/[partyId]` + admin `/api/proposals/[id]/signature/[partyId]`;
  drafts show empty slots built from tokens (parties only exist after send).
- **Footnotes, product-page style**: the four `*` fine-print lines became numbered
  superscript anchors (web: smooth-scroll, PDF: internal links) resolving in a Notes block
  after Acceptance. MSA deliberately untouched (selective emphasis in legal text invites
  weight arguments; attorney review pending).
- **PDF redesigned Stripe-clean** (modeled on rslaTools invoice generator): Inter body
  (statics extracted losslessly from the official Inter.ttc - never convert outlines) +
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
- **demoSeed.ts renamed to Brightline Test Co** - it still carried the real Scorpion name;
  completing a signature on it would have re-triggered the Notion CRM overwrite.
- Verified: tsc, lint, 47 tests, production build, pdfSmoke + visual read, Chrome
  walkthrough of the full ceremony, zero console errors.

**Shipped same day**: committed (78369d6) and deployed to proposals.rsla.io via
`vercel deploy --prod` (the Vercel project is CLI-deployed, NOT git-linked - a push alone
does not deploy). Post-deploy hotfix 0a13c06: the middleware matcher excluded static assets
by exact filename (icon.svg/logomark.svg), so the renamed .png logo + favicon 307'd to
sign-in on prod while dev looked fine (Vercel runs middleware before public/ assets; next
dev serves public/ first). Matcher now excludes by extension. Verified on prod: assets 200,
landing/sign-in render, dashboard still auth-gated, screenshots in .tmp/shots.

**Open**: Rahul's [TEST] Brightline rehearsal on the new build (draft
"[TEST] Full Rehearsal: Brightline Test Co" is seeded and ready to send), then live-key
swap. team@rsla.io group exists (confirmed).

## 2026-06-12 - SaaS layer + voice DNA pass

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

## 2026-06-12 - Visual demo + signing-consent hardening

- Seeded a demo proposal (`scripts/demoSeed.ts` - runs without Blob/Resend/Stripe) and
  walked the signing experience in Chrome: full document render (37 MSA sections, merged
  data), tier selection, signature modal (draw + 4 typed fonts), ESIGN consent. Screenshots
  in `docs/screenshots/`.
- Investigated phantom TIER_SELECTED audit events: DOM-order sweep of tier buttons ~500ms
  apart, only under the chrome-devtools MCP browser, never reproduced with a click listener
  armed, never persisted to DB (provably client-state only). Concluded automation-environment
  artifact, not an app bug.
- Hardening anyway: the signature modal now restates the selected tier + price at the
  moment of consent ("You're signing for: Growth - $3,000/month").

## 2026-06-11 - Initial build (full V1 codebase)

Planned and built the PandaDoc-replacement e-signing tool end-to-end in one session:

- **Plan**: explored `generateProposal` skill + expenseVault conventions; decisions locked
  with Rahul: V1 imports skill JSON (in-app AI generation = fast-follow), RSL/A signature
  auto-applies at send, per-proposal payment config, Resend for email.
- **Foundation**: Next 16 + Prisma 7 multiSchema (`proposals` schema in the shared Supabase
  project - free org is at the 2-project cap), NextAuth clone, middleware, migration SQL
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

