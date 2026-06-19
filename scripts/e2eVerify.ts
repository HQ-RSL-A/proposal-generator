// Dumps the full post-payment state of the [TEST] rehearsal proposal and downloads the
// executed PDF locally for visual inspection. Read-only except for writing the PDF to disk.
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import fs from "fs";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { fetchPrivateBlob } from "../src/lib/blob";

const TITLE = "[TEST] Full Rehearsal: Brightline Test Co";

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool as any) });

  const p = await prisma.proposal.findFirstOrThrow({
    where: { title: TITLE },
    orderBy: { createdAt: "desc" },
    include: {
      parties: { orderBy: { orderIndex: "asc" }, include: { signature: true } },
      auditEvents: { orderBy: { occurredAt: "asc" } },
      emailLogs: { orderBy: { sentAt: "asc" } },
      payment: true,
      documents: { orderBy: { generatedAt: "asc" } },
      jobs: { orderBy: { createdAt: "asc" } },
    },
  });

  const line = "-".repeat(72);
  console.log(line);
  console.log(`PROPOSAL  ${p.id}`);
  console.log(`  status=${p.status}  paymentStatus=${p.paymentStatus}`);
  console.log(`  paidAt=${p.paidAt?.toISOString() ?? "—"}  completedAt=${p.completedAt?.toISOString() ?? "—"}`);
  console.log(`  stripeCustomerId=${p.stripeCustomerId ?? "—"}  notionPageId=${p.notionPageId ?? "—"}`);

  console.log(line);
  console.log("PARTIES");
  for (const party of p.parties) {
    const s = party.signature;
    console.log(
      `  [${party.role}] ${party.name} <${party.email}> payer=${party.payer} signedAt=${party.signedAt?.toISOString() ?? "—"} declinedAt=${party.declinedAt?.toISOString() ?? "—"}`
    );
    if (s) {
      console.log(
        `      sig: type=${s.type} adopted="${s.adoptedName}" consent=${s.esignConsented} stampProposal=${s.stampedProposalAt?.toISOString() ?? "—"} stampAgreement=${s.stampedAgreementAt?.toISOString() ?? "—"}`
      );
    }
  }

  console.log(line);
  console.log("PAYMENT");
  if (p.payment) {
    console.log(
      `  status=${p.payment.status} amountTotalCents=${p.payment.amountTotalCents} currency=${p.payment.currency} method=${p.payment.paymentMethod ?? "—"}`
    );
    console.log(
      `  paidAt=${p.payment.paidAt?.toISOString() ?? "—"} sub=${p.payment.stripeSubscriptionId ?? "—"} pi=${p.payment.stripePaymentIntentId ?? "—"}`
    );
  } else {
    console.log("  (none)");
  }

  console.log(line);
  console.log("EMAIL LOGS");
  for (const e of p.emailLogs) {
    console.log(`  ${e.templateId.padEnd(26)} -> ${e.recipient.padEnd(26)} status=${e.status} delivered=${e.deliveredAt?.toISOString() ?? "—"}${e.error ? `  ERROR=${e.error}` : ""}`);
  }

  console.log(line);
  console.log("PENDING JOBS");
  for (const j of p.jobs) {
    console.log(`  ${j.jobType.padEnd(16)} status=${j.status} attempts=${j.attempts}/${j.maxAttempts} completed=${j.completedAt?.toISOString() ?? "—"}${j.lastError ? `  lastError=${j.lastError}` : ""}`);
  }

  console.log(line);
  console.log("AUDIT TRAIL");
  for (const a of p.auditEvents) {
    console.log(`  ${a.occurredAt.toISOString()}  ${a.eventType}`);
  }

  console.log(line);
  console.log("GENERATED DOCUMENTS");
  let finalDoc = null as null | (typeof p.documents)[number];
  for (const d of p.documents) {
    console.log(`  isFinal=${d.isFinal} size=${d.sizeBytes}B sha256=${d.sha256.slice(0, 16)}… path=${d.blobPath}`);
    if (d.isFinal) finalDoc = d;
  }
  if (!finalDoc && p.documents.length) finalDoc = p.documents[p.documents.length - 1];

  if (finalDoc) {
    const bytes = await fetchPrivateBlob(finalDoc.blobUrl);
    fs.writeFileSync("rehearsalShots/executed.pdf", bytes);
    console.log(line);
    console.log(`Downloaded executed PDF -> rehearsalShots/executed.pdf (${bytes.length} bytes)`);
  } else {
    console.log(line);
    console.log("No generated document yet.");
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
