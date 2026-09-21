import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";
import { commerceFixture } from "../helpers/commerce-fixtures.mjs";
import { publicCommerce } from "../../api/commerce/_domain.js";
import { getTemplePlannerData } from "../../src/data/temple-planner.js";
import { chooseOption } from "./select-helpers";

const content = JSON.parse(readFileSync(new URL("../../public/admin/content/live.json", import.meta.url), "utf8"));
const fixture = commerceFixture();
const centered = 'main .mw-select:visible, main input:is([type="number"], [type="date"], [type="time"], [inputmode="numeric"]):visible';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
  await page.route("**/api/admin/content?**", route => route.fulfill({ json: { ok: true, revision: "field-alignment", content } }));
  await page.route("**/api/commerce*", route => route.fulfill({ json: { ok: true, ...publicCommerce(fixture.state) } }));
  await page.route("**/api/temple-planner/data*", route => route.fulfill({ json: { ...getTemplePlannerData(content), revision: "field-alignment" } }));
});

async function captureSection(page, selector, name) {
  await mkdir(".local/field-alignment", { recursive: true });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const box = await page.locator(selector).boundingBox();
  const screenshot = await page.screenshot({ fullPage: true, scale: "css" });
  await sharp(screenshot).extract({ left: Math.floor(box.x), top: Math.floor(box.y), width: Math.floor(box.width), height: Math.floor(box.height) }).toFile(`.local/field-alignment/${name}.png`);
}

for (const route of ["/temples/thailand/", "/temples/planner/", "/calendar/", "/horoscope/life-graph/", "/horoscope/thai-astrology/", "/horoscope/seamsi/", "/shop/", `/shop/?product=${fixture.product.id}`, `/merit/?campaign=${fixture.campaign.id}`]) {
  test(`public field alignment: ${route.split("?")[0]}${route.includes("?") ? " detail" : ""}`, async ({ page }, info) => {
    await page.goto(route);
    await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("[data-page-loader]")).toBeHidden();
    if (route === "/temples/planner/") await page.locator(".planner-advanced > summary").click();
    await expect(page.locator(centered).first()).toBeVisible();
    for (const control of await page.locator(centered).all()) {
      await expect(control).toHaveCSS("text-align", "center");
    }
    for (const select of await page.locator("main .mw-select:visible").all()) {
      const padding = await select.locator(".choices__inner").evaluate(el => {
        const style = getComputedStyle(el);
        return [style.paddingLeft, style.paddingRight];
      });
      expect(padding[0]).toBe(padding[1]);
      const fit = await select.evaluate(el => {
        const inner = el.querySelector(".choices__inner") as HTMLElement;
        const native = el.querySelector("select")!;
        const style = getComputedStyle(inner);
        const ctx = document.createElement("canvas").getContext("2d")!;
        ctx.font = style.font;
        return { available: inner.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), text: ctx.measureText(native.selectedOptions[0]?.text || "").width };
      });
      expect(fit.available).toBeGreaterThanOrEqual(Math.ceil(fit.text));
    }
    const freeText = 'main textarea:visible, main input:is([type="text"], [type="search"], [type="email"]):not([inputmode="numeric"]):visible';
    for (const input of await page.locator(freeText).all()) {
      await expect(input).toHaveCSS("text-align", route === "/temples/thailand/" ? "center" : /^(start|left)$/);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

    if (route === "/temples/thailand/") {
      await expect(page.locator("[data-temple-province]")).toBeDisabled();
      await page.locator("[data-temple-name]").fill("พระธาตุ");
      await page.locator("[data-temple-postal]").fill("10150");
      await expect(page.locator("[data-temple-name]")).toHaveValue("พระธาตุ");
      await expect(page.locator(".temple-field > span").first()).toHaveCSS("text-align", /^(start|left)$/);
      await chooseOption(page, "[data-temple-region]", "ภาคกลาง");
      await expect(page.locator("[data-temple-province]")).toBeEnabled();
      await chooseOption(page, "[data-temple-region]", "");
      await page.locator("[data-temple-name]").clear();
      await page.locator("[data-temple-postal]").clear();
      await page.locator("[data-temple-postal]").blur();
      await captureSection(page, ".temple-search-panel", `registry-${info.project.name}`);
    }
    if (route === "/temples/planner/") {
      await page.locator("[data-planner-start-time]").fill("10:30");
      await page.locator("[data-planner-start-date]").fill("2026-10-01");
      await expect(page.locator("[data-planner-start-time]")).toHaveValue("10:30");
      await expect(page.locator("[data-planner-start-date]")).toHaveValue("2026-10-01");
      await page.locator("[data-planner-start-date]").blur();
      await captureSection(page, ".planner-setup", `planner-${info.project.name}`);
    }
    if (route.includes("product=")) {
      await page.locator("[data-product-quantity]").fill("2");
      await expect(page.locator("[data-product-quantity]")).toHaveValue("2");
    }
    if (route === "/horoscope/thai-astrology/") {
      const value = await page.locator('[name="calculationSystem"] option').nth(1).getAttribute("value");
      await chooseOption(page, '[name="calculationSystem"]', value!);
      await captureSection(page, ".thai-astro-form", `astrology-${info.project.name}`);
    }
  });
}

test("compact calendar values fit with balanced arrow clearance", async ({ page }, info) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/calendar/");
    await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("main .mw-select:visible").first()).toBeVisible();
    const sizes = await page.locator("main .mw-select:visible").evaluateAll(selects => selects.map(el => {
      const select = el.querySelector("select")!;
      const inner = el.querySelector(".choices__inner") as HTMLElement;
      const style = getComputedStyle(inner);
      const ctx = document.createElement("canvas").getContext("2d")!;
      ctx.font = style.font;
      return {
        available: inner.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
        text: Math.max(...[...select.options].map(option => ctx.measureText(option.text).width)),
      };
    }));
    for (const size of sizes) expect(size.available).toBeGreaterThanOrEqual(Math.ceil(size.text));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await mkdir(".local/field-alignment", { recursive: true });
    await page.locator(".cal-toolbar").screenshot({ path: `.local/field-alignment/calendar-${info.project.name}-${width}.png` });
  }
});
