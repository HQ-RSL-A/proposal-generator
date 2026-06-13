import { Resend } from "resend";
import * as React from "react";
import { prisma } from "@/lib/prisma";
import { enqueueJob } from "@/lib/jobs";
import { logEvent } from "@/lib/audit";
import { fetchPrivateBlob } from "@/lib/blob";
import { formatCents, intervalLabel } from "@/lib/currency";
import { effectiveLineItems, type PaymentConfig, type TokensJson } from "@/lib/types";
import { paymentUrl, signingUrl } from "@/lib/tokens";
import type { Party, Proposal } from "@/generated/prisma/client";
import {
  CoSignerSignedEmail,
  DeclinedAdminEmail,
  ExpiredAdminEmail,
  FullySignedAdminEmail,
  FullySignedClientEmail,
  PaymentFailedEmail,
  PaymentLinkEmail,
  PaymentReceivedEmail,
  ProposalVoidedEmail,
  SigningInviteEmail,
  SigningReminderEmail,
  SystemAlertEmail,
  type ProposalEmailData,
} from "@/emails/templates";
import { SUPPORT_EMAIL } from "@/emails/base";

/** Where admin notifications are delivered. Never shown to clients. */
export const ADMIN_EMAIL = "lalia@rsla.io";
export { SUPPORT_EMAIL };

let resendClient: Resend | null = null;
function getResend(): Resend {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    resendClient = new Resend(key);
  }
  return resendClient;
}

function fromAddress(): string {
  return process.env.RESEND_FROM ?? "Rahul Lalia, RSL/A <proposals@send.rsla.io>";
}

export type EmailTemplateId =
  | "signing_invite"
  | "signing_reminder"
  | "co_signer_signed"
  | "fully_signed_client"
  | "fully_signed_admin"
  | "payment_link"
  | "payment_received_client"
  | "payment_received_admin"
  | "payment_failed_client"
  | "payment_failed_admin"
  | "proposal_voided"
  | "expired_admin"
  | "declined_admin";

interface BuiltEmail {
  to: string;
  subject: string;
  react: React.ReactElement;
  attachFinalPdf?: boolean;
}

type ProposalWithParties = Proposal & { parties: Party[] };

function emailData(proposal: ProposalWithParties, recipientName: string): ProposalEmailData {
  const frozen = proposal.frozenContent as { tokens?: TokensJson } | null;
  const tokens = (frozen?.tokens ?? proposal.tokens) as TokensJson;
  return {
    proposalTitle: tokens["Client.ProposalTitle"],
    clientFirstName: tokens["Client.FirstName"],
    clientCompany: tokens["Client.Company"],
    validUntil: tokens["Client.ValidUntil"],
    recipientName,
  };
}

function dealSummaryLine(proposal: ProposalWithParties): string {
  const frozen = proposal.frozenContent as { paymentConfig?: PaymentConfig } | null;
  const config = (frozen?.paymentConfig ?? proposal.paymentConfig) as PaymentConfig;
  const { oneTime, recurring } = effectiveLineItems(config, proposal.selectedTierId);
  const parts: string[] = [];
  if (oneTime) parts.push(`${formatCents(oneTime.amountCents)} one-time`);
  if (recurring)
    parts.push(`${formatCents(recurring.amountCents)}/${intervalLabel(recurring.intervalMonths)}`);
  return parts.length > 0 ? parts.join(" + ") : "Sign-only (no checkout)";
}

function appUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:1235"}${path}`;
}

/**
 * Subject conventions, kept boring on purpose so no inbox filter flinches:
 *   client-facing  ->  "[Status] {Document} · RSL/A"
 *   admin-facing   ->  "[Status] {Company} | {Document}"
 */
function clientSubject(status: string, data: ProposalEmailData): string {
  return `[${status}] ${data.proposalTitle} · RSL/A`;
}

function adminSubject(status: string, data: ProposalEmailData): string {
  return `[${status}] ${data.clientCompany} | ${data.proposalTitle}`;
}

/** "Growth Marketing Proposal - Fully Signed - Brightline x RSLA.pdf" */
export function executedPdfFilename(title: string, company: string): string {
  const clean = (value: string) => value.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  const cleanTitle = clean(title);
  const cleanCompany = clean(company);
  const titleCarriesCompany = cleanTitle.toLowerCase().includes(cleanCompany.toLowerCase());
  return titleCarriesCompany
    ? `${cleanTitle} - Fully Signed.pdf`
    : `${cleanTitle} - Fully Signed - ${cleanCompany} x RSLA.pdf`;
}

/**
 * Builds a template. `context.rawToken` is required for templates that embed a
 * signing/payment link — callers rotate the party token first (pre-signature only).
 */
