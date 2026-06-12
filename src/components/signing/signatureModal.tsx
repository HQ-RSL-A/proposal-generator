"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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
  fontFamily: string | null;
}

export function SignatureModal({
  open,
  onOpenChange,
  defaultName,
  submitting,
  onAdopt,
  ctaLabel,
  selectedTierSummary,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  submitting: boolean;
  onAdopt: (signature: AdoptedSignature) => void;
  ctaLabel: string;
  /** e.g. "Growth — $3,000/month"; restated at the moment of consent for tiered deals */
  selectedTierSummary?: string | null;
}) {
  const [tab, setTab] = React.useState<"draw" | "type">("draw");
  const [name, setName] = React.useState(defaultName);
  const [font, setFont] = React.useState<SignatureFont>(SIGNATURE_FONTS[0]);
  const [consented, setConsented] = React.useState(false);
  const [hasDrawn, setHasDrawn] = React.useState(false);
  const padRef = React.useRef<SignaturePadHandle>(null);

  const canAdopt =
    consented &&
    name.trim().length > 0 &&
    !submitting &&
    (tab === "type" || hasDrawn);

  async function handleAdopt() {
    if (!canAdopt) return;
    if (tab === "draw") {
      const pad = padRef.current;
      if (!pad || pad.isEmpty()) return;
      onAdopt({
        type: "DRAWN",
        pngDataUrl: pad.toPngDataUrl(),
        adoptedName: name.trim(),
        fontFamily: null,
      });
    } else {
      const pngDataUrl = await typedNameToPng(name.trim(), font);
      onAdopt({
        type: "TYPED",
        pngDataUrl,
        adoptedName: name.trim(),
        fontFamily: font.id,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">Adopt your signature</DialogTitle>
          <DialogDescription>
            One signature executes the proposal and the Master Services Agreement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {selectedTierSummary ? (
            <div className="rounded-lg border border-primary/30 bg-accent px-3 py-2 text-sm">
              <span className="text-muted-foreground">You&apos;re signing for: </span>
              <span className="font-semibold text-foreground">{selectedTierSummary}</span>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label className="text-xs">Full legal name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "draw" | "type")}>
            <TabsList className="w-full">
              <TabsTrigger value="draw" className="flex-1">
                Draw
              </TabsTrigger>
              <TabsTrigger value="type" className="flex-1">
                Type
              </TabsTrigger>
            </TabsList>
            <TabsContent value="draw" className="pt-3">
              <SignaturePadCanvas
                ref={padRef}
                onChange={() => setHasDrawn(!(padRef.current?.isEmpty() ?? true))}
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
                      "flex h-20 flex-col items-start justify-center rounded-lg border px-4 transition-colors",
                      font.id === option.id
                        ? "border-primary bg-accent"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <span
                      className={cn(option.className, "max-w-full truncate text-2xl text-foreground")}
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
          </Tabs>

          <label className="flex cursor-pointer gap-3 rounded-lg border border-border bg-surface p-3">
            <Checkbox
              checked={consented}
              onCheckedChange={(v) => setConsented(Boolean(v))}
              className="mt-0.5"
            />
            <span className="text-xs leading-relaxed text-muted-foreground">
              {ESIGN_CONSENT_TEXT}
            </span>
          </label>

          <Button className="w-full" size="lg" disabled={!canAdopt} onClick={handleAdopt}>
            {submitting ? "Applying signature…" : ctaLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
