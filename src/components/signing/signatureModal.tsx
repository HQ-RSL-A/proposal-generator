"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Animates its height to match the active child, so swapping Draw <-> Type glides the
 * modal to its new size instead of snapping (the panels are different heights - the
 * resize, not the fade, is what read as sudden).
 */
function AnimatedHeight({ children }: { children: React.ReactNode }) {
  const innerRef = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState<number | null>(null);
  React.useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      className="overflow-hidden transition-[height] duration-300 ease-out-strong motion-reduce:transition-none"
      style={{ height: height === null ? "auto" : `${height}px` }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}
import {
  SIGNATURE_FONTS,
  typedNameToPng,
  type SignatureFont,
} from "@/components/signing/signatureFonts";
import {
  SignaturePadCanvas,
  type SignaturePadHandle,
} from "@/components/signing/signaturePadCanvas";

export const ESIGN_CONSENT_TEXT =
  "By checking this box, I consent to the use of electronic records and signatures for this agreement under the federal E-SIGN Act, the New York Electronic Signatures and Records Act (ESRA), and the Uniform Electronic Transactions Act (UETA). I have the right to receive a paper copy; by proceeding electronically, I waive that right for this transaction. I confirm the name and signature I adopt here represent my legal electronic signature.";

export interface AdoptedSignature {
  type: "DRAWN" | "TYPED";
  pngDataUrl: string;
  adoptedName: string;
  signerTitle: string;
  signerCompany: string;
  fontFamily: string | null;
}

type FieldErrors = {
  name?: string;
  title?: string;
  company?: string;
  signature?: string;
  consent?: string;
};

export function SignatureModal({
  open,
  onOpenChange,
  defaultName,
  defaultCompany,
  submitting,
  onAdopt,
  ctaLabel,
  selectedTierSummary,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  defaultCompany: string;
  submitting: boolean;
  onAdopt: (signature: AdoptedSignature) => void;
  ctaLabel: string;
  /** e.g. "Growth at $3,000/month"; restated at the moment of consent for tiered deals */
  selectedTierSummary?: string | null;
}) {
  const [tab, setTab] = React.useState<"draw" | "type">("draw");
  const [name, setName] = React.useState(defaultName);
  const [title, setTitle] = React.useState("");
  const [company, setCompany] = React.useState(defaultCompany);
  const [font, setFont] = React.useState<SignatureFont>(SIGNATURE_FONTS[0]);
  const [consented, setConsented] = React.useState(false);
  const [drawn, setDrawn] = React.useState(false);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const padRef = React.useRef<SignaturePadHandle>(null);

  // Reset transient state when the modal opens. Done during render (not in an effect) so it
  // resets in the same pass without a cascading re-render. React's documented pattern for
  // resetting state on a prop change.
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setErrors({});
      setDrawn(false);
    }
  }

  // Everything the signer must provide before the CTA lights up.
  const signatureReady = tab === "type" ? name.trim().length > 0 : drawn;
  const complete =
    name.trim().length > 0 &&
    title.trim().length > 0 &&
    company.trim().length > 0 &&
    consented &&
    signatureReady;

  const clearError = (key: keyof FieldErrors) =>
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = "Enter your full legal name.";
    if (!title.trim()) next.title = "Add your title, like Owner or CEO.";
    if (!company.trim()) next.company = "Add your company name.";
    if (tab === "draw" && (padRef.current?.isEmpty() ?? true)) {
      next.signature = "Draw your signature in the box above.";
    }
    if (!consented) next.consent = "Check the box to e-sign.";
    return next;
  }

  async function handleAdopt() {
    if (submitting) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    if (tab === "draw") {
      const pad = padRef.current;
      if (!pad || pad.isEmpty()) return;
      onAdopt({
        type: "DRAWN",
        pngDataUrl: pad.toPngDataUrl(),
        adoptedName: name.trim(),
        signerTitle: title.trim(),
        signerCompany: company.trim(),
        fontFamily: null,
      });
    } else {
      const pngDataUrl = await typedNameToPng(name.trim(), font);
      onAdopt({
        type: "TYPED",
        pngDataUrl,
        adoptedName: name.trim(),
        signerTitle: title.trim(),
        signerCompany: company.trim(),
        fontFamily: font.id,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent presentation="sheet" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">Adopt your signature</DialogTitle>
          <DialogDescription>
            You adopt it once, then place it in two spots: the proposal acceptance and the
            agreement execution.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pb-4">
          {selectedTierSummary ? (
            <div className="rounded-lg border border-primary/30 bg-accent px-3 py-2 text-sm">
              <span className="text-muted-foreground">You&apos;re signing for: </span>
              <span className="font-semibold text-foreground">{selectedTierSummary}</span>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label className="text-xs">Full legal name</Label>
            <Input
              value={name}
              aria-invalid={Boolean(errors.name)}
              onChange={(e) => {
                setName(e.target.value);
                clearError("name");
              }}
            />
            {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Your title</Label>
              <Input
                value={title}
                placeholder="Owner"
                aria-invalid={Boolean(errors.title)}
                onChange={(e) => {
                  setTitle(e.target.value);
                  clearError("title");
                }}
              />
              {errors.title ? <p className="text-xs text-destructive">{errors.title}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Company</Label>
              <Input
                value={company}
                aria-invalid={Boolean(errors.company)}
                onChange={(e) => {
                  setCompany(e.target.value);
                  clearError("company");
                }}
              />
              {errors.company ? (
                <p className="text-xs text-destructive">{errors.company}</p>
              ) : null}
            </div>
          </div>

          <div>
            <Tabs
              value={tab}
              onValueChange={(v) => {
                setTab(v as "draw" | "type");
                clearError("signature");
              }}
            >
              <TabsList className="w-full">
                <TabsTrigger value="draw" className="flex-1">
                  Draw
                </TabsTrigger>
                <TabsTrigger value="type" className="flex-1">
                  Type
                </TabsTrigger>
              </TabsList>
              <AnimatedHeight>
              <TabsContent value="draw" className="pt-3">
                <SignaturePadCanvas
                  ref={padRef}
                  onChange={() => {
                    setDrawn(!(padRef.current?.isEmpty() ?? true));
                    clearError("signature");
                  }}
                />
              </TabsContent>
              <TabsContent value="type" className="pt-3">
                <div className="grid grid-cols-2 gap-2">
                  {SIGNATURE_FONTS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setFont(option)}
                      className={cn(
                        "flex h-20 flex-col items-start justify-center rounded-lg border px-4 transition-[border-color,background-color,transform] duration-200 ease-out-strong outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98]",
                        font.id === option.id
                          ? "border-primary bg-accent"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <span
                        className={cn(
                          option.className,
                          "max-w-full truncate text-2xl text-foreground"
                        )}
                      >
                        {name.trim() || "Your name"}
                      </span>
                      <span className="font-tag mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
              </TabsContent>
              </AnimatedHeight>
            </Tabs>
            {errors.signature ? (
              <p className="mt-2 text-xs text-destructive">{errors.signature}</p>
            ) : null}
          </div>

          <div>
            <label
              className={cn(
                "flex cursor-pointer gap-3 rounded-lg border bg-surface p-3",
                errors.consent ? "border-destructive" : "border-border"
              )}
            >
              <Checkbox
                checked={consented}
                onCheckedChange={(v) => {
                  setConsented(Boolean(v));
                  clearError("consent");
                }}
                className="mt-0.5"
              />
              <span className="text-xs leading-relaxed text-muted-foreground">
                {ESIGN_CONSENT_TEXT}
              </span>
            </label>
            {errors.consent ? (
              <p className="mt-1 text-xs text-destructive">{errors.consent}</p>
            ) : null}
          </div>
        </div>

        {/* Pinned below the scroll area in sheet mode; the band absorbs the safe-area
            inset itself so it reaches the physical bottom edge of the screen. */}
        <DialogFooter className="-mb-[max(1rem,env(safe-area-inset-bottom))] rounded-b-none pb-[max(1rem,env(safe-area-inset-bottom))] sm:-mb-4 sm:rounded-b-xl sm:pb-4">
          <Button
            className={cn("w-full transition-opacity duration-200", !complete && "opacity-60")}
            size="lg"
            loading={submitting}
            onClick={handleAdopt}
          >
            {ctaLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
