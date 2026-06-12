import { prisma } from "@/lib/prisma";
import type { AuditEventType, Prisma } from "@/generated/prisma/client";

export async function logEvent(input: {
  proposalId: string;
  eventType: AuditEventType;
  partyId?: string | null;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        proposalId: input.proposalId,
        partyId: input.partyId ?? null,
        eventType: input.eventType,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    // The audit trail must never take down the action it documents.
    console.error("auditEvent write failed", input.eventType, error);
  }
}

export function getClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip");
}

export function getUserAgent(headers: Headers): string | null {
  return headers.get("user-agent");
}
