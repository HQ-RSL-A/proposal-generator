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
    <EmailShell preview={`Your proposal from RSL/A is ready: ${data.proposalTitle}`}>
      <Heading>Your proposal is ready when you are</Heading>
      <Paragraph>Hi {data.recipientName.split(" ")[0]},</Paragraph>
      <Paragraph>
        The proposal we put together for {data.clientCompany} is ready for you:{" "}
        <strong>{data.proposalTitle}</strong>. Everything we discussed is in there, from the scope
        and timeline to the investment and the agreement that goes with it. The whole thing lives
        in your browser, and reviewing and signing takes just a few minutes.
      </Paragraph>
      <CtaButton href={signingUrl}>Review &amp; Sign</CtaButton>
      <Paragraph>
        It stays valid until <strong>{data.validUntil}</strong>, so take the time you need.
      </Paragraph>
      <Divider />
      <FinePrint>
        This signing link is unique to you, so please keep it to yourself. If anything looks off or
        a question comes up, just reply to this email and it reaches the team.
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
    <EmailShell preview={`Your proposal closes ${daysLeft <= 1 ? "today" : `in ${daysLeft} days`}`}>
      <Heading>
        {daysLeft <= 1 ? "Today is the last day for this one" : `${daysLeft} days left on your proposal`}
      </Heading>
      <Paragraph>Hi {data.recipientName.split(" ")[0]},</Paragraph>
      <Paragraph>
        A gentle nudge from our side. <strong>{data.proposalTitle}</strong> is still waiting for
        your signature, and the window closes on <strong>{data.validUntil}</strong>. Here is a
        fresh link that takes you right back to where you left off.
      </Paragraph>
      <CtaButton href={signingUrl}>Review &amp; Sign</CtaButton>
      <FinePrint>
        This link replaces the ones in earlier emails. If you have questions or the timing no
        longer works, just reply and we will figure it out together.
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
    <EmailShell preview={`${signedByName} has signed. Yours is the only signature left.`}>
      <Heading>{signedByName} has signed</Heading>
      <Paragraph>Hi {data.recipientName.split(" ")[0]},</Paragraph>
      <Paragraph>
        Good news. <strong>{signedByName}</strong> just signed{" "}
        <strong>{data.proposalTitle}</strong>, which means yours is the only signature left. Once
        you have signed, the agreement takes effect and everything starts moving.
      </Paragraph>
      <CtaButton href={signingUrl}>Review &amp; Sign</CtaButton>
      <FinePrint>This link replaces the ones in earlier emails.</FinePrint>
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
    <EmailShell preview={`Fully signed: ${data.proposalTitle}`}>
      <Heading>Everything is signed</Heading>
      <Paragraph>Hi {data.recipientName.split(" ")[0]},</Paragraph>
      <Paragraph>
        All parties have signed <strong>{data.proposalTitle}</strong>, and your executed copy is
        attached to this email. It carries the proposal, the Master Services Agreement, and the
        signature certificate in a single PDF, so keep it somewhere safe.
      </Paragraph>
      {paymentPending && paymentUrl ? (
        <>
          <Paragraph>
            One step remains: the first payment shown in <em>Your Investment</em>. If you have not
            completed checkout already, this button takes you straight there.
          </Paragraph>
          <CtaButton href={paymentUrl}>Complete Payment</CtaButton>
        </>
      ) : null}
      <Divider />
      <FinePrint>
        The attached PDF is your executed agreement. If a question comes up about anything in it,
        just reply to this email.
      </FinePrint>
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
      <Heading>{data.clientCompany} signed</Heading>
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
    <EmailShell preview={`Complete your payment for ${data.proposalTitle}`}>
      <Heading>One step left: the first payment</Heading>
      <Paragraph>Hi {data.recipientName.split(" ")[0]},</Paragraph>
      <Paragraph>
        <strong>{data.proposalTitle}</strong> is fully signed, which was the hard part. The only
        thing left is the first payment, and work begins the moment it lands.
      </Paragraph>
      <CtaButton href={paymentUrl}>Pay Securely</CtaButton>
      <FinePrint>
        Stripe handles the payment itself. Card and bank transfer both work.
      </FinePrint>
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
    <EmailShell preview={`Payment received for ${data.proposalTitle}`}>
      <Heading>{isAdmin ? `${data.clientCompany} paid` : "Payment received, and we are underway"}</Heading>
      {isAdmin ? (
        <>
          <DetailRow label="Proposal" value={data.proposalTitle} />
          <DetailRow label="Amount" value={amountLine} />
        </>
      ) : (
        <>
          <Paragraph>Hi {data.recipientName.split(" ")[0]},</Paragraph>
          <Paragraph>
            Your payment of <strong>{amountLine}</strong> for{" "}
            <strong>{data.proposalTitle}</strong> just came through. A kickoff email with next
            steps and scheduling is on its way to you, and work begins right away.
          </Paragraph>
          <FinePrint>
            Need anything before kickoff? Just reply to this email and it reaches the team.
          </FinePrint>
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
    <EmailShell preview={`Payment issue: ${data.proposalTitle}`}>
      <Heading>{isAdmin ? `Payment failed: ${data.clientCompany}` : "Your payment did not go through"}</Heading>
      {isAdmin ? (
        <Paragraph>
          The payment for <strong>{data.proposalTitle}</strong> failed. The client automatically
          received a retry link, so nothing is needed from you unless it keeps failing.
        </Paragraph>
      ) : (
        <>
          <Paragraph>Hi {data.recipientName.split(" ")[0]},</Paragraph>
          <Paragraph>
            The payment for <strong>{data.proposalTitle}</strong> did not process. This happens
            more often than you would think, usually because of a bank verification or a card
            limit. Your signature is safe and nothing is lost. Retry whenever you are ready.
          </Paragraph>
          <CtaButton href={paymentUrl}>Retry Payment</CtaButton>
        </>
      )}
    </EmailShell>
  );
}

