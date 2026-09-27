import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { adminDesignFixture } from "../helpers/admin-design-fixture.mjs";

const output = "artifacts/admin-temple-list";
async function setup(page, failure = false) {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const fixture = adminDesignFixture();
  await page.addInitScript(() => localStorage.setItem("mongkolwela.admin.sidebarCollapsed", "1"));
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET") return route.fulfill({ status: 405, json: { ok: false, error: "Read-only visual fixture" } });
    const data = failure && path === "/api/admin/temples" ? null : fixture[path];
    return route.fulfill({ status: data ? 200 : 503, json: data || { ok: false, error: "Fixture unavailable" } });
  });
  await page.goto("/admin/");
  await expect(page.locator("#adminStatus")).toHaveText(/พร้อมใช้งาน|ข้อมูลบางส่วนโหลดไม่สำเร็จ/);
  if (await page.locator(".mw-admin-nav-toggle").getAttribute("aria-expanded") === "false" && await page.evaluate(() => innerWidth < 800)) await page.locator(".mw-admin-nav-toggle").click();
  await page.locator('#adminNav [data-section="temples"]').click();
  await expect(page.locator(".mw-temples-workspace")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return errors;
}

async function choose(page, name, option) {
  await page.getByRole("combobox", { name, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("Admin collection grid, filters, pagination, selection and saved preferences", async ({ page }) => {
  const errors = await setup(page);
  await expect(page.locator("[data-temple-row]")).toHaveCount(20);
  expect(await page.locator(".mw-temples-results").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length)).toBe(4);
  await page.getByRole("button", { name: "หน้าถัดไป", exact: true }).click();
  await expect(page.locator("[data-temple-result-count]")).toContainText("21–40");
  await page.getByRole("checkbox", { name: "เลือกทั้งหมดในหน้านี้" }).check();
  await expect(page.locator("[data-temple-selected-summary]")).toHaveText("เลือก 20 รายการ");
  await page.locator("[data-temple-search]").fill("not-submitted");
  await expect(page.locator("[data-temple-row]")).toHaveCount(20);
  await expect(page.getByRole("checkbox", { name: "เลือกทั้งหมดในหน้านี้" })).toBeChecked();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "ส่งออก CSV" }).click();
  expect((await download).suggestedFilename()).toBe("mongkolwela-popular.csv");
  await page.getByRole("button", { name: "มุมมองรายการ", exact: true }).click();
  await expect(page.locator(".mw-temples-results")).toHaveAttribute("data-temple-list-view", "list");
  await expect(page.getByRole("checkbox", { name: "เลือกทั้งหมดในหน้านี้" })).toBeChecked();
  await expect(page.locator("[data-temple-search]")).toHaveValue("not-submitted");
  await page.locator("[data-temple-search]").fill("");
  await choose(page, "จังหวัด", "เชียงใหม่");
  await expect(page.locator(".mw-temples-selection")).toBeHidden();
  expect(await page.locator(".mw-temple-admin-copy > p:not(.mw-temple-admin-description)").allTextContents()).toEqual(expect.arrayContaining(["เชียงใหม่"]));
  await choose(page, "เรียงตาม", "ชื่อ ก–ฮ");
  await page.getByRole("button", { name: "บันทึกตัวกรอง", exact: true }).click();
  await expect(page.getByText("บันทึกตัวกรองในเบราว์เซอร์นี้แล้ว")).toBeVisible();
  await page.reload();
  await expect(page.locator("#adminStatus")).toHaveText("พร้อมใช้งาน");
  await page.locator('#adminNav [data-section="temples"]').click();
  await expect(page.locator('[data-temple-list-field="province"]')).toHaveValue("เชียงใหม่");
  await page.getByRole("button", { name: "รีเซ็ตตัวกรอง" }).click();
  await page.locator("[data-temple-search]").fill("not-a-real-temple-993");
  await page.locator("[data-temple-search]").press("Enter");
  await expect(page.getByText("ไม่พบสถานที่ที่ตรงกับตัวกรอง")).toBeVisible();
  await page.getByRole("button", { name: "ล้างตัวกรอง", exact: true }).click();
  await expect(page.locator("[data-temple-row]")).toHaveCount(20);
  expect(errors).toEqual([]);
});

test("Admin collection mobile rows, truthful draft state, keyboard and visual evidence", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await setup(page);
  fs.mkdirSync(output, { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const card of await page.locator("[data-temple-row]").all()) await card.scrollIntoViewIfNeeded();
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `${output}/popular-${width}-full.png`, fullPage: true });
    await page.screenshot({ path: `${output}/popular-${width}-top.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await expect(page.getByRole("button", { name: "หน้าถัดไป", exact: true }).locator(".mw-admin-icon")).toBeVisible();
  }
  expect(await page.locator(".mw-temples-results").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length)).toBe(1);
  await page.getByRole("button", { name: "ตัวกรองเพิ่มเติม", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "ประเภท", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "ตัวกรองเพิ่มเติม", exact: true }).click();
  const first = page.locator("[data-temple-row]").first();
  await first.locator("summary").click();
  await page.keyboard.press("Escape");
  await expect(first.locator("summary")).toBeFocused();
  await expect(first.locator("details")).not.toHaveAttribute("open", "");
  await first.locator("[data-edit-temple]").click();
  await page.getByLabel("ชื่อสถานที่", { exact: true }).fill("วัดทดสอบฉบับร่าง");
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await page.locator('[data-temple-status="draft"]').click();
  await expect(page.locator("[data-temple-row]")).toHaveCount(1);
  await expect(page.locator("[data-temple-table-title]")).toHaveText("วัดทดสอบฉบับร่าง");
  await expect(page.locator(".mw-temple-publication")).toHaveText("มีฉบับร่าง");
  await page.getByRole("button", { name: "เพิ่มวัด", exact: true }).click();
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.locator(".mw-temple-publication.is-draft")).toHaveCount(2);
  await page.locator("[data-temple-row]").last().locator("summary").click();
  await expect(page.getByRole("button", { name: "ยังไม่เผยแพร่", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  for (const width of [320, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  const a11y = await new AxeBuilder({ page }).include(".mw-temples-workspace").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(a11y.violations).toEqual([]);
  expect(errors).toEqual([]);
});

test("Admin collection categories share the listing and preserve load failures", async ({ page }) => {
  const errors = await setup(page);
  for (const [collection, title] of [["mu", "พิกัดสายมู"], ["sacred", "วัดเด่นขอพร"]]) {
    await page.locator(`[data-temple-collection="${collection}"]`).click();
    await expect(page.locator("#adminTitle")).toHaveText(title);
    await expect(page.locator("[data-temple-row]")).toHaveCount(20);
    await expect(page.locator(".mw-temples-visitor-banner")).toHaveAttribute("href", `/temples/${collection}/`);
  }
  await page.route("**/api/admin/temples", route => route.fulfill({ status: 503, json: { ok: false, error: "Temples unavailable" } }));
  await page.reload();
  await expect(page.locator("#adminStatus")).toContainText("ข้อมูลบางส่วนโหลดไม่สำเร็จ");
  await page.locator('#adminNav [data-section="temples"]').click();
  await expect(page.getByRole("alert")).toContainText("ยังไม่สามารถโหลดรายการสถานที่ได้");
  await expect(page.locator("[data-temple-result-count]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ลองอีกครั้ง", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
