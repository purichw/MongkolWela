import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "@playwright/test";
import { getTemplePlannerData } from "../../src/data/temple-planner.js";

const base = process.env.HUB_QA_URL || "http://127.0.0.1:4349";
const output = "artifacts/temples-hub/headings";
await fs.mkdir(output, { recursive: true });
const content = JSON.parse(await fs.readFile("public/admin/content/live.json", "utf8"));
const routes = [
  ["calendar", "/calendar/?year=2569&month=1"],
  ["day", "/calendar/day/?date=2026-09-20"],
  ["planner", "/temples/planner/"],
  ["popular", "/temples/popular/"],
  ["sacred", "/temples/sacred/"],
  ["mu", "/temples/mu/"],
  ["directory", "/temples/thailand/"],
  ["tarot", "/tarot/daily/"],
  ["palm", "/horoscope/palmistry/"],
  ["seamsi", "/horoscope/seamsi/"],
  ["life-graph", "/horoscope/life-graph/"],
  ["astrology", "/horoscope/thai-astrology/"],
  ["shop", "/shop/"],
  ["merit", "/merit/"],
];
const browser = await chromium.launch({ channel: "chrome" });
const report = { base, runAt: new Date().toISOString(), scope: "Shared H1 token geometry, not complete route/flow regression", views: [] };
try {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await context.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
  await context.route("**/api/admin/content?**", route => route.fulfill({ json: { ok: true, revision: "heading-qa", content } }));
  await context.route("**/api/temple-planner/data*", route => route.fulfill({ json: { ...getTemplePlannerData(content), revision: "heading-qa" } }));
  await context.route("**/api/commerce?**", route => route.fulfill({ status: 404, json: { ok: false, code: "COMMERCE_DISABLED" } }));
  const page = await context.newPage();
  for (const [name, route] of routes) {
    await page.goto(base + route, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.cmsReady === "true");
    await page.evaluate(() => document.fonts.ready);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const metrics = await page.evaluate(() => {
        const title = document.querySelector("main h1");
        const box = title.getBoundingClientRect();
        const banner = title.closest(".page-banner");
        const quote = banner?.querySelector(".page-banner__quote");
        const quoteBox = quote?.getBoundingClientRect();
        const overlaps = quoteBox && quoteBox.width > 0 && quoteBox.height > 0 && box.left < quoteBox.right && box.right > quoteBox.left && box.top < quoteBox.bottom && box.bottom > quoteBox.top;
        return { title: title.textContent.trim(), fontSize: getComputedStyle(title).fontSize, x: box.x, right: box.right, height: box.height, clipped: title.scrollWidth > title.clientWidth + 1, overflow: document.documentElement.scrollWidth - innerWidth, overlapsQuote: Boolean(overlaps), captureHeight: Math.min(650, Math.ceil((banner?.getBoundingClientRect().bottom || box.bottom + 140) + 24)) };
      });
      assert.equal(metrics.clipped, false, `${name}-${width} clipped title`);
      assert.ok(metrics.overflow <= 1, `${name}-${width} horizontal overflow`);
      assert.equal(metrics.overlapsQuote, false, `${name}-${width} quote overlap`);
      assert.ok(metrics.x >= 0 && metrics.right <= width + 1, `${name}-${width} title outside page`);
      report.views.push({ name, route, width, ...metrics });
      if (width !== 320 && ["calendar", "day", "planner", "popular", "directory", "astrology", "tarot"].includes(name)) {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await page.screenshot({ path: `${output}/${name}-${width}.png`, clip: { x: 0, y: 0, width, height: metrics.captureHeight }, animations: "disabled" });
      }
    }
    console.log(`${name}: headings fit 1440/390/320`);
  }
  report.status = "PASS";
  await fs.writeFile(`${output}/results.json`, JSON.stringify(report, null, 2));
} finally { await browser.close(); }
