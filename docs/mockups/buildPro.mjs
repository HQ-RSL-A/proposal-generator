import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const base = fs.readFileSync(path.join(dir, "dashboardMockup.html"), "utf8");

// ---- sparkline generator (axis-free, stretches to card width) ----
function spark(data, color, id) {
  const W = 140, H = 36, pad = 4, n = data.length;
  const x = (i) => +((i / (n - 1)) * W).toFixed(2);
  const y = (v) => +(H - pad - v * (H - 2 * pad)).toFixed(2);
  let line = `M${x(0)} ${y(data[0])}`;
  for (let i = 1; i < n; i++) line += ` L${x(i)} ${y(data[i])}`;
  const area = `${line} L${x(n - 1)} ${H} L${x(0)} ${H} Z`;
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="0.22"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${area}" fill="url(#${id})"/><path d="${line}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}
const trend = {
  up: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/></svg>`,
  down: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 17h6v-6"/><path d="m22 17-8.5-8.5-5 5L2 7"/></svg>`,
};
const EM = "#10B981", AM = "#F59E0B";
const cards = [
  { label: "Win rate", value: "67%", cls: "pos", icon: "up", text: "+5 pts", color: EM, data: [0.30,0.38,0.33,0.47,0.50,0.55,0.60,0.72], id: "s1" },
  { label: "Contracted one-time", value: "$18,700", cls: "pos", icon: "up", text: "+23%", color: EM, data: [0.22,0.30,0.42,0.38,0.52,0.58,0.66,0.82], id: "s2" },
  { label: "MRR", value: "$6,600", cls: "pos", icon: "up", text: "+16%", color: EM, data: [0.38,0.43,0.48,0.52,0.58,0.63,0.70,0.78], id: "s3" },
  { label: "Signed this month", value: "4", cls: "pos", icon: "up", text: "+2", color: EM, data: [0.18,0.28,0.22,0.40,0.48,0.44,0.58,0.70], id: "s4" },
  { label: "Avg time to sign", value: "6m", cls: "pos", icon: "down", text: "−33%", color: EM, data: [0.80,0.72,0.74,0.60,0.56,0.48,0.42,0.32], id: "s5" },
  { label: "Oldest open", value: "18h", cls: "warn", icon: "up", text: "+4h", color: AM, data: [0.40,0.44,0.42,0.50,0.52,0.55,0.60,0.66], id: "s6" },
];
const cardHtml = cards.map((c) => `              <div class="card"><div class="content">
                <div class="kpiTop">
                  <p class="kpiLabel font-tag">${c.label}</p>
                  <span class="badge2 ${c.cls}">${trend[c.icon]}${c.text}</span>
                </div>
                <p class="kpiValue font-heading tnum">${c.value}</p>
                ${spark(c.data, c.color, c.id)}
              </div></div>`).join("\n\n");

const proGrid = `<!-- KPI grid -->
            <div class="kpiGrid">
${cardHtml}
            </div>`;

const proCss = `
  /* ---- Pro KPI: trend-badge pill + sparkline ---- */
  .badge2 { display: inline-flex; align-items: center; gap: 3px; border-radius: 9999px; padding: 2px 8px 2px 6px; font-size: 11px; font-weight: 600; line-height: 16px; white-space: nowrap; }
  .badge2 svg { width: 12px; height: 12px; flex: none; }
  .badge2.pos { background: #ECFDF5; color: #047857; }
  .badge2.warn { background: #FFFBEB; color: #B45309; }
  .spark { display: block; width: 100%; height: 36px; margin-top: 12px; overflow: visible; }
  .kpiTop { align-items: center; }
</style>`;

let html = base.replace(/<\/style>/, proCss);
html = html.replace(/<!-- KPI grid -->[\s\S]*?<!-- Count -->/, `${proGrid}\n\n            <!-- Count -->`);
const outHtml = path.join(dir, "dashboardMockupPro.html");
fs.writeFileSync(outHtml, html);

// ---- render: transparent deliverable + gray preview ----
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
async function shoot(out, gray) {
  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1480, height: 1300 } });
  await page.goto("file://" + outHtml, { waitUntil: "networkidle" });
  await page.evaluate((g) => { document.body.setAttribute("data-bg", "transparent"); if (g) document.documentElement.style.background = "#e9eaee"; }, gray);
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(400);
  const el = await page.$(".stage");
  await el.screenshot({ path: out, omitBackground: !gray });
  await page.close();
}
await shoot(path.join(dir, "dashboardMockupPro.png"), false);
await shoot(path.join(dir, "_proPreview.png"), true);
await browser.close();
console.log("built + rendered dashboardMockupPro");
