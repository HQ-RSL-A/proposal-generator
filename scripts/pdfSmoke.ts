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
  "Client.ProposalTitle": "PDF Engine Smoke Test",
  "Client.FirstName": "Dominique",
  "Client.LastName": "Norris",
  "Client.Company": "Brightline Test Co",
  "Client.ProblemTitle": "Fonts That Refuse to Parse",
  "Client.ProblemText": "The OTF flavor of Satoshi crashed fontkit.\n\nThis render proves the TTF conversion fixed it.",
  "Client.SolutionTitle": "Converted Outlines",
  "Client.SolutionText": "CFF curves became quadratic glyf outlines via cu2qu. Same letterforms, parseable tables.",
  "Client.AtGlanceServices": "One rendered PDF",
  "Client.AtGlanceInvestment": "$0",
  "Client.AtGlanceTimeline": "Seconds",
  "Client.ScopeItems": "• Cover and At a Glance\n• Tier table\n• Acceptance blocks\n• Full 37-section MSA\n• Signature certificate",
  "Client.TimelineItems": "• Render now",
  "Client.InvestmentDetails": "Pick the option that fits:",
  "Client.InvestmentNote": "All weights of Satoshi exercised: regular, medium, bold, black.",
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
    { id: "a", label: "Foundation", recommended: false, includes: ["Item one", "Item two"], oneTime: null, recurring: { amountCents: 180000, displayString: "$1,800/month", label: "Retainer", intervalMonths: 1 } },
    { id: "b", label: "Growth", recommended: true, includes: ["Everything in Foundation", "More"], oneTime: null, recurring: { amountCents: 300000, displayString: "$3,000/month", label: "Retainer", intervalMonths: 1 } },
  ],
};

async function main() {
  const sections = buildProposalSections({ tokens, paymentConfig, msaBodyMarkdown: msa });
  const buffer = await renderToBuffer(
    React.createElement(ProposalPdf, {
      sections,
      signers: [
        { name: "Dominique Norris", email: "test@example.com", role: "CLIENT_SIGNER", method: "Typed electronic signature (Caveat)", adoptedName: "Dominique Norris", signedAt: "Jun 13, 2026, 9:00 AM EDT", consentedAt: "Jun 13, 2026, 9:00 AM EDT", ipAddress: "203.0.113.7", userAgent: "Mozilla/5.0 smoke", signatureDataUri: null },
        { name: "Rahul Lalia", email: "lalia@rsla.io", role: "ADMIN_SIGNER", method: "Pre-applied by sender at send time", adoptedName: "Rahul Lalia", signedAt: "Jun 13, 2026, 8:00 AM EDT", consentedAt: "Jun 13, 2026, 8:00 AM EDT", ipAddress: null, userAgent: null, signatureDataUri: null },
      ],
      certificate: {
        proposalId: "smoke-test",
        versionNumber: 1,
        contentHash: "a".repeat(64),
        msaVersionLabel: "v3",
        msaSha256: "b".repeat(64),
        selectedTierLabel: "Growth",
        generatedAt: "Jun 13, 2026, 9:01 AM EDT",
        events: [{ label: "Proposal sent and content frozen", at: "Jun 13, 2026" }],
      },
    }) as Parameters<typeof renderToBuffer>[0]
  );
  const out = path.join(__dirname, "../docs/pdfSmoke.pdf");
  fs.writeFileSync(out, buffer);
  console.log(`PDF OK: ${out} (${(buffer.length / 1024).toFixed(0)} KB)`);
}

main().catch((error) => {
  console.error("PDF SMOKE FAILED:", error.stack);
  process.exit(1);
});
