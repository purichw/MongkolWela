import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const seed = JSON.parse(readFileSync(new URL("../../public/admin/content/live.json", import.meta.url), "utf8"));

async function mockContent(page) {
  let content = structuredClone(seed);
  let publications = 0;
  await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
  await page.route("**/api/admin/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/admin/content") {
      if (request.method() === "POST") {
        content = { ...request.postDataJSON().content, publishedAt: new Date().toISOString() };
        publications++;
      }
      return route.fulfill({ json: { ok: true, content, revision: String(publications), meta: { fast: true } } });
    }
    const responses = {
      "/api/admin/session": { ok: true },
      "/api/admin/temples": { ok: true, temples: [] },
      "/api/admin/media": { ok: true, media: { provider: "", cloudinary: { enabled: false }, imagekit: { enabled: false } } },
      "/api/admin/analytics": { ok: true, analytics: { totals: { pageviews: 0, events: 0 }, paths: {} } },
    };
    return route.fulfill({ json: responses[pathname] || { ok: false } });
  });
  await page.route("**/api/commerce**", (route) => route.fulfill({
    status: 503,
    json: { ok: false, code: "COMMERCE_DISABLED", error: "ระบบร้านค้าและร่วมบุญยังไม่เปิดบริการ" },
  }));
  return { content: () => content, publications: () => publications };
}

async function openCommerceMenu(page) {
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
  const compact = await page.locator(".mw-header").getAttribute("data-header-mode") === "compact";
  const group = page.locator(compact ? '[data-nav-key="mobile-group-commerce"]' : '[data-nav-item-id="commerce"]');
  if (compact) {
    await page.locator(".mw-menu-toggle").click();
    if (!(await group.evaluate((element: HTMLDetailsElement) => element.open))) await group.locator(":scope > summary").click();
  } else {
    await group.locator("summary").click();
  }
  return group;
}

test("commerce navigation reaches both routes on desktop and mobile", async ({ page }, testInfo) => {
  await mockContent(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/shop/");
  const group = await openCommerceMenu(page);
  await expect(group.locator('[data-nav-id="shop"]')).toHaveAttribute("aria-current", "page");
  await expect(group.getByRole("link", { name: "ร้านค้ากลาง", exact: true })).toHaveAttribute("href", "/shop/");
  await expect(group.getByRole("link", { name: "กฐินและร่วมบุญ", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (await page.locator(".mw-header").getAttribute("data-header-mode") === "compact") {
    expect(await page.locator(".mw-drawer-scroll").evaluate((menu) => menu.scrollWidth <= menu.clientWidth)).toBe(true);
  }
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath("commerce-navigation.png"), animations: "disabled" });
  await group.getByRole("link", { name: "กฐินและร่วมบุญ", exact: true }).click();
  await expect(page).toHaveURL(/\/merit\/$/);
  const meritGroup = await openCommerceMenu(page);
  await expect(meritGroup.locator('[data-nav-id="merit"]')).toHaveAttribute("aria-current", "page");
  await meritGroup.getByRole("link", { name: "ร้านค้ากลาง", exact: true }).click();
  await expect(page).toHaveURL(/\/shop\/$/);
  expect(errors).toEqual([]);
});

test("Admin can publish commerce labels, destinations and visibility without restoring seeds", async ({ page }) => {
  const store = await mockContent(page);
  await page.goto("/admin/");
  await page.getByRole("button", { name: /เมนูเว็บไซต์/ }).click();
  const index = seed.navigation.tabs.findIndex((tab) => tab.id === "commerce");
  const tab = page.locator(`[data-nav-tab="${index}"]`);
  await expect(tab.locator('[data-nav-tab-field="label"]')).toHaveValue("ร้านค้าและร่วมบุญ");
  await tab.locator('[data-nav-tab-field="label"]').fill("ร้านค้าและงานบุญ");
  await tab.locator('[data-nav-item="0"] [data-nav-item-field="label"]').fill("สินค้าจากทุกสถานที่");
  await tab.locator('[data-nav-item="0"] [data-nav-item-field="href"]').fill("shop/?category=all");
  await tab.locator('[data-nav-item="1"] [data-nav-item-enabled]').uncheck();
  await page.locator('[data-action="publish"]').click();
  await expect(page.locator("#adminStatus")).toContainText("เผยแพร่แล้ว");
  expect(store.publications()).toBe(1);
  await page.reload();
  await page.getByRole("button", { name: /เมนูเว็บไซต์/ }).click();
  await expect(tab.locator('[data-nav-tab-field="label"]')).toHaveValue("ร้านค้าและงานบุญ");
  await expect(tab.locator('[data-nav-item="1"] [data-nav-item-enabled]')).not.toBeChecked();
  await page.goto("/shop/");
  const group = await openCommerceMenu(page);
  await expect(group.locator('[data-nav-id="commerce"]')).toHaveText("ร้านค้าและงานบุญ");
  await expect(group.getByRole("link", { name: "สินค้าจากทุกสถานที่", exact: true })).toHaveAttribute("href", "/shop/?category=all");
  await expect(group.locator('[data-nav-id="merit"]')).toHaveCount(0);
  const unrelatedTabs = store.content().navigation.tabs.filter((entry) => entry.id !== "commerce");
  expect(unrelatedTabs).toEqual(seed.navigation.tabs.filter((entry) => entry.id !== "commerce"));
  store.content().navigation.tabs[index].enabled = false;
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
  await expect(page.locator('[data-nav-item-id="commerce"]')).toHaveCount(0);
});
