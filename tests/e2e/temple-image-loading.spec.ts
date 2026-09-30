import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import { sitePlaceholderImage } from "../../src/lib/image-placeholder.js";

const cardSelector = "[data-popular-temple-card]";
const seedContent = JSON.parse(fs.readFileSync("public/admin/content/live.json", "utf8"));

async function watchVisibleCards(page: Page) {
  await page.evaluate(selector => {
    const cards = [...document.querySelectorAll<HTMLElement>(selector)].filter(card => !card.hidden);
    const events: { type: string; time: number; value?: unknown }[] = [];
    const started = performance.now();
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === "childList") {
          for (const node of record.removedNodes) {
            if (cards.includes(node as HTMLElement)) events.push({ type: "card-moved", time: performance.now() - started });
          }
        } else if ((record.target instanceof HTMLImageElement || record.target instanceof HTMLSourceElement) && cards.includes(record.target.closest(selector) as HTMLElement)) {
          events.push({ type: "image-source-written", time: performance.now() - started, value: record.attributeName });
        }
      }
    });
    observer.observe(cards[0].parentElement!, { subtree: true, childList: true, attributes: true, attributeFilter: ["src", "srcset"] });
    let running = true;
    let minimumOpacity = 1;
    const sample = () => {
      if (!running) return;
      for (const card of cards) {
        const opacity = card.hidden ? 0 : Number(getComputedStyle(card).opacity);
        minimumOpacity = Math.min(minimumOpacity, opacity);
      }
      requestAnimationFrame(sample);
    };
    sample();
    (window as any).__cardLoadingProbe = {
      stop() {
        running = false;
        observer.disconnect();
        return { minimumOpacity, events, sameNodes: cards.every(card => card.isConnected) };
      },
    };
  }, cardSelector);
}

