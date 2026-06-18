"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireAuth } from "@/lib/authGuard";
import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/audit";
import { blobPaths, fetchPrivateBlob, putPrivate } from "@/lib/blob";
import { computeContentHash } from "@/lib/contentHash";
import { parseValidUntil } from "@/lib/dates";
import { sendTemplateEmail, ADMIN_EMAIL } from "@/lib/email";
import { enqueueJob, retryDeadJob } from "@/lib/jobs";
import { runJobNow } from "@/lib/jobRunner";
import { generateSigningToken, signingUrl } from "@/lib/tokens";
import { rotatePartyToken } from "@/lib/partyTokens";
import {
  findUnreplacedTokens,
  parseMsa,
  replaceTokensInBlocks,
} from "@/lib/parseMsa";
import { ZodError } from "zod";
import {
  paymentConfigSchema,
  partiesSchema,
  tokensJsonSchema,
  trackRecordConfigSchema,
  validatePaymentConfigForSend,
} from "@/lib/validation";
import { humanizeZodError } from "@/lib/zodErrors";
import type { FrozenContent, PaymentConfig, TokensJson } from "@/lib/types";
import { EMPTY_TRACK_RECORD, resolveTrackRecord } from "@/lib/trackRecord";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function errorMessage(error: unknown): string {
  if (error instanceof ZodError) return humanizeZodError(error);
  return error instanceof Error ? error.message : "Something went wrong";
}

// ---------- CRUD ----------

