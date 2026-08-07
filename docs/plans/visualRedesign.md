# Plan — Visual redesign (landing, sign-in, dashboard) + KPIs + logo-only

Status: planned, not started. The build itself runs through the design skills per
`~/Developer/CLAUDE.md` (emilDesignEng for motion/polish, frontend-design, `/ui`). This
doc is the research-backed direction + the decisions to lock first.

Decisions needed are marked **[DECIDE]**.

---

## Logo-only branding (smallest, do first) — DONE 2026-06-13

Audit result: emails and PDF are **already logomark-only**. The web app is the only
place a wordmark sits beside the mark. Net change = two JSX deletions.

| Surface | File | Now | Change |
|---|---|---|---|
| Landing header | `src/app/page.tsx` (~L37) | logomark + "RSL/A Proposals" text | delete the `<span>` |
| App nav (dashboard/proposals/settings) | `src/components/layout/appShell.tsx` (~L40) | logomark + "Proposals" text | delete the `<span>` |
| Sign-in card | `src/app/sign-in/page.tsx` (~L13) | logomark in card | moves to new layout (below) |
| Email / PDF / favicon | — | logomark only | already correct |

Risk: middleware gotcha (BRAIN.md) — assets are excluded by *extension*; a new logo
file needs no matcher change as long as it keeps a known image extension. Never
exclude by filename.

---

## Landing page (`/`)

Current: clean but plain; left-flushed hero + 3 feature cards on a dot pattern.

**Recommended direction — "prestige internal product page"** (it's invite-only, not a
marketing site): logomark-only header; two-column hero (copy left, a small mock
"proposal card" right showing status chips + a signature line + a paid badge — built
from divs, no imagery); apply the existing `.gradient-text` to "You get paid.";
swap the flat dot bg for a soft radial gradient behind the hero; widen the feature
grid to breathe and tint the cards (`bg-accent/40`) with a thin primary top border.
Brand stays: Anchor Blue accent, Deep Slate, Satoshi/Inter, no hype.

**[DECIDE]** Confirm this direction or redirect (bolder? keep minimal?).

---

## Sign-in page (`/sign-in`)

Current: a single plain centered card; H1 "Proposal Generator" adds nothing.

**Recommended direction — "distilled split"**: full-bleed two-panel. Left ~40% Deep
Slate panel with the logomark centered (white-on-dark = pure brand signal). Right:
white panel, no card border, no redundant H1, one subtitle ("RSL/A team. Sign in with
your rsla.io account.") + the Google button + a small trust line ("Protected by Google
SSO, rsla.io accounts only"). Mobile collapses to the white panel only.

Risk: the `auth()` redirect (top of file) and the `signIn("google")` server-action
form must be left exactly as-is — only the surrounding JSX changes.

**[DECIDE]** Confirm the dark-split look (vs a cleaner single-card refresh).

---

## Dashboard (`/dashboard`)

Current: 3 operational stat cards (awaiting signature, signed-unpaid, collected
all-time) + a proposals table. No business intelligence, no trend, no win rate.

**Recommended direction — "ops command center"**: drop the redundant H1/subtitle;
expand to a 6-KPI grid (responsive `sm:2 / lg:3`) using the existing `card-hover`
pattern (tag label, `text-2xl tabular-nums` value, a context/delta sub-line); wrap the
table in a card with a count + "New proposal" action bar; collapse "valid until" into
the status cell on mobile.

All KPIs below compute from the data the page **already fetches** (`proposal.findMany`
with parties + payment). No schema changes, no new queries.

### Proposed KPIs — DECIDED: all 6 (Rahul, 2026-06-13)

| KPI | What it answers | Compute from |
|---|---|---|
| **Win rate** | Is pricing/quality landing? | SIGNED ÷ (SENT+VIEWED+PARTIALLY_SIGNED+SIGNED+DECLINED+EXPIRED) |
| **Contracted (TCV)** | Top-line output | Σ PAID `Payment.amountTotalCents` + Σ committed one-time on SIGNED |
| **MRR** | Is the retainer base growing? | Σ `recurring.amountCents` on SIGNED w/ recurring config |
| **Signed this month** | Closing more or fewer? | count SIGNED where `completedAt` ≥ start-of-month, delta vs last month |
| **Avg time to sign** | Ceremony speed | mean(`completedAt − sentAt`) over SIGNED |
| **Oldest open** | Action trigger | max(now − `sentAt`) for SENT/VIEWED/PARTIALLY_SIGNED; amber >14d |

Also available if wanted: **avg time to pay** (`paidAt − completedAt`), **collected
this month** (`Payment.paidAt` filtered).

**Caveat to know:** MRR is computed from signed proposals that carry a recurring
config. The schema has no contract-end / churn field, so a client who quietly stopped
won't drop out of MRR automatically. Accurate at signing; can drift over time. (No
schema change proposed — just label it honestly, e.g. "MRR from signed recurring
deals".)

Risk: don't touch the `requireUser()` chain or the existing findMany include; KPIs are
derived from the already-fetched array. Role-gating unchanged.

---

## Build note
Per workspace rules, the actual build goes through emilDesignEng (interaction/motion),
frontend-design, and `/ui` for any new components. This doc is direction + decisions;
lock the **[DECIDE]** items and the KPI set before building.
