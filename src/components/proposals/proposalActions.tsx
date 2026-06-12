"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteDraft,
  regeneratePdf,
  reviseProposal,
  voidProposal,
} from "@/actions/proposals";
import {
  Ban,
  Download,
  FileEdit,
  GitBranchPlus,
  RefreshCcw,
  Send,
  Trash2,
} from "lucide-react";
import type { PaymentStatus, ProposalStatus } from "@/generated/prisma/client";

export function ProposalActions({
  proposalId,
  status,
  paymentStatus,
  hasFinalPdf,
  isAdmin,
}: {
  proposalId: string;
  status: ProposalStatus;
  paymentStatus: PaymentStatus;
  hasFinalPdf: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [voidOpen, setVoidOpen] = React.useState(false);
  const [voidReason, setVoidReason] = React.useState("");
  const [notifyParties, setNotifyParties] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusy(true);
    try {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Failed");
        return;
      }
      toast.success(success);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const inFlight = ["SENT", "VIEWED", "PARTIALLY_SIGNED"].includes(status);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "DRAFT" ? (
        <>
          <Button size="sm" nativeButton={false} render={<Link href={`/proposals/${proposalId}/send`} />}>
            <Send className="h-3.5 w-3.5" /> Send
          </Button>
          <Button size="sm" variant="secondary" nativeButton={false} render={<Link href={`/proposals/${proposalId}/edit`} />}>
            <FileEdit className="h-3.5 w-3.5" /> Edit
          </Button>
          {isAdmin ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              disabled={busy}
              onClick={() => {
                if (!confirm("Delete this draft? This can't be undone.")) return;
                run(() => deleteDraft(proposalId), "Draft deleted").then(() =>
                  router.push("/dashboard")
                );
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          ) : null}
        </>
      ) : null}

      {status === "SIGNED" ? (
        <>
          {hasFinalPdf ? (
            <Button size="sm" nativeButton={false} render={<a href={`/api/proposals/${proposalId}/pdf`} />}>
              <Download className="h-3.5 w-3.5" /> Executed PDF
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => run(() => regeneratePdf(proposalId), "PDF generation queued")}
            >
              <RefreshCcw className="h-3.5 w-3.5" /> Generate PDF
            </Button>
          )}
          {hasFinalPdf ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => run(() => regeneratePdf(proposalId), "PDF regeneration queued")}
            >
              <RefreshCcw className="h-3.5 w-3.5" /> Regenerate
            </Button>
          ) : null}
        </>
      ) : null}

      {inFlight && isAdmin ? (
        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setVoidOpen(true)}>
          <Ban className="h-3.5 w-3.5" /> Void
        </Button>
      ) : null}

      {status !== "DRAFT" && paymentStatus !== "PAID" ? (
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await reviseProposal(proposalId);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success("Revision draft created");
              router.push(`/proposals/${result.data!.id}/edit`);
            } finally {
              setBusy(false);
            }
          }}
        >
          <GitBranchPlus className="h-3.5 w-3.5" /> Revise
        </Button>
      ) : null}

      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Void this proposal?</DialogTitle>
            <DialogDescription>
              Signing links stop working immediately. This can&apos;t be undone (revise to send a
              new version).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="Reason (internal note)"
            className="min-h-20"
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={notifyParties}
              onCheckedChange={(v) => setNotifyParties(Boolean(v))}
            />
            Email the signers that it&apos;s withdrawn
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setVoidOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() =>
                run(
                  () => voidProposal({ id: proposalId, reason: voidReason, notifyParties }),
                  "Proposal voided"
                ).then(() => setVoidOpen(false))
              }
            >
              Void proposal
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
