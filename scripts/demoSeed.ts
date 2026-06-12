// Demo seed: creates a SENT demo proposal with a known signing token so the
// client-facing signing experience can be previewed before external services
// (Blob/Resend/Stripe) are configured. Safe to re-run; safe to void/delete later.
import "dotenv/config";
import crypto from "crypto";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const DEMO_TITLE = "[DEMO] Multi-Channel Marketing System for Scorpion Junk Removal";

const tokens = {
  "Client.ProposalTitle": "Multi-Channel Marketing System for Scorpion Junk Removal",
  "Client.FirstName": "Dominique",
  "Client.LastName": "Norris",
  "Client.Company": "Scorpion Junk Removal",
  "Client.ProblemTitle": "Inconsistent Lead Flow Despite Strong Market Demand",
  "Client.ProblemText":
    'You put it perfectly: "the business is there, the money\'s there, it\'s just getting the consistent lead flows." Right now you\'re getting 6-8 conversations daily at $12 per conversation through Meta ads, but you know the system isn\'t optimized.\n\nThe bigger issue is you\'re stuck managing everything manually - from Facebook messages to transferring customer info from your notebook into Jobber after the fact. Your website isn\'t even loading right now, which means you\'re missing out on Google traffic entirely.',
  "Client.SolutionTitle": "Flexible Monthly Marketing with Professional Foundation",
  "Client.SolutionText":
    "We'll start by rebuilding your website with proper on-page SEO and pages for both junk removal and your upcoming dumpster rental service. Then you get to choose your focus each month from three core services: Meta Ads Management, Google Business Profile Optimization, or Website SEO.\n\nThis rotating approach lets you test what drives the best ROI for your specific market while building a complete digital presence over time.",
  "Client.AtGlanceServices":
    "Website rebuild + rotating monthly marketing (Meta Ads, GBP, or SEO)",
  "Client.AtGlanceInvestment": "Three options, $1,800 to $4,500/month",
  "Client.AtGlanceTimeline": "Website live in 2-3 weeks, marketing starts immediately after",
  "Client.ScopeItems":
    "• Complete website rebuild with mobile optimization and fast loading speeds\n• Junk removal service pages with clear pricing and service area information\n• Dumpster rental pages ready for your upcoming service expansion\n• Monthly rotating service selection from: Meta Ads Management, Google Business Profile Optimization, or Website SEO\n• Monthly strategy calls to plan next month's service focus\n• Performance reporting and recommendations for optimal channel rotation",
  "Client.TimelineItems":
    "• Website rebuild and launch: 2-3 weeks from contract signing\n• First month of chosen service begins immediately after website launch\n• Each new monthly service setup: 3-5 business days transition period\n• Performance review and next month planning: last week of each month",
  "Client.InvestmentDetails": "Pick the option that fits where you are right now:",
  "Client.InvestmentNote":
    "Every tier includes the website rebuild in month one. Monthly fees are billed in advance at the start of each cycle. No long-term lock-in beyond the stated minimum term — and you can move between tiers with 30 days' notice.",
  "Document.CreatedDate": "",
  "Client.ValidUntil": "",
};

const paymentConfig = {
  currency: "usd",
  paymentMethods: ["card", "us_bank_account"],
  oneTime: null,
  recurring: null,
  preferAch: false,
  tiers: [
    {
      id: "tier-premier",
      label: "Premier",
      recommended: false,
      includes: [
        "Everything in Growth",
        "Two rotating services per month",
        "Dedicated landing pages per campaign",
        "Priority support (same-day response)",
      ],
      oneTime: null,
      recurring: {
        amountCents: 450000,
        displayString: "$4,500/month",
        label: "Premier retainer",
        intervalMonths: 1,
      },
    },
    {
      id: "tier-growth",
      label: "Growth",
      recommended: true,
      includes: [
        "Website rebuild included",
        "One rotating service per month",
        "Monthly strategy call + reporting",
        "Review management included",
      ],
      oneTime: null,
      recurring: {
        amountCents: 300000,
        displayString: "$3,000/month",
        label: "Growth retainer",
        intervalMonths: 1,
      },
    },
    {
      id: "tier-foundation",
      label: "Foundation",
      recommended: false,
      includes: [
        "Website rebuild included",
        "One rotating service per quarter",
        "Quarterly strategy call",
        "Email support",
      ],
      oneTime: null,
      recurring: {
        amountCents: 180000,
        displayString: "$1,800/month",
        label: "Foundation retainer",
        intervalMonths: 1,
      },
    },
  ],
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool as any) });

  // Re-runs replace the previous demo
  await prisma.proposal.deleteMany({ where: { title: DEMO_TITLE } });

  const now = new Date();
  const validUntil = new Date(now.getTime() + 30 * 86_400_000);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  tokens["Document.CreatedDate"] = fmt(now);
  tokens["Client.ValidUntil"] = fmt(validUntil);

  const msa = await prisma.msaVersion.findUniqueOrThrow({ where: { version: "v3" } });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");

  const proposal = await prisma.proposal.create({
    data: {
      title: DEMO_TITLE,
      status: "SENT",
      tokens,
      paymentConfig,
      msaVersionId: msa.id,
      validUntil,
      sentAt: now,
      frozenAt: now,
    },
  });

  const frozenContent = {
    proposalId: proposal.id,
    versionNumber: 1,
    tokens,
    paymentConfig,
    msaVersionId: msa.id,
    msaVersionLabel: msa.version,
    msaSha256: msa.sha256,
  };
  await prisma.proposal.update({
    where: { id: proposal.id },
    data: {
      frozenContent,
      contentHash: crypto.createHash("sha256").update(stableStringify(frozenContent)).digest("hex"),
    },
  });

  // Admin party intentionally unsigned in the demo (signature image needs Blob).
  await prisma.party.create({
    data: {
      proposalId: proposal.id,
      role: "ADMIN_SIGNER",
      name: "Rahul Lalia",
      email: "lalia@rsla.io",
      orderIndex: 0,
    },
  });
  await prisma.party.create({
    data: {
      proposalId: proposal.id,
      role: "CLIENT_SIGNER",
      name: "Dominique Norris",
      email: "demo-client@example.com",
      payer: true,
      orderIndex: 1,
      signingTokenHash: tokenHash,
      tokenExpiresAt: validUntil,
    },
  });
  await prisma.auditEvent.create({
    data: { proposalId: proposal.id, eventType: "PROPOSAL_SENT", metadata: { demo: true } },
  });

  console.log(`Demo proposal: ${proposal.id}`);
  console.log(`Signing URL:   http://localhost:1235/sign/${rawToken}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
