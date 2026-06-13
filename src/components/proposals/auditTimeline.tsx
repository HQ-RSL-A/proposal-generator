import { formatDateTime } from "@/lib/dates";
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

type EventTone = "default" | "success" | "danger";

const EVENT_META: Record<string, { label: string; icon: LucideIcon; tone?: EventTone }> = {
  PROPOSAL_CREATED: { label: "Proposal created", icon: FilePlus },
  PROPOSAL_SENT: { label: "Sent. Content frozen and hashed", icon: Send },
  PROPOSAL_REVISED: { label: "Revision created", icon: RefreshCw },
  EMAIL_SENT: { label: "Email sent", icon: Mail },
  EMAIL_DELIVERED: { label: "Email delivered", icon: MailCheck },
  EMAIL_OPENED: { label: "Email opened", icon: MailOpen },
  EMAIL_BOUNCED: { label: "Email bounced", icon: MailX, tone: "danger" },
  PAGE_VIEWED: { label: "Document viewed", icon: Eye },
  TIER_SELECTED: { label: "Pricing option selected", icon: SlidersHorizontal },
  ESIGN_CONSENTED: { label: "E-sign consent given", icon: SquareCheck },
  PARTY_SIGNED: { label: "Signed", icon: PenLine },
  ALL_SIGNED: { label: "All parties signed", icon: BadgeCheck, tone: "success" },
  PARTY_DECLINED: { label: "Declined", icon: Ban, tone: "danger" },
  PROPOSAL_VOIDED: { label: "Voided", icon: Trash2, tone: "danger" },
  PROPOSAL_EXPIRED: { label: "Expired", icon: Timer, tone: "danger" },
  CHECKOUT_CREATED: { label: "Checkout session created", icon: ShoppingCart },
  PAYMENT_PAID: { label: "Payment received", icon: CircleDollarSign, tone: "success" },
  PAYMENT_PROCESSING: { label: "Bank transfer processing", icon: Building2 },
  PAYMENT_FAILED: { label: "Payment failed", icon: CircleX, tone: "danger" },
  CHECKOUT_EXPIRED: { label: "Checkout session expired", icon: Clock, tone: "danger" },
  PDF_GENERATED: { label: "Executed PDF generated", icon: FileCheck },
  NOTION_SYNCED: { label: "Notion CRM synced", icon: Database },
  STRIPE_METADATA_ATTACHED: { label: "Chargeback evidence attached in Stripe", icon: Shield },
  REMINDER_SENT: { label: "Reminder sent", icon: BellRing },
};

const toneClass: Record<EventTone, string> = {
  default: "text-muted-foreground",
  success: "text-emerald-600",
  danger: "text-red-600",
};

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
    <ol className="relative space-y-0 border-l border-border pl-6">
      {events.map((event) => {
        const meta = EVENT_META[event.eventType] ?? { label: event.eventType, icon: Dot };
        const Icon = meta.icon;
        const who = partyName(event.partyId);
        const metadata = (event.metadata ?? {}) as Record<string, unknown>;
        const detailBits = [
          who,
          typeof metadata.templateId === "string" ? metadata.templateId : null,
          typeof metadata.selectedTierId === "string" ? metadata.selectedTierId : null,
          typeof metadata.ipAddress === "string" ? `IP ${metadata.ipAddress}` : null,
        ].filter(Boolean);
        return (
          <li key={event.id} className="relative pb-5">
            <span className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full bg-white ring-1 ring-border">
              <Icon className={`h-3 w-3 ${toneClass[meta.tone ?? "default"]}`} />
            </span>
            <p className="text-sm font-medium leading-5">{meta.label}</p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(event.occurredAt)}
              {detailBits.length > 0 ? ` · ${detailBits.join(" · ")}` : ""}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
