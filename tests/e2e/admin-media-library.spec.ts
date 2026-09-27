import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";
import { adminDesignFixture } from "../helpers/admin-design-fixture.mjs";
import { collectAdminMedia } from "../../src/scripts/admin/data.js";
import { createActivitiesPreview } from "../helpers/activities-preview.mjs";
import mediaHandler from "../../api/admin/media.js";

async function setup(page, { outage = false, upload = false } = {}) {
  const fixture = adminDesignFixture();
  let assets = collectAdminMedia(fixture["/api/admin/content"].content, [], () => "").slice(0, 16).map((item, index) => ({
    id: `asset-${index}`, version: `version-${index}`, src: item.src, name: item.name, kind: "image", category: "หน้าเว็บไซต์", description: "",
    createdAt: new Date(Date.now() - index * 60000).toISOString(),
  }));
  assets.push({ id: "document", version: "document-v1", src: "/example-test.pdf", name: "เอกสารตัวอย่าง.pdf", kind: "document", category: "เอกสารทดสอบ", description: "" });
  let fail = outage, failSave = false, providerCalls = 0;
  const writes = [], errors = [];
  page.on("pageerror", error => errors.push(error.message));
  if (upload) fixture["/api/admin/media"].media = { provider: "cloudinary", cloudinary: { enabled: true, cloudName: "test", uploadPreset: "test" } };
  await page.route("https://api.cloudinary.com/**", async route => { providerCalls++; await route.fulfill({ json: { secure_url: "https://example.test/uploaded.png" } }); });
  await page.route("https://example.test/uploaded.png", route => route.fulfill({ path: "public/assets/images/site-placeholder-camera-20260923.webp", contentType: "image/webp" }));
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/admin/media" && route.request().method() === "POST") {
      const payload = route.request().postDataJSON(); writes.push(payload);
      if (failSave) return route.fulfill({ status: 503, json: { ok: false, error: "ทดสอบการบันทึกไม่สำเร็จ" } });
      const previous = assets.find(item => item.src === payload.asset.src);
      if (previous && previous.version !== payload.expectedVersion) return route.fulfill({ status: 409, json: { ok: false, error: "มีข้อมูลใหม่ในคลังแล้ว" } });
      const asset = { ...payload.asset, id: previous?.id || "new", version: "saved-version", createdAt: new Date().toISOString() };
      assets = [...assets.filter(item => item.src !== asset.src), asset];
      return route.fulfill({ json: { ok: true, asset } });
    }
    if (url.pathname === "/api/admin/media" && url.searchParams.get("view") === "library") return route.fulfill(fail ? { status: 503, json: { ok: false, error: "คลังสื่อไม่พร้อมใช้งาน" } } : { json: { ok: true, assets } });
    return route.fulfill({ status: fixture[url.pathname] ? 200 : 503, json: fixture[url.pathname] || { ok: false } });
  });
  await page.goto("/admin/");
  await expect(page.locator("#adminStatus")).toHaveText("พร้อมใช้งาน");
  await page.locator('#adminNav [data-section="media"]').click();
  await expect(page.locator(".mw-media-notices")).not.toContainText("กำลังโหลด");
  return { writes, errors, recover: () => { fail = false; }, failSaving: value => { failSave = value; }, providerCalls: () => providerCalls };
}
async function choose(page, label, value) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: value, exact: true }).click();
}
async function capture(page, filename) {
  if (!await page.locator("#mediaLibraryDialog").count()) {
    await page.locator("[data-media-library-image]").evaluateAll(images => images.forEach(image => image.setAttribute("loading", "eager")));
    await page.evaluate(async () => {
      await Promise.race([Promise.all([...document.querySelectorAll("[data-media-library-image]")].map((image: HTMLImageElement) => image.decode().catch(() => {}))), new Promise(resolve => setTimeout(resolve, 5000))]);
    });
  }
  await page.evaluate(async () => { await document.fonts.ready; scrollTo(0, 0); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  await page.screenshot({ path: `artifacts/admin-media/${filename}`, fullPage: !await page.locator("#mediaLibraryDialog").count(), animations: "disabled" });
}

test("media library mockup layout, responsive cards, focus, fallback and accessibility", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 940 });
  const { errors } = await setup(page);
  if (!await page.locator(".mw-admin-shell").evaluate(node => node.classList.contains("is-sidebar-collapsed"))) await page.locator(".mw-admin-nav-toggle").click();
  const sidebarColor = await page.locator("#adminSidebar").evaluate(node => getComputedStyle(node).backgroundColor);
  await expect(page.locator(".mw-media-item")).toHaveCount(20);
  expect(await page.locator(".mw-media-items").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length)).toBe(4);
  await expect(page.locator("[data-action=publish]").first()).toBeHidden();
  await page.locator("[data-media-library-image]").first().evaluate(async (img: HTMLImageElement) => { await img.decode(); });
  fs.mkdirSync("artifacts/admin-media", { recursive: true });
  await capture(page, "library-1440.png");
  await page.locator(".mw-media-menu summary").first().click();
  await expect(page.getByRole("button", { name: "รายละเอียดและแก้ไข", exact: true }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".mw-media-menu summary").first()).toBeFocused();
  await page.getByRole("button", { name: "รายการ", exact: true }).click();
  await expect(page.locator(".mw-media-items")).toHaveClass(/is-list/);
  await page.getByRole("button", { name: "กริด", exact: true }).click();
  for (const width of [1440, 1280, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow ${width}`).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, "library-390.png");
  await page.screenshot({ path: "artifacts/admin-media/library-390-viewport.png", animations: "disabled" });
  await page.locator(".mw-media-item").nth(9).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/admin-media/library-390-middle.png", animations: "disabled" });
  await page.locator(".mw-media-pagination").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/admin-media/library-390-bottom.png", animations: "disabled" });
  await page.evaluate(() => scrollTo(0, 0));
  await page.getByRole("button", { name: "เลือกหน้านี้", exact: true }).click();
  await expect(page.locator(".mw-media-item.is-selected")).toHaveCount(20);
  await page.getByRole("button", { name: "เลือกหน้านี้", exact: true }).click();
  await expect(page.locator(".mw-media-item.is-selected")).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).include(".is-media-library").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
  await page.locator(".mw-media-filename").first().click();
  await expect(page.getByRole("dialog", { name: "รายละเอียดไฟล์" })).toBeVisible();
  await capture(page, "detail-390.png");
  const dialogAxe = await new AxeBuilder({ page }).include("#mediaLibraryDialog").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(dialogAxe.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.locator("#mediaLibraryDialog")).toHaveCount(0);
  await expect(page.locator(".mw-media-filename").first()).toBeFocused();
  expect(await page.locator("#adminSidebar").evaluate(node => getComputedStyle(node).backgroundColor)).toBe(sidebarColor);
  expect(errors).toEqual([]);
});

test("broken media uses the brand placeholder without treating its dimensions as real metadata", async ({ page }) => {
  await page.route("**/assets/images/home-hero-golden-sanctuary.webp", route => route.fulfill({ status: 404, body: "missing" }));
  const { errors } = await setup(page);
  const card = page.locator('[data-media-library-card="/assets/images/home-hero-golden-sanctuary.webp"]');
  await expect(card.locator("img")).toHaveAttribute("data-fallback-applied", "true");
  await expect(card.locator("img")).toHaveAttribute("src", "/assets/images/site-placeholder-camera-20260923.webp");
  await expect(card.locator("[data-media-library-metadata]")).toContainText("อ้างอิง 1 ตำแหน่ง");
  expect(errors).toEqual([]);
});

test("search, filters, pagination, selection, editing, reload and CMS owner links", async ({ page }) => {
  const { errors, writes } = await setup(page);
  await page.getByRole("button", { name: "หน้า 2", exact: true }).click();
  await expect(page.locator("[data-media-library-count]")).toContainText("แสดง 21–40");
  await page.locator("[data-media-library-search]").fill("hero");
  await expect(page.locator("[data-media-library-count]")).toContainText("แสดง 1–");
  await choose(page, "รูปแบบไฟล์", "WEBP");
  await page.locator("[data-media-library-select]").first().check();
  await expect(page.locator("[data-media-library-selection-actions]")).toContainText("เลือก 1 ไฟล์");
  await page.locator("[data-media-library-clear-selection]").click();
  await expect(page.locator(".mw-media-item.is-selected")).toHaveCount(0);
  await page.locator(".mw-media-filename").first().click();
  await expect(page.locator(".mw-admin-media-references")).toContainText("อ้างอิง");
  await page.locator('#media-asset-form [name="name"]').fill("ภาพที่แก้ไขชื่อในคลัง.webp");
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.locator("[data-media-library-feedback]")).toHaveText("บันทึกไฟล์ในคลังแล้ว");
  expect(writes.at(-1).expectedVersion).toBeTruthy();
  await page.reload();
  await page.locator('#adminNav [data-section="media"]').click();
  await expect(page.locator(".mw-media-filename").filter({ hasText: "ภาพที่แก้ไขชื่อในคลัง" })).toHaveCount(1);
  await page.locator(".mw-media-filename").filter({ hasText: "ภาพที่แก้ไขชื่อในคลัง" }).click();
  await page.locator(".mw-admin-media-references [data-page-jump]").first().click();
  await expect(page.locator("#mediaLibraryDialog")).toHaveCount(0);
  await expect(page.locator(".is-media-library")).toHaveCount(0);
  await expect(page.locator("[data-page-content-select]")).toBeAttached();
  expect(errors).toEqual([]);
});

test("imports persist, unsafe URL rejected, errors retain input, other media use real counts", async ({ page }) => {
  const { failSaving, errors } = await setup(page);
  await page.getByRole("button", { name: "นำเข้าจากลิงก์", exact: true }).click();
  await page.locator('#media-asset-form [name="name"]').fill("เอกสารทดสอบใหม่.pdf");
  await page.locator('#media-asset-form [name="src"]').fill("javascript:alert(1)");
  await choose(page, "ประเภทสื่อ", "เอกสาร");
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.locator(".mw-media-dialog-feedback")).toContainText("HTTPS");
  await page.locator('#media-asset-form [name="src"]').fill("https://example.test/new-document.pdf");
  failSaving(true);
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.locator(".mw-media-dialog-feedback")).toContainText("ไม่สำเร็จ");
  await expect(page.locator('[name="name"]')).toHaveValue("เอกสารทดสอบใหม่.pdf");
  failSaving(false);
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.locator('[data-media-library-kind="document"]')).toHaveText("เอกสาร2");
  await expect(page.locator(".mw-media-item")).toHaveCount(2);
  await page.locator('[data-media-library-kind="video"]').click();
  await expect(page.getByRole("heading", { name: "ยังไม่มีวิดีโอในคลัง" })).toBeVisible();
  await page.getByRole("button", { name: "อัปโหลดไฟล์", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toContainText("ยังไม่ได้ตั้งค่าผู้ให้บริการอัปโหลด");
  expect(errors).toEqual([]);
});

test("partial load failure retries and upload registration failure retries without uploading twice", async ({ page }) => {
  const { recover, failSaving, providerCalls, writes, errors } = await setup(page, { outage: true, upload: true });
  await expect(page.locator(".mw-media-notices")).toContainText("คลังสื่อไม่พร้อมใช้งาน");
  await expect(page.locator(".mw-media-item")).toHaveCount(20);
  await page.locator(".mw-media-filename").first().click();
  await expect(page.getByRole("dialog")).toContainText("แสดงข้อมูลได้อย่างเดียว");
  await expect(page.getByRole("button", { name: "บันทึก", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "ปิด", exact: true }).click();
  recover();
  await page.getByRole("button", { name: "ลองอีกครั้ง", exact: true }).click();
  await expect(page.locator(".mw-media-notices")).toBeEmpty();
  await page.getByRole("button", { name: "อัปโหลดไฟล์", exact: true }).first().click();
  await page.locator("[data-media-library-files]").setInputFiles("public/assets/images/site-placeholder-camera-20260923.webp");
  failSaving(true);
  await page.locator("[data-media-library-start]").click();
  await expect(page.locator(".mw-media-upload-queue")).toContainText("อัปโหลดแล้ว แต่ยังบันทึกคลังไม่สำเร็จ");
  expect(providerCalls()).toBe(1);
  failSaving(false);
  await page.locator("[data-media-library-start]").click();
  await expect(page.locator(".mw-media-upload-queue")).toContainText("บันทึกในคลังแล้ว");
  expect(providerCalls()).toBe(1);
  expect(writes.at(-1).asset.width).toBeGreaterThan(0);
  expect(writes.at(-1).asset.bytes).toBeGreaterThan(0);
  await page.getByRole("button", { name: "ปิด", exact: true }).click();
  await page.reload();
  await page.locator('#adminNav [data-section="media"]').click();
  await expect(page.locator('[data-media-library-card="https://example.test/uploaded.png"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test("real local media API stores assets across reload without publishing a page", async ({ page, context }) => {
  const oldDirectory = process.env.MONGKOLWELA_MEDIA_DIR, oldPreview = process.env.MONGKOLWELA_ADMIN_PREVIEW;
  const directory = fs.mkdtempSync(path.join(process.cwd(), ".local/media-api-test-"));
  process.env.MONGKOLWELA_MEDIA_DIR = directory;
  const server = createActivitiesPreview({ astroBase: process.env.PLAYWRIGHT_BASE_URL, extraHandlers: { "/api/admin/media": mediaHandler } });
  const base = await new Promise<string>(resolve => server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}`)));
  try {
    const login = await context.request.post(`${base}/api/admin/session`, { headers: { Origin: base }, data: { password: "admin" } });
    expect(login.ok()).toBe(true);
    await page.goto(`${base}/admin/`);
    await expect(page.locator("#adminStatus")).toHaveText("พร้อมใช้งาน");
    await page.locator('#adminNav [data-section="media"]').click();
    await expect(page.locator(".mw-media-notices")).toBeEmpty();
    await page.getByRole("button", { name: "นำเข้าจากลิงก์", exact: true }).click();
    await page.locator('[name="name"]').fill("ไฟล์ทดสอบการบันทึกจริง.webp");
    await page.locator('[name="src"]').fill("/assets/images/home-wat-pho.webp");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page.locator("[data-media-library-feedback]")).toHaveText("บันทึกไฟล์ในคลังแล้ว");
    await page.reload();
    await page.locator('#adminNav [data-section="media"]').click();
    await expect(page.locator(".mw-media-filename").filter({ hasText: "ไฟล์ทดสอบการบันทึกจริง" })).toBeVisible();
    const rows = JSON.parse(fs.readFileSync(path.join(directory, "media-library.json"), "utf8"));
    expect(rows).toHaveLength(1); expect(rows[0].updatedBy).toBe("local-preview:admin");
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    if (oldDirectory === undefined) delete process.env.MONGKOLWELA_MEDIA_DIR; else process.env.MONGKOLWELA_MEDIA_DIR = oldDirectory;
    if (oldPreview === undefined) delete process.env.MONGKOLWELA_ADMIN_PREVIEW; else process.env.MONGKOLWELA_ADMIN_PREVIEW = oldPreview;
  }
});
