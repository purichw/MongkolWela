import { expect, test } from "@playwright/test";

const imageUrl =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1600' height='1000' viewBox='0 0 1600 1000'%3E%3Crect width='1600' height='1000' fill='%23ead6a7'/%3E%3Cpath d='M300 780h1000L800 180z' fill='%239c3026'/%3E%3C/svg%3E";

const collections = [
  { key: "popular", label: "สายไหว้พระ 9 วัด", name: "วัดระฆังโฆสิตาราม" },
  { key: "mu", label: "สายมู", name: "วัดพระแก้ว" },
  { key: "sacred", label: "วัดศักดิ์สิทธิ์", name: "วัดโสธรวราราม" },
];

const temples = collections.flatMap((collection) => {
  const count = collection.key === "sacred" ? 50 : 1;
  return Array.from({ length: count }, (_, index) => {
    const rank = index + 1;
    const paddedRank = String(rank).padStart(3, "0");
    return {
      key: `${collection.key}:${paddedRank}`,
      collection: collection.key,
      collectionLabel: collection.label,
      slug: `${paddedRank}-${collection.key}`,
      detailUrl: `/temples/${collection.key}/${paddedRank}-${collection.key}/`,
      source: "dataset",
      temple: {
        rank,
        name: rank === 1 ? collection.name : `วัดทดสอบ ${rank}`,
        province: "กรุงเทพมหานคร",
        district: "พระนคร",
        imageUrl,
        images: {
          card: { desktop: { url: imageUrl }, mobile: { url: imageUrl } },
          hero: { desktop: { url: imageUrl }, mobile: { url: imageUrl } },
          map: { desktop: { url: imageUrl }, mobile: { url: imageUrl } },
        },
      },
      visitInfo: {},
    };
  });
});

async function mockAdminApis(page) {
  let publishedContent;
  await page.route("**/api/admin/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/admin/content" && route.request().method() === "POST") {
      publishedContent = { ...route.request().postDataJSON().content, publishedAt: new Date().toISOString() };
      await route.fulfill({ json: { ok: true, content: publishedContent, meta: { fast: true } } });
      return;
    }
    const responses = {
      "/api/admin/session": { ok: true, actor: "Playwright" },
      "/api/admin/content": {
        ok: true,
        content: publishedContent || {
          schemaVersion: 1,
          pages: [],
          navigation: { tabs: [], utility: [] },
          components: { cards: [] },
          temples: { records: {} },
        },
      },
      "/api/admin/temples": { ok: true, temples },
      "/api/admin/media": {
        ok: true,
        media: { provider: "", cloudinary: { enabled: false }, imagekit: { enabled: false } },
      },
      "/api/admin/analytics": {
        ok: true,
        analytics: { totals: { pageviews: 0, events: 0 }, paths: {} },
      },
    };
    const body = responses[pathname];
    await route.fulfill({
      status: body ? 200 : 404,
      contentType: "application/json",
      body: JSON.stringify(body || { ok: false, error: "Not found" }),
    });
  });
}

