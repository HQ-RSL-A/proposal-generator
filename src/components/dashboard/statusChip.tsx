import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PaymentStatus, ProposalStatus } from "@/generated/prisma/client";

/* THE status tone scale (docs/plans/ui-consistency-pass.md, Phase 2 §2): one semantic
   tone per meaning, defined once, consumed by every status surface (chips here, the
   audit timeline, outcome cards, system health). success/warning/danger ride the theme
   tokens; blue (info) and violet (engaged) are informational hues sanctioned ONLY in
   this map. `chip` = Badge fill; `icon` = tinted icon circle (consumer adds ring-1). */
export type StatusTone =
  | "neutral"
  | "brand"
  | "info"
  | "engaged"
  | "success"
  | "warning"
  | "danger";

export const STATUS_TONES: Record<StatusTone, { chip: string; icon: string }> = {
  neutral: {
    chip: "bg-muted text-muted-foreground",
    icon: "bg-muted text-muted-foreground ring-border",
  },
  brand: {
    chip: "bg-accent text-accent-foreground",
    icon: "bg-accent text-primary ring-primary/20",
  },
  info: {
    chip: "bg-blue-100 text-blue-700",
    icon: "bg-blue-50 text-blue-600 ring-blue-200",
  },
  engaged: {
    chip: "bg-violet-100 text-violet-700",
    icon: "bg-violet-50 text-violet-600 ring-violet-200",
  },
  success: {
    chip: "bg-success-subtle text-success-subtle-foreground",
    icon: "bg-success-subtle/60 text-success ring-success/25",
  },
  warning: {
    chip: "bg-warning-subtle text-warning-subtle-foreground",
    icon: "bg-warning-subtle/60 text-warning-subtle-foreground ring-warning/30",
  },
  danger: {
    chip: "bg-destructive-subtle text-destructive-subtle-foreground",
    icon: "bg-destructive-subtle/50 text-destructive ring-destructive/25",
  },
};

export const PROPOSAL_STATUS_META: Record<
  ProposalStatus,
  { label: string; tone: StatusTone }
> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SENT: { label: "Sent", tone: "info" },
  VIEWED: { label: "Viewed", tone: "engaged" },
  PARTIALLY_SIGNED: { label: "Partially signed", tone: "warning" },
  SIGNED: { label: "Signed", tone: "success" },
  DECLINED: { label: "Declined", tone: "danger" },
  EXPIRED: { label: "Expired", tone: "warning" },
  VOIDED: { label: "Voided", tone: "neutral" },
};

/** `solid` marks the one strong chip: PAID is the terminal money-landed state. */
export const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; tone: StatusTone; solid?: true } | null
> = {
  NOT_REQUIRED: null,
  AWAITING: { label: "Awaiting payment", tone: "warning" },
  PROCESSING: { label: "ACH processing", tone: "info" },
  PAID: { label: "Paid", tone: "success", solid: true },
  FAILED: { label: "Payment failed", tone: "danger" },
  SESSION_EXPIRED: { label: "Checkout expired", tone: "warning" },
  MANUAL_INVOICE: { label: "Awaiting invoice", tone: "warning" },
};

function ToneBadge({ tone, solid, label }: { tone: StatusTone; solid?: true; label: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "border-0 font-medium",
        solid ? "bg-success text-white" : STATUS_TONES[tone].chip
      )}
    >
      {label}
    </Badge>
  );
}

export function StatusChip({ status }: { status: ProposalStatus }) {
  const meta = PROPOSAL_STATUS_META[status];
  return <ToneBadge tone={meta.tone} label={meta.label} />;
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
  const meta = PAYMENT_STATUS_META[paymentStatus];
  if (!meta) return null;
  return <ToneBadge tone={meta.tone} solid={meta.solid} label={meta.label} />;
}
