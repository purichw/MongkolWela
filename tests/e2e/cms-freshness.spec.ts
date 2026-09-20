import { expect, test } from "@playwright/test";
import { contentRevision } from "../../src/lib/content-revision.js";

function fixture() {
  return {
    schemaVersion: 1, cmsContractVersion: 2, publishedAt: "2026-01-01",
    site: { pdpa: { analyticsConsentRequired: true, titleText: "ความเป็นส่วนตัว" } },
    analytics: { enabled: true },
    navigation: { tabs: [{ id: "calendar", label: "วันพระ", href: "calendar/" }], utility: [] },
    pages: [{ route: "/", enabled: true, sections: [{ id: "intent", selector: "#intent", enabled: true, duplicateCount: 1 }], patches: [{ selector: "#hero-title", kind: "text", value: "ข้อมูลเริ่มต้น" }] }],
  };
}

test("focus and bfcache refresh only changed content without replacing inputs or duplicating UI", async ({ page }, testInfo) => {
  let content = fixture();
  let requests = 0;
  let fullResponses = 0;
  let originalTitle = "";
  let unavailable = false;
  let pageviews = 0;
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/admin/analytics", (route) => {
    pageviews++;
    return route.fulfill({ status: 204, body: "" });
  });
  await page.route("**/api/admin/content?*", async (route) => {
    requests++;
    if (unavailable) return route.fulfill({ status: 503, json: { error: "Unavailable" } });
    const { publishedAt, ...data } = content;
    const revision = contentRevision(data);
    if (new URL(route.request().url()).searchParams.get("revision") === revision) {
      return route.fulfill({ json: { ok: true, revision, unchanged: true } });
    }
    if (!fullResponses) originalTitle = (await page.locator("#hero-title").textContent()) || "";
    fullResponses++;
    return route.fulfill({ json: { ok: true, revision, content } });
  });
  await page.goto("/");
  await expect(page.locator("#hero-title")).toHaveText("ข้อมูลเริ่มต้น");
  await expect(page.locator("[data-page-loader]")).toHaveAttribute("aria-hidden", "true");
  await page.locator("#site-search").fill("ข้อความที่กำลังกรอก");
  await page.evaluate(() => { (window as any).originalSearchInput = document.querySelector("#site-search"); });
  await page.clock.install();
  const resume = async (persisted = false) => {
    await page.evaluate((persisted) => {
      if (persisted) window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
      else {
        window.dispatchEvent(new Event("focus"));
        document.dispatchEvent(new Event("visibilitychange"));
      }
    }, persisted);
    await page.clock.runFor(300);
  };
  const initialRequests = requests;
  await resume();
  await expect.poll(() => requests).toBe(initialRequests + 1);
  expect(fullResponses).toBe(1);
  content = structuredClone(content);
  content.pages[0].patches[0].value = "ข้อมูลล่าสุด";
  await resume(true);
  await expect(page.locator("#hero-title")).toHaveText("ข้อมูลล่าสุด");
  await expect(page.locator("#site-search")).toHaveValue("ข้อความที่กำลังกรอก");
  expect(await page.evaluate(() => (window as any).originalSearchInput === document.querySelector("#site-search"))).toBe(true);
  await expect(page.locator(".pdpa-consent")).toHaveCount(1);
  await expect(page.locator("#intent")).toHaveCount(1);
  await expect(page.locator("[data-cms-duplicate-of]")).toHaveCount(0);
  await page.clock.runFor(2000);
  await page.screenshot({ path: testInfo.outputPath("cms-updated-with-input.png"), scale: "css", animations: "disabled" });
  await page.locator("[data-pdpa-accept]").click();
  await expect.poll(() => pageviews).toBe(1);
  unavailable = true;
  await resume();
  await expect(page.locator("[data-cms-load-error]")).toBeVisible();
  await expect(page.locator("#site-search")).toHaveValue("ข้อความที่กำลังกรอก");
  unavailable = false;
  await resume();
  await expect(page.locator("[data-cms-load-error]")).toHaveCount(0);
  content = structuredClone(content);
  content.pages[0].patches = [];
  await resume();
  await expect(page.locator("#hero-title")).toHaveText(originalTitle);
  expect(pageviews).toBe(1);
  expect(errors).toEqual([]);
});

test("visible pages poll once per minute and hidden pages wait until return", async ({ page }) => {
  const content = fixture();
  let requests = 0;
  await page.route("**/api/admin/content?*", (route) => {
    requests++;
    return route.fulfill({ json: new URL(route.request().url()).searchParams.has("revision")
      ? { ok: true, revision: "v1", unchanged: true } : { ok: true, revision: "v1", content } });
  });
  await page.clock.install();
  await page.goto("/");
  await expect(page.locator("#hero-title")).toHaveText("ข้อมูลเริ่มต้น");
  const initial = requests;
  await page.clock.runFor(60100);
  await expect.poll(() => requests).toBe(initial + 1);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(180000);
  expect(requests).toBe(initial + 1);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(300);
  await expect.poll(() => requests).toBe(initial + 2);
});
