# Cited Co Proposal Platform Teardown

> Competitive teardown of a live Cited Co client proposal, captured for reference.
> Saved here so the findings survive even if the source URL is unpublished.

**Captured:** 2026-06-24
**Source URL:** `https://clients.citedco.ai/proposal/1f19369a4b22873142e187bd`
**Their company:** Cited Co / Cited Agency (citedco.ai, citedagency.com), a 2025-founded AEO ("Answer Engine Optimization") agency that gets brands cited by ChatGPT, Claude, Perplexity, and Gemini.
**This proposal was for:** Eye On Automations (contact Kelly Stevens, kelly@eyeonautomations.com), an "AI consultant" in Irvine. Proposal `status: approved`, `contract_status: viewed`, created 2026-06-23.

Raw artifacts captured alongside this doc live in `rawAssets/` (see manifest at the bottom).

---

## 1. One-line summary

Cited Co runs their **entire agency** (marketing site, SEO blog, proposals, contracts with e-sign, client intake, and a client portal that delivers their AI-visibility product) as a **single Lovable-built React app on a Supabase backend**, deployed to Cloudflare under custom subdomains. The proposal at the URL above is just one route (`/proposal/:slug`) of that app. It is, in concept, the same machine as RSL/A's proposal generator: a structured JSON of copy + pricing with merge tokens, rendered by a web platform, with a homegrown e-sign step.

---

## 2. Tech stack (with evidence)

| Layer | What they use | Evidence |
|---|---|---|
| **App builder** | **Lovable** (lovable.dev, the AI app builder) | og:image is a `…lovable.app` preview URL; `flock.js` + `/__l5e/events.js` Lovable analytics; event SDK named `lovable-user-app-events`; project_id `9f6a5885-0c28-4fd2-88f6-f4a1aede38d7` in the tracking token; running off a Lovable **preview** build (`artifact_kind: preview_commit_sha`) |
| **Frontend** | **React + Vite SPA**, client-side rendered, react-router | hashed `assets/index-*.js` / `index-*.css`, `<div id="root">`, ES module entry, no SSR/`__NEXT_DATA__`; `path:"/..."` route table in the bundle |
| **Charts** | **Recharts** | `recharts-cartesian-grid…` classes throughout the bundle (drives the case-study dashboard) |
| **PDF export** | **jsPDF + jspdf-autotable** | autotable `striped`/`plain` theme strings (likely contract or report PDF) |
| **Backend** | **Supabase** (Postgres + 6 Deno **edge functions**) | `qzxfyifoeoxcdzgrqhqj.supabase.co/functions/v1/...`, `x-served-by: supabase-edge-runtime`; project ref `qzxfyifoeoxcdzgrqhqj` |
| **CRM / source of truth** | **Airtable** | every proposal row carries an `airtable_record_id` (here `recVPeIjnrhCabtQs`) |
| **Billing** | **QuickBooks** (recurring invoice / sales receipt). **No Stripe.** | bundle string: "Create an automatic recurring invoice or sales receipt in QuickBooks for this client"; zero real Stripe references (the "stripe" hits were all Recharts gridlines) |
| **Hosting / CDN** | **Cloudflare** (Lovable deploys here) | `server: cloudflare`, `cf_deployment_id`, `cf-ray` |
| **Image storage** | **Cloudflare R2** + Lovable asset store (`/__l5e/assets-v1/...`) | og image on `pub-*.r2.dev`; hero + proof images on `/__l5e/assets-v1/` |
| **Analytics** | Lovable built-in: `flock.js` proxying to **Tinybird** via `/~api/analytics`, plus an OpenTelemetry-style event SDK posting to `/__l5e/trackevents` | HTML script tags + the live event payload (see section 6) |
| **Fonts** | Google Fonts: **Fraunces** (display serif), **Inter**, **JetBrains Mono**; self-hosted Instrument Serif + Work Sans | network + CSS |
| **E-signature** | **Homegrown** (a `contract_sign_token` + a `contract_status` state machine; "esign" appears ~137 times in the bundle). Not DocuSign. | JSON fields + `contracts-public` edge function |

