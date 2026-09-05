import { expect, test } from "@playwright/test";
import { createTemplePlannerPlan } from "../../src/lib/temple-planner-engine.js";

const catalog = () => ({ revision: "test-v1", filters: { regions: ["ภาคกลาง"], provinces: ["กรุงเทพมหานคร"], purposes: ["การงาน"] }, items: [1, 2, 3, 4, 5].map((id) => ({ id: `test-${id}`, name: `สถานที่ทดสอบ ${id}`, province: "กรุงเทพมหานคร", region: "ภาคกลาง", district: "", blessings: ["การงาน"], objectHero: [], collections: ["popular"], globalRank: id, visitMinutes: 30, latitude: 13.75 + id / 100, longitude: 100.5 + id / 100, imageUrl: "/assets/images/temple-placeholder-auspicious.png", imageAlt: "ภาพประกอบ", detailUrl: "/temples/" })) });

test("planner retries loading, keeps a working plan on errors, revalidates changes and restores only ids", async ({ page }) => {
  let data = catalog();
  let loadFailed = true;
  let planFailed = false;
  let changed = false;
  let posts = 0;
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/admin/content?*", (route) => route.fulfill({ json: { ok: true, content: { schemaVersion: 1, cmsContractVersion: 2, pages: [], navigation: { tabs: [], utility: [] } } } }));
  await page.route("**/api/temple-planner/data", (route) => route.fulfill({ status: loadFailed ? 503 : 200, json: loadFailed ? { error: "Test outage" } : data }));
  await page.route("**/api/temple-planner/plan", async (route) => {
    posts++;
    if (planFailed) { await route.fulfill({ status: 503, json: { error: "คำนวณไม่สำเร็จ" } }); return; }
    if (changed) {
      changed = false;
      data = { ...data, revision: "test-v2", items: data.items.map((item) => ({ ...item, name: `ชื่อใหม่ ${item.id}` })) };
      await route.fulfill({ status: 409, json: { code: "CATALOG_CHANGED", catalog: data, error: "ข้อมูลสถานที่มีการเปลี่ยนแปลง" } });
      return;
    }
    const result = createTemplePlannerPlan(data, route.request().postDataJSON());
    await route.fulfill({ json: { ...result, revision: data.revision, items: (result.planIds || []).map((id) => data.items.find((item) => item.id === id)) } });
  });
  await page.goto("/temples/planner/");
  await expect(page.locator("[data-planner-load-error]")).toHaveCount(1);
  loadFailed = false;
  await page.locator("[data-planner-location-status] button").click();
  await expect(page.locator("[data-planner-load-error]")).toHaveCount(0);
  await page.locator("[data-planner-auto]").click();
  await expect(page.locator("[data-planner-stop]")).toHaveCount(3);
  const first = await page.locator("[data-planner-stop] h3").first().textContent();
  planFailed = true;
  await page.locator('[data-planner-move="down"]').first().click();
  await expect(page.locator("[data-planner-dialog]")).toBeVisible();
  await expect(page.locator("[data-planner-stop] h3").first()).toHaveText(first);
  await page.keyboard.press("Escape");
  planFailed = false;
  changed = true;
  await page.locator('[data-planner-move="down"]').first().click();
  await expect(page.locator("[data-planner-dialog]")).toBeVisible();
  await expect(page.locator("[data-planner-result]")).toBeHidden();
  await page.keyboard.press("Escape");
  await page.locator("[data-planner-auto]").click();
  if (await page.locator("[data-planner-dialog]").isVisible()) await page.locator("[data-planner-dialog-confirm]").click();
  await expect(page.locator("[data-planner-stop] h3").first()).toContainText("ชื่อใหม่");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("mongkolwela.templePlanner.v1")));
  expect(stored.plan).toEqual(expect.arrayContaining([expect.any(String)]));
  expect(stored.planDetails).toBeUndefined();
  const previousPosts = posts;
  await page.reload();
  await expect(page.locator("[data-planner-stop]")).toHaveCount(3);
  expect(posts).toBeGreaterThan(previousPosts);
  await page.locator("[data-planner-clear-trip]").click();
  planFailed = true;
  await page.locator("[data-planner-auto]").click();
  await expect(page.locator("[data-planner-dialog]")).toBeVisible();
  await expect(page.locator("[data-planner-result]")).toBeHidden();
  await expect(page.locator("[data-planner-stop]")).toHaveCount(0);
  expect(errors).toEqual([]);
});
