# Dashboard Upgrade - design source

Claude Design exports for the June 2026 proposals-dashboard visual upgrade. Open the `.dc.html`
files in a browser to view the live mockups (`support.js` is the Claude Design canvas runtime
they load).

| File | What it is |
|---|---|
| `dashboardUpgrade.dc.html` | The full dashboard: MRR hero, metric cards, attention strip, filter tabs, pipeline table. Plus the three card treatments (Calm / **Insightful** / Bold). Insightful was chosen. |
| `dashboardFontOptions.dc.html` | Type study comparing four font directions. **Satoshi + Inter** (retire Space Grotesk) was chosen. |
| `support.js` | Claude Design canvas runtime (vendored; required for the `.dc.html` files to render). |

Implemented in `src/app/(admin)/dashboard/page.tsx`, `src/components/dashboard/*`, and
`src/lib/dashboardMetrics.ts`. See `LOG.md` for the build notes.
