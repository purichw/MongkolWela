import { expect, test } from "@playwright/test";
import fs from "node:fs";
import AxeBuilder from "@axe-core/playwright";

const content = JSON.parse(fs.readFileSync("public/admin/content/live.json", "utf8"));
const storageKey = "mongkolwela.travel-guide.checklist.v1";

async function revealChecklist(page) {
  const disclosure = page.locator("[data-travel-checklist] > details");
  if (!await disclosure.evaluate(node => node.open)) await disclosure.locator("summary").click();
}

async function ready(page) {
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
  await expect(page.locator("[data-page-loader]")).toBeHidden();
  await page.evaluate(async () => {
    await document.fonts.ready;
    const images = [...document.querySelectorAll("img")];
    images.forEach(image => { image.loading = "eager"; });
    await Promise.all(images.map(image => image.decode().catch(() => {})));
  });
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/admin/content?*", route => route.fulfill({ json: { ok: true, content } }));
  await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
});

for (const width of [1440, 390]) {
  test(`guide entry, links and checklist work at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/temples/");
    const entry = page.locator("[data-header-utility-links]").getByRole("link", { name: "คู่มือวางแผนเดินทางมงคล" });
    await expect(entry).toHaveAttribute("href", "/guide/");
    await entry.click();
    await expect(page).toHaveURL(/\/guide\/$/);
    await expect(page.locator("h1")).toHaveText("คู่มือวางแผนเดินทางมงคล");
    await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    for (const href of ["/temples/popular/", "/temples/sacred/", "/temples/mu/", "/search/", "/calendar/", "/calendar/day/", "/temples/planner/"]) {
      await expect(page.locator(`main a[href="${href}"]`).first()).toBeAttached();
    }
    await page.getByRole("navigation", { name: "ขั้นตอนวางแผนเดินทาง" }).getByRole("link", { name: /จัดเส้นทาง/ }).click();
    await expect(page).toHaveURL(/#guide-route$/);
    await expect.poll(() => page.locator("#guide-route").evaluate(element => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(64);

    const checks = page.locator("[data-travel-checklist] input");
    await revealChecklist(page);
    await checks.first().check();
    await checks.nth(2).check();
    await expect(page.locator("[data-guide-count]")).toHaveText("2 / 6");
    await page.reload();
    await revealChecklist(page);
    await expect(checks.first()).toBeChecked();
    await expect(checks.nth(2)).toBeChecked();
    await expect(checks.nth(1)).not.toBeChecked();
    for (const checkbox of await checks.all()) await checkbox.check();
    await expect(page.locator("[data-guide-count]")).toHaveText("6 / 6");
    await expect(page.locator("[data-guide-complete]")).toBeVisible();
    await page.getByRole("button", { name: "ล้างรายการ" }).click();
    await expect(page.locator("[data-guide-count]")).toHaveText("0 / 6");
    await expect(checks.first()).toBeFocused();
    await expect(page.locator("[data-guide-complete]")).toBeHidden();
    expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBeNull();

    const faq = page.locator(".guide-faq details").first();
    await faq.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(faq).toHaveAttribute("open", "");
    await expect(faq.locator("p")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(faq).not.toHaveAttribute("open", "");
    expect(errors).toEqual([]);
    await page.locator(".guide-planner-action a").click();
    await expect(page).toHaveURL(/\/temples\/planner\/$/);
  });
}

test("malformed checklist data does not break the guide", async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, "invalid json"), storageKey);
  await page.goto("/guide/");
  await expect(page.locator("[data-guide-count]")).toHaveText("0 / 6");
  await page.locator("[data-travel-checklist] input").first().check();
  await expect(page.locator("[data-guide-count]")).toHaveText("1 / 6");
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), storageKey)).toEqual(["hours"]);
});

test("checklist remains usable when saving is unavailable", async ({ page }) => {
  await page.addInitScript(key => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException("Unavailable", "QuotaExceededError");
      return setItem.call(this, name, value);
    };
  }, storageKey);
  await page.goto("/guide/");
  await page.locator("[data-travel-checklist] input").first().check();
  await expect(page.locator("[data-guide-count]")).toHaveText("1 / 6");
  await expect(page.locator("[data-guide-storage-note]")).toContainText("ยังบันทึกบนอุปกรณ์ไม่ได้");
});

test("guide content and navigation render without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${baseURL}/guide/`);
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator(".guide-chapter")).toHaveCount(4);
  await expect(page.locator("[data-guide-progress]")).toBeHidden();
  await page.evaluate(() => document.fonts.ready);
  const summary = page.locator(".guide-faq summary").first();
  await summary.scrollIntoViewIfNeeded();
  await expect(summary).toBeInViewport();
  await summary.click();
  await expect(page.locator(".guide-faq details").first().locator("p")).toBeVisible();
  expect(await page.locator(".guide-checklist input").count()).toBe(6);
  await expect(page.locator("[data-travel-checklist] input").first()).toBeVisible();
  await expect(page.locator(".guide-route-steps")).toBeVisible();
  await context.close();
});