for (const collection of ["popular", "sacred", "mu"]) {
  for (const width of [1440, 390]) {
    test(`visible images stay painted through delayed catalog and CMS: ${collection} ${width}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 960 });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
      const content = structuredClone(seedContent);
      content.temples = { records: {} };
      let releaseCatalog!: () => void;
      let releaseCms!: () => void;
      const catalogReady = new Promise<void>(resolve => { releaseCatalog = resolve; });
      const cmsReady = new Promise<void>(resolve => { releaseCms = resolve; });
      await page.route(`**/assets/data/temple-collections/${collection}.json?*`, async route => {
        await catalogReady;
        await route.continue();
      });
      await page.route("**/api/admin/content?*", async route => {
        await cmsReady;
        await route.fulfill({ json: { ok: true, content } });
      });
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`/temples/${collection}/`, { waitUntil: "domcontentloaded" });
      const first = page.locator(cardSelector).first();
      await first.evaluate(card => window.scrollTo(0, card.getBoundingClientRect().top + scrollY - 210));
      await expect(page.locator("html")).toHaveClass(/page-fonts-ready/);
      await expect.poll(() => first.evaluate(card => {
        const image = card.querySelector("img")!;
        return image.complete && image.naturalWidth > 0 && image.getAnimations().length === 0 && getComputedStyle(card).opacity === "1";
      })).toBe(true);
      // Wait for the last staggered card as well, not just the first image.
      await expect.poll(() => page.locator(`${cardSelector}:visible`).evaluateAll(cards => cards.every(card => getComputedStyle(card).opacity === "1"))).toBe(true);
      const published = await first.evaluate(card => ({
        key: card.getAttribute("data-temple-key")!,
        desktop: card.querySelector("img")!.getAttribute("src"),
        mobile: card.querySelector("source")?.getAttribute("srcset") || card.querySelector("img")!.getAttribute("src"),
      }));
      content.temples.records[published.key] = { enabled: true, status: "published", images: { card: { desktop: { url: published.desktop }, mobile: { url: published.mobile } } } };
      await watchVisibleCards(page);
      await page.screenshot({ path: testInfo.outputPath("before-hydration.png") });
      releaseCatalog();
      await expect.poll(() => page.locator(cardSelector).count()).toBeGreaterThan(8);
      await page.waitForTimeout(100);
      await page.screenshot({ path: testInfo.outputPath("catalog-100ms.png") });
      await page.waitForTimeout(900);
      releaseCms();
      await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
      await page.waitForTimeout(100);
      await page.screenshot({ path: testInfo.outputPath("cms-100ms.png") });
      await page.waitForTimeout(900);
      const result = await page.evaluate(() => (window as any).__cardLoadingProbe.stop());
      await testInfo.attach("loading-timeline", { body: JSON.stringify(result, null, 2), contentType: "application/json" });
      expect.soft(result.minimumOpacity, "visible cards must not fade out when data arrives").toBe(1);
      expect.soft(result.events, "unchanged card order and image sources must not be rewritten").toEqual([]);
      expect.soft(result.sameNodes).toBe(true);
      expect.soft(errors).toEqual([]);

      await watchVisibleCards(page);
      await page.locator("[data-popular-temple-more]").click();
      await expect(page.locator(`${cardSelector}:visible`)).toHaveCount(width > 600 ? 32 : 12);
      await page.waitForTimeout(900);
      const more = await page.evaluate(() => (window as any).__cardLoadingProbe.stop());
      expect.soft(more.minimumOpacity, "load more must preserve the existing batch").toBe(1);
      expect.soft(more.events).toEqual([]);
      await page.evaluate(() => (window as any).MongkolWelaCMS.applyTempleOverrides());
      await expect(page.locator(`${cardSelector}:visible`)).toHaveCount(width > 600 ? 32 : 12);
    });
  }
}

for (const width of [1440, 390]) {
  test(`published image changes and clears still apply at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    const content = structuredClone(seedContent);
    content.temples = { records: {} };
    await page.route("**/api/admin/content?*", route => route.fulfill({ json: { ok: true, content } }));
    await page.goto("/temples/popular/");
    await expect(page.locator("[data-popular-temple-count]")).toContainText("243");
    await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
    const first = page.locator(cardSelector).first();
    await first.scrollIntoViewIfNeeded();
    const original = await first.evaluate(card => ({
      key: card.getAttribute("data-temple-key")!,
      desktop: card.querySelector("img")!.getAttribute("src")!,
      mobile: card.querySelector("source")?.getAttribute("srcset") || card.querySelector("img")!.getAttribute("src")!,
    }));
    // Exercise the responsive picture variant even when this seed uses one URL.
    await first.locator("picture").evaluate((picture, src) => {
      if (picture.querySelector("source")) return;
      const source = document.createElement("source");
      source.media = "(max-width: 767px)";
      source.setAttribute("data-temple-mobile-source", "");
      source.srcset = src;
      picture.prepend(source);
    }, original.mobile);
    const record = { enabled: true, status: "published", fields: { imageAlt: "ภาพเผยแพร่ใหม่" }, images: { card: {
      desktop: { url: `${original.desktop}?cms-image=updated` },
      mobile: { url: `${original.mobile}?cms-image=updated` },
    } } };
    content.temples.records[original.key] = record;
    await page.evaluate(async () => (window as any).MongkolWelaCMS.reload());
    await expect(first.locator("img")).toHaveAttribute("src", record.images.card.desktop.url);
    await expect(first.locator("source")).toHaveAttribute("srcset", record.images.card.mobile.url);
    await expect(first.locator("img")).toHaveAttribute("alt", record.fields.imageAlt);
    await expect.poll(() => first.locator("img").evaluate(image => image.complete && image.naturalWidth > 0 && image.currentSrc.includes("cms-image=updated"))).toBe(true);
    await watchVisibleCards(page);
    await page.evaluate(() => (window as any).MongkolWelaCMS.applyTempleOverrides());
    await page.waitForTimeout(100);
    const repeated = await page.evaluate(() => (window as any).__cardLoadingProbe.stop());
    expect(repeated.events).toEqual([]);
    expect(repeated.minimumOpacity).toBe(1);
    record.images.card.desktop.url = "";
    record.images.card.mobile.url = "";
    await page.evaluate(async () => (window as any).MongkolWelaCMS.reload());
    await expect(first.locator("img")).toHaveAttribute("src", sitePlaceholderImage);
    await expect.poll(() => first.locator("img").evaluate(image => image.complete && image.naturalWidth > 0 && image.currentSrc.endsWith("site-placeholder-camera-20260923.webp"))).toBe(true);
  });
}
