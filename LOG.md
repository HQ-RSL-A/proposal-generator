# LOG.md — proposalGenerator

## 2026-06-15 — Recurring + ACH + renewal verification (local sandbox, PASSED)

Closed the only go-live residual: the never-exercised subscription / ACH / renewal webhook paths
are now proven. All run in a local Stripe **Sandbox** (the `sk_test` key Rahul pasted into local
`.env`; a hard `sk_test` guard in the harness blocked any live call) — **prod live key untouched**.

- **Setup:** installed the Stripe CLI; `stripe listen --api-key <sandbox>` forwarded to
  `localhost:1235` and minted the `whsec` (written to local `.env`); dev booted on :1235.
  Confirmed first there was **no deploy gap** — prod serves the polished `--radius:.5rem` and the
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
  (harmless, joins the existing orphaned-row backlog — a precise purge was declined by the auto-mode
  guard, left for an authorized cleanup). Local `.env` keeps the sandbox `sk_test` key (gitignored)
  with `STRIPE_WEBHOOK_SECRET` reset to empty (refill from `stripe listen` next time). Reusable
  harness kept at `.tmp/paymentMatrix.ts` + `.tmp/test2.ts`.
- **Net:** recurring + ACH proposals are safe to send for real. The PandaDoc replacement is now
  verified across one-time, subscription, and ACH. Not committed (docs only this session).

## 2026-06-15 — Go-live verification + live $1 smoke test (PASSED)

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

## 2026-06-15 — UI/UX polish pass (tighter & crisper, whole web app)

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

## 2026-06-15 — Per-proposal editable Track Record (text + URL)

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
- **Dynamic footnotes:** numbering is now computed in `buildProposalSections` — the disclaimer is
  note 1 only when the section shows; otherwise scope/timeline/investment renumber 1/2/3. The
  disclaimer marker moved onto the section heading (robust to an empty intro).
- **Form:** new "Our Track Record" card (intro + repeatable text/URL rows, max 6, add/remove,
  "Load suggested examples"); `Content.TrackRecord` import key (accepts `url` or `href`); threaded
  through create/update/send/revise + the edit page.
- **Renderers:** web + PDF guard the block (hidden when empty), render link-or-plain per row; no
  style changes (links already blue/underlined). `/docs` gained a Content.TrackRecord section;
  testProposalTokens.json carries a block.
- **Verified:** 74 tests (was 65; +9 — schema, present/absent renumber, legacy fallback), pdfSmoke
  rendered both states to docs/pdfSmoke.pdf + pdfSmoke-empty.pdf and visually read (links, heading
  marker, plain-text bullet, renumbering all correct), lint clean, production build green, migration
  applied + Prisma client regenerated. Committed (`ff675ce`), pushed to
  `HQ-RSL-A/proposal-generator` main, deployed to proposals.rsla.io (landing 200, /docs +
  /dashboard gated 307). In-app click-through (auth-gated) left for Rahul to test.

## 2026-06-14 — Post-ship cleanup (prod proposals + dead component)

- Cleared the prod DB to a clean slate for the real pipeline. Deleted 3 test proposals —
  "Ongoing SEO Phase II" and "Lauda Lasun" (both SBC, SIGNED/PAID in test-mode Stripe) and the
  "[TEST] Brightline" rehearsal — plus 33 webhook dedup rows; cascade removed their parties,
  signatures, audit events, emails, payments, documents, and jobs. **Kept the one real
  prospect: "Website Stabilization & Refresh for ConnectHealth Staff" (VIEWED).** Script:
  `.tmp/keepOneProposal.ts` (gitignored) — keep-by-title with a one-keeper safety abort + dry-run.
- Deleted the now-unused `signInVisual.tsx` (replaced by the sign-in abstract art panel). It was
  already unimported, so no redeploy was needed.
- Note: deleting those test proposals orphaned their signature PNGs / executed PDFs in Vercel
  Blob (harmless, tiny, private) — this is the backlog "orphaned-blob cleanup" item.

## 2026-06-14 — Landing + sign-in premium redesign (shipped + deployed)

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

## 2026-06-14 — Session wrap (big session, all shipped + pushed)

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
  flow uses it too. The pre-existing `signatureModal` lint error is fixed — `npm run lint` is green.

