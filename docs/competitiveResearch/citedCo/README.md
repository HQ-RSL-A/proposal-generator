# Cited Co competitive teardown

Captured 2026-06-24 from a live Cited Co client proposal at
`https://clients.citedco.ai/proposal/1f19369a4b22873142e187bd`, saved so the findings
survive if the URL is unpublished.

- **[citedCoTeardown.md](citedCoTeardown.md)** - the full writeup: tech stack, architecture,
  backend API surface, merge-token system, page structure, pricing, case-study metrics,
  analytics, security notes, and a side-by-side comparison with our own proposal generator.
- **proposalData.json** - the complete proposal payload from their public Supabase function
  (the single most useful artifact; their entire content/pricing data model).
- **rawAssets/** - the live code as served: SPA shell (`index.html`), full app bundle
  (`index-DmMryqjH.js`, 1.99 MB), stylesheet, Lovable analytics scripts (`flock.js`,
  `l5e-events.js`), and images (`ogPreview.png`, `lauren-hero.jpg`).

**TL;DR:** they built basically our machine (structured JSON of copy + pricing + merge tokens,
rendered on a custom domain, with homegrown e-sign) using **Lovable + Supabase + Airtable**,
billed via **QuickBooks** (no Stripe). It is faster to stand up but leaks PII + the signing
token from a public endpoint, and stops short of automated payment. Two things worth borrowing:
the **live-metrics case-study block** and the **single-tier pricing layout**.

> Note: `rawAssets/` holds two large binaries (the ~2 MB app bundle and ~2.9 MB hero JPG). If
> these shouldn't go into git, add `docs/competitiveResearch/citedCo/rawAssets/` to `.gitignore`.
