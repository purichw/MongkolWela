import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { publicContentForPath } from "../../src/lib/public-content.js";
import { contentRevision } from "../../src/lib/content-revision.js";
import { watArunPopularRoute } from "../../src/data/nfr-key-routes.js";
import { sitePlaceholderImage } from "../../src/lib/image-placeholder.js";
import { adminDesignFixture } from "../helpers/admin-design-fixture.mjs";

const defaults = JSON.parse(fs.readFileSync("public/admin/content/default.json", "utf8"));
for (const entry of defaults.pages.filter(item => item.kind !== "custom")) {
  test(`all discoverable CMS fields publish and restore: ${entry.route}`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const content = structuredClone(defaults);
    content.site.patches = [];
    const owner = content.pages.find(item => item.id === entry.id);
    owner.patches = []; owner.sections = []; delete owner.homepage;
    await page.route("**/api/admin/content?*", route => {
      const projected = publicContentForPath(content, new URL(route.request().url()).searchParams.get("path"));
      return route.fulfill({ json: { ok: true, content: projected, revision: contentRevision(projected) } });
    });
    await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
    const response = await page.goto(entry.route);
    await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
    const html = await response!.text();
    const fields = await page.evaluate(async html => {
      const { scanContentFields } = await import("/src/lib/page-content-fields.js");
      const doc = new DOMParser().parseFromString(html, "text/html");
      return scanContentFields(doc).filter(field => doc.querySelector(field.selector)?.closest("main"));
    }, html);
    expect(fields.length).toBeGreaterThan(0);
    owner.patches = fields.map((field, index) => ({ ...field, ...(field.kind === "image"
      ? { src: sitePlaceholderImage, alt: `CMS image ${index}`, ...(Object.hasOwn(field, "position") ? { position: "25% 75%", credit: `CMS credit ${index}`, sourceUrl: "https://example.com/source", license: "CMS license", licenseUrl: "https://example.com/license" } : {}) }
      : { value: field.attr === "href" ? `/#cms-field-${index}` : field.attr === "data-email" ? "cms@example.com" : field.attr === "data-line-id" ? "@cms" : `CMS field ${index}` }) }));
    await page.evaluate(async () => { await (window as any).MongkolWelaCMS.reload(); });
    if (entry.route === "/calendar/") {
      await page.locator("[data-calendar-year]").selectOption("2570", { force: true });
      await expect(page.locator("[data-calendar-title]")).toHaveText("พ.ศ. 2570");
    }
    const problems = await page.evaluate(patches => {
      return patches.flatMap(patch => {
        const node = document.querySelector(patch.selector);
        if (!node) return [`${patch.id}: missing target`];
        const actual = patch.kind === "image" ? node.getAttribute("alt") : patch.kind === "attr" ? node.getAttribute(patch.attr) : node.childNodes[patch.nodeIndex]?.textContent;
        const expected = patch.kind === "image" ? patch.alt : patch.value;
        const errors = actual === expected ? [] : [`${patch.id}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`];
        if (patch.kind === "image") {
          const src = node.getAttribute("data-carousel-src") ?? node.getAttribute("src");
          if (src !== patch.src) errors.push(`${patch.id}: image source did not update`);
          if (Object.hasOwn(patch, "position")) {
            for (const [prop, attr] of Object.entries({ position: "data-image-position", credit: "data-image-credit", sourceUrl: "data-image-source", license: "data-image-license", licenseUrl: "data-image-license-url" })) {
              if (node.getAttribute(attr) !== patch[prop]) errors.push(`${patch.id}: ${prop} did not update`);
            }
          }
        }
        return errors;
      });
    }, owner.patches);
    expect(problems).toEqual([]);
    await testInfo.attach("field-inventory", { body: JSON.stringify({ route: entry.route, count: fields.length, fields: fields.map(({ id, kind, attr }) => ({ id, kind, attr })) }, null, 2), contentType: "application/json" });
    owner.patches = owner.patches.map(patch => ({ ...patch, ...(patch.kind === "image" ? { src: "", alt: "", credit: "", position: "", sourceUrl: "", license: "", licenseUrl: "" } : { value: "" }) }));
    await page.evaluate(async () => { await (window as any).MongkolWelaCMS.reload(); });
    const cleared = await page.evaluate(patches => patches.flatMap(patch => {
      const node = document.querySelector(patch.selector);
      const actual = patch.kind === "image" ? node?.getAttribute("alt") : patch.kind === "attr" ? node?.getAttribute(patch.attr) : node?.childNodes[patch.nodeIndex]?.textContent;
      return actual === "" ? [] : [`${patch.id}: ${JSON.stringify(actual)}`];
    }), owner.patches);
    expect(cleared).toEqual([]);
    owner.patches = [];
    await page.evaluate(async () => { await (window as any).MongkolWelaCMS.reload(); });
    const restored = await page.evaluate(fields => fields.flatMap(field => {
      const node = document.querySelector(field.selector);
      const actual = field.kind === "image" ? node?.getAttribute("alt") : field.kind === "attr" ? node?.getAttribute(field.attr) : node?.childNodes[field.nodeIndex]?.textContent;
      const expected = field.kind === "image" ? field.alt : field.value;
      return actual === expected ? [] : [`${field.id}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`];
    }), fields);
    expect(restored).toEqual([]);
  });
}

