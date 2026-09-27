import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { adminDesignFixture } from "../helpers/admin-design-fixture.mjs";
import { contentRevision } from "../../src/lib/content-revision.js";
import { publicContentForPath } from "../../src/lib/public-content.js";

const output = "artifacts/admin-site-content";
const firstField = '[data-page-content-id="cef92c86-1-0-text-0"] [data-page-content-value="value"]';
const revisionOf = ({ publishedAt, updatedAt, ...content }) => contentRevision(content);

async function setup(page, transform = content => content) {
  const fixtures = adminDesignFixture();
  let content = transform(fixtures["/api/admin/content"].content);
  const original = structuredClone(content);
  const errors = [];
  const submissions = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/admin/content") {
      if (route.request().method() === "POST") {
        const payload = route.request().postDataJSON();
        submissions.push(payload);
        if (payload.expectedRevision !== revisionOf(content)) return route.fulfill({ status: 409, json: { ok: false, error: "เนื้อหามีเวอร์ชันใหม่แล้ว" } });
        content = { ...payload.content, publishedAt: new Date().toISOString() };
        return route.fulfill({ json: { ok: true, content, meta: { fast: true } } });
      }
      const projected = url.searchParams.has("path") ? publicContentForPath(content, url.searchParams.get("path")) : content;
      return route.fulfill({ json: { ok: true, content: projected, revision: revisionOf(projected) } });
    }
    return route.fulfill({ status: fixtures[url.pathname] ? 200 : 503, json: fixtures[url.pathname] || { ok: false } });
  });
  await page.goto("/admin/");
  await expect(page.locator("#adminStatus")).toHaveText("พร้อมใช้งาน");
  return { errors, original, submissions };
}

async function section(page, id) {
  if (await page.locator("#adminSidebar").evaluate(node => node.inert)) await page.getByRole("button", { name: "เปิดเมนู", exact: true }).click();
  await page.locator(`#adminNav [data-section="${id}"]`).click();
}

test("shared editor desktop/mobile layout, truthful categories, keyboard and accessibility", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  const { errors } = await setup(page);
  const color = await page.locator("#adminSidebar").evaluate(node => getComputedStyle(node).backgroundColor);
  await section(page, "siteContent");
  await expect(page.locator(".mw-site-field")).toHaveCount(8);
  await expect(page.locator(".mw-site-result-count")).toHaveText("58 รายการ");
  await expect(page.getByRole("combobox", { name: "เลือกหมวดหมู่", exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  fs.mkdirSync(output, { recursive: true });
  await page.screenshot({ path: `${output}/shared-1440-full.png`, fullPage: true });
  const menu = page.locator(".mw-site-field-options").first();
  await menu.locator("summary").click();
  await expect(menu.getByRole("button", { name: "คัดลอกค่า", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).not.toHaveAttribute("open", "");
  await expect(menu.locator("summary")).toBeFocused();
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => {} } }));
  await menu.locator("summary").click();
  await menu.getByRole("button", { name: "คัดลอกค่า", exact: true }).click();
  await expect(page.locator("[data-site-feedback]")).toHaveText("คัดลอกแล้ว");
  await page.getByRole("combobox", { name: "เลือกหมวดหมู่", exact: true }).click();
  await page.getByRole("option", { name: /^ส่วนท้าย/ }).click();
  await expect(page.locator(".mw-site-field").first()).toHaveAttribute("data-site-category", "footer");
  await expect(page.locator(".mw-site-result-count")).toContainText("จาก 58");
  await expect(page.locator("#adminStatus")).toHaveText("พร้อมใช้งาน");
  await page.getByRole("button", { name: "ล้างตัวกรอง", exact: true }).click();
  for (const width of [320, 390, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator(".mw-site-field").first().evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator("#adminTitle").click();
  const save = await page.locator('[data-action="save-draft"]').boundingBox();
  const publish = await page.locator('[data-action="publish"]').boundingBox();
  expect(Math.abs(save!.y - publish!.y)).toBeLessThan(1);
  await page.screenshot({ path: `${output}/shared-390-full.png`, fullPage: true });
  await page.screenshot({ path: `${output}/shared-390-top.png` });
  await page.evaluate(() => scrollTo(0, 690));
  await page.screenshot({ path: `${output}/shared-390-middle.png` });
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.screenshot({ path: `${output}/shared-390-bottom.png` });
  const axe = await new AxeBuilder({ page }).include(".is-site-content").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole("button", { name: "หน้า 3", exact: true }).click();
  await page.getByRole("button", { name: "หน้า 4", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator("#adminSidebar").evaluate(node => getComputedStyle(node).backgroundColor)).toBe(color);
  expect(errors).toEqual([]);
});

test("shared drafts survive pagination, search, reload, and publish without changing page or navigation ownership", async ({ page }) => {
  const { original, submissions, errors } = await setup(page);
  await section(page, "siteContent");
  await page.locator(firstField).fill("ชื่อส่วนกลางฉบับทดสอบ");
  await page.getByRole("button", { name: "หน้า 2", exact: true }).click();
  await page.getByRole("button", { name: "หน้า 1", exact: true }).click();
  await expect(page.locator(firstField)).toHaveValue("ชื่อส่วนกลางฉบับทดสอบ");
  const dirtyStatus = await page.locator("#adminStatus").textContent();
  const search = page.getByRole("searchbox", { name: "ค้นหาข้อความ", exact: true });
  await search.fill("ชื่อส่วนกลางฉบับทดสอบ");
  await expect(page.locator(".mw-site-field")).toHaveCount(1);
  await search.fill("ไม่มีเนื้อหานี้-qa-999");
  await expect(page.getByRole("heading", { name: "ไม่พบเนื้อหาที่ตรงกัน" })).toBeVisible();
  await page.getByRole("button", { name: "ล้างตัวกรอง", exact: true }).first().click();
  await expect(page.locator("#adminStatus")).toHaveText(dirtyStatus!);
  await page.locator('[data-action="save-draft"]').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("mongkolwela.admin.draft")!).site.patches.find(patch => patch.id === "cef92c86-1-0-text-0").value)).toBe("ชื่อส่วนกลางฉบับทดสอบ");
  await page.reload();
  await page.locator('[data-action="restore-draft"]').click();
  await section(page, "siteContent");
  await expect(page.locator(firstField)).toHaveValue("ชื่อส่วนกลางฉบับทดสอบ");
  await page.locator('[data-action="publish"]').click();
  await expect(page.locator("#adminStatus")).toHaveText("เผยแพร่แล้ว");
  expect(submissions[0].content.navigation).toEqual(original.navigation);
  expect(submissions[0].content.pages).toEqual(original.pages);
  await expect(page.locator(".mw-site-updated")).toHaveAttribute("datetime", /T/);
  for (const path of ["/", "/horoscope/palmistry/"]) {
    await page.goto(path);
    await expect(page.locator('[data-cms-field="cef92c86-1"]')).toHaveText("ชื่อส่วนกลางฉบับทดสอบ");
  }
  expect(errors).toEqual([]);
});

