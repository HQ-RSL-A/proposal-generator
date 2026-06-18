import { NextResponse, type NextRequest } from "next/server";
import { getActiveApiUser } from "@/lib/authGuard";
import { prisma } from "@/lib/prisma";
import { fetchPrivateBlob } from "@/lib/blob";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Re-validate the live, active user per request — a deactivated account must not keep
  // downloading the executed legal record on a still-valid JWT (RSL-11).
  if (!(await getActiveApiUser())) {
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
