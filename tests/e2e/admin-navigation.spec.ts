import { expect, test } from "@playwright/test";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

const initialContent = {
  schemaVersion: 1,
  pages: [{ id: "home", label: "หน้าแรก", route: "/", blocks: [], patches: [], sections: [], enabled: true }],
  navigation: {
    tabs: [
      {
        id: "horoscope",
        label: "ดูดวง",
        href: "/horoscope/",
        enabled: true,
        items: [{ id: "life-graph", label: "กราฟชีวิต", href: "/horoscope/life-graph/", enabled: true }],
      },
      { id: "calendar", label: "วันพระ", href: "/calendar/", enabled: true, items: [] },
    ],
    utility: [{ id: "admin-test", label: "ติดต่อ", href: "/contact/", enabled: true }],
  },
  components: { cards: [] },
  temples: { records: {} },
};

async function mockAdminApis(page) {
  let currentContent = clone(initialContent);

  await page.route("**/api/admin/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname === "/api/admin/session") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      return;
    }

    if (pathname === "/api/admin/content") {
      if (request.method() === "POST") {
        const body = JSON.parse(request.postData() || "{}");
        currentContent = {
          ...clone(body.content),
          cmsContractVersion: 2,
          publishedAt: "2026-06-19T12:00:00.000Z",
          updatedAt: "2026-06-19T12:00:00.000Z",
        };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            content: currentContent,
            meta: { mode: "test", fast: true, publishedAt: currentContent.publishedAt },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, content: currentContent }),
      });
      return;
    }

    const responses = {
      "/api/admin/temples": { ok: true, temples: [] },
      "/api/admin/media": { ok: true, media: { provider: "", cloudinary: { enabled: false }, imagekit: { enabled: false } } },
      "/api/admin/analytics": { ok: true, analytics: { totals: { pageviews: 0, events: 0 }, paths: {} } },
    };
    const body = responses[pathname];
    await route.fulfill({
      status: body ? 200 : 404,
      contentType: "application/json",
      body: JSON.stringify(body || { ok: false, error: "Not found" }),
    });
  });
}

async function navTabLabels(page) {
  return page.locator("[data-nav-tab-field='label']").evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value),
  );
}

async function navItemLabels(tab) {
  return tab.locator("[data-nav-item-field='label']").evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value),
  );
}

test.describe("Admin Portal Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminApis(page);
    await page.goto("/admin/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /เมนูเว็บไซต์/ }).click();
  });

  test("edits tabs and items, publishes, and keeps the result after reload", async ({ page }) => {
    const tabLabel = "เมนูทดสอบ Publish";
    const deletedTabLabel = "เมนูที่จะลบ";
    const firstItem = "รายการแรก";
    const secondItem = "รายการสอง";

    await page.getByRole("button", { name: "เพิ่มเมนูหลัก" }).click();
    await page.locator("[data-nav-tab]").last().locator("[data-nav-tab-field='label']").fill(tabLabel);
    await page.locator("[data-nav-tab]").last().locator("[data-nav-tab-field='href']").fill("/test-publish/");

    await page.getByRole("button", { name: "เพิ่มเมนูหลัก" }).click();
    await page.locator("[data-nav-tab]").last().locator("[data-nav-tab-field='label']").fill(deletedTabLabel);
    await page.locator("[data-nav-tab]").last().getByRole("button", { name: "ลบ" }).click();
    await expect(page.getByRole("dialog", { name: "ยืนยันการลบ" })).toBeVisible();
    await page.getByRole("button", { name: "ลบ", exact: true }).last().click();
    await expect(page.locator("[data-nav-tab]").filter({ hasText: deletedTabLabel })).toHaveCount(0);

    let tab = page.locator("[data-nav-tab]").filter({ hasText: tabLabel });
    const labelsBeforeMove = await navTabLabels(page);
    await tab.getByRole("button", { name: "ขึ้น" }).click();
    const labelsAfterMove = await navTabLabels(page);
    expect(labelsAfterMove.indexOf(tabLabel)).toBeLessThan(labelsBeforeMove.indexOf(tabLabel));

    tab = page.locator("[data-nav-tab]").filter({ hasText: tabLabel });
    await tab.locator("[data-nav-tab-enabled]").uncheck();
    await tab.getByRole("button", { name: "เพิ่มเมนูย่อย" }).click();
    tab = page.locator("[data-nav-tab]").filter({ hasText: tabLabel });
    await tab.getByRole("button", { name: "เพิ่มเมนูย่อย" }).click();
    tab = page.locator("[data-nav-tab]").filter({ hasText: tabLabel });

    await tab.locator("[data-nav-item]").nth(0).locator("[data-nav-item-field='label']").fill(firstItem);
    await tab.locator("[data-nav-item]").nth(0).locator("[data-nav-item-field='href']").fill("/first/");
    await tab.locator("[data-nav-item]").nth(0).locator("[data-nav-item-section]").check();
    await tab.locator("[data-nav-item]").nth(0).locator("[data-nav-item-enabled]").uncheck();
    await tab.locator("[data-nav-item]").nth(1).locator("[data-nav-item-field='label']").fill(secondItem);
    await tab.locator("[data-nav-item]").nth(1).locator("[data-nav-item-field='href']").fill("/second/");

    await tab.locator("[data-nav-item]").nth(1).getByRole("button", { name: "ขึ้น" }).click();
    tab = page.locator("[data-nav-tab]").filter({ hasText: tabLabel });
    expect(await navItemLabels(tab)).toEqual([secondItem, firstItem]);

    await tab.locator("[data-nav-item]").nth(1).getByRole("button", { name: "ลบ" }).click();
    await expect(page.getByRole("dialog", { name: "ยืนยันการลบ" })).toBeVisible();
    await page.getByRole("button", { name: "ลบ", exact: true }).last().click();
    tab = page.locator("[data-nav-tab]").filter({ hasText: tabLabel });
    await expect(tab.locator("[data-nav-item-field='label']")).toHaveCount(1);
    expect(await navItemLabels(tab)).toEqual([secondItem]);

    await page.locator('[data-action="publish"]').click();
    await expect(page.locator("#adminStatus")).toContainText("เผยแพร่แล้ว");

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /เมนูเว็บไซต์/ }).click();

    tab = page.locator("[data-nav-tab]").filter({ hasText: tabLabel });
    await expect(tab).toHaveCount(1);
    await expect(tab.locator("[data-nav-tab-enabled]")).not.toBeChecked();
    await expect(tab.locator("[data-nav-item-field='label']")).toHaveValue(secondItem);
    await expect(tab.locator("[data-nav-item-field='href']")).toHaveValue("/second/");
    await expect(page.locator("[data-nav-tab]").filter({ hasText: deletedTabLabel })).toHaveCount(0);
  });
});
