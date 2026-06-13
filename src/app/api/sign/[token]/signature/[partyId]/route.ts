import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { gateToken } from "@/lib/partyTokens";
import { fetchPrivateBlob } from "@/lib/blob";

/**
 * Streams any applied signature on the same proposal for display in the
 * document view (token-gated). Lets every party see who has already signed,
 * exactly as the executed PDF will show it.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; partyId: string }> }
) {
  const { token, partyId } = await params;
  const gate = await gateToken(token);
  if (!gate.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const signature = await prisma.signature.findFirst({
    where: { proposalId: gate.party.proposalId, partyId },
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
