import * as React from "react";
import {
  CtaButton,
  DetailRow,
  Divider,
  EmailShell,
  FinePrint,
  Heading,
  Paragraph,
} from "@/emails/base";

export interface ProposalEmailData {
  proposalTitle: string;
  clientFirstName: string;
  clientCompany: string;
  validUntil: string;
  recipientName: string;
}

export function SigningInviteEmail({
  data,
  signingUrl,
}: {
  data: ProposalEmailData;
  signingUrl: string;
}) {
  return (
    <EmailShell preview={`Your proposal from RSL/A — ${data.proposalTitle}`}>
      <Heading>Your proposal is ready to review</Heading>
      <Paragraph>Hi {data.recipientName.split(" ")[0]},</Paragraph>
      <Paragraph>
        Here&apos;s the proposal we discussed: <strong>{data.proposalTitle}</strong>. It covers the
        full scope, timeline, investment, and agreement. Reviewing and signing takes a few minutes,
        all in your browser.
      </Paragraph>
      <CtaButton href={signingUrl}>Review &amp; Sign</CtaButton>
      <Paragraph>
        This proposal is valid until <strong>{data.validUntil}</strong>.
      </Paragraph>
      <Divider />
      <FinePrint>
        This signing link is unique to you — please don&apos;t forward it. If anything looks off or
        you have questions, just reply to this email.
      </FinePrint>
    </EmailShell>
  );
}

export function SigningReminderEmail({
  data,
  signingUrl,
  daysLeft,
}: {
  data: ProposalEmailData;
  signingUrl: string;
  daysLeft: number;
}) {
  return (
    <EmailShell preview={`Reminder — ${data.proposalTitle} expires soon`}>
      <Heading>
        {daysLeft <= 1 ? "Last day" : `${daysLeft} days left`} on your proposal
      </Heading>
      <Paragraph>Hi {data.recipientName.split(" ")[0]},</Paragraph>
      <Paragraph>
        Quick nudge — the proposal <strong>{data.proposalTitle}</strong> is still waiting for your
        signature and expires on <strong>{data.validUntil}</strong>. Here&apos;s your fresh link:
      </Paragraph>
      <CtaButton href={signingUrl}>Review &amp; Sign</CtaButton>
      <FinePrint>
        This link replaces the one in earlier emails. Questions? Just reply.
      </FinePrint>
    </EmailShell>
  );
}

export function CoSignerSignedEmail({
  data,
  signedByName,
  signingUrl,
}: {
  data: ProposalEmailData;
  signedByName: string;
  signingUrl: string;
}) {
  return (
    <EmailShell preview={`${signedByName} has signed — your signature completes it`}>
      <Heading>{signedByName} has signed</Heading>
      <Paragraph>Hi {data.recipientName.split(" ")[0]},</Paragraph>
      <Paragraph>
        <strong>{signedByName}</strong> just signed <strong>{data.proposalTitle}</strong>. Your
        signature is the last one needed to put it into effect.
      </Paragraph>
      <CtaButton href={signingUrl}>Review &amp; Sign</CtaButton>
      <FinePrint>This link replaces the one in earlier emails.</FinePrint>
    </EmailShell>
  );
}

export function FullySignedClientEmail({
  data,
  paymentPending,
  paymentUrl,
}: {
  data: ProposalEmailData;
  paymentPending: boolean;
  paymentUrl: string | null;
}) {
  return (
    <EmailShell preview={`Fully executed — ${data.proposalTitle}`}>
      <Heading>Your agreement is fully executed</Heading>
      <Paragraph>Hi {data.recipientName.split(" ")[0]},</Paragraph>
      <Paragraph>
        All parties have signed <strong>{data.proposalTitle}</strong>. Your executed copy — proposal,
        Master Services Agreement, and signature certificate — is attached to this email for your
        records.
      </Paragraph>
      {paymentPending && paymentUrl ? (
        <>
          <Paragraph>
            One step left: the first payment shown in <em>Your Investment</em>. If you didn&apos;t
            complete checkout already, you can do it here:
          </Paragraph>
          <CtaButton href={paymentUrl}>Complete Payment</CtaButton>
        </>
      ) : null}
      <Divider />
      <FinePrint>Keep this email — the attached PDF is your executed agreement.</FinePrint>
    </EmailShell>
  );
}

export function FullySignedAdminEmail({
  data,
  totalLine,
  paymentStatusLine,
  dashboardUrl,
}: {
  data: ProposalEmailData;
  totalLine: string;
  paymentStatusLine: string;
  dashboardUrl: string;
}) {
  return (
    <EmailShell preview={`Signed: ${data.clientCompany}`}>
      <Heading>🎉 {data.clientCompany} signed</Heading>
      <DetailRow label="Proposal" value={data.proposalTitle} />
      <DetailRow label="Deal" value={totalLine} />
      <DetailRow label="Payment" value={paymentStatusLine} />
      <CtaButton href={dashboardUrl}>Open in Dashboard</CtaButton>
      <FinePrint>The executed PDF is attached.</FinePrint>
    </EmailShell>
  );
}

