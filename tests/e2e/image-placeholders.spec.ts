import { expect, test, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { sitePlaceholderImage } from "../../src/lib/image-placeholder.js";

const seed = JSON.parse(readFileSync("public/admin/content/live.json", "utf8"));
const detailRoute = "/temples/popular/001-ว-ดระฆ-งโฆส-ตาราม-กร-งเทพมหานคร/";
const realImage = "/assets/images/temple-guide-visit-prep.jpg";
const brokenImage = "/assets/images/placeholder-qa-missing.jpg";

async function expectPlaceholder(image: Locator) {
  await expect(image).toHaveAttribute("src", sitePlaceholderImage);
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1536);
  await expect(image).toHaveCSS("object-fit", "cover");
  await expect(image).toHaveCSS("filter", "none");
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
  await page.route("**/api/admin/content?**", route => route.fulfill({ json: { ok: true, content: seed } }));
  await page.route("**/assets/images/placeholder-qa-missing*", route => route.fulfill({ status: 404, body: "" }));
});

test("collection placeholders render the supplied artwork without the striped overlay", async ({ page }, info) => {
  await page.goto("/temples/sacred/");
  await page.locator(".mw-header[data-header-ready]").waitFor();
  await page.evaluate(() => document.fonts.ready);
  const real = page.locator("[data-popular-temple-card] img").first();
  const original = await real.getAttribute("src");
  await expect(real).not.toHaveAttribute("src", sitePlaceholderImage);
  await page.locator("[data-popular-temple-more]").click();
  const card = page.locator('[data-popular-temple-card][data-rank="11"]');
  await expectPlaceholder(card.locator("img"));
  expect(await card.locator("figure").evaluate(el => getComputedStyle(el, "::before").content)).toBe("none");
  await expect(real).toHaveAttribute("src", original!);
  await expect(real).toHaveCSS("filter", "none");
  await card.screenshot({ path: info.outputPath("collection-placeholder.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("activities and products share artwork for missing and failed images", async ({ page }, info) => {
  const images = ["", brokenImage, realImage];
  await page.route("**/api/temple-activities?**", route => route.fulfill({ json: {
    ok: true, revision: "placeholder-qa",
    events: images.map((imageUrl, i) => ({
      id: `qa-event-${i}`, title: `กิจกรรมทดสอบ ${i + 1}`, type: "ceremony",
      status: "published", past: false, startDate: "2030-11-10", timeMode: "allDay",
      venue: "สถานที่ทดสอบ", imageUrl, imageAlt: "ภาพกิจกรรมทดสอบ",
    })),
  } }));
  await page.route("**/api/commerce?**", route => route.fulfill({ json: {
    ok: true, organizations: [{ id: "qa-org", name: "ร้านทดสอบ" }],
    products: images.map((imageUrl, i) => ({
      id: `qa-product-${i}`, orgId: "qa-org", title: `สินค้าทดสอบ ${i + 1}`,
      imageUrl, imageAlt: "ภาพสินค้าทดสอบ", priceSatang: 10000, available: 2,
    })),
    campaigns: [], channels: [], directoryUrl: "https://data.rd.go.th/",
  } }));
  await page.goto(detailRoute);
  const activities = page.locator("[data-activity-image]");
  const products = page.locator(".temple-shop-media img");
  await expect(activities).toHaveCount(3);
  await expect(products).toHaveCount(3);
  for (const list of [activities, products]) {
    await expectPlaceholder(list.nth(0));
    await expectPlaceholder(list.nth(1));
    await expect(list.nth(2)).toHaveAttribute("src", realImage);
  }
  await page.locator("[data-temple-commerce]").screenshot({ path: info.outputPath("product-placeholders.png") });
  await page.locator("[data-temple-activities]").screenshot({ path: info.outputPath("activity-placeholders.png") });
});

test("responsive errors recover across CMS updates and legacy placeholders migrate", async ({ page }) => {
  await page.goto("/");
  await page.locator(".mw-header[data-header-ready]").waitFor();
  const image = page.locator("img[data-cms-media]").first();
  const before = await image.evaluate(img => img.clientHeight);
  await image.evaluate((img: HTMLImageElement, broken) => {
    const picture = document.createElement("picture");
    img.before(picture);
    const source = document.createElement("source");
    source.srcset = broken;
    picture.append(source, img);
    img.srcset = broken;
    img.src = broken;
  }, brokenImage);
  await expectPlaceholder(image);
  await expect(image).not.toHaveAttribute("srcset");
  await expect(image.locator("..").locator("source")).not.toHaveAttribute("srcset");
  expect(await image.evaluate(img => img.clientHeight)).toBe(before);
  await image.evaluate((img: HTMLImageElement, real) => { img.src = real; }, realImage);
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await image.evaluate((img: HTMLImageElement, broken) => { img.src = broken; }, brokenImage + "?second");
  await expectPlaceholder(image);
  await image.evaluate((img: HTMLImageElement) => { img.src = "/assets/images/temple-placeholder-auspicious.png"; });
  await expectPlaceholder(image);
});

test("a failed placeholder does not loop or replace unrelated icons", async ({ page }) => {
  await page.goto("/");
  await page.locator(".mw-header[data-header-ready]").waitFor();
  let requests = 0;
  await page.route(`**${sitePlaceholderImage}`, route => {
    requests += 1;
    return route.fulfill({ status: 404, body: "" });
  });
  const logo = page.locator(".mw-header img").first();
  const originalLogo = await logo.getAttribute("src");
  const image = page.locator("img[data-cms-media]").first();
  await image.evaluate((img: HTMLImageElement, src) => { img.src = src; }, brokenImage);
  await expect(image).toHaveAttribute("src", sitePlaceholderImage);
  await expect.poll(() => requests).toBe(1);
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete)).toBe(true);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(requests).toBe(1);
  await expect(logo).toHaveAttribute("src", originalLogo!);
});
