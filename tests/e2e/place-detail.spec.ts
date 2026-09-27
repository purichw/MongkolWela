import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";

test.use({ channel: "chrome" });
const route = "/temples/popular/001-ว-ดระฆ-งโฆส-ตาราม-กร-งเทพมหานคร/";
let content;
let revision;
let activityResponse;
let activityStatus;

test.beforeEach(async ({ page }) => {
  await fs.mkdir("artifacts/place-detail", { recursive: true });
  content = JSON.parse(await fs.readFile("public/admin/content/live.json", "utf8"));
  revision = "detail-qa-1";
  activityResponse = { ok: true, revision: "empty", events: [] };
  activityStatus = 200;
  await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
  await page.route("**/api/admin/content?**", r => r.fulfill({ json: { ok: true, revision, content } }));
  await page.route("**/api/temple-activities?**", r => r.fulfill({ status: activityStatus, json: activityResponse }));
  await page.route("**/api/commerce?**", r => r.fulfill({ status: 404, json: { ok: false, code: "COMMERCE_DISABLED" } }));
});

async function settle(page) {
  await page.locator("[data-pd-mode=all]").waitFor({ state: "visible" });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("html")).toHaveClass(/page-fonts-ready/);
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().filter(animation => animation.animationName === "page-content-enter").map(animation => animation.finished.catch(() => {})));
  });
}
async function refresh(page) {
  revision += "x";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
}
async function hydrateImages(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo({ top: y, behavior: "instant" }); await new Promise(r => setTimeout(r, 60)); }
    await Promise.race([
      Promise.all([...document.images].filter(img => img.closest("main, footer") && img.getClientRects().length).map(img => img.decode().catch(() => {}))),
      new Promise(resolve => setTimeout(resolve, 4000)),
    ]);
    scrollTo({ top: 0, behavior: "instant" });
    await new Promise(r => setTimeout(r, 350));
  });
}

test("responsive composition, reserved media, three collection owners and screenshots", async ({ page }) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(route); await settle(page);
  await expect(page.locator("[data-temple-commerce]")).toBeVisible();
  const metrics = [];
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const m = await page.evaluate(() => {
      const box = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
      return { width: innerWidth, overflow: document.documentElement.scrollWidth - innerWidth, hero: box(".pd-hero-media"), identity: box(".pd-hero-copy"), highlights: box(".pd-highlights"), location: box(".pd-location"), visit: box(".pd-visit") };
    });
    expect(m.overflow, `overflow at ${width}`).toBeLessThanOrEqual(1);
    if (width < 360) { expect(m.location.y).toBeGreaterThan(m.highlights.y); expect(m.visit.y).toBeGreaterThan(m.location.y); }
    else if (width < 980) { expect(m.location.y).toBeGreaterThan(m.highlights.y); expect(m.visit.y).toBe(m.location.y); expect(m.visit.x).toBeGreaterThan(m.location.x); }
    else { expect(m.location.x).toBeGreaterThan(m.highlights.x); expect(m.visit.y).toBe(m.highlights.y); }
    if (width < 600) expect(Math.abs(m.hero.w / m.hero.h - 16 / 9)).toBeLessThan(.02);
    metrics.push(m);
    if ([320, 390, 768, 1440].includes(width)) {
      await hydrateImages(page);
      await page.screenshot({ path: `artifacts/place-detail/after-${width}.png`, fullPage: true });
    }
  }
  for (const collection of ["sacred", "mu"]) {
    await page.goto(`/temples/${collection}/`);
    const href = await page.locator(`a[href^="/temples/${collection}/"]`).filter({ hasNotText: /^$/ }).evaluateAll(nodes => nodes.map(n => n.getAttribute("href")).find(href => href.split("/").filter(Boolean).length === 3));
    expect(href).toBeTruthy();
    await page.goto(href); await expect(page.locator("[data-place-detail]")).toBeVisible();
    await expect(page.locator("h1")).not.toBeEmpty();
  }
  await fs.writeFile("artifacts/place-detail/responsive-metrics.json", JSON.stringify(metrics, null, 2));
  expect(errors).toEqual([]);
});

