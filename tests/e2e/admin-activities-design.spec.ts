import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { adminDesignFixture } from "../helpers/admin-design-fixture.mjs";
import { bangkokToday } from "../../src/lib/temple-activities.js";

const output = "artifacts/admin-activities";
const day = offset => bangkokToday(new Date(Date.now() + offset * 86400000));
async function setup(page, { fail = false, empty = false } = {}) {
  const fixtures = adminDesignFixture();
  const temples = fixtures["/api/admin/temples"].temples;
  const labels = ["งานเวียนเทียนและฟังธรรม", "พิธีทำบุญตักบาตรเช้า", "งานทอดกฐินสามัคคี", "กิจกรรมปลูกต้นไม้ถวายวัด", "ฟังธรรมสัปดาห์ธรรมะ", "ปฏิบัติธรรมวันหยุด", "ประกาศฉบับร่าง", "กิจกรรมในคลัง"];
  let events = empty ? [] : labels.map((title, index) => ({
    id: `test-activity-${index}`, version: `version-${index}`, title: `ตัวอย่าง: ${title}`,
    templeId: temples[index].key, type: ["ceremony", "meditation", "ceremony", "volunteer", "teaching", "meditation", "other", "other"][index],
    status: index === 3 ? "cancelled" : index === 6 ? "draft" : index === 7 ? "archived" : "published",
    startDate: day([7, 0, -8, 9, -3, 12, 30, -12][index]), timeMode: "allDay", description: "ข้อมูลตัวอย่างสำหรับทดสอบระบบ ไม่ใช่ประกาศกิจกรรมจริง",
    imageUrl: index === 5 ? "" : "/assets/images/temple-guide-visit-prep.jpg", imageAlt: "ภาพประกอบการทดสอบ",
    sourceUrl: "https://example.org/test-announcement", verifiedAt: day(0), statusNote: index === 3 ? "ผู้จัดแจ้งยกเลิก" : "",
    updatedAt: new Date().toISOString(), updatedBy: "UI Test", history: [],
  }));
  let failRead = fail;
  const posts = [];
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/admin/activities") {
      if (route.request().method() === "POST") {
        const payload = route.request().postDataJSON(); posts.push(payload);
        if (payload.id === "test-activity-0") return route.fulfill({ status: 409, json: { ok: false, error: "กิจกรรมถูกแก้ไขจากอีกหน้าต่าง" } });
        const event = { ...payload.event, id: payload.id || "new-draft", version: "new-version", updatedAt: new Date().toISOString(), updatedBy: "UI Test", history: [] };
        events = [...events.filter(item => item.id !== event.id), event];
        return route.fulfill({ json: { ok: true, event } });
      }
      return route.fulfill(failRead ? { status: 503, json: { ok: false, error: "ทดสอบบริการไม่พร้อมใช้งาน" } } : { json: { ok: true, events } });
    }
    return route.fulfill({ status: fixtures[url.pathname] ? 200 : 503, json: fixtures[url.pathname] || { ok: false } });
  });
  await page.goto("/admin/");
  await expect(page.locator("#adminStatus")).toHaveText("พร้อมใช้งาน");
  await page.locator('#adminNav [data-section="dates"]').click();
  return { events, errors, posts, recover: () => { failRead = false; } };
}
async function choose(page, name, option) {
  await page.getByRole("combobox", { name, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
async function capture(page, filename) {
  await page.evaluate(async () => { await document.fonts.ready; scrollTo(0, 0); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  await page.screenshot({ path: `${output}/${filename}`, fullPage: true, animations: "disabled" });
}

test("activity list/editor mockup layout, responsive states, keyboard and accessibility", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 940 });
  const { errors } = await setup(page);
  await expect(page.locator(".mw-activity-row")).toHaveCount(5);
  if (!await page.locator(".mw-admin-shell").evaluate(node => node.classList.contains("is-sidebar-collapsed"))) await page.locator('.mw-admin-nav-toggle').click();
  const sidebarColor = await page.locator("#adminSidebar").evaluate(node => getComputedStyle(node).backgroundColor);
  await page.evaluate(() => document.fonts.ready);
  fs.mkdirSync(output, { recursive: true });
  await capture(page, "list-1440.png");
  for (const width of [1440, 1280, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `list overflow ${width}`).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, "list-390.png");
  const menu = page.locator(".mw-activity-mobile-actions").first();
  await menu.locator("summary").click();
  await expect(menu.getByRole("button", { name: "ทำสำเนา", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu.locator("summary")).toBeFocused();
  let axe = await new AxeBuilder({ page }).include(".is-activity-view").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
  await page.locator(".mw-activity-name button").first().click();
  await expect(page.getByRole("tab", { name: "ข้อมูลทั่วไป", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "ข้อมูลทั่วไป", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "กำหนดการ", exact: true })).toBeFocused();
  await page.keyboard.press("Home");
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 940 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `editor overflow ${width}`).toBe(true);
  }
  await page.locator("#adminTitle").click();
  await capture(page, "editor-1440.png");
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, "editor-390.png");
  await page.getByRole("tab", { name: "สื่อและภาพ", exact: true }).click();
  await expect(page.locator("[data-activity-preview]")).toBeVisible();
  expect(await page.locator("[data-activity-preview]").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await capture(page, "editor-media-390.png");
  axe = await new AxeBuilder({ page }).include(".is-activity-view").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
  await page.getByRole("tab", { name: "ข้อมูลทั่วไป", exact: true }).click();
  await page.locator('[name="title"]').fill("ตัวอย่าง: บันทึกการเปลี่ยนแปลงบนมือถือ");
  await page.locator("[data-activity-save]").click();
  await expect(page.locator("#activity-feedback")).toHaveText("เผยแพร่กิจกรรมแล้ว");
  await page.getByRole("tab", { name: "ประวัติการแก้ไข", exact: true }).click();
  await expect(page.locator("[data-activity-history]")).toContainText("ฉบับปัจจุบัน");
  expect(await page.locator("#adminSidebar").evaluate(node => getComputedStyle(node).backgroundColor)).toBe(sidebarColor);
  expect(errors).toEqual([]);
});

test("activity filters, pagination, selection, partial archive and copy-as-draft", async ({ page }) => {
  const { errors, posts } = await setup(page);
  await expect(page.locator("[data-activity-count]")).toHaveText("แสดง 1–5 จาก 8 รายการ");
  await page.getByRole("button", { name: "กำลังจะมาถึง 2", exact: true }).click();
  await expect(page.locator(".mw-activity-row")).toHaveCount(2);
  await page.locator('[data-activity-phase="all"]').click();
  await choose(page, "สถานะกิจกรรมที่ค้นหา", "ฉบับร่าง");
  await expect(page.locator(".mw-activity-row")).toHaveCount(1);
  await page.getByRole("button", { name: "ล้างตัวกรอง", exact: true }).click();
  await page.locator(".mw-activity-range summary").click();
  await page.locator("[data-activity-from]").fill(day(0));
  await page.locator("[data-activity-to]").fill(day(7));
  await expect(page.locator(".mw-activity-row")).toHaveCount(2);
  await page.locator("[data-activity-clear-dates]").click();
  await page.getByRole("button", { name: "หน้า 2", exact: true }).click();
  await expect(page.locator("[data-activity-count]")).toHaveText("แสดง 6–8 จาก 8 รายการ");
  await page.locator("[data-activity-search]").fill("ตัวอย่าง:");
  await choose(page, "จำนวนกิจกรรมต่อหน้า", "10 / หน้า");
  await page.locator('[data-activity-select="test-activity-0"]').check();
  await page.locator('[data-activity-select="test-activity-1"]').check();
  page.once("dialog", dialog => dialog.accept());
  await page.locator("[data-activity-bulk-archive]").click();
  await expect(page.locator("[data-activity-list-feedback]")).toContainText("เก็บเข้าคลังแล้ว 1 รายการ · ไม่สำเร็จ 1 รายการ");
  expect(posts).toHaveLength(2);
  expect(posts.every(item => item.event.status === "archived" && item.expectedVersion)).toBe(true);
  await expect(page.locator('[data-activity-id="test-activity-0"] .mw-activity-badge')).toHaveText("กำลังจะมาถึง");
  await expect(page.locator('[data-activity-id="test-activity-1"] .mw-activity-badge')).toHaveText("เก็บเข้าคลัง");
  await page.locator('[data-copy-activity="test-activity-0"]').first().click();
  await expect(page.locator("#activity-title")).toHaveValue(/สำเนา/);
  await expect(page.locator('select[name="status"]')).toHaveValue("draft");
  await page.locator("[data-activity-save]").click();
  await expect(page.locator("#activity-feedback")).toContainText("ไม่แสดงบนหน้าวัด");
  expect(posts.at(-1).id).toBeUndefined();
  expect(posts.at(-1).event.status).toBe("draft");
  await page.locator("[data-activity-back]").last().click();
  await expect(page.locator("[data-activity-search]")).toHaveValue("ตัวอย่าง:");
  await page.locator('#adminNav [data-section="siteContent"]').click();
  await expect(page.locator("[data-activity-header]")).toHaveCount(0);
  await expect(page.locator(".is-activity-view")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("activity errors never masquerade as empty data and recover with retry", async ({ page }) => {
  const { recover, errors } = await setup(page, { fail: true, empty: true });
  await expect(page.getByRole("heading", { name: "โหลดกิจกรรมไม่สำเร็จ" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "ยังไม่มีกิจกรรมและงานบุญ" })).toHaveCount(0);
  recover();
  await page.getByRole("button", { name: "ลองอีกครั้ง", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ยังไม่มีกิจกรรมและงานบุญ" })).toBeVisible();
  await page.getByRole("button", { name: "สร้างกิจกรรมแรก", exact: true }).click();
  await page.locator("[data-activity-publish]").click();
  await expect(page.locator("#activity-feedback")).toContainText("กรุณาระบุชื่อกิจกรรม");
  await expect(page.locator("#activity-title")).toBeFocused();
  page.once("dialog", dialog => dialog.dismiss());
  await page.locator("[data-activity-back]").last().click();
  await expect(page.locator("#activity-form")).toBeVisible();
  expect(errors).toEqual([]);
});
