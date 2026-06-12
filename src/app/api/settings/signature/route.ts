import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchPrivateBlob } from "@/lib/blob";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email?.endsWith("@rsla.io")) {
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
