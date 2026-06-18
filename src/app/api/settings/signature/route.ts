import { NextResponse } from "next/server";
import { getActiveApiUser } from "@/lib/authGuard";
import { prisma } from "@/lib/prisma";
import { fetchPrivateBlob } from "@/lib/blob";

export async function GET() {
  // Per-request active re-check (RSL-11).
  if (!(await getActiveApiUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const settings = await prisma.adminSettings.findUnique({ where: { id: "singleton" } });
  if (!settings?.signatureBlobUrl) {
    return NextResponse.json({ error: "No signature saved" }, { status: 404 });
  }
  const png = await fetchPrivateBlob(settings.signatureBlobUrl);
  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" },
  });
}