test("photo viewer, compact mobile routes and full route disclosures", async ({ page }) => {
  await page.goto(route); await settle(page);
  await page.locator("[data-photo-open]").click();
  await expect(page.locator(".pd-photo-dialog[open]")).toBeVisible();
  await expect(page.locator(".pd-photo-dialog figure img")).toHaveAttribute("alt", /วัด/);
  await expect(page.locator("[data-dialog-close]")).toBeFocused();
  await refresh(page);
  await expect(page.locator(".pd-photo-dialog[open]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-photo-open]")).toBeFocused();
  await expect(page.locator("[data-pd-stop]:visible")).toHaveCount(4);
  await page.locator(".pd-stop:visible .pd-stop-details summary").first().click();
  await expect(page.locator(".pd-stop-details[open] .pd-route-chips")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("[data-pd-stop]:visible")).toHaveCount(1);
  const nearest = await page.locator("[data-pd-stop]").evaluateAll(nodes => Math.min(...nodes.map(node => Number(node.getAttribute("data-distance")))));
  await expect(page.locator("[data-pd-stop]:visible")).toHaveAttribute("data-distance", String(nearest));
  await page.locator("[data-pd-stops-more]").click();
  expect(await page.locator("[data-pd-stop]:visible").count()).toBeGreaterThan(4);
  await page.locator("[data-pd-stops-more]").click();
  await expect(page.locator("[data-pd-stop]:visible")).toHaveCount(1);
  const confidence = page.locator(".pd-confidence-help");
  await confidence.locator("summary").click();
  await expect(confidence).toHaveAttribute("open", "");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.keyboard.press("Escape");
  await expect(confidence).not.toHaveAttribute("open", "");
});

test("travel filters, disclosure state, live CMS coordinates and map dialog", async ({ page }) => {
  await page.goto(route); await settle(page);
  await page.locator('[data-pd-mode="rail"]').click();
  await expect(page.locator("[data-pd-stop]:visible")).toHaveCount(2);
  await page.locator('[data-pd-disclosure="hours"] summary').click();
  const placeKey = await page.locator("[data-place-detail]").getAttribute("data-place-key");
  await page.locator("[data-map-open]").click();
  await expect(page.locator("dialog[open]")).toBeVisible();
  await expect(page.locator("[data-dialog-close]")).toBeFocused();
  await expect(page.locator(".pd-dialog-map .pd-marker")).toHaveCount(1);
  await page.evaluate(() => { window.__detailMini = document.querySelector("[data-temple-detail-map]"); });
  content.temples.records[placeKey] = { key: placeKey, status: "published", fields: { name: "วัดระฆังโฆสิตาราม ทดสอบการอัปเดต", latitude: 13.8, longitude: 100.5, plusCode: "", coordinateAddress: "ที่อยู่ที่อัปเดตสำหรับ QA" }, visitInfo: { notice: "ตรวจสอบเวลาเข้าชมก่อนเดินทาง", sources: [{ label: "QA internal source", url: "https://example.com/qa-source" }] } };
  await refresh(page);
  await expect(page.locator("h1")).toContainText("ทดสอบการอัปเดต");
  await expect(page.locator("[data-map-recenter]")).toBeVisible();
  await expect(page.locator("[data-modal-external]")).toHaveAttribute("href", /13.8%2C100.5/);
  expect(await page.evaluate(() => window.__detailMini === document.querySelector("[data-temple-detail-map]"))).toBe(true);
  await expect(page.locator('[data-pd-mode="rail"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-pd-disclosure="hours"]')).toHaveAttribute("open", "");
  await expect(page.locator('[data-pd-disclosure$="-sources"]')).toHaveCount(0);
  await expect(page.locator(".pd-visit-notice")).toHaveText("ตรวจสอบเวลาเข้าชมก่อนเดินทาง");
  await expect(page.locator(".pd-visit")).not.toContainText("QA internal source");
  content.temples.records[placeKey].fields.latitude = null;
  content.temples.records[placeKey].fields.longitude = null;
  await refresh(page);
  await expect(page.locator(".pd-marker")).toHaveCount(0);
  await expect(page.locator("[data-modal-external]")).toBeHidden();
  await expect(page.locator("[data-modal-status]")).toContainText("ยังไม่มีจุดที่ยืนยัน");
  await page.keyboard.press("Escape");
  await expect(page.locator(".pd-dialog")).toHaveCount(0);
});

