import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";

async function ready(page: Page) {
  await page.locator("html[data-cms-ready=true]").waitFor();
  await page.locator("[data-page-loader]").waitFor({ state: "hidden" });
  await page.evaluate(() => document.fonts.ready);
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  mkdirSync("artifacts/temple-search", { recursive: true });
});

for (const width of [1440, 390]) {
  test(`Home and header share suggestions, keyboard and result destination at ${width}`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/"); await ready(page);
    const home = page.locator("#site-search");
    await home.fill("  วัดอรุณ  ");
    await expect(page.locator("#site-search-list [role=option]").first()).toBeVisible();
    const hrefs = await page.locator("#site-search-list [role=option]").evaluateAll(nodes => nodes.map(n => n.getAttribute("href")));
    await expect.poll(() => page.locator("#site-search-list img").evaluateAll(nodes => nodes.every(n => (n as HTMLImageElement).complete))).toBe(true);
    await page.screenshot({ path: `artifacts/temple-search/home-${width}.png` });
    await home.press("Escape");
    await expect(home).toHaveAttribute("aria-expanded", "false");
    await page.locator(".mw-search").click();
    const dialog = page.locator("#temple-search-dialog");
    const input = page.locator("#header-temple-search");
    await expect(input).toBeFocused();
    await expect(page).toHaveURL(/\/$/);
    await input.fill("วัดอรุณ");
    await expect(dialog.getByRole("option").first()).toBeVisible();
    expect(await dialog.getByRole("option").evaluateAll(nodes => nodes.map(n => n.getAttribute("href")))).toEqual(hrefs);
    await input.press("ArrowDown");
    await expect(input).toHaveAttribute("aria-activedescendant", "header-temple-search-option-0");
    await page.screenshot({ path: `artifacts/temple-search/dialog-${width}.png` });
    const axe = await new AxeBuilder({ page }).include("#temple-search-dialog").withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.filter(v => ["serious", "critical"].includes(v.impact!))).toEqual([]);
    await input.press("Escape"); await expect(dialog).toBeVisible();
    await input.press("Escape"); await expect(dialog).toBeHidden();
    await expect(page.locator(".mw-search")).toBeFocused();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
    await page.goto("/tarot/daily/"); await ready(page);
    await page.locator(".mw-search").click(); await input.fill("วัดอรุณ");
    await expect(dialog.getByRole("option").first()).toBeVisible();
    await dialog.getByRole("button", { name: "ค้นหา", exact: true }).click();
    await expect(page).toHaveURL(/\/search\/\?q=/);
    await expect(page.locator("[data-search-page]")).toHaveAttribute("aria-busy", "false");
    expect(await page.locator("[data-search-results] a").first().getAttribute("href")).toBe(hrefs[0]);
    await page.locator("[data-search-results] a").first().click();
    await expect(page).toHaveURL(new RegExp("/temples/(popular|sacred|mu)/.+/"));
    await ready(page); await expect(page.locator("h1")).toContainText("อรุณ");
    await page.locator(".mw-search").click(); await input.fill("วัดอรุณ");
    await expect(dialog.getByRole("option").first()).toBeVisible();
    await input.press("ArrowDown"); await input.press("Enter");
    await expect(dialog).toBeHidden(); await ready(page);
    await expect(page.locator("h1")).toContainText("อรุณ");
    expect(errors).toEqual([]);
  });

  test(`results filters, URL/back, empty, retry and responsive layout at ${width}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/search/?q=กรุงเทพมหานคร"); await ready(page);
    await expect(page.locator("[data-search-page]")).toHaveAttribute("aria-busy", "false");
    await expect(page.locator("[data-search-results] > a")).toHaveCount(24);
    await expect.poll(() => page.locator("[data-search-results] img").evaluateAll(nodes => nodes.filter(n => n.getBoundingClientRect().top < innerHeight).every(n => (n as HTMLImageElement).complete))).toBe(true);
    await page.screenshot({ path: `artifacts/temple-search/results-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.locator('[data-search-filter][name="collection"]').selectOption("mu", { force: true });
    await expect(page).toHaveURL(/collection=mu/);
    await expect(page.locator("[data-search-page]")).toHaveAttribute("aria-busy", "false");
    expect(await page.locator("[data-search-results] > a").evaluateAll(nodes => nodes.every(n => n.getAttribute("href")?.startsWith("/temples/mu/")))).toBe(true);
    await page.goBack();
    await expect(page.locator('[name="collection"]')).toHaveValue("");
    await expect(page.locator("[data-search-page]")).toHaveAttribute("aria-busy", "false");
    await page.locator("[data-search-next]").click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator("[data-search-page-number]")).toContainText("หน้า 2");
    await page.reload(); await ready(page);
    await expect(page.locator("[data-search-page-number]")).toContainText("หน้า 2");
    await page.locator("#results-temple-search").fill("zzzznotfound");
    await page.locator("#results-temple-search").press("Enter");
    await expect(page.locator("[data-search-state-title]")).toHaveText("ยังไม่พบสถานที่ที่ตรงกัน");
    await page.route("**/api/temple-search?*", route => route.fulfill({ status: 503, json: { error: "Unavailable" } }));
    await page.locator("#results-temple-search").fill("การงาน");
    await page.locator("#results-temple-search").press("Enter");
    await expect(page.locator("[data-search-state-title]")).toHaveText("โหลดผลค้นหาไม่สำเร็จ");
    await expect(page.locator("#results-temple-search")).toHaveValue("การงาน");
    await expect(page.locator("[data-search-results] > a")).toHaveCount(0);
    await page.unroute("**/api/temple-search?*");
    await page.locator("[data-search-page-retry]").click();
    await expect(page.locator("[data-search-results] > a").first()).toBeVisible();
    const axe = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.filter(v => ["serious", "critical"].includes(v.impact!))).toEqual([]);
  });
}

test("stale suggestions cannot replace a newer query; closing cancels results", async ({ page }) => {
  await page.goto("/"); await ready(page);
  await page.route("**/api/temple-search?*", async route => {
    if (new URL(route.request().url()).searchParams.get("q") === "old") {
      await new Promise(resolve => setTimeout(resolve, 900));
      await route.fulfill({ json: { items: [], total: 0, filters: {} } });
    } else await route.continue();
  });
  await page.locator(".mw-search").click();
  const input = page.locator("#header-temple-search");
  const oldRequest = page.waitForRequest(request => new URL(request.url()).searchParams.get("q") === "old");
  await input.fill("old"); await oldRequest;
  await input.fill("วัดอรุณ");
  await expect(page.locator("#header-temple-search-list")).toContainText("อรุณ");
  await page.waitForTimeout(1000);
  await expect(page.locator("#header-temple-search-list")).toContainText("อรุณ");
  await page.getByRole("button", { name: "ปิดการค้นหา" }).click();
  await expect(page.locator("#temple-search-dialog")).toBeHidden();
  await page.locator(".mw-search").click();
  await expect(page.locator("#header-temple-search-list")).toContainText("อรุณ");
});
