import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { analyticsConsentKey, consentCopy } from "../../src/lib/cookie-consent.js";

test.use({ reducedMotion: "reduce" });
const fixture = () => JSON.parse(fs.readFileSync("public/admin/content/live.json", "utf8"));
async function setup(page: Page, content = fixture()) {
  content.analytics = { ...content.analytics, enabled: true };
  const state = { pageviews: 0, content, errors: [] as string[] };
  page.on("pageerror", error => state.errors.push(error.message));
  await page.route("**/api/admin/content?*", route => route.fulfill({ json: { ok: true, content: state.content } }));
  await page.route("**/api/admin/analytics", route => { state.pageviews++; return route.fulfill({ status: 204 }); });
  await page.goto("/calendar/");
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
  await expect(page.locator("[data-page-loader]")).toHaveAttribute("aria-hidden", "true");
  await page.evaluate(() => document.fonts.ready);
  return state;
}
const stored = (page: Page) => page.evaluate(key => localStorage.getItem(key), analyticsConsentKey);
const refresh = (page: Page) => page.evaluate(() => (window as any).MongkolWelaCMS.reload());

test("exact copy, explicit acceptance, persistence and no duplicate tracking on CMS refresh", async ({ page }) => {
  const state = await setup(page);
  await expect(page.locator(".pdpa-consent__title")).toHaveText(consentCopy.titleText);
  await expect(page.locator(".pdpa-consent__body")).toHaveText(consentCopy.bannerText);
  for (const name of [consentCopy.acceptLabel, consentCopy.declineLabel, consentCopy.settingsLabel]) await expect(page.locator(".pdpa-consent").getByRole("button", { name, exact: true })).toBeVisible();
  expect(state.pageviews).toBe(0);
  await page.locator("[data-pdpa-accept]").click();
  await expect(page.locator(".pdpa-consent")).toHaveCount(0);
  expect(await stored(page)).toBe("accepted");
  await expect.poll(() => state.pageviews).toBe(1);
  await refresh(page);
  expect(state.pageviews).toBe(1);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
  await expect(page.locator(".pdpa-consent")).toHaveCount(0);
  await expect.poll(() => state.pageviews).toBe(2);
  expect(state.errors).toEqual([]);
});

test("necessary-only persists; settings cancel, opt-in and later withdrawal all work", async ({ page }) => {
  const state = await setup(page);
  await page.locator("[data-pdpa-decline]").click();
  expect(await stored(page)).toBe("declined");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
  await expect(page.locator(".pdpa-consent")).toHaveCount(0);
  expect(state.pageviews).toBe(0);
  await page.locator("[data-pdpa-reopen]").click();
  await expect(page.getByRole("switch")).not.toBeChecked();
  await page.getByRole("switch").check();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-pdpa-reopen]")).toBeFocused();
  expect(await stored(page)).toBe("declined");
  await page.locator("[data-pdpa-reopen]").click();
  await expect(page.getByRole("switch")).not.toBeChecked();
  await page.getByRole("switch").check();
  await page.getByRole("button", { name: "บันทึกการตั้งค่า" }).click();
  expect(await stored(page)).toBe("accepted");
  await expect.poll(() => state.pageviews).toBe(1);
  await page.locator("[data-pdpa-reopen]").click();
  await expect(page.getByRole("switch")).toBeChecked();
  await page.getByRole("switch").uncheck();
  await page.getByRole("button", { name: "บันทึกการตั้งค่า" }).click();
  expect(await stored(page)).toBe("declined");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
  expect(state.pageviews).toBe(1);
  expect(state.errors).toEqual([]);
});

test("settings is opt-in, keyboard-contained, cancellable and stable during CMS refresh", async ({ page }) => {
  const state = await setup(page);
  const trigger = page.locator(".pdpa-consent [data-pdpa-settings]");
  await trigger.click();
  await expect(page.locator("#pdpa-settings-title")).toBeFocused();
  await expect(page.getByRole("switch")).not.toBeChecked();
  expect(await stored(page)).toBeNull();
  expect(await page.locator("body").evaluate(e => getComputedStyle(e).overflow)).toBe("hidden");
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest(".pdpa-settings"))).toBe(true);
  }
  await page.getByRole("switch").check();
  state.content = { ...state.content, site: { ...state.content.site, name: "CMS refresh fixture" } };
  await refresh(page);
  await expect(page.getByRole("switch")).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page.locator(".pdpa-consent")).toHaveCount(1);
  expect(state.pageviews).toBe(0);
  await trigger.click();
  await expect(page.getByRole("switch")).not.toBeChecked();
  await page.getByRole("button", { name: "บันทึกการตั้งค่า" }).click();
  expect(await stored(page)).toBe("declined");
  await expect(page.locator(".pdpa-consent")).toHaveCount(0);
  await expect(page.locator("[data-pdpa-reopen]")).toBeFocused();
});

