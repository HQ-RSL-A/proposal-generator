import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { blobPaths, fetchPrivateBlob, putPrivate } from "@/lib/blob";
import { sha256Hex } from "@/lib/contentHash";
import { formatDateTime } from "@/lib/dates";
import { logEvent } from "@/lib/audit";
import { sendTemplateEmail } from "@/lib/email";
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
              ? "Typed electronic signature"
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

  // Executed-copy emails go out once the PDF exists. Per-party dedup (RSL-22): key each send on
  // its OWN email-log row (not the single admin row), so a regeneration re-sends only the copy
  // that actually failed — a failed admin send no longer re-mails every client.
  // MANUAL_INVOICE joins NOT_REQUIRED/PAID as "no payment pending" so the executed-copy email
  // stays generic — a manually-invoiced deal must never show the client a Complete Payment link.
  const paymentPending =
    proposal.paymentStatus !== "NOT_REQUIRED" &&
    proposal.paymentStatus !== "PAID" &&
    proposal.paymentStatus !== "MANUAL_INVOICE";
  for (const party of proposal.parties.filter((p) => p.role === "CLIENT_SIGNER")) {
    const alreadySent = await prisma.emailLog.findFirst({
      where: {
        proposalId: proposal.id,
        partyId: party.id,
        templateId: "fully_signed_client",
        status: { not: "FAILED" },
      },
    });
    if (alreadySent) continue;
    // RSL-14: never rotate the payer's token here. By design the payer signs last and is
    // mid-checkout right now, so their token is live in the Stripe success_url/cancel_url
    // (see isPayerTokenInFlight) — rotating it would 404 the page Stripe returns them to. They
    // recover via the /paid + /pay session_id self-heal, or the payment_link email on session
    // expiry. The old "last signer by signedAt" heuristic mis-identified the payer on ties or a
    // non-payer signing last, rotating the live token out from under them.
    await sendTemplateEmail("fully_signed_client", proposal.id, party.id, { paymentPending });
  }
  const adminAlreadySent = await prisma.emailLog.findFirst({
    where: {
      proposalId: proposal.id,
      partyId: null,
      templateId: "fully_signed_admin",
      status: { not: "FAILED" },
    },
  });
  if (!adminAlreadySent) {
    await sendTemplateEmail("fully_signed_admin", proposal.id, null, {});
  }

  return { blobUrl: url };
}
