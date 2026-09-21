import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve("artifacts/planner-responsive");
const out = path.resolve(process.env.PLANNER_CAPTURE_OUT || path.join(root, "snapshot-ref-actual"));
const url = "http://127.0.0.1:4330/temples/planner/";
await fs.mkdir(out, { recursive: true });
const report = {
  capturedAt: new Date().toISOString(), requestedUrl: url,
  source: "Current dirty local worktree, read-only local CMS preview and real planning engine; no production service",
  commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  state: "Fresh unauthenticated context; analytics declined; automatic three-stop plan; both panes; no modal; scroll top",
  reference: {
    file: "ChatGPT Image Sep 21, 2026, 12_24_40 PM.png",
    sha256: createHash("sha256").update(await fs.readFile("/Users/point/Downloads/ChatGPT Image Sep 21, 2026, 12_24_40 PM.png")).digest("hex"),
    desktopCrop: [55, 32, 910, 1167], mobileCrop: [1005, 60, 249, 1135],
    scale: "Uniform inferred 1440/390 CSS widths from source labels, not measured CSS; framing removed only",
  }, views: [],
};
const browser = await chromium.launch({ channel: "chrome" });
try {
  report.browser = browser.version();
  for (const width of [1440, 390]) {
    const height = width === 390 ? 844 : 900;
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
    await page.goto(url);
    await page.locator("[data-planner-auto]:not(:disabled)").waitFor();
    await page.locator('[name="planner-count"][value="3"]').check();
    await page.locator("[data-planner-auto]").click();
    await page.locator('[data-temple-planner][data-planner-freshness="synced"]').waitFor();
    await page.locator('[data-planner-view="both"]').click();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].filter(image => image.getBoundingClientRect().top < innerHeight).every(image => image.complete));
    if (width === 1440) await page.locator("[data-planner-route-map] .leaflet-tile-loaded").first().waitFor();
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < pageHeight; y += Math.floor(height * 0.75)) {
      await page.evaluate(top => window.scrollTo(0, top), y);
      await page.waitForTimeout(100);
    }
    await page.evaluate(() => Promise.all([...document.images].map(image => image.decode().catch(() => {}))));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(out, `actual-${width}-full.png`), fullPage: true, animations: "disabled" });
    await page.screenshot({ path: path.join(out, `actual-${width}-viewport.png`), animations: "disabled" });
    report.views.push({ width, height, deviceScaleFactor: 1, zoom: 1, finalUrl: page.url(), errors,
      ...await page.evaluate(() => ({ scrollY, pageHeight: document.documentElement.scrollHeight,
        overflow: document.documentElement.scrollWidth - innerWidth,
        stops: document.querySelectorAll("[data-planner-stop]").length,
        cards: document.querySelectorAll("[data-planner-place-card]").length,
        picker: { top: document.querySelector("#planner-pick").getBoundingClientRect().top + scrollY,
          height: document.querySelector("#planner-pick").getBoundingClientRect().height } })) });
    await page.close();
  }
  const html = `<!doctype html><meta charset="utf-8"><title>Planner Ref / Actual</title>
<style>
*{box-sizing:border-box}body{margin:0;padding:24px;background:#e9ece9;color:#172d26;font:15px/1.5 system-ui,sans-serif}
h1{font-size:24px;margin:0 0 8px}h2{font-size:21px;margin:0 0 12px}p{max-width:1100px}section{margin:32px 0}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}figure{margin:0}figcaption{font-weight:600;padding:10px 0}img{display:block;width:100%;height:auto}
.mobile{width:804px;margin:32px auto}.mobile .pair{gap:24px}.viewport{height:844px;overflow:hidden}.desktop-viewport{aspect-ratio:1440/900;overflow:hidden}
</style>
<h1>Planner: Ref / Actual</h1>
<p>Local preview: ${url}. Fresh capture ${report.capturedAt}. Equal-width pairs; reference CSS scale inferred. Actual: three-stop plan, both panes. Reference data is illustrative; actual preserves 12/6 catalog cards and the complete mobile timeline. Missing photographs stay labelled. The fixed mobile action bar appears at the original viewport bottom in full-page captures.</p>
<section id="desktop"><h2>Desktop / Full Page / 1440px</h2><div class="pair">
<figure><figcaption>REF / approved mockup</figcaption><img src="../reference-desktop.png"></figure>
<figure><figcaption>ACTUAL / local preview / three stops</figcaption><img src="actual-1440-full.png"></figure></div></section>
<section id="desktop-top"><h2>Desktop / First Viewport / 1440 x 900</h2><div class="pair">
<figure><figcaption>REF</figcaption><div class="desktop-viewport"><img src="../reference-desktop.png"></div></figure>
<figure><figcaption>ACTUAL</figcaption><img src="actual-1440-viewport.png"></figure></div></section>
<section id="mobile" class="mobile"><h2>Mobile / Full Page / 390px</h2><div class="pair">
<figure><figcaption>REF / approved mockup</figcaption><img src="../reference-mobile.png"></figure>
<figure><figcaption>ACTUAL / complete timeline</figcaption><img src="actual-390-full.png"></figure></div></section>
<section id="mobile-top" class="mobile"><h2>Mobile / First Viewport / 390 x 844</h2><div class="pair">
<figure><figcaption>REF</figcaption><div class="viewport"><img src="../reference-mobile.png"></div></figure>
<figure><figcaption>ACTUAL</figcaption><img src="actual-390-viewport.png"></figure></div></section>`;
  await fs.writeFile(path.join(out, "comparison.html"), html);
  const comparison = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  await comparison.goto(pathToFileURL(path.join(out, "comparison.html")).href);
  await comparison.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode())); });
  for (const id of ["desktop", "desktop-top", "mobile", "mobile-top"]) {
    await comparison.locator(`#${id}`).screenshot({ path: path.join(out, `ref-actual-${id}.png`) });
  }
  await fs.writeFile(path.join(out, "capture-report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
