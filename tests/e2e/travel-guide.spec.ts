import { expect, test } from "@playwright/test";
import fs from "node:fs";

const content = JSON.parse(fs.readFileSync("public/admin/content/live.json", "utf8"));
const storageKey = "mongkolwela.travel-guide.checklist.v1";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/admin/content?*", route => route.fulfill({ json: { ok: true, content } }));
  await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
});

for (const width of [1440, 390]) {
  test(`guide entry, links and checklist work at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/temples/");
    const entry = page.locator("[data-header-utility-links]").getByRole("link", { name: "คู่มือวางแผนเดินทางมงคล" });
    await expect(entry).toHaveAttribute("href", "/guide/");
    await entry.click();
    await expect(page).toHaveURL(/\/guide\/$/);
    await expect(page.locator("h1")).toHaveText("คู่มือวางแผนเดินทางมงคล");
    await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    for (const href of ["/temples/popular/", "/temples/sacred/", "/temples/mu/", "/search/", "/calendar/", "/calendar/day/", "/temples/planner/"]) {
      await expect(page.locator(`main a[href="${href}"]`).first()).toBeAttached();
    }
    await page.getByRole("navigation", { name: "ขั้นตอนวางแผนเดินทาง" }).getByRole("link", { name: /จัดเส้นทาง/ }).click();
    await expect(page).toHaveURL(/#guide-route$/);
    await expect.poll(() => page.locator("#guide-route").evaluate(element => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(64);

    const checks = page.locator("[data-travel-checklist] input");
    await checks.first().check();
    await checks.nth(2).check();
    await expect(page.locator("[data-guide-count]")).toHaveText("2 / 6");
    await page.reload();
    await expect(checks.first()).toBeChecked();
    await expect(checks.nth(2)).toBeChecked();
    await expect(checks.nth(1)).not.toBeChecked();
    for (const checkbox of await checks.all()) await checkbox.check();
    await expect(page.locator("[data-guide-count]")).toHaveText("6 / 6");
    await expect(page.locator("[data-guide-complete]")).toBeVisible();
    await page.getByRole("button", { name: "ล้างรายการ" }).click();
    await expect(page.locator("[data-guide-count]")).toHaveText("0 / 6");
    await expect(checks.first()).toBeFocused();
    await expect(page.locator("[data-guide-complete]")).toBeHidden();
    expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBeNull();

    const faq = page.locator(".guide-faq details").first();
    await faq.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(faq).toHaveAttribute("open", "");
    await expect(faq.locator("p")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(faq).not.toHaveAttribute("open", "");
    expect(errors).toEqual([]);
    await page.locator(".guide-planner-action a").click();
    await expect(page).toHaveURL(/\/temples\/planner\/$/);
  });
}

test("malformed checklist data does not break the guide", async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, "invalid json"), storageKey);
  await page.goto("/guide/");
  await expect(page.locator("[data-guide-count]")).toHaveText("0 / 6");
  await page.locator("[data-travel-checklist] input").first().check();
  await expect(page.locator("[data-guide-count]")).toHaveText("1 / 6");
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), storageKey)).toEqual(["hours"]);
});

test("checklist remains usable when saving is unavailable", async ({ page }) => {
  await page.addInitScript(key => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException("Unavailable", "QuotaExceededError");
      return setItem.call(this, name, value);
    };
  }, storageKey);
  await page.goto("/guide/");
  await page.locator("[data-travel-checklist] input").first().check();
  await expect(page.locator("[data-guide-count]")).toHaveText("1 / 6");
  await expect(page.locator("[data-guide-storage-note]")).toContainText("ยังบันทึกบนอุปกรณ์ไม่ได้");
});

test("guide content and navigation render without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${baseURL}/guide/`);
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator(".guide-chapter")).toHaveCount(4);
  await expect(page.locator("[data-guide-progress]")).toBeHidden();
  await page.evaluate(() => document.fonts.ready);
  const summary = page.locator(".guide-faq summary").first();
  await summary.scrollIntoViewIfNeeded();
  await expect(summary).toBeInViewport();
  await summary.click();
  await expect(page.locator(".guide-faq details").first().locator("p")).toBeVisible();
  expect(await page.locator(".guide-checklist input").count()).toBe(6);
  await context.close();
});