export function buildTemplate(
  templateId: EmailTemplateId,
  proposal: ProposalWithParties,
  party: Party | null,
  context: {
    rawToken?: string;
    signedByName?: string;
    daysLeft?: number;
    amountCents?: number;
    declinedReason?: string | null;
    paymentPending?: boolean;
  }
): BuiltEmail {
  const dashboardUrl = appUrl(`/proposals/${proposal.id}`);
  const data = emailData(proposal, party?.name ?? "Rahul");

  switch (templateId) {
    case "signing_invite": {
      if (!party || !context.rawToken) throw new Error("invite needs party + token");
      return {
        to: party.email,
        subject: clientSubject("Ready to sign", data),
        react: <SigningInviteEmail data={data} signingUrl={signingUrl(context.rawToken)} />,
      };
    }
    case "signing_reminder": {
      if (!party || !context.rawToken) throw new Error("reminder needs party + token");
      return {
        to: party.email,
        subject:
          (context.daysLeft ?? 1) <= 1
            ? clientSubject("Last day", data)
            : clientSubject(`${context.daysLeft} days left`, data),
        react: (
          <SigningReminderEmail
            data={data}
            signingUrl={signingUrl(context.rawToken)}
            daysLeft={context.daysLeft ?? 1}
          />
        ),
      };
    }
    case "co_signer_signed": {
      if (!party || !context.rawToken) throw new Error("co-signer needs party + token");
      return {
        to: party.email,
        subject: clientSubject("Co-signer signed", data),
        react: (
          <CoSignerSignedEmail
            data={data}
            signedByName={context.signedByName ?? "Your co-signer"}
            signingUrl={signingUrl(context.rawToken)}
          />
        ),
      };
    }
    case "fully_signed_client": {
      if (!party) throw new Error("fully_signed_client needs party");
      const pending = context.paymentPending ?? false;
      return {
        to: party.email,
        subject: clientSubject("Fully signed", data),
        react: (
          <FullySignedClientEmail
            data={data}
            paymentPending={pending && party.payer}
            paymentUrl={pending && party.payer && context.rawToken ? paymentUrl(context.rawToken) : null}
          />
        ),
        attachFinalPdf: true,
      };
    }
    case "fully_signed_admin":
      return {
        to: ADMIN_EMAIL,
        subject: adminSubject("Signed", data),
        react: (
          <FullySignedAdminEmail
            data={data}
            totalLine={dealSummaryLine(proposal)}
            paymentStatusLine={
              proposal.paymentStatus === "NOT_REQUIRED"
                ? "No checkout (invoiced separately)"
                : proposal.paymentStatus === "PAID"
                  ? "Paid"
                  : "Awaiting payment"
            }
            dashboardUrl={dashboardUrl}
          />
        ),
        attachFinalPdf: true,
      };
    case "payment_link": {
      if (!party || !context.rawToken) throw new Error("payment_link needs payer + token");
      return {
        to: party.email,
        subject: clientSubject("Payment pending", data),
        react: <PaymentLinkEmail data={data} paymentUrl={paymentUrl(context.rawToken)} />,
      };
    }
    case "payment_received_client": {
      if (!party) throw new Error("payment_received_client needs party");
      return {
        to: party.email,
        subject: clientSubject("Payment received", data),
        react: (
          <PaymentReceivedEmail
            data={data}
            amountLine={context.amountCents ? formatCents(context.amountCents) : dealSummaryLine(proposal)}
            isAdmin={false}
          />
        ),
      };
    }
    case "payment_received_admin":
      return {
        to: ADMIN_EMAIL,
        subject: adminSubject("Paid", data),
        react: (
          <PaymentReceivedEmail
            data={data}
            amountLine={context.amountCents ? formatCents(context.amountCents) : dealSummaryLine(proposal)}
            isAdmin
          />
        ),
      };
    case "payment_failed_client": {
      if (!party || !context.rawToken) throw new Error("payment_failed_client needs payer + token");
      return {
        to: party.email,
        subject: clientSubject("Payment issue", data),
        react: (
          <PaymentFailedEmail data={data} paymentUrl={paymentUrl(context.rawToken)} isAdmin={false} />
        ),
      };
    }
    case "payment_failed_admin":
      return {
        to: ADMIN_EMAIL,
        subject: adminSubject("Payment failed", data),
        react: <PaymentFailedEmail data={data} paymentUrl={dashboardUrl} isAdmin />,
      };
    case "proposal_voided": {
      if (!party) throw new Error("proposal_voided needs party");
      return {
        to: party.email,
        subject: clientSubject("Withdrawn", data),
        react: <ProposalVoidedEmail data={data} />,
      };
    }
    case "expired_admin":
      return {
        to: ADMIN_EMAIL,
        subject: adminSubject("Expired", data),
        react: <ExpiredAdminEmail data={data} dashboardUrl={dashboardUrl} />,
      };
    case "declined_admin":
      return {
        to: ADMIN_EMAIL,
        subject: adminSubject("Declined", data),
        react: (
          <DeclinedAdminEmail
            data={data}
            declinedBy={context.signedByName ?? "The client"}
            reason={context.declinedReason ?? null}
            dashboardUrl={dashboardUrl}
          />
        ),
      };
  }
}

