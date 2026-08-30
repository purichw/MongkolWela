import { expect, test } from "@playwright/test";
import { skipIntroLoader } from "./helpers";

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
