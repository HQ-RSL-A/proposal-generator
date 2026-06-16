import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
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

type EventTone =
  | "slate"
  | "blue"
  | "violet"
  | "indigo"
  | "emerald"
  | "amber"
  | "rose"
  | "cyan";

/** Tinted badge: soft fill + saturated SVG glyph + faint ring, one per event family. */
const TONE_STYLE: Record<EventTone, string> = {
  slate: "bg-slate-50 text-slate-600 ring-slate-200",
  blue: "bg-blue-50 text-blue-600 ring-blue-200",
  violet: "bg-violet-50 text-violet-600 ring-violet-200",
  indigo: "bg-indigo-50 text-indigo-600 ring-indigo-200",
  emerald: "bg-emerald-50 text-emerald-600 ring-emerald-200",
  amber: "bg-amber-50 text-amber-600 ring-amber-200",
  rose: "bg-rose-50 text-rose-600 ring-rose-200",
  cyan: "bg-cyan-50 text-cyan-600 ring-cyan-200",
};

const EVENT_META: Record<string, { label: string; icon: LucideIcon; tone: EventTone }> = {
  PROPOSAL_CREATED: { label: "Proposal created", icon: FilePlus, tone: "slate" },
  PROPOSAL_SENT: { label: "Sent. Content frozen and hashed", icon: Send, tone: "blue" },
  PROPOSAL_REVISED: { label: "Revision created", icon: RefreshCw, tone: "indigo" },
  EMAIL_SENT: { label: "Email sent", icon: Mail, tone: "blue" },
  EMAIL_DELIVERED: { label: "Email delivered", icon: MailCheck, tone: "cyan" },
  EMAIL_OPENED: { label: "Email opened", icon: MailOpen, tone: "violet" },
  EMAIL_BOUNCED: { label: "Email bounced", icon: MailX, tone: "rose" },
  PAGE_VIEWED: { label: "Document viewed", icon: Eye, tone: "violet" },
  TIER_SELECTED: { label: "Pricing option selected", icon: SlidersHorizontal, tone: "indigo" },
  ESIGN_CONSENTED: { label: "E-sign consent given", icon: SquareCheck, tone: "blue" },
  PARTY_SIGNED: { label: "Signed", icon: PenLine, tone: "emerald" },
  ALL_SIGNED: { label: "All parties signed", icon: BadgeCheck, tone: "emerald" },
  PARTY_DECLINED: { label: "Declined", icon: Ban, tone: "rose" },
  PROPOSAL_VOIDED: { label: "Voided", icon: Trash2, tone: "rose" },
  PROPOSAL_EXPIRED: { label: "Expired", icon: Timer, tone: "rose" },
  CHECKOUT_CREATED: { label: "Checkout session created", icon: ShoppingCart, tone: "amber" },
  PAYMENT_PAID: { label: "Payment received", icon: CircleDollarSign, tone: "emerald" },
  PAYMENT_PROCESSING: { label: "Bank transfer processing", icon: Building2, tone: "amber" },
  PAYMENT_FAILED: { label: "Payment failed", icon: CircleX, tone: "rose" },
  CHECKOUT_EXPIRED: { label: "Checkout session expired", icon: Clock, tone: "rose" },
  PDF_GENERATED: { label: "Executed PDF generated", icon: FileCheck, tone: "emerald" },
  NOTION_SYNCED: { label: "Notion CRM synced", icon: Database, tone: "slate" },
  STRIPE_METADATA_ATTACHED: { label: "Chargeback evidence attached in Stripe", icon: Shield, tone: "cyan" },
  REMINDER_SENT: { label: "Reminder sent", icon: BellRing, tone: "amber" },
};

const FALLBACK = { icon: Dot, tone: "slate" as EventTone };

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
                TONE_STYLE[meta.tone]
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