---

## 3. Architecture and data flow

```
Airtable (lead + generated proposal content)
        │  (some automation pushes the record into Supabase; the row keeps its airtable_record_id)
        ▼
Supabase  ──  Postgres (proposal rows)  +  Edge Functions (Deno)  +  asset storage
        │
        │  GET functions/v1/proposals-public?slug=<slug>   (PUBLIC, anon key only)
        ▼
Lovable-built React/Vite SPA  (clients.citedco.ai)
        │  fetches the proposal JSON on load, fills merge tokens, renders 13 sections
        │  POST functions/v1/proposals-begin-engagement   (the "I'm ready" CTA → starts engagement)
        │  contracts-public  → homegrown e-sign (contract_sign_token, contract_status)
        ▼
QuickBooks recurring invoice  +  client portal / AI-visibility reporting
```

The whole proposal is **one JSON blob** the page fetches client-side. There is no server rendering; the SPA does all the assembly in the browser.

---

## 4. Full backend API surface (Supabase edge functions in the bundle)

All six are on `https://qzxfyifoeoxcdzgrqhqj.supabase.co/functions/v1/`:

| Function | Purpose |
|---|---|
| `proposals-public` | Fetch a proposal by `?slug=` (the one this teardown reads). Public, anon key. |
| `proposals-begin-engagement` | POST fired by the CTA button ("I'm Ready, Let's Get Started"). Starts the engagement / conversion. |
| `contracts-public` | Serves the contract for the homegrown e-sign flow. |
| `submit-intake` | Client onboarding intake form submission. |
| `client-portal-report` | Powers the client portal's AI-visibility + SEO report (their actual product). |
| `handle-email-unsubscribe` | Email unsubscribe handling. |

The app's react-router table also shows the rest of the platform living in the same build: `/proposals`, `/contracts`, `/contracts/template`, `/intake(s)`, `/leads`, `/clients/:siteId`, `/portal/:siteId`, `/client-report/:siteId`, `/client-tasks`, `/ai-visibility`, `/seo`, `/auth`, `/reset-password`, plus a full SEO blog for their case-study client "Living with Lolo" (dozens of Scottsdale interior-design article routes baked into the same SPA).

---

## 5. The merge-token system (this is the part most like ours)

The stored copy contains literal placeholders that the frontend fills from top-level fields. Same idea as our tokens-fill-blanks.

| Token in copy | Filled from field | Value here |
|---|---|---|
| `{{client_name}}` | `business_name` | "Eye On Automations" |
| `{{contact_name}}` | `lead_name` | "Kelly Stevens" |
| `{{city}}` | `city` | "Irvine" |
| `{{service}}` | `service` | "AI consultant" |

Example raw stored string (from `vision.body`): *"{{contact_name}}, when someone asks ChatGPT or Perplexity who to call in {{city}} for {{service}}, AI returns one answer..."*

Top-level proposal fields: `id`, `slug`, `project_title`, `business_name`, `lead_name`, `lead_email`, `airtable_record_id`, `content`, `status`, `sent_at`, `created_at`, `service`, `city`, `contract_sign_token`, `contract_status`. Full payload in `proposalData.json`.

---

## 6. Page structure (13 stacked sections)

Editorial / luxury aesthetic: alternating cream and charcoal sections, Fraunces serif display headlines, JetBrains Mono uppercase eyebrows, gold accent buttons, terminal-style dark data panels for the case study.

1. **Hero** — split layout, eyebrow "CITED CO", big serif headline, photo of the rep ("Lauren"), "Let's fix that" CTA.
2. **Proof bar** — "PROVEN ACROSS": ChatGPT, Claude, Perplexity, Gemini, Google AI Overviews.
3. **Vision** — "Your Visibility, Our Expertise" (uses the city/service tokens).
4. **Partnership** — "Our Signature Partnership", three value points.
5. **Journey** — 6 numbered steps (01 Clarity → 06 Compound).
6. **Case study "Living with Lolo"** — a live AI-visibility dashboard with 4 monthly scans (the killer proof, see section 8).
7. **Pull quote** — an unedited Claude screenshot naming the client first.
8. **Pricing** — monthly partnership + included items + a-la-carte add-ons.
9. **Execution / Onboarding** — one-time setup scope and price.
10. **FAQ** — 5 Q&As.
11. **Testimonials** — "Client Experiences" (items array empty; placeholder, not yet filled).
12. **Closing line.**
13. **CTA** — "Thank You. Let's Make Your Brand the Answer." with the begin-engagement button.

