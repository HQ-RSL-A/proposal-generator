import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchPrivateBlob } from "@/lib/blob";

/** Streams a party's signature image for the dashboard preview (team-gated). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; partyId: string }> }
) {
  const session = await auth();
  if (!session?.user?.email?.endsWith("@rsla.io")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, partyId } = await params;

  const signature = await prisma.signature.findFirst({
    where: { proposalId: id, partyId },
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
