import fs from "node:fs/promises";
import { chromium } from "@playwright/test";
import { getTemplePlannerData } from "../src/data/temple-planner.js";
import { createTemplePlannerPlan } from "../src/lib/temple-planner-engine.js";

const argument = (name, fallback) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) || fallback;
const baseURL = argument("base-url", "http://127.0.0.1:4324");
const label = argument("label", "current");
const mock = process.argv.includes("--fixtures");
const output = `test-results/nfr-${label}`;
await fs.mkdir(output, { recursive: true });
const content = JSON.parse(await fs.readFile("public/admin/content/live.json", "utf8"));
const catalog = { ...getTemplePlannerData(content), revision: "browser-fixture" };
const routes = ["/", "/temples/planner/", "/temples/popular/", "/calendar/", "/tarot/daily/", "/admin/", ...catalog.items.filter((item) => item.detailUrl).slice(0, 3).map((item) => item.detailUrl)];
const browser = await chromium.launch();
const results = [];
try {
  for (const [device, viewport] of Object.entries({ mobile: { width: 390, height: 844 }, tablet: { width: 820, height: 1180 }, desktop: { width: 1440, height: 1000 } })) {
    for (const [index, route] of routes.entries()) {
      const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
      const errors = [];
      const css = new Map();
      const pending = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("response", (response) => {
        if (response.request().resourceType() !== "stylesheet" || !response.url().startsWith(baseURL)) return;
        pending.push(response.body().then((body) => css.set(new URL(response.url()).pathname, body.length)).catch(() => {}));
      });
      if (mock) {
        await page.route("**/api/admin/**", (request) => {
          const pathname = new URL(request.request().url()).pathname;
          const payload = pathname.endsWith("/content") ? { ok: true, content }
            : pathname.endsWith("/session") ? { ok: false }
            : { ok: true, analytics: { totals: {}, paths: {}, events: {} }, temples: [] };
          return request.fulfill({ status: pathname.endsWith("/session") ? 401 : 200, json: payload });
        });
        await page.route("**/api/temple-planner/**", (request) => {
          const data = request.request().method() === "POST" ? createTemplePlannerPlan(catalog, request.request().postDataJSON()) : catalog;
          return request.fulfill({ json: data });
        });
      }
      await page.addInitScript(() => {
        window.__nfr = { lcp: null, cls: 0 };
        new PerformanceObserver((list) => { window.__nfr.lcp = list.getEntries().at(-1)?.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__nfr.cls += entry.value; }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto(`${baseURL}${route}`, { waitUntil: "load" });
      await page.waitForFunction(() => !document.documentElement.classList.contains("is-loading"));
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${output}/${device}-${index}.png` });
      const metrics = await page.evaluate(() => ({ ...window.__nfr, overflow: document.documentElement.scrollWidth - innerWidth, h1: (() => { const node = document.querySelector("h1"); if (!node) return null; const style = getComputedStyle(node); return { font: style.fontFamily, size: style.fontSize, lineHeight: style.lineHeight, width: Math.round(node.getBoundingClientRect().width) }; })() }));
      await Promise.all(pending);
      results.push({ device, route, ...metrics, cssBytes: [...css.values()].reduce((sum, size) => sum + size, 0), css: Object.fromEntries(css), errors });
      await page.close();
    }
  }
} finally { await browser.close(); }
await fs.writeFile(`${output}/metrics.json`, JSON.stringify({ baseURL, fixtures: mock, label, measuredAt: new Date().toISOString(), note: "Lab samples, not field p75 or measured INP; CLS here is only the initial-load sample.", results }, null, 2));
console.log(JSON.stringify(results.map(({ device, route, cssBytes, overflow, errors, lcp }) => ({ device, route, cssBytes, overflow, errors, lcp })), null, 2));
if (results.some((result) => result.overflow > 2 || result.errors.length)) process.exitCode = 1;
