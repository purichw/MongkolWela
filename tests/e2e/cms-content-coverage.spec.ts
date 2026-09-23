import { test, expect } from "@playwright/test";
import { adminDesignFixture } from "../helpers/admin-design-fixture.mjs";
import { contentCatalog } from "../../src/data/content-catalog.js";
import { contentRevision } from "../../src/lib/content-revision.js";
import { publicContentForPath } from "../../src/lib/public-content.js";
import { commerceFixture } from "../helpers/commerce-fixtures.mjs";
import { mutateCommerce } from "../../api/commerce/_domain.js";

const revisionOf = ({ publishedAt, updatedAt, ...content }) => contentRevision(content);

test.beforeEach(async ({ page }) => {
  const fixtures = adminDesignFixture();
  let content = fixtures["/api/admin/content"].content;
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/commerce") return route.fulfill({ status: 503, json: { ok: false, code: "COMMERCE_DISABLED", error: "ระบบร้านค้าและร่วมบุญยังไม่เปิดบริการ" } });
    if (url.pathname === "/api/admin/content") {
      if (url.searchParams.get("view") === "catalog") return route.fulfill({ json: { ok: true, catalog: contentCatalog() } });
      if (route.request().method() === "POST") {
        if (route.request().postDataJSON().expectedRevision !== revisionOf(content)) return route.fulfill({ status: 409, json: { ok: false, error: "เนื้อหามีเวอร์ชันใหม่แล้ว" } });
        content = { ...route.request().postDataJSON().content, publishedAt: new Date().toISOString() };
        return route.fulfill({ json: { ok: true, content, meta: { fast: true } } });
      }
      const projected = url.searchParams.has("path") ? publicContentForPath(content, url.searchParams.get("path")) : content;
      return route.fulfill({ json: { ok: true, content: projected, revision: revisionOf(projected) } });
    }
    return route.fulfill({ json: fixtures[url.pathname] || { ok: true } });
  });
});

async function section(page, id) {
  if (await page.locator(".mw-admin-sidebar").evaluate(el => el.inert)) await page.getByRole("button", { name: "เปิดเมนู", exact: true }).click();
  await page.locator(`#adminNav [data-section="${id}"]`).click();
}

