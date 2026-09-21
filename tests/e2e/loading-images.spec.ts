import { expect, test } from "@playwright/test";

const iconNames = [
  "temple", "stupa", "incense", "lotus", "amulet",
  "altar", "gate", "sacred-thread", "candle", "temple-map",
];

test.beforeEach(async ({ page }) => {
  await page.route("**/api/admin/content*", (route) => route.fulfill({
    path: "public/admin/content/live.json",
    contentType: "application/json",
  }));
});

test("loading images preserve the existing animation and release behavior", async ({ page }, testInfo) => {
  await page.goto("/", { waitUntil: "load" });
  const loader = page.locator("[data-page-loader]");
  await expect(loader).toHaveAttribute("aria-hidden", "true", { timeout: 1000 });
  await expect(loader.locator("svg")).toHaveCount(0);

  const icons = loader.locator(".loader-vector-icon");
  await expect(icons).toHaveCount(iconNames.length);
  for (let index = 0; index < iconNames.length; index += 1) {
    const icon = icons.nth(index);
    const source = new URL((await icon.getAttribute("src"))!, page.url());
    if (source.pathname === "/_image") {
      expect(source.searchParams.get("href")).toMatch(new RegExp(`/${iconNames[index]}\\.png(?:\\?|$)`));
      expect(source.searchParams.get("f")).toBe("webp");
    } else {
      expect(source.pathname).toMatch(new RegExp(`/${iconNames[index]}\\..*\\.webp$`));
    }
    await expect(icon).toHaveCSS("animation-name", "loader-icon-cycle");
    await expect(icon).toHaveCSS("animation-duration", "8.2s");
    await expect(icon).toHaveCSS("animation-delay", `${Number((index * 0.82).toFixed(2))}s`);
    await expect(icon).toHaveCSS("mix-blend-mode", "multiply");
    expect(await icon.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  }

  const rings = await page.locator(".loader-icon-stage").evaluate((stage) =>
    ["::before", "::after"].map((pseudo) => {
      const style = getComputedStyle(stage, pseudo);
      return [style.animationName, style.animationDuration, style.animationDirection];
    }),
  );
  expect(rings).toEqual([
    ["loader-ring-turn", "7.5s", "normal"],
    ["loader-ring-turn", "11s", "reverse"],
  ]);

  // Hold the shared loader at a repeatable frame for visual inspection only.
  await page.evaluate(() => {
    document.documentElement.classList.add("is-loading");
    document.querySelector("[data-page-loader]")!.getAnimations({ subtree: true }).forEach((animation) => {
      animation.pause();
      animation.currentTime = 410;
    });
  });
  await expect(loader).toHaveCSS("opacity", "1");
  await expect(icons.first()).toHaveCSS("opacity", "0.92");
  await page.screenshot({ path: testInfo.outputPath("loading-images.png") });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(icons.first()).toHaveCSS("animation-name", "none");
  await expect(icons.first()).toHaveCSS("opacity", "0.9");
  await expect(icons.nth(1)).toHaveCSS("opacity", "0");
});
