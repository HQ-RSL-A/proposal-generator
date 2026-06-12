import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PaymentStatus, ProposalStatus } from "@/generated/prisma/client";

const statusStyles: Record<ProposalStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-muted text-muted-foreground" },
  SENT: { label: "Sent", className: "bg-blue-100 text-blue-700" },
  VIEWED: { label: "Viewed", className: "bg-indigo-100 text-indigo-700" },
  PARTIALLY_SIGNED: { label: "Partially signed", className: "bg-amber-100 text-amber-700" },
  SIGNED: { label: "Signed", className: "bg-emerald-100 text-emerald-700" },
  DECLINED: { label: "Declined", className: "bg-rose-100 text-rose-700" },
  EXPIRED: { label: "Expired", className: "bg-orange-100 text-orange-700" },
  VOIDED: { label: "Voided", className: "bg-gray-200 text-gray-600" },
};

const paymentStyles: Record<PaymentStatus, { label: string; className: string } | null> = {
  NOT_REQUIRED: null,
  AWAITING: { label: "Awaiting payment", className: "bg-amber-100 text-amber-700" },
  PROCESSING: { label: "ACH processing", className: "bg-sky-100 text-sky-700" },
  PAID: { label: "Paid", className: "bg-emerald-600 text-white" },
  FAILED: { label: "Payment failed", className: "bg-rose-100 text-rose-700" },
  SESSION_EXPIRED: { label: "Checkout expired", className: "bg-orange-100 text-orange-700" },
};

export function StatusChip({ status }: { status: ProposalStatus }) {
  const style = statusStyles[status];
  return (
    <Badge variant="secondary" className={cn("border-0 font-medium", style.className)}>
      {style.label}
    </Badge>
  );
}

export function PaymentChip({
  paymentStatus,
  status,
}: {
  paymentStatus: PaymentStatus;
  status: ProposalStatus;
}) {
  // Payment chips only mean something once signing has finished.
  if (status !== "SIGNED") return null;
  const style = paymentStyles[paymentStatus];
  if (!style) return null;
  return (
    <Badge variant="secondary" className={cn("border-0 font-medium", style.className)}>
      {style.label}
    </Badge>
  );
}
