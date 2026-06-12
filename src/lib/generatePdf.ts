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
import type { FrozenContent, PaymentConfig } from "@/lib/types";
import {
  ProposalPdf,
  type CertificateInfo,
  type SignerCertInfo,
} from "@/components/pdf/ProposalPdf";

const EVENT_LABELS: Record<string, string> = {
  PROPOSAL_SENT: "Proposal sent and content frozen",
  EMAIL_DELIVERED: "Email delivered",
  PAGE_VIEWED: "Document viewed",
  TIER_SELECTED: "Pricing option selected",
  ESIGN_CONSENTED: "E-signature consent given",
  PARTY_SIGNED: "Signature applied",
  ALL_SIGNED: "All parties signed",
  CHECKOUT_CREATED: "Checkout session created",
  PAYMENT_PAID: "Payment received",
};

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
  const sections = sectionsFromFrozen(frozen, proposal.msaVersion.bodyMarkdown);

  const signers: SignerCertInfo[] = [];
  for (const party of proposal.parties) {
    const signature = proposal.signatures.find((sig) => sig.partyId === party.id);
    let dataUri: string | null = null;
    if (signature) {
      const png = await fetchPrivateBlob(signature.imageBlobUrl);
      dataUri = `data:image/png;base64,${png.toString("base64")}`;
    }
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
      signedAt: signature ? formatDateTime(signature.signedAt) : "—",
      consentedAt: signature?.consentedAt ? formatDateTime(signature.consentedAt) : null,
      ipAddress: signature?.ipAddress ?? null,
      userAgent: signature?.userAgent ?? null,
      signatureDataUri: dataUri,
    });
  }

  const selectedTier = (frozen.paymentConfig as PaymentConfig).tiers?.find(
    (tier) => tier.id === proposal.selectedTierId
  );

  const certificate: CertificateInfo = {
    proposalId: proposal.id,
    versionNumber: proposal.versionNumber,
    contentHash: proposal.contentHash ?? "—",
    msaVersionLabel: proposal.msaVersion.version,
    msaSha256: proposal.msaVersion.sha256,
    selectedTierLabel: selectedTier?.label ?? null,
    generatedAt: formatDateTime(new Date()),
    events: proposal.auditEvents
      .filter((event) => EVENT_LABELS[event.eventType])
      .map((event) => ({
        label: EVENT_LABELS[event.eventType],
        at: formatDateTime(event.occurredAt),
      })),
  };

  const pdfBuffer = await renderToBuffer(
    React.createElement(ProposalPdf, { sections, signers, certificate }) as Parameters<
      typeof renderToBuffer
    >[0]
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
    for (const party of proposal.parties.filter((p) => p.role === "CLIENT_SIGNER")) {
      // The payer's copy carries a payment link when checkout is still open.
      const rawToken =
        paymentPending && party.payer ? await rotatePartyToken(party.id) : undefined;
      await sendTemplateEmail("fully_signed_client", proposal.id, party.id, {
        paymentPending,
        rawToken,
      });
    }
    await sendTemplateEmail("fully_signed_admin", proposal.id, null, {});
  }

  return { blobUrl: url };
}
