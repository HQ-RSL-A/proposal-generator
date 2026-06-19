// Removes the [TEST] rehearsal proposal from prod: cascade-deletes the DB row (parties,
// signatures, audit, emails, jobs, payment, documents) + its WebhookEvents, and deletes the
// Blob objects it created (signatures + executed PDF), plus the blobSmoke scratch object.
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { list, del } from "@vercel/blob";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const TITLE = "[TEST] Full Rehearsal: Brightline Test Co";

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool as any) });

  const proposals = await prisma.proposal.findMany({ where: { title: TITLE } });
  for (const p of proposals) {
    const { blobs } = await list({ prefix: `proposals/${p.id}/` });
    for (const b of blobs) {
      await del(b.url);
      console.log(`del blob  ${b.pathname}`);
    }
    const wh = await prisma.webhookEvent.deleteMany({ where: { proposalId: p.id } });
    await prisma.proposal.delete({ where: { id: p.id } });
    console.log(`del proposal ${p.id} (cascade) + ${wh.count} webhook events`);
  }
  if (proposals.length === 0) console.log("No [TEST] proposal found.");

  // blobSmoke scratch object
  try {
    await del("smoke/test.txt");
    console.log("del blob  smoke/test.txt");
  } catch {
    // already gone
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
