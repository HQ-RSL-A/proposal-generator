import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(dir, "dashboardMockup.html");
const outPath = path.join(dir, "dashboardMockup.png");

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1480, height: 1200 } });
await page.goto("file://" + htmlPath, { waitUntil: "networkidle" });
await page.evaluate(() => document.body.setAttribute("data-bg", "transparent"));
await page.evaluate(async () => { await document.fonts.ready; });
await page.waitForTimeout(400);

const el = await page.$(".stage");
await el.screenshot({ path: outPath, omitBackground: true });
const box = await el.boundingBox();
console.log("Saved", outPath, "css box", box.width + "x" + box.height, "-> png", box.width * 2 + "x" + box.height * 2);
await browser.close();
