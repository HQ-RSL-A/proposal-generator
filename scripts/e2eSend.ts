// Faithfully "sends" the [TEST] rehearsal draft WITHOUT the dashboard/auth, so the
// public sign -> Stripe Checkout -> executed-PDF walk can run headless on localhost.
//
// Mirrors sendProposal() (src/actions/proposals.ts) business logic step-for-step, calling
// the SAME lib functions (computeContentHash, generateSigningToken, putPrivate/fetchPrivateBlob,
// resolveTrackRecord). The ONLY things skipped are framework glue irrelevant to the walk:
//   - requireAuth()      (the action's admin-session gate)
//   - revalidatePath()   (Next cache invalidation)
//   - the signing_invite email (cosmetic here; we print the raw token to drive the browser,
//     and the post-payment receipts still exercise Resend)
// It enforces the SAME "admin signature must be saved" guard the real send does — no synthetic
// fallback, so we never deviate from real behavior or mutate AdminSettings.
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { computeContentHash } from "../src/lib/contentHash";
import { generateSigningToken } from "../src/lib/tokens";
import { putPrivate, fetchPrivateBlob, blobPaths } from "../src/lib/blob";
import { resolveTrackRecord } from "../src/lib/trackRecord";

const TITLE = "[TEST] Full Rehearsal: Brightline Test Co";
const ADMIN_EMAIL = "lalia@rsla.io";
const CLIENT_EMAIL = "rahul.lalia23@gmail.com"; // Rahul role-plays the client (seed Client.* = Rahul Lalia)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:1235";

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool as any) });

  const proposal = await prisma.proposal.findFirstOrThrow({
    where: { title: TITLE, status: "DRAFT" },
    include: { msaVersion: true },
    orderBy: { createdAt: "desc" },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokens = proposal.tokens as any as Record<string, string>;
  const validUntil =
    proposal.validUntil ?? new Date(Date.now() + 30 * 86_400_000);

  // Same guard as sendProposal: admin signature must already exist. No synthetic fallback.
  const settings = await prisma.adminSettings.findUnique({ where: { id: "singleton" } });
  if (!settings?.signatureBlobUrl) {
    throw new Error(
      "No admin signature saved in AdminSettings (real send would block too). Save one in Settings first."
    );
  }
  const adminSigPng = await fetchPrivateBlob(settings.signatureBlobUrl);
  console.log(`admin signature: using saved AdminSettings signature (${adminSigPng.length} bytes)`);

  // Freeze content exactly like the action (same key set -> hash re-verification will match).
  const frozenContent = {
    proposalId: proposal.id,
    versionNumber: proposal.versionNumber,
    tokens,
    paymentConfig: proposal.paymentConfig,
    trackRecord: resolveTrackRecord(proposal.trackRecord),
    msaVersionId: proposal.msaVersionId,
    msaVersionLabel: proposal.msaVersion.version,
    msaSha256: proposal.msaVersion.sha256,
  };
  const contentHash = computeContentHash(frozenContent);

  const now = new Date();
  const { raw, hash } = generateSigningToken();

  await prisma.$transaction(async (tx) => {
    await tx.proposal.update({
      where: { id: proposal.id },
      data: {
        status: "SENT",
        sentAt: now,
        validUntil,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        frozenContent: frozenContent as any,
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

    await tx.party.create({
      data: {
        proposalId: proposal.id,
        role: "CLIENT_SIGNER",
        name: `${tokens["Client.FirstName"] ?? ""} ${tokens["Client.LastName"] ?? ""}`.trim(),
        email: CLIENT_EMAIL,
        payer: true,
        orderIndex: 1,
        signingTokenHash: hash,
        tokenExpiresAt: validUntil,
      },
    });
  });

  await prisma.auditEvent.create({
    data: { proposalId: proposal.id, eventType: "PROPOSAL_SENT", metadata: { e2e: true, contentHash } },
  });

  console.log("");
  console.log(`Proposal:     ${proposal.id}`);
  console.log(`Content hash:  ${contentHash}`);
  console.log(`Client email:  ${CLIENT_EMAIL} (payer)`);
  console.log(`Signing URL:   ${APP_URL}/sign/${raw}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
