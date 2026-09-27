import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import { commerceFixture } from "../helpers/commerce-fixtures.mjs";
import { publicCommerce } from "../../api/commerce/_domain.js";
import { chooseOption } from "./select-helpers";

const seed = JSON.parse(readFileSync(new URL("../../public/admin/content/live.json", import.meta.url), "utf8"));
function sampleCatalog() {
  const fixture = commerceFixture();
  const catalog = publicCommerce(fixture.state);
  const categories = ["amulets", "talismans", "beads", "offerings"];
  const names = ["พระเครื่องกรอบทอง", "เครื่องรางกรอบทอง", "สายประคำไม้", "ชุดดอกบัวบูชา"];
  catalog.products = Array.from({ length: 8 }, (_, i) => ({ ...catalog.products[0], id: `product-${i}`, title: `${names[i % 4]} (ตัวอย่างทดสอบ ${i + 1})`, category: categories[i % 4], imageUrl: `/assets/images/shop-category-${categories[i % 4]}.webp`, imageAlt: "ภาพประกอบทดสอบ ไม่ใช่สินค้าจำหน่ายจริง", priceSatang: (i + 1) * 10000, available: i === 7 ? 0 : 5, templeId: `temple-${i % 4}` }));
  catalog.campaigns = Array.from({ length: 4 }, (_, i) => ({ ...catalog.campaigns[0], id: `campaign-${i}`, templeId: `temple-${i}`, title: `กฐินสามัคคี (ตัวอย่างทดสอบ ${i + 1})`, capacity: i === 3 ? 1 : 100, available: i === 3 ? 1 : 100 - i * 20, status: i === 2 ? "closed" : "published", eventDate: `2026-10-${10 + i}`, closed: i === 2, kind: i === 3 ? "host" : "fund" }));
  return { ...catalog, ok: true, temples: Array.from({ length: 4 }, (_, i) => ({ id: `temple-${i}`, name: `วัดตัวอย่าง ${i + 1}`, province: i % 2 ? "เชียงใหม่" : "กรุงเทพมหานคร", imageUrl: "/assets/images/hero-songkhla-buddha.webp" })) };
}
async function setup(page, response, status = 200, patches = [], pageId = "shop") {
  const content = structuredClone(seed);
  content.pages.find(p => p.id === pageId).patches.push(...patches);
  await page.route("**/api/admin/content**", route => route.fulfill({ json: { ok: true, content } }));
  await page.route("**/api/commerce**", route => route.fulfill({ status, json: response }));
}
async function capture(page, name, info) {
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].filter(img => img.getBoundingClientRect().width > 0).map(img => { img.loading = "eager"; return img.decode().catch(() => {}); }));
    await Promise.all([...document.querySelectorAll("body > *")].flatMap(el => el.getAnimations()).filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
  });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator("main img").evaluateAll(images => images.filter((i: HTMLImageElement) => i.getBoundingClientRect().width > 0).every((i: HTMLImageElement) => i.complete && i.naturalWidth > 0))).toBe(true);
  await fs.mkdir("artifacts/commerce-redesign", { recursive: true });
  await page.screenshot({ path: `artifacts/commerce-redesign/${name}-${info.project.name}.png`, fullPage: true, animations: "disabled" });
}

