import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { commerceFixture } from "../helpers/commerce-fixtures.mjs";
import { publicCommerce } from "../../api/commerce/_domain.js";

test.beforeEach(async ({ page }) => {
  const content = JSON.parse(fs.readFileSync("public/admin/content/live.json", "utf8"));
  await page.route("**/api/admin/content*", route => route.fulfill({ json: { ok: true, content } }));
  await page.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
  await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
});

for (const path of ["/shop/", "/merit/"]) {
  test(`${path} keeps the entrance closed until the service state is rendered`, async ({ page }) => {
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/commerce", async route => {
      await pending;
      await route.fulfill({ status: 503, json: { ok: false, code: "COMMERCE_DISABLED", error: "ยังไม่เปิดบริการ" } });
    });
    try {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2800);
      await expect(page.locator("main")).toHaveCSS("visibility", "hidden");
      await expect(page.locator("[data-page-loader]")).toHaveAttribute("aria-hidden", "false");
      release();
      await expect(page.locator("main")).toHaveAttribute("data-commerce-state", "disabled");
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("[data-commerce-content]")).toBeHidden();
      await expect(page.locator("html")).toHaveClass(/page-fonts-ready/);
    } finally { release(); }
  });
}

test("CMS is part of first paint, but later refreshes do not close the page", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const content = JSON.parse(fs.readFileSync("public/admin/content/live.json", "utf8"));
  await page.route("**/api/admin/content*", async route => {
    await pending; await route.fulfill({ json: { ok: true, content } });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2800);
  await expect(page.locator("main")).toHaveCSS("opacity", "0");
  release();
  await expect(page.locator("#hero-title")).toBeVisible();
  await page.locator("#site-search").fill("เชียงใหม่");
  await page.evaluate(() => (window as any).MongkolWelaCMS.reload());
  await expect(page.locator("html")).toHaveClass(/page-fonts-ready/);
  await expect(page.locator("#site-search")).toHaveValue("เชียงใหม่");
  await expect(page.locator("[data-page-loader]")).toHaveAttribute("aria-hidden", "true");
});

test("commerce failure renders retry and recovery does not masquerade as closed service", async ({ page }) => {
  await page.route("**/api/commerce", route => route.fulfill({ status: 503, json: { ok: false, error: "โหลดข้อมูลไม่สำเร็จ" } }));
  await page.goto("/shop/");
  await expect(page.locator("main")).toHaveAttribute("data-commerce-state", "error");
  await expect(page.locator("[data-retry]")).toBeVisible();
  await expect(page.locator("[data-shop-unavailable]")).toBeHidden();
  await page.route("**/api/commerce", route => route.fulfill({ json: { ok: true, ...publicCommerce(commerceFixture().state) } }));
  await page.locator("[data-retry]").click();
  await expect(page.locator(".shop-product").first()).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/page-fonts-pending/);
});

test("a stalled commerce request times out into an actionable error", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.clock.install();
  await page.route("**/api/commerce", async route => { await pending; await route.abort(); });
  try {
    await page.goto("/shop/", { waitUntil: "domcontentloaded" });
    await page.clock.runFor(16000);
    await expect(page.locator("[data-retry]")).toBeVisible();
    await expect(page.locator("main")).toHaveAttribute("data-commerce-state", "error");
    await expect(page.locator("[data-shop-unavailable]")).toBeHidden();
  } finally { release(); }
});

test("slow stylesheet keeps the page hidden beyond the old font deadline", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route(/\/_astro\/base\.[^/]+\.css$/, async route => { await pending; await route.continue(); });
  try {
    const navigation = page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("html.page-fonts-pending", { state: "attached" });
    await page.waitForTimeout(2800);
    expect(await page.evaluate(() => document.querySelector("main") ? getComputedStyle(document.querySelector("main")!).opacity : "0")).toBe("0");
    release(); await navigation;
    await expect(page.locator("#hero-title")).toBeVisible();
  } finally { release(); }
});

for (const asset of ["css", "module"]) {
  test(`failed ${asset} offers styled recovery without revealing incomplete content`, async ({ page }) => {
    await page.route(asset === "css" ? /\/_astro\/base\.[^/]+\.css$/ : /\/_astro\/.*\.js$/, route => route.abort());
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-page-recovery]")).toBeVisible();
    await expect(page.getByRole("button", { name: "ลองโหลดใหม่" })).toBeVisible();
    await expect(page.locator("main")).toHaveCSS("opacity", "0");
    await page.unrouteAll({ behavior: "wait" });
    await page.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
    await page.getByRole("button", { name: "ลองโหลดใหม่" }).click();
    await expect(page.locator("#hero-title")).toBeVisible();
  });
}

