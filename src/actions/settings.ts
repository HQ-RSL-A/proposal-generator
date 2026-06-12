"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/authGuard";
import { prisma } from "@/lib/prisma";
import { blobPaths, putPrivate } from "@/lib/blob";
import type { ActionResult } from "@/actions/proposals";

export async function saveAdminSignature(input: {
  pngDataUrl: string;
  adoptedName: string;
  type: "DRAWN" | "TYPED";
}): Promise<ActionResult> {
  await requireAuth();
  try {
    const match = input.pngDataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return { ok: false, error: "Signature must be a PNG." };
    const buffer = Buffer.from(match[1], "base64");
    if (buffer.length < 100 || buffer.length > 500_000) {
      return { ok: false, error: "Signature image size out of bounds." };
    }
    const { url } = await putPrivate(blobPaths.adminSignature(), buffer, "image/png");
    await prisma.adminSettings.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        signatureBlobUrl: url,
        signatureAdoptedName: input.adoptedName.trim() || "Rahul Lalia",
        signatureType: input.type,
      },
      update: {
        signatureBlobUrl: url,
        signatureAdoptedName: input.adoptedName.trim() || "Rahul Lalia",
        signatureType: input.type,
      },
    });
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to save" };
  }
}