export async function createProposal(input: {
  title: string;
  tokens: unknown;
  paymentConfig: unknown;
  trackRecord?: unknown;
}): Promise<ActionResult<{ id: string }>> {
  await requireAuth();
  try {
    const tokens = tokensJsonSchema.parse(input.tokens);
    const paymentConfig = paymentConfigSchema.parse(input.paymentConfig);
    const trackRecord = trackRecordConfigSchema.parse(input.trackRecord ?? EMPTY_TRACK_RECORD);
    const msa = await prisma.msaVersion.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
    const proposal = await prisma.proposal.create({
      data: {
        title: input.title.trim() || tokens["Client.ProposalTitle"],
        tokens: tokens as object,
        paymentConfig: paymentConfig as object,
        trackRecord: trackRecord as object,
        msaVersionId: msa.id,
      },
    });
    await logEvent({ proposalId: proposal.id, eventType: "PROPOSAL_CREATED" });
    revalidatePath("/dashboard");
    return { ok: true, data: { id: proposal.id } };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function updateProposal(input: {
  id: string;
  title: string;
  tokens: unknown;
  paymentConfig: unknown;
  trackRecord?: unknown;
}): Promise<ActionResult> {
  await requireAuth();
  try {
    const existing = await prisma.proposal.findUniqueOrThrow({ where: { id: input.id } });
    if (existing.status !== "DRAFT") {
      return { ok: false, error: "Only drafts can be edited. Use Revise to create a new version." };
    }
    const tokens = tokensJsonSchema.parse(input.tokens);
    const paymentConfig = paymentConfigSchema.parse(input.paymentConfig);
    const trackRecord = trackRecordConfigSchema.parse(input.trackRecord ?? EMPTY_TRACK_RECORD);
    await prisma.proposal.update({
      where: { id: input.id },
      data: {
        title: input.title.trim() || tokens["Client.ProposalTitle"],
        tokens: tokens as object,
        paymentConfig: paymentConfig as object,
        trackRecord: trackRecord as object,
      },
    });
    revalidatePath(`/proposals/${input.id}`);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function deleteDraft(id: string): Promise<ActionResult> {
  const user = await requireAuth();
  try {
    if (user.role !== "ADMIN") {
      return { ok: false, error: "Only admins can delete drafts." };
    }
    const existing = await prisma.proposal.findUniqueOrThrow({ where: { id } });
    if (existing.status !== "DRAFT") {
      return { ok: false, error: "Only drafts can be deleted. Sent proposals can be voided." };
    }
    await prisma.proposal.delete({ where: { id } });
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

// ---------- Send ----------

export async function sendProposal(input: {
  id: string;
  parties: { name: string; email: string; payer: boolean }[];
}): Promise<ActionResult> {
  await requireAuth();
  try {
    const proposal = await prisma.proposal.findUniqueOrThrow({
      where: { id: input.id },
      include: { msaVersion: true },
    });
    if (proposal.status !== "DRAFT") {
      return { ok: false, error: "This proposal has already been sent." };
    }

    const tokens = tokensJsonSchema.parse(proposal.tokens);
    const paymentConfig = paymentConfigSchema.parse(proposal.paymentConfig) as PaymentConfig;
    const trackRecord = trackRecordConfigSchema.parse(resolveTrackRecord(proposal.trackRecord));
    const parties = partiesSchema.parse(input.parties);

    // Money guardrail: display strings must match structured cents.
    const priceErrors = validatePaymentConfigForSend(paymentConfig);
    if (priceErrors.length > 0) return { ok: false, error: priceErrors.join(" ") };

    // No client party may share the admin email (it has no signing link).
    if (parties.some((p) => p.email === ADMIN_EMAIL)) {
      return { ok: false, error: `${ADMIN_EMAIL} signs automatically. Remove it from the signer list.` };
    }

    // The MSA must render clean for these tokens.
    const msaBlocks = replaceTokensInBlocks(
      parseMsa(proposal.msaVersion.bodyMarkdown),
      tokens as unknown as Record<string, string>
    );
    const unreplaced = findUnreplacedTokens(msaBlocks);
    if (unreplaced.length > 0) {
      return { ok: false, error: `Unreplaced tokens in agreement: ${unreplaced.join(", ")}` };
    }

    const validUntil = parseValidUntil(tokens["Client.ValidUntil"]);
    if (!validUntil) {
      return { ok: false, error: `Could not parse "Client.ValidUntil": ${tokens["Client.ValidUntil"]}` };
    }
    if (validUntil.getTime() < Date.now()) {
      return { ok: false, error: "Client.ValidUntil is in the past. Update it before sending." };
    }

    // Rahul's signature must exist before anything is sent.
    const settings = await prisma.adminSettings.findUnique({ where: { id: "singleton" } });
    if (!settings?.signatureBlobUrl) {
      return { ok: false, error: "Save your signature in Settings before sending." };
    }

    // Freeze the content — this snapshot + hash is the legal record.
    const frozenContent: FrozenContent = {
      proposalId: proposal.id,
      versionNumber: proposal.versionNumber,
      tokens: tokens as TokensJson,
      paymentConfig,
      trackRecord,
      msaVersionId: proposal.msaVersionId,
      msaVersionLabel: proposal.msaVersion.version,
      msaSha256: proposal.msaVersion.sha256,
    };
    const contentHash = computeContentHash(frozenContent);

    // Copy the saved signature bytes so later settings changes can't alter sent documents.
    const adminSigPng = await fetchPrivateBlob(settings.signatureBlobUrl);

    const now = new Date();
    const clientTokens = parties.map(() => generateSigningToken());

    await prisma.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id: proposal.id },
        data: {
          status: "SENT",
          sentAt: now,
          validUntil,
          frozenContent: frozenContent as unknown as object,
          contentHash,
          frozenAt: now,
        },
      });

      const adminParty = await tx.party.create({
        data: {
          proposalId: proposal.id,
          role: "ADMIN_SIGNER",
          name: "Rahul Lalia",
          email: ADMIN_EMAIL,
          orderIndex: 0,
          signedAt: now,
        },
      });

      const { url: adminSigUrl } = await putPrivate(
        blobPaths.signature(proposal.id, adminParty.id),
        adminSigPng,
        "image/png"
      );

      await tx.signature.create({
        data: {
          proposalId: proposal.id,
          partyId: adminParty.id,
          type: "PRE_APPLIED",
          imageBlobUrl: adminSigUrl,
          adoptedName: settings.signatureAdoptedName ?? "Rahul Lalia",
          signerTitle: "Managing Member",
          signerCompany: "RSL/A LLC",
          fontFamily: null,
          esignConsented: true,
          consentedAt: now,
          signedAt: now,
        },
      });

      for (const [index, party] of parties.entries()) {
        await tx.party.create({
          data: {
            proposalId: proposal.id,
            role: "CLIENT_SIGNER",
            name: party.name,
            email: party.email,
            payer: party.payer,
            orderIndex: index + 1,
            signingTokenHash: clientTokens[index].hash,
            tokenExpiresAt: validUntil,
          },
        });
      }
    });

    await logEvent({
      proposalId: proposal.id,
      eventType: "PROPOSAL_SENT",
      metadata: { contentHash, parties: parties.map((p) => p.email) },
    });

    // Invites carry the freshly minted raw tokens.
    const created = await prisma.party.findMany({
      where: { proposalId: proposal.id, role: "CLIENT_SIGNER" },
      orderBy: { orderIndex: "asc" },
    });
    for (const [index, party] of created.entries()) {
      await sendTemplateEmail("signing_invite", proposal.id, party.id, {
        rawToken: clientTokens[index].raw,
      });
    }

    revalidatePath(`/proposals/${proposal.id}`);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

// ---------- Lifecycle ----------

export async function voidProposal(input: {
  id: string;
  reason: string;
  notifyParties: boolean;
}): Promise<ActionResult> {
  const user = await requireAuth();
  try {
    if (user.role !== "ADMIN") {
      return { ok: false, error: "Only admins can void proposals." };
    }
    const proposal = await prisma.proposal.findUniqueOrThrow({
      where: { id: input.id },
      include: { parties: true },
    });
    if (["VOIDED", "EXPIRED"].includes(proposal.status)) {
      return { ok: false, error: `Already ${proposal.status.toLowerCase()}.` };
    }
    if (proposal.paymentStatus === "PAID") {
      return { ok: false, error: "Paid proposals can't be voided." };
    }
    const now = new Date();
    await prisma.$transaction([
      prisma.proposal.update({
        where: { id: input.id },
        data: { status: "VOIDED", voidedAt: now, voidReason: input.reason || null },
      }),
      prisma.party.updateMany({
        where: { proposalId: input.id, signedAt: null },
        data: { tokenExpiresAt: now },
      }),
    ]);
    await logEvent({
      proposalId: input.id,
      eventType: "PROPOSAL_VOIDED",
      metadata: { reason: input.reason },
    });
    if (input.notifyParties) {
      for (const party of proposal.parties.filter((p) => p.role === "CLIENT_SIGNER")) {
        await sendTemplateEmail("proposal_voided", input.id, party.id, {});
      }
    }
    revalidatePath(`/proposals/${input.id}`);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function reviseProposal(id: string): Promise<ActionResult<{ id: string }>> {
  await requireAuth();
  try {
    const old = await prisma.proposal.findUniqueOrThrow({ where: { id } });
    if (old.status === "DRAFT") return { ok: false, error: "Drafts are edited directly." };
    if (old.paymentStatus === "PAID") {
      return { ok: false, error: "This proposal is paid. Start a new proposal instead." };
    }

    const revision = await prisma.$transaction(async (tx) => {
      const created = await tx.proposal.create({
        data: {
          title: old.title,
          tokens: old.tokens as object,
          paymentConfig: old.paymentConfig as object,
          trackRecord: (old.trackRecord ?? undefined) as object | undefined,
          msaVersionId: old.msaVersionId,
          versionNumber: old.versionNumber + 1,
          parentId: old.id,
        },
      });
      if (!["VOIDED", "EXPIRED", "DECLINED"].includes(old.status)) {
        await tx.proposal.update({
          where: { id: old.id },
          data: { status: "VOIDED", voidedAt: new Date(), voidReason: "Superseded by revision" },
        });
        await tx.party.updateMany({
          where: { proposalId: old.id, signedAt: null },
          data: { tokenExpiresAt: new Date() },
        });
      }
      return created;
    });

    await logEvent({
      proposalId: revision.id,
      eventType: "PROPOSAL_REVISED",
      metadata: { revisedFrom: old.id, versionNumber: revision.versionNumber },
    });
    revalidatePath("/dashboard");
    return { ok: true, data: { id: revision.id } };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

// ---------- Party utilities ----------

export async function remindParty(partyId: string): Promise<ActionResult> {
  // MEMBER-allowed: a reminder only re-emails the signer's EXISTING address (the member
  // never sees the link) and repoints nothing, so — unlike copy-link / email-repoint, which
  // stay ADMIN-only — it can't change who executes the contract (RSL-12).
  await requireAuth();
  try {
    const party = await prisma.party.findUniqueOrThrow({
      where: { id: partyId },
      include: { proposal: true },
    });
    if (party.signedAt) return { ok: false, error: "Already signed." };
    if (!["SENT", "VIEWED", "PARTIALLY_SIGNED"].includes(party.proposal.status)) {
      return { ok: false, error: "Proposal isn't open for signing." };
    }
    const rawToken = await rotatePartyToken(partyId);
    const daysLeft = party.proposal.validUntil
      ? Math.max(0, Math.ceil((party.proposal.validUntil.getTime() - Date.now()) / 86_400_000))
      : 7;
    await sendTemplateEmail("signing_reminder", party.proposalId, partyId, { rawToken, daysLeft });
    await logEvent({
      proposalId: party.proposalId,
      partyId,
      eventType: "REMINDER_SENT",
      metadata: { manual: true },
    });
    revalidatePath(`/proposals/${party.proposalId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/** Copy-link: mints a fresh link (earlier emailed links keep working only until rotation). */
export async function getFreshSigningLink(partyId: string): Promise<ActionResult<{ url: string }>> {
  const actor = await requireAuth();
  if (actor.role !== "ADMIN") return { ok: false, error: "Only admins can mint signing links." };
  try {
    const party = await prisma.party.findUniqueOrThrow({
      where: { id: partyId },
      include: { proposal: true },
    });
    if (party.role !== "CLIENT_SIGNER") return { ok: false, error: "Admin signs automatically." };
    const rawToken = await rotatePartyToken(partyId);
    return { ok: true, data: { url: signingUrl(rawToken) } };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function updatePartyEmail(input: {
  partyId: string;
  email: string;
  name: string;
}): Promise<ActionResult> {
  // The highest-stakes party action: repointing the email changes WHO executes the legal
  // contract. ADMIN-only, never MEMBER (RSL-12).
  const actor = await requireAuth();
  if (actor.role !== "ADMIN") return { ok: false, error: "Only admins can change a signer's email." };
  try {
    const party = await prisma.party.findUniqueOrThrow({
      where: { id: input.partyId },
      include: { proposal: true },
    });
    if (party.signedAt) return { ok: false, error: "Already signed, so the email is locked." };
    await prisma.party.update({
      where: { id: input.partyId },
      data: {
        email: input.email.trim().toLowerCase(),
        name: input.name.trim() || party.name,
        emailBounced: false,
      },
    });
    const rawToken = await rotatePartyToken(input.partyId);
    await sendTemplateEmail("signing_invite", party.proposalId, input.partyId, { rawToken });
    revalidatePath(`/proposals/${party.proposalId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

// ---------- Ops ----------

export async function regeneratePdf(proposalId: string): Promise<ActionResult> {
  await requireAuth();
  try {
    const proposal = await prisma.proposal.findUniqueOrThrow({ where: { id: proposalId } });
    if (proposal.status !== "SIGNED") return { ok: false, error: "Proposal isn't fully signed." };
    await prisma.generatedDocument.updateMany({
      where: { proposalId, isFinal: true },
      data: { isFinal: false },
    });
    const job = await enqueueJob({ jobType: "GENERATE_PDF", proposalId, payload: { proposalId } });
    after(async () => runJobNow(job.id));
    revalidatePath(`/proposals/${proposalId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function retryJob(jobId: string): Promise<ActionResult> {
  await requireAuth();
  try {
    await retryDeadJob(jobId);
    after(async () => runJobNow(jobId));
    revalidatePath("/health");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