test.describe("Temple Admin Portal", () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminApis(page);
    await page.goto("/admin/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /สถานที่ศักดิ์สิทธิ์/ }).click();
  });

  test("supports category navigation, live editing, search, and create", async ({ page }) => {
    await expect(page.getByRole("tab", { name: "สายไหว้พระ 9 วัด 1", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.locator('[data-edit-temple="popular:001"]').click();
    await expect(page.getByLabel("ชื่อสถานที่", { exact: true })).toHaveValue("วัดระฆังโฆสิตาราม");
    await expect(page.locator("[data-image-role][data-image-viewport]")).toHaveCount(6);

    await page.getByLabel("ชื่อสถานที่", { exact: true }).fill("วัดทดสอบระบบ Admin");
    await expect(page.locator("[data-temple-editor-name]")).toHaveText("วัดทดสอบระบบ Admin");
    await expect(page.locator('[data-temple-row="popular:001"] [data-temple-table-title]')).toContainText(
      "วัดทดสอบระบบ Admin",
    );
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();

    await page.getByRole("tab", { name: "วัดศักดิ์สิทธิ์ 50", exact: true }).click();
    await page.locator("[data-temple-search]").fill("โสธร");
    await expect(page.locator("[data-temple-row]")).toHaveCount(1);
    await page.locator('[data-edit-temple="sacred:001"]').click();
    await expect(page.getByLabel("ชื่อสถานที่", { exact: true })).toHaveValue("วัดโสธรวราราม");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();

    await page.getByRole("button", { name: "+ เพิ่มวัด", exact: true }).click();
    const createDrawer = page.getByRole("dialog", { name: /ข้อมูลวัด\/สถานที่/ });
    await expect(createDrawer).toBeVisible();
    await expect(createDrawer.getByLabel("ชื่อสถานที่", { exact: true })).toHaveValue("สถานที่ใหม่");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
  });

  test("publishes edited content and verifies the latest revision", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.locator('[data-edit-temple="popular:001"]').click();
    await page.getByLabel("ชื่อสถานที่", { exact: true }).fill("ชื่อที่เผยแพร่ล่าสุด");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    const published = page.waitForRequest((request) => request.url().endsWith("/api/admin/content") && request.method() === "POST");
    await page.locator('[data-action="publish"]').first().click();
    expect((await published).postDataJSON().content.temples.records["popular:001"].fields.name).toBe("ชื่อที่เผยแพร่ล่าสุด");
    await expect(page.locator("[data-publish-progress-title]")).toHaveText("หน้าเว็บอัปเดตแล้ว");
    await expect(page.locator('[data-action="publish"]').first()).toBeEnabled();
    expect(errors).toEqual([]);
  });

  test("opens a fixed-ratio crop editor for an existing image", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "crop interaction is covered once");
    await page.locator('[data-edit-temple="popular:001"]').click();
    const imageField = page.locator(
      '.mw-admin-image-field[data-image-role="card"][data-image-viewport="desktop"]',
    );
    await imageField.getByRole("button", { name: "ครอปรูป", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "ครอปรูป รูปการ์ดรายการ · 16 : 10", exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("[data-crop-selection]")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "ครอปและบันทึก", exact: true })).toBeEnabled();
  });

  test("opens a row deep in the table without disturbing page scroll", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes("mobile"), "desktop table scrolling is covered once");
    await page.getByRole("tab", { name: "วัดศักดิ์สิทธิ์ 50", exact: true }).click();
    const item = page.locator('[data-temple-row="sacred:042"]');
    await item.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(0);

    await item.locator('[data-edit-temple="sacred:042"]').click();
    await expect(page.getByLabel("ชื่อสถานที่", { exact: true })).toHaveValue("วัดทดสอบ 42");
    await expect.poll(async () => Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThanOrEqual(2);
  });

  test("shows a clear fallback and rejects a broken image URL", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "broken image handling is covered once");
    await page.route("https://images.example.test/broken.jpg", (route) =>
      route.fulfill({ status: 404, contentType: "text/plain", body: "Not found" }),
    );
    await page.locator('[data-edit-temple="popular:001"]').click();

    const imageField = page.locator(
      '.mw-admin-image-field[data-image-role="card"][data-image-viewport="desktop"]',
    );
    const previewImage = imageField.locator("[data-admin-temple-image]");
    await previewImage.evaluate((image) => {
      image.setAttribute("src", "https://images.example.test/broken.jpg");
    });
    await expect(imageField.getByText("โหลดรูปไม่ได้")).toBeVisible();

    await imageField.getByRole("textbox").fill("https://images.example.test/broken.jpg");
    await imageField.getByRole("button", { name: "ใช้ลิงก์", exact: true }).click();
    await expect(page.locator("#adminStatus")).toContainText("ยังไม่บันทึกรูป");
  });
});
