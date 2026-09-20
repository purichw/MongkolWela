import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
const content = JSON.parse(readFileSync(new URL("../../public/admin/content/live.json", import.meta.url), "utf8"));
const root = "[data-calendar-day-detail]";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-20T05:00:00Z"));
  await page.route("**/api/admin/content?*", route => route.fulfill({ json: { ok: true, content } }));
  await page.route("**/api/admin/analytics", route => route.fulfill({ status: 204 }));
  await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
});

test("real day fields, symbolic chart, sources and exposed desktop advice", async ({ page }) => {
  await page.goto("/calendar/day/?date=2026-09-20");
  await expect(page.locator(root)).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#day-title")).toHaveText("วันที่ 20 กันยายน 2569");
  await expect(page.locator(".day-facts dd")).toHaveText(["เดือนสิบ (๑๐)", "ปีมะเมีย", "1388", "1947", "244", "ปกติมาส"]);
  await expect(page.locator(".day-phase")).toContainText("ขึ้น ๙ ค่ำ");
  await expect(page.locator(".wheel-marker")).toHaveCount(4);
  await expect(page.locator(".wheel-label")).toHaveCount(12);
  await expect(page.locator(".day-wheel-explanation")).toContainText("ไม่ใช่ตำแหน่งดาวจริง");
  await expect(page.locator(".day-omen[open]")).toHaveCount(3);
  await expect(page.locator(".day-source")).toHaveAttribute("open", "");
  await expect(page.locator(".day-omen.is-avoid")).toContainText("อัคนิโรธ");
  await expect(page.locator(".site-footer--ivory")).toHaveCount(1);
  expect(await page.locator('link[href*="thai-calendar.css"], link[href*="calendar-overview"]').count()).toBe(0);
});

test("native date navigation preserves leap days, year boundaries and the return month", async ({ page }) => {
  await page.goto("/calendar/day/?date=2024-02-28");
  await page.locator("[data-day-next]").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(root)).toHaveAttribute("data-date", "2024-02-29");
  await page.reload();
  await expect(page.locator(root)).toHaveAttribute("data-date", "2024-02-29");
  await page.locator("[data-day-next]").click();
  await expect(page.locator(root)).toHaveAttribute("data-date", "2024-03-01");
  await page.locator("[data-day-previous]").click();
  await page.locator("[data-day-back]").click();
  await expect(page).toHaveURL(/calendar\/\?year=2567&month=2$/);
  await expect(page.locator("#cal-month-title")).toHaveText("กุมภาพันธ์ 2567");
  await page.goto("/calendar/day/?date=2026-01-01");
  await page.locator("[data-day-previous]").click();
  await expect(page.locator(root)).toHaveAttribute("data-date", "2025-12-31");
});

test("invalid input is explicit, date limits are safe and concurrent events survive", async ({ page }) => {
  for (const date of ["2026-02-30", "100000-01-01", "oops"]) {
    await page.goto(`/calendar/day/?date=${date}`);
    await expect(page.locator(root)).toHaveAttribute("data-date", "2026-09-20");
    await expect(page.locator(".day-input-note")).toBeVisible();
  }
  await page.goto("/calendar/day/?date=1757-01-01");
  await expect(page.locator("[data-day-previous]")).toHaveCount(0);
  await expect(page.locator('.day-nav [aria-disabled="true"]')).toContainText("วันก่อนหน้า");
  await page.goto("/calendar/day/?date=2157-12-31");
  await expect(page.locator("[data-day-next]")).toHaveCount(0);
  await page.goto("/calendar/day/?date=2026-05-01");
  for (const title of ["วันแรงงาน", "วันพระ", "วิสาขบูชา"]) await expect(page.locator(".day-events")).toContainText(title);
});

test("mobile disclosures work with touch and keyboard and recompose on resize", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/calendar/day/?date=2026-09-20");
  await expect(page.locator("[data-day-disclosure][open]")).toHaveCount(0);
  await page.locator(".day-omen.is-avoid > summary").click();
  await expect(page.locator(".day-omen.is-avoid ul")).toBeVisible();
  await page.locator(".day-omen.is-avoid > summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".day-omen.is-avoid ul")).toBeHidden();
  await page.locator(".day-source > summary").click();
  await page.locator(".day-source-method > summary").click();
  await expect(page.locator(".day-source-method p")).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator("[data-day-disclosure][open]")).toHaveCount(4);
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(page.locator("[data-day-disclosure][open]")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const boxes = await page.locator(".day-facts > div").evaluateAll(els => els.map(e => e.getBoundingClientRect().x));
  expect(new Set(boxes).size).toBe(2);
  await expect(page.locator(".day-wheel-explanation")).toBeVisible();
  const wheel = page.locator(".astro-wheel");
  const compactWidth = (await wheel.boundingBox())!.width;
  await page.locator("[data-day-wheel-expand]").click();
  await expect(page.locator("[data-day-wheel-expand]")).toHaveAttribute("aria-expanded", "true");
  expect((await wheel.boundingBox())!.width).toBeGreaterThan(compactWidth * 1.5);
  await page.locator("[data-day-wheel-expand]").click();
  await expect(page.locator("[data-day-wheel-expand]")).toHaveAttribute("aria-expanded", "false");
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(page.locator("[data-day-disclosure][open]")).toHaveCount(0);
  await page.locator(".day-omen.is-good > summary").click();
  await expect(page.locator(".day-omen.is-good ul")).toBeVisible();
});

test("published CMS media wins and an unavailable image falls back without blocking the day", async ({ page }) => {
  const fixture = structuredClone(content);
  const patch = fixture.pages.find((p: { id: string }) => p.id === "calendarDay").patches[0];
  patch.src = "/assets/images/hero-doi-suthep-gold.webp";
  patch.alt = "ภาพทดสอบจาก CMS";
  patch.position = "70% 20%";
  patch.credit = "CMS photographer";
  patch.sourceUrl = "https://example.com/photo";
  await page.route("**/api/admin/content?*", route => route.fulfill({ json: { ok: true, content: fixture } }));
  await page.goto("/calendar/day/?date=2026-09-20");
  const hero = page.locator("#calendar-day-hero-image");
  await expect(hero).toHaveAttribute("src", patch.src);
  await expect(hero).toHaveAttribute("alt", patch.alt);
  await expect(hero).toHaveCSS("object-position", patch.position);
  await expect(page.locator("[data-day-media-credit]")).toContainText("CMS photographer");
  await expect(page.locator("[data-day-media-credit] a").first()).toHaveAttribute("href", "https://example.com/photo");
  patch.src = "/unavailable-day-image.webp";
  await page.route("**/unavailable-day-image.webp", route => route.fulfill({ status: 404 }));
  await page.reload();
  await expect(hero).toHaveAttribute("src", "/assets/images/temple-placeholder-auspicious.png");
  await expect(page.locator(root)).toHaveAttribute("data-state", "ready");
  await expect(page.locator("[data-day-next]")).toBeVisible();
  await expect(page.locator("[data-day-media-credit]")).toBeHidden();
});

test("shared footer default remains dark on Home and Calendar", async ({ page }) => {
  for (const route of ["/", "/calendar/?year=2569&month=1"]) {
    await page.goto(route);
    await expect(page.locator(".site-footer--home-v2")).toHaveCSS("background-color", "rgb(26, 16, 11)");
    await expect(page.locator(".site-footer--ivory")).toHaveCount(0);
  }
});
