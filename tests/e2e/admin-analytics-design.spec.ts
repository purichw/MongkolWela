import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { adminDesignFixture } from "../helpers/admin-design-fixture.mjs";
import { summarizeAnalyticsEvents } from "../../src/lib/admin-analytics.js";
import { analyticsRange, analyticsPreset } from "../../src/lib/admin-analytics-report.js";

async function setup(page, mode = "populated") {
  const fixture = adminDesignFixture(), errors = [], requests = [];
  let fail = mode === "error", delay = 0;
  page.on("pageerror", error => errors.push(error.message));
  const paths = ["/", "/temples/", "/calendar/", "/temples/popular/", "/tarot/daily/", "/about/", "/contact/"];
  const titles = ["หน้าแรก", "วัดและสถานที่", "วันพระ", "วัดดังน่าไป", "ไพ่ยิปซีรายวัน", "เกี่ยวกับเรา", "ติดต่อเรา"];
  const events = ["search", "temple_search", "share", "copy_link", "planner_add", "print"];
  const start = Date.parse(`${analyticsPreset(30).from}T00:00:00+07:00`);
  const rows = mode === "empty" ? [] : Array.from({ length: 30 }, (_, day) => Array.from({ length: 100 + day * 9 + (day % 4) * 23 }, (_, n) => ({ event_type: n % 4 === 0 ? events[n % events.length] : "pageview", page_path: paths[n % paths.length], page_title: titles[n % titles.length], created_at: new Date(start + day * 86400000 + 3600000).toISOString(), referrer: ["https://mongkolwela.com/temples/", "https://example.org/", "", "https://sample.test/"][n % 4] }))).flat();
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/admin/analytics") {
      requests.push(url.search);
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      if (fail) return route.fulfill({ status: 503, json: { ok: false, error: "แหล่งข้อมูลไม่พร้อมใช้งาน" } });
      const range = analyticsRange(url.searchParams.get("from"), url.searchParams.get("to")) || analyticsRange(analyticsPreset(30).from, analyticsPreset(30).to);
      const selected = rows.filter(row => row.created_at >= range.since && row.created_at <= range.until);
      const analytics = summarizeAnalyticsEvents(selected, { since: range.since, now: range.until, limited: mode === "limited" });
      return route.fulfill({ json: { ok: true, analytics } });
    }
    return route.fulfill({ status: fixture[url.pathname] ? 200 : 404, json: fixture[url.pathname] || { ok: false } });
  });
  await page.goto("/admin/");
  await expect(page.locator("#adminStatus")).not.toHaveText("กำลังโหลด");
  await page.locator('#adminNav [data-section="analytics"]').click();
  await expect(page.locator(".mw-analytics")).toBeVisible();
  return { errors, requests, fail: value => { fail = value; }, delay: value => { delay = value; } };
}
async function choose(page, option) {
  await page.getByRole("combobox", { name: "ช่วงเวลาสถิติ", exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
async function capture(page, name) {
  await page.evaluate(async () => { await document.fonts.ready; scrollTo(0, 0); });
  fs.mkdirSync("artifacts/admin-analytics", { recursive: true });
  await page.screenshot({ path: `artifacts/admin-analytics/${name}.png`, fullPage: true, animations: "disabled" });
}

test("analytics desktop/mobile mockup, real-shaped counts, accessibility and shared shell", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { errors } = await setup(page);
  await expect(page.locator(".mw-analytics-metric")).toHaveCount(4);
  await expect(page.locator(".mw-analytics-returning")).toContainText("ยังวัดไม่ได้");
  await expect(page.locator(".mw-analytics-quality")).not.toContainText("98%");
  expect(await page.locator("#adminSidebar").evaluate(node => getComputedStyle(node).backgroundColor)).toBe("rgb(11, 56, 46)");
  await expect(page.locator('[data-action="publish"]').first()).toBeHidden();
  await capture(page, "analytics-1440");
  await page.locator("[data-analytics-expand=pages]").click();
  await expect(page.locator(".mw-analytics-rankings li")).toHaveCount(7);
  await page.locator("[data-analytics-expand=pages]").click();
  await expect(page.locator(".mw-analytics-rankings li")).toHaveCount(5);
  await page.locator(".mw-analytics-data summary").click();
  await expect(page.locator(".mw-analytics-data tbody tr")).toHaveCount(30);
  await page.locator(".mw-analytics-data summary").click();
  for (const width of [1440, 1280, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow ${width}`).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, "analytics-390");
  await page.screenshot({ path: "artifacts/admin-analytics/analytics-390-top.png", animations: "disabled" });
  const axe = await new AxeBuilder({ page }).include(".is-analytics").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(axe.violations).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#adminNav [data-section="pages"]').click();
  await expect(page.locator("[data-analytics-header]")).toHaveCount(0);
  await expect(page.locator('[data-action="publish"]').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("analytics date filter, custom validation, CSV download, loading and retry", async ({ page }) => {
  const control = await setup(page);
  const original = await page.locator(".mw-analytics-metric strong").first().textContent();
  await choose(page, "7 วันที่ผ่านมา");
  await expect(page.locator(".mw-analytics")).toHaveAttribute("aria-busy", "false");
  expect(await page.locator(".mw-analytics-metric strong").first().textContent()).not.toBe(original);
  expect(control.requests.at(-1)).toContain("from=");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "ดาวน์โหลดรายงาน" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/analytics.*\.csv$/);
  const csv = fs.readFileSync(await download.path(), "utf8");
  expect(csv).toContain("การเปิดหน้าเว็บ");
  expect(csv).toContain("วันที่ (เวลาไทย)");
  await choose(page, "กำหนดช่วงวันที่");
  await page.locator('[name="from"]').fill("2026-01-01");
  await page.locator('[name="to"]').fill("2026-09-01");
  await page.getByRole("button", { name: "ใช้ช่วงวันที่" }).click();
  await expect(page.getByRole("alert")).toContainText("ไม่เกิน 90 วัน");
  await expect(page.locator('[name="from"]')).toHaveValue("2026-01-01");
  control.fail(true);
  await choose(page, "30 วันที่ผ่านมา");
  await expect(page.getByRole("alert")).toContainText("แหล่งข้อมูลไม่พร้อมใช้งาน");
  await expect(page.locator(".mw-analytics-metric strong").first()).toHaveText("—");
  await expect(page.getByRole("button", { name: "ดาวน์โหลดรายงาน" })).toBeDisabled();
  control.fail(false); control.delay(350);
  await page.getByRole("button", { name: "ลองอีกครั้ง" }).click();
  await expect(page.locator(".mw-analytics")).toHaveAttribute("aria-busy", "true");
  await expect(page.locator(".mw-analytics")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator(".mw-analytics-metric strong").first()).toHaveText(original);
  expect(control.errors).toEqual([]);
});

test("analytics empty, error and truncated reports remain distinct and export is honest", async ({ page }) => {
  await setup(page, "empty");
  await expect(page.locator(".mw-analytics-metric strong").first()).toHaveText("0");
  await expect(page.locator(".mw-analytics-sources")).toContainText("ยังไม่มีข้อมูลแหล่งอ้างอิง");
  await capture(page, "analytics-empty");
  await page.unroute("**/api/**");
  await setup(page, "error");
  await expect(page.locator(".mw-analytics-metric strong").first()).toHaveText("—");
  await expect(page.getByRole("alert")).toBeVisible();
  await page.unroute("**/api/**");
  await setup(page, "limited");
  await expect(page.locator(".mw-analytics-notice")).toContainText("ข้อมูลบางส่วน");
  await expect(page.locator(".mw-analytics-quality")).toContainText("10,000");
});
