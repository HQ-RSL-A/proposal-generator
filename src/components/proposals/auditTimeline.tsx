import { formatDateTime } from "@/lib/dates";
import type { AuditEvent, Party } from "@/generated/prisma/client";

const EVENT_META: Record<string, { label: string; icon: string }> = {
  PROPOSAL_CREATED: { label: "Proposal created", icon: "📝" },
  PROPOSAL_SENT: { label: "Sent. Content frozen and hashed", icon: "📤" },
  PROPOSAL_REVISED: { label: "Revision created", icon: "🔁" },
  EMAIL_SENT: { label: "Email sent", icon: "✉️" },
  EMAIL_DELIVERED: { label: "Email delivered", icon: "📬" },
  EMAIL_OPENED: { label: "Email opened", icon: "👀" },
  EMAIL_BOUNCED: { label: "Email bounced", icon: "⚠️" },
  PAGE_VIEWED: { label: "Document viewed", icon: "📖" },
  TIER_SELECTED: { label: "Pricing option selected", icon: "🎯" },
  ESIGN_CONSENTED: { label: "E-sign consent given", icon: "☑️" },
  PARTY_SIGNED: { label: "Signed", icon: "🖊️" },
  ALL_SIGNED: { label: "All parties signed", icon: "✅" },
  PARTY_DECLINED: { label: "Declined", icon: "🚫" },
  PROPOSAL_VOIDED: { label: "Voided", icon: "🗑️" },
  PROPOSAL_EXPIRED: { label: "Expired", icon: "⌛" },
  CHECKOUT_CREATED: { label: "Checkout session created", icon: "🛒" },
  PAYMENT_PAID: { label: "Payment received", icon: "💸" },
  PAYMENT_PROCESSING: { label: "Bank transfer processing", icon: "🏦" },
  PAYMENT_FAILED: { label: "Payment failed", icon: "❌" },
  CHECKOUT_EXPIRED: { label: "Checkout session expired", icon: "🕳️" },
  PDF_GENERATED: { label: "Executed PDF generated", icon: "📄" },
  NOTION_SYNCED: { label: "Notion CRM synced", icon: "🗂️" },
  STRIPE_METADATA_ATTACHED: { label: "Chargeback evidence attached in Stripe", icon: "🛡️" },
  REMINDER_SENT: { label: "Reminder sent", icon: "🔔" },
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
        const meta = EVENT_META[event.eventType] ?? { label: event.eventType, icon: "•" };
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
            <span className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs ring-1 ring-border">
              {meta.icon}
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
