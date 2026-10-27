import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import { createTemplePlannerPlan } from "../../src/lib/temple-planner-engine.js";

test.use({ channel: "chrome", reducedMotion: "reduce" });
const artifacts = "artifacts/map-preview";
const detailPath = "/temples/popular/wat-rakhang-khositaram/";

async function setup(page) {
  const content = JSON.parse(await fs.readFile("public/admin/content/live.json", "utf8"));
  await fs.mkdir(artifacts, { recursive: true });
  await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
  await page.route("**/api/admin/content?**", r => r.fulfill({ json: { ok: true, revision: "map-preview-qa", content } }));
  await page.route("**/api/temple-activities?**", r => r.fulfill({ json: { ok: true, revision: "empty", events: [] } }));
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  return errors;
}

async function planner(page, brokenImage = false) {
  const seed = JSON.parse(await fs.readFile("src/data/popular-temples.json", "utf8"));
  const catalog = { revision: "map-preview-qa", filters: {}, items: seed.slice(0, 3).map((item, index) => ({
    ...item, id: "preview-" + index, globalRank: index + 1, visitMinutes: 30,
    blessings: ["การงาน"], objectHero: [], collections: ["popular"], detailUrl: detailPath,
    ...(brokenImage ? { imageUrl: "/missing-map-preview.jpg" } : {}),
  })) };
  await page.route("**/api/temple-planner/data*", r => r.fulfill({ json: catalog }));
  await page.route("**/api/temple-planner/plan", r => {
    const result = createTemplePlannerPlan(catalog, r.request().postDataJSON());
    return r.fulfill({ json: { ...result, revision: catalog.revision, items: result.planIds?.map(id => catalog.items.find(item => item.id === id)) } });
  });
  await page.goto("/temples/planner/");
  await settled(page);
  await page.locator("[data-planner-auto]").click();
  await expect(page.locator("[data-planner-stop]")).toHaveCount(3);
  return catalog;
}

async function imageReady(popup) {
  const image = popup.locator("img");
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(popup).toHaveCSS("opacity", "1");
}

async function settled(page) {
  await expect(page.locator("html")).toHaveClass(/page-fonts-ready/);
  await expect(page.locator("[data-page-loader]")).toHaveAttribute("aria-hidden", "true");
  await expect.poll(() => page.locator("[data-page-loader]").evaluate(el => Number(getComputedStyle(el).opacity))).toBe(0);
}

test("route marker hover, preview handoff, dismiss and keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = await setup(page);
  const catalog = await planner(page);
  await page.locator("[data-planner-map-expand]").click();
  const dialog = page.locator("[data-planner-route-dialog]");
  const marker = dialog.locator(".leaflet-marker-icon").first();
  const popup = dialog.locator(".map-place-preview-shell");
  await marker.hover();
  await expect(popup).toBeVisible();
  await expect(popup.locator("strong")).toHaveText(catalog.items[0].name);
  await imageReady(popup);
  await popup.hover();
  await page.waitForTimeout(350);
  await expect(popup).toBeVisible();
  await page.screenshot({ path: `${artifacts}/planner-after-1440.png` });
  await dialog.locator("[data-planner-map-close]").hover();
  await expect(popup).toHaveCount(0);
  await marker.focus();
  await expect(popup).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await marker.press("Enter");
  await expect(popup).toBeVisible();
  await marker.click();
  await expect(page.locator("[data-planner-stop].is-map-focused")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.locator("[data-planner-route-map] .leaflet-marker-icon").first().click();
  await page.waitForTimeout(350);
  await expect(page.locator("[data-planner-route-map] .map-place-preview-shell")).toBeVisible();
  expect(errors).toEqual([]);
});

