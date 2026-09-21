import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { adminDesignFixture } from "../helpers/admin-design-fixture.mjs";
import fs from "node:fs";

const output = "artifacts/admin-design";
fs.mkdirSync(output, { recursive: true });

async function mock(page, overrides = {}) {
  const fixture = { ...adminDesignFixture(), ...overrides };
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    const data = fixture[path];
    return route.fulfill({ status: data ? 200 : 401, json: data || { ok: false, error: "Access denied" } });
  });
}

async function ready(page) {
  await page.goto("/admin/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#adminStatus")).toHaveText(/พร้อมใช้งาน|ข้อมูลบางส่วนโหลดไม่สำเร็จ/);
  await page.evaluate(() => document.fonts.ready);
}

async function snapshot(page, name, fullPage = true) {
  await page.screenshot({ path: `${output}/${name}.png`, fullPage, animations: "disabled" });
}

async function fits(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test("shared desktop shell, search, sections, and keyboard controls", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1086 });
  await mock(page);
  await ready(page);
  await expect(page.locator(".mw-overview-stat")).toHaveCount(4);
  await snapshot(page, "desktop");
  const a11y = await new AxeBuilder({ page }).include(".mw-admin-main").withTags(["wcag2a", "wcag2aa"]).analyze();
  fs.writeFileSync(`${output}/a11y.json`, JSON.stringify(a11y.violations, null, 2));
  expect(a11y.violations).toEqual([]);
  await page.locator(".mw-admin-nav-toggle").click();
  await expect(page.locator(".mw-admin-shell")).toHaveClass(/is-sidebar-collapsed/);
  await page.reload();
  await expect(page.locator(".mw-admin-shell")).toHaveClass(/is-sidebar-collapsed/);
  await page.locator(".mw-admin-nav-toggle").click();
  for (const section of ["temples", "collections", "dates", "pages", "navigation", "media", "analytics", "users", "settings"]) {
    await page.locator(`#adminNav [data-section="${section}"]`).click();
    await expect(page.locator("#adminTitle")).not.toBeEmpty();
    await fits(page);
    expect(await page.locator("#adminContent").innerText()).not.toContain("<span");
    if (["temples", "dates", "pages", "media"].includes(section)) await snapshot(page, `desktop-${section}`, false);
  }
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.locator("#adminGlobalSearch")).toBeFocused();
  await page.locator("#adminGlobalSearch").fill("ระฆัง");
  await expect(page.locator("#adminSearchResults")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "ข้อมูลวัด/สถานที่" })).toBeVisible();
  await snapshot(page, "desktop-editor", false);
  await page.keyboard.press("Escape");
  await expect(page.locator(".mw-admin-drawer")).not.toBeVisible();
  await page.locator("#adminGlobalSearch").fill("ปฏิทินไทย");
  await page.locator("#adminSearchResults [data-page-jump='calendar']").click();
  await expect(page.locator("[data-field='selectedPage']")).toHaveValue("calendar");
  expect(errors).toEqual([]);
});

test("mobile navigation, focus, responsive sections, and editing", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mock(page);
  await ready(page);
  await expect(page.locator(".mw-admin-sidebar")).not.toBeVisible();
  await fits(page);
  await snapshot(page, "mobile");
  await page.locator(".mw-admin-nav-toggle").click();
  await expect(page.locator(".mw-admin-main")).toHaveAttribute("inert", "");
  await expect(page.locator(".mw-admin-sidebar-close")).toBeFocused();
  await page.locator(".mw-admin-sidebar [data-action='preview']").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator(".mw-admin-logo")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator(".mw-admin-sidebar [data-action='preview']")).toBeFocused();
  await page.locator(".mw-admin-sidebar-close").focus();
  await snapshot(page, "mobile-menu", false);
  await page.keyboard.press("Escape");
  await expect(page.locator(".mw-admin-nav-toggle")).toBeFocused();
  await page.locator(".mw-admin-nav-toggle").click();
  await page.locator("#adminNav [data-section='temples']").click();
  await expect(page.locator(".mw-admin-main")).not.toHaveAttribute("inert", "");
  await fits(page);
  await snapshot(page, "mobile-temples", false);
  await expect(page.locator("[data-edit-temple]").first()).toBeInViewport();
  await page.locator("[data-edit-temple]").first().click();
  await expect(page.locator(".mw-admin-drawer")).toBeVisible();
  await fits(page);
  await snapshot(page, "mobile-editor", false);
  await page.keyboard.press("Escape");
  for (const width of [320, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.reload();
    await expect(page.locator(".mw-overview-stats")).toBeVisible();
    await fits(page);
  }
});

test("unavailable analytics does not masquerade as a zero total", async ({ page }) => {
  await mock(page, { "/api/admin/analytics": null, "/api/admin/temples": null });
  await ready(page);
  await expect(page.locator(".mw-overview-stat strong").first()).toHaveText("—");
  await expect(page.locator(".mw-overview-stat strong").nth(2)).toHaveText("—");
  await expect(page.locator(".mw-overview-trend")).toContainText("ยังไม่สามารถโหลดสถิติได้");
  await expect(page.locator(".mw-overview-referrers")).toContainText("ยังไม่สามารถโหลดสถิติได้");
  await expect(page.locator(".mw-overview-list").first()).toContainText("ยังไม่สามารถโหลดข้อมูลสถานที่ได้");
});

test("empty statistics and sign-in failure remain explicit", async ({ page }) => {
  await mock(page, { "/api/admin/analytics": { ok: true, analytics: { totals: { pageviews: 0, events: 0 }, paths: {}, events: {} } } });
  await ready(page);
  await expect(page.locator(".mw-overview-stat strong").first()).toHaveText("0");
  await expect(page.locator(".mw-overview-trend")).toContainText("ยังไม่มีข้อมูลรายวัน");
  await page.route("**/api/admin/session", route => route.fulfill({ status: 401, json: { ok: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" } }));
  await page.reload();
  await page.getByLabel("อีเมล", { exact: true }).fill("test@example.test");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("invalid-test-password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page.locator("#loginError")).toHaveText("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  await expect(page.getByLabel("อีเมล", { exact: true })).toHaveValue("test@example.test");
  await snapshot(page, "login", false);
});
