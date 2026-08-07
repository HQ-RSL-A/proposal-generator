// Renders a proposal's CURRENT document (draft or sent) as an UNSIGNED PDF:
// full proposal + MSA with empty signature blocks. The trailing e-signature
// certificate page still renders (ProposalPdf emits it unconditionally);
// strip the last page downstream, e.g. with pypdf, for a clean attachment.
// Run: npx tsx scripts/exportDraftPdf.ts <proposalId> <outputPath>
import "dotenv/config";
import fs from "fs";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "../src/lib/prisma";
import { buildProposalSections, sectionsFromFrozen } from "../src/lib/proposalContent";
import { frozenTokens, frozenPaymentConfig, frozenTrackRecord } from "../src/lib/signingService";
import { ProposalPdf, type CertificateInfo } from "../src/components/pdf/ProposalPdf";
import type { FrozenContent } from "../src/lib/types";

async function main() {
  const [id, outPath] = process.argv.slice(2);
  if (!id || !outPath) {
    throw new Error("Usage: npx tsx scripts/exportDraftPdf.ts <proposalId> <outputPath>");
  }

  const proposal = await prisma.proposal.findUniqueOrThrow({
    where: { id },
    include: { msaVersion: true },
  });
  const tokens = frozenTokens(proposal);
  console.log(
    `Proposal ${proposal.id} v${proposal.versionNumber} status=${proposal.status}\n` +
      `Title: ${tokens["Client.ProposalTitle"]}\nClient: ${tokens["Client.FirstName"]} ${tokens["Client.LastName"]}, ${tokens["Client.Company"]}`
  );

  const frozen = proposal.frozenContent as unknown as FrozenContent | null;
  const sections = frozen
    ? sectionsFromFrozen(frozen, proposal.msaVersion.bodyMarkdown, proposal.selectedTierId)
    : buildProposalSections({
        tokens,
        paymentConfig: frozenPaymentConfig(proposal),
        trackRecord: frozenTrackRecord(proposal),
        msaBodyMarkdown: proposal.msaVersion.bodyMarkdown,
        selectedTierId: proposal.selectedTierId,
      });

  // Empty certificate + no signers: signature cards fall back to the printed
  // name/company with a blank line and "Date: ____" (the unsigned look).
  const certificate: CertificateInfo = {
    referenceId: "",
    versionNumber: proposal.versionNumber,
    contentHash: "",
    agreementVersion: proposal.msaVersion.version,
    sentAt: "",
    completedAt: "",
  };

  const buf = await renderToBuffer(
    React.createElement(ProposalPdf, {
      sections,
      signers: [],
      certificate,
      selectedTierId: proposal.selectedTierId,
      selectedAddOnIds: (proposal.selectedAddOnIds as unknown as string[] | null) ?? [],
    }) as Parameters<typeof renderToBuffer>[0]
  );

  fs.writeFileSync(outPath, Buffer.from(buf));
  console.log(`Wrote ${outPath} (${buf.length} bytes, certificate page still attached)`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