export function ProposalVoidedEmail({ data }: { data: ProposalEmailData }) {
  return (
    <EmailShell preview={`Proposal withdrawn: ${data.proposalTitle}`}>
      <Heading>Proposal withdrawn</Heading>
      <Paragraph>Hi {data.recipientName.split(" ")[0]},</Paragraph>
      <Paragraph>
        The proposal <strong>{data.proposalTitle}</strong> has been withdrawn, and its signing link
        no longer works. If a revised version is on the way, it will arrive in a separate email
        shortly.
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
    <EmailShell preview={`Expired without signature: ${data.clientCompany}`}>
      <Heading>Proposal expired</Heading>
      <Paragraph>
        <strong>{data.proposalTitle}</strong> for {data.clientCompany} passed its validity date (
        {data.validUntil}) without all signatures. You can revise and resend it from the dashboard.
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
    <EmailShell preview={`Declined: ${data.clientCompany}`}>
      <Heading>Proposal declined</Heading>
      <Paragraph>
        <strong>{declinedBy}</strong> declined <strong>{data.proposalTitle}</strong>.
      </Paragraph>
      {reason ? <Paragraph>Reason given: &ldquo;{reason}&rdquo;</Paragraph> : null}
      <CtaButton href={dashboardUrl}>Open in Dashboard</CtaButton>
    </EmailShell>
  );
}

export function SystemAlertEmail({
  summary,
  details,
  healthUrl,
}: {
  summary: string;
  details: { label: string; value: string }[];
  healthUrl: string;
}) {
  return (
    <EmailShell preview={`System alert: ${summary}`}>
      <Heading>Something needs your attention</Heading>
      <Paragraph>{summary}</Paragraph>
      {details.map((row) => (
        <DetailRow key={row.label} label={row.label} value={row.value} />
      ))}
      <CtaButton href={healthUrl}>Open System Health</CtaButton>
      <FinePrint>
        Sent automatically so problems surface the moment they happen instead of days later.
      </FinePrint>
    </EmailShell>
  );
}
