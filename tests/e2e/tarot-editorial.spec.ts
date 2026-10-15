import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { adminDesignFixture } from "../helpers/admin-design-fixture.mjs";
import { contentCatalog, validateContentLibrary } from "../../src/data/content-catalog.js";
import { contentRevision } from "../../src/lib/content-revision.js";

const research = fs.readFileSync("docs/research/tarot-editorial-v1/card-content.ndjson", "utf8").trim().split("\n").map(JSON.parse);
const seed = JSON.parse(fs.readFileSync("public/admin/content/live.json", "utf8"));
const output = "artifacts/tarot-editorial";
test.beforeEach(async ({ page }) => {
  fs.mkdirSync(output, { recursive: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
});
async function ready(page) {
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
  await expect(page.locator("[data-page-loader]")).toBeHidden();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
for (const width of [1440, 390]) {
  test(`researched readings reach every mode and the library at ${width}`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.route("**/api/admin/content?*", route => route.fulfill({ json: { ok: true, content: { ...seed, contentLibrary: {} } } }));
    const card = research[0];
    for (const context of ["daily", "love", "money", "career", "luck"]) {
      await page.goto(`/tarot/${context}/result/?${context === "daily" ? "card" : "cards"}=${card.legacy_id}`);
      await ready(page);
      const result = page.locator(".tarot-reading-section");
      await expect(result).toHaveCount(3);
      for (const [i, field] of ["reading", "advice", "caution"].entries()) await expect(result.nth(i).locator("p")).toHaveText(card.contexts[context][field]);
      await expect(page.locator(".tarot-verdict")).toHaveCount(0);
      if (context === "love") {
        if (width === 390) await result.first().locator("summary").click();
        await page.screenshot({ path: `${output}/love-${width}.png`, fullPage: true });
      }
    }
    const cards = research.slice(22, 32);
    await page.goto(`/tarot/monthly/result/?cards=${cards.map(card => card.legacy_id).join(",")}`);
    await ready(page);
    await expect(page.locator(".tarot-monthly-card")).toHaveCount(10);
    for (const [i, card] of cards.entries()) {
      const result = page.locator(".tarot-monthly-card").nth(i);
      await expect(result.locator(".tarot-reading-section").first().locator("p")).toHaveText(card.contexts.monthly.reading);
      await expect(result.locator(".tarot-reading-section").nth(2).locator("p")).toHaveText(card.contexts.monthly.caution);
    }
    if (width === 390) await page.locator(".tarot-monthly-card").first().locator("summary").first().click();
    await page.screenshot({ path: `${output}/monthly-${width}.png` });
    const minor = research[26];
    await page.goto(`/tarot/meanings/${minor.legacy_id}/`);
    await ready(page);
    await expect(page.locator(".tarot-card-prose").first()).toContainText(minor.upright);
    await page.locator('[data-reading-context="daily"] summary').click();
    await expect(page.locator('[data-reading-context="daily"]')).toContainText(minor.contexts.daily.reading);
    await page.locator(".tarot-detail-more > summary").click();
    await expect(page.locator(".tarot-detail-expanded")).toContainText(minor.reversed);
    await expect(page.locator(".tarot-detail-expanded")).toContainText(minor.differentiation[0].difference);
    expect(await page.locator(".tarot-detail-image img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await page.screenshot({ path: `${output}/meaning-${width}.png`, fullPage: true });
    await page.goto("/tarot/love/result/?cards=the-fives-of-wands");
    await ready(page);
    await expect(page.locator(".tarot-empty-result")).toBeVisible();
    await page.goto("/tarot/love/result/?cards=the-fool,unknown");
    await ready(page);
    await expect(page.locator(".tarot-empty-result")).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("new context saves, restores, rejects conflicts, publishes and reaches the visitor", async ({ page }) => {
  test.setTimeout(120_000);
  const fixture = adminDesignFixture();
  let content = structuredClone(fixture["/api/admin/content"].content);
  content.contentLibrary = {};
  const revision = () => { const { publishedAt, updatedAt, ...body } = content; return contentRevision(body); };
  let writes = 0, conflict = true;
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname !== "/api/admin/content") return route.fulfill({ json: fixture[url.pathname] || { ok: true } });
    if (url.searchParams.get("view") === "catalog") return route.fulfill({ json: { ok: true, catalog: contentCatalog() } });
    if (route.request().method() === "POST") {
      const submitted = route.request().postDataJSON();
      if (conflict || submitted.expectedRevision !== revision()) return route.fulfill({ status: 409, json: { ok: false, error: "เนื้อหามีเวอร์ชันใหม่แล้ว" } });
      validateContentLibrary(submitted.content.contentLibrary);
      content = { ...submitted.content, publishedAt: new Date().toISOString() };
      writes++;
      return route.fulfill({ json: { ok: true, content, meta: { fast: true } } });
    }
    return route.fulfill({ json: { ok: true, content, revision: revision() } });
  });
  async function openEditor() {
    if (await page.locator("#adminSidebar").evaluate(node => node.inert)) await page.getByRole("button", { name: "เปิดเมนู", exact: true }).click();
    await page.locator('#adminNav [data-section="contentLibrary"]').click();
    await page.getByRole("searchbox", { name: "ค้นหาคำทำนาย" }).fill("THE FOOL");
    await page.locator('[data-library-group="tarot.tarotCards"][data-library-record="the-fool"]').click();
  }
  await page.goto("/admin/");
  await openEditor();
  const reading = page.locator('[data-library-field="contexts/luck/reading"]');
  const caution = page.locator('[data-library-field="contexts/luck/caution"]');
  await expect(reading).toHaveValue(research[0].contexts.luck.reading);
  await expect(page.locator('label[for="' + await reading.getAttribute("id") + '"]')).toHaveText("คำอ่านตามบริบท / โชคลาภ / คำอ่าน");
  await reading.fill("คำอ่านโชคลาภที่แก้ผ่าน CMS ทดสอบ");
  await caution.fill("");
  await page.locator('[data-action="save-draft"]').click();
  expect(writes).toBe(0);
  await page.reload();
  await page.locator('[data-action="restore-draft"]').click();
  await openEditor();
  await expect(reading).toHaveValue("คำอ่านโชคลาภที่แก้ผ่าน CMS ทดสอบ");
  await page.locator('[data-action="publish"]').click();
  await expect(page.locator("#adminStatus")).toContainText("เวอร์ชันใหม่");
  await expect(reading).toHaveValue("คำอ่านโชคลาภที่แก้ผ่าน CMS ทดสอบ");
  conflict = false;
  await page.locator('[data-action="publish"]').click();
  await expect(page.locator("#adminStatus")).toHaveText("เผยแพร่แล้ว", { timeout: 15000 });
  expect(writes).toBe(1);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await reading.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `${output}/cms-context-${width}.png` });
  }
  await page.goto("/tarot/luck/result/?cards=the-fool");
  await ready(page);
  await expect(page.locator(".tarot-reading-section").first().locator("p")).toHaveText("คำอ่านโชคลาภที่แก้ผ่าน CMS ทดสอบ");
  await expect(page.locator(".tarot-reading-section").nth(2).locator("p")).toHaveText("");
  await page.goto("/tarot/meanings/the-fool/");
  await ready(page);
  await page.locator('[data-reading-context="luck"] summary').click();
  await expect(page.locator('[data-reading-context="luck"] > p').first()).toHaveText("คำอ่านโชคลาภที่แก้ผ่าน CMS ทดสอบ");
});
