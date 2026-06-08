import { expect, test } from "@playwright/test";
import { watArunPopularRoute } from "../../src/data/nfr-key-routes.js";
import { stabilizeVisuals } from "./helpers";

const routes = [
  { name: "home", path: "/" },
  { name: "popular", path: "/temples/popular/" },
  { name: "mu", path: "/temples/mu/" },
  { name: "detail", path: watArunPopularRoute },
  { name: "not-found", path: "/404.html" }
];

test.describe("Visual regression", () => {
  for (const route of routes) {
    test(`${route.name} viewport`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "chromium-desktop", "visual baselines run in Chromium desktop to keep snapshots stable");
      await stabilizeVisuals(page);
      await page.route("**/*", (requestRoute) => {
        const request = requestRoute.request();
        const url = new URL(request.url());
        if (request.resourceType() === "image" && url.origin !== "http://127.0.0.1:4324") {
          requestRoute.abort();
          return;
        }
        requestRoute.continue();
      });
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("body")).toHaveScreenshot(`${route.name}.png`, {
        fullPage: false,
        animations: "disabled",
        mask: [page.locator(".topbar"), page.locator("[data-scroll-progress]")]
      });
    });
  }
});