---

## 7. Pricing (as shown)

- **Monthly partnership:** `$2,500 / mo` (single tier, label "MONTHLY PARTNERSHIP"). Includes: deep onboarding, monthly AI-visibility scans across the four AI engines, competitor benchmarking, schema implementation + monitoring, one AI-optimized blog post/month, weekly Google Business Profile posts, automated monthly performance report, direct strategist access.
- **One-time onboarding:** `$3,000 one-time` (label "ONBOARDING & SETUP"). ~14-item scope: discovery, brand voice guide, technical baseline, PageSpeed audit, citation audit across 10 directories + Wikidata, GBP/Yelp check, baseline AI scan (8 scored queries), AI Mode vs Local Pack gap analysis, knowledge panel verification, competitor snapshot, schema implementation, first blog post, first month of GBP posts, 90-day editorial calendar.
- **Add-ons (a-la-carte):** additional blog post $750/mo each; multi-city location $750/mo per city; quarterly competitive deep-dive $750/quarter; review management $350/mo.

Single tier, not a tier grid.

---

## 8. The case-study metrics (their proof, rendered as data)

Client "Living with Lolo" (luxury interior design + design-build firm, Scottsdale AZ), their first client, tracked monthly since March 2026. Four consecutive automated scans across ChatGPT, Claude, Perplexity, Gemini over 48 tracked queries:

| Metric | Result |
|---|---|
| Overall visibility | 42% → 65% (+23 pts) |
| Claude platform | 17% → 75% in 60 days (once schema + entity work indexed) |
| First-place mentions | 7 → 23 of 48 queries |
| Platform coverage | 63% → 98% |

Month-by-month (overall / chatgpt / claude / gemini / perplexity / firstPlace):
- Mar 2026 Baseline: 42 / 42 / 17 / 58 / 50 / 7
- Apr 2026 First Movement: 46 / 33 / 17 / 67 / 67 / 10
- May 2026 Inflection: 67 / 50 / 75 / 75 / 67 / 19
- Jun 2026 Holding: 65 / 50 / 75 / 75 / 58 / 23

This is the same data their product generates for paying clients, reused inside the proposal as proof. Strong conversion device.

---

## 9. Analytics / tracking (the "metrics" the page itself collects)

Two layers, both Lovable defaults plus their own funnel state:

1. **Lovable event SDK** (`lovable-user-app-events` v0.1.2), batched to `POST /__l5e/trackevents`. Events seen on a single page load: `lovable.session_started`, `lovable.page_viewed`, `lovable.web_vital` (TTFB, FCP). Each event carries OpenTelemetry-style ids (anonymous_id, session_id, page_view_id, trace_id, span_id). It does **not** track scroll depth or per-section engagement.
2. **flock.js** → proxies to **Tinybird** via `/~api/analytics`. This is Lovable's built-in (and publicly criticized as undisclosed) analytics. See https://github.com/ul0gic/lovable-undisclosed-analytics.
3. **Their own funnel state**, stored on the proposal row: `status` (e.g. `approved`) and `contract_status` (e.g. `viewed` → presumably `signed`). This is how they know a prospect opened it.

---

## 10. Security / privacy notes (what NOT to copy)

The `proposals-public` edge function is **unauthenticated** (anon key only) and returns, to anyone with the slug:
- lead's full name and email,
- the `airtable_record_id`,
- full pricing,
- and the **`contract_sign_token`** (`86b2ff3c…`).

