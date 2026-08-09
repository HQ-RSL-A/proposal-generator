"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { brandToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { sendProposal } from "@/actions/proposals";
import { Plus, Trash2 } from "lucide-react";

interface PartyDraft {
  name: string;
  email: string;
  payer: boolean;
}

export function SendForm({
  proposalId,
  defaultName,
  defaultEmail,
}: {
  proposalId: string;
  defaultName: string;
  defaultEmail: string;
}) {
  const router = useRouter();
  const [parties, setParties] = React.useState<PartyDraft[]>([
    { name: defaultName, email: defaultEmail, payer: true },
  ]);
  const [sending, setSending] = React.useState(false);

  function update(index: number, patch: Partial<PartyDraft>) {
    setParties((prev) =>
      prev.map((party, i) =>
        i === index
          ? { ...party, ...patch }
          : patch.payer
            ? { ...party, payer: false }
            : party
      )
    );
  }

  async function handleSend() {
    setSending(true);
    try {
      const result = await sendProposal({
        id: proposalId,
        parties: parties.map((p) => ({ ...p, email: p.email.trim().toLowerCase() })),
      });
      if (!result.ok) {
        brandToast("error", result.error);
        return;
      }
      brandToast(
        "success",
        "Proposal sent",
        "Each signer just got their own signing link by email. You'll be emailed the moment everyone has signed."
      );
      router.push(`/proposals/${proposalId}`);
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Signers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Each signer gets their own unique signing link by email. Your RSL/A signature is applied
          automatically the moment this is sent. The <strong>payer</strong> is redirected to
          checkout after the final signature.
        </p>
        {parties.map((party, index) => (
          <Card
            key={index}
            variant="outlined"
            size="sm"
            className="grid grid-cols-2 items-end gap-2 px-(--card-spacing) sm:grid-cols-12"
          >
            <div className="col-span-2 sm:col-span-4">
              <Label className="text-xs">Name</Label>
              <Input value={party.name} onChange={(e) => update(index, { name: e.target.value })} />
            </div>
            <div className="col-span-2 sm:col-span-5">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={party.email}
                onChange={(e) => update(index, { email: e.target.value })}
              />
            </div>
            <div className="col-span-1 flex items-center gap-2 pb-2 sm:col-span-2">
              <input
                type="radio"
                name="payer"
                checked={party.payer}
                onChange={() => update(index, { payer: true })}
                className="h-4 w-4 accent-[#0070F3]"
              />
              <Label className="text-xs">Payer</Label>
            </div>
            <div className="col-span-1 pb-1">
              {parties.length > 1 ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove signer"
                        className="text-destructive"
                        onClick={() => setParties((prev) => prev.filter((_, i) => i !== index))}
                      />
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent>Remove signer</TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          </Card>
        ))}
        {parties.length < 5 ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setParties((prev) => [...prev, { name: "", email: "", payer: false }])}
          >
            <Plus className="h-3.5 w-3.5" /> Add signer
          </Button>
        ) : null}
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={() => router.back()}>
            Back
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? "Sending…" : "Send proposal"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
