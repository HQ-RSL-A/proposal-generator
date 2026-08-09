import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { STATUS_TONES, type StatusTone } from "@/components/dashboard/statusChip";
import type { AuditEvent, Party } from "@/generated/prisma/client";
import {
  type LucideIcon,
  FilePlus,
  Send,
  RefreshCw,
  Mail,
  MailCheck,
  MailOpen,
  MailX,
  Eye,
  SlidersHorizontal,
  SquareCheck,
  PenLine,
  BadgeCheck,
  Ban,
  Trash2,
  Timer,
  ShoppingCart,
  CircleDollarSign,
  Building2,
  CircleX,
  Clock,
  FileCheck,
  Database,
  Shield,
  BellRing,
  Dot,
} from "lucide-react";

/* Tones come from THE status scale (statusChip.tsx) so the timeline can never
   contradict the chips: expiry = warning, voided = neutral (deliberate, not a failure),
   money-in-flight = info, client touches = engaged. Icons carry the per-event identity. */
const EVENT_META: Record<string, { label: string; icon: LucideIcon; tone: StatusTone }> = {
  PROPOSAL_CREATED: { label: "Proposal created", icon: FilePlus, tone: "neutral" },
  PROPOSAL_SENT: { label: "Sent. Content frozen and hashed", icon: Send, tone: "info" },
  PROPOSAL_REVISED: { label: "Revision created", icon: RefreshCw, tone: "info" },
  EMAIL_SENT: { label: "Email sent", icon: Mail, tone: "info" },
  EMAIL_DELIVERED: { label: "Email delivered", icon: MailCheck, tone: "info" },
  EMAIL_OPENED: { label: "Email opened", icon: MailOpen, tone: "engaged" },
  EMAIL_BOUNCED: { label: "Email bounced", icon: MailX, tone: "danger" },
  PAGE_VIEWED: { label: "Document viewed", icon: Eye, tone: "engaged" },
  TIER_SELECTED: { label: "Pricing option selected", icon: SlidersHorizontal, tone: "engaged" },
  ESIGN_CONSENTED: { label: "E-sign consent given", icon: SquareCheck, tone: "info" },
  PARTY_SIGNED: { label: "Signed", icon: PenLine, tone: "success" },
  ALL_SIGNED: { label: "All parties signed", icon: BadgeCheck, tone: "success" },
  PARTY_DECLINED: { label: "Declined", icon: Ban, tone: "danger" },
  PROPOSAL_VOIDED: { label: "Voided", icon: Trash2, tone: "neutral" },
  PROPOSAL_EXPIRED: { label: "Expired", icon: Timer, tone: "warning" },
  CHECKOUT_CREATED: { label: "Checkout session created", icon: ShoppingCart, tone: "info" },
  PAYMENT_PAID: { label: "Payment received", icon: CircleDollarSign, tone: "success" },
  PAYMENT_PROCESSING: { label: "Bank transfer processing", icon: Building2, tone: "info" },
  PAYMENT_FAILED: { label: "Payment failed", icon: CircleX, tone: "danger" },
  CHECKOUT_EXPIRED: { label: "Checkout session expired", icon: Clock, tone: "warning" },
  PDF_GENERATED: { label: "Executed PDF generated", icon: FileCheck, tone: "success" },
  NOTION_SYNCED: { label: "Notion CRM synced", icon: Database, tone: "neutral" },
  STRIPE_METADATA_ATTACHED: { label: "Chargeback evidence attached in Stripe", icon: Shield, tone: "info" },
  REMINDER_SENT: { label: "Reminder sent", icon: BellRing, tone: "warning" },
};

const FALLBACK = { icon: Dot, tone: "neutral" as StatusTone };

export function AuditTimeline({
  events,
  parties,
}: {
  events: AuditEvent[];
  parties: Party[];
}) {
  if (events.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No events yet.</p>;
  }
  const partyName = (id: string | null) =>
    id ? (parties.find((p) => p.id === id)?.name ?? null) : null;

  return (
    <ol className="space-y-0">
      {events.map((event, i) => {
        const meta = EVENT_META[event.eventType] ?? { label: event.eventType, ...FALLBACK };
        const Icon = meta.icon;
        const isLast = i === events.length - 1;
        const who = partyName(event.partyId);
        const metadata = (event.metadata ?? {}) as Record<string, unknown>;
        const detailBits = [
          who,
          typeof metadata.templateId === "string" ? metadata.templateId : null,
          typeof metadata.selectedTierId === "string" ? metadata.selectedTierId : null,
          typeof metadata.ipAddress === "string" ? `IP ${metadata.ipAddress}` : null,
        ].filter(Boolean);
        return (
          <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
            {/* Connector runs from the badge's bottom edge to the next badge, centered
                under the 28px badge (left-3.5 = 14px is its midpoint) so the line threads
                through every icon exactly. */}
            {!isLast ? (
              <span
                aria-hidden
                className="absolute left-3.5 top-7 bottom-0 w-px -translate-x-1/2 bg-border"
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1",
                STATUS_TONES[meta.tone].icon
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium leading-5 text-foreground">{meta.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDateTime(event.occurredAt)}
                {detailBits.length > 0 ? ` · ${detailBits.join(" · ")}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
