import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { adminDesignFixture } from "../helpers/admin-design-fixture.mjs";
import { contentCatalog, validateContentLibrary } from "../../src/data/content-catalog.js";
import { contentRevision } from "../../src/lib/content-revision.js";

const key = "seamsi.seamsiFortunes";
const revisionOf = ({ publishedAt, updatedAt, ...content }) => contentRevision(content);

async function section(page, id) {
  if (await page.locator("#adminSidebar").evaluate(node => node.inert)) await page.getByRole("button", { name: "เปิดเมนู", exact: true }).click();
  await page.locator(`#adminNav [data-section="${id}"]`).click();
}

async function setup(page, catalogFailure = false) {
  const fixture = adminDesignFixture();
  let content = fixture["/api/admin/content"].content;
  let failPublish = false, failCatalog = catalogFailure;
  const errors = [], writes = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/admin/content") {
      if (url.searchParams.get("view") === "catalog") return route.fulfill({ status: failCatalog ? 503 : 200, json: failCatalog ? { ok: false, error: "โหลดคลังเนื้อหาไม่ได้" } : { ok: true, catalog: contentCatalog() } });
      if (route.request().method() === "POST") {
        const submitted = route.request().postDataJSON();
        writes.push(submitted);
        if (failPublish || submitted.expectedRevision !== revisionOf(content)) return route.fulfill({ status: 409, json: { ok: false, error: "เนื้อหามีเวอร์ชันใหม่แล้ว" } });
        validateContentLibrary(submitted.content.contentLibrary);
        content = { ...submitted.content, publishedAt: new Date().toISOString() };
        return route.fulfill({ json: { ok: true, content, meta: { fast: true } } });
      }
      return route.fulfill({ json: { ok: true, content, revision: revisionOf(content) } });
    }
    return route.fulfill({ json: fixture[url.pathname] || { ok: true } });
  });
  await page.goto("/admin/");
  await section(page, "contentLibrary");
  return { errors, writes, failPublish: value => { failPublish = value; }, failCatalog: value => { failCatalog = value; } };
}

async function openRecord(page) {
  await page.locator(`[data-library-group="${key}"][data-library-record="4"]`).click();
  await expect(page.locator(".mw-library-form")).toBeVisible();
}

async function capture(page, name) {
  await page.evaluate(async () => { await document.fonts.ready; scrollTo({ top: 0, behavior: "instant" }); (document.activeElement as HTMLElement)?.blur(); });
  fs.mkdirSync("artifacts/admin-content-library", { recursive: true });
  await page.screenshot({ path: `artifacts/admin-content-library/${name}.png`, fullPage: true, animations: "disabled" });
}

test("prediction editor matches desktop/mobile composition with accessible, reachable controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const control = await setup(page);
  await openRecord(page);
  await expect(page.locator("[data-library-title]")).toHaveText("ทางลัดมีเงาซ่อนอยู่");
  await expect(page.locator("[data-library-field]")).toHaveCount(7);
  await expect(page.locator('[data-library-field="verse"]')).toHaveJSProperty("tagName", "TEXTAREA");
  await expect(page.locator(".mw-library-context dd")).toHaveText(["4", "7"]);
  expect(await page.locator("#adminSidebar").evaluate(node => getComputedStyle(node).backgroundColor)).toBe("rgb(11, 56, 46)");
  await capture(page, "library-1440");
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const footer = page.locator(".mw-admin-header-actions");
  expect(await footer.evaluate(node => getComputedStyle(node).position)).toBe("fixed");
  const draftButton = await page.locator('[data-action="save-draft"]').boundingBox(), publishButton = await page.locator('[data-action="publish"]').boundingBox();
  expect(draftButton.y).toBe(publishButton.y);
  expect(draftButton.x + draftButton.width).toBeLessThan(publishButton.x);
  await capture(page, "library-390");
  await page.screenshot({ path: "artifacts/admin-content-library/library-390-top.png", animations: "disabled" });
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  const contextBox = await page.locator(".mw-library-context").boundingBox(), footerBox = await footer.boundingBox();
  expect(contextBox.y + contextBox.height).toBeLessThanOrEqual(footerBox.y);
  await page.screenshot({ path: "artifacts/admin-content-library/library-390-bottom.png", animations: "disabled" });
  await page.locator(".mw-library-publication summary").click();
  await expect(page.locator(".mw-library-publication-body")).toBeHidden();
  await page.locator(".mw-library-publication summary").press("Enter");
  await expect(page.locator(".mw-library-publication-body")).toBeVisible();
  await page.locator(".mw-library-form summary").click();
  await expect(page.locator("[data-library-field]").first()).toBeHidden();
  await page.locator(".mw-library-form summary").press("Enter");
  await expect(page.locator("[data-library-field]").first()).toBeVisible();
  const axe = await new AxeBuilder({ page }).include(".is-library-editor").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(axe.violations).toEqual([]);
  await section(page, "analytics");
  await expect(page.locator(".is-library-editor, [data-library-header]")).toHaveCount(0);
  await expect(page.locator('[data-action="publish"]').first()).toBeHidden();
  expect(control.errors).toEqual([]);
});

