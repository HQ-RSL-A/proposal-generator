"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { brandToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { saveAdminSignature } from "@/actions/settings";
import {
  SIGNATURE_FONTS,
  typedNameToPng,
  type SignatureFont,
} from "@/components/signing/signatureFonts";
import {
  SignaturePadCanvas,
  type SignaturePadHandle,
} from "@/components/signing/signaturePadCanvas";

export function SignatureSettings({
  hasSignature,
  adoptedName,
}: {
  hasSignature: boolean;
  adoptedName: string;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<"draw" | "type">("draw");
  const [name, setName] = React.useState(adoptedName);
  const [font, setFont] = React.useState<SignatureFont>(SIGNATURE_FONTS[0]);
  const [saving, setSaving] = React.useState(false);
  const [cacheBust, setCacheBust] = React.useState(0);
  const padRef = React.useRef<SignaturePadHandle>(null);

  async function handleSave() {
    setSaving(true);
    try {
      let pngDataUrl: string;
      let type: "DRAWN" | "TYPED";
      if (tab === "draw") {
        if (!padRef.current || padRef.current.isEmpty()) {
          brandToast("warning", "Draw your signature first.");
          return;
        }
        pngDataUrl = padRef.current.toPngDataUrl();
        type = "DRAWN";
      } else {
        if (!name.trim()) {
          brandToast("warning", "Type your name first.");
          return;
        }
        pngDataUrl = await typedNameToPng(name.trim(), font);
        type = "TYPED";
      }
      const result = await saveAdminSignature({ pngDataUrl, adoptedName: name.trim(), type });
      if (!result.ok) {
        brandToast("error", result.error);
        return;
      }
      brandToast("success", "Signature saved. It gets pre-applied on every send.");
      setCacheBust(Date.now());
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your signature</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Applied automatically as RSL/A&apos;s execution the moment you send a proposal. Sent
          documents keep the signature they were sent with. Updating this only affects future
          sends.
        </p>
        {hasSignature ? (
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="font-tag mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              Current signature
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/settings/signature${cacheBust ? `?v=${cacheBust}` : ""}`}
              alt="Saved signature"
              className="max-h-16 object-contain"
            />
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-warning bg-amber-50 p-3 text-sm text-amber-800">
            No signature saved yet. Sending is blocked until you save one.
          </p>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">Adopted name</Label>
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
            <SignaturePadCanvas ref={padRef} />
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
                  <span className={cn(option.className, "max-w-full truncate text-2xl")}>
                    {name.trim() || "Rahul Lalia"}
                  </span>
                  <span className="font-tag mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button onClick={handleSave} loading={saving}>
            Save signature
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