/**
 * Sends a template email with full logging. Each logical send creates an
 * EmailLog row whose id doubles as the Resend idempotency key, so retries of
 * the same logical send can never double-deliver.
 */
export async function sendTemplateEmail(
  templateId: EmailTemplateId,
  proposalId: string,
  partyId: string | null,
  context: Parameters<typeof buildTemplate>[3] = {},
  existingLogId?: string
): Promise<{ ok: boolean; logId: string }> {
  const proposal = await prisma.proposal.findUniqueOrThrow({
    where: { id: proposalId },
    include: { parties: true },
  });
  const party = partyId ? (proposal.parties.find((p) => p.id === partyId) ?? null) : null;

  const built = buildTemplate(templateId, proposal, party, context);

  const log = existingLogId
    ? await prisma.emailLog.findUniqueOrThrow({ where: { id: existingLogId } })
    : await prisma.emailLog.create({
        data: {
          proposalId,
          partyId,
          templateId,
          recipient: built.to,
          subject: built.subject,
        },
      });

  try {
    const attachments: { filename: string; content: Buffer }[] = [];
    if (built.attachFinalPdf) {
      const doc = await prisma.generatedDocument.findFirst({
        where: { proposalId, isFinal: true },
        orderBy: { generatedAt: "desc" },
      });
      if (!doc) throw new Error("Final PDF not generated yet");
      const attachData = emailData(proposal, "");
      attachments.push({
        filename: executedPdfFilename(attachData.proposalTitle, attachData.clientCompany),
        content: await fetchPrivateBlob(doc.blobUrl),
      });
    }

    const result = await getResend().emails.send(
      {
        from: fromAddress(),
        to: built.to,
        replyTo: SUPPORT_EMAIL,
        subject: built.subject,
        react: built.react,
        attachments: attachments.length > 0 ? attachments : undefined,
      },
      { idempotencyKey: `emaillog-${log.id}` }
    );
    if (result.error) throw new Error(result.error.message);

    await prisma.emailLog.update({
      where: { id: log.id },
      data: { resendMessageId: result.data?.id ?? null, status: "SENT", error: null },
    });
    await logEvent({
      proposalId,
      partyId,
      eventType: "EMAIL_SENT",
      metadata: { templateId, to: built.to, logId: log.id },
    });
    return { ok: true, logId: log.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "FAILED", error: message.slice(0, 1000) },
    });
    // Token-bearing emails can't be retried blindly (raw token isn't stored) —
    // the job processor rebuilds them via the rotate-and-resend path.
    await enqueueJob({
      jobType: "SEND_EMAIL",
      proposalId,
      payload: {
        emailLogId: log.id,
        templateId,
        partyId,
        context: { ...context, rawToken: undefined } as Record<string, unknown>,
        needsToken: Boolean(context.rawToken),
      },
      scheduledAt: new Date(Date.now() + 60_000),
    });
    return { ok: false, logId: log.id };
  }
}

/**
 * Direct admin alert for system failures (dead jobs, cron crashes, bounced
 * invites). Sends outside the job queue on purpose: if the queue itself is the
 * problem, an enqueued alert would never leave the building. Best-effort and
 * deduped via the Resend idempotency key; never throws into the caller's
 * error path.
 */
export async function sendSystemAlert(input: {
  summary: string;
  details: { label: string; value: string }[];
  /** Stable key per incident, e.g. "job-<id>-dead" — repeat sends collapse. */
  dedupeKey: string;
  proposalId?: string;
}): Promise<void> {
  try {
    const subject = `[System alert] ${input.summary.slice(0, 120)}`;
    const result = await getResend().emails.send(
      {
        from: fromAddress(),
        to: ADMIN_EMAIL,
        replyTo: SUPPORT_EMAIL,
        subject,
        react: (
          <SystemAlertEmail
            summary={input.summary}
            details={input.details}
            healthUrl={appUrl("/settings?tab=system")}
          />
        ),
      },
      { idempotencyKey: `sysalert-${input.dedupeKey}` }
    );
    if (result.error) throw new Error(result.error.message);
    if (input.proposalId) {
      await prisma.emailLog.create({
        data: {
          proposalId: input.proposalId,
          templateId: "system_alert_admin",
          recipient: ADMIN_EMAIL,
          subject,
          resendMessageId: result.data?.id ?? null,
          status: "SENT",
        },
      });
    }
  } catch (error) {
    // Alerting must never take down the path that triggered it.
    console.error("sendSystemAlert failed", error);
  }
}