test("text edits retain drafts, immutable IDs, navigation state and shared publication behavior", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const control = await setup(page);
  const search = page.getByRole("searchbox", { name: "ค้นหาคำทำนาย" });
  await search.fill("ทางลัด");
  await openRecord(page);
  const title = page.locator('[data-library-field="title"]');
  const caution = page.locator('[data-library-field="caution"]');
  await title.fill("ทางลัด ฉบับร่างทดสอบ");
  await caution.fill("");
  await expect(page.locator("[data-library-title]")).toHaveText("ทางลัด ฉบับร่างทดสอบ");
  await page.locator('[data-action="save-draft"]').click();
  await expect(page.locator("#adminStatus")).toContainText("ในเบราว์เซอร์");
  expect(control.writes).toHaveLength(0);
  await page.locator("[data-library-back]").click();
  await expect(search).toHaveValue("ทางลัด");
  await expect(page.locator(`[data-library-group="${key}"][data-library-record="4"]`)).toBeFocused();
  await expect(page.locator("[data-library-header]")).toHaveCount(0);
  await page.reload();
  await page.locator('[data-action="restore-draft"]').click();
  await section(page, "contentLibrary");
  await openRecord(page);
  await expect(title).toHaveValue("ทางลัด ฉบับร่างทดสอบ");
  await expect(caution).toHaveValue("");
  control.failPublish(true);
  await page.locator('[data-action="publish"]').click();
  await expect(page.locator("#adminStatus")).toContainText("เวอร์ชันใหม่");
  await expect(title).toHaveValue("ทางลัด ฉบับร่างทดสอบ");
  await expect(page.locator('[data-action="publish"]')).toBeEnabled();
  control.failPublish(false);
  await page.locator('[data-action="publish"]').click();
  await expect(page.locator("#adminStatus")).toHaveText("เผยแพร่แล้ว", { timeout: 15000 });
  expect(control.writes.at(-1).content.contentLibrary[key]["4"]).toEqual({ title: "ทางลัด ฉบับร่างทดสอบ", caution: "" });
  await expect(page.locator(".mw-library-context dd")).toHaveText(["4", "7"]);
  await expect(page.locator("[data-library-header]")).toHaveCount(1);
  expect(control.errors).toEqual([]);
});

test("catalog retry and shared nested fields survive disclosure and back navigation", async ({ page }) => {
  const control = await setup(page, true);
  await expect(page.locator(".mw-library-message")).toContainText("โหลดคลังเนื้อหาไม่ได้");
  control.failCatalog(false);
  await page.getByRole("button", { name: "ลองอีกครั้ง", exact: true }).click();
  await page.getByRole("searchbox", { name: "ค้นหาคำทำนาย" }).fill("THE FOOL");
  await page.locator('[data-library-group="tarot.tarotMeaningCards"][data-library-record="the-fool"]').click();
  const record = contentCatalog().find(group => group.key === "tarot.tarotMeaningCards").records.find(row => row.id === "the-fool");
  await expect(page.locator("[data-library-field]")).toHaveCount(record.fields.length);
  const nested = record.fields.find(field => field.path.includes("/"));
  await page.locator(`[data-library-field="${nested.path}"]`).fill("คำทำนายซ้อนที่แก้ไขแล้ว");
  await page.locator(".mw-library-form summary").click();
  await page.locator(".mw-library-form summary").press("Enter");
  await expect(page.locator(`[data-library-field="${nested.path}"]`)).toHaveValue("คำทำนายซ้อนที่แก้ไขแล้ว");
  await page.locator('[data-action="save-draft"]').click();
  expect(await page.evaluate(({ path }) => JSON.parse(localStorage.getItem("mongkolwela.admin.draft")).contentLibrary["tarot.tarotMeaningCards"]["the-fool"][path], { path: nested.path })).toBe("คำทำนายซ้อนที่แก้ไขแล้ว");
  await page.locator("[data-library-back]").click();
  await expect(page.getByRole("searchbox", { name: "ค้นหาคำทำนาย" })).toHaveValue("THE FOOL");
  expect(control.errors).toEqual([]);
});
