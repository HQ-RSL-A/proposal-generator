import { NextResponse, after, type NextRequest } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rateLimit";
import { getClientIp, getUserAgent } from "@/lib/audit";
import { SigningError, submitSignature } from "@/lib/signingService";
import { enqueueJob } from "@/lib/jobs";
import { runJobNow } from "@/lib/jobRunner";
import { prisma } from "@/lib/prisma";
import { sendTemplateEmail } from "@/lib/email";
import { rotatePartyToken } from "@/lib/partyTokens";

const bodySchema = z.object({
  signatureType: z.enum(["DRAWN", "TYPED"]),
  signaturePngDataUrl: z.string().max(700_000),
  adoptedName: z.string().trim().min(1).max(120),
  signerTitle: z.string().trim().min(1).max(120),
  signerCompany: z.string().trim().min(1).max(160),
  fontFamily: z.string().max(60).nullable(),
  esignConsent: z.boolean(),
  selectedTierId: z.string().max(80).nullable(),
  selectedAddOnIds: z.array(z.string().max(80)).max(20).optional().default([]),
  // Two-place ceremony: client-side tap times for each signature placement.
  stampedProposalAt: z.string().datetime().nullable().optional(),
  stampedAgreementAt: z.string().datetime().nullable().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const ip = getClientIp(request.headers) ?? "unknown";

  if (!checkRateLimit(`sign:${ip}`, 10, 15 * 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const result = await submitSignature({
      rawToken: token,
      signatureType: parsed.signatureType,
      signaturePngDataUrl: parsed.signaturePngDataUrl,
      adoptedName: parsed.adoptedName,
      signerTitle: parsed.signerTitle,
      signerCompany: parsed.signerCompany,
      fontFamily: parsed.fontFamily,
      esignConsent: parsed.esignConsent,
      selectedTierId: parsed.selectedTierId,
      selectedAddOnIds: parsed.selectedAddOnIds,
      stampedProposalAt: parsed.stampedProposalAt ?? null,
      stampedAgreementAt: parsed.stampedAgreementAt ?? null,
      ipAddress: ip,
      userAgent: getUserAgent(request.headers),
    });

    if (result.allSigned) {
      // PDF + executed-copy emails + CRM note run in the background with queue fallback.
      after(async () => {
        const pdfJob = await enqueueJob({
          jobType: "GENERATE_PDF",
          proposalId: result.proposalId,
          payload: { proposalId: result.proposalId },
        });
        const notionJob = await enqueueJob({
          jobType: "NOTION_SYNC",
          proposalId: result.proposalId,
          payload: { proposalId: result.proposalId, kind: "signed" },
        });
        await runJobNow(pdfJob.id);
        await runJobNow(notionJob.id);
      });
    } else {
      // Nudge the remaining signers.
      after(async () => {
        const parties = await prisma.party.findMany({
          where: { proposalId: result.proposalId, role: "CLIENT_SIGNER" },
          orderBy: { signedAt: "desc" },
        });
        const justSigned = parties.find((p) => p.signedAt);
        for (const party of parties.filter((p) => !p.signedAt && !p.declinedAt)) {
          const rawToken = await rotatePartyToken(party.id);
          await sendTemplateEmail("co_signer_signed", result.proposalId, party.id, {
            rawToken,
            signedByName: justSigned?.name ?? "Your co-signer",
          });
        }
      });
    }

    return NextResponse.json({
      allSigned: result.allSigned,
      redirectUrl: result.checkoutUrl ?? `/sign/${token}/signed`,
    });
  } catch (error) {
    if (error instanceof SigningError) {
      const status =
        error.code === "already_signed" ? 409 : error.code === "invalid_token" ? 404 : 422;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error("sign route error", error);
    return NextResponse.json(
      { error: "Something went wrong applying your signature. Please try again." },
      { status: 500 }
    );
  }
}