Decisions: deposit = tool charges deposit only, build-fee only, retainer deferred (minimal, no
schema change); sign-in went dark-split → then reworked to the lighter interactive split per
Rahul's 21st.dev reference; dashboard KPIs = all 6.

Left (both Rahul's call): (1) **Stripe live-key swap** — the only revenue blocker (runbook at
`docs/stripeKeySwapGuide.md`). (2) Clear the **[TEST] "Brightline"** proposal from the prod DB.
Backlog (ROADMAP): attorney MSA v4, in-app AI generation, tool-driven deposit balance + retainer
auto-start, orphaned-blob cleanup.

## 2026-06-13 — Sign-in: lighter interactive split (replaces the dark split)

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

## 2026-06-13 — Landing snapshot hero + signature-modal lint fix

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

## 2026-06-13 — Admin action toasts: shared branded toast helper (Phase D)

Extracted the signing flow's branded `toast.custom` into `src/lib/toast.tsx` as `brandToast`
(top-center, icon, tone = brand/success/error/info) and pointed both the signing flow and the
admin actions at it, so admin feedback reads as deliberate instead of stock sonner.
`signingExperience.tsx` dropped its local `signToast` (and the now-unused toast/cn/Check/
TriangleAlert imports) and calls `brandToast` (identical markup, so the verified signing
behavior is unchanged). `proposalActions.tsx` (the void / revise / delete / PDF-generate /
regenerate + self-refresh actions all run through `run()`) now uses `brandToast` for its
success/error toasts. Build + lint clean, 65 tests green. Phase D, the last of the plan.

## 2026-06-13 — Design pass: bolder landing, dark-split sign-in, 6-KPI dashboard (Phase C)

Decisions: landing = bolder/more visual, sign-in = dark split, dashboard = all 6 KPIs.
Verified the two public pages in Chrome DevTools at 1280px + 390px; dashboard is auth-gated
(build-verified).

- **Landing (`app/page.tsx`)** — soft radial glows behind the hero, a big display headline
  with the last line in `.gradient-text`, a two-column hero with a floating div-built mock
  proposal card (logomark, Signed chip, a cursive signature, a "$3,000 paid" badge;
  `.animate-floaty` 6s, motion-safe; entrance via tw-animate-css), and bolder feature cards
  with gradient-blue icon chips. Logomark-only header kept.
- **Sign-in (`app/sign-in/page.tsx`)** — full-bleed two-panel: left Deep Slate panel with a
  blue radial glow + logomark + tagline, right white panel with the subtitle + Google button +
  a trust line. Mobile collapses to the white panel. The `auth()` redirect and the
  `signIn("google")` server action are untouched.
- **Dashboard (`app/(admin)/dashboard/page.tsx`)** — replaced the 3 ops stats with the 6-KPI
  set (win rate, contracted one-time, MRR, signed this month vs last, avg time to sign, oldest
  open), responsive `grid-cols-2 lg:grid-cols-3`. `StatCard` gained a context sub-line and an
  amber tone for an oldest-open over 14 days. All computed from the already-fetched array (+
  `new Date()`); MRR counts signed recurring deals + recurring add-ons, contracted counts
  one-time build fees + one-time add-ons. Added a count line above the list.

Added a motion-safe `floaty` keyframe to globals.css. Build + lint clean, 65 tests green.
Phase C of the plan.

## 2026-06-13 — /docs updated for add-ons + deposit (Phase B)

The agent-facing import-schema page predated add-ons/deposit. `src/app/(admin)/docs/page.tsx`
now documents both: the **Pricing (PaymentConfig)** section gained an "Optional add-ons" block
(`addOns[]`, one-time or recurring, multi-select, max 10, unique ids) and a "Deposit" block
(`deposit.depositPercent` 1-99 on the one-time build fee; retainer + recurring add-ons deferred
so only the deposit is charged at signing), plus a new "Investment.AddOns and deposit" import
block (`Investment.AddOns`, `Investment.DepositPercent`) mirroring `Investment.Structure`, and
two new gotchas. `docs/testProposalTokens.json` gained two add-ons (one one-time, one recurring)
so the ready-to-use token exercises them; ROADMAP's reference section updated to match. Build +
lint clean, test token is valid JSON. Phase B of the plan.

