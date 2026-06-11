import { expect, test } from "@playwright/test";
import { collectPageErrors, keyRoutes, skipIntroLoader } from "./helpers";

test.describe("Mongkol Wela smoke regression", () => {
  for (const route of keyRoutes) {
    test(`loads ${route.path}`, async ({ page }) => {
      const errors = collectPageErrors(page);
      await skipIntroLoader(page);
      await page.goto(route.path, { waitUntil: "domcontentloaded" });

      await expect(page.locator("main")).toBeVisible();
      await expect(page.getByRole("heading", { name: route.heading }).first()).toBeVisible();

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(2);
      expect(errors).toEqual([]);
    });
  }

  test("shows first-session loader for three seconds", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "loader timing is covered once to avoid browser timing noise");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const loader = page.locator("[data-page-loader]");
    await expect(loader).toHaveAttribute("aria-hidden", "false");
    await expect(loader).toBeVisible();
    await page.waitForTimeout(2200);
    await expect(loader).toBeVisible();
    await page.waitForTimeout(1300);
    await expect(loader).toHaveAttribute("aria-hidden", "true");
  });

  test("opens and closes temple map overlay with keyboard focus", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "map interaction is covered once; route smoke covers the browser matrix");
    await skipIntroLoader(page);
    await page.goto("/temples/popular/", { waitUntil: "domcontentloaded" });

    const openButton = page.getByRole("button", { name: /เปิดแผนที่/ });
    await openButton.click();

    const dialog = page.getByRole("dialog", { name: /แผนที่สายไหว้พระ 9 วัด/ });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("searchbox", { name: /ค้นหาพิกัด/ })).toBeFocused();

    await page.getByRole("searchbox", { name: /ค้นหาพิกัด/ }).fill("วัดอรุณ");
    await expect(page.getByRole("option").first()).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(openButton).toBeFocused();
  });

  test("temple cards and map payload keep usable images", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "image data contract is covered once");
    await skipIntroLoader(page);
    await page.goto("/temples/popular/", { waitUntil: "domcontentloaded" });

    const firstCardImage = page.locator("[data-popular-temple-card] picture img").first();
    await expect(firstCardImage).toBeVisible();
    await expect(firstCardImage).toHaveAttribute("src", /^https?:\/\//);

    const mapPayload = await page.locator('script[id^="templeMapData-"]').textContent();
    const firstMapTemple = JSON.parse(mapPayload || "{}").items?.[0];
    const matchingCardImage = page.locator(
      `[data-popular-temple-card][href="${firstMapTemple.detailUrl}"] picture img`,
    );
    await expect(matchingCardImage).toHaveAttribute("src", /^https?:\/\//);
  });

  test("palmistry diagram has direct and inline critical styles", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "critical style wiring is browser-independent");
    await skipIntroLoader(page);
    await page.goto("/horoscope/palmistry/", { waitUntil: "domcontentloaded" });

    await expect(page.locator('link[href*="palmistry.css?feature=20260611-03"]')).toHaveCount(1);
    await expect(page.locator(".palm-hand-map style")).toContainText(".palm-map-line");

    const line = page.locator(".palm-map-line").first();
    await expect(line).toHaveCSS("fill", "none");
    await expect(line).not.toHaveCSS("stroke", "rgb(0, 0, 0)");
    await expect(page.getByRole("button", { name: "เส้นหลัก", exact: true })).not.toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)"
    );
  });

  test("404 keeps recovery links visible", async ({ page }) => {
    await skipIntroLoader(page);
    await page.goto("/404.html", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/404\.html/);
    await expect(page.getByRole("heading", { name: /เส้นทางนี้ไม่มีอยู่ในมงคลเวลาแล้ว/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /กลับหน้าแรก/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "วัดทั่วประเทศไทย", exact: true })).toBeVisible();
  });
});