for (const route of ["shop", "merit"]) {
  test(`${route}: closed composition, navigation and assets`, async ({ page }, info) => {
    await setup(page, { ok: false, code: "COMMERCE_DISABLED", error: "ระบบยังไม่เปิดบริการ" }, 503);
    await page.goto(`/${route}/`);
    await expect(page.locator("[data-commerce-state=disabled]")).toBeVisible();
    await expect(page.locator("[data-commerce-content]")).toBeHidden();
    await expect(page.getByRole("button", { name: "ลองใหม่", exact: true })).toHaveCount(0);
    await expect(page.locator(".commerce-nav").getByRole("link", { name: /ตะกร้า|จัดการร้านค้า/ })).toHaveCount(0);
    await expect(page.locator(".commerce-breadcrumb")).toBeVisible();
    if (route === "shop") {
      await expect(page.locator(".shop-category-preview")).toHaveCount(4);
      await expect(page.getByRole("link", { name: /ติดตามข่าวเปิดบริการ/ })).toHaveAttribute("href", "/contact/#contact-channel-data");
      await page.locator(".shop-faq summary").first().click();
      await expect(page.locator(".shop-faq details").first()).toHaveAttribute("open", "");
      await page.locator(".shop-faq summary").first().click();
    } else {
      await expect(page.getByRole("link", { name: /กลับหน้าร้านค้า/ })).toHaveAttribute("href", "/shop/");
    }
    await capture(page, `${route}-closed`, info);
  });

  test(`${route}: catalog and responsive controls`, async ({ page }, info) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await setup(page, sampleCatalog());
    await page.goto(`/${route}/`);
    await expect(page.locator("[data-commerce-state=ready]")).toBeVisible();
    await capture(page, `${route}-catalog`, info);
    const card = page.locator(route === "shop" ? ".shop-product" : ".merit-campaign");
    await expect(card).toHaveCount(route === "shop" ? 8 : 4);
    await card.first().getByRole("button", { name: /บันทึก/ }).click();
    await expect(card.first().getByRole("button", { name: /บันทึก/ })).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(card.first().getByRole("button", { name: /บันทึก/ })).toHaveAttribute("aria-pressed", "true");
    if (route === "shop") {
      await page.locator(".shop-categories [data-category=beads]").click();
      await expect(card).toHaveCount(2);
      await chooseOption(page, "[data-sort]", "price-desc");
      await expect(card.first()).toContainText("700.00");
      await page.locator(".shop-categories [data-category='']").click();
    } else {
      await chooseOption(page, "[data-province]", "เชียงใหม่");
      await expect(card).toHaveCount(2);
      await chooseOption(page, "[data-kind]", "host");
      await expect(card).toHaveCount(1);
      await chooseOption(page, "[data-province]", "");
      await chooseOption(page, "[data-kind]", "");
      await expect(card.nth(2).getByRole("link", { name: /ร่วมบุญ/ })).toHaveCount(0);
      await expect(card.first()).toContainText("จองแล้ว 0 / 100 กอง");
    }
    await page.locator("[data-search]").fill("ไม่มีรายการนี้แน่นอน");
    await expect(page.getByRole("heading", { name: "ไม่พบรายการที่ตรงกับการค้นหา" })).toBeVisible();
    await page.getByRole("button", { name: "ล้างตัวกรอง" }).click();
    await expect(card).toHaveCount(route === "shop" ? 8 : 4);
    expect(errors).toEqual([]);
  });

  test(`${route}: failures stay retryable; empty catalog is not a closed service`, async ({ page }) => {
    await setup(page, { ok: false, error: "โหลดข้อมูลไม่สำเร็จ" }, 503);
    await page.goto(`/${route}/`);
    await expect(page.locator("[data-commerce-state=error]")).toBeVisible();
    await expect(page.locator("[data-commerce-unavailable]").first()).toBeHidden();
    await page.route("**/api/commerce**", route => route.fulfill({ json: { ...sampleCatalog(), products: [], campaigns: [] } }));
    await page.getByRole("button", { name: "ลองใหม่", exact: true }).click();
    await expect(page.locator("[data-commerce-state=ready]")).toBeVisible();
    await expect(page.getByRole("heading", { name: route === "shop" ? "ยังไม่มีสินค้าที่เผยแพร่" : "ยังไม่มีงานบุญที่เปิดรับรายการ" })).toBeVisible();
    await expect(page.locator("[data-commerce-unavailable]").first()).toBeHidden();
  });

  test(`${route}: service activation refreshes without a reload`, async ({ page }) => {
    await setup(page, { ok: false, code: "COMMERCE_DISABLED" }, 503);
    await page.goto(`/${route}/`);
    await expect(page.locator("[data-commerce-state=disabled]")).toBeVisible();
    await page.route("**/api/commerce**", request => request.fulfill({ json: sampleCatalog() }));
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.locator("[data-commerce-state=ready]")).toBeVisible();
    await expect(page.locator("[data-commerce-unavailable]").first()).toBeHidden();
    await expect(page.locator(route === "shop" ? ".shop-product" : ".merit-campaign")).toHaveCount(route === "shop" ? 8 : 4);
  });
}

test("existing and new shop CMS bindings remain editable", async ({ page }) => {
  await setup(page, { ok: false, code: "COMMERCE_DISABLED" }, 503, [
    { selector: '[data-cms-field="3746c99e-4"]', kind: "text", value: "ร้านค้าฉบับแก้ไขจาก CMS" },
    { selector: '[data-cms-field="shop-follow-link"]', kind: "attr", attr: "href", value: "/contact/" },
  ]);
  await page.goto("/shop/");
  await expect(page.getByRole("heading", { name: "ร้านค้าฉบับแก้ไขจาก CMS" })).toBeVisible();
  await expect(page.locator('[data-cms-field="shop-follow-link"]')).toHaveAttribute("href", "/contact/");
});

test("merit desktop and mobile art remain CMS-owned", async ({ page }, info) => {
  const field = info.project.name.includes("mobile") ? "merit-closed-mobile-image" : "merit-closed-image";
  await setup(page, { ok: false, code: "COMMERCE_DISABLED" }, 503, [
    { selector: `[data-cms-field="${field}"]`, kind: "attr", attr: "src", value: "/assets/images/merit-robes-banner.webp" },
  ], "merit");
  await page.goto("/merit/");
  const image = page.locator(`[data-cms-field="${field}"]`);
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("src", "/assets/images/merit-robes-banner.webp");
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
});