test("missing/long content, mobile image overrides and unknown visit data", async ({ page }) => {
  await page.goto(route); await settle(page);
  const placeKey = await page.locator("[data-place-detail]").getAttribute("data-place-key");
  const longName = "วัดทดสอบชื่อสถานที่ยาวสำหรับตรวจสอบการตัดบรรทัดและการจัดวางบนหน้าจอขนาดเล็ก";
  content.temples.records[placeKey] = { key: placeKey, status: "published", fields: { name: longName, latitude: null, longitude: null, plusCode: "", blessings: Array.from({ length: 10 }, (_, i) => `พรหัวข้อ ${i}`).join(";"), objectHero: Array.from({ length: 9 }, (_, i) => `สิ่งสักการะ ${i}`).join(";") }, images: { hero: { desktop: { url: "/assets/images/hero-doi-suthep-gold.webp" }, mobile: { url: "/assets/images/home-intent-love.webp" } } }, visitInfo: { hours: null, admission: null, contact: null, sources: [] } };
  await page.setViewportSize({ width: 320, height: 800 }); await refresh(page);
  await expect(page.locator("h1")).toHaveText(longName);
  await expect(page.locator(".pd-visit")).toContainText("ยังไม่มีข้อมูลค่าเข้าชมที่ยืนยัน");
  await expect(page.locator("[data-map-open]")).toBeHidden();
  await page.locator('[data-pd-disclosure="topics"] summary').click();
  await expect(page.locator(".pd-highlights")).toContainText("พรหัวข้อ 9");
  await expect(page.locator("[data-place-media] source")).toHaveAttribute("srcset", "/assets/images/home-intent-love.webp");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "artifacts/place-detail/edge-320.png", fullPage: true });
});

test("share cancellation, canonical clipboard, fallback and related rail", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(route + "?session=private#tracking"); await settle(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async text => { window.__copied = text; } } });
    Object.defineProperty(navigator, "share", { configurable: true, value: async () => { throw new DOMException("Cancelled", "AbortError"); } });
  });
  await page.locator("[data-temple-detail-share]").click();
  expect(await page.evaluate(() => window.__copied)).toBeUndefined();
  await page.locator("[data-temple-detail-copy]").click();
  const copied = await page.evaluate(() => window.__copied);
  expect(copied).toContain("https://mongkolwela.vercel.app/temples/"); expect(copied).not.toMatch(/[?#]/);
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Denied"); } } }));
  await page.locator("[data-temple-detail-copy]").click();
  await expect(page.locator("#pd-copy-url")).toHaveValue(copied);
  await expect(page.locator("#pd-copy-url")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-temple-detail-copy]")).toBeFocused();
  await page.locator("[data-related-next]").click();
  await expect(page.locator("[data-related-count]")).toHaveText("2 / 3");
});

test("activity loading, stale data, retry and registration gates", async ({ page }) => {
  activityResponse = { ok: true, revision: "events-1", events: Array.from({ length: 4 }, (_, i) => ({ id: `qa-${i}`, title: `กิจกรรมทดสอบ ${i}`, type: "ceremony", status: i === 2 ? "cancelled" : "published", past: false, startDate: "2030-01-01", timeMode: "allDay", sourceUrl: "https://example.com/source", registrationUrl: "https://example.com/register", statusNote: "ยกเลิกโดยผู้จัด", verifiedAt: "2026-09-21" })) };
  await page.goto(route); await settle(page);
  await expect(page.locator(".temple-activity")).toHaveCount(3);
  await page.locator("[data-activities-more]").click();
  await expect(page.locator(".temple-activity")).toHaveCount(4);
  await page.locator('[data-activity-details="qa-2"] summary').click();
  await expect(page.locator('[data-activity-details="qa-2"] a[href*="register"]')).toHaveCount(0);
  activityStatus = 503; activityResponse = { ok: false };
  await refresh(page);
  await expect(page.locator(".temple-activities-stale")).toBeVisible();
  await expect(page.locator(".temple-activity")).toHaveCount(4);
  await expect(page.locator('[data-activity-details="qa-2"]')).toHaveAttribute("open", "");
  activityStatus = 200; activityResponse = { ok: true, unchanged: true };
  await page.locator("[data-activities-retry]").click();
  await expect(page.locator(".temple-activities-stale")).toHaveCount(0);
});