test("commerce stays in central admin, preserves sidebar colors and recovers from disabled service", async ({ page }, testInfo) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/admin/");
  await expect(page.locator("#adminNav")).toBeAttached();
  const sidebarColor = await page.locator(".mw-admin-sidebar").evaluate(el => getComputedStyle(el).backgroundColor);
  await section(page, "commerce");
  await expect(page.locator('[data-commerce-state="disabled"]')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/$/);
  await expect(page.locator('[data-action="publish"]').first()).toBeHidden();
  expect(await page.locator(".mw-admin-sidebar").evaluate(el => getComputedStyle(el).backgroundColor)).toBe(sidebarColor);
  expect(sidebarColor).toBe("rgb(11, 56, 46)");
  await page.getByRole("button", { name: "ลองใหม่", exact: true }).click();
  await expect(page.locator('[data-commerce-state="disabled"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("commerce-disabled.png"), fullPage: true });
  await section(page, "pages");
  await expect(page.locator(".mw-page-content-fields")).toBeVisible();
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test("page text edits preserve markup, publish and survive visitor reload", async ({ page }, testInfo) => {
  await page.goto("/admin/");
  await section(page, "pages");
  await expect(page.locator(".mw-page-content-fields")).toBeVisible();
  await page.locator("[data-page-content-search]").fill("มงคลเวลา");
  const first = page.locator('[data-page-content-id="95d291e9-4-0-text-0"]');
  await first.locator("textarea").fill("ข้อความทดสอบจาก CMS");
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("page-editor.png"), fullPage: false });
  await page.locator('[data-action="publish"]').first().click();
  await expect(page.locator("#adminStatus")).toHaveText("เผยแพร่แล้ว", { timeout: 15000 });
  await page.goto("/");
  await expect(page.getByText("ข้อความทดสอบจาก CMS", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("ข้อความทดสอบจาก CMS", { exact: true })).toBeVisible();
});

test("reading library searches, edits and publishes to the tarot reference page", async ({ page }, testInfo) => {
  await page.goto("/admin/");
  await section(page, "contentLibrary");
  await expect(page.locator(".mw-library-row").first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("content-library.png"), fullPage: false });
  await page.getByRole("searchbox", { name: "ค้นหาคำทำนาย" }).fill("THE FOOL");
  await page.locator('[data-library-group="tarot.tarotMeaningCards"][data-library-record="the-fool"]').click();
  await page.locator('[data-library-field="overview"]').fill("คำอ่านใหม่จากคลังเนื้อหา CMS");
  await page.locator('[data-action="publish"]').first().click();
  await expect(page.locator("#adminStatus")).toHaveText("เผยแพร่แล้ว", { timeout: 15000 });
  await page.goto("/tarot/meanings/the-fool/");
  await page.locator(".tarot-detail-more > summary").click();
  await expect(page.getByText("คำอ่านใหม่จากคลังเนื้อหา CMS", { exact: true })).toBeVisible();
  await page.reload();
  await page.locator(".tarot-detail-more > summary").click();
  await expect(page.getByText("คำอ่านใหม่จากคลังเนื้อหา CMS", { exact: true })).toBeVisible();
});

test("central commerce edits real domain records and keeps CMS drafts independent", async ({ page }, testInfo) => {
  const fixture = commerceFixture();
  let data = fixture.state;
  await page.route("**/api/commerce?view=manage", route => route.fulfill({ json: { ok: true, ...data, admin: true, localPreview: true, temples: [{ id: "popular:test", name: "วัดตัวอย่างสำหรับทดสอบ", province: "กรุงเทพมหานคร" }] } }));
  await page.route("**/api/commerce", route => {
    const changed = mutateCommerce(data, route.request().postDataJSON(), fixture.actor, { templeIds: fixture.templeIds, now: fixture.now });
    data = changed.state;
    return route.fulfill({ json: { ok: true, result: changed.result } });
  });
  await page.goto("/admin/?section=commerce");
  await expect(page.locator(".commerce-table")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  const status = await page.locator("#adminStatus").textContent();
  await page.locator(`[data-edit="${fixture.product.id}"]`).click();
  await page.locator('[name="title"]').fill("ตัวอย่างทดสอบ: สินค้าที่แก้ผ่าน Admin ส่วนกลาง");
  await expect(page.locator("#adminStatus")).toHaveText(status!);
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();
  await expect(page.locator('[name="title"]')).toHaveValue("ตัวอย่างทดสอบ: สินค้าที่แก้ผ่าน Admin ส่วนกลาง");
  await page.getByRole("button", { name: "บันทึกรายการ", exact: true }).click();
  await expect(page.locator("[data-seller-message]")).toHaveText("บันทึกแล้ว");
  await expect(page.locator(".commerce-table")).toContainText("สินค้าที่แก้ผ่าน Admin ส่วนกลาง");
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("commerce-central.png"), fullPage: true });
  await section(page, "pages");
  await expect(page.locator(".mw-page-content-fields")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test("shared footer publishes across visitor routes without marking searches dirty", async ({ page }) => {
  await page.goto("/admin/");
  await section(page, "siteContent");
  await expect(page.locator(".mw-page-content-fields")).toBeVisible();
  const status = await page.locator("#adminStatus").textContent();
  await page.locator("[data-page-content-search]").fill("ควรตรวจสอบข้อมูลสถานที่ก่อนออกเดินทาง");
  await expect(page.locator("#adminStatus")).toHaveText(status!);
  await page.locator('[data-page-content-id="9f7d7eae-12-0-text-0"] textarea').fill("ทดสอบ: ตรวจข้อมูลก่อนออกเดินทาง");
  await page.locator('[data-action="publish"]').first().click();
  await expect(page.locator("#adminStatus")).toHaveText("เผยแพร่แล้ว");
  for (const path of ["/", "/horoscope/palmistry/"]) {
    await page.goto(path);
    await expect(page.locator('[data-cms-field="9f7d7eae-12"]')).toHaveText("ทดสอบ: ตรวจข้อมูลก่อนออกเดินทาง");
  }
});

test("conflict response preserves editor values and does not claim success", async ({ page }) => {
  await page.goto("/admin/");
  await section(page, "contentLibrary");
  await page.getByRole("searchbox", { name: "ค้นหาคำทำนาย" }).fill("THE FOOL");
  await page.locator('[data-library-group="tarot.tarotMeaningCards"][data-library-record="the-fool"]').click();
  await page.locator('[data-library-field="overview"]').fill("ร่างที่ต้องไม่สูญหายเมื่อชนเวอร์ชัน");
  await page.route("**/api/admin/content", route => route.request().method() === "POST"
    ? route.fulfill({ status: 409, json: { ok: false, error: "มีผู้ดูแลเผยแพร่เวอร์ชันใหม่ กรุณาบันทึกร่างก่อนโหลดล่าสุด" } })
    : route.fallback());
  await page.locator('[data-action="publish"]').first().click();
  await expect(page.locator("#adminStatus")).toContainText("มีผู้ดูแลเผยแพร่เวอร์ชันใหม่");
  await expect(page.locator('[data-library-field="overview"]')).toHaveValue("ร่างที่ต้องไม่สูญหายเมื่อชนเวอร์ชัน");
});

test("temple descriptions and visiting information publish to the detail page", async ({ page }, testInfo) => {
  const record = adminDesignFixture()["/api/admin/temples"].temples[0];
  await page.goto("/admin/");
  await section(page, "temples");
  await page.locator(`[data-edit-temple="${record.key}"]`).first().click();
  await page.locator('[data-temple-field="summary"]').fill("คำแนะนำสถานที่ที่แก้จาก CMS");
  await page.locator('[data-temple-field="description"]').fill("รายละเอียดสถานที่ที่แก้จาก CMS");
  await page.locator('[data-temple-visit="notice"]').fill("หมายเหตุเข้าชมที่แก้จาก CMS");
  await page.screenshot({ path: testInfo.outputPath("temple-editor.png"), fullPage: false });
  await page.locator('[data-action="save-temple-editor"]').click();
  await page.locator('[data-action="publish"]').first().click();
  await expect(page.locator("#adminStatus")).toHaveText("เผยแพร่แล้ว");
  await page.goto(record.detailUrl);
  await expect(page.locator(".pd-intro")).toHaveText("คำแนะนำสถานที่ที่แก้จาก CMS");
  await expect(page.getByText("รายละเอียดสถานที่ที่แก้จาก CMS", { exact: true })).toBeAttached();
  await expect(page.getByText("หมายเหตุเข้าชมที่แก้จาก CMS", { exact: true })).toBeAttached();
});

test("all four horoscope tools consume the published content library", async ({ page }) => {
  test.setTimeout(90000);
  const fixture = adminDesignFixture()["/api/admin/content"].content;
  const content = { ...fixture, contentLibrary: {
    "seamsi.seamsiCategories": { overview: { label: "ภาพรวมทดสอบจาก CMS" } },
    "thaiAstrology.readings": { overview: { text: "ภาพรวมโหราศาสตร์จาก CMS" } },
    "lifeGraph.lifeHouses": { "fortune-base": { label: "วาสนาจาก CMS", high: "คำอ่านกราฟจาก CMS", mid: "คำอ่านกราฟจาก CMS", low: "คำอ่านกราฟจาก CMS" } },
    "palmistry.LINE_TYPES": { life_line: { nameTh: "เส้นชีวิตจาก CMS" } },
  } };
  await page.route("**/api/admin/content?*", route => route.fulfill({ json: { ok: true, content: publicContentForPath(content, new URL(route.request().url()).searchParams.get("path")) } }));
  await page.addInitScript(() => {
    localStorage.setItem("mongkolwela.pdpa.analytics", "declined");
    (window as any).MONKOL_WELA_THAI_CALENDAR_ENDPOINT = location.origin + "/__cms-calendar";
  });
  await page.route("**/__cms-calendar/*", route => route.fulfill({ json: { data: { lunar_date: { month: 10, year_animal: "ชวด", phase: "ขึ้น", day: 9, month_name: "เดือนสิบ" } } } }));
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/horoscope/seamsi/");
  await expect(page.locator('[data-seamsi-category] option[value="overview"]')).toHaveText("ภาพรวมทดสอบจาก CMS");
  await page.goto("/horoscope/thai-astrology/");
  await expect(page.getByText("ภาพรวมโหราศาสตร์จาก CMS", { exact: true })).toHaveCount(2);
  await page.goto("/horoscope/life-graph/");
  await expect(page.locator("[data-life-graph-output]")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("[data-life-graph-output]")).toContainText("คำอ่านกราฟจาก CMS");
  await page.goto("/horoscope/palmistry/");
  await expect(page.getByText("เส้นชีวิตจาก CMS", { exact: true }).first()).toBeAttached();
  expect(errors).toEqual([]);
});