The slug is a random 24-hex string, so it is security-by-obscurity, but **shipping the signing token to the public client is a real hole.** If the sign flow only validates that token, someone with the link could potentially sign on the client's behalf. The Supabase anon JWT is also embedded in the bundle (normal for Supabase, but it means the edge functions must enforce row-level security and must not over-return sensitive fields).

**Our platform already does the opposite, correctly.** Per this repo's rules, RSL/A never stores raw signing tokens (only SHA-256 hashes), rotates a party's token on every email that embeds a link, and never returns tokens or PII from a public read. So this is a "what to avoid" example that validates our existing design, not something to copy.

---

## 11. How it compares to RSL/A's proposal generator

| Dimension | Cited Co | RSL/A (proposals.rsla.io, this repo) |
|---|---|---|
| Core idea | Structured JSON of copy + pricing + merge tokens, rendered on a custom-domain web page, with e-sign | **Same** |
| Where the copy comes from | Airtable lead fields filled into a template | **Claude API writes it from the actual Circleback sales-call transcript** |
| Build method | Lovable (no-code AI builder) | Custom Next.js + Prisma app |
| Rendering | Client-side React/Vite SPA off a public Supabase function | Server-rendered platform |
| Merge tokens | `{{client_name}}`, `{{contact_name}}`, `{{city}}`, `{{service}}` | tokens-fill-blanks (copy + tiers + add-ons + deposit + Phase-2 + track record) |
| Pricing | One monthly tier + one-time onboarding + add-ons | **Multiple tiers** (`--pricing-options`) + add-ons + deposit |
| E-sign | Homegrown token | Multi-party e-sign ceremony |
| Payment | **QuickBooks** recurring invoice (manual-ish), no Stripe | **Stripe charge, automated after signing** |
| CRM sync | Airtable (source) | **Notion auto-sync** |
| Data exposure | Leaks lead PII + sign token publicly | Not exposed this way |
| Proof section | **Live AI-visibility dashboard from their real product** | Track-record section in tokens |

**Net:** their architecture is the same concept, built faster via Lovable but leakier and less automated on payment/CRM. Our pipeline is more automated end to end (call → AI-written proposal → sign → Stripe → Notion). Two things genuinely worth borrowing from them:
1. **The proof-as-live-data case-study block.** Real month-over-month metrics rendered as a dashboard inside the proposal is a strong closer.
2. **Single-tier pricing presentation** reads cleaner than a tier grid for a productized retainer.

---

## 12. Raw artifacts manifest (`rawAssets/`)

| File | What it is |
|---|---|
| `proposalData.json` (in parent dir, pretty-printed) | The complete proposal payload from the Supabase function. The single most valuable artifact. |
| `proposalData.raw.json` | Same, raw/minified as served. |
| `index.html` | The SPA shell (shows the Lovable analytics script tags + context token). |
| `index-DmMryqjH.js` (1.99 MB) | The full minified React/Vite app bundle. The actual client code (routes, render logic, e-sign, charts). |
| `index-BMq2Mjfo.css` (130 KB) | The full compiled stylesheet. |
| `flock.js` | Lovable's analytics script (proxies to Tinybird). |
| `l5e-events.js` | Lovable's event SDK. |
| `ogPreview.png` | The og:image (a rendered Lovable preview of the page). |
| `lauren-hero.jpg` | The hero photo of the rep. |

### How to re-fetch fresh data later (while the URL is live)

```bash
SLUG=1f19369a4b22873142e187bd
KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6eGZ5aWZvZW94Y2R6Z3JxaHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MDY3NTYsImV4cCI6MjA5NjI4Mjc1Nn0.VXXrw5x8-geCWizoF_WkApXaQdYjd-YfvEQ5YwlJNJE
curl -s -H "apikey: $KEY" -H "authorization: Bearer $KEY" \
  "https://qzxfyifoeoxcdzgrqhqj.supabase.co/functions/v1/proposals-public?slug=$SLUG" | python3 -m json.tool
```

(Swap `$SLUG` for any other Cited Co proposal slug to read it too, since the endpoint is public.)