test("place detail refresh restores overrides and re-enabled places; related cards and mobile clears stay synchronized", async ({ page }) => {
  const content = structuredClone(defaults);
  const key = decodeURIComponent(watArunPopularRoute).replace(/^\/temples\//, "").replace(/\/$/, "").replace("/", ":");
  content.temples = { records: {} };
  await page.route("**/api/admin/content?*", route => route.fulfill({ json: { ok: true, content: publicContentForPath(content, new URL(route.request().url()).searchParams.get("path")) } }));
  await page.goto(watArunPopularRoute);
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
  const oldName = await page.locator("#temple-detail-title").textContent();
  const related = page.locator(".pd-related-card").first();
  const relatedKey = decodeURIComponent((await related.getAttribute("href"))!).replace(/^\/temples\//, "").replace(/\/$/, "").replace("/", ":");
  const oldRelatedName = await related.locator("strong").textContent();
  content.temples.records[key] = { fields: { name: "Current CMS name", imageAlt: "" }, images: { hero: { desktop: { url: "/assets/images/brand/mongkol-wela-logo-mark.png" }, mobile: { url: "" } } } };
  content.temples.records[relatedKey] = { fields: { name: "Current related name", province: "CMS province", district: "" }, images: { card: { desktop: { url: "" } } } };
  await page.evaluate(async () => { await (window as any).MongkolWelaCMS.reload(); });
  await expect(page.locator("#temple-detail-title")).toHaveText("Current CMS name");
  await expect(page.locator("[data-place-media] source")).toHaveAttribute("srcset", sitePlaceholderImage);
  await expect(related.locator("strong")).toHaveText("Current related name");
  await expect(related.locator("small")).toHaveText("CMS province");
  content.temples.records[key].enabled = false;
  content.temples.records[relatedKey].enabled = false;
  await page.evaluate(async () => { await (window as any).MongkolWelaCMS.reload(); });
  await expect(page.getByRole("heading", { name: "สถานที่นี้ไม่เปิดเผยแพร่" })).toBeVisible();
  content.temples.records = {};
  await page.evaluate(async () => { await (window as any).MongkolWelaCMS.reload(); });
  await expect(page.locator("#temple-detail-title")).toHaveText(oldName!);
  await expect(related.locator("strong")).toHaveText(oldRelatedName!);
});

test("removing section overrides restores visibility and document order without replacing controls", async ({ page }) => {
  const content = structuredClone(defaults);
  const owner = content.pages.find(item => item.route === "/guide/");
  owner.sections = [];
  await page.route("**/api/admin/content?*", route => route.fulfill({ json: { ok: true, content } }));
  await page.goto("/guide/");
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
  const selectors = await page.locator("main section[id]").evaluateAll(nodes => nodes.slice(0, 2).map(node => `#${node.id}`));
  expect(selectors).toHaveLength(2);
  const original = await page.locator("main section[id]").evaluateAll(nodes => nodes.map(node => node.id));
  owner.sections = selectors.map((selector, i) => ({ id: `sync-${i}`, selector, enabled: i !== 0, order: 2 - i }));
  await page.evaluate(async () => { await (window as any).MongkolWelaCMS.reload(); });
  await expect(page.locator(selectors[0])).toBeHidden();
  owner.sections = [];
  await page.evaluate(async () => { await (window as any).MongkolWelaCMS.reload(); });
  await expect(page.locator(selectors[0])).toBeVisible();
  expect(await page.locator("main section[id]").evaluateAll(nodes => nodes.map(node => node.id))).toEqual(original);
  owner.sections = [{ id: "sync-0", selector: selectors[0], enabled: false }];
  await page.evaluate(async () => { await (window as any).MongkolWelaCMS.reload(); });
  content.pages = content.pages.filter(item => item.id !== owner.id);
  await page.evaluate(async () => { await (window as any).MongkolWelaCMS.reload(); });
  await expect(page.locator(selectors[0])).toBeVisible();
});

test("an open collection map refreshes names, coordinates, images and removals from CMS", async ({ page }) => {
  const content = structuredClone(defaults);
  content.temples = { records: {} };
  const key = decodeURIComponent(watArunPopularRoute).replace(/^\/temples\//, "").replace(/\/$/, "").replace("/", ":");
  await page.route("**/api/admin/content?*", route => route.fulfill({ json: { ok: true, content } }));
  await page.goto("/temples/popular/");
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
  await page.locator("[data-temple-map-open]").click();
  await expect(page.locator(".temple-map-canvas.leaflet-container")).toBeVisible();
  content.temples.records[key] = { fields: { name: "CMS synchronized map", province: "CMS province", latitude: 13.7, longitude: 100.4, imageAlt: "Map CMS image" }, images: { map: { desktop: { url: "" } } } };
  await page.evaluate(async () => { await (window as any).MongkolWelaCMS.reload(); });
  await page.locator("[data-temple-map-search]").fill("CMS synchronized map");
  await page.locator("[data-temple-map-result]").click();
  await expect(page.locator(".temple-map-popup h3")).toHaveText("CMS synchronized map");
  await expect(page.locator(".temple-map-popup p")).toContainText("CMS province");
  await expect(page.locator(".temple-map-popup img")).toHaveAttribute("src", sitePlaceholderImage);
  content.temples.records[key].enabled = false;
  await page.evaluate(async () => { await (window as any).MongkolWelaCMS.reload(); });
  await expect(page.locator("[data-temple-map-result]")).toHaveCount(0);
  await expect(page.locator(".temple-map-popup")).toHaveCount(0);
  content.temples.records = {};
  await page.evaluate(async () => { await (window as any).MongkolWelaCMS.reload(); });
  await page.locator("[data-temple-map-search]").fill("วัดอรุณ");
  await expect(page.locator("[data-temple-map-result]").first()).toBeVisible();
});

test("Admin edits actual source timetable, publishes it and retains it after reload", async ({ page }, testInfo) => {
  const fixture = adminDesignFixture();
  let content = fixture["/api/admin/content"].content;
  const record = fixture["/api/admin/temples"].temples.find(item => item.collection === "popular" && item.visitInfo.hours.timetable.length);
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/admin/content") {
      if (route.request().method() === "POST") content = route.request().postDataJSON().content;
      return route.fulfill({ json: { ok: true, content } });
    }
    return route.fulfill({ json: fixture[path] || { ok: true, events: [] } });
  });
  await page.goto("/admin/");
  await page.locator('#adminNav [data-section="temples"]').click();
  await page.locator('[data-temple-search]').fill(record.temple.name);
  await page.locator(`[data-edit-temple="${record.key}"]`).first().click();
  await page.locator('[data-editor-jump="visit"]').click();
  await page.locator('[data-visit-kind="hours"] > summary').click();
  const input = page.locator('[data-temple-visit="hours/timetable/0/time"]');
  await expect(input).toHaveValue(record.visitInfo.hours.timetable[0].time);
  await input.fill("10:30 - 16:30");
  await page.screenshot({ path: testInfo.outputPath("cms-timetable-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(async () => {
    await expect(input).toHaveValue("10:30 - 16:30");
    await input.scrollIntoViewIfNeeded();
  }).toPass();
  expect(await page.locator(".mw-admin-drawer-body").evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("cms-timetable-mobile.png") });
  await page.locator('[data-action="save-temple-editor"]').click();
  await page.locator('[data-action="publish"]').first().click();
  await expect(page.locator("#adminStatus")).toHaveText("เผยแพร่แล้ว");
  await page.goto(record.detailUrl);
  await expect(page.locator('[data-pd-domain="visit"]')).toContainText("10:30 - 16:30");
  await page.reload();
  await expect(page.locator('[data-pd-domain="visit"]')).toContainText("10:30 - 16:30");
});