test("touch route preview stays inside the map and has an image fallback", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    const errors = await setup(page);
    await page.route("**/missing-map-preview.jpg", r => r.abort());
    await planner(page);
    const disclosure = page.locator("[data-planner-route-disclosure]");
    if (!await disclosure.evaluate(node => (node as HTMLDetailsElement).open)) await disclosure.locator("summary").tap();
    await page.locator("[data-planner-map-expand]").tap();
    const dialog = page.locator("[data-planner-route-dialog]");
    await dialog.locator(".leaflet-marker-icon").first().tap();
    const popup = dialog.locator(".map-place-preview-shell");
    await imageReady(popup);
    await expect.poll(async () => {
      const box = await popup.boundingBox(), map = await dialog.locator("[data-planner-route-map]").boundingBox();
      return !!box && box.x >= map!.x + 50 && box.x + box.width <= 390 && box.y >= map!.y - 1 && box.y + box.height <= map!.y + map!.height + 1;
    }).toBe(true);
    await expect(dialog.locator(".leaflet-tile-loaded").first()).toBeVisible();
    await page.screenshot({ path: `${artifacts}/planner-after-390.png` });
    await popup.locator("img").evaluate(image => { image.src = "/missing-map-preview.jpg"; });
    await expect(popup.locator("img")).toHaveAttribute("data-fallback-applied", "true");
    await imageReady(popup);
    await popup.locator(".leaflet-popup-close-button").tap();
    await expect(popup).toHaveCount(0);
    await expect(dialog).toBeVisible();
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test("detail minimap and expanded map preview use the current place image", async ({ page }) => {
  const errors = await setup(page);
  await page.goto(detailPath);
  await settled(page);
  const frame = page.locator(".pd-map-frame");
  await frame.scrollIntoViewIfNeeded();
  await frame.locator(".pd-marker").hover();
  const compact = frame.locator(".map-place-preview-shell");
  await expect(compact).toBeVisible();
  await expect(compact.locator("strong")).toHaveText("วัดระฆังโฆสิตาราม");
  await imageReady(compact);
  const image = await page.locator("[data-place-media] img").evaluate(img => img.currentSrc);
  await expect(compact.locator("img")).toHaveJSProperty("src", image);
  await expect.poll(async () => {
    const bounds = await frame.boundingBox(), preview = await compact.boundingBox();
    return !!preview && preview.y >= bounds!.y - 1 && preview.y + preview.height <= bounds!.y + bounds!.height + 1;
  }).toBe(true);
  await page.screenshot({ path: `${artifacts}/detail-minimap-1440.png` });
  await compact.getByRole("button", { name: "ปิดตัวอย่างสถานที่" }).click();
  await page.locator("[data-map-open]").click();
  const dialog = page.locator(".pd-dialog");
  await dialog.locator(".pd-marker").hover();
  await imageReady(dialog.locator(".map-place-preview-shell"));
  await page.screenshot({ path: `${artifacts}/detail-expanded-1440.png` });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".map-place-preview-shell")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("mobile detail minimap preview fits its narrow column", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    const errors = await setup(page);
    await page.goto(detailPath);
    await settled(page);
    const frame = page.locator(".pd-map-frame");
    await frame.scrollIntoViewIfNeeded();
    await frame.locator(".pd-marker").tap();
    const popup = frame.locator(".map-place-preview-shell");
    await imageReady(popup);
    await expect.poll(async () => {
      const bounds = await frame.boundingBox(), preview = await popup.boundingBox();
      return !!preview && preview.x >= bounds!.x - 1 && preview.x + preview.width <= bounds!.x + bounds!.width + 1 && preview.y >= bounds!.y - 1;
    }).toBe(true);
    await page.screenshot({ path: `${artifacts}/detail-minimap-390.png` });
    await popup.getByRole("button", { name: "ปิดตัวอย่างสถานที่" }).tap();
    await expect(popup).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test("picker preview retains add/remove actions without changing the built route", async ({ page }) => {
  const errors = await setup(page);
  await planner(page);
  await page.locator('[data-planner-view="both"]').click();
  await page.locator('[data-planner-picker-tab="map"]').click();
  await page.waitForFunction(() => !!(document.querySelector("[data-temple-planner]") as any)?._plannerState.state.selectionCluster);
  await page.evaluate(async () => {
    const { state } = (document.querySelector("[data-temple-planner]") as any)._plannerState;
    await new Promise<void>(resolve => state.selectionCluster.zoomToShowLayer(state.selectionMarkers.get(state.selected[0]), resolve));
  });
  const map = page.locator("[data-planner-selection-map]");
  await map.locator(".leaflet-marker-icon[aria-label]").first().hover();
  const popup = map.locator(".map-place-preview-shell");
  await imageReady(popup);
  await popup.getByRole("button", { name: "นำออกจากแผน" }).click();
  await expect(page.locator("[data-planner-selected-count]")).toHaveText("2");
  await expect(page.locator("[data-planner-stop]")).toHaveCount(3);
  await expect(popup.getByRole("button", { name: "เพิ่มลงแผน" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("collection marker keeps its photo and detail link with hover dismissal", async ({ page }) => {
  const errors = await setup(page);
  await page.goto("/temples/popular/");
  await page.locator("[data-temple-map-open]").click();
  await expect(page.locator(".temple-map-canvas")).toHaveClass(/leaflet-container/);
  await page.locator("[data-temple-map-search]").fill("วัดระฆัง");
  await page.locator("[data-temple-map-result]").first().click();
  const popup = page.locator(".temple-map-popup-shell");
  await imageReady(popup);
  await expect(popup.getByRole("link", { name: "ดูรายละเอียด" })).toHaveAttribute("href", detailPath);
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  const marker = page.locator('.temple-map-marker[aria-label="ดูตัวอย่าง วัดระฆังโฆสิตาราม"]');
  await marker.hover();
  await expect(popup).toBeVisible();
  await popup.hover();
  await expect(popup).toBeVisible();
  await page.locator("[data-temple-map-search]").hover();
  await expect(popup).toHaveCount(0);
  expect(errors).toEqual([]);
});
