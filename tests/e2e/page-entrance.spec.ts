import { expect, test } from "@playwright/test";
import fs from "node:fs";

test.beforeEach(async ({ page }) => {
  const content = JSON.parse(fs.readFileSync("public/admin/content/live.json", "utf8"));
  await page.route("**/api/admin/content*", route => route.fulfill({ json: { ok: true, content } }));
  // Network-independent lifecycle checks; real fonts are checked separately in browser QA.
  await page.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
  await page.addInitScript(() => {
    localStorage.setItem("mongkolwela.pdpa.analytics", "declined");
  });
});

test("shared entry waits for fonts on Home, temples and tools, then fades once", async ({ page }) => {
  await page.addInitScript(() => {
    const ready = new Promise(resolve => { (window as any).releaseFonts = resolve; });
    document.fonts.load = (() => ready) as any;
    document.addEventListener("animationstart", event => {
      if (event.animationName !== "page-content-enter" || (event.target as Element).tagName !== "MAIN") return;
      (window as any).entryStart = {
        bodyOpacity: Number(getComputedStyle(document.body).opacity),
        loaderOpacity: Number(getComputedStyle(document.querySelector("[data-page-loader]")!).opacity),
      };
    });
  });
  for (const path of ["/", "/temples/popular/", "/horoscope/thai-astrology/"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(/page-fonts-pending/);
    await expect(page.locator("main")).toHaveCSS("opacity", "0");
    await expect(page.locator("main")).toHaveCSS("visibility", "hidden");
    await expect(page.locator("html")).toHaveClass(/is-font-loading/);
    await expect(page.locator("[data-page-loader]")).toHaveCSS("opacity", "1");
    await page.evaluate(() => (window as any).releaseFonts());
    await expect(page.locator("html")).toHaveClass(/page-fonts-ready/);
    await expect.poll(() => page.evaluate(() => (window as any).entryStart?.bodyOpacity)).toBe(1);
    expect(await page.evaluate(() => (window as any).entryStart.loaderOpacity)).toBeGreaterThan(0);
    await expect(page.locator("main")).toHaveCSS("animation-duration", "0.8s");
    await expect(page.locator("main")).toHaveCSS("opacity", "1");
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("[data-page-loader]")).toHaveAttribute("aria-hidden", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});

test("a fast font response does not flash the loading screen", async ({ page }) => {
  const now = new Date();
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now);
  await page.addInitScript(() => {
    (window as any).fontLoaderShown = false;
    new MutationObserver(() => {
      if (document.documentElement.classList.contains("is-font-loading")) (window as any).fontLoaderShown = true;
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["class"] });
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/page-fonts-ready/);
  await page.clock.runFor(1000);
  expect(await page.evaluate(() => (window as any).fontLoaderShown)).toBe(false);
});

test("a pending decorative image cannot block the ready page", async ({ page }) => {
  let releaseImage!: () => void;
  const imageReady = new Promise<void>(resolve => { releaseImage = resolve; });
  await page.route(/(?:\/|%2F)stupa[.]/, async route => {
    await imageReady;
    await route.abort();
  });
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(/page-fonts-ready/);
    // Cross the slow-load threshold while an eager loader image is still pending.
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => document.readyState)).toBe("interactive");
    await expect(page.locator("html")).not.toHaveClass(/\bis-loading\b/);
    await expect(page.locator("[data-page-loader]")).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator("#hero-title")).toBeVisible();
  } finally {
    releaseImage();
  }
});

test("indefinitely pending fonts offer recovery instead of revealing an unfinished page", async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    document.fonts.load = () => new Promise(() => {});
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.clock.runFor(31000);
  await expect(page.locator("html")).toHaveClass(/page-fonts-pending/);
  await expect(page.locator("[data-page-recovery]")).toBeVisible();
  await expect(page.getByRole("button", { name: "ลองโหลดใหม่" })).toBeVisible();
  await expect(page.locator("main")).toHaveCSS("opacity", "0");
});

test("lazy images fade through intermediate frames without changing card geometry", async ({ page }) => {
  let releaseImage!: () => void;
  const imageReady = new Promise<void>(resolve => { releaseImage = resolve; });
  await page.route("**/home-intent-wealth.webp", async route => {
    await imageReady;
    await route.fulfill({ path: "public/assets/images/home-intent-wealth.webp", contentType: "image/webp" });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const image = page.locator("#home-intent-wealth");
  await image.scrollIntoViewIfNeeded();
  await expect(page.locator("main")).toHaveCSS("opacity", "1");
  const before = await image.boundingBox();
  await image.evaluate(element => {
    element.addEventListener("load", () => {
      element.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = 0; });
    }, { once: true });
  });
  releaseImage();
  await expect.poll(() => image.evaluate(element => element.getAnimations().length)).toBe(1);
  const frames = await image.evaluate(element => {
    const animation = element.getAnimations()[0];
    return [0, 200, 400, 800].map(time => {
      animation.currentTime = time;
      return Number(getComputedStyle(element).opacity);
    });
  });
  expect(frames[0]).toBe(0);
  expect(frames[1]).toBeGreaterThan(0);
  expect(frames[1]).toBeLessThan(frames[2]);
  expect(frames[2]).toBeLessThan(1);
  expect(frames[3]).toBe(1);
  const after = await image.boundingBox();
  expect(after!.width).toBe(before!.width);
  expect(after!.height).toBe(before!.height);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => image.evaluate(element => element.getAnimations().length)).toBe(0);
  await expect(image).toHaveCSS("opacity", "1");
  // Responsive/CMS src changes must not rewind a previously displayed image.
  await image.evaluate(element => element.dispatchEvent(new Event("load")));
  expect(await image.evaluate(element => element.getAnimations().length)).toBe(0);
});

test("reduced motion stays readable without page or Home entrance animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("#hero-title")).toBeVisible();
  await expect(page.locator("main")).toHaveCSS("animation-name", "none");
  await page.locator("#collections").scrollIntoViewIfNeeded();
  await expect(page.locator(".home-collection-card").first()).toHaveCSS("opacity", "1");
  await expect(page.locator(".home-collection-card").first()).toHaveCSS("animation-name", "none");
});

test("without JavaScript public content remains visible", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
  await page.goto(baseURL!);
  await expect(page.locator("html")).not.toHaveClass(/page-fonts-pending/);
  await expect(page.locator("#hero-title")).toBeVisible();
  await page.locator("#collections").scrollIntoViewIfNeeded();
  await expect(page.locator(".home-collection-card").first()).toHaveCSS("opacity", "1");
  await context.close();
});
