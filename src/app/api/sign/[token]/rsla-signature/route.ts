import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { gateToken } from "@/lib/partyTokens";
import { fetchPrivateBlob } from "@/lib/blob";

/** Streams the pre-applied RSL/A signature for display on the signing page (token-gated). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const gate = await gateToken(token);
  if (!gate.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const signature = await prisma.signature.findFirst({
    where: { proposalId: gate.party.proposalId, type: "PRE_APPLIED" },
  });
  if (!signature) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const png = await fetchPrivateBlob(signature.imageBlobUrl);
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=300",
    },
  });
}
