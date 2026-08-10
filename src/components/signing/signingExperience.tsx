"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";
import { appScrollBehavior } from "@/lib/reducedMotion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ProposalView,
  type SignaturePlace,
  type SignerSlot,
} from "@/components/proposal/proposalView";
import { SignatureModal, type AdoptedSignature } from "@/components/signing/signatureModal";
import { computeDepositSchedule, type ProposalSections } from "@/lib/proposalContent";
import type { PaymentConfig } from "@/lib/types";
import { brandToast } from "@/lib/toast";
import { buildSelectedSummary, declineOutcome } from "@/lib/signingOutcome";

const PLACE_ORDER: SignaturePlace[] = ["proposal", "agreement"];

function scrollToSlot(place: SignaturePlace) {
  document
    .querySelector(`[data-signature-slot="${place}"]`)
    ?.scrollIntoView({ behavior: appScrollBehavior(), block: "center" });
}

export function SigningExperience({
  token,
  sections,
  paymentConfig,
  partyName,
  requiresTier,
  initialTierId,
  initialAddOnIds,
  willCheckout,
  validUntilLabel,
  clientSlots,
  rslaSlot,
}: {
  token: string;
  sections: ProposalSections;
  /** Frozen config, so the client can resolve the live deposit schedule + consent summary. */
  paymentConfig: PaymentConfig;
  partyName: string;
  requiresTier: boolean;
  initialTierId: string | null;
  initialAddOnIds: string[];
  willCheckout: boolean;
  validUntilLabel: string | null;
  clientSlots: SignerSlot[];
  rslaSlot: SignerSlot;
}) {
  const router = useRouter();
  const [selectedTierId, setSelectedTierId] = React.useState<string | null>(initialTierId);
  const [selectedAddOnIds, setSelectedAddOnIds] = React.useState<string[]>(initialAddOnIds);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [declineOpen, setDeclineOpen] = React.useState(false);
  const [declineReason, setDeclineReason] = React.useState("");
  // Two-stage decline: pick a reason, then an explicit "are you sure?" gate so a stray click
  // (someone meaning to go back) can't decline the deal.
  const [declineStage, setDeclineStage] = React.useState<"reason" | "confirm">("reason");
  const [submitting, setSubmitting] = React.useState(false);
  const [adopted, setAdopted] = React.useState<AdoptedSignature | null>(null);
  const [stamped, setStamped] = React.useState<Record<SignaturePlace, boolean>>({
    proposal: false,
    agreement: false,
  });
  const stampTimes = React.useRef<Record<SignaturePlace, string | null>>({
    proposal: null,
    agreement: null,
  });

  // View tracking — once per page load.
  React.useEffect(() => {
    fetch(`/api/sign/${token}/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "viewed" }),
    }).catch(() => {});
  }, [token]);

  function handleTierSelect(tierId: string) {
    setSelectedTierId(tierId);
    // A choice was made — the attention ring has done its job.
    document.querySelector("[data-tier-anchor]")?.removeAttribute("data-attention");
    // Changing the deal after adopting invalidates the ceremony: the consent
    // restated the old tier, so the signature has to be adopted again.
    if (adopted) {
      setAdopted(null);
      setStamped({ proposal: false, agreement: false });
      stampTimes.current = { proposal: null, agreement: null };
      brandToast(
        "brand",
        "Pricing updated",
        "Since the deal changed, please sign again to continue."
      );
    }
    fetch(`/api/sign/${token}/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "tier_selected", tierId }),
    }).catch(() => {});
  }

  function handleAddOnToggle(addOnId: string, checked: boolean) {
    setSelectedAddOnIds((prev) =>
      checked ? [...prev, addOnId] : prev.filter((id) => id !== addOnId)
    );
    // Toggling add-ons changes the price the consent restated, so re-adopt like a tier change.
    if (adopted) {
      setAdopted(null);
      setStamped({ proposal: false, agreement: false });
      stampTimes.current = { proposal: null, agreement: null };
      brandToast("brand", "Selection updated", "Since the deal changed, please sign again to continue.");
    }
  }

  // Live deposit schedule: depends on the chosen tier (flat is constant). Add-ons do not change it.
  const depositSchedule = React.useMemo(
    () => computeDepositSchedule(paymentConfig, selectedTierId),
    [paymentConfig, selectedTierId]
  );

  function openSignModal() {
    if (requiresTier && !selectedTierId) {
      brandToast("warning", "Select a plan before signing", "It's part of what you're agreeing to.", {
        duration: 6000,
      });
      const anchor = document.querySelector("[data-tier-anchor]");
      anchor?.scrollIntoView({ behavior: appScrollBehavior(), block: "center" });
      // Light the tier grid and keep it lit until a plan is picked (cleared in
      // handleTierSelect) — the guidance stays at the point of decision.
      anchor?.setAttribute("data-attention", "");
      return;
    }
    setModalOpen(true);
  }

  function handleAdopt(signature: AdoptedSignature) {
    setAdopted(signature);
    setModalOpen(false);
    // No auto-scroll: the signer scrolls to the box themselves, or taps the action-bar
    // button / the floating chip (both call scrollToSlot) to jump to it.
    brandToast(
      "brand",
      "Signature ready",
      "Now place it in the two highlighted boxes. Scroll to them, or tap the button below."
    );
  }

  function handleStamp(place: SignaturePlace) {
    if (stamped[place]) return;
    stampTimes.current[place] = new Date().toISOString();
    const next = { ...stamped, [place]: true };
    setStamped(next);
    // No auto-advance. The persistent chip + action-bar button lead to the next box.
    const remaining = PLACE_ORDER.find((p) => !next[p]);
    if (remaining) {
      brandToast(
        "brand",
        "Signature placed",
        "Scroll to the other box, or tap the button to jump to it.",
        { id: "stamp-progress" }
      );
    } else {
      brandToast("brand", "Both places signed", "Tap Finish at the bottom to submit.", {
        id: "stamp-progress",
      });
    }
  }

  const stampedCount = PLACE_ORDER.filter((p) => stamped[p]).length;
  const allStamped = stampedCount === PLACE_ORDER.length;
  const activePlace =
    adopted && !allStamped ? (PLACE_ORDER.find((p) => !stamped[p]) ?? null) : null;
  // The chip keeps its last label while fading out (activePlace goes null on the final stamp).
  const lastPlaceRef = React.useRef<SignaturePlace>("proposal");
  React.useEffect(() => {
    if (activePlace) lastPlaceRef.current = activePlace;
  }, [activePlace]);
  const chipPlace = activePlace ?? lastPlaceRef.current;

  async function handleSubmit() {
    if (!adopted || !allStamped || submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatureType: adopted.type,
          signaturePngDataUrl: adopted.pngDataUrl,
          adoptedName: adopted.adoptedName,
          signerTitle: adopted.signerTitle,
          signerCompany: adopted.signerCompany,
          fontFamily: adopted.fontFamily,
          esignConsent: true,
          selectedTierId,
          selectedAddOnIds,
          stampedProposalAt: stampTimes.current.proposal,
          stampedAgreementAt: stampTimes.current.agreement,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === "expired") router.push(`/sign/${token}/expired`);
        else if (data.code === "already_signed") router.push(`/sign/${token}/signed`);
        else brandToast("error", data.error ?? "Something went wrong", undefined, { id: "sign-submit" });
        return;
      }
      if (typeof data.redirectUrl === "string" && data.redirectUrl.startsWith("http")) {
        // Last signer with payment due — straight to Stripe Checkout.
        window.location.href = data.redirectUrl;
      } else {
        router.push(data.redirectUrl ?? `/sign/${token}/signed`);
      }
    } catch {
      brandToast("error", "Could not submit", "Check your connection and try again.", {
        id: "sign-submit",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleRedo() {
    setAdopted(null);
    setStamped({ proposal: false, agreement: false });
    stampTimes.current = { proposal: null, agreement: null };
    setModalOpen(true);
  }

  async function handleDecline() {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/sign/${token}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineReason.trim() || null }),
      });
      const data = await response.json();
      // Branch on data.code for already-terminal cases (signed/expired/declined), mirroring
      // handleSubmit — an ignored code used to strand the client on a generic toast (RSL-32).
      const outcome = declineOutcome(response.ok, data, token);
      if (outcome.kind === "redirect") router.push(outcome.url);
      else brandToast("error", outcome.message, undefined, { id: "decline-submit" });
    } catch {
      // No catch before RSL-32: a dropped connection failed silently with no client feedback.
      brandToast("error", "Could not submit", "Check your connection and try again.", {
        id: "decline-submit",
      });
    } finally {
      setSubmitting(false);
    }
  }

  // Mobile gets an explicit step readout (the desktop statusLine's "Valid until ..."
  // opener truncates into a date note at phone widths and reads as nothing).
  const mobileStatus = !adopted
    ? "Step 1 of 3 · Review, then sign"
    : allStamped
      ? "Step 3 of 3 · Finish below"
      : `Step 2 of 3 · ${stampedCount} of 2 signatures placed`;
  const statusLine = !adopted
    ? `${validUntilLabel ? `Valid until ${validUntilLabel}` : "Ready when you are"}${
        willCheckout ? " · Secure checkout follows signing" : ""
      }`
    : allStamped
      ? "Both places signed. Finish below."
      : `${stampedCount} of 2 places signed`;

  return (
    <main className="min-h-screen bg-surface pb-28">
      <div className="mx-auto max-w-3xl px-3 pt-8 sm:px-6">
        <ProposalView
          sections={sections}
          selectedTierId={selectedTierId}
          onTierSelect={handleTierSelect}
          selectedAddOnIds={selectedAddOnIds}
          onAddOnToggle={handleAddOnToggle}
          depositScheduleOverride={depositSchedule}
          clientSlots={clientSlots}
          rslaSlot={rslaSlot}
          signing={{
            adoptedPngDataUrl: adopted?.pngDataUrl ?? null,
            stamped,
            activePlace,
            onStamp: handleStamp,
            onRequestAdopt: openSignModal,
          }}
        />
      </div>

      {/* Floating guide to the next signature field. Stays mounted while adopted so it can
          fade/slide in and out instead of popping; label keeps its last value during exit. */}
      {adopted ? (
        <button
          type="button"
          tabIndex={activePlace ? 0 : -1}
          aria-hidden={!activePlace}
          onClick={() => activePlace && scrollToSlot(activePlace)}
          className={cn(
            "fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] left-1/2 z-50 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg transition-[opacity,transform] duration-200 ease-out-strong animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none active:scale-[0.97]",
            activePlace
              ? "opacity-100"
              : "pointer-events-none translate-y-2 scale-95 opacity-0"
          )}
        >
          <PenLine className="h-4 w-4" />
          {chipPlace === "proposal" ? "Place your signature" : "One more signature left"}
        </button>
      ) : null}

      {/* Floating action bar, lifted off the document */}
      <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <Card
          variant="floating"
          size="lg"
          className="mx-auto max-w-3xl gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
        >
          {/* Mobile: a one-line progress readout above the buttons (the name would crush
              the row; the chip + toasts still guide the details). */}
          <p
            aria-live="polite"
            className="truncate text-center text-xs font-medium text-muted-foreground sm:hidden"
          >
            {mobileStatus}
          </p>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-medium">{partyName}</p>
            <p aria-live="polite" className="truncate text-xs text-muted-foreground">
              {statusLine}
            </p>
          </div>
          <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
            {adopted ? (
              <Button variant="ghost" size="sm" onClick={handleRedo} disabled={submitting}>
                Redo
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDeclineStage("reason");
                  setDeclineOpen(true);
                }}
              >
                Decline
              </Button>
            )}
            {!adopted ? (
              <Button
                size="lg"
                className="flex-1 animate-in fade-in-0 duration-200 sm:flex-none"
                onClick={openSignModal}
                disabled={submitting}
              >
                Ready to sign
              </Button>
            ) : !allStamped ? (
              <Button
                size="lg"
                className="flex-1 animate-in fade-in-0 duration-200 sm:flex-none"
                onClick={() => {
                  if (activePlace) scrollToSlot(activePlace);
                }}
              >
                Review and sign
              </Button>
            ) : (
              <Button
                size="lg"
                className="flex-1 animate-in fade-in-0 duration-200 sm:flex-none"
                onClick={handleSubmit}
                loading={submitting}
              >
                {willCheckout ? (
                  <>
                    <span className="sm:hidden">Finish &amp; pay</span>
                    <span className="hidden sm:inline">Finish &amp; continue to payment</span>
                  </>
                ) : (
                  "Finish & Submit"
                )}
              </Button>
            )}
          </div>
        </Card>
      </div>

      <SignatureModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        defaultName={partyName}
        defaultCompany={sections.acceptance.clientCompany}
        submitting={submitting}
        onAdopt={handleAdopt}
        ctaLabel="Adopt signature"
        selectedTierSummary={buildSelectedSummary({
          tiers: sections.investment.tiers,
          selectedTierId,
          addOns: paymentConfig.addOns,
          selectedAddOnIds,
        })}
      />

      <Dialog
        open={declineOpen}
        onOpenChange={(open) => {
          setDeclineOpen(open);
          if (!open) setDeclineStage("reason");
        }}
      >
        <DialogContent className="max-w-md">
          {declineStage === "reason" ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading">Decline this proposal?</DialogTitle>
                <DialogDescription>
                  Our team will be notified. You can optionally say why. It helps.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Optional reason…"
                className="min-h-24"
              />
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDeclineOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setDeclineStage("confirm")}>Continue</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading">Are you sure?</DialogTitle>
                <DialogDescription>
                  This permanently declines the proposal and notifies RSL/A. You can&apos;t undo
                  this.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button autoFocus onClick={() => setDeclineStage("reason")} disabled={submitting}>
                  Go back
                </Button>
                <Button variant="destructive" onClick={handleDecline} loading={submitting}>
                  Yes, decline
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
