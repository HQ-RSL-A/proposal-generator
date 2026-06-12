import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchPrivateBlob } from "@/lib/blob";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email?.endsWith("@rsla.io")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const doc = await prisma.generatedDocument.findFirst({
    where: { proposalId: id, isFinal: true },
    orderBy: { generatedAt: "desc" },
  });
  if (!doc) return NextResponse.json({ error: "No PDF generated yet" }, { status: 404 });

  const buffer = await fetchPrivateBlob(doc.blobUrl);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="proposal-${id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
