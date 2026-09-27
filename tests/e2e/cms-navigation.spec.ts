import { expect, test } from "@playwright/test";

const liveCmsContent = {
  schemaVersion: 1,
  site: {
    name: "มงคลเวลา",
    locale: "th",
    pdpa: { analyticsConsentRequired: false },
  },
  navigation: {
    tabs: [{ id: "calendar", label: "วันพระ", href: "calendar/", enabled: true, items: [] }],
    utility: [],
  },
  pages: [
    { id: "home", label: "หน้าแรก", route: "/", enabled: true, kind: "existing", patches: [], sections: [], blocks: [] },
  ],
};

const fallbackCmsContent = {
  schemaVersion: 1,
  cmsContractVersion: 2,
  site: {
    name: "มงคลเวลา",
    locale: "th",
    pdpa: { analyticsConsentRequired: false },
  },
  navigation: {
    tabs: [{ id: "fallback-calendar", label: "เมนูสำรอง", href: "calendar/", enabled: true, items: [] }],
    utility: [],
  },
  pages: [
    { id: "home", label: "หน้าแรก", route: "/", enabled: true, kind: "existing", patches: [], sections: [], blocks: [] },
  ],
};

test("visitor runtime ignores stale local drafts and does not fetch fallback when live API is usable", async ({ page }) => {
  let fallbackRequests = 0;
  let releaseContent!: () => void;
  const contentReady = new Promise<void>(resolve => { releaseContent = resolve; });

  await page.addInitScript(() => {
    window.localStorage.setItem(
      "mongkolwela.cms.content",
      JSON.stringify({
        schemaVersion: 1,
        cmsContractVersion: 2,
        navigation: {
          tabs: [{ id: "names", label: "ชื่อและตัวเลข", href: "#names", enabled: true, items: [] }],
          utility: [],
        },
        pages: [],
      }),
    );
  });

  await page.route("**/api/admin/content?*", async (route) => {
    await contentReady;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, content: liveCmsContent }),
    });
  });

  await page.route("**/admin/content/default.json?*", (route) => {
    fallbackRequests += 1;
    route.fulfill({ status: 500, body: "fallback should not be requested while live content is usable" });
  });

  await page.route("**/api/admin/analytics", (route) => {
    route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  const menu = page.locator("[data-header-desktop]");
  await expect(page.locator("html")).toHaveClass(/cms-navigation-pending/);
  await expect(menu.locator(":scope > *")).not.toHaveCount(0);
  await expect(menu.locator("a").filter({ hasText: /^ชื่อและตัวเลข$/ })).toHaveCount(0);
  expect(fallbackRequests).toBe(0);

  releaseContent();
  await expect(page.locator("html")).not.toHaveClass(/cms-navigation-pending/);
  if ((page.viewportSize()?.width || 0) < 1280) {
    await page.getByRole("button", { name: "เปิดเมนู" }).click();
  }

  await expect(page.locator(".mw-header").getByRole("link", { name: /^วันพระ(?: เปิด)?$/ }).filter({ visible: true }).first()).toBeVisible();
  await expect(menu.getByRole("link", { name: "วัดดังเสริมมงคล", exact: true })).toHaveCount(0);
  await expect(menu.getByRole("link", { name: "วางแผนไหว้พระ", exact: true })).toHaveCount(0);
  expect(fallbackRequests).toBe(0);
});

test("visitor runtime shows an outage and retries live without falling back", async ({ page }) => {
  let fallbackRequests = 0;

  await page.route("**/api/admin/content?*", (route) => {
    route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false }) });
  });

  await page.route("**/admin/content/default.json?*", (route) => {
    fallbackRequests += 1;
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fallbackCmsContent),
    });
  });

  await page.route("**/api/admin/analytics", (route) => {
    route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).not.toHaveClass(/cms-navigation-pending/);
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "false");
  await expect(page.locator("[data-cms-load-error]")).toBeVisible();

  const menu = page.locator(".mw-header");
  if ((page.viewportSize()?.width || 0) < 1280) {
    await page.getByRole("button", { name: "เปิดเมนู" }).click();
  }

  await expect(menu.getByRole("link", { name: "เมนูสำรอง", exact: true })).toHaveCount(0);
  expect(fallbackRequests).toBe(0);
  if ((page.viewportSize()?.width || 0) < 1280) await page.getByRole("button", { name: "ปิดเมนู" }).click();
  await page.route("**/api/admin/content?*", (route) => route.fulfill({ json: { ok: true, content: liveCmsContent } }));
  await page.locator("[data-cms-load-error] button").click();
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
  await expect(page.locator("[data-cms-load-error]")).toHaveCount(0);
});