test("legacy patch bindings edit in place and failed publish preserves drafts", async ({ page }) => {
  const { submissions } = await setup(page, content => {
    content.site ||= {};
    content.site.patches = (content.site.patches || []).filter(item => !item.selector?.includes('cef92c86-1"'));
    content.site.patches.push({ id: "legacy-brand-name", selector: '[data-cms-field="cef92c86-1"][data-cms-occurrence="0"]', kind: "text-node", nodeIndex: 0, value: "ชื่อจาก CMS เดิม" });
    content.site.patches.push({ id: "empty-brand-subtitle", selector: '[data-cms-field="cef92c86-2"][data-cms-occurrence="0"]', kind: "text-node", nodeIndex: 0, value: "" });
    content.site.patches.push({ id: "disabled-menu-label", selector: '[data-cms-field="cef92c86-5"][data-cms-occurrence="0"]', kind: "text-node", nodeIndex: 0, value: "ข้อความที่ปิดไว้", enabled: false });
    return content;
  });
  await section(page, "siteContent");
  await expect(page.locator(firstField)).toHaveValue("ชื่อจาก CMS เดิม");
  await expect(page.locator('[data-page-content-id="cef92c86-2-0-text-0"] input')).toHaveValue("");
  await expect(page.locator('[data-page-content-id="cef92c86-5-0-text-0"] input')).toHaveValue("เมนูหลัก");
  await page.locator('[data-page-content-id="cef92c86-5-0-text-0"] input').fill("เมนูที่แก้ไขใหม่");
  await page.locator(firstField).fill("แก้ไขชื่อจากข้อมูลเดิม");
  await page.route("**/api/admin/content", route => route.request().method() === "POST"
    ? route.fulfill({ status: 409, json: { ok: false, error: "เนื้อหามีเวอร์ชันใหม่แล้ว" } }) : route.fallback());
  await page.locator('[data-action="publish"]').click();
  await expect(page.locator("#adminStatus")).toContainText("เวอร์ชันใหม่");
  await expect(page.locator(firstField)).toHaveValue("แก้ไขชื่อจากข้อมูลเดิม");
  await page.getByRole("button", { name: "ปิดสถานะการเผยแพร่", exact: true }).click();
  await page.locator('[data-action="save-draft"]').click();
  const patches = await page.evaluate(() => JSON.parse(localStorage.getItem("mongkolwela.admin.draft")!).site.patches.filter(patch => patch.selector.includes('cef92c86-1"')));
  expect(patches).toHaveLength(1);
  expect(patches[0].id).toBe("legacy-brand-name");
  expect(patches[0].value).toBe("แก้ไขชื่อจากข้อมูลเดิม");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("mongkolwela.admin.draft")!).site.patches.find(patch => patch.id === "disabled-menu-label").enabled)).toBe(true);
  expect(submissions).toHaveLength(0);
});

test("shared source errors retry without fabricating editable content or leaking styles", async ({ page }) => {
  await setup(page);
  let failed = true;
  await page.route(/\/$/, route => new URL(route.request().url()).pathname === "/" && failed
    ? route.fulfill({ status: 500, contentType: "text/plain", body: "Unavailable" }) : route.fallback());
  await section(page, "siteContent");
  await expect(page.getByRole("heading", { name: "โหลดเนื้อหาไม่สำเร็จ" })).toBeVisible();
  await expect(page.locator(".mw-site-field")).toHaveCount(0);
  failed = false;
  await page.getByRole("button", { name: "ลองอีกครั้ง", exact: true }).click();
  await expect(page.locator(".mw-site-field")).toHaveCount(8);
  await section(page, "pages");
  await expect(page.locator(".mw-home-editor")).toBeVisible();
  await expect(page.locator(".is-site-content")).toHaveCount(0);
  await expect(page.locator("[data-site-content-header]")).toHaveCount(0);
});
