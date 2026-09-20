import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";

// Run before/after against the same local preview and CMS fixture.
const phase = process.argv[2];
assert.ok(["before", "after"].includes(phase), "Use: node scripts/qa/shared-ui.mjs before|after");
const base = process.env.UI_QA_URL || "http://127.0.0.1:4326";
const output = "artifacts/shared-ui";
const content = JSON.parse(await fs.readFile("public/admin/content/live.json", "utf8"));
const routes = [
  ["home", "/", ".home-intent-card", ".hero, .hero-links, .home-today-card, .home-intent-card, .home-intent-icon, .home-collection-card"],
  ["calendar", "/calendar/?year=2569&month=1", ".cal-day", ".cal-hero, .cal-toolbar, .cal-summary-card, .cal-summary-symbol, .cal-month-panel, .cal-day"],
  ["day", "/calendar/day/?date=2026-09-20", ".day-reading-panel", ".day-hero, .day-nav, .day-panel, .day-medallion, .day-omen"],
  ["place", "/temples/popular/001-ว-ดระฆ-งโฆส-ตาราม-กร-งเทพมหานคร/", "[data-pd-mode=all]", ".pd-hero, .pd-surface, .pd-medallion, .pd-button, .pd-icon, .pd-quick, .pd-stop"],
  ["directory", "/temples/thailand/", "[data-temple-province] option", ".temple-directory-filters, .temple-field"],
  ["life-graph", "/horoscope/life-graph/", "[data-hour-options] option", ".life-graph-form, .form-row"],
];
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = {};
try {
  for (const [name, path, ready, selectors] of routes) {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      await page.clock.setFixedTime(new Date("2026-09-20T05:00:00Z"));
      await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
      await page.route("**/api/admin/content?**", r => r.fulfill({ json: { ok: true, revision: "shared-ui-qa", content } }));
      await page.route("**/api/temple-activities?**", r => r.fulfill({ json: { ok: true, revision: "empty", events: [] } }));
      await page.route("**/api/commerce?**", r => r.fulfill({ status: 404, json: { ok: false, code: "COMMERCE_DISABLED" } }));
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
      await page.locator(ready).first().waitFor({ state: "attached" });
      await page.waitForFunction(() => document.documentElement.dataset.cmsReady === "true");
      await page.evaluate(async () => {
        await document.fonts.ready;
        for (const image of document.images) image.loading = "eager";
        await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
      });
      const key = `${name}-${width}`;
      results[key] = await page.evaluate(selector => {
        const round = value => Math.round(value * 100) / 100;
        const nodes = [...document.querySelectorAll(`header.site-header, footer, select, .site-icon, ${selector}`)];
        return {
          overflow: document.documentElement.scrollWidth - innerWidth,
          height: document.documentElement.scrollHeight,
          nodes: nodes.map(node => {
            const r = node.getBoundingClientRect();
            const s = getComputedStyle(node);
            return {
              tag: node.tagName,
              box: [r.x, r.y, r.width, r.height].map(round),
              style: [s.fontSize, s.lineHeight, s.padding, s.borderRadius, s.color, s.backgroundColor, s.display, s.flexShrink],
            };
          }),
        };
      }, selectors);
      assert.ok(results[key].overflow <= 1, `${key}: horizontal overflow`);
      assert.deepEqual(errors, [], `${key}: runtime errors`);
      await page.screenshot({ path: `${output}/${phase}-${key}.png`, fullPage: true, animations: "disabled" });
      if (phase === "after") {
        const brokenGlyphs = await page.locator(".ui-icon-mask").evaluateAll(nodes => nodes.filter(node => {
          const style = getComputedStyle(node);
          return style.maskImage === "none" || style.maskSize !== "contain" || style.maskRepeat !== "no-repeat";
        }).length);
        assert.equal(brokenGlyphs, 0, `${key}: shared icon mask styles missing`);
      }
      if (phase === "after" && name === "calendar") {
        await page.locator("#calendar-year").selectOption("2570");
        await page.waitForFunction(() => document.querySelector("[data-calendar-title]").textContent.includes("2570"));
        await page.locator("#calendar-year").focus();
        assert.notEqual(await page.locator("#calendar-year").evaluate(node => getComputedStyle(node).outlineStyle), "none");
      }
      if (phase === "after" && name === "place") {
        await page.locator('[data-pd-mode="rail"]').click();
        assert.equal(await page.locator("[data-pd-stop]:visible").count(), 2);
        await page.locator('[data-pd-disclosure="visit-sources"] summary').click();
        assert.equal(await page.locator('[data-pd-disclosure="visit-sources"]').evaluate(node => node.open), true);
      }
      if (phase === "after" && ["directory", "life-graph"].includes(name)) {
        if (name === "directory") {
          assert.equal(await page.locator("[data-temple-province]").isDisabled(), true);
          const region = page.locator("[data-temple-region]");
          await region.selectOption(await region.locator("option").nth(1).getAttribute("value"));
          assert.equal(await page.locator("[data-temple-province]").isEnabled(), true);
        }
        const select = page.locator(name === "directory" ? "[data-temple-province]" : "[data-hour-options]");
        const value = await select.locator("option").nth(1).getAttribute("value");
        await select.selectOption(value);
        assert.equal(await select.inputValue(), value, `${key}: native select change`);
      }
      console.log(`${phase}: ${key}`);
      await page.close();
    }
  }
  await fs.writeFile(`${output}/${phase}-metrics.json`, JSON.stringify(results, null, 2));
  if (phase === "after") {
    const before = JSON.parse(await fs.readFile(`${output}/before-metrics.json`, "utf8"));
    assert.deepEqual(results, before, "Shared extraction must preserve measured layout and styles");
    console.log("PASS: all measured geometry and styles are unchanged across 12 route/viewport states.");
  }
} finally {
  await browser.close();
}
