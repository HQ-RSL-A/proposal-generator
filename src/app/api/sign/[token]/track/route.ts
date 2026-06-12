import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { getClientIp, getUserAgent, logEvent } from "@/lib/audit";
import { gateToken } from "@/lib/partyTokens";

const bodySchema = z.object({
  kind: z.enum(["viewed", "tier_selected"]),
  tierId: z.string().max(80).nullable().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const ip = getClientIp(request.headers) ?? "unknown";
  if (!checkRateLimit(`track:${ip}`, 60, 60_000)) {
    return NextResponse.json({ ok: true }); // tracking is best-effort, never error loudly
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: true });
  }

  const gate = await gateToken(token);
  if (!gate.ok) return NextResponse.json({ ok: true });
  const party = gate.party;

  if (parsed.kind === "viewed") {
    await logEvent({
      proposalId: party.proposalId,
      partyId: party.id,
      eventType: "PAGE_VIEWED",
      metadata: { ipAddress: ip, userAgent: getUserAgent(request.headers) },
    });
    // First client view advances SENT -> VIEWED (guarded update, race-safe).
    if (party.role === "CLIENT_SIGNER") {
      await prisma.proposal.updateMany({
        where: { id: party.proposalId, status: "SENT" },
        data: { status: "VIEWED" },
      });
    }
  } else if (parsed.kind === "tier_selected" && parsed.tierId) {
    await logEvent({
      proposalId: party.proposalId,
      partyId: party.id,
      eventType: "TIER_SELECTED",
      metadata: { selectedTierId: parsed.tierId, provisional: true },
    });
  }

  return NextResponse.json({ ok: true });
}
