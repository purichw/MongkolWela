import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";

const seed = JSON.parse(readFileSync(new URL("../../public/admin/content/live.json", import.meta.url), "utf8"));
const route = "/temples/popular/001-ว-ดระฆ-งโฆส-ตาราม-กร-งเทพมหานคร/";
const fixtures = () => ({
  ok: true,
  products: Array.from({ length: 5 }, (_, i) => ({
    id: `qa-product-${i}`, orgId: "qa-org", title: `สินค้าทดสอบ ${i + 1}: ชุดเครื่องสักการะสำหรับร่วมงานบุญ`,
    description: "ข้อมูลและภาพตัวอย่างสำหรับทดสอบการจัดวาง ไม่ใช่สินค้าจำหน่ายจริง",
    imageUrl: "/assets/images/temple-placeholder-auspicious.png", imageAlt: "ภาพตัวอย่างสำหรับทดสอบ",
    priceSatang: [5000, 2000, 29900, 59900, 19900][i], available: i === 3 ? 0 : 2,
  })),
  organizations: [{ id: "qa-org", name: "ผู้จำหน่ายตัวอย่างสำหรับทดสอบ" }],
  campaigns: [], channels: [], directoryUrl: "https://data.rd.go.th/th/dataset/ds_edonation",
});
const events = () => Array.from({ length: 5 }, (_, i) => ({
  id: `qa-event-${i}`, title: ["ทำบุญตักบาตรและฟังธรรม (ข้อมูลทดสอบ)", "ปฏิบัติธรรมวันพระ (ข้อมูลทดสอบ)", "สวดมนต์เย็นและเจริญภาวนา (ข้อมูลทดสอบ)", "กิจกรรมจิตอาสา (ข้อมูลทดสอบ)", "กิจกรรมที่ผ่านมา (ข้อมูลทดสอบ)"][i],
  type: ["ceremony", "meditation", "teaching", "volunteer", "ceremony"][i],
  status: i === 2 ? "cancelled" : "published", past: i === 4,
  startDate: i === 4 ? "2020-01-01" : `2030-11-${10 + i}`, timeMode: "timed", startTime: "08:00", endTime: "12:00",
  venue: "ศาลาการเปรียญ (สถานที่ทดสอบ)", description: "ประกาศตัวอย่างสำหรับตรวจสอบรูปแบบการแสดงผลเท่านั้น ไม่ใช่กิจกรรมจริง",
  sourceUrl: "https://example.org/announcement", registrationUrl: "https://example.org/register",
  statusNote: "ผู้จัดแจ้งยกเลิกกิจกรรม", verifiedAt: "2026-09-21",
  imageUrl: ["/assets/images/temple-guide-visit-prep.jpg", "", "/assets/images/chinese-incense-card.jpg", "/assets/images/qa-missing.jpg", ""][i],
  imageAlt: "ภาพตัวอย่างสำหรับทดสอบการแสดงกิจกรรม",
}));