## 2026-06-13 — Mobile pass: internal forms + detail + settings (Phase A)

Continued the internal-app mobile pass. The recurring offender was `grid grid-cols-12` (and a
couple of `grid-cols-2`) that never collapsed, plus right-aligned button clusters crushing the
left text at 390px. Fixes:

- `proposalForm.tsx` — token field cards `grid-cols-1 sm:grid-cols-2`; `MoneyFields`
  `grid-cols-2 sm:grid-cols-12` (Label/Shown full-width, Charged + interval share a row on
  mobile); tier header stacks on mobile. Add-on rows inherit the MoneyFields fix.
- `sendForm.tsx` — party row `grid-cols-2 sm:grid-cols-12`: name + email full-width, payer +
  delete share a row on mobile.
- `teamSettings.tsx` — user rows stack the action buttons under the identity on mobile
  (`flex-col sm:flex-row`); "Add a teammate" grid responsive.
- `partyList.tsx` — party rows stack Copy link + Remind under the name on mobile.
- `systemHealth.tsx` — email-issue row wraps long content; cron row gets `min-w-0` + truncate
  so long paths don't overflow.
- `proposals/[id]/page.tsx` — detail `TabsList` is `w-full sm:w-fit` (even full-width tab bar
  on mobile, fit-content on desktop).

Build + lint clean, 65 tests green. Auth-gated screens, so verified by build; confirm on a
real phone. Shipped as Phase A of the approved 4-phase plan (mobile -> docs -> design pass ->
admin toasts).

## 2026-06-13 — Mobile: nav hamburger + signing action bar no longer crushed

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

## 2026-06-13 — Dashboard mobile: card list instead of the wide table

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

## 2026-06-13 — Signing: no auto-scroll to signature fields (reverses earlier auto-advance)

Rahul: tapping a "tap to sign" box shouldn't auto-scroll the page; the signer should scroll
themselves or tap the button to jump to the next box. Reverses the earlier "auto-advance for
placement (Rahul)" call. In `signingExperience.tsx`: removed the post-adopt scroll-to-first
(handleAdopt) and the post-stamp scroll-to-next (handleStamp). The persistent floating chip
and the action-bar "Review and sign" button remain as the manual jump-to-field controls (both
still call scrollToSlot), and the toasts now point to scrolling/the button. handleStamp also
restructured to set state + toast outside the updater. Build + lint + 65 tests green.

## 2026-06-13 — Fix: signature pad misaligned after rotating the phone

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

## 2026-06-13 — Optional add-ons + 50% deposit (shipped to prod)

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
  single one-time line in `mode: "payment"` — the retainer (and any recurring add-ons) are
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

## 2026-06-13 — Session wrap: client experience + receipts shipped; visual redesign next

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

1. Landing + sign-in + dashboard design pass + the 6 KPIs — Rahul's flagged next. Plan +
   KPIs decided (`docs/plans/visualRedesign.md`); confirm visual direction per page, then
   build via the design skills.
2. Mobile optimization of the INTERNAL app (dashboard table, proposal form, detail tabs,
   settings). Client-facing surfaces are already done.
3. Admin-side action toasts (PDF / self-refresh) — the last slice of the toast pass.
4. Stripe live-key swap — the only go-live blocker (Rahul's step; runbook ready; it also
   subscribes `invoice.paid` live).
5. Eventual: attorney MSA v4, in-app AI generation, orphaned-blob cleanup.

HEADS UP: a [TEST] "Brightline" proposal + Rahul's sent copy are still in PROD (kept for
testing) — clear before launch (the `.tmp/clearTestData.ts` pattern). Commits this session
are local + deployed via Vercel CLI; NOT pushed to GitHub origin yet (ask-first).

## 2026-06-13 — Receipts on every transaction: invoice.paid renewal handler

Closed the launch-critical silent-renewal gap. Added an `invoice.paid` case to the Stripe
webhook that, for `billing_reason: "subscription_cycle"` only (so the first charge —
covered by checkout.session.completed — never double-sends), maps the invoice to its
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
