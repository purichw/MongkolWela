import { expect, test } from "@playwright/test";
import { skipIntroLoader } from "./helpers";

const siteUrl = "https://mongkolwela.vercel.app";
const indexedRoutes = [
  "/",
  "/temples/popular/",
  "/temples/mu/",
  "/temples/popular/002-ว-ดอร-ณ-กร-งเทพมหานคร/",
  "/temples/thailand/",
];

test.describe("SEO regression", () => {
  for (const route of indexedRoutes) {
    test(`metadata is complete for ${route}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "chromium-desktop", "SEO markup is browser-independent and covered once");
      await skipIntroLoader(page);
      await page.goto(route, { waitUntil: "domcontentloaded" });

      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveAttribute("href", `${siteUrl}${route}`);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/);
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /^https:\/\//);
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");

      const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
      expect(jsonLd).toBeTruthy();
      const graph = JSON.parse(jsonLd || "{}");
      expect(graph["@context"]).toBe("https://schema.org");
      expect(Array.isArray(graph["@graph"])).toBeTruthy();
    });
  }

  test("404 is noindex but keeps follow", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "SEO markup is browser-independent and covered once");
    await skipIntroLoader(page);
    await page.goto("/404.html", { waitUntil: "domcontentloaded" });

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex, follow/);
  });
});
