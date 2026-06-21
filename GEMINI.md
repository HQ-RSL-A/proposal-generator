# GEMINI.md — proposalGenerator

Mirrors `CLAUDE.md` (kept in sync). Same rules for the Gemini agent.

## What This Is

RSL/A's self-hosted PandaDoc replacement: proposal + MSA rendering, multi-party e-signing
(drawn or typed signatures with ESIGN consent), instant Stripe Checkout after the final
signature, executed PDF with a signature certificate, Resend emails, Notion CRM sync.
Deploys to `proposals.rsla.io`. See `BRAIN.md` for architecture and reference, `ROADMAP.md`
for open and planned work.

## Rules

- **Money is integer cents everywhere.** Display strings live alongside cents; send-time
  validation blocks mismatches. Never use floats for amounts.
- **Sent proposals are immutable.** Content is frozen + SHA-256 hashed at send. Never mutate
  a sent proposal's content — use the Revise flow (new row, `parentId` link).
- **The MSA text lives in the DB (`MsaVersion`), seeded from `prisma/content/msaV3.md`.**
  Versions are immutable: attorney revisions = new version row + new seed entry, never an
  update. Signed documents keep the version they were signed with.
- **Raw signing tokens are never stored** — only SHA-256 hashes. Any email embedding a
  signing/payment link rotates that party's token first (`rotatePartyToken`). **Exception:**
  never rotate the payer's token while their checkout is in flight (payer == last signer);
  Stripe's success_url carries it. The /paid page also resolves by `?session_id=` as a
  safety net — keep both halves intact.
- **Side effects are queue-backed.** External calls (email, Notion, Stripe metadata, PDF)
  go through `PendingJob` + `after()` immediate attempt + cron sweep. Never let an
  integration failure block signing or payment.
- Webhooks must stay idempotent: `recordWebhookOnce` gates every handler; paid-state
  transitions are status-guarded (`updateMany where paymentStatus != PAID`).
- Dev Stripe is **test mode only** (`stripe listen --forward-to localhost:1235/api/webhooks/stripe`).
  Live keys exist only in Vercel env.
- **PDF rules:** no dynamic render-callback Texts inside `fixed` elements (corrupts layout
  on long documents); flowing blocks stay `wrap={false}`; Satoshi loads from the original
  OTFs and Inter from statics extracted out of the official Inter.ttc (**never convert font
  outlines** — a TTF conversion once corrupted a glyph). Any PDF change must pass
  `npx tsx scripts/pdfSmoke.ts` and a visual Read of the output.
- **No emojis in any client-facing output** (emails, subjects, screens, PDF). Public
  surfaces show only `SUPPORT_EMAIL` (team@rsla.io, a Google group) from
  `src/lib/constants.ts`; `ADMIN_EMAIL` (lalia@rsla.io) receives notifications and is never
  displayed. Subjects: `[Status] Document · RSL/A` (client), `[Status] Company | Document`
  (admin).
- **Signing is a two-place ceremony** (adopt once, stamp Proposal Acceptance + the MSA
  execution block). Don't collapse it to one stamp; the web document and PDF must render
  the same blocks from the same `ProposalSections`.
- **Test data uses fake company names only** (e.g. "Brightline Test Co"). The Notion sync
  matches CRM pages by company name and will write to real prospect rows. Ready-to-use test
  token: `docs/testProposalTokens.json`.
- Dev port: **1235** (expenseVault owns 1234).
- Migrations: hand SQL via `npx prisma db execute --file ...` (RLS lives outside Prisma's
  history — same convention as expenseVault). Never `prisma migrate dev` against the shared DB.
- **`main` is git-linked to Vercel — pushing to `main` auto-deploys to production.**
  `vercel deploy --prod --yes` is a manual deploy of the current directory (e.g. a worktree); use it
  only to ship a non-`main` state. Never manually deploy a branch that's behind `main` — it
  supersedes the live deploy and reverts whatever `main` last shipped.

## Commands

```bash
npm run dev                    # localhost:1235
npm test                       # vitest (pure logic: tokens, hashing, cents, MSA parser, validation)
npm run build                  # prisma generate + next build
npx prisma db seed             # seed MsaVersion v3 + AdminSettings
npx tsx scripts/pdfSmoke.ts    # render the full PDF locally (required after any PDF change)
npx tsx scripts/emailPreview.tsx  # render all 14 emails to docs/emailPreviews/
npx tsx scripts/e2eSeed.ts     # fresh [TEST] rehearsal draft (fake company, prod DB)
npx tsx scripts/blobSweep.ts   # DB-verified orphaned-blob sweep (dry-run; APPLY=1 to delete)
vercel deploy --prod --yes     # manual deploy of the CWD (worktree, etc.); main is git-linked, so pushing main also ships
```
