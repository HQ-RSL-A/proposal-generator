"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, PenLine, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import type { ProposalSections } from "@/lib/proposalContent";

const PLACE_ORDER: SignaturePlace[] = ["proposal", "agreement"];

function scrollToSlot(place: SignaturePlace) {
  document
    .querySelector(`[data-signature-slot="${place}"]`)
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}

/** Branded, on-brand toast for the signing flow (Anchor Blue for guidance, red for errors). */
function signToast(
  tone: "brand" | "error",
  title: string,
  description?: string,
  opts?: { id?: string; duration?: number }
) {
  toast.custom(
    () => (
      <div
        className={cn(
          "flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-white shadow-xl ring-1 ring-black/10",
          tone === "brand" ? "bg-primary" : "bg-red-600"
        )}
      >
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20">
          {tone === "brand" ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <TriangleAlert className="h-3.5 w-3.5" />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug">{title}</p>
          {description ? (
            <p className="mt-0.5 text-xs leading-snug text-white/85">{description}</p>
          ) : null}
        </div>
      </div>
    ),
    { position: "top-center", duration: opts?.duration ?? 5000, id: opts?.id }
  );
}

export function SigningExperience({
  token,
  sections,
  partyName,
  requiresTier,
  initialTierId,
  willCheckout,
  validUntilLabel,
  clientSlots,
  rslaSlot,
}: {
  token: string;
  sections: ProposalSections;
  partyName: string;
  requiresTier: boolean;
  initialTierId: string | null;
  willCheckout: boolean;
  validUntilLabel: string | null;
  clientSlots: SignerSlot[];
  rslaSlot: SignerSlot;
}) {
  const router = useRouter();
  const [selectedTierId, setSelectedTierId] = React.useState<string | null>(initialTierId);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [declineOpen, setDeclineOpen] = React.useState(false);
  const [declineReason, setDeclineReason] = React.useState("");
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
    // Changing the deal after adopting invalidates the ceremony: the consent
    // restated the old tier, so the signature has to be adopted again.
    if (adopted) {
      setAdopted(null);
      setStamped({ proposal: false, agreement: false });
      stampTimes.current = { proposal: null, agreement: null };
      signToast(
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

  function openSignModal() {
    if (requiresTier && !selectedTierId) {
      signToast("error", "Select a plan before signing", "It's part of what you're agreeing to.", {
        duration: 6000,
      });
      document
        .querySelector("[data-tier-anchor]")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setModalOpen(true);
  }

  function handleAdopt(signature: AdoptedSignature) {
    setAdopted(signature);
    setModalOpen(false);
    signToast("brand", "You're signed", "Now tap the highlighted box to drop your signature in.");
    window.setTimeout(() => scrollToSlot("proposal"), 250);
  }

  function handleStamp(place: SignaturePlace) {
    setStamped((prev) => {
      if (prev[place]) return prev;
      stampTimes.current[place] = new Date().toISOString();
      const next = { ...prev, [place]: true };
      const remaining = PLACE_ORDER.find((p) => !next[p]);
      if (remaining) {
        window.setTimeout(() => scrollToSlot(remaining), 350);
      }
      return next;
    });
  }

  const stampedCount = PLACE_ORDER.filter((p) => stamped[p]).length;
  const allStamped = stampedCount === PLACE_ORDER.length;
  const activePlace =
    adopted && !allStamped ? (PLACE_ORDER.find((p) => !stamped[p]) ?? null) : null;

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
          stampedProposalAt: stampTimes.current.proposal,
          stampedAgreementAt: stampTimes.current.agreement,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === "expired") router.push(`/sign/${token}/expired`);
        else if (data.code === "already_signed") router.push(`/sign/${token}/signed`);
        else signToast("error", data.error ?? "Something went wrong", undefined, { id: "sign-submit" });
        return;
      }
      if (typeof data.redirectUrl === "string" && data.redirectUrl.startsWith("http")) {
        // Last signer with payment due — straight to Stripe Checkout.
        window.location.href = data.redirectUrl;
      } else {
        router.push(data.redirectUrl ?? `/sign/${token}/signed`);
      }
    } catch {
      signToast("error", "Could not submit", "Check your connection and try again.", {
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
      if (!response.ok) {
        signToast("error", data.error ?? "Something went wrong");
        return;
      }
      router.push(data.redirectUrl ?? `/sign/${token}/declined`);
    } finally {
      setSubmitting(false);
    }
  }

  const statusLine = !adopted
    ? `${validUntilLabel ? `Valid until ${validUntilLabel}` : "Ready when you are"}${
        willCheckout ? " · Secure checkout follows signing" : ""
      }`
    : allStamped
      ? "Both places signed. Finish below."
      : `${stampedCount} of 2 places signed`;

  return (
    <div className="min-h-screen bg-surface pb-28">
      <div className="mx-auto max-w-3xl px-3 pt-8 sm:px-6">
        <ProposalView
          sections={sections}
          selectedTierId={selectedTierId}
          onTierSelect={handleTierSelect}
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

      {/* Floating guide to the next signature field */}
      {activePlace ? (
        <button
          type="button"
          onClick={() => scrollToSlot(activePlace)}
          className="fixed bottom-28 left-1/2 z-50 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-transform active:scale-[0.97]"
        >
          <PenLine className="h-4 w-4" />
          {activePlace === "proposal" ? "Place your signature" : "One more signature left"}
        </button>
      ) : null}

      {/* Floating action bar, lifted off the document */}
      <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 pt-2">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-2xl border border-border bg-white px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(17,24,39,0.18),0_12px_34px_-6px_rgba(17,24,39,0.30)] ring-1 ring-black/5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{partyName}</p>
            <p className="truncate text-xs text-muted-foreground">{statusLine}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {adopted ? (
              <Button variant="ghost" size="sm" onClick={handleRedo} disabled={submitting}>
                Redo signature
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setDeclineOpen(true)}>
                Decline
              </Button>
            )}
            {!adopted ? (
              <Button size="lg" onClick={openSignModal} disabled={submitting}>
                Ready to sign
              </Button>
            ) : !allStamped ? (
              <Button
                size="lg"
                onClick={() => {
                  if (activePlace) scrollToSlot(activePlace);
                }}
              >
                Review and sign
              </Button>
            ) : (
              <Button size="lg" onClick={handleSubmit} disabled={submitting}>
                {submitting
                  ? "Submitting…"
                  : willCheckout
                    ? "Finish & continue to payment"
                    : "Finish & Submit"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <SignatureModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        defaultName={partyName}
        defaultCompany={sections.acceptance.clientCompany}
        submitting={submitting}
        onAdopt={handleAdopt}
        ctaLabel="Adopt signature"
        selectedTierSummary={(() => {
          const tier = sections.investment.tiers?.find((t) => t.id === selectedTierId);
          if (!tier) return null;
          const price = [tier.oneTime?.displayString, tier.recurring?.displayString]
            .filter(Boolean)
            .join(" + ");
          return `${tier.label}${price ? ` at ${price}` : ""}`;
        })()}
      />

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent className="max-w-md">
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
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeclineOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDecline} disabled={submitting}>
              Decline proposal
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
