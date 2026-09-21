import { expect, test } from "@playwright/test";
import { skipIntroLoader } from "./helpers";
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";

const seed = JSON.parse(readFileSync(new URL("../../public/admin/content/live.json", import.meta.url), "utf8"));
test.beforeEach(async ({ page, isMobile }) => {
  await skipIntroLoader(page);
  await page.route("**/api/admin/content?**", route => route.fulfill({ json: { ok: true, revision: "registry-preview", content: seed } }));
  if (isMobile) await page.setViewportSize({ width: 390, height: 844 });
});

test.describe("All-Thailand temple directory payload", () => {
  test("hydrates filters from the lightweight index before loading the full dataset", async ({ page }) => {
    await skipIntroLoader(page);

    const dataRequests: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("temples-thailand")) dataRequests.push(new URL(url).pathname);
    });

    await page.goto("/temples/thailand/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-temple-count]")).toContainText("แสดงตัวอย่าง");
    expect(dataRequests).toContain("/assets/data/temples-thailand-index.json");
    expect(dataRequests).not.toContain("/assets/data/temples-thailand.json");

    await page.selectOption("[data-temple-region]", "ภาคกลาง");
    await expect(page.locator("[data-temple-province]")).toBeEnabled();
    await expect(page.locator('[data-temple-province] option[value="กรุงเทพมหานคร"]')).toHaveCount(1);

    const fullDataset = page.waitForResponse(
      (response) => response.url().includes("/assets/data/temples-thailand.json") && response.ok(),
    );
    await page.locator(".temple-search-button").click();
    await fullDataset;

    await expect(page.locator("[data-temple-count]")).toContainText("พบ");
    expect(dataRequests).toContain("/assets/data/temples-thailand.json");
  });
});

test("registry composition preserves row detail, paging, filters, and empty results", async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/temples/thailand/");
  await expect(page.locator(".registry-summary-row")).toHaveCount(20);
  await page.evaluate(() => document.fonts.ready);
  const hero = page.locator(".page-banner__media img");
  await expect.poll(() => hero.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.locator(".temple-table .temple-cell-3").first()).toHaveCSS("text-align", "center");
  await expect(page.locator(".temple-table .temple-cell-2").first()).toHaveCSS("text-align", "left");
  await expect(page.locator(".registry-search-input > .site-icon")).toHaveCSS("position", "absolute");
  await expect(page.locator(".registry-search-input svg")).toHaveCSS("fill", "none");
  const searchBox = await page.locator(".temple-search-button").boundingBox();
  const clearBox = await page.locator(".temple-clear-button").boundingBox();
  expect(searchBox.width).toBeGreaterThan(130);
  expect(searchBox.x + searchBox.width).toBeLessThanOrEqual(clearBox.x);
  await page.locator(".registry-source-info summary").click();
  await expect(page.locator(".registry-source-popover")).toContainText("สำนักงานพระพุทธศาสนาแห่งชาติ");
  await page.keyboard.press("Escape");
  await expect(page.locator(".registry-source-info")).not.toHaveAttribute("open");
  const toggle = page.locator(".registry-row-toggle").first();
  await toggle.click();
  await expect(page.locator("#registry-row-0")).toContainText("บุรีรัมย์");
  await expect(page.locator("#registry-row-0")).toContainText("31120");
  await toggle.click();
  await expect(page.locator("#registry-row-0")).toBeHidden();
  await fs.mkdir(".local/thailand-redesign", { recursive: true });
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: `.local/thailand-redesign/after-${isMobile ? 390 : 1440}.png`, fullPage: true, animations: "disabled" });
  const axe = await new AxeBuilder({ page }).include(".temple-directory").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.filter(item => ["serious", "critical"].includes(item.impact))).toEqual([]);
  await page.locator("[data-temple-load-all]").click();
  await expect(page.locator("[data-temple-count]")).toContainText("พบ 44,705");
  await expect(page.locator("[data-temple-load-all]")).toBeHidden();
  await page.getByRole("button", { name: "ถัดไป", exact: true }).click();
  await expect(page.getByRole("button", { name: "หน้า 2", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".registry-summary-row").first().locator("td").first()).toHaveText("21");
  await page.getByLabel("ไปหน้าที่").fill("4");
  await page.getByRole("button", { name: "ไป", exact: true }).click();
  await expect(page.locator(".registry-summary-row").first().locator("td").first()).toHaveText("61");
  const previousPage = await page.getByRole("button", { name: "ก่อนหน้า", exact: true }).boundingBox();
  const nextPage = await page.getByRole("button", { name: "ถัดไป", exact: true }).boundingBox();
  expect(previousPage.y).toBe(nextPage.y);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: `.local/thailand-redesign/results-${isMobile ? 390 : 1440}.png`, fullPage: true, animations: "disabled" });
  await page.locator("[data-temple-region]").selectOption("ภาคกลาง");
  await page.locator("[data-temple-province]").selectOption("กรุงเทพมหานคร");
  await expect(page.locator("[data-temple-district]")).toBeEnabled();
  await page.locator(".temple-search-button").click();
  await expect(page).toHaveURL(/province=/);
  await page.locator(".registry-row-toggle").first().click();
  await expect(page.locator(".registry-detail-row").first()).toContainText("กรุงเทพมหานคร");
  await page.locator("[data-temple-name]").fill("ชื่อวัดที่ไม่มีจริงสำหรับทดสอบ");
  await page.locator(".temple-search-button").click();
  await expect(page.locator(".temple-empty")).toContainText("ไม่พบวัด");
  await page.locator("[data-temple-clear]").click();
  await expect(page.locator(".registry-summary-row")).toHaveCount(20);
  await expect(page.locator("[data-temple-province]")).toBeDisabled();
  expect(new URL(page.url()).search).toBe("");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  if (!isMobile) for (const width of [320, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});

test("full dataset failure is retryable without losing draft filters", async ({ page }) => {
  let unavailable = true;
  await page.route("**/assets/data/temples-thailand.json", route => unavailable ? route.fulfill({ status: 503, body: "unavailable" }) : route.continue());
  await page.goto("/temples/thailand/");
  await expect(page.locator("[data-temple-count]")).toContainText("แสดงตัวอย่าง");
  await page.locator("[data-temple-name]").fill("บาง");
  await page.locator(".temple-search-button").click();
  await expect(page.locator("[data-temple-retry]")).toBeVisible();
  await expect(page.locator("[data-temple-name]")).toHaveValue("บาง");
  unavailable = false;
  await page.locator("[data-temple-retry]").click();
  await expect(page.locator("[data-temple-count]")).toContainText("พบ");
  await expect(page.locator(".registry-summary-row").first()).toContainText("บาง");
  await expect(page.locator("[data-temple-retry]")).toHaveCount(0);
});
