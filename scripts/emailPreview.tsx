// Renders every email template with sample data into docs/emailPreviews/:
// one HTML file per email plus a stitched print.html (one email per page) that
// Chrome can print to PDF for a flip-through review.
// Run: npx tsx scripts/emailPreview.tsx
import "dotenv/config";
import fs from "fs";
import path from "path";
import * as React from "react";
import { render } from "@react-email/components";
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
} from "../src/emails/templates";

const data: ProposalEmailData = {
  proposalTitle: "Growth Marketing System for Brightline Test Co",
  clientFirstName: "Dominique",
  clientCompany: "Brightline Test Co",
  validUntil: "July 13, 2026",
  recipientName: "Dominique Norris",
};

const signingUrl = "https://proposals.rsla.io/sign/example";
const paymentUrl = "https://proposals.rsla.io/pay/example";
const dashboardUrl = "https://proposals.rsla.io/proposals/example";

interface PreviewEntry {
  n: number;
  id: string;
  to: string;
  subject: string;
  element: React.ReactElement;
}

const previews: PreviewEntry[] = [
  {
    n: 1,
    id: "signing_invite",
    to: "Client (each signer)",
    subject: `[Ready to sign] ${data.proposalTitle} · RSL/A`,
    element: <SigningInviteEmail data={data} signingUrl={signingUrl} />,
  },
  {
    n: 2,
    id: "signing_reminder",
    to: "Client (unsigned parties, 3-day and 1-day)",
    subject: `[3 days left] ${data.proposalTitle} · RSL/A`,
    element: <SigningReminderEmail data={data} signingUrl={signingUrl} daysLeft={3} />,
  },
  {
    n: 3,
    id: "co_signer_signed",
    to: "Client (remaining signer)",
    subject: `[Co-signer signed] ${data.proposalTitle} · RSL/A`,
    element: <CoSignerSignedEmail data={data} signedByName="Jordan Avery" signingUrl={signingUrl} />,
  },
  {
    n: 4,
    id: "fully_signed_client",
    to: "Client (all parties, executed PDF attached)",
    subject: `[Fully signed] ${data.proposalTitle} · RSL/A`,
    element: <FullySignedClientEmail data={data} paymentPending paymentUrl={paymentUrl} />,
  },
  {
    n: 5,
    id: "payment_link",
    to: "Client (payer, after checkout session expired)",
    subject: `[Payment pending] ${data.proposalTitle} · RSL/A`,
    element: <PaymentLinkEmail data={data} paymentUrl={paymentUrl} />,
  },
  {
    n: 6,
    id: "payment_received_client",
    to: "Client (payer)",
    subject: `[Payment received] ${data.proposalTitle} · RSL/A`,
    element: <PaymentReceivedEmail data={data} amountLine="$3,000.00" isAdmin={false} />,
  },
  {
    n: 7,
    id: "payment_failed_client",
    to: "Client (payer, retry link)",
    subject: `[Payment issue] ${data.proposalTitle} · RSL/A`,
    element: <PaymentFailedEmail data={data} paymentUrl={paymentUrl} isAdmin={false} />,
  },
  {
    n: 8,
    id: "proposal_voided",
    to: "Client (all parties)",
    subject: `[Withdrawn] ${data.proposalTitle} · RSL/A`,
    element: <ProposalVoidedEmail data={data} />,
  },
  {
    n: 9,
    id: "fully_signed_admin",
    to: "Admin (executed PDF attached)",
    subject: `[Signed] ${data.clientCompany} | ${data.proposalTitle}`,
    element: (
      <FullySignedAdminEmail
        data={data}
        totalLine="$3,000.00/month"
        paymentStatusLine="Awaiting payment"
        dashboardUrl={dashboardUrl}
      />
    ),
  },
  {
    n: 10,
    id: "payment_received_admin",
    to: "Admin",
    subject: `[Paid] ${data.clientCompany} | ${data.proposalTitle}`,
    element: <PaymentReceivedEmail data={data} amountLine="$3,000.00" isAdmin />,
  },
  {
    n: 11,
    id: "payment_failed_admin",
    to: "Admin",
    subject: `[Payment failed] ${data.clientCompany} | ${data.proposalTitle}`,
    element: <PaymentFailedEmail data={data} paymentUrl={dashboardUrl} isAdmin />,
  },
  {
    n: 12,
    id: "expired_admin",
    to: "Admin",
    subject: `[Expired] ${data.clientCompany} | ${data.proposalTitle}`,
    element: <ExpiredAdminEmail data={data} dashboardUrl={dashboardUrl} />,
  },
  {
    n: 13,
    id: "declined_admin",
    to: "Admin",
    subject: `[Declined] ${data.clientCompany} | ${data.proposalTitle}`,
    element: (
      <DeclinedAdminEmail
        data={data}
        declinedBy="Dominique Norris"
        reason="Budget approval slipped a quarter."
        dashboardUrl={dashboardUrl}
      />
    ),
  },
  {
    n: 14,
    id: "system_alert_admin (bonus)",
    to: "Admin (failures: dead jobs, crons, bounces)",
    subject: "[System alert] A GENERATE_PDF background task failed permanently",
    element: (
      <SystemAlertEmail
        summary="A GENERATE_PDF background task failed permanently"
        details={[
          { label: "Task", value: "GENERATE_PDF" },
          { label: "Attempts", value: "5 of 5" },
          { label: "Error", value: "Blob fetch timed out after 30s" },
        ]}
        healthUrl="https://proposals.rsla.io/settings?tab=system"
      />
    ),
  },
];

async function main() {
  const outDir = path.join(__dirname, "../docs/emailPreviews");
  fs.mkdirSync(outDir, { recursive: true });

  const blocks: string[] = [];
  for (const entry of previews) {
    const html = await render(entry.element);
    const slug = entry.id.replace(/[^a-z_]/g, "");
    fs.writeFileSync(path.join(outDir, `${String(entry.n).padStart(2, "0")}_${slug}.html`), html);

    blocks.push(`
      <section class="email-block">
        <div class="meta">
          <div class="num">${entry.n} / ${previews.length}</div>
          <div class="lines">
            <p><span>Template</span> ${entry.id}</p>
            <p><span>To</span> ${entry.to}</p>
            <p><span>Subject</span> ${entry.subject}</p>
          </div>
        </div>
        <iframe srcdoc="${html.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"></iframe>
      </section>`);
  }

  const page = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { margin: 0; font-family: -apple-system, Helvetica, Arial, sans-serif; }
  .email-block { page-break-after: always; padding: 18px 24px; }
  .meta { display: flex; gap: 14px; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 10px; margin-bottom: 6px; }
  .num { font-size: 13px; font-weight: 700; color: #0070F3; padding-top: 2px; white-space: nowrap; }
  .lines p { margin: 0 0 2px; font-size: 12px; color: #111827; }
  .lines span { display: inline-block; width: 64px; color: #6B7280; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
  iframe { width: 640px; height: 870px; border: 0; display: block; }
</style></head><body>${blocks.join("\n")}</body></html>`;

  fs.writeFileSync(path.join(outDir, "print.html"), page);
  console.log(`Rendered ${previews.length} emails into ${outDir}`);
}

main().catch((error) => {
  console.error("EMAIL PREVIEW FAILED:", error);
  process.exit(1);
});
