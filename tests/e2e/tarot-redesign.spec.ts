import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";

const content = JSON.parse(readFileSync("public/admin/content/live.json", "utf8"));
const output = "artifacts/tarot-grid";
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
  await page.route("**/api/admin/content?*", route => route.fulfill({ json: { ok: true, content } }));
  mkdirSync(output, { recursive: true });
});

async function ready(page) {
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
  await expect(page.locator("[data-page-loader]")).toBeHidden();
  await page.evaluate(() => document.fonts.ready);
}
async function fits(page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
async function deckFits(page, expected: number) {
  await expect(page.locator("[data-card-id]")).toHaveCount(expected);
  await expect(page.locator("[data-tarot-next], [data-tarot-prev]")).toHaveCount(0);
  const geometry = await page.locator("[data-tarot-deck]").evaluate(deck => {
    const box = deck.getBoundingClientRect();
    const cards = [...deck.querySelectorAll("button")].map(card => card.getBoundingClientRect());
    return {
      noScroll: deck.scrollWidth <= deck.clientWidth + 1 && deck.scrollHeight <= deck.clientHeight + 1,
      contained: cards.every(card => card.left >= box.left - 1 && card.right <= box.right + 1 && card.top >= box.top - 1 && card.bottom <= box.bottom + 1),
      overlap: cards.some((card, i) => cards.slice(i + 1).some(other => Math.min(card.right, other.right) - Math.max(card.left, other.left) > 1 && Math.min(card.bottom, other.bottom) - Math.max(card.top, other.top) > 1)),
      minimum: Math.min(...cards.map(card => card.width)),
      width: innerWidth,
    };
  });
  expect(geometry.noScroll).toBe(true);
  expect(geometry.contained).toBe(true);
  expect(geometry.overlap).toBe(false);
  expect(geometry.minimum).toBeGreaterThanOrEqual(geometry.width <= 720 ? 44 : 24);
}

for (const width of [1440, 390]) {
  test(`all single-card consumers and result views at ${width}`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.setViewportSize({ width, height: 1000 });
    for (const slug of ["daily", "luck", "love", "money", "career"]) {
      await page.goto(`/tarot/${slug}/`);
      await ready(page);
      await fits(page);
      await expect(page.locator("[data-tarot-read]")).toBeDisabled();
      await deckFits(page, slug === "daily" ? 78 : 22);
      expect(await page.locator(".tarot-back-image").first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      if (slug === "daily") {
        await page.screenshot({ path: `${output}/draw-${width}.png`, fullPage: true });
        await page.screenshot({ path: `${output}/draw-viewport-${width}.png` });
      }
      await page.locator("[data-tarot-shuffle]").click();
      await expect(page.locator("[data-tarot-deck]")).not.toHaveClass(/is-shuffling/);
      await page.locator("[data-tarot-cut]").click();
      await expect(page.locator("[data-tarot-cut]")).toBeEnabled();
      const deckHeight = await page.locator("[data-tarot-deck]").evaluate(node => node.getBoundingClientRect().height);
      const card = page.locator("[data-card-id]").nth(4);
      const id = await card.getAttribute("data-card-id");
      await card.focus();
      await page.keyboard.press("Enter");
      await expect(page.locator("[data-tarot-count]")).toHaveValue("1");
      await expect(page.locator(".tarot-face-pick img")).toBeVisible();
      await expect(page.locator("[data-tarot-read]")).toBeFocused();
      expect(await page.locator("[data-tarot-deck]").evaluate(node => node.getBoundingClientRect().height)).toBeCloseTo(deckHeight, 0);
      await expect(page.locator("[data-card-id]:not(:disabled)")).toHaveCount(0);
      if (slug === "love") await page.screenshot({ path: `${output}/selected-major-${width}.png`, fullPage: true });
      await page.locator("[data-tarot-read-bottom]").click();
      await expect(page).toHaveURL(new RegExp(`/tarot/${slug}/result/`));
      await ready(page);
      await fits(page);
      await expect(page.locator(".tarot-face-result img")).toHaveAttribute("src", new RegExp(`${id}.jpg`));
      await expect(page.locator(".tarot-reading-section")).toHaveCount(3);
      await page.reload();
      await ready(page);
      await expect(page.locator(".tarot-face-result img")).toHaveAttribute("src", new RegExp(`${id}.jpg`));
      if (width === 390) {
        const details = page.locator(".tarot-reading-section").first();
        await expect(details).not.toHaveAttribute("open", "");
        await details.locator("summary").click();
        await expect(details.locator("p")).toBeVisible();
      }
    }
    await page.goto("/tarot/daily/result/?card=the-two-of-wands");
    await ready(page);
    expect(await page.locator(".tarot-face-result img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await page.screenshot({ path: `${output}/result-${width}.png`, fullPage: true });
    const axe = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.filter(v => ["serious", "critical"].includes(v.impact!))).toEqual([]);
    for (const size of [320, 768, 1024]) { await page.setViewportSize({ width: size, height: 1000 }); await fits(page); }
    expect(errors).toEqual([]);
  });

  test(`monthly selection retains ten ordered unique cards at ${width}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/tarot/monthly/");
    await ready(page);
    await deckFits(page, 78);
    const ids: string[] = [];
    for (const [i, index] of [77, 15, 68, 5, 42, 21, 56, 33, 1, 70].entries()) {
      const card = page.locator("[data-card-id]").nth(index);
      ids.push((await card.getAttribute("data-card-id"))!);
      await card.click();
      if (i < 9) await expect(page.locator("[data-tarot-read]")).toBeDisabled();
    }
    expect(new Set(ids).size).toBe(10);
    await expect(page.locator("[data-tarot-selection] figure")).toHaveCount(10);
    await expect(page.locator("[data-tarot-count]")).toHaveValue("10");
    await expect(page.locator("[data-card-id]:not(:disabled)")).toHaveCount(0);
    await expect(page.locator("[data-tarot-selected]")).toHaveValue(ids.join(","));
    expect(await page.locator("[data-tarot-selection]").evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await page.evaluate(() => window.scrollTo({top: 0, behavior: "instant"}));
    await page.screenshot({ path: `${output}/monthly-selected-${width}.png`, fullPage: true });
    await page.setViewportSize({ width: width === 390 ? 1440 : 390, height: 1000 });
    await expect(page.locator("[data-tarot-count]")).toHaveValue("10");
    await fits(page);
    await page.locator("[data-tarot-read-bottom]").click();
    await ready(page);
    await expect(page.locator(".tarot-monthly-card")).toHaveCount(10);
    const rendered = await page.locator(".tarot-face-spread img").evaluateAll((imgs: HTMLImageElement[]) => imgs.map(img => img.getAttribute("src")));
    expect(rendered).toEqual(ids.map(id => `/assets/images/tarot/rws-jpg/${id}.jpg`));
    await page.setViewportSize({ width, height: 1000 });
    await fits(page);
    await page.screenshot({ path: `${output}/monthly-${width}.png`, fullPage: true });
  });

  test(`meaning library and detail share the tarot frame at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/tarot/meanings/");
    await ready(page);
    await expect(page.locator(".tarot-meaning-card")).toHaveCount(78);
    await fits(page);
    await page.screenshot({ path: `${output}/meanings-${width}.png` });
    await page.locator('.tarot-meaning-card[href="/tarot/meanings/the-emperor/"]').click();
    await ready(page);
    await fits(page);
    await expect(page.locator(".tarot-meaning-copy")).toContainText("เมื่อไพ่กลับหัว");
    await expect(page.locator(".tarot-meaning-card-large img")).toBeVisible();
    await page.screenshot({ path: `${output}/meaning-detail-${width}.png`, fullPage: true });
  });
}

test("full deck reflows without paging; shuffle resets; storage denial and invalid results recover", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto("/tarot/daily/");
  await ready(page);
  const order = await page.locator("[data-card-id]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-card-id")!));
  const ids = new Set(order);
  expect(ids.size).toBe(78);
  for (const width of [320, 360, 441, 600, 720, 768, 900, 1024, 1051, 1440]) {
    await page.setViewportSize({width, height: 1000});
    await fits(page);
    await deckFits(page, 78);
    expect(await page.locator("[data-card-id]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-card-id")))).toEqual(order);
  }
  await page.setViewportSize({width: 390, height: 1000});
  await page.locator("[data-card-id]").last().click();
  await expect(page.locator("[data-tarot-selected]")).toHaveValue(order[77]);
  const toolbar = await page.locator(".tarot-draw-controls").evaluate(node => {
    const rect = node.getBoundingClientRect();
    return {top: rect.top, bottom: rect.bottom, viewport: innerHeight, header: parseFloat(getComputedStyle(node).top)};
  });
  expect(toolbar.top).toBeGreaterThanOrEqual(toolbar.header - 1);
  expect(toolbar.bottom).toBeLessThan(toolbar.viewport);
  await page.screenshot({path: `${output}/daily-selected-sticky-390.png`});
  await page.setViewportSize({width: 1440, height: 1000});
  await expect(page.locator("[data-tarot-selected]")).toHaveValue(order[77]);
  await page.locator("[data-tarot-shuffle]").click();
  await expect(page.locator("[data-tarot-count]")).toHaveValue("0");
  await expect(page.locator("[data-tarot-read]")).toBeDisabled();
  expect(new Set(await page.locator("[data-card-id]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-card-id"))))).toEqual(ids);
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error("blocked"); }; });
  await page.locator("[data-card-id]").first().click();
  await page.locator("[data-tarot-read-bottom]").click();
  await expect(page.locator(".tarot-face-result")).toBeVisible();
  await page.goto("/tarot/daily/result/?card=unknown");
  await expect(page.locator(".tarot-empty-result")).toBeVisible();
  await page.goto(`/tarot/monthly/result/?cards=${Array(10).fill("the-sun").join(",")}`);
  await expect(page.locator(".tarot-empty-result")).toBeVisible();
  await page.goto("/tarot/luck/result/?cards=the-two-of-wands");
  await expect(page.locator(".tarot-empty-result")).toBeVisible();
});

test("grid keyboard navigation, partial cut reset and reduced-motion accessibility", async ({ page }) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto("/tarot/monthly/");
  await ready(page);
  const axe = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.filter(v => ["serious", "critical"].includes(v.impact!))).toEqual([]);
  await page.locator("[data-card-id]").last().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-card-id]").first()).toBeFocused();
  await expect(page.locator("[data-card-id]").first()).toBeInViewport();
  await page.screenshot({ path: `${output}/keyboard-focus-390.png` });
  await page.keyboard.press("Space");
  await expect(page.locator("[data-tarot-count]")).toHaveValue("2");
  await page.locator("[data-tarot-cut]").click();
  await expect(page.locator("[data-tarot-count]")).toHaveValue("0");
  await expect(page.locator("[data-tarot-read]")).toBeDisabled();
  await expect(page.locator("[data-tarot-selection]")).toBeHidden();
  await expect(page.locator("[data-card-id]:not(:disabled)")).toHaveCount(78);
});
