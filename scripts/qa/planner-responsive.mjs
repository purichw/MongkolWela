import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { getTemplePlannerData } from "../../src/data/temple-planner.js";
import { createTemplePlannerPlan } from "../../src/lib/temple-planner-engine.js";

// Isolated browser fixtures: never writes CMS or replaces the application's API.
const content = JSON.parse(await fs.readFile("public/admin/content/live.json", "utf8"));
const catalog = { ...getTemplePlannerData(content), revision: "local-cms-visual-fixture" };
const out = path.resolve(process.env.PLANNER_CAPTURE_OUT || "artifacts/planner-responsive");
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const report = { fixture: "Local CMS + production catalog adapter and planner engine; intercepted APIs, not live service", capturedAt: new Date().toISOString(), views: [], sharedSmoke: [] };
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 }, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
    await page.route("**/api/admin/content?**", route => route.fulfill({ json: { ok: true, revision: "local-fixture", content } }));
    await page.route("**/api/temple-planner/data*", route => route.fulfill({ json: catalog }));
    await page.route("**/api/temple-planner/plan", route => {
      const result = createTemplePlannerPlan(catalog, route.request().postDataJSON());
      return route.fulfill({ json: { ...result, revision: catalog.revision, items: result.planIds.map(id => catalog.items.find(item => item.id === id)) } });
    });
    await page.goto((process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4326") + "/temples/planner/");
    await page.locator("[data-planner-auto]:not(:disabled)").waitFor();
    await page.evaluate(() => document.fonts.ready);
    const capture = async state => {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(out, state + "-" + width + ".png"), fullPage: true });
      const metrics = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, height: document.documentElement.scrollHeight, stopCount: document.querySelectorAll("[data-planner-stop]").length, cardCount: document.querySelectorAll("[data-planner-place-card]").length }));
      report.views.push({ state, viewport: { width, height: width === 390 ? 844 : 900 }, ...metrics, errors: [...errors] });
    };
    await capture("initial");
    await page.locator('[name="planner-count"][value="9"]').check();
    await page.locator("[data-planner-auto]").click();
    await page.locator('[data-temple-planner][data-planner-freshness="synced"]').waitFor();
    if (width > 900) await page.locator("[data-planner-route-map] .leaflet-tile-loaded").first().waitFor({ timeout: 15000 }).catch(() => {});
    await capture("plan");
    for (const view of ["picker", "both"]) {
      await page.locator('[data-planner-view="' + view + '"]').click();
      await page.waitForTimeout(200);
      await capture(view);
    }
    await page.locator('[name="planner-count"][value="3"]').click();
    const choices = page.locator("[data-planner-dialog-options] input");
    for (let index = 0; index < 3; index++) await choices.nth(index).check();
    await page.locator("[data-planner-dialog-confirm]").click();
    await page.locator("[data-planner-build]").click();
    await page.locator('[data-temple-planner][data-planner-freshness="synced"]').waitFor();
    await capture("both-three-stops");
    await page.close();
  }
  for (const route of process.env.PLANNER_SKIP_SHARED ? [] : ["/", "/calendar/?year=2569&month=1", "/temples/popular/001-ว-ดระฆ-งโฆส-ตาราม-กร-งเทพมหานคร/"]) {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
      await page.route("**/api/admin/content?**", route => route.fulfill({ json: { ok: true, revision: "local-fixture", content } }));
      await page.route("**/api/temple-activities?**", route => route.fulfill({ json: { ok: true, revision: "empty", events: [] } }));
      await page.route("**/api/commerce?**", route => route.fulfill({ status: 404, json: { ok: false, code: "COMMERCE_DISABLED" } }));
      await page.goto((process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4326") + route);
      await page.waitForFunction(() => document.documentElement.dataset.cmsReady === "true");
      await page.evaluate(() => document.fonts.ready);
      if (width === 390) {
        await page.locator(".nav-toggle").click();
        await page.keyboard.press("Escape");
      }
      const metrics = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - innerWidth,
        plannerStylesLeaked: [...document.querySelectorAll("link[rel=stylesheet]")].some(node => node.href.includes("temple-planner.css")),
        headerVisible: document.querySelector("header.site-header").getBoundingClientRect().height > 0,
        footerVisible: document.querySelector("footer").getBoundingClientRect().height > 0,
        menuClosed: document.querySelector(".nav-toggle").getAttribute("aria-expanded") !== "true",
      }));
      report.sharedSmoke.push({ route, width, ...metrics, errors });
      if (metrics.overflow > 1 || metrics.plannerStylesLeaked || !metrics.headerVisible || !metrics.footerVisible || !metrics.menuClosed || errors.length) throw new Error("Shared smoke failed: " + route);
      await page.close();
    }
  }
  await fs.writeFile(path.join(out, "visual-report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
