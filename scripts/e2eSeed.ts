// Seeds the [TEST] rehearsal draft into the production DB. Fake company name on
// purpose: the Notion sync only writes to CRM pages it can find, so this never
// touches real prospect rows. Safe to re-run; replaces the previous test draft.
import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const TITLE = "[TEST] Full Rehearsal — Brightline Test Co";

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool as any) });

  await prisma.proposal.deleteMany({ where: { title: TITLE, status: "DRAFT" } });

  const now = new Date();
  const validUntil = new Date(now.getTime() + 30 * 86_400_000);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const tokens = {
    "Client.ProposalTitle": "Marketing System Rehearsal for Brightline Test Co",
    "Client.FirstName": "Rahul",
    "Client.LastName": "Lalia",
    "Client.Company": "Brightline Test Co",
    "Client.ProblemTitle": "A Full Dress Rehearsal Before Real Clients",
    "Client.ProblemText":
      "This is the end to end test of the proposal system. Every step here mirrors what a real client sees: the email invite, this document, the signature, and checkout.\n\nIf you are reading this in your inbox, the Resend pipeline works.",
    "Client.SolutionTitle": "What This Test Proves",
    "Client.SolutionText":
      "Signing this document exercises the signature capture, consent recording, content hashing, and the instant Stripe redirect.\n\nPaying with the test card proves the webhook, the executed PDF, the email delivery, and the audit trail.",
    "Client.AtGlanceServices": "One complete signing and payment rehearsal",
    "Client.AtGlanceInvestment": "$997 one-time + $497/month (test mode, not real money)",
    "Client.AtGlanceTimeline": "About 3 minutes, start to finish",
    "Client.ScopeItems":
      "• Email invite lands from proposals@rsla.io\n• Document renders with all sections and the full MSA\n• Signature modal works (typed or drawn)\n• Stripe checkout opens right after signing\n• Executed PDF arrives by email with the signature certificate",
    "Client.TimelineItems":
      "• Sign: about 1 minute\n• Pay with test card 4242 4242 4242 4242: about 1 minute\n• PDF and receipts: within 2 minutes after payment",
    "Client.InvestmentDetails": "One-time setup: $997\nMonthly retainer: $497/month",
    "Client.InvestmentNote":
      "Test mode only. The card number 4242 4242 4242 4242 with any future expiry, any CVC, and any ZIP completes checkout without moving real money.",
    "Document.CreatedDate": fmt(now),
    "Client.ValidUntil": fmt(validUntil),
  };

  const paymentConfig = {
    currency: "usd",
    paymentMethods: ["card"],
    preferAch: false,
    tiers: null,
    oneTime: { amountCents: 99700, displayString: "$997", label: "One-time setup" },
    recurring: {
      amountCents: 49700,
      displayString: "$497/month",
      label: "Monthly retainer",
      intervalMonths: 1,
    },
  };

  const msa = await prisma.msaVersion.findUniqueOrThrow({ where: { version: "v3" } });
  const proposal = await prisma.proposal.create({
    data: { title: TITLE, tokens, paymentConfig, msaVersionId: msa.id },
  });
  await prisma.auditEvent.create({
    data: { proposalId: proposal.id, eventType: "PROPOSAL_CREATED", metadata: { e2e: true } },
  });
  console.log(`Draft ready: https://proposals.rsla.io/proposals/${proposal.id}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
