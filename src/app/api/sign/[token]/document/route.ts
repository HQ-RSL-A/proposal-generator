import { NextResponse, type NextRequest } from "next/server";
import { gateToken } from "@/lib/partyTokens";
import { prisma } from "@/lib/prisma";
import { fetchPrivateBlob } from "@/lib/blob";
import { executedPdfFilename } from "@/lib/email";
import { frozenTokens } from "@/lib/signingService";

/**
 * Lets a party download their executed copy straight from the confirmation
 * pages. Token-gated: post-signature tokens stay valid for exactly this.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const gate = await gateToken(token);
  if (!gate.ok) {
    return NextResponse.json({ error: "Link not valid" }, { status: 404 });
  }

  const proposal = gate.party.proposal;
  if (proposal.status !== "SIGNED") {
    return NextResponse.json({ error: "Not fully signed yet" }, { status: 409 });
  }

  const doc = await prisma.generatedDocument.findFirst({
    where: { proposalId: proposal.id, isFinal: true },
    orderBy: { generatedAt: "desc" },
  });
  if (!doc) {
    return NextResponse.json({ error: "Document still rendering" }, { status: 404 });
  }

  const tokens = frozenTokens(proposal);
  const filename = executedPdfFilename(
    tokens["Client.ProposalTitle"],
    tokens["Client.Company"]
  );

  const buffer = await fetchPrivateBlob(doc.blobUrl);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