for (const [path, url, marker] of [
  ["/search/?q=วัด", "**/api/temple-search?*", "search"],
  ["/temples/planner/", "**/api/temple-planner/data*", "planner"],
  ["/temples/popular/", "**/assets/data/temple-collections/popular.json*", "collection"],
  ["/temples/sacred/", "**/assets/data/temple-collections/sacred.json*", "collection"],
  ["/temples/mu/", "**/assets/data/temple-collections/mu.json*", "collection"],
  ["/temples/thailand/", "**/assets/data/temples-thailand-index.json*", "directory"],
]) {
  test(`${path} waits for its initial ${marker} data`, async ({ page }) => {
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await page.route(url, async route => { await pending; await route.continue(); });
    try {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page.locator(`[data-page-pending="${marker}"]`)).toHaveCount(1);
      await expect(page.locator("main")).toHaveCSS("opacity", "0");
      release();
      await expect(page.locator("html")).toHaveClass(/page-fonts-ready/);
      await expect(page.locator("[data-page-pending]")).toHaveCount(0);
      await expect(page.locator("main")).toBeVisible();
    } finally { release(); }
  });
}

for (const [path, selector] of [
  ["/tarot/daily/result/?card=the-sun", "[data-tarot-result]"],
  ["/tarot/monthly/result/", "[data-tarot-spread-result]"],
  ["/horoscope/life-graph/", "[data-life-graph-output]"],
]) {
  test(`${path} replaces CMS-dependent loading content on failure and recovers`, async ({ page }) => {
    await page.route("**/api/admin/content*", route => route.fulfill({ status: 503, json: { ok: false, error: "CMS unavailable" } }));
    await page.goto(path);
    await expect(page.locator("html")).toHaveClass(/page-fonts-ready/);
    await expect(page.locator("[data-cms-load-error]")).toBeVisible();
    await expect(page.locator(selector)).not.toContainText(/กำลังเปิดคำทำนาย|กำลังเตรียม|กำลังคำนวณ/);
    await expect(page.locator("[data-page-pending]")).toHaveCount(0);
    const content = JSON.parse(fs.readFileSync("public/admin/content/live.json", "utf8"));
    await page.route("**/api/admin/content*", route => route.fulfill({ json: { ok: true, content } }));
    await page.locator("[data-cms-load-error] button").click();
    await expect(page.locator("[data-cms-load-error]")).toHaveCount(0);
    await expect(page.locator(selector)).not.toContainText("ไม่สามารถโหลดคำอ่านล่าสุด");
    if (path.includes("life-graph")) await expect(page.locator(selector)).toHaveAttribute("data-state", "ready");
  });
}

test("life graph waits for its initial asynchronous calculation", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.addInitScript(() => { (window as any).MONKOL_WELA_THAI_CALENDAR_ENDPOINT = location.origin + "/calendar-fixture"; });
  await page.route("**/calendar-fixture/**", async route => {
    await pending;
    await route.fulfill({ status: 503, json: {} });
  });
  try {
    await page.goto("/horoscope/life-graph/", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-page-pending="life-graph"]')).toHaveCount(1);
    await expect(page.locator("main")).toHaveCSS("visibility", "hidden");
    release();
    await expect(page.locator("[data-life-graph-output]")).toHaveAttribute("data-state", "ready");
    await expect(page.locator("main")).toBeVisible();
  } finally { release(); }
});

test("SSR temple details do not treat deferred map CSS as a failed page stylesheet", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("https://unpkg.com/**", async route => { await pending; await route.abort(); });
  await page.route("**/api/commerce*", route => route.fulfill({ status: 503, json: { ok: false, code: "COMMERCE_DISABLED" } }));
  try {
    await page.goto("/temples/popular/wat-rakhang-khositaram/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(/page-fonts-ready/);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("[data-page-recovery]")).toHaveCount(0);
    release();
    await expect(page.locator("html")).not.toHaveClass(/page-load-stalled/);
  } finally { release(); }
});
