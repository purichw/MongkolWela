import { expect, test } from "@playwright/test";
import { createTempleRoutingServer } from "../helpers/temple-routing-server.mjs";
import { createLegacyTempleSlug } from "../../src/data/temple-slugs.js";
import { templeDatasets } from "../../src/lib/temple-routing.js";

let fixture;
let initialContent;
const path = "/temples/popular/wat-rakhang-khositaram/";
const key = `popular:${createLegacyTempleSlug(templeDatasets.popular[0])}`;

test.beforeAll(async () => {
  fixture = await createTempleRoutingServer();
  initialContent = structuredClone(fixture.state.content);
});
test.afterAll(async () => { await fixture?.close(); });
test.beforeEach(async ({ page }) => {
  fixture.state.content = structuredClone(initialContent);
  fixture.state.outage = false;
  await page.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
  await page.addInitScript(() => { localStorage.setItem("mongkolwela.pdpa.analytics", "declined"); });
});

test("fresh SSR content starts without a second CMS read or runtime loader image transforms", async ({ page, request }) => {
  const content = fixture.state.content;
  content.temples.records[key] = { key, collection: "popular", fields: { name: "ชื่อจาก CMS ล่าสุด" } };
  content.site.bootstrapTest = '</script><script>window.unexpectedBootstrapScript = true</script>';
  content.privateTest = "not-public-bootstrap-data";
  const htmlResponse = await request.get(fixture.url + path);
  expect(htmlResponse.headers()["cache-control"]).toBe("no-store");
  const html = await htmlResponse.text();
  expect(html).toContain("data-cms-bootstrap");
  expect(html).not.toContain(content.privateTest);
  expect(html).toContain("\\u003c/script>");
  let cmsReads = 0;
  await page.route("**/api/admin/content?*", route => {
    cmsReads++;
    return route.fulfill({ status: 503, json: { error: "Initial browser request must not be needed" } });
  });
  await page.goto(fixture.url + path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
  await expect(page.locator("html")).toHaveAttribute("data-cms-nav-ready", "true");
  await expect(page.locator("#temple-detail-title")).toHaveText("ชื่อจาก CMS ล่าสุด");
  await expect(page.locator("[data-cms-load-error]")).toHaveCount(0);
  expect(cmsReads).toBe(0);
  expect(await page.evaluate(() => (window as any).unexpectedBootstrapScript)).toBeUndefined();
  await expect(page.locator("[data-cms-bootstrap]")).toHaveCount(0);
  const icons = page.locator(".loader-vector-icon");
  await expect(icons).toHaveCount(10);
  for (const icon of await icons.all()) {
    const src = (await icon.getAttribute("src"))!;
    expect(src).toMatch(/^\/_astro\/.+\.webp$/);
    expect(src).not.toContain("/_image");
    await expect.poll(() => icon.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 384)).toBe(true);
  }
  const sources = await icons.evaluateAll(images => images.map(image => image.getAttribute("src")));
  const heritageIcons = page.locator(".site-icon img");
  expect(await heritageIcons.count()).toBeGreaterThan(0);
  for (const icon of await heritageIcons.all()) {
    expect(sources).toContain(await icon.getAttribute("src"));
    await expect.poll(() => icon.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 384)).toBe(true);
  }
  await expect(page.locator('img[src^="/_image"]')).toHaveCount(0);
});

test("SSR bootstrap is consumed once; subsequent refreshes use live revisions and expose outages", async ({ page, request }) => {
  const requests: string[] = [];
  page.on("request", req => { if (req.url().includes("/api/admin/content?")) requests.push(req.url()); });
  await page.goto(fixture.url + path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
  expect(requests).toHaveLength(0);
  const current = await (await request.get(`${fixture.url}/api/admin/content?path=${encodeURIComponent(path)}`)).json();
  const checked = page.waitForResponse(response => response.url().includes("/api/admin/content?"));
  await page.evaluate(() => (window as any).MongkolWelaCMS.reload());
  expect((await (await checked).json()).unchanged).toBe(true);
  expect(new URL(requests[0]).searchParams.get("revision")).toBe(current.revision);

  fixture.state.content.temples.records[key] = { key, collection: "popular", fields: { name: "ชื่อที่เพิ่งแก้ไข" } };
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(page.locator("#temple-detail-title")).toHaveText("ชื่อที่เพิ่งแก้ไข");
  fixture.state.outage = true;
  await page.evaluate(() => (window as any).MongkolWelaCMS.reload());
  await expect(page.locator("[data-cms-load-error]")).toBeVisible();
  const outage = await request.get(fixture.url + path);
  expect(outage.status()).toBe(503);
  expect(await outage.text()).not.toContain("data-cms-bootstrap");
  fixture.state.outage = false;
  await page.locator("[data-cms-load-error] button").click();
  await expect(page.locator("[data-cms-load-error]")).toHaveCount(0);
  await expect(page.locator("#temple-detail-title")).toHaveText("ชื่อที่เพิ่งแก้ไข");
  expect(fixture.state.writes).toBe(0);
});

test("lightweight detail payloads still update and hide already-rendered related cards", async ({ page }) => {
  await page.goto(fixture.url + path);
  const card = page.locator(".pd-related-card").first();
  const relatedKey = (await card.getAttribute("data-temple-key"))!;
  fixture.state.content.temples.records[relatedKey] = {
    ...fixture.state.content.temples.records[relatedKey], key: relatedKey, collection: "popular", enabled: false,
  };
  await page.evaluate(() => (window as any).MongkolWelaCMS.reload());
  await expect(card).toBeHidden();
  fixture.state.content.temples.records[relatedKey].enabled = true;
  fixture.state.content.temples.records[relatedKey].fields = { name: "Updated related place", province: "Different province" };
  await page.evaluate(() => (window as any).MongkolWelaCMS.reload());
  await expect(card).toBeVisible();
  await expect(card.locator("strong")).toHaveText("Updated related place");
  expect(fixture.state.writes).toBe(0);
});

for (const invalid of ["malformed", "wrong-path"]) {
  test(`${invalid} bootstrap falls back to a live read, never static data`, async ({ page }) => {
    await page.route(fixture.url + path, async route => {
      const response = await route.fetch();
      const body = (await response.text()).replace(/(<script[^>]*data-cms-bootstrap[^>]*>)([\s\S]*?)(<\/script>)/, (_, open, json, close) =>
        open + (invalid === "malformed" ? "{bad json" : JSON.stringify({ ...JSON.parse(json), path: "/other/" })) + close);
      await route.fulfill({ response, body });
    });
    let reads = 0;
    page.on("request", req => { if (req.url().includes("/api/admin/content?")) reads++; });
    await page.goto(fixture.url + path, { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
    expect(reads).toBe(1);
    await expect(page.locator("#temple-detail-title")).toBeVisible();
  });
}
