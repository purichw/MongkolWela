import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { createTempleRoutingServer } from "../tests/helpers/temple-routing-server.mjs";
import { templeRouteCatalog } from "../src/lib/temple-routing.js";
import { getTempleDetailUrl } from "../src/data/temple-slugs.js";

// Built output + loopback fixtures only. Never contacts or modifies live CMS data.
const output = path.resolve(process.env.READINESS_AUDIT_OUTPUT || "artifacts/loading-performance/route-audit");
const staticRoot = path.resolve(".vercel/output/static");
async function htmlFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(file));
    else if (entry.name.endsWith(".html")) files.push(file);
  }
  return files;
}

await fs.mkdir(output, { recursive: true });
const server = await createTempleRoutingServer();
const browser = await chromium.launch();
const results = [];
try {
  const staticRoutes = (await htmlFiles(staticRoot)).map(file => "/" + path.relative(staticRoot, file).replace(/index\.html$/, ""));
  const catalog = templeRouteCatalog(server.state.content);
  const details = ["popular", "sacred", "mu"].map(collection => getTempleDetailUrl(collection, catalog.find(item => item.collection === collection)));
  const routes = [...new Set([...staticRoutes, ...details, "/search/?q=วัด", "/temples/thailand/?province=กรุงเทพมหานคร", "/shop/?view=cart", "/tarot/daily/result/?card=the-sun"])].sort();
  for (const route of routes) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
    // External font latency is covered separately with real-font captures and held-font E2E.
    await context.route("https://fonts.googleapis.com/**", request => request.fulfill({ contentType: "text/css", body: "" }));
    await context.route("**/api/commerce*", request => request.fulfill({ status: 503, json: { ok: false, code: "COMMERCE_DISABLED", error: "ยังไม่เปิดบริการ" } }));
    await context.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const started = Date.now();
    let result;
    try {
      const response = await page.goto(server.url + route, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.MongkolWelaPageReady?.ready, null, { timeout: 12000 });
      result = await page.evaluate(() => {
        const visible = element => element.getClientRects().length && getComputedStyle(element).visibility !== "hidden";
        const content = document.querySelector("main") || document.body;
        const pendingText = [];
        const deferredMapText = [];
        const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const parent = walker.currentNode.parentElement;
          if (parent && !parent.closest("script, style, noscript") && visible(parent) && /กำลังโหลด|กำลังเปิดคำทำนาย|กำลังเตรียมกราฟชีวิต|กำลังตรวจสอบสถานะร้านค้า/.test(walker.currentNode.textContent)) {
            // Embedded map progress is intentionally local, not page readiness.
            const target = parent.closest("[data-map-status]") ? deferredMapText : pendingText;
            target.push(walker.currentNode.textContent.trim());
          }
        }
        return {
          ready: window.MongkolWelaPageReady.ready,
          title: document.querySelector("h1")?.textContent.trim(),
          pending: document.querySelectorAll("[data-page-pending]").length,
          busy: [...content.querySelectorAll('[aria-busy="true"]')].filter(visible).length,
          visibility: getComputedStyle(content).visibility,
          pendingText,
          deferredMapText,
        };
      });
      result.status = response.status();
    } catch (error) {
      result = { failure: error.message, pending: await page.locator("[data-page-pending]").evaluateAll(elements => elements.map(element => element.getAttribute("data-page-pending"))) };
    }
    const pass = !result.failure && result.ready && result.pending === 0 && result.busy === 0 && result.pendingText.length === 0 && result.visibility === "visible" && errors.length === 0;
    const entry = { route, pass, elapsedMs: Date.now() - started, ...result, errors };
    results.push(entry);
    console.log(`${pass ? "PASS" : "FAIL"} ${route}${pass ? "" : " " + JSON.stringify(entry)}`);
    await context.close();
  }
  await fs.writeFile(path.join(output, "results.json"), JSON.stringify({ capturedAt: new Date().toISOString(), scope: "All built HTML routes and three SSR collection templates; local live-content fixture, desktop Chromium; fonts mocked only for inventory", total: results.length, passed: results.filter(result => result.pass).length, results }, null, 2));
  console.log(`${results.filter(result => result.pass).length}/${results.length} routes passed`);
  if (results.some(result => !result.pass)) process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
