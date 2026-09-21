import { expect, test } from "@playwright/test";
import { adminDesignFixture } from "../helpers/admin-design-fixture.mjs";
import { createAdminAuthPreview } from "../helpers/admin-auth-preview.mjs";
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from "../helpers/supabase-auth-fixture.mjs";

async function fixture(page, overrides = {}) {
  const data = { ...adminDesignFixture(), ...overrides };
  await page.route("**/api/**", route => {
    const body = data[new URL(route.request().url()).pathname];
    return route.fulfill({ status: body ? 200 : 503, json: body || { ok: false, error: "Unavailable" } });
  });
  await page.goto("/admin/");
  await expect(page.locator("#adminStatus")).toHaveText(/พร้อมใช้งาน|ข้อมูลบางส่วนโหลดไม่สำเร็จ/);
  return data;
}

async function section(page, name) {
  if (await page.locator(".mw-admin-sidebar").isHidden()) await page.locator(".mw-admin-nav-toggle").click();
  await page.locator(`#adminNav [data-section="${name}"]`).click();
}

test("empty and unavailable analytics preserve cards and visible guidance on desktop and mobile", async ({ page }) => {
  await fixture(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1086 });
    await section(page, "analytics");
    for (const selector of [".mw-overview-trend", ".mw-overview-referrers", ".mw-overview-chart", ".mw-overview-returning"]) {
      await expect(page.locator(selector)).toContainText("ยังไม่มีข้อมูล");
      await expect(page.locator(`${selector} .mw-admin-empty-symbol`)).toBeVisible();
      expect((await page.locator(selector).boundingBox()).height).toBeGreaterThan(220);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `artifacts/admin-design/data-empty-${width}.png`, fullPage: true });
  }
  await page.route("**/api/admin/analytics", route => route.fulfill({ status: 503, json: { ok: false, error: "Unavailable" } }));
  await page.locator(".mw-overview-trend [data-action='refresh-analytics']").click();
  await expect(page.locator(".mw-overview-trend")).toContainText("ยังไม่สามารถโหลดสถิติได้");
  await expect(page.locator(".mw-overview-trend").getByRole("button", { name: "ลองอีกครั้ง" })).toBeVisible();
});

test("one-day data is insufficient, while two days and real referrers render charts", async ({ page }) => {
  const analytics = { totals: { pageviews: 3, events: 0 }, paths: {}, events: {}, daily: [{ date: "2026-09-20", count: 3 }], referrers: [{ label: "search.example.test", count: 3 }] };
  await fixture(page, { "/api/admin/analytics": { ok: true, analytics } });
  await expect(page.locator(".mw-overview-trend")).toContainText("ข้อมูลยังไม่เพียงพอ");
  await expect(page.locator(".mw-overview-referrers")).toContainText("search.example.test");
  analytics.daily.push({ date: "2026-09-21", count: 2 });
  analytics.totals.pageviews = 5;
  analytics.referrers[0].count = 5;
  await page.route("**/api/admin/analytics", route => route.fulfill({ json: { ok: true, analytics } }));
  await page.locator(".mw-overview-trend [data-action='refresh-analytics']").click();
  await expect(page.locator(".mw-admin-real-trend circle")).toHaveCount(2);
  await expect(page.locator(".mw-overview-trend .mw-overview-empty")).toHaveCount(0);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1086 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/admin-design/data-populated-${width}.png`, fullPage: true });
  }
});

test("media references link to real CMS owners and settings use catalog values", async ({ page }) => {
  const base = adminDesignFixture();
  const src = "/assets/images/temple-placeholder-auspicious.png";
  base["/api/admin/content"].content.pages = [{ id: "media-test", label: "ข้อมูลภาพทดสอบ", route: "/", patches: [{ kind: "image", src }, { kind: "image", src }] }];
  base["/api/admin/temples"].temples = [{ key: "sacred:source", source: "admin", collection: "sacred", detailUrl: "/temples/sacred/source/", temple: { name: "CMS record", region: "ภาคตะวันตก", travelModes: "เรือ; รถไฟ", imageUrl: src } }];
  await fixture(page, base);
  await section(page, "media");
  await expect(page.locator(".mw-admin-media-card")).toHaveCount(1);
  await expect(page.locator(".mw-admin-media-card")).toContainText("อ้างอิง 8 ตำแหน่ง");
  await page.locator(".mw-admin-media-references summary").click();
  await page.locator(".mw-admin-media-references [data-page-jump]").first().click();
  await expect(page.locator("[data-field=selectedPage]")).toHaveValue("media-test");
  await section(page, "settings");
  await expect(page.locator("#adminContent")).toContainText("ภาคตะวันตก");
  await expect(page.locator("#adminContent")).not.toContainText("ภาคอีสาน");
  await section(page, "collections");
  await page.locator("[data-collection-jump=sacred]").click();
  await expect(page.locator("[data-temple-collection=sacred]")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("[data-temple-row]")).toContainText("เพิ่มผ่าน CMS");
  await expect(page.locator("[data-temple-row]")).toContainText("ยังไม่ระบุ");
  await page.locator("[data-edit-temple]").first().click();
  await expect(page.locator("[data-temple-field=placeType]")).toHaveValue("");
});

test("temple CMS edit survives real publish handlers, reload, and public projection", async ({ page, context, browser }) => {
  const preview = await createAdminAuthPreview({ astroBase: process.env.PLAYWRIGHT_BASE_URL });
  let visitor;
  try {
    const login = await context.request.post(`${preview.base}/api/admin/session`, { headers: { Origin: preview.base }, data: { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD } });
    expect(login.ok()).toBe(true);
    await page.goto(`${preview.base}/admin/`);
    await expect(page.locator("#adminStatus")).toHaveText("พร้อมใช้งาน");
    await section(page, "temples");
    const edit = page.locator("[data-edit-temple]").first();
    const key = await edit.getAttribute("data-edit-temple");
    await edit.click();
    await page.locator("[data-temple-field=travelModes]").fill("เรือทดสอบ; รถไฟทดสอบ");
    await page.locator("[data-temple-field=placeType]").fill("ประเภททดสอบ CMS");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await page.locator('[data-action="publish"]').click();
    await expect(page.locator("#adminStatus")).toHaveText("เผยแพร่แล้ว");
    await page.reload();
    await expect(page.locator("#adminStatus")).toHaveText("พร้อมใช้งาน");
    await section(page, "settings");
    await expect(page.locator("#adminContent")).toContainText("เรือทดสอบ");
    const catalog = await (await context.request.get(`${preview.base}/api/admin/temples`)).json();
    const item = catalog.temples.find(place => place.key === key);
    expect(item.temple.placeType).toBe("ประเภททดสอบ CMS");
    visitor = await browser.newContext();
    const publicData = await (await visitor.request.get(`${preview.base}/api/admin/content?path=${encodeURIComponent(item.detailUrl)}`)).json();
    expect(publicData.content.temples.records[key].fields.travelModes).toBe("เรือทดสอบ; รถไฟทดสอบ");
    const publicPage = await visitor.newPage();
    await publicPage.goto(`${preview.base}${item.detailUrl}`);
    await expect(publicPage.locator(".pd-map-meta").locator("..")).toContainText("เรือทดสอบ");
  } finally { await visitor?.close(); await preview.close(); }
});
