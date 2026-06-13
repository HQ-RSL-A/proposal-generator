import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { blobPaths, fetchPrivateBlob, putPrivate } from "@/lib/blob";
import { sha256Hex } from "@/lib/contentHash";
import { formatDateTime } from "@/lib/dates";
import { logEvent } from "@/lib/audit";
import { sendTemplateEmail } from "@/lib/email";
import { rotatePartyToken } from "@/lib/partyTokens";
import { sectionsFromFrozen } from "@/lib/proposalContent";
import type { FrozenContent } from "@/lib/types";
import {
  ProposalPdf,
  type CertificateInfo,
  type SignerCertInfo,
} from "@/components/pdf/ProposalPdf";

/**
 * Generates the executed PDF (proposal + MSA + signatures + certificate),
 * stores it in Blob, records the GeneratedDocument, and sends the
 * fully-signed emails. Idempotent: regenerating replaces the final document.
 */
export async function generateAndStorePdf(proposalId: string): Promise<{ blobUrl: string }> {
  const proposal = await prisma.proposal.findUniqueOrThrow({
    where: { id: proposalId },
    include: {
      parties: { orderBy: { orderIndex: "asc" } },
      signatures: true,
      msaVersion: true,
      auditEvents: { orderBy: { occurredAt: "asc" } },
    },
  });

  if (!proposal.frozenContent) throw new Error("Proposal has no frozen content");
  const frozen = proposal.frozenContent as unknown as FrozenContent;
  const sections = sectionsFromFrozen(
    frozen,
    proposal.msaVersion.bodyMarkdown,
    proposal.selectedTierId
  );
  const selectedAddOnIds = (proposal.selectedAddOnIds as unknown as string[] | null) ?? [];

  const firstViewedByParty = new Map<string, Date>();
  for (const event of proposal.auditEvents) {
    if (event.eventType === "PAGE_VIEWED" && event.partyId && !firstViewedByParty.has(event.partyId)) {
      firstViewedByParty.set(event.partyId, event.occurredAt);
    }
  }

  const signers: SignerCertInfo[] = [];
  for (const party of proposal.parties) {
    const signature = proposal.signatures.find((sig) => sig.partyId === party.id);
    let dataUri: string | null = null;
    if (signature) {
      const png = await fetchPrivateBlob(signature.imageBlobUrl);
      dataUri = `data:image/png;base64,${png.toString("base64")}`;
    }
    const viewedAt = firstViewedByParty.get(party.id);
    signers.push({
      name: party.name,
      email: party.email,
      role: party.role,
      method:
        signature?.type === "PRE_APPLIED"
          ? "Pre-applied by sender at send time"
          : signature?.type === "DRAWN"
            ? "Hand-drawn electronic signature"
            : signature?.type === "TYPED"
              ? `Typed electronic signature (${signature.fontFamily ?? "handwriting font"})`
              : "Not signed",
      adoptedName: signature?.adoptedName ?? party.name,
      signerTitle:
        signature?.signerTitle ?? (party.role === "ADMIN_SIGNER" ? "Managing Member" : "Signer"),
      signerCompany:
        signature?.signerCompany ??
        (party.role === "ADMIN_SIGNER" ? "RSL/A LLC" : frozen.tokens["Client.Company"]),
      viewedAt: viewedAt ? formatDateTime(viewedAt) : null,
      signedAt: signature ? formatDateTime(signature.signedAt) : null,
      ipAddress: signature?.ipAddress ?? null,
      signatureDataUri: dataUri,
      placements:
        signature?.stampedProposalAt && signature?.stampedAgreementAt
          ? "Placed on the proposal acceptance and the agreement execution"
          : null,
    });
  }

  const certificate: CertificateInfo = {
    referenceId: proposal.id.toUpperCase(),
    versionNumber: proposal.versionNumber,
    contentHash: proposal.contentHash ?? "",
    agreementVersion: proposal.msaVersion.version,
    sentAt: proposal.sentAt ? formatDateTime(proposal.sentAt) : "",
    completedAt: proposal.completedAt ? formatDateTime(proposal.completedAt) : formatDateTime(new Date()),
  };

  const pdfBuffer = await renderToBuffer(
    React.createElement(ProposalPdf, {
      sections,
      signers,
      certificate,
      selectedTierId: proposal.selectedTierId,
      selectedAddOnIds,
    }) as Parameters<typeof renderToBuffer>[0]
  );

  const blobPath = blobPaths.signedPdf(proposal.id, proposal.versionNumber);
  const { url } = await putPrivate(blobPath, Buffer.from(pdfBuffer), "application/pdf");

  await prisma.$transaction([
    prisma.generatedDocument.updateMany({
      where: { proposalId: proposal.id, isFinal: true },
      data: { isFinal: false },
    }),
    prisma.generatedDocument.create({
      data: {
        proposalId: proposal.id,
        blobPath,
        blobUrl: url,
        sha256: sha256Hex(Buffer.from(pdfBuffer)),
        sizeBytes: pdfBuffer.length,
        isFinal: true,
      },
    }),
  ]);

  await logEvent({
    proposalId: proposal.id,
    eventType: "PDF_GENERATED",
    metadata: { blobPath, sizeBytes: pdfBuffer.length },
  });

  // Executed-copy emails go out only once the PDF exists. Dedupe guard: a
  // regenerated PDF must not re-send them.
  const alreadySent = await prisma.emailLog.findFirst({
    where: { proposalId: proposal.id, templateId: "fully_signed_admin", status: { not: "FAILED" } },
  });
  if (!alreadySent) {
    const paymentPending =
      proposal.paymentStatus !== "NOT_REQUIRED" && proposal.paymentStatus !== "PAID";
    // The last signer's token is baked into the Stripe success_url. When the
    // payer IS the last signer (every single-signer deal), they are mid-checkout
    // right now — rotating their token here would 404 the page Stripe returns
    // them to. Skip the button for them; session-expiry recovery covers the
    // abandoned case. Payers who signed earlier get the button as their entry
    // point, and rotating THEIR token can't touch the in-flight success_url.
    const lastSigner = [...proposal.parties]
      .filter((p) => p.role === "CLIENT_SIGNER" && p.signedAt)
      .sort((a, b) => b.signedAt!.getTime() - a.signedAt!.getTime())[0];
    for (const party of proposal.parties.filter((p) => p.role === "CLIENT_SIGNER")) {
      const payerMidCheckout = party.payer && party.id === lastSigner?.id;
      const rawToken =
        paymentPending && party.payer && !payerMidCheckout
          ? await rotatePartyToken(party.id)
          : undefined;
      await sendTemplateEmail("fully_signed_client", proposal.id, party.id, {
        paymentPending,
        rawToken,
      });
    }
    await sendTemplateEmail("fully_signed_admin", proposal.id, null, {});
  }

  return { blobUrl: url };
}
