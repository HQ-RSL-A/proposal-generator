import { NextResponse, after, type NextRequest } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rateLimit";
import { getClientIp, getUserAgent } from "@/lib/audit";
import { declineProposal, SigningError } from "@/lib/signingService";
import { sendTemplateEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({ reason: z.string().max(1000).nullable() });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const ip = getClientIp(request.headers) ?? "unknown";
  if (!checkRateLimit(`decline:${ip}`, 10, 15 * 60_000)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const { proposalId } = await declineProposal({
      rawToken: token,
      reason: parsed.reason,
      ipAddress: ip,
      userAgent: getUserAgent(request.headers),
    });
    after(async () => {
      const decliner = await prisma.party.findFirst({
        where: { proposalId, declinedAt: { not: null } },
        orderBy: { declinedAt: "desc" },
      });
      await sendTemplateEmail("declined_admin", proposalId, null, {
        signedByName: decliner?.name,
        declinedReason: parsed.reason,
      });
    });
    return NextResponse.json({ ok: true, redirectUrl: `/sign/${token}/declined` });
  } catch (error) {
    if (error instanceof SigningError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 422 });
    }
    console.error("decline route error", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
