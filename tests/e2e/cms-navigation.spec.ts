import { expect, test } from "@playwright/test";

const cmsContent = {
  schemaVersion: 1,
  cmsContractVersion: 2,
  site: {
    name: "มงคลเวลา",
    locale: "th",
    pdpa: { analyticsConsentRequired: false },
  },
  navigation: {
    tabs: [
      { id: "calendar", label: "วันพระ", href: "calendar/", enabled: true, items: [] },
    ],
    utility: [],
  },
  pages: [
    { id: "home", label: "หน้าแรก", route: "/", enabled: true, kind: "existing", patches: [], sections: [], blocks: [] },
  ],
};

test("visitor navigation shows bundled fallback immediately and replaces it with CMS content", async ({ page }) => {
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
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, content: cmsContent }),
    });
  });

  await page.route("**/api/admin/analytics", (route) => {
    route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  const menu = page.locator("#primary-menu");
  const fallbackLink = menu.locator("a").filter({ hasText: /^วัดดังเสริมมงคล$/ });
  const staleDraftLink = menu.locator("a").filter({ hasText: /^ชื่อและตัวเลข$/ });
  await expect(page.locator("html")).toHaveClass(/cms-navigation-pending/);
  await expect(menu.locator(":scope > *")).not.toHaveCount(0);
  await expect(fallbackLink).toHaveCount(1);
  await expect(staleDraftLink).toHaveCount(0);

  await expect(page.locator("html")).not.toHaveClass(/cms-navigation-pending/);
  if ((page.viewportSize()?.width || 0) <= 720) {
    await page.getByRole("button", { name: "เปิดเมนู" }).click();
  }
  await expect(menu.getByRole("link", { name: "วันพระ", exact: true })).toBeVisible();
  await expect(menu.getByRole("link", { name: "วัดดังเสริมมงคล", exact: true })).toHaveCount(0);
});
