"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { brandConfirm, brandToast } from "@/lib/toast";
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
  markPaidManually,
  regeneratePdf,
  reviseProposal,
  voidProposal,
} from "@/actions/proposals";
import {
  Ban,
  CircleDollarSign,
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

  async function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
    description?: string
  ) {
    setBusy(true);
    try {
      const result = await action();
      if (!result.ok) {
        brandToast(
          "error",
          "That didn't go through",
          result.error ?? "Nothing changed. Try again, and if it keeps failing check Settings, System."
        );
        return;
      }
      brandToast("success", success, description);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  /** PDF rendering is queued work: refresh the page when it has likely landed. */
  function scheduleRefresh() {
    window.setTimeout(() => router.refresh(), 8_000);
    window.setTimeout(() => router.refresh(), 25_000);
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
              onClick={async () => {
                const ok = await brandConfirm({
                  title: "Delete this draft?",
                  description: "This can't be undone.",
                  confirmLabel: "Delete draft",
                  cancelLabel: "Keep",
                  icon: Trash2,
                  tone: "danger",
                });
                if (!ok) return;
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
              onClick={() =>
                run(
                  () => regeneratePdf(proposalId),
                  "PDF is rendering",
                  "It builds in the background and shows up under Documents in about a minute. This page refreshes on its own."
                ).then(scheduleRefresh)
              }
            >
              <RefreshCcw className="h-3.5 w-3.5" /> Generate PDF
            </Button>
          )}
          {hasFinalPdf ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() =>
                run(
                  () => regeneratePdf(proposalId),
                  "Fresh PDF is rendering",
                  "It replaces the current copy under Documents in about a minute. Executed-copy emails are not re-sent."
                ).then(scheduleRefresh)
              }
            >
              <RefreshCcw className="h-3.5 w-3.5" /> Regenerate
            </Button>
          ) : null}
          {paymentStatus === "MANUAL_INVOICE" && isAdmin ? (
            <Button
              size="sm"
              disabled={busy}
              onClick={async () => {
                const ok = await brandConfirm({
                  title: "Mark this proposal as paid?",
                  description:
                    "Use this once you've collected payment offline. It records the deal as paid, clears the to-invoice flag, and updates your dashboard and CRM. No email goes to the client.",
                  confirmLabel: "Mark as paid",
                  cancelLabel: "Not yet",
                  icon: CircleDollarSign,
                  tone: "default",
                });
                if (!ok) return;
                run(
                  () => markPaidManually({ id: proposalId }),
                  "Marked as paid",
                  "The deal now shows as paid on your dashboard."
                );
              }}
            >
              <CircleDollarSign className="h-3.5 w-3.5" /> Mark as paid
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
                brandToast("error", result.error ?? "That didn't work");
                return;
              }
              brandToast(
                "success",
                "Revision draft created",
                "Edit and send it like a new proposal. The old version gets voided automatically when this one goes out."
              );
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
                  "Proposal voided",
                  notifyParties
                    ? "Signing links are dead and the signers were emailed that it was withdrawn."
                    : "Signing links are dead. No email went out to the signers."
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
