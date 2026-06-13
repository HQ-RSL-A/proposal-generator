# Plan — Signing flow redesign, toasts, audit-trail icons

Status: planned, not started. Code-grounded (file refs verified by research agent;
re-confirm symbol names at build). Ship order at the bottom.

Decisions needed from Rahul are marked **[DECIDE]**. My recommendation follows each.

---

## 1. Signing ceremony UX redesign (mobile-first)

**Problem.** On a phone, the current flow drops people. Tapping any signature slot
opens the modal; the signer enters name/title/company + draws/types + consents, then
has to *find and tap both slots themselves*. The only guidance is one toast that is
easy to miss. Older / less technical signers get stuck on "what do I tap now?".

**Target flow (Rahul's spec).**
1. CTA starts as **"Ready to sign"** → opens the modal to collect name + title +
   company + signature + ESIGN consent *first*.
2. CTA then becomes **"Review and sign"** → enters a *placement mode* where the
   signer only taps each field to stamp the already-adopted signature (nothing to
   re-enter).
3. After the first stamp, do **not** auto-scroll to the bottom. Show a small floating
   "jump to next field" affordance that scrolls to + highlights the next empty field.
4. If a field is left unsigned, the same affordance routes them to it before Finish.

**Key files**
- `src/components/signing/signingExperience.tsx` — state machine, `handleAdopt`,
  `handleStamp`, `handleSubmit`, `handleTierSelect`, `PLACE_ORDER`, `stamped`,
  `stampTimes`.
- `src/components/signing/signatureModal.tsx` — adopt UI (draw/type, title/company,
  consent).
- `src/components/proposal/proposalView.tsx` — `SignatureSlotBox` (the two slots),
  `TierCards`.

**Implementation**
1. Add a client-only phase enum to `SigningExperience`:
   `"idle" | "adopted" | "complete"`. Pure view state; the server/DB layer
   (one-shot transaction, stamp timestamps) is untouched.
2. CTA label + action by phase:
   | Phase | Label | Action |
   |---|---|---|
   | idle, tier not picked (tiered) | "Select a plan to continue" (disabled) | — |
   | idle, ready | **"Ready to sign"** | open modal |
   | adopted, not all stamped | **"Review and sign"** | scroll to next unsigned field |
   | adopted, all stamped | **"Finish and submit"** | `handleSubmit` |
   | submitting | spinner, disabled | — |
3. Stop slot taps from opening the modal when unadopted. Instead flash the slot +
   point them to the CTA. After adoption, slot taps stamp as today.
4. Remove the auto-`scrollIntoView` in `handleAdopt`. Replace with the floating
   "next field" chip (appears once `stamped.proposal` is true and `stamped.agreement`
   is false). Tapping it scrolls to `#slot-agreement` and applies a ~2s highlight ring.
5. Required-field enforcement: if Finish is hit with a field unsigned, run the same
   scroll+highlight to the first empty slot and flag it.
6. Tier change after adoption already resets the ceremony (`handleTierSelect`); keep
   it, just clarify the toast ("Pricing updated. Sign again to continue.").

**[DECIDE] Button copy.** Rec: "Ready to sign" → "Review and sign" → "Finish and
submit". ("Review and sign" reads friendlier than "Place signatures".)

**[DECIDE] Affordance style.** Rec: a *labeled chip* (`> Next: Agreement signature`),
not a bare chevron — a chevron alone is meaningless to non-technical signers. Pill,
44px touch target, bottom-center, animate only the icon (respect
`prefers-reduced-motion`). Avoid a FAB (competes with browser chrome).

**DECIDED (Rahul, 2026-06-13): auto-advance.** After each stamp, auto-scroll to and
highlight the next empty field. Keep the chip too, as the way back to any field that
was skipped and to surface "one field left" before Finish. (My earlier rec was
tap-to-advance; Rahul chose auto-advance.) Respect `prefers-reduced-motion` (jump
without an animated scroll), and don't yank the view while the signer is mid-stamp.

**Risks**
- Two-place ceremony integrity: keep `PLACE_ORDER` and the `allStamped` guard; the
  submit body still reads `stampTimes.current` for both `stampedProposalAt` /
  `stampedAgreementAt`. Never mark a slot done without `handleStamp`.
- One-shot sign transaction (serializable `signedAt IS NULL`): API untouched; this is
  all client view state.
- Audit events: provisional `TIER_SELECTED` track stays client-side; the definitive
  event still fires server-side in `signingService.ts`. Don't move it.
- The "next field" chip must only scroll/highlight — never call `handleStamp`.

---

## 2. Toast / notification redesign (mobile + desktop)

**Problem.** Action-critical guidance ("tap the fields to add your signature") sits
bottom-right, auto-dismisses in ~4s, reads as low priority, and gets missed.

**Key files**
- `src/components/ui/sonner.tsx`, mounted in `src/app/layout.tsx` (`position="bottom-right"`).
- Toast call sites in `signingExperience.tsx` (6 of them).
- Admin self-refresh timers in `src/components/proposals/proposalActions.tsx`
  (admin-only; not on the signing page — leave alone).

**Implementation** — two tiers, do NOT change the global Sonner position (would affect
admin too); override per-call:
- **Action-critical** (signer can't proceed without it): reposition `top-center`,
  duration 8–10s or manual dismiss, `role="alert"` / `aria-live="assertive"`, stable
  `id` so retries replace instead of stack.
- **Routine confirmations**: keep ~4s bottom-right.

Reclassify: "select a plan first", network/API submit failures, decline failure →
action-critical. Pricing-updated → routine. With the new "next field" chip carrying
navigation, the "signature saved" toast can shrink to a short routine confirm.

Copy (voice-DNA, no dashes): e.g. "Signature saved. Tap each highlighted field below
to place it." / "Select a plan before signing." / "Could not submit. Check your
connection and try again."

**Risks** — `top-center` is also fine on desktop; verify wide viewports. Dedupe via
stable ids. If shipping without item 1, keep the old "adopted" toast duration.

---

## 3. Audit-trail icons (internal, no emojis) — DONE 2026-06-13

**Problem.** The audit timeline on the admin proposal detail view uses emojis per
event type. Replace with clean lucide SVGs (lucide is already a dependency).

**Key files**
- `src/components/proposals/auditTimeline.tsx` — `EVENT_META` map + render loop.
- Rendered at `src/app/(admin)/proposals/[id]/page.tsx`.

**Implementation** — change `EVENT_META[*].icon` from an emoji string to a lucide
component ref; render `<meta.icon className="h-4 w-4 ..." />`. Optional `variant`
field for color (destructive for failed/bounced/declined/voided; primary for
all-signed/paid; muted otherwise). Proposed mapping (24 event types):

CREATED→FilePlus, SENT→Send, REVISED→RefreshCw, EMAIL_SENT→Mail,
EMAIL_DELIVERED→MailCheck, EMAIL_OPENED→MailOpen, EMAIL_BOUNCED→MailX,
PAGE_VIEWED→Eye, TIER_SELECTED→SlidersHorizontal, ESIGN_CONSENTED→SquareCheck,
PARTY_SIGNED→PenLine, ALL_SIGNED→BadgeCheck, PARTY_DECLINED→Ban,
PROPOSAL_VOIDED→Trash2, PROPOSAL_EXPIRED→Timer, CHECKOUT_CREATED→ShoppingCart,
PAYMENT_PAID→CircleDollarSign, PAYMENT_PROCESSING→Building2, PAYMENT_FAILED→CircleX,
CHECKOUT_EXPIRED→Clock, PDF_GENERATED→FileCheck, NOTION_SYNCED→Database,
STRIPE_METADATA_ATTACHED→Shield, REMINDER_SENT→BellRing, fallback→Dot.

**Risks** — internal-only, cosmetic, isolated. Safest item to ship. Confirm the exact
event-type list against the Prisma enum at build (add a `Dot` fallback for any new
types). Validate icon picks visually.

---

## Recommended ship order
1. **Audit icons** — isolated, internal, no input needed.
2. **Toasts** — isolated to call sites + per-call overrides.
3. **Signing redesign** — ship the CTA-phase change and the chip together (a partial
   deploy where the chip exists but slots still open the modal would be a confusing
   hybrid). Needs the three **[DECIDE]** answers first.
