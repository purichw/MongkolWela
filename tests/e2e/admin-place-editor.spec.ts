import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { adminDesignFixture } from "../helpers/admin-design-fixture.mjs";

const output = "artifacts/admin-place-editor";
async function setup(page) {
  const fixture = adminDesignFixture();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("mongkolwela.admin.sidebarCollapsed", "1"));
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/admin/content" && route.request().method() === "POST") {
      fixture[path] = { ok: true, content: { ...route.request().postDataJSON().content, publishedAt: new Date().toISOString() }, revision: "editor-test-revision" };
    }
    return route.fulfill({ status: fixture[path] ? 200 : 404, json: fixture[path] || { ok: false } });
  });
  await page.goto("/admin/");
  await expect(page.locator("#adminStatus")).toHaveText("พร้อมใช้งาน");
  await page.locator('#adminNav [data-section="temples"]').click();
  return { errors, fixture };
}

async function openFirst(page) {
  await page.locator("[data-edit-temple]").first().click();
  await expect(page.getByRole("dialog", { name: "แก้ไขข้อมูลวัด/สถานที่" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "ภูมิภาค", exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

test("place editor translates desktop/mobile composition and keeps all media variants", async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  const { errors } = await setup(page);
  await openFirst(page);
  fs.mkdirSync(output, { recursive: true });
  const editor = page.locator(".mw-place-editor");
  const body = editor.locator(".mw-admin-drawer-body");
  await expect(editor.locator('[data-editor-jump="place"]')).toHaveAttribute("aria-current", "step");
  await page.locator('.mw-place-editor img').evaluateAll(images => Promise.all(images.map(image => image.complete ? Promise.resolve() : new Promise(resolve => { image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true }); }))));
  await page.screenshot({ path: `${output}/editor-1672-top.png` });
  await body.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await page.screenshot({ path: `${output}/editor-1672-bottom.png` });
  await editor.locator('[data-editor-jump="images"]').click();
  await expect(editor.locator('.mw-admin-image-field:not([hidden])')).toHaveCount(3);
  await editor.locator('[data-editor-viewport="mobile"]').click();
  await expect(editor.locator('[data-image-viewport="mobile"]').first()).toBeVisible();
  const mobileImage = editor.locator('[data-image-role="hero"][data-image-viewport="mobile"]');
  const desktopSource = await editor.locator('[data-image-role="hero"][data-image-viewport="desktop"] [data-image-url]').inputValue();
  await mobileImage.getByRole("button", { name: "ลบรูป", exact: true }).click();
  await page.locator('[data-confirm-accept]').click();
  await expect(editor.locator('[data-editor-viewport="mobile"]')).toHaveAttribute("aria-pressed", "true");
  await expect(editor.locator('[data-image-role="hero"][data-image-viewport="mobile"] [data-image-url]')).toHaveValue("");
  await editor.locator('[data-editor-viewport="desktop"]').click();
  await expect(editor.locator('[data-image-role="hero"][data-image-viewport="desktop"] [data-image-url]')).toHaveValue(desktopSource);
  await editor.getByRole("button", { name: "ยกเลิก", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await openFirst(page);
  await expect(editor.locator('[data-editor-panel="images"]')).not.toHaveAttribute("open", "");
  await page.screenshot({ path: `${output}/editor-390-top.png` });
  await body.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await page.screenshot({ path: `${output}/editor-390-bottom.png` });
  await editor.locator('[data-editor-jump="images"]').click();
  await page.locator('.mw-place-editor img').evaluateAll(images => Promise.all(images.map(image => image.complete ? Promise.resolve() : new Promise(resolve => { image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true }); }))));
  await page.screenshot({ path: `${output}/editor-390-images.png` });
  await expect(editor.locator('[data-action="save-temple-editor"]')).toBeInViewport();
  await editor.locator('[data-action="save-temple-editor"]').focus();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest(".mw-place-editor")))).toBe(true);
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await editor.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    expect(await body.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  }
  const audit = await new AxeBuilder({ page }).include(".mw-place-editor").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(audit.violations).toEqual([]);
  await page.setViewportSize({ width: 768, height: 1024 });
  await editor.locator('[data-editor-jump="images"]').click();
  await page.screenshot({ path: `${output}/editor-768-images.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await editor.locator('[data-editor-jump="place"]').click();
  await page.getByRole("combobox", { name: "ภูมิภาค", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(editor).toBeVisible();
  await expect(page.getByRole("combobox", { name: "ภูมิภาค", exact: true })).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);
  await expect(page.locator('.mw-admin-sidebar')).toHaveAttribute('inert', '');
  expect(errors).toEqual([]);
});

test("place editor cancel restores values, creation and focus; save validates and publishes fields", async ({ page }) => {
  const { errors } = await setup(page);
  const firstKey = await page.locator("[data-temple-row]").first().getAttribute("data-temple-row");
  await openFirst(page);
  const original = await page.getByLabel("ชื่อสถานที่", { exact: true }).inputValue();
  await page.getByLabel("ชื่อสถานที่", { exact: true }).fill("ยกเลิกชื่อทดสอบ");
  await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();
  await expect(page.locator(`[data-temple-row="${firstKey}"] [data-temple-table-title]`)).toHaveText(original);
  await expect(page.locator(`[data-edit-temple="${firstKey}"]`)).toBeFocused();
  const result = await page.locator("[data-temple-result-count]").textContent();
  await page.getByRole("button", { name: "เพิ่มวัด", exact: true }).click();
  await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();
  await expect(page.locator("[data-temple-result-count]")).toHaveText(result!);
  await openFirst(page);
  await page.getByLabel("ชื่อสถานที่", { exact: true }).fill(" ");
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.locator(".mw-place-editor")).toBeVisible();
  await expect(page.getByLabel("ชื่อสถานที่", { exact: true })).toBeFocused();
  await page.getByLabel("ชื่อสถานที่", { exact: true }).fill(original);
  await page.getByLabel("พิกัด LAT", { exact: true }).fill("91");
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByLabel("พิกัด LAT", { exact: true })).toBeFocused();
  await page.getByLabel("พิกัด LAT", { exact: true }).fill("13.752312");
  await page.getByLabel("คำแนะนำสถานที่", { exact: true }).fill("ข้อมูลสถานที่ฉบับทดสอบ");
  await page.locator('[data-editor-panel="extra"] > summary').click();
  await page.getByLabel("พรที่นิยมขอ", { exact: true }).fill("ความสำเร็จ; สุขภาพ");
  await page.locator('[data-editor-jump="visit"]').click();
  await page.locator('[data-visit-kind="hours"] > summary').click();
  await page.getByLabel("เวลาปกติ", { exact: true }).fill("ทุกวัน 08:00–17:00");
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  const submitted = page.waitForRequest(request => request.url().endsWith("/api/admin/content") && request.method() === "POST");
  await page.locator('[data-action="publish"]').first().click();
  const record = (await submitted).postDataJSON().content.temples.records[firstKey!];
  expect(record.fields.latitude).toBe(13.752312);
  expect(record.fields.blessings).toBe("ความสำเร็จ; สุขภาพ");
  expect(record.visitInfo.hours.details.find(detail => detail.term === "เวลาปกติ").value).toBe("ทุกวัน 08:00–17:00");
  await expect(page.locator("[data-publish-progress-title]")).toHaveText("หน้าเว็บอัปเดตแล้ว");
  await page.reload();
  await expect(page.locator("#adminStatus")).toHaveText("พร้อมใช้งาน");
  await page.locator('#adminNav [data-section="temples"]').click();
  await openFirst(page);
  await expect(page.getByLabel("คำแนะนำสถานที่", { exact: true })).toHaveValue("ข้อมูลสถานที่ฉบับทดสอบ");
  expect(errors).toEqual([]);
});

test("place editor cascading locations allow manual values and stale image requests cannot cross records", async ({ page }) => {
  const { errors } = await setup(page);
  await openFirst(page);
  await page.getByRole("combobox", { name: "ภูมิภาค", exact: true }).click();
  await page.getByRole("option", { name: "ภาคเหนือ", exact: true }).click();
  await expect(page.locator('[data-temple-field="province"]')).toHaveValue("");
  await page.getByRole("combobox", { name: "จังหวัด / เขต", exact: true }).click();
  await page.getByRole("option", { name: "เชียงใหม่", exact: true }).click();
  await expect(page.locator('[data-temple-field="district"]')).toHaveValue("");
  await page.getByRole("button", { name: "กรอกอำเภอ / เขตเอง" }).click();
  await page.locator('input[data-temple-field="district"]').fill("พื้นที่ใหม่");
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await openFirst(page);
  await expect(page.locator('[data-temple-field="district"]')).toHaveValue("พื้นที่ใหม่");
  let releaseImage;
  const wait = new Promise(resolve => { releaseImage = resolve; });
  await page.route("https://images.example.test/delayed.svg", async route => {
    await wait;
    await route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="green"/></svg>' });
  });
  await page.locator('[data-editor-jump="images"]').click();
  const field = page.locator('[data-image-role="card"][data-image-viewport="desktop"]');
  await field.getByRole("textbox").fill("https://images.example.test/delayed.svg");
  const requested = page.waitForRequest("https://images.example.test/delayed.svg");
  await field.getByRole("button", { name: "ใช้ลิงก์", exact: true }).click();
  await requested;
  await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();
  await page.locator("[data-edit-temple]").nth(1).click();
  const original = await field.locator("[data-image-url]").inputValue();
  const received = page.waitForResponse("https://images.example.test/delayed.svg");
  releaseImage();
  await received;
  await expect(field.locator("[data-image-url]")).toHaveValue(original);
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await page.locator("[data-edit-temple]").nth(1).click();
  await expect(field.locator("[data-image-url]")).toHaveValue(original);
  expect(errors).toEqual([]);
});
