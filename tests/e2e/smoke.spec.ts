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

  test("releases the loader when the page is ready without a first-session delay", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "loader timing is covered once to avoid browser timing noise");
    await page.goto("/", { waitUntil: "load" });
    const loader = page.locator("[data-page-loader]");
    await expect(loader).toHaveAttribute("aria-hidden", "true", { timeout: 1000 });
  });

  test("opens and closes temple map overlay with keyboard focus", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "map interaction is covered once; route smoke covers the browser matrix");
    await skipIntroLoader(page);
    await page.goto("/temples/popular/", { waitUntil: "domcontentloaded" });

    const openButton = page.getByRole("button", { name: /เปิดแผนที่/ });
    await openButton.click();

    const dialog = page.getByRole("dialog", { name: /แผนที่วัดดังน่าไป/ });
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
    const matchingCardImage = page
      .locator("[data-popular-temple-card]")
      .filter({ has: page.locator(`[data-popular-temple-detail][href="${firstMapTemple.detailUrl}"]`) })
      .locator("picture img");
    await expect(matchingCardImage).toHaveAttribute("src", /^https?:\/\//);
  });

  test("palmistry diagram and two-hand reading stay interactive", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "critical style wiring is browser-independent");
    await skipIntroLoader(page);
    await page.goto("/horoscope/palmistry/", { waitUntil: "domcontentloaded" });

    await expect(page.locator('link[href*="palmistry"]')).toHaveCount(1);
    await expect(page.locator(".palm-hand-map style")).toContainText(".palm-map-line");

    const leftCameraInput = page.locator(
      '[data-photo-input="left"][data-photo-source="camera"]',
    );
    const leftLibraryInput = page.locator(
      '[data-photo-input="left"][data-photo-source="library"]',
    );
    await expect(leftCameraInput).toHaveAttribute("capture", "environment");
    await expect(leftLibraryInput).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
    await page.locator('[data-photo-trigger="left"][data-photo-source="camera"]').click();
    await expect(page.locator('[data-camera-panel]')).toBeVisible();
    await expect(page.locator('[data-camera-message]')).toContainText("กำลังขอสิทธิ์");
    await expect(page.locator('[data-camera-capture]')).toBeDisabled();
    await page.locator('[data-camera-cancel]').click();
    await expect(page.locator('[data-camera-panel]')).toBeHidden();
    await leftLibraryInput.setInputFiles({
      name: "left-palm.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2Z84AAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await expect(page.locator('[data-photo-preview="left"]')).toBeVisible();
    await expect(page.locator('[data-photo-state="left"]')).toHaveText("left-palm.png");
    await page.locator('[data-photo-rotate="left"]').click();
    await expect(page.locator('[data-photo-preview="left"]')).toHaveAttribute(
      "style",
      /rotate\(90deg\)/,
    );
    await page.locator('[data-photo-remove="left"]').click();
    await expect(page.locator('[data-photo-preview="left"]')).toBeHidden();

    const line = page.locator(".palm-map-line").first();
    await expect(line).toHaveCSS("fill", "none");
    await expect(line).not.toHaveCSS("stroke", "rgb(0, 0, 0)");
    await expect(page.getByRole("button", { name: "เส้นหลัก", exact: true })).not.toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)"
    );

    const sourceDisclosure = page.locator(".palm-source-disclosure");
    await expect(sourceDisclosure).not.toHaveAttribute("open", "");
    await sourceDisclosure.getByText("แหล่งข้อมูลที่ใช้ยืนยัน", { exact: true }).click();
    await expect(sourceDisclosure).toHaveAttribute("open", "");
    await expect(sourceDisclosure.locator("a")).toHaveCount(9);

    await page.getByRole("button", { name: "เทียบสองมือ" }).click();
    await expect(page.locator("[data-plw-context]")).toContainText("เทียบสองมือ");

    await page.locator('[data-variant="long_clear"] [data-select-hand="nonDominant"]').click();
    await page.locator('[data-variant="broken"] [data-select-hand="dominant"]').click();

    await expect(page.locator(".plw-comparison-result")).toContainText("อ่อนลงในมือถนัด");
    await expect(page.locator(".plw-formula")).toContainText("พัฒนาการของเส้นชีวิต");

    await page.getByRole("button", { name: "ถนัดซ้าย" }).click();
    await expect(page.locator("[data-plw-context]")).toContainText("มือขวา · มือไม่ถนัด");
    await expect(page.locator("[data-plw-context]")).toContainText("มือซ้าย · มือถนัด");
  });

  test("404 keeps recovery links visible", async ({ page }) => {
    await skipIntroLoader(page);
    await page.goto("/404.html", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/404\.html/);
    await expect(page.getByRole("heading", { name: /เส้นทางนี้ไม่มีอยู่ในมงคลเวลาแล้ว/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /กลับหน้าแรก/ })).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: "วัดทั่วประเทศไทย", exact: true })).toBeVisible();
  });
});