test("banner and settings fit desktop, mobile and short viewports; assets and a11y are valid", async ({ page }) => {
  await setup(page);
  for (const [width, height] of [[1440, 1000], [390, 844], [320, 568]]) {
    await page.setViewportSize({ width, height });
    const banner = page.locator(".pdpa-consent");
    const bounds = await banner.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height);
    // Botanical edges intentionally extend outside the paper, but never outside the viewport.
    expect(await banner.locator(".pdpa-consent__surface").evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    for (const button of await banner.getByRole("button").all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await banner.locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    const bannerAxe = await new AxeBuilder({ page }).include(".pdpa-consent").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(bannerAxe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.failureSummary) }))).toEqual([]);
    await banner.locator("[data-pdpa-settings]").click();
    const dialog = page.getByRole("dialog", { name: "ตั้งค่าคุกกี้" });
    expect(await dialog.evaluate(e => getComputedStyle(e).animationName)).toBe("none");
    expect(await dialog.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
    const box = await dialog.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(height);
    for (const icon of await dialog.locator(".ui-icon-mask").all()) {
      const mask = await icon.evaluate(e => getComputedStyle(e).maskImage);
      expect((await page.request.get(mask.slice(5, -2))).ok()).toBe(true);
    }
    const dialogAxe = await new AxeBuilder({ page }).include(".pdpa-settings").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(dialogAxe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.failureSummary) }))).toEqual([]);
    await page.keyboard.press("Escape");
  }
});

test("CMS-authored text and privacy link remain authoritative and escaped", async ({ page }) => {
  const content = fixture();
  content.site.pdpa = { ...content.site.pdpa, titleText: 'หัวข้อจาก CMS <img src=x onerror=alert(1)>', bannerText: "รายละเอียดจากทีมงาน", acceptLabel: "อนุญาตการวิเคราะห์", declineLabel: "เฉพาะจำเป็น", settingsLabel: "ตัวเลือกความเป็นส่วนตัว", policyHref: "/privacy/", policyLabel: "อ่านนโยบาย" };
  await setup(page, content);
  await expect(page.locator(".pdpa-consent__title")).toHaveText(content.site.pdpa.titleText);
  await expect(page.locator(".pdpa-consent__title img")).toHaveCount(0);
  await expect(page.locator(".pdpa-consent .pdpa-policy")).toHaveAttribute("href", /\/privacy\/$/);
  await page.locator("[data-pdpa-settings]").click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName(content.site.pdpa.settingsLabel);
});

test("unavailable storage does not break CMS or optional consent", async ({ page }) => {
  await page.addInitScript(key => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem, remove = Storage.prototype.removeItem;
    Storage.prototype.getItem = function (name) { if (name === key) throw new DOMException("Blocked", "SecurityError"); return get.call(this, name); };
    Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException("Blocked", "SecurityError"); return set.call(this, name, value); };
    Storage.prototype.removeItem = function (name) { if (name === key) throw new DOMException("Blocked", "SecurityError"); return remove.call(this, name); };
  }, analyticsConsentKey);
  const state = await setup(page);
  await page.locator("[data-pdpa-decline]").click();
  await expect(page.locator(".pdpa-consent")).toHaveCount(0);
  await expect(page.locator("[data-pdpa-storage-status]")).toContainText("เบราว์เซอร์ไม่อนุญาต");
  await refresh(page);
  expect(state.pageviews).toBe(0);
  await page.locator("[data-pdpa-reopen]").click();
  await page.getByRole("switch").check();
  await page.getByRole("button", { name: "บันทึกการตั้งค่า" }).click();
  await expect.poll(() => state.pageviews).toBe(1);
  expect(state.errors).toEqual([]);
});

test("invalid stored values prompt again; disabling consent UI removes both entry points", async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, "invalid"), analyticsConsentKey);
  const state = await setup(page);
  await expect(page.locator(".pdpa-consent")).toBeVisible();
  expect(state.pageviews).toBe(0);
  state.content.site.pdpa.analyticsConsentRequired = false;
  await refresh(page);
  await expect(page.locator(".pdpa-consent")).toHaveCount(0);
  await expect(page.locator("[data-pdpa-reopen]")).toBeHidden();
});

test("another tab's saved choice synchronizes the prompt and settings", async ({ page, context }) => {
  const first = await setup(page);
  const other = await context.newPage();
  const second = await setup(other);
  await other.locator("[data-pdpa-decline]").click();
  await expect(page.locator(".pdpa-consent")).toHaveCount(0);
  expect(first.pageviews).toBe(0);
  await page.locator("[data-pdpa-reopen]").click();
  await expect(page.getByRole("switch")).not.toBeChecked();
  await other.locator("[data-pdpa-reopen]").click();
  await other.getByRole("switch").check();
  await other.getByRole("button", { name: "บันทึกการตั้งค่า" }).click();
  await expect(page.getByRole("switch")).toBeChecked();
  await expect.poll(() => first.pageviews).toBe(1);
  await expect.poll(() => second.pageviews).toBe(1);
  await page.getByRole("switch").uncheck();
  await page.getByRole("button", { name: "บันทึกการตั้งค่า" }).click();
  await other.locator("[data-pdpa-reopen]").click();
  await expect(other.getByRole("switch")).not.toBeChecked();
  await other.close();
});