async function mockContent(page, activity, commerce) {
  await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
  await page.route("**/api/admin/content?**", r => r.fulfill({ json: { ok: true, revision: "community-qa", content: seed } }));
  await page.route("**/api/temple-activities?**", r => r.fulfill(activity()));
  await page.route("**/api/commerce?**", r => r.fulfill(commerce()));
}
async function capture(page, name) {
  await page.evaluate(() => document.fonts.ready);
  const activities = page.locator("[data-temple-activities]");
  const commerce = page.locator("[data-temple-commerce]");
  await activities.scrollIntoViewIfNeeded();
  await commerce.scrollIntoViewIfNeeded();
  await page.locator(".temple-shop-media img, [data-activity-image]").evaluateAll(async images => {
    for (const image of images) await (image as HTMLImageElement).decode().catch(() => {});
  });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(150);
  const top = await activities.boundingBox(), bottom = await commerce.boundingBox();
  const scrollY = await page.evaluate(() => window.scrollY);
  const width = page.viewportSize().width;
  await fs.mkdir(".local/temple-sections-qa", { recursive: true });
  await page.screenshot({
    path: `.local/temple-sections-qa/${name}-${width}.png`, fullPage: true, animations: "disabled",
    clip: { x: Math.max(0, top.x - 12), y: top.y + scrollY - 20, width: Math.min(width, top.width + 24), height: bottom.y + bottom.height - top.y + 40 },
  });
  await page.screenshot({ path: `.local/temple-sections-qa/${name}-activities-${width}.png`, fullPage: true, animations: "disabled", clip: { x: Math.max(0, top.x - 12), y: top.y + scrollY - 20, width: Math.min(width, top.width + 24), height: top.height + 40 } });
  if (name === "populated") {
    const products = await commerce.locator(".temple-shop-products").boundingBox();
    const x = Math.max(0, top.x - 40);
    await page.screenshot({ path: `.local/temple-sections-qa/compact-cards-${width}.png`, fullPage: true, animations: "disabled", clip: { x, y: top.y + scrollY - 20, width: Math.min(width - x, top.width + 80), height: products.y + products.height - top.y + 40 } });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

test("empty sections follow the reference without treating failures as empty data", async ({ page }) => {
  let activityFailure = false, commerceFailure = false;
  await mockContent(page,
    () => activityFailure ? { status: 503, json: { ok: false } } : { json: { ok: true, revision: "empty", events: [] } },
    () => ({ status: 503, json: { ok: false, code: commerceFailure ? "UNAVAILABLE" : "COMMERCE_DISABLED" } }));
  await page.goto(route);
  const activities = page.locator("[data-temple-activities]"), shop = page.locator("[data-temple-commerce]");
  await expect(activities.locator(".temple-section-empty")).toContainText("ยังไม่มีประกาศกิจกรรมที่ยืนยันในระบบ");
  await expect(shop.locator(".temple-section-empty")).toContainText("ยังไม่เปิดบริการ");
  await expect(shop.getByRole("link", { name: /ดูร้านค้ากลาง/ })).toHaveAttribute("href", "/shop/");
  await expect(shop.getByRole("link", { name: /ดูการร่วมบุญ/ })).toHaveAttribute("href", "/merit/");
  await expect(activities.locator(".temple-empty-disc .site-icon-mask")).toHaveCSS("mask-image", /calendar-days\.svg/);
  await expect(shop.locator(".temple-empty-disc .site-icon-mask")).toHaveCSS("mask-image", /handbag\.svg/);
  await capture(page, "empty");
  await activities.getByRole("button", { name: "ที่ผ่านมา", exact: true }).click();
  await expect(activities).toContainText("ยังไม่มีกิจกรรมที่ผ่านมาในระบบ");
  activityFailure = true; commerceFailure = true;
  await page.reload();
  await expect(activities.getByRole("button", { name: "ลองใหม่", exact: true })).toBeVisible();
  await expect(shop.getByRole("button", { name: "ลองใหม่", exact: true })).toBeVisible();
  await expect(page.locator(".temple-section-empty")).toHaveCount(0);
  activityFailure = false; commerceFailure = false;
  await activities.getByRole("button", { name: "ลองใหม่", exact: true }).click();
  await shop.getByRole("button", { name: "ลองใหม่", exact: true }).click();
  await expect(page.locator(".temple-section-empty")).toHaveCount(2);
});

test("populated cards retain details, inventory, refresh, and donation destinations", async ({ page }, testInfo) => {
  if (testInfo.project.name === "chromium-mobile") await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  let eventRows = events(), catalog = fixtures(), failed = false;
  await fs.mkdir(".local/temple-sections-qa", { recursive: true });
  await fs.writeFile(".local/temple-sections-qa/fixture-data.json", JSON.stringify({ events: eventRows, catalog }));
  await mockContent(page,
    () => failed ? { status: 503, json: { ok: false } } : { json: { ok: true, revision: JSON.stringify(eventRows), events: eventRows } },
    () => ({ json: catalog }));
  await page.goto(route);
  const activities = page.locator("[data-temple-activities]"), shop = page.locator("[data-temple-commerce]");
  await expect(activities.locator(".temple-activity")).toHaveCount(3);
  await expect(activities.locator('[data-has-image="true"]')).toHaveCount(2);
  await expect(activities.locator('[data-has-image="false"]')).toHaveCount(1);
  await expect(shop.locator(".temple-shop-product")).toHaveCount(4);
  await expect(shop.locator(".temple-shop-product").nth(3)).toContainText("สินค้าหมด");
  await expect(shop.locator(".temple-shop-action").first()).toHaveAttribute("href", "/shop/?product=qa-product-0");
  await expect(shop.getByRole("link", { name: /ดูการร่วมบุญ/ })).toHaveAttribute("href", "#temple-merit-details");
  await expect(shop.getByRole("link", { name: /กรมสรรพากร/ })).toHaveAttribute("href", catalog.directoryUrl);
  async function expectCompactCards() {
    const heights = await page.locator(".temple-activity, .temple-shop-product").evaluateAll(cards => cards.map(card => card.getBoundingClientRect().height));
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1);
    expect(Math.max(...heights)).toBeLessThanOrEqual(256);
    for (const selector of [".temple-activity", ".temple-shop-product"]) {
      const widths = await page.locator(selector).evaluateAll(cards => cards.map(card => card.getBoundingClientRect().width));
      expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1);
    }
  }
  await expectCompactCards();
  await capture(page, "populated");
  if (testInfo.project.name === "chromium-desktop") {
    const baseline = JSON.parse(await fs.readFile(".local/temple-sections-qa/before-metrics.json", "utf8").catch(() => "{}"));
    for (const width of [1440, 390, 320, 768, 1024]) {
      await page.setViewportSize({ width, height: 1000 });
      await expectCompactCards();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      if (baseline[width]) {
        for (const selector of [".pd-hero", ".pd-overview", ".pd-travel"]) {
          const box = await page.locator(selector).evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height }; });
          for (const key of ["x", "y", "width", "height"]) expect(Math.abs(box[key] - baseline[width][selector][key]), `${selector} ${width} ${key}`).toBeLessThan(1);
        }
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  const axe = await new AxeBuilder({ page }).include("[data-temple-activities]").include("[data-temple-commerce]").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.filter(v => ["serious", "critical"].includes(v.impact))).toEqual([]);
  await shop.locator("[data-temple-products-more]").click();
  await expect(shop.locator(".temple-shop-product")).toHaveCount(5);
  await shop.locator("[data-temple-products-more]").click();
  await expect(shop.locator(".temple-shop-product")).toHaveCount(4);
  await activities.locator("[data-activities-more]").click();
  await expect(activities.locator(".temple-activity")).toHaveCount(4);
  const missingImage = activities.locator('[data-activity-details="qa-event-3"]').locator("xpath=../..");
  await missingImage.scrollIntoViewIfNeeded();
  await expect(missingImage).toHaveAttribute("data-has-image", "false");
  const cancelled = activities.locator('[data-status="cancelled"]');
  await cancelled.locator("summary").click();
  await expect(cancelled.getByRole("link", { name: /ลงทะเบียน/ })).toHaveCount(0);
  const detail = activities.locator('[data-activity-details="qa-event-0"]');
  await detail.locator("summary").click();
  await expect(detail.getByRole("link", { name: /ลงทะเบียน/ })).toHaveAttribute("href", "https://example.org/register");
  failed = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(activities.locator(".temple-activities-stale")).toBeVisible();
  await expect(activities.locator(".temple-activity")).toHaveCount(4);
  await expect(detail).toHaveAttribute("open", "");
  failed = false;
  eventRows[0].title = "ชื่อประกาศที่อัปเดตจาก CMS";
  await activities.locator("[data-activities-retry]").click();
  await expect(activities).toContainText("ชื่อประกาศที่อัปเดตจาก CMS");
  await expect(detail).toHaveAttribute("open", "");
  await activities.getByRole("button", { name: "ที่ผ่านมา", exact: true }).click();
  await expect(activities.locator(".temple-activity")).toHaveCount(1);
  catalog.products = [];
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(shop).toContainText("ยังไม่มีสินค้าที่เผยแพร่สำหรับสถานที่นี้");
  await expect(shop).not.toContainText("ออนไลน์ยังไม่เปิดบริการ");
  if (testInfo.project.name === "chromium-desktop") {
    for (const width of [320, 768, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    }
  }
  expect(errors).toEqual([]);
});
