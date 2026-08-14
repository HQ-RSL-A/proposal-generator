// Removes the [TEST] rehearsal proposal from prod: cascade-deletes the DB row (parties,
// signatures, audit, emails, jobs, payment, documents) + its WebhookEvents, and deletes the
// Blob objects it created (signatures + executed PDF), plus the blobSmoke scratch object.
// Also sweep-cancels every test-mode Stripe subscription (guarded to sk_test keys).
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import Stripe from "stripe";
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

  // A rehearsal that pays a recurring line leaves an active test-mode subscription
  // behind — the DB cascade never touches Stripe, and it then renews monthly as
  // invoice.* noise. Test mode holds only rehearsal/testing artifacts, so cancel all
  // of them. The sk_test guard is a hard stop: a live key must never reach this sweep.
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey?.startsWith("sk_test_")) {
    const stripe = new Stripe(stripeKey);
    let cancelled = 0;
    for await (const sub of stripe.subscriptions.list({ limit: 100 })) {
      await stripe.subscriptions.cancel(sub.id);
      console.log(`cancel test sub ${sub.id}`);
      cancelled += 1;
    }
    if (cancelled === 0) console.log("No test-mode subscriptions to cancel.");
  } else {
    console.log("Skip sub sweep: STRIPE_SECRET_KEY is not a sk_test key.");
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