test("late location data preserves the editor, pending fields and an open province dropdown", async ({ page }) => {
  const fixture = adminDesignFixture();
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/**", route => route.fulfill({ json: fixture[new URL(route.request().url()).pathname] || { ok: true } }));
  await page.route("**/assets/data/temples-thailand-index.json", async route => {
    await ready;
    await route.fulfill({ json: { facets: { regions: [{ name: "ภาคเหนือ", provinces: [{ name: "เชียงใหม่", districts: [{ name: "พื้นที่ทดสอบ CMS" }] }, { name: "จังหวัดตัวเลือกใหม่", districts: [] }] }] } } });
  });
  await page.goto("/admin/");
  await page.locator('#adminNav [data-section="temples"]').click();
  await page.locator("[data-edit-temple]").first().click();
  await page.getByLabel("ชื่อสถานที่", { exact: true }).fill("ชื่อที่ยังไม่บันทึก");
  await page.getByRole("combobox", { name: "ภูมิภาค", exact: true }).click();
  await page.getByRole("option", { name: "ภาคเหนือ", exact: true }).click();
  await page.getByRole("combobox", { name: "จังหวัด / เขต", exact: true }).click();
  await page.evaluate(() => { (window as any).__editorBeforeLookup = document.querySelector(".mw-place-editor"); });
  const response = page.waitForResponse("**/assets/data/temples-thailand-index.json");
  release();
  await response;
  await expect(page.getByRole("option", { name: "จังหวัดตัวเลือกใหม่", exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__editorBeforeLookup === document.querySelector(".mw-place-editor"))).toBe(true);
  await expect(page.getByRole("combobox", { name: "จังหวัด / เขต", exact: true })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("option", { name: "เชียงใหม่", exact: true }).click();
  await expect(page.locator('[data-temple-field="district"] option').filter({ hasText: "พื้นที่ทดสอบ CMS" })).toHaveCount(1);
  await expect(page.getByLabel("ชื่อสถานที่", { exact: true })).toHaveValue("ชื่อที่ยังไม่บันทึก");
});