export function PaymentLinkEmail({
  data,
  paymentUrl,
}: {
  data: ProposalEmailData;
  paymentUrl: string;
}) {
  return (
    <EmailShell preview={`Complete your payment — ${data.proposalTitle}`}>
      <Heading>Complete your payment</Heading>
      <Paragraph>Hi {data.recipientName.split(" ")[0]},</Paragraph>
      <Paragraph>
        Your agreement <strong>{data.proposalTitle}</strong> is signed — the only step left is the
        first payment. Work begins as soon as it lands.
      </Paragraph>
      <CtaButton href={paymentUrl}>Pay Securely</CtaButton>
      <FinePrint>Payments are processed by Stripe. Card and bank transfer accepted.</FinePrint>
    </EmailShell>
  );
}

export function PaymentReceivedEmail({
  data,
  amountLine,
  isAdmin,
}: {
  data: ProposalEmailData;
  amountLine: string;
  isAdmin: boolean;
}) {
  return (
    <EmailShell preview={`Payment received — ${data.proposalTitle}`}>
      <Heading>{isAdmin ? `💸 ${data.clientCompany} paid` : "Payment received — we're on"}</Heading>
      {isAdmin ? (
        <>
          <DetailRow label="Proposal" value={data.proposalTitle} />
          <DetailRow label="Amount" value={amountLine} />
        </>
      ) : (
        <>
          <Paragraph>Hi {data.recipientName.split(" ")[0]},</Paragraph>
          <Paragraph>
            We received your payment of <strong>{amountLine}</strong> for{" "}
            <strong>{data.proposalTitle}</strong>. You&apos;ll get a kickoff email with next steps
            and scheduling shortly. Work begins right away.
          </Paragraph>
          <FinePrint>Stripe will send a separate receipt for your records.</FinePrint>
        </>
      )}
    </EmailShell>
  );
}

export function PaymentFailedEmail({
  data,
  paymentUrl,
  isAdmin,
}: {
  data: ProposalEmailData;
  paymentUrl: string;
  isAdmin: boolean;
}) {
  return (
    <EmailShell preview={`Payment issue — ${data.proposalTitle}`}>
      <Heading>{isAdmin ? `⚠️ Payment failed: ${data.clientCompany}` : "Your payment didn't go through"}</Heading>
      {isAdmin ? (
        <Paragraph>
          The payment for <strong>{data.proposalTitle}</strong> failed. The client received a retry
          link automatically.
        </Paragraph>
      ) : (
        <>
          <Paragraph>Hi {data.recipientName.split(" ")[0]},</Paragraph>
          <Paragraph>
            The payment for <strong>{data.proposalTitle}</strong> didn&apos;t process — this happens
            sometimes with bank verifications. You can retry securely here:
          </Paragraph>
          <CtaButton href={paymentUrl}>Retry Payment</CtaButton>
        </>
      )}
    </EmailShell>
  );
}

export function ProposalVoidedEmail({ data }: { data: ProposalEmailData }) {
  return (
    <EmailShell preview={`Proposal withdrawn — ${data.proposalTitle}`}>
      <Heading>Proposal withdrawn</Heading>
      <Paragraph>Hi {data.recipientName.split(" ")[0]},</Paragraph>
      <Paragraph>
        The proposal <strong>{data.proposalTitle}</strong> has been withdrawn and its signing link
        deactivated. If a revised version is on the way, you&apos;ll receive it in a separate email.
      </Paragraph>
      <FinePrint>Questions? Just reply to this email.</FinePrint>
    </EmailShell>
  );
}

export function ExpiredAdminEmail({
  data,
  dashboardUrl,
}: {
  data: ProposalEmailData;
  dashboardUrl: string;
}) {
  return (
    <EmailShell preview={`Expired without signature — ${data.clientCompany}`}>
      <Heading>Proposal expired</Heading>
      <Paragraph>
        <strong>{data.proposalTitle}</strong> for {data.clientCompany} passed its validity date (
        {data.validUntil}) without all signatures. You can revise &amp; resend it from the
        dashboard.
      </Paragraph>
      <CtaButton href={dashboardUrl}>Open in Dashboard</CtaButton>
    </EmailShell>
  );
}

export function DeclinedAdminEmail({
  data,
  declinedBy,
  reason,
  dashboardUrl,
}: {
  data: ProposalEmailData;
  declinedBy: string;
  reason: string | null;
  dashboardUrl: string;
}) {
  return (
    <EmailShell preview={`Declined — ${data.clientCompany}`}>
      <Heading>Proposal declined</Heading>
      <Paragraph>
        <strong>{declinedBy}</strong> declined <strong>{data.proposalTitle}</strong>.
      </Paragraph>
      {reason ? <Paragraph>Reason given: &ldquo;{reason}&rdquo;</Paragraph> : null}
      <CtaButton href={dashboardUrl}>Open in Dashboard</CtaButton>
    </EmailShell>
  );
}
