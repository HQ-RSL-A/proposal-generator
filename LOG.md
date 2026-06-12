# LOG.md — proposalGenerator

## 2026-06-11 — Initial build (full V1 codebase)

Planned and built the PandaDoc-replacement e-signing tool end-to-end in one session:

- **Plan**: explored `generateProposal` skill + expenseVault conventions; decisions locked
  with Rahul: V1 imports skill JSON (in-app AI generation = fast-follow), RSL/A signature
  auto-applies at send, per-proposal payment config, Resend for email.
- **Foundation**: Next 16 + Prisma 7 multiSchema (`proposals` schema in the shared Supabase
  project — free org is at the 2-project cap), NextAuth clone, middleware, migration SQL
  with RLS, seed (MSA v3 from msaV3.md + AdminSettings).
- **Backend**: signing service (serializable last-signer transaction, one checkout session
  per proposal), Stripe Checkout (inline price_data, subscription mode, ACH + async
  payments), webhook handlers with `WebhookEvent` dedupe + status guards, reconcile cron,
  daily expiry/reminder cron, `PendingJob` queue (after() + SKIP LOCKED sweep + backoff),
  Resend with EmailLog idempotency keys + svix webhook, Notion CRM sync (paid = full
  update, signed = note), PDF generation (@react-pdf, shared section builder, signature
  certificate page), token rotation rule (every token-bearing email mints a fresh link).
- **UI**: dashboard, proposal form (paste-JSON import with tier inference, payment config
  editor with display↔cents validation), send flow, detail page (preview/parties/audit/
  documents + dead-job retries), signing experience (document view, tier picker, draw/typed
  signature modal with ESIGN consent, decline), outcome pages, /pay recovery, settings
  (saved signature), /health.
- **Verification**: 47 Vitest tests green (incl. real MSA: 37 sections parse + tokens merge
  clean; real Scorpion fixture imports), `tsc` clean, ESLint clean, production build green
  (27 routes), dev-server smoke: sign-in 200, middleware redirect works, DB connectivity
  confirmed (P2021 = migration not yet applied, by design).

**Open**: DB placement confirmation (migration ready to run), then Rahul's manual setup:
Stripe keys/webhooks/ACH, Resend account + send.rsla.io DNS, Google OAuth client, Notion
integration + DB connect, Vercel project + domain + env. See README checklist.

## 2026-06-12 — Visual demo + signing-consent hardening

- Seeded a demo proposal (`scripts/demoSeed.ts` — runs without Blob/Resend/Stripe) and
  walked the signing experience in Chrome: full document render (37 MSA sections, merged
  data), tier selection, signature modal (draw + 4 typed fonts), ESIGN consent. Screenshots
  in `docs/screenshots/`.
- Investigated phantom TIER_SELECTED audit events: DOM-order sweep of tier buttons ~500ms
  apart, only under the chrome-devtools MCP browser, never reproduced with a click listener
  armed, never persisted to DB (provably client-state only). Concluded automation-environment
  artifact, not an app bug.
- Hardening anyway: the signature modal now restates the selected tier + price at the
  moment of consent ("You're signing for: Growth — $3,000/month").

## 2026-06-12 — SaaS layer + voice DNA pass

- Users + roles: `User` allowlist table (Google-only sign-in, rsla.io lock kept), ADMIN/
  MEMBER roles, team management in /settings (add, role change, remove access, last-admin
  guard), profile card with Google avatar. Members can't void/delete/manage settings
  (enforced in actions, hidden in UI).
- Routes: public landing page at `/` ("Send it. They sign. You get paid."), dashboard moved
  to /dashboard, role-gated nav, account dropdown with sign out.
- Voice DNA pass over every user-facing string (emails, signing pages, toasts, PDF labels):
  killed all em/en dashes, rewrote subjects and copy conversational per
  brandGuidelines/voiceDna.md.
- Fixes: Base UI `nativeButton={false}` on link-rendered buttons, favicon (app/icon.svg),
  sign-out via next-auth/react. Verified: tsc, lint, 47 tests, build (29 routes), landing
  public + dashboard gated smoke test.

## 2026-06-13 — Launch debugging: deploy, sign-in, PDF engine

- Vercel deploy fixed (lazy Prisma client; env vars pushed via CLI; aws-1 pooler URL after
  ENOTFOUND tenant error crashed sign-in). Domain proposals.rsla.io live (CNAME at
  Hostinger). Blob = OIDC auth (BLOB_STORE_ID + VERCEL_OIDC_TOKEN, no static token);
  blob.ts rewritten to SDK get/put. Stripe test mode fully wired (key validated, webhook
  endpoint we_1Thbkh… created via API, secrets on Vercel). Resend verified at root rsla.io;
  sender proposals@rsla.io; tracking off by choice (click tracking would rewrite signing
  links). Account-menu crash fixed (GroupLabel outside Menu.Group throws in Base UI).
- First live deal loop proven on the demo proposal: tier select → sign → checkout (4242) →
  paid. Notion sync wrote to the REAL Scorpion CRM page (demo reused a real company name);
  restored with Rahul's approval (Monthly 497, Contract Start 2026-03-10, test note
  deleted). Test/seed data uses fake company names from now on.
- PDF engine crash ("unsupported number: -9.6e21") root-caused by elimination: not fonts
  (TTF conversion kept anyway), not page-splitting (atomic blocks kept anyway), not
  hyphenation (disabled anyway). Actual cause: dynamic render-callback Text (page numbers)
  inside the fixed footer corrupts layout boxes on long flowing pages. Footer is static
  now; scripts/pdfSmoke.ts is the regression check. All GENERATE_PDF jobs DONE; executed
  PDF (98 KB) in Blob; fully_signed_admin DELIVERED to lalia@rsla.io with attachment.
