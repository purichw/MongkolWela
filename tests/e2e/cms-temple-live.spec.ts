import { sitePlaceholderImage } from "../../src/lib/image-placeholder.js";
import { expect, test } from "@playwright/test";
import { watArunPopularRoute } from "../../src/data/nfr-key-routes.js";

test("published image clears and deleted places override built pages", async ({ page }) => {
  const slug = decodeURIComponent(watArunPopularRoute).split("/").filter(Boolean).at(-1);
  const record = { enabled: true, status: "published", fields: { name: "ชื่อจากข้อมูลสด", imageUrl: "", imageAlt: "" }, images: { card: { desktop: { url: "" }, mobile: { url: "" } }, hero: { desktop: { url: "" }, mobile: { url: "" } } } };
  const content = { schemaVersion: 1, cmsContractVersion: 2, navigation: { tabs: [], utility: [] }, pages: [], temples: { records: { [`popular:${slug}`]: record } } };
  await page.route("**/api/admin/content?*", (route) => route.fulfill({ json: { ok: true, content } }));
  await page.goto(watArunPopularRoute);
  await expect(page.locator("#temple-detail-title")).toHaveText(record.fields.name);
  await expect(page.locator(".temple-detail-hero__media img")).toHaveAttribute("src", sitePlaceholderImage);
  await expect(page.locator(".temple-detail-hero__media img")).toHaveAttribute("alt", "");
  record.enabled = false;
  record.status = "deleted";
  await page.evaluate(async () => { await (window as any).MongkolWelaCMS.reload(); });
  await expect(page.getByRole("heading", { name: "สถานที่นี้ไม่เปิดเผยแพร่" })).toBeVisible();
  await expect(page.locator("#temple-detail-title")).toHaveCount(0);
  await page.goto("/temples/popular/");
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
  await expect(page.locator("[data-popular-temple-card]").filter({ has: page.locator(`a[href="${watArunPopularRoute}"]`) })).toHaveCount(0);
  await page.locator("[data-popular-temple-filter-form]").dispatchEvent("submit");
  await expect(page.locator("[data-popular-temple-card]").filter({ has: page.locator(`a[href="${watArunPopularRoute}"]`) })).toHaveCount(0);
});
