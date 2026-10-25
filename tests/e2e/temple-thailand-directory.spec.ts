import { expect, test } from "@playwright/test";
import fs from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { createTempleRoutingServer } from "../helpers/temple-routing-server.mjs";
import { testAccessToken } from "../helpers/supabase-auth-fixture.mjs";
import { ADMIN_ACCESS_COOKIE } from "../../api/admin/_auth.js";
import { chooseOption } from "./select-helpers";
import { thailandPublicPlaces } from "../../src/data/thailand-places.js";

let fixture;
const output = "artifacts/directory-places";
const baselineCount = thailandPublicPlaces({}).length;
test.beforeEach(async ({ page, isMobile }) => {
  fixture = await createTempleRoutingServer();
  await page.addInitScript(() => {
    localStorage.setItem("mongkolwela.pdpa.analytics", "declined");
    localStorage.setItem("mongkolwela.admin.sidebarCollapsed", "1");
  });
  if (isMobile) await page.setViewportSize({ width: 390, height: 844 });
});
test.afterEach(async () => { await fixture?.close(); });

test("mapped directory uses published data, filters, paging, navigation and responsive layout", async ({ page, isMobile }) => {
  const requests: string[] = [], errors: string[] = [];
  page.on("request", request => requests.push(new URL(request.url()).pathname));
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(fixture.url + "/temples/thailand/");
  await expect(page.locator(".directory-card")).toHaveCount(24);
  await expect(page.locator("[data-directory-count]")).toContainText(baselineCount.toLocaleString("th-TH"));
  expect(requests.some(path => /temples-thailand.*json/.test(path))).toBe(false);
  expect(requests.some(path => /thailand-mapped-osm/.test(path))).toBe(false);
  const firstImage = page.locator(".directory-card img").first();
  await expect.poll(() => firstImage.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  const first = page.locator(".directory-card").first();
  expect(new URL(await first.getByRole("link", { name: "ดูแผนที่", exact: true }).getAttribute("href")).searchParams.get("query")).toMatch(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/);
  await expect(page.locator(".directory-source")).toHaveCount(0);
  await expect(page.locator("[data-directory-results]")).not.toContainText("แหล่งพิกัด:");
  await expect(first).toHaveAttribute("data-place-card", "");
  await expect(page.locator(".directory-card").getByRole("link", { name: "เพิ่มลงแผน", exact: true })).toHaveCount(0);
  await expect(first.locator(".place-card__actions a")).toHaveCount(1);
  await expect(page.locator(".directory-card").getByRole("link", { name: "นำทาง", exact: true })).toHaveCount(0);
  const columns = await page.locator(".directory-grid").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length);
  expect(columns).toBe(isMobile ? 1 : 4);
  await expect(first.locator(".directory-address p")).toBeHidden();
  await first.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(first.locator(".directory-address p")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(first.locator(".directory-address p")).toBeHidden();
  expect(await first.locator(".place-card__action--outline").evaluate(node => getComputedStyle(node).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  for (const action of await first.locator(".place-card__actions a").all()) expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  fs.mkdirSync(output, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("html")).toHaveClass(/page-fonts-ready/);
  await expect(page.locator("html")).not.toHaveClass(/is-loading|is-navigating/);
  await expect(page.locator(".directory-input > .site-icon")).toHaveCSS("position", "absolute");
  await expect(page.locator(".directory-input svg")).toHaveCSS("fill", "none");
  await page.screenshot({ path: output + "/directory-" + (isMobile ? "mobile" : "desktop") + ".png", animations: "disabled" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.locator("[data-directory-more]").click();
  await expect(page.locator(".directory-card")).toHaveCount(48);
  await chooseOption(page, 'select[name="province"]', "กรุงเทพมหานคร");
  await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
  expect(new URL(page.url()).searchParams.get("province")).toBe("กรุงเทพมหานคร");
  await expect(page.locator(".directory-locality").first()).toContainText("กรุงเทพมหานคร");
  await page.locator('input[name="name"]').fill("สถานที่ไม่มีอยู่สำหรับทดสอบ");
  await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
  await expect(page.locator(".directory-empty")).toBeVisible();
  await page.getByRole("button", { name: "ดูสถานที่ทั้งหมด" }).click();
  await expect(page.locator(".directory-card")).toHaveCount(24);
  expect(new URL(page.url()).search).toBe("");
  const audit = await new AxeBuilder({ page }).include(".directory-places").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(audit.violations.filter(item => ["serious", "critical"].includes(item.impact))).toEqual([]);
  expect(errors).toEqual([]);
});

test("CMS outage has a retry state and never substitutes the old registry", async ({ page }) => {
  fixture.state.outage = true;
  // The real SDK retries 503 reads with 1/2/4-second backoff. Measure the UI
  // response after that request settles, not while the server is still retrying.
  const failedContent = page.waitForResponse(response => new URL(response.url()).pathname === "/api/admin/content" && response.status() === 503);
  await page.goto(fixture.url + "/temples/thailand/");
  expect((await failedContent).status()).toBe(503);
  await expect(page.locator("[data-directory-retry]")).toBeVisible();
  await expect(page.locator(".directory-card")).toHaveCount(0);
  await expect(page.locator("[data-directory-places]")).not.toHaveAttribute("data-page-pending", "directory");
  fixture.state.outage = false;
  await page.locator("[data-directory-retry]").click();
  await expect(page.locator(".directory-card")).toHaveCount(24);
});

test("directory card fallback, credits and map icons remain usable at narrow widths", async ({ page }) => {
  const original = thailandPublicPlaces(fixture.state.content)[0];
  const brokenPath = new URL(original.image, fixture.url).pathname;
  await page.route(url => url.pathname === brokenPath, route => route.fulfill({ status: 404, body: "missing fixture image" }));
  await page.goto(fixture.url + "/temples/thailand/");
  const first = page.locator(".directory-card").first();
  await expect(first.locator("img")).toHaveAttribute("data-fallback-applied", "true");
  await expect(first.locator(".directory-image-missing")).toBeVisible();
  await expect(first.locator(".directory-image-credit")).toBeHidden();
  await expect(first.locator("figcaption")).not.toContainText("Placeholder");
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const columns = await page.locator(".directory-grid").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(width === 320 ? 1 : width === 768 ? 2 : 4);
    await expect(first.locator(".directory-image-missing")).toBeVisible();
    for (const icon of await first.locator(".ui-icon-mask").all()) {
      const mask = await icon.evaluate(node => getComputedStyle(node).maskImage);
      expect((await page.request.get(mask.slice(5, -2))).ok()).toBe(true);
    }
  }
  await expect(page.locator(".directory-attribution a").first()).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
});

test("compact shared editor validates, cancels, saves a draft, restores and publishes a manual Plus Code place", async ({ page, context, isMobile }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await context.addCookies([{ name: ADMIN_ACCESS_COOKIE, value: testAccessToken(), url: fixture.url }]);
  const openDirectory = async () => {
    await expect(page.locator("#adminStatus")).toHaveText("พร้อมใช้งาน");
    await page.locator('#adminNav [data-section="temples"]').click();
    await page.locator('[data-temple-collection="thailand"]').click();
  };
  await page.goto(fixture.url + "/admin/");
  await openDirectory();
  await page.getByRole("button", { name: "เพิ่มวัด", exact: true }).click();
  const editor = page.locator(".mw-place-editor.is-directory");
  await expect(editor.locator("[data-editor-jump]")).toHaveCount(2);
  await expect(editor.locator('[data-editor-jump="visit"], [data-temple-slug]')).toHaveCount(0);
  await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();
  await expect(page.locator("[data-temple-result-count]")).toContainText(baselineCount.toLocaleString("th-TH"));
  await page.getByRole("button", { name: "เพิ่มวัด", exact: true }).click();
  await page.getByLabel("ชื่อสถานที่", { exact: true }).fill("วัดทดสอบ CMS พิกัด");
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByLabel("Plus Code", { exact: true })).toBeFocused();
  await page.getByLabel("Plus Code", { exact: true }).fill("QF2P+W6");
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  expect(await page.getByLabel("Plus Code", { exact: true }).evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);
  await page.getByLabel("Plus Code", { exact: true }).fill("QF2P+W6 Bangkok");
  await expect(editor.locator("[data-directory-map-preview] a")).toHaveAttribute("href", /query=QF2P%2BW6\+Bangkok/);
  await page.getByLabel("คำแนะนำสถานที่", { exact: true }).fill("ข้อมูลทดสอบในเครื่อง ไม่ใช่สถานที่เผยแพร่จริง");
  if (isMobile) await page.setViewportSize({ width: 390, height: 844 });
  await editor.locator('[data-editor-jump="place"]').click();
  fs.mkdirSync(output, { recursive: true });
  await page.screenshot({ path: output + "/cms-" + (isMobile ? "mobile" : "desktop") + ".png", animations: "disabled" });
  expect(await editor.locator(".mw-admin-drawer-body").evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  const audit = await new AxeBuilder({ page }).include(".mw-place-editor").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(audit.violations).toEqual([]);
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('[data-action="save-draft"]').first().click();
  await page.reload();
  await expect(page.locator("#adminStatus")).toHaveText("พร้อมใช้งาน");
  await page.locator('[data-action="restore-draft"]').click();
  await page.locator('#adminNav [data-section="temples"]').click();
  await page.locator('[data-temple-collection="thailand"]').click();
  await expect(page.locator("[data-temple-result-count]")).toContainText((baselineCount + 1).toLocaleString("th-TH"));
  const publication = page.waitForResponse(response => response.url().endsWith("/api/admin/content") && response.request().method() === "POST");
  await page.locator('[data-action="publish"]').first().click();
  const response = await publication;
  expect(response.status(), await response.text()).toBe(200);
  expect(fixture.state.writes).toBe(1);
  const record: any = Object.values(fixture.state.content.temples.records).find((row: any) => row.collection === "thailand" && row.source === "admin");
  expect(record.fields.plusCode).toBe("QF2P+W6 Bangkok");
  await page.goto(fixture.url + "/temples/thailand/?place=" + encodeURIComponent(record.key));
  await expect(page.locator(".directory-card")).toHaveCount(1);
  await expect(page.locator(".directory-card h3")).toHaveText("วัดทดสอบ CMS พิกัด");
  await expect(page.getByRole("link", { name: "ดูแผนที่", exact: true })).toHaveAttribute("href", /query=QF2P%2BW6\+Bangkok/);
  await expect(page.locator(".directory-source, .directory-address")).toHaveCount(0);
  await page.goto(fixture.url + "/");
  await expect(page.locator('[data-directory-summary="templeCount"]').first()).toHaveText((baselineCount + 1).toLocaleString("th-TH"));
  await expect(page.locator('[data-directory-summary="templeCount"]').last()).toHaveText((baselineCount + 1).toLocaleString("th-TH"));
  await page.goto(fixture.url + "/admin/");
  await openDirectory();
  await page.locator('[data-edit-temple="' + record.key + '"]').click();
  await expect(page.getByLabel("Plus Code", { exact: true })).toHaveValue("QF2P+W6 Bangkok");
  expect(errors).toEqual([]);
});

test("real publication API rejects anonymous, invalid coordinates and stale revisions; edits and removal reach visitors", async ({ request, context }) => {
  const url = fixture.url + "/api/admin/content";
  const current = await (await request.get(url)).json();
  const headers = { Origin: fixture.url };
  expect((await request.post(url, { headers, data: { content: current.content, expectedRevision: current.revision } })).status()).toBe(401);
  await context.addCookies([{ name: ADMIN_ACCESS_COOKIE, value: testAccessToken(), url: fixture.url }]);
  const key = "thailand:api-test";
  const draft = current.content;
  draft.temples.records[key] = { key, collection: "thailand", source: "admin", fields: { name: "วัด API ทดสอบ", latitude: 13.7 } };
  expect((await context.request.post(url, { headers, data: { content: draft, expectedRevision: current.revision } })).status()).toBe(400);
  draft.temples.records[key].fields.longitude = 100.5;
  expect((await context.request.post(url, { headers, data: { content: draft, expectedRevision: "stale" } })).status()).toBe(409);
  expect((await context.request.post(url, { headers, data: { content: draft, expectedRevision: current.revision } })).status()).toBe(200);
  let publicData = await (await request.get(url + "?view=directory&place=" + encodeURIComponent(key))).json();
  expect(new URL(publicData.page.places.find(row => row.key === key).links.directions).searchParams.get("destination")).toBe("13.7,100.5");
  expect((await request.get(url + "?view=directory&offset=24&revision=stale")).status()).toBe(409);
  const latest = await (await request.get(url)).json();
  latest.content.temples.records[key].status = "deleted";
  expect((await context.request.post(url, { headers, data: { content: latest.content, expectedRevision: latest.revision } })).status()).toBe(200);
  publicData = await (await request.get(url + "?view=directory&place=" + encodeURIComponent(key))).json();
  expect(publicData.page.places.some(row => row.key === key)).toBe(false);
});
