import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { editableNavigationGroups } from "../../src/lib/site-navigation.js";

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

test("commerce breadcrumbs follow live CMS hierarchy and keep the shared schema in sync", async ({ page }) => {
  const store = await mockContent(page);
  const breadcrumb = page.locator(".commerce-breadcrumb");
  const labels = () => breadcrumb.locator(':scope > :not([aria-hidden="true"])');
  await page.goto("/shop/");
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
  await expect(labels()).toHaveText(["หน้าแรก", "ร้านค้าและร่วมบุญ", "วัตถุมงคลและเครื่องราง"]);
  const group = store.content().navigation.tabs.find(item => item.id === "commerce");
  group.label = "ร้านค้าและงานบุญ";
  group.items[0].label = "สินค้าจากชุมชน";
  group.items[0].href = "shop/?category=all";
  await page.evaluate(() => (window as any).MongkolWelaCMS.reload());
  await expect(labels()).toHaveText(["หน้าแรก", "ร้านค้าและงานบุญ", "สินค้าจากชุมชน"]);
  const schema = JSON.parse(await page.locator("[data-navigation-breadcrumb-jsonld]").textContent());
  expect(schema.itemListElement.map(item => item.name)).toEqual(["หน้าแรก", "ร้านค้าและงานบุญ", "สินค้าจากชุมชน"]);
  group.enabled = false;
  await page.evaluate(() => (window as any).MongkolWelaCMS.reload());
  await expect(labels()).toHaveText(["หน้าแรก", "วัตถุมงคลและเครื่องราง"]);
  group.enabled = true;
  group.items[0].label = "ร้านค้ากลาง";
  await page.evaluate(() => (window as any).MongkolWelaCMS.reload());
  await expect(labels()).toHaveText(["หน้าแรก", "ร้านค้าและงานบุญ", "วัตถุมงคลและเครื่องราง"]);
  await page.goto("/merit/");
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
  await expect(labels()).toHaveText(["หน้าแรก", "ร้านค้าและงานบุญ", "กฐินและร่วมบุญ"]);
  await expect(page.locator("main .commerce-nav")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("commerce navigation reaches both routes on desktop and mobile", async ({ page }, testInfo) => {
  await mockContent(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/shop/");
  const group = await openCommerceMenu(page);
  await expect(group.locator('[data-nav-id="shop"]')).toHaveAttribute("aria-current", "page");
  await expect(group.getByRole("link", { name: "วัตถุมงคลและเครื่องราง", exact: true })).toHaveAttribute("href", "/shop/");
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
  await meritGroup.getByRole("link", { name: "วัตถุมงคลและเครื่องราง", exact: true }).click();
  await expect(page).toHaveURL(/\/shop\/$/);
  expect(errors).toEqual([]);
});

test("Admin can publish commerce labels, destinations and visibility without restoring seeds", async ({ page }) => {
  const store = await mockContent(page);
  const index = seed.navigation.tabs.findIndex((tab) => tab.id === "commerce");
  const editor = page.locator(".mw-menu-editor");
  const field = (suffix, name) => editor.locator(`[data-menu-path="tabs.${index}${suffix}"][data-menu-field="${name}"]`);
  const openEditor = async () => {
    await expect(page.locator("#adminNav")).toBeAttached();
    if (await page.locator(".mw-admin-sidebar").evaluate((el: HTMLElement) => el.inert)) await page.getByRole("button", { name: "เปิดเมนู", exact: true }).click();
    await page.locator('#adminNav [data-section="navigation"]').click();
    const menu = page.locator(`[data-menu-open="${index}"]`);
    if (await menu.getAttribute("aria-expanded") !== "true") await menu.click();
  };
  const openItems = async () => {
    const tab = editor.locator('[data-menu-pane-button="items"]');
    if (await tab.isVisible()) await tab.click();
  };
  await page.goto("/admin/");
  await openEditor();
  await expect(field("", "label")).toHaveValue("ร้านค้าและร่วมบุญ");
  await field("", "label").fill("ร้านค้าและงานบุญ");
  await openItems();
  await field(".items.0", "label").fill("สินค้าจากทุกสถานที่");
  await field(".items.0", "href").fill("shop/?category=all");
  await field(".items.1", "enabled").uncheck();
  await page.locator('[data-action="publish"]:visible').first().click();
  await expect(page.locator("#adminStatus")).toContainText("เผยแพร่แล้ว");
  expect(store.publications()).toBe(1);
  await page.reload();
  await openEditor();
  await expect(field("", "label")).toHaveValue("ร้านค้าและงานบุญ");
  await openItems();
  await expect(field(".items.1", "enabled")).not.toBeChecked();
  await page.goto("/shop/");
  const group = await openCommerceMenu(page);
  await expect(group.locator('[data-nav-id="commerce"]')).toHaveText("ร้านค้าและงานบุญ");
  await expect(group.getByRole("link", { name: "สินค้าจากทุกสถานที่", exact: true })).toHaveAttribute("href", "/shop/?category=all");
  await expect(group.locator('[data-nav-id="merit"]')).toHaveCount(0);
  await expect(page.locator('.commerce-breadcrumb > :not([aria-hidden="true"])')).toHaveText(["หน้าแรก", "ร้านค้าและงานบุญ", "สินค้าจากทุกสถานที่"]);
  const unrelatedTabs = store.content().navigation.tabs.filter((entry) => entry.id !== "commerce");
  expect(editableNavigationGroups(unrelatedTabs)).toEqual(editableNavigationGroups(seed.navigation.tabs.filter((entry) => entry.id !== "commerce")));
  store.content().navigation.tabs[index].enabled = false;
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
  await expect(page.locator('[data-nav-item-id="commerce"]')).toHaveCount(0);
});