test("map failure recovers, no-JS content and accessibility", async ({ page, browser }) => {
  await page.route("**/leaflet.js", r => r.abort());
  await page.goto(route); await settle(page);
  await expect(page.locator("[data-map-retry]")).toBeVisible();
  await page.locator("[data-map-open]").click();
  await expect(page.locator("[data-modal-retry]")).toBeVisible();
  await page.unroute("**/leaflet.js");
  await page.locator("[data-modal-retry]").click();
  await expect(page.locator(".pd-dialog-map .pd-marker")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-map-open]")).toBeFocused();
  const results = await new AxeBuilder({ page }).include("[data-place-detail]").withTags(["wcag2a", "wcag2aa"]).analyze();
  await fs.writeFile("artifacts/place-detail/axe.json", JSON.stringify(results.violations, null, 2));
  expect(results.violations.filter(v => ["critical", "serious"].includes(v.impact))).toEqual([]);
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const nojs = await context.newPage();
  await nojs.goto(new URL(route, page.url()).href);
  await expect(nojs.locator("h1")).not.toBeEmpty();
  expect(await nojs.locator("[data-pd-stop]:visible").count()).toBeGreaterThan(4);
  await expect(nojs.locator("[data-temple-detail-share]")).toBeHidden();
  await expect(nojs.locator('[data-pd-disclosure$="-sources"]')).toHaveCount(0);
  await expect(nojs.locator(".pd-visit-notice")).toBeVisible();
  await context.close();
});

test("landscape dialog, keyboard containment and 200 percent text enlargement", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto(route); await settle(page);
  await page.locator("[data-map-open]").click();
  await expect(page.locator("[data-dialog-close]")).toBeFocused();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.querySelector(".pd-dialog[open]").contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-map-open]")).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    const nodes = [...document.querySelectorAll(".place-detail, .place-detail *")];
    const sizes = nodes.map(node => parseFloat(getComputedStyle(node).fontSize));
    nodes.forEach((node, i) => { if (node instanceof HTMLElement) node.style.fontSize = `${sizes[i] * 2}px`; });
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "artifacts/place-detail/text-200-390.png", fullPage: true });
});

test("shared Home, Calendar, Day and mobile menu smoke", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/calendar/", "/calendar/day/"]) {
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    expect(await page.locator("[data-place-detail]").count()).toBe(0);
  }
  await page.goto(route); await settle(page);
  const menu = page.locator('button[aria-controls="mw-navigation-dialog"]');
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  expect(errors).toEqual([]);
});

test("missing responsive image falls back without changing frame or losing CMS state", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(route); await settle(page);
  const placeKey = await page.locator("[data-place-detail]").getAttribute("data-place-key");
  const frame = await page.locator(".pd-hero-media").boundingBox();
  await page.route("**/qa-missing-hero.webp", r => r.fulfill({ status: 404, body: "missing" }));
  content.temples.records[placeKey] = { key: placeKey, status: "published", images: { hero: { desktop: { url: "/qa-missing-hero.webp" }, mobile: { url: "/qa-missing-hero.webp" } } } };
  await page.locator('[data-pd-mode="boat"]').click();
  await refresh(page);
  await expect(page.locator("[data-place-media] img")).toHaveAttribute("data-fallback-applied", "true");
  await expect(page.locator(".pd-image-credit")).toBeHidden();
  const after = await page.locator(".pd-hero-media").boundingBox();
  expect(after.height).toBe(frame.height);
  await page.evaluate(() => { window.dispatchEvent(new Event("online")); window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })); });
  await expect(page.locator('[data-pd-mode="boat"]')).toHaveAttribute("aria-pressed", "true");
});

test("slow activity response never becomes a false empty state and initial failure is distinct", async ({ page }) => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route("**/api/temple-activities?**", async r => { await pending; await r.fulfill({ json: { ok: true, revision: "empty", events: [] } }); });
  await page.goto(route); await settle(page);
  const activities = page.locator("[data-temple-activities]");
  await expect(activities).toContainText("กำลังโหลดกิจกรรม");
  await page.locator('[data-activity-period="past"]').click();
  await expect(activities).toContainText("กำลังโหลดกิจกรรม");
  await expect(activities).not.toContainText("ยังไม่มีกิจกรรมที่ผ่านมา");
  release();
  await expect(activities).toContainText("ยังไม่มีกิจกรรมที่ผ่านมาในระบบ");
  await page.unroute("**/api/temple-activities?**");
  await page.route("**/api/temple-activities?**", r => r.fulfill({ status: 503, json: { ok: false } }));
  await page.reload();
  await expect(activities).toContainText("ไม่สามารถโหลดกิจกรรมล่าสุดได้");
  await expect(activities).not.toContainText("ยังไม่มีประกาศกิจกรรม");
  await expect(activities).not.toContainText("กำลังแสดงข้อมูลที่โหลดไว้ก่อนหน้า");
});
