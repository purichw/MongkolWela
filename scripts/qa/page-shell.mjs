import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "@playwright/test";
import { getTemplePlannerData } from "../../src/data/temple-planner.js";

const phase = process.argv[2];
assert.ok(["before", "after"].includes(phase));
const output = "artifacts/shared-page-shell";
const widths = (process.env.SHELL_WIDTHS || "1440,390").split(",").map(Number);
const capture = process.env.SHELL_CAPTURE !== "0";
const content = JSON.parse(await fs.readFile("public/admin/content/live.json", "utf8"));
const routes = [
  ["home", "/", ".home-intent-card", ".home-section"],
  ["calendar", "/calendar/?year=2569&month=1", ".cal-day", ".cal-content"],
  ["day", "/calendar/day/?date=2026-09-20", ".day-reading-panel", ".day-content"],
  ["planner", "/temples/planner/", "[data-planner-auto]:not(:disabled)", ".planner-workspace"],
  ["temples", "/temples/", "#collections", ".temple-hub-v2-section"],
  ["directory", "/temples/thailand/", "[data-temple-name]", ".temple-results"],
  ["place", "/temples/popular/001-ว-ดระฆ-งโฆส-ตาราม-กร-งเทพมหานคร/", ".pd-hero", ".place-detail"],
  ["popular", "/temples/popular/", ".temple-collection-v2-filter", ".temple-collection-v2-filter__inner"],
  ["sacred", "/temples/sacred/", ".temple-collection-v2-filter", ".temple-collection-v2-filter__inner"],
  ["mu", "/temples/mu/", ".temple-collection-v2-filter", ".temple-collection-v2-filter__inner"],
  ["tarot", "/tarot/daily/", ".tarot-hero", ".tarot-hero"],
  ["tarot-meanings", "/tarot/meanings/", ".tarot-meanings-index", ".tarot-meanings-index"],
  ["palm", "/horoscope/palmistry/", ".palm-hero", ".palm-hero"],
  ["seamsi", "/horoscope/seamsi/", ".seamsi-hero", ".seamsi-hero"],
  ["life-graph", "/horoscope/life-graph/", ".life-graph-hero", ".life-graph-hero"],
  ["astrology", "/horoscope/thai-astrology/", ".thai-astro-hero", ".thai-astro-hero"],
  ["shop", "/shop/", ".commerce-heading", ".commerce-page"],
  ["merit", "/merit/", ".commerce-heading", ".commerce-page"],
];
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const results = { phase, capturedAt: new Date().toISOString(), source: "Local dev with read-only CMS fixture", views: [] };
try {
  for (const [name, route, ready, container] of routes.filter(([name]) => !process.env.SHELL_ROUTES || process.env.SHELL_ROUTES.split(",").includes(name))) for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.clock.setFixedTime(new Date("2026-09-20T05:00:00Z"));
    await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
    await page.route("**/api/admin/content?**", r => r.fulfill({ json: { ok: true, revision: "shell-qa", content } }));
    await page.route("**/api/temple-planner/data*", r => r.fulfill({ json: { ...getTemplePlannerData(content), revision: "shell-qa" } }));
    await page.route("**/api/temple-activities?**", r => r.fulfill({ json: { ok: true, revision: "empty", events: [] } }));
    await page.route("**/api/commerce?**", r => r.fulfill({ status: 404, json: { ok: false, code: "COMMERCE_DISABLED" } }));
    await page.goto("http://127.0.0.1:4326" + route, { waitUntil: "domcontentloaded" });
    await page.locator(ready).first().waitFor({ state: "attached" });
    await page.waitForFunction(() => document.documentElement.dataset.cmsReady === "true");
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.race([Promise.all([...document.images].filter(image => image.getBoundingClientRect().top < innerHeight).map(image => image.decode().catch(() => {}))), new Promise(resolve => setTimeout(resolve, 6000))]);
    });
    const metrics = await page.evaluate(selector => {
      const box = node => { if (!node) return null; const r = node.getBoundingClientRect(); return { x: r.x, width: r.width, height: r.height }; };
      const banner = document.querySelector(".page-banner");
      const title = document.querySelector("main h1");
      const quote = banner?.querySelector(".page-banner__quote");
      const copy = banner?.querySelector(".page-banner__copy");
      const overlaps = (a, b) => {
        if (!a || !b || !a.getClientRects().length || !b.getClientRects().length) return false;
        const x = a.getBoundingClientRect(), y = b.getBoundingClientRect();
        return x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top;
      };
      return { overflow: document.documentElement.scrollWidth - innerWidth,
        header: box(document.querySelector(".navbar--shared-site")), container: box(document.querySelector(selector)),
        banner: box(banner), bannerContent: box(document.querySelector(".page-banner__inner")),
        bannerImage: banner ? [...banner.querySelectorAll("img")].filter(image => !image.closest(".brand-ornament")).map(image => ({ src: image.currentSrc, loaded: image.complete && image.naturalWidth > 0 })) : [],
        footer: box(document.querySelector(".site-footer-home-grid")),
        h1Count: document.querySelectorAll("main h1").length,
        titleFont: title ? getComputedStyle(title).fontSize : null,
        quoteOverlapsCopy: overlaps(quote, copy),
        titleClipped: title ? title.scrollWidth > title.clientWidth + 1 : false };
    }, container);
    results.views.push({ name, route, width, ...metrics, errors });
    assert.ok(metrics.overflow <= 1, `${name}-${width}: overflow`);
    assert.deepEqual(errors, [], `${name}-${width}: JS error`);
    if (phase === "after") {
      assert.equal(metrics.h1Count, 1, `${name}: heading ownership`);
      assert.equal(metrics.quoteOverlapsCopy, false, `${name}-${width}: quote overlaps banner copy`);
      assert.equal(metrics.titleClipped, false, `${name}-${width}: heading clipped`);
      if (metrics.bannerContent) assert.ok(Math.abs(metrics.bannerContent.x - metrics.header.x) < 1, `${name}-${width}: banner alignment`);
      if (metrics.banner) {
        assert.equal(metrics.bannerImage.length, 1, `${name}: banner media missing`);
        assert.ok(metrics.bannerImage.every(image => image.loaded), `${name}: banner media not loaded`);
      }
      if (metrics.container) assert.ok(Math.abs(metrics.container.x - metrics.header.x) < 1, `${name}-${width}: content alignment`);
      assert.ok(metrics.footer, `${name}: shared footer missing`);
      assert.ok(Math.abs(metrics.footer.x - metrics.header.x) < 1, `${name}-${width}: footer alignment`);
    }
    if (capture) await page.screenshot({ path: `${output}/${phase}-${name}-${width}.png`, animations: "disabled" });
    if (phase === "after") {
      await page.locator(".site-footer").scrollIntoViewIfNeeded();
      if (capture) await page.locator(".site-footer").screenshot({ path: `${output}/${phase}-${name}-${width}-footer.png`, animations: "disabled" });
      if (width < 721) {
        await page.locator("[data-home-footer-links] > summary").click();
        assert.equal(await page.locator("[data-home-footer-links]").getAttribute("open"), "");
        assert.ok(await page.locator("[data-home-footer-links] nav a").first().isVisible());
      }
    }
    await page.close();
    console.log(`${phase}: ${name}-${width}`);
  }
  const reportName = process.env.SHELL_WIDTHS ? `${phase}-${widths.join("-")}` : phase;
  await fs.writeFile(`${output}/${reportName}.json`, JSON.stringify(results, null, 2) + "\n");
} finally { await browser.close(); }
