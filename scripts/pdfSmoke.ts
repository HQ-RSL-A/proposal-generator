// Renders the full proposal PDF locally (no DB/Blob) to validate fonts + layout.
// Run: npx tsx scripts/pdfSmoke.ts
import fs from "fs";
import path from "path";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { buildProposalSections } from "../src/lib/proposalContent";
import { ProposalPdf } from "../src/components/pdf/ProposalPdf";
import type { PaymentConfig, TokensJson } from "../src/lib/types";

const msa = fs.readFileSync(path.join(__dirname, "../prisma/content/msaV3.md"), "utf8");

const tokens: TokensJson = {
  "Client.ProposalTitle": "Multi-Channel Marketing System for Brightline",
  "Client.FirstName": "Dominique",
  "Client.LastName": "Norris",
  "Client.Company": "Brightline Test Co",
  "Client.ProblemTitle": "Inconsistent Lead Flow Despite Strong Demand",
  "Client.ProblemText": "Dominique mentioned it directly: the inquiries arrive in waves.\n\nThis paragraph exists to verify lowercase i renders correctly: initial, invisible, identification, individual.",
  "Client.SolutionTitle": "A System That Runs Itself",
  "Client.SolutionText": "Website, ads, and reviews working as one machine.",
  "Client.AtGlanceServices": "Website rebuild + rotating monthly marketing",
  "Client.AtGlanceInvestment": "Three options, $1,800 to $4,500/month",
  "Client.AtGlanceTimeline": "Website live in 2 to 3 weeks",
  "Client.ScopeItems": "• Complete website rebuild\n• Monthly rotating service\n• Monthly strategy calls",
  "Client.TimelineItems": "• Website live in 2 to 3 weeks\n• Marketing starts right after",
  "Client.InvestmentDetails": "Pick the option that fits where you are right now:",
  "Client.InvestmentNote": "Monthly fees are billed in advance at the start of each cycle.",
  "Document.CreatedDate": "June 13, 2026",
  "Client.ValidUntil": "July 13, 2026",
};

const paymentConfig: PaymentConfig = {
  currency: "usd",
  paymentMethods: ["card"],
  preferAch: false,
  oneTime: null,
  recurring: null,
  tiers: [
    { id: "tier-foundation", label: "Foundation", recommended: false, includes: ["Website rebuild included", "One rotating service per quarter"], oneTime: { amountCents: 400000, displayString: "$4,000", label: "Website build" }, recurring: { amountCents: 180000, displayString: "$1,800/month", label: "Retainer", intervalMonths: 1 } },
    { id: "tier-growth", label: "Growth", recommended: true, includes: ["Website rebuild included", "One rotating service per month"], oneTime: { amountCents: 600000, displayString: "$6,000", label: "Website build" }, recurring: { amountCents: 300000, displayString: "$3,000/month", label: "Retainer", intervalMonths: 1 } },
  ],
  addOns: [
    { id: "addon-rush", label: "Rush delivery (two-week build)", displayString: "$800", amountCents: 80000, intervalMonths: null },
    { id: "addon-extra-channel", label: "Extra ad channel each month", displayString: "$500/month", amountCents: 50000, intervalMonths: 1 },
  ],
  deposit: { depositPercent: 50 },
};

// A valid 1x1 PNG: enough for layout verification (real signatures come from the app).
function fakeSignaturePng(): string {
  return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
}

async function main() {
  const sections = buildProposalSections({
    tokens,
    paymentConfig,
    msaBodyMarkdown: msa,
    selectedTierId: "tier-growth",
  });
  const buffer = await renderToBuffer(
    React.createElement(ProposalPdf, {
      sections,
      selectedTierId: "tier-growth",
      selectedAddOnIds: ["addon-rush"],
      signers: [
        {
          name: "Dominique Norris",
          email: "dominique@brightline.example",
          role: "CLIENT_SIGNER",
          method: "Typed electronic signature (Caveat)",
          adoptedName: "Dominique Norris",
          signerTitle: "Owner",
          signerCompany: "Brightline Test Co",
          viewedAt: "Jun 13, 2026, 8:51 AM EDT",
          signedAt: "Jun 13, 2026, 9:06 AM EDT",
          ipAddress: "203.0.113.7",
          signatureDataUri: fakeSignaturePng(),
          placements: "Placed on the proposal acceptance and the agreement execution",
        },
        {
          name: "Rahul Lalia",
          email: "lalia@rsla.io",
          role: "ADMIN_SIGNER",
          method: "Pre-applied by sender at send time",
          adoptedName: "Rahul Lalia",
          signerTitle: "Managing Member",
          signerCompany: "RSL/A LLC",
          viewedAt: null,
          signedAt: "Jun 13, 2026, 8:00 AM EDT",
          ipAddress: null,
          signatureDataUri: fakeSignaturePng(),
          placements: null,
        },
      ],
      certificate: {
        referenceId: "CMQAKLJWC0000RRRMPHYQ4EBX",
        versionNumber: 1,
        contentHash: "7eeaad51d07af9319ea38c7fc293c514aabbccddeeff00112233445566778899",
        agreementVersion: "v3",
        sentAt: "Jun 13, 2026, 8:00 AM EDT",
        completedAt: "Jun 13, 2026, 9:06 AM EDT",
      },
    }) as Parameters<typeof renderToBuffer>[0]
  );
  const out = path.join(__dirname, "../docs/pdfSmoke.pdf");
  fs.writeFileSync(out, buffer);
  console.log(`PDF OK: ${out} (${(buffer.length / 1024).toFixed(0)} KB)`);
}

main().catch((error) => {
  console.error("PDF SMOKE FAILED:", error.stack?.split("\n")[0]);
  process.exit(1);
});