test("guide composition, sticky anchors and responsive disclosures remain accessible", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/guide/");
  await ready(page);
  fs.mkdirSync("artifacts/travel-guide", { recursive: true });
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), { message: `overflow at ${width}` }).toBe(true);
    const summary = page.locator("[data-travel-checklist] > details");
    await expect(summary).toHaveJSProperty("open", width > 900);
    if (width === 1440 || width === 390) {
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      await page.screenshot({ path: `artifacts/travel-guide/guide-${width}.png`, fullPage: true, animations: "disabled" });
      await page.screenshot({ path: `artifacts/travel-guide/guide-${width}-top.png`, animations: "disabled" });
      const axe = await new AxeBuilder({ page }).include("main.travel-guide").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(axe.violations).toEqual([]);
      if (width === 1440) {
        await page.locator('.guide-step-nav a[href="#guide-route"]').click();
        await expect.poll(async () => {
          const checklist = await page.locator("#guide-checklist").boundingBox();
          const route = await page.locator("#guide-route").boundingBox();
          const nav = await page.locator(".guide-step-nav").boundingBox();
          return route.y <= nav.y + nav.height + 80 && checklist.y + checklist.height <= route.y + 1;
        }, { message: "sticky checklist must stop before the full-width third chapter" }).toBe(true);
        await page.screenshot({ path: "artifacts/travel-guide/guide-1440-scrolled.png", animations: "disabled" });
      }
    }
    await page.locator('.guide-step-nav a[href="#guide-date"]').click();
    await expect.poll(async () => {
      const nav = await page.locator(".guide-step-nav").boundingBox();
      const chapter = await page.locator("#guide-date").boundingBox();
      return chapter.y >= nav.y + nav.height && chapter.y <= nav.y + nav.height + 80;
    }).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const preparation = page.locator(".guide-etiquette > details").first();
  await expect(preparation.locator("p")).toBeHidden();
  await preparation.locator("summary").press("Enter");
  await expect(preparation.locator("p")).toBeVisible();
  await preparation.locator("summary").press("Enter");
  await page.locator('.guide-text-link[href="#guide-checklist"]').click();
  await expect(page.locator("[data-travel-checklist] > details")).toHaveJSProperty("open", true);
  await page.locator("[data-travel-checklist] input").first().check();
  await expect(page.locator("[data-guide-percent]")).toHaveText("17%");
  await page.locator(".guide-checklist__heading").press("Enter");
  await expect(page.locator(".guide-checklist__body")).toBeHidden();
  await expect(page.locator("[data-guide-count]")).toBeVisible();
  await expect(page.locator("[data-guide-count]")).toHaveText("1 / 6");
  const images = await page.locator("main img").evaluateAll(nodes => nodes.map(image => ({ src: image.getAttribute("src"), loaded: image.complete && image.naturalWidth > 0 })));
  expect(images.every(image => image.loaded), JSON.stringify(images)).toBe(true);
  expect(errors).toEqual([]);
});

test("existing CMS text slots and new images refresh without resetting the checklist", async ({ page }) => {
  const published = structuredClone(content);
  const guide = published.pages.find(item => item.id === "travelGuide");
  await page.route("**/api/admin/content?*", route => route.fulfill({ json: { ok: true, content: published } }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/guide/");
  await ready(page);
  await revealChecklist(page);
  const firstCheck = page.locator("[data-travel-checklist] input").first();
  await firstCheck.check();
  await page.locator(".guide-checklist__heading").click();
  guide.patches = [
    { id: "heading", kind: "text-node", selector: '[data-cms-field="e74aa090-4"][data-cms-occurrence="0"]', nodeIndex: 0, value: "คู่มือจาก CMS" },
    { id: "collection", kind: "text-node", selector: '[data-cms-field="e74aa090-11"][data-cms-occurrence="1"]', nodeIndex: 0, value: "วัดขอพรจาก CMS" },
    { id: "packing", kind: "text-node", selector: '[data-cms-field="guide-packing-title"]', nodeIndex: 0, value: "เตรียมของจาก CMS" },
    { id: "image", kind: "image", selector: "#travel-guide-popular-image", src: "/assets/images/hero-songkhla-buddha.webp", alt: "ภาพเลือกจาก CMS", position: "60% 40%" },
    { id: "link", kind: "attr", selector: '[data-cms-field="e74aa090-35"][data-cms-occurrence="0"]', attr: "href", value: "/temples/planner/?source=guide-cms" },
  ];
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator("h1")).toHaveText("คู่มือจาก CMSเดินทางมงคล");
  await expect(page.locator("h1 br")).toHaveCount(1);
  await expect(page.locator(".guide-collection h3").nth(1)).toHaveText("วัดขอพรจาก CMS");
  await expect(page.locator('[data-cms-field="guide-packing-title"]')).toHaveText("เตรียมของจาก CMS");
  await expect(page.locator("#travel-guide-popular-image")).toHaveAttribute("alt", "ภาพเลือกจาก CMS");
  await expect(page.locator("#travel-guide-popular-image")).toHaveCSS("object-position", "60% 40%");
  await expect(page.locator(".guide-planner-action a")).toHaveAttribute("href", "/temples/planner/?source=guide-cms");
  await expect(firstCheck).toBeChecked();
  await expect(page.locator("[data-guide-count]")).toHaveText("1 / 6");
  await expect(page.locator("[data-travel-checklist] > details")).toHaveJSProperty("open", false);
  await page.reload();
  await expect(page.locator("h1")).toHaveText("คู่มือจาก CMSเดินทางมงคล");
  await expect(firstCheck).toBeChecked();
});
