import { expect, test } from "@playwright/test";
import { createTemplePlannerPlan } from "../../src/lib/temple-planner-engine.js";
import { chooseOption } from "./select-helpers";

test.use({ channel: "chrome", viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
const catalog = () => ({ revision: "workspace-v1", filters: {}, items: Array.from({ length: 12 }, (_, index) => ({
  id: "place-" + index, name: index === 11 ? "สถานที่ชื่อยาวมากสำหรับทดสอบการตัดบรรทัดและปุ่มนำออกที่ต้องไม่หาย" : "สถานที่ทดสอบ " + (index + 1),
  province: "กรุงเทพมหานคร", district: "พระนคร", region: "ภาคกลาง", blessings: ["การงาน"], objectHero: [], collections: ["popular"],
  globalRank: index + 1, globalMentions: 1, visitMinutes: 30, latitude: 13.75 + index * .01, longitude: 100.5 + index * .005,
  imageUrl: "/assets/images/temple-placeholder-auspicious.png", imageAlt: "ยังไม่มีภาพสถานที่", detailUrl: "/temples/",
})) });

async function setup(page, consent = true) {
  const control = { data: catalog(), fail: false, changed: false, delay: 0, omitted: false, posts: [] as any[], loadFail: false };
  if (consent) await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
  await page.route("**/api/admin/content?**", route => route.fulfill({ json: { ok: true, revision: "fixture", content: { schemaVersion: 1, cmsContractVersion: 2, pages: [], navigation: { tabs: [], utility: [] }, plannerDataRevision: "cms-v1", site: { pdpa: { analyticsConsentRequired: true, bannerText: "ใช้คุกกี้วิเคราะห์เมื่อคุณยินยอม", declineLabel: "ปฏิเสธ" } } } } }));
  await page.route("**/api/temple-planner/data*", route => route.fulfill({ status: control.loadFail ? 503 : 200, json: control.loadFail ? { error: "Offline" } : control.data }));
  await page.route("**/api/temple-planner/plan", async route => {
    const body = route.request().postDataJSON();
    control.posts.push(body);
    const result = createTemplePlannerPlan(control.data, body);
    if (control.delay) await new Promise(resolve => setTimeout(resolve, control.delay));
    if (control.changed) {
      control.changed = false;
      control.data = { ...control.data, revision: "workspace-v2", items: control.data.items.map(item => ({ ...item, name: "ชื่อใหม่ " + item.id })) };
      return route.fulfill({ status: 409, json: { code: "CATALOG_CHANGED", catalog: control.data, error: "ข้อมูลเปลี่ยน" } });
    }
    if (control.fail) return route.fulfill({ status: 503, json: { error: "คำนวณไม่สำเร็จ" } });
    if (control.omitted) result.planIds.pop();
    return route.fulfill({ json: { ...result, revision: control.data.revision, items: result.planIds?.map(id => control.data.items.find(item => item.id === id)) } });
  });
  await page.goto("/temples/planner/");
  await expect(page.locator("[data-temple-planner]")).not.toHaveAttribute("aria-busy", "true");
  return control;
}
const read = page => page.evaluate(() => {
  const state = (document.querySelector("[data-temple-planner]") as any)._plannerState.state;
  return { selected: state.selected, plan: state.plan.map(item => item.id), version: state.draftVersion, view: state.view, revision: state.revision, pending: state.pending, names: state.plan.map(item => item.name) };
});
const build = async page => { await page.locator("[data-planner-auto]").click(); await expect(page.locator("[data-planner-stop]")).toHaveCount(3); };

for (const width of [1440, 390]) test(`route map expansion preserves the map and plan at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const control = await setup(page);
  await build(page);
  const disclosure = page.locator("[data-planner-route-disclosure]");
  if (!await disclosure.evaluate(node => (node as HTMLDetailsElement).open)) await disclosure.locator("summary").click();
  await expect(page.locator("[data-planner-route-map] .planner-leaflet-marker")).toHaveCount(3);
  const initial = await read(page), requests = control.posts.length;
  await page.evaluate(() => {
    const state = (document.querySelector("[data-temple-planner]") as any)._plannerState.state;
    (window as any).__routeMap = state.routeMap;
  });
  const opener = page.getByRole("button", { name: "ขยายแผนที่เส้นทาง", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "แผนที่เส้นทาง", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".planner-leaflet-marker")).toHaveCount(3);
  await expect(dialog.locator("[data-cms-field='370ae036-67']")).toBeVisible();
  await dialog.getByRole("button", { name: "ปิดแผนที่เส้นทาง" }).focus();
  await page.keyboard.press("Shift+Tab");
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(disclosure.locator(".planner-leaflet-marker")).toHaveCount(3);
  expect(await page.evaluate(() => (document.querySelector("[data-temple-planner]") as any)._plannerState.state.routeMap === (window as any).__routeMap)).toBe(true);
  expect((await read(page)).plan).toEqual(initial.plan);
  expect(control.posts).toHaveLength(requests);
  await opener.click();
  await dialog.getByRole("button", { name: "ปิดแผนที่เส้นทาง" }).click();
  await expect(opener).toBeFocused();
});

test("route map expansion keeps load failure and retry inside the modal", async ({ page }) => {
  await page.route("**/leaflet.js", route => route.abort());
  await setup(page);
  await build(page);
  await expect(page.locator('[data-planner-map-error="route"]')).toBeVisible();
  await page.locator("[data-planner-map-expand]").click();
  const dialog = page.locator("[data-planner-route-dialog]");
  await expect(dialog.locator('[data-planner-map-error="route"]')).toBeVisible();
  await page.unroute("**/leaflet.js");
  await dialog.locator('[data-planner-map-retry="route"]').click();
  await expect(dialog.locator(".planner-leaflet-marker")).toHaveCount(3);
  await expect(dialog.locator('[data-planner-map-error="route"]')).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-planner-map-expand]")).toBeFocused();
});

test("workspace views, partial selection, dirty snapshot, limit, confirm and revert", async ({ page }) => {
  const control = await setup(page);
  await expect(page.locator("[data-planner-view-control]")).toBeHidden();
  await page.locator("[data-planner-filter-search]").click();
  await expect(page.locator("[data-planner-build]")).toBeDisabled();
  await page.locator('input[name="planner-count"][value="9"]').check();
  for (const id of ["place-0","place-1","place-2"]) await page.locator('[data-planner-toggle-place="' + id + '"]').click();
  await page.locator("[data-planner-build]").click();
  await expect(page.locator("[data-planner-stop]")).toHaveCount(3);
  expect((await read(page)).view).toBe("both");
  const initial = await read(page), requests = control.posts.length;
  for (const view of ["plan", "picker", "both", "plan", "both"]) await page.locator('[data-planner-view="' + view + '"]').click();
  expect(control.posts.length).toBe(requests);
  expect((await read(page)).plan).toEqual(initial.plan);
  await page.locator('[data-planner-picker-mode="browse"]').click();
  await page.locator("[data-planner-picker-search]").fill("ทดสอบ");
  expect((await read(page)).version).toBe(initial.version);
  await page.locator('[data-planner-toggle-place="place-3"]').click();
  await expect(page.locator("[data-temple-planner]")).toHaveAttribute("data-planner-freshness", "draft-changed");
  expect((await read(page)).selected).toHaveLength(4);
  expect((await read(page)).plan).toHaveLength(3);
  await page.screenshot({ path: "artifacts/planner-responsive/state-dirty-1440.png", fullPage: true });
  await expect(page.locator("[data-planner-google]")).not.toHaveAttribute("href");
  await page.locator('[name="planner-count"][value="3"]').click();
  await expect(page.locator("[data-planner-dialog]")).toBeVisible();
  await page.screenshot({ path: "artifacts/planner-responsive/state-count-reduction-1440.png" });
  await page.locator("[data-planner-dialog-cancel]").click();
  await expect(page.locator('[name="planner-count"][value="9"]')).toBeChecked();
  expect((await read(page)).selected).toHaveLength(4);
  await page.locator("[data-planner-revert]").click();
  await page.locator("[data-planner-dialog-confirm]").click();
  await expect(page.locator("[data-temple-planner]")).toHaveAttribute("data-planner-freshness", "synced");
  expect((await read(page)).selected).toEqual(initial.plan);
  await page.locator("[data-planner-auto]").click();
  await page.keyboard.press("Escape");
  expect(control.posts.length).toBe(requests);
});

test("count reduction preserves chosen IDs; selection clearing does not clear the committed plan", async ({ page }) => {
  await setup(page);
  await build(page);
  await page.locator('[data-planner-view="both"]').click();
  await page.locator('[name="planner-count"][value="9"]').check();
  for (const id of ["place-3", "place-4", "place-5", "place-6", "place-7"]) await page.locator('[data-planner-toggle-place="' + id + '"]').click();
  await page.locator('[name="planner-count"][value="3"]').click();
  for (const id of ["place-5", "place-6", "place-7"]) await page.locator('[data-planner-dialog-options] input[value="' + id + '"]').check();
  await page.locator("[data-planner-dialog-confirm]").click();
  expect((await read(page)).selected).toEqual(["place-5", "place-6", "place-7"]);
  await page.locator('[data-planner-toggle-place="place-8"]').focus();
  await page.keyboard.press("Enter");
  expect((await read(page)).selected).toHaveLength(3);
  await expect(page.locator("[data-planner-location-status]")).toContainText("เลือกครบ");
  await page.locator("[data-planner-clear-selection]").click();
  await page.locator("[data-planner-dialog-confirm]").click();
  expect((await read(page)).selected).toHaveLength(0);
  expect((await read(page)).plan).toHaveLength(3);
  await expect(page.locator("[data-planner-build]")).toBeDisabled();
});

test("replacement cancel is lossless; confirm and keyboard ordering remain drafts until update", async ({ page }) => {
  const control = await setup(page);
  await build(page);
  await page.locator(".planner-stop-actions summary").nth(1).click();
  await page.locator("[data-planner-replace]").nth(1).click();
  const initial = await read(page);
  await page.screenshot({ path: "artifacts/planner-responsive/state-replacement-1440.png", fullPage: true });
  await page.locator("[data-planner-replacement-cancel]").click();
  expect((await read(page)).selected).toEqual(initial.selected);
  await page.locator("[data-planner-replace]").nth(1).click();
  await page.locator('[data-planner-toggle-place="place-3"]').click();
  await page.locator("[data-planner-dialog-cancel]").click();
  expect((await read(page)).selected).toEqual(initial.selected);
  await page.locator('[data-planner-toggle-place="place-3"]').click();
  await page.locator("[data-planner-dialog-confirm]").click();
  const expected = [...initial.selected]; expected[1] = "place-3";
  expect((await read(page)).selected).toEqual(expected);
  expect((await read(page)).plan).toEqual(initial.plan);
  expect(control.posts).toHaveLength(1);
  await page.locator("[data-planner-build]").click();
  await expect(page.locator("[data-temple-planner]")).toHaveAttribute("data-planner-freshness", "synced");
  expect((await read(page)).plan).toEqual(expected);
  await page.locator(".planner-stop-actions summary").nth(1).click();
  await page.locator('[data-planner-move="up"]').nth(1).focus();
  await page.keyboard.press("Enter");
  expect(control.posts).toHaveLength(2);
  await page.locator("[data-planner-update]").click();
  await expect(page.locator("[data-temple-planner]")).toHaveAttribute("data-planner-freshness", "synced");
  expect(control.posts.at(-1).manualSelectionOrder).toBe(true);
  expect((await read(page)).plan[0]).toBe("place-3");
});

test("pending draft changes, cancellation, server errors and 409 never overwrite the old snapshot", async ({ page }) => {
  const control = await setup(page);
  await build(page);
  await page.locator('[data-planner-view="both"]').click();
  const original = await read(page);
  control.delay = 500;
  await page.locator("[data-planner-build]").click();
  await page.locator("[data-planner-start-time]").fill("11:30");
  await expect(page.locator("[data-planner-location-status]")).toContainText("เงื่อนไขเปลี่ยนแล้ว");
  expect((await read(page)).plan).toEqual(original.plan);
  await page.locator("[data-planner-build]").click();
  await page.locator("[data-planner-cancel]").click();
  await page.waitForTimeout(650);
  expect((await read(page)).pending).toBe(false);
  control.delay = 0; control.fail = true;
  await page.locator("[data-planner-build]").click();
  await expect(page.locator("[data-planner-location-status]")).toContainText("คำนวณไม่สำเร็จ");
  await page.screenshot({ path: "artifacts/planner-responsive/state-error-1440.png", fullPage: true });
  expect((await read(page)).selected).toEqual(original.selected);
  expect((await read(page)).plan).toEqual(original.plan);
  control.fail = false; control.changed = true;
  await page.locator("[data-planner-build]").click();
  await expect(page.locator("[data-temple-planner]")).toHaveAttribute("data-planner-freshness", "catalog-stale");
  expect((await read(page)).names).toEqual(original.names);
  await expect(page.locator("[data-planner-result]")).toBeVisible();
  await page.locator("[data-planner-build]").click();
  await expect(page.locator("[data-temple-planner]")).toHaveAttribute("data-planner-freshness", "synced");
  expect((await read(page)).names[0]).toContain("ชื่อใหม่");
});

test("origin validation, export order, storage denial and restore", async ({ page }) => {
  const control = await setup(page);
  await page.locator("[data-planner-origin-text]").fill("ที่พักที่ไม่มีในระบบ");
  await page.locator("[data-planner-auto]").click();
  expect(control.posts).toHaveLength(0);
  await expect(page.locator("[data-planner-origin-text]")).toBeFocused();
  await page.locator("[data-planner-origin-clear]").click();
  await page.locator("[data-planner-origin-text]").fill("สถานที่ทดสอบ");
  await expect(page.locator("[data-planner-origin-id]")).toHaveCount(11);
  await page.locator('[data-planner-origin-id="place-1"]').click();
  await page.locator("[data-planner-auto]").click();
  await page.locator("[data-planner-dialog-confirm]").click();
  await expect(page.locator("[data-planner-stop]")).toHaveCount(3);
  expect((await read(page)).plan[0]).toBe("place-1");
  const url = new URL(await page.locator("[data-planner-google]").getAttribute("href"));
  expect(url.searchParams.get("origin")).toBe("13.76,100.505");
  await page.locator("[data-planner-save]").click();
  await expect(page.locator("[data-planner-location-status]")).toContainText("บันทึกไว้ในเบราว์เซอร์นี้แล้ว");
  const ids = (await read(page)).plan;
  await page.reload();
  await expect(page.locator("[data-planner-stop]")).toHaveCount(3);
  expect((await read(page)).plan).toEqual(ids);
  expect(control.posts.length).toBeGreaterThan(1);
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error("Quota"); }; });
  await page.locator("[data-planner-save]").click();
  await expect(page.locator("[data-planner-location-status]")).toContainText("บันทึกบนอุปกรณ์นี้ไม่ได้");
});

test("both-mobile keeps panes visible, search/query survive resize, widths do not overflow", async ({ page }) => {
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  const control = await setup(page);
  await page.locator("[data-planner-filter-search]").click();
  await expect(page.locator("[data-planner-place-card]")).toHaveCount(6);
  await page.locator("[data-planner-more]").click();
  await expect(page.locator("[data-planner-place-card]")).toHaveCount(12);
  await page.locator('[data-planner-toggle-place="place-11"]').click();
  await page.locator("[data-planner-build]").click();
  await expect(page.locator("[data-planner-stop]")).toHaveCount(1);
  await expect(page.locator("#planner-pick")).toBeVisible();
  await expect(page.locator("[data-planner-result]")).toBeVisible();
  await page.locator('[data-planner-picker-mode="browse"]').click();
  await page.locator("[data-planner-picker-search]").fill("ทดสอบ");
  const before = await read(page);
  for (const width of [320, 360, 430, 768, 1024, 1180, 1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const view of ["plan","picker","both"]) {
      await page.locator('[data-planner-view="' + view + '"]').click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    }
  }
  expect((await read(page)).selected).toEqual(before.selected);
  await expect(page.locator("[data-planner-picker-search]")).toHaveValue("ทดสอบ");
  expect(control.posts).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("nine-stop export preserves every point, budget is advisory, midnight is explicit, incomplete responses are rejected", async ({ page }) => {
  const control = await setup(page);
  await page.locator('[name="planner-count"][value="9"]').check();
  await page.locator("[data-planner-start-time]").fill("23:30");
  await page.locator(".planner-advanced summary").click();
  await page.locator("[data-planner-start-date]").fill("2027-09-21");
  await chooseOption(page, "[data-planner-budget]", "300");
  await page.locator(".planner-advanced summary").click();
  await expect(page.locator("[data-planner-advanced-summary]")).toContainText("2570");
  await page.locator("[data-planner-auto]").click();
  await expect(page.locator("[data-planner-stop]")).toHaveCount(9);
  await expect(page.locator("[data-planner-summary]")).toContainText("วันถัดไป");
  await expect(page.locator("[data-planner-warnings]")).toContainText("งบเวลาอ้างอิง");
  const original = await read(page);
  const points = original.plan.map(id => { const item = control.data.items.find(item => item.id === id); return item.latitude + "," + item.longitude; });
  const url = new URL(await page.locator("[data-planner-google]").getAttribute("href"));
  expect([url.searchParams.get("origin"), ...url.searchParams.get("waypoints").split("|"), url.searchParams.get("destination")]).toEqual(points);
  await expect(page.locator("[data-planner-maps-limit]")).toBeVisible();
  await page.locator('[data-planner-view="both"]').click();
  control.omitted = true;
  await page.locator("[data-planner-build]").click();
  await expect(page.locator("[data-planner-retry]")).toBeVisible();
  expect((await read(page)).plan).toEqual(original.plan);
  await expect(page.locator("[data-planner-save]")).toBeDisabled();
  await expect(page.locator("[data-planner-google]")).not.toHaveAttribute("href");
});

test("show-all retains outside-filter selections, purpose filters use OR, and invalid saved work is not auto-filled", async ({ page }) => {
  const control = await setup(page);
  control.data.items[11].province = "เชียงใหม่";
  control.data.items[11].blessings = ["ความรัก/คู่ครอง"];
  await page.reload();
  await page.locator("[data-planner-filter-search]").click();
  await expect(page.locator("[data-planner-place-card]")).toHaveCount(11);
  await page.locator("[data-planner-picker-toggle-scope]").click();
  await page.locator('[data-planner-toggle-place="place-11"]').click();
  await page.locator("[data-planner-picker-toggle-scope]").click();
  await expect(page.locator("[data-planner-selected-tray]")).toContainText("นอกตัวกรอง");
  expect((await read(page)).selected).toEqual(["place-11"]);
  await chooseOption(page, "[data-planner-area]", "");
  await page.locator('[data-planner-purpose-tag][value="ความรัก/คู่ครอง"]').click();
  await expect(page.locator("[data-planner-place-card]")).toHaveCount(12);
  await page.evaluate(() => localStorage.setItem("mongkolwela.templePlanner.v1", JSON.stringify({ count: 9, selected: ["place-0", "deleted-id"], plan: ["place-0", "deleted-id"], startDate: "2020-01-01" })));
  await page.reload();
  await expect(page.locator("[data-planner-recovery-notice]")).toContainText("deleted-id");
  await expect(page.locator("[data-planner-recovery-notice]")).toContainText("ปรับวันที่");
  expect((await read(page)).selected).toEqual(["place-0"]);
  expect((await read(page)).plan).toEqual([]);
  expect(control.posts).toHaveLength(0);
});

test("map failure preserves timeline and external maps; mobile consent, menu and dialogs do not compete with action bar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("https://unpkg.com/**", route => route.abort());
  await setup(page, false);
  await expect(page.locator(".pdpa-consent")).toBeVisible();
  await build(page);
  const bar = page.locator("[data-planner-mobile-bar]");
  await expect(bar).toBeHidden();
  await page.locator("[data-pdpa-decline]").click();
  await expect(bar).toBeVisible();
  await page.locator("[data-planner-route-disclosure] summary").click();
  await expect(page.locator('[data-planner-map-error="route"]')).toBeVisible();
  await expect(page.locator("[data-planner-stop]")).toHaveCount(3);
  await expect(page.locator("[data-planner-google]")).toHaveAttribute("href", /google.com/);
  await page.locator(".nav-toggle").click();
  await expect(bar).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(bar).toBeVisible();
  await page.locator("[data-planner-clear-trip]").click();
  await expect(bar).toBeHidden();
  await expect(page.locator("[data-planner-dialog-cancel]")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("[data-planner-dialog-confirm]")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-planner-clear-trip]")).toBeFocused();
  await expect(bar).toBeVisible();
});

test("no-JavaScript page offers working navigation without fake planner controls", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto((process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4326") + "/temples/planner/");
  await expect(page.locator(".planner-noscript")).toBeVisible();
  await expect(page.locator(".planner-workspace")).toBeHidden();
  await expect(page.locator(".planner-noscript a")).toHaveAttribute("href", "/temples/");
  await context.close();
});

test("compact composition retains readable facts and mobile disclosure actions", async ({ page }) => {
  const control = await setup(page);
  await build(page);
  await page.locator('[data-planner-view="both"]').click();
  const map = await page.locator(".planner-route-map").boundingBox();
  const facts = await page.locator(".planner-route-facts").boundingBox();
  const setupPanel = await page.locator(".planner-setup").boundingBox();
  expect(map.y).toBeLessThan(setupPanel.y + 120);
  expect(facts.y).toBeGreaterThan(map.y);
  await page.setViewportSize({ width: 390, height: 844 });
  const guide = page.locator(".planner-guide").first();
  await expect(guide).not.toHaveAttribute("open");
  await guide.locator("summary").click();
  await expect(guide.locator("p")).toBeVisible();
  const arrow = await guide.locator("summary > .site-icon").evaluate(node => {
    const box = node.getBoundingClientRect(), glyph = node.firstElementChild.getBoundingClientRect();
    return { contained: glyph.top >= box.top && glyph.bottom <= box.bottom, width: glyph.width };
  });
  expect(arrow.contained).toBe(true);
  expect(arrow.width).toBeGreaterThan(0);
  await expect(page.locator(".planner-tray-wrap")).not.toHaveAttribute("open");
  const before = await read(page);
  await page.locator("[data-planner-tray-toggle]").click();
  await page.locator("[data-planner-remove-selected]").first().click();
  expect((await read(page)).selected).toHaveLength(2);
  expect((await read(page)).plan).toEqual(before.plan);
  expect(control.posts).toHaveLength(1);
  await expect(page.locator(".planner-freshness")).toBeVisible();
});

test("picker card composition and disclosed tools preserve selection and keyboard actions", async ({ page }) => {
  const control = await setup(page);
  await build(page);
  await page.locator('[data-planner-view="both"]').click();
  const search = page.locator("[data-planner-picker-search]");
  const tray = page.locator(".planner-tray-wrap");
  const count = page.locator("[data-planner-tray-toggle]");
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(search).toBeHidden();
    await expect(tray).not.toHaveAttribute("open");
    const card = page.locator(".planner-place-card.is-selected").first();
    const geometry = await card.evaluate(node => {
      const rect = node.getBoundingClientRect();
      const figure = node.querySelector("figure").getBoundingClientRect();
      const status = node.querySelector(".planner-card-status").getBoundingClientRect();
      const action = node.querySelector(".planner-card-toggle").getBoundingClientRect();
      const toolbar = document.querySelector(".planner-picker-toolbar").getBoundingClientRect();
      const grid = document.querySelector(".planner-place-grid").getBoundingClientRect();
      return { imageRatio: figure.width / rect.width, inset: figure.left - rect.left,
        statusOnImage: status.left >= figure.left && status.right <= figure.right && status.top >= figure.top,
        actionWidth: action.width, actionHeight: action.height,
        toolbarGap: grid.top - toolbar.bottom, shadow: getComputedStyle(node).boxShadow,
        overflow: document.documentElement.scrollWidth - innerWidth };
    });
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    expect(geometry.statusOnImage).toBe(true);
    expect(geometry.shadow).not.toContain("inset");
    expect(geometry.actionWidth).toBeGreaterThanOrEqual(44);
    expect(geometry.actionHeight).toBeGreaterThanOrEqual(44);
    expect(geometry.toolbarGap).toBeLessThanOrEqual(12);
    if (width < 600) {
      expect(geometry.imageRatio).toBeGreaterThan(.26);
      expect(geometry.imageRatio).toBeLessThan(.32);
      expect(geometry.inset).toBeLessThanOrEqual(1);
    }
  }
  await count.focus();
  await page.keyboard.press("Enter");
  await expect(count).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("[data-planner-move-selected]").first()).toBeVisible();
  await tray.locator("summary").click();
  await expect(count).toHaveAttribute("aria-expanded", "false");
  await page.locator('[data-planner-picker-mode="browse"]').click();
  await expect(search).toBeFocused();
  await search.fill("ทดสอบ 2");
  await expect(page.locator("[data-planner-place-card]")).toHaveCount(1);
  await page.locator('[data-planner-picker-mode="recommended"]').click();
  await expect(search).toBeVisible();
  await expect(search).toHaveValue("ทดสอบ 2");
  await search.fill("");
  await expect(search).toBeHidden();
  const before = await read(page);
  const selected = page.locator('.planner-card-toggle[aria-pressed="true"]').first();
  const selectedId = await selected.getAttribute("data-planner-toggle-place");
  await selected.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(`[data-planner-place-card="${selectedId}"] .planner-card-status`)).toHaveCount(0);
  await expect(page.locator(`[data-planner-toggle-place="${selectedId}"]`)).toBeFocused();
  await page.keyboard.press("Enter");
  expect((await read(page)).selected).toHaveLength(3);
  expect((await read(page)).plan).toEqual(before.plan);
  expect(control.posts).toHaveLength(1);
});

test("picker and route maps own separate state and retain route framing while the draft changes", async ({ page }) => {
  await setup(page);
  await build(page);
  await page.locator('[data-planner-view="both"]').click();
  await page.locator('[data-planner-picker-tab="map"]').click();
  await expect(page.locator("[data-planner-selection-map] .leaflet-tile-loaded").first()).toBeVisible({ timeout: 20000 });
  await expect(page.locator("[data-planner-route-map] .leaflet-marker-icon")).toHaveCount(3);
  const before = await read(page);
  await page.evaluate(async () => {
    const { state } = (document.querySelector("[data-temple-planner]") as any)._plannerState;
    if (state.routeMap === state.selectionMap) throw new Error("Map instances must differ");
    state.routeMap.setZoom(12, { animate: false });
    const marker = state.selectionMarkers.get(state.selected[0]);
    await new Promise<void>(resolve => state.selectionCluster.zoomToShowLayer(marker, resolve));
    marker.openPopup();
  });
  await page.locator("[data-planner-selection-map] [data-planner-map-toggle]").click();
  expect((await read(page)).selected).toHaveLength(2);
  expect((await read(page)).plan).toEqual(before.plan);
  expect(await page.evaluate(() => (document.querySelector("[data-temple-planner]") as any)._plannerState.state.routeMap.getZoom())).toBe(12);
  await page.locator("[data-planner-route-map] .leaflet-marker-icon").first().click();
  expect((await read(page)).selected).toHaveLength(2);
  await expect(page.locator("[data-planner-stop].is-map-focused")).toHaveCount(1);
  await page.locator('[data-planner-picker-tab="list"]').click();
  await expect(page.locator("[data-planner-selected-count]")).toHaveText("2");
});
