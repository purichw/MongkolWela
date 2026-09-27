import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import AxeBuilder from "@axe-core/playwright";

const content = JSON.parse(fs.readFileSync("public/admin/content/live.json", "utf8"));
const province = "[data-pf-group=provinces]";
const purpose = "[data-pf-group=purposes]";
const dialog = "#pf-editor";
const cards = "[data-popular-temple-card]:visible";
const mainQuery = "[data-popular-temple-filter-name]";
const optionQuery = "[data-pf-option-search]";

async function setup(page: Page, path = "/temples/popular/") {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
  await page.route("**/api/admin/content?*", route => route.fulfill({ json: { ok: true, content } }));
  await page.route("**/api/admin/analytics", route => route.fulfill({ status: 204 }));
  await page.goto(path);
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
  await expect(page.locator("[data-page-loader]")).toHaveAttribute("aria-hidden", "true");
  await page.evaluate(() => document.fonts.ready);
  return errors;
}
async function ready(page: Page, total = 243) {
  await expect(page.locator("[data-popular-temple-count]")).toContainText(String(total));
  await page.locator(".pf").evaluate(e => window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 160));
}
const ids = (page: Page) => page.locator(cards).evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.cardKey));
const choose = (page: Page, name: string) => page.getByRole("checkbox", { name, exact: true }).check();
const done = (page: Page) => page.locator("[data-pf-done]").click();
const search = (page: Page) => page.locator(".pf__search button[type=submit]").click();

for (const [collection, total] of [["popular", 243], ["sacred", 217], ["mu", 165]] as const) {
  for (const width of [1440, 390]) {
    test(`shared collection filters: ${collection} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 960 });
      const errors = await setup(page, `/temples/${collection}/`); await ready(page, total);
      await expect(page.locator("[data-compact-filters]")).toHaveCount(1);
      await expect(page.locator(".temple-collection-v2-advanced-filter")).toHaveCount(0);
      await expect(page.locator("[data-popular-temple-grid]")).toHaveAttribute("data-collection", collection);
      await expect(page.locator(cards)).toHaveCount(width > 600 ? 16 : 6);
      const columns = await page.locator("[data-popular-temple-grid]").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length);
      expect(columns).toBe(width > 600 ? 4 : 1);
      const panel = await page.locator(".pf__panel").boundingBox();
      expect(panel!.height).toBeLessThan(width > 720 ? 220 : 450);
      expect(await page.locator(".pf").evaluate(node => getComputedStyle(node).fontFamily)).toContain("IBM Plex Sans Thai");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      const before = await ids(page);
      const target = await page.locator('[data-popular-temple-card][data-province="กรุงเทพมหานคร"]').first().evaluate(node => ({ name: (node as HTMLElement).dataset.name!, purpose: (node as HTMLElement).dataset.blessings!.split(";")[0].trim() }));
      fs.mkdirSync("artifacts/collection-filters", { recursive: true });
      await page.screenshot({ path: `artifacts/collection-filters/${collection}-${width}.png` });
      await page.locator(province).click();
      await choose(page, "กรุงเทพมหานคร"); await choose(page, "เชียงใหม่");
      await expect(page.locator("[data-pf-selection-count]")).toContainText("2 จังหวัด");
      const editor = await page.locator(dialog).boundingBox();
      expect(editor!.x).toBeGreaterThanOrEqual(0);
      expect(editor!.x + editor!.width).toBeLessThanOrEqual(width + 1);
      expect(editor!.y + editor!.height).toBeLessThanOrEqual(961);
      if (width < 720) await expect(page.locator(dialog)).toHaveAttribute("data-mode", "sheet");
      if (collection !== "popular") await page.screenshot({ path: `artifacts/collection-filters/${collection}-editor-${width}.png` });
      await page.locator(optionQuery).fill("เชียง");
      await expect(page.getByRole("checkbox", { name: "เชียงใหม่", exact: true })).toBeVisible();
      await done(page);
      expect(await ids(page)).toEqual(before);
      await page.locator(purpose).click(); await choose(page, target.purpose);
      await page.keyboard.press("Escape");
      await expect(page.locator(purpose)).toBeFocused();
      await expect(page.locator(purpose)).toContainText("ทั้งหมด");
      await page.locator(purpose).click(); await choose(page, target.purpose); await done(page);
      await page.locator(mainQuery).fill(target.name); await search(page);
      await expect(page.locator(cards).first()).toBeVisible();
      expect(await page.locator(cards).evaluateAll((nodes, target) => nodes.every(node => {
        const d = (node as HTMLElement).dataset;
        return ["กรุงเทพมหานคร", "เชียงใหม่"].includes(d.province!) && d.blessings?.split(";").map(value => value.trim()).includes(target.purpose) && d.searchText?.includes(target.name);
      }), target)).toBe(true);
      await expect(page.locator(cards).first().locator("[data-popular-temple-detail]")).toHaveAttribute("href", new RegExp(`/temples/${collection}/`));
      await page.locator("[data-popular-temple-filter-clear]").click();
      await expect(page.locator(mainQuery)).toHaveValue("");
      await expect(page.locator(province)).toContainText("ทั้งหมด");
      expect(await ids(page)).toEqual(before);
      expect(errors).toEqual([]);
    });
  }
}

test("working, draft, applied: multi-selection, local search, cancel, restore and clear", async ({ page }) => {
  const errors = await setup(page); await ready(page);
  const before = await ids(page);
  await page.locator(province).click();
  await choose(page, "กรุงเทพมหานคร"); await choose(page, "เชียงใหม่");
  await expect(page.locator(province)).toContainText("ทั้งหมด");
  await expect(page.locator("[data-pf-selection-count]")).toContainText("2 จังหวัด");
  await page.locator(optionQuery).fill("ไม่มีตัวเลือกนี้แน่นอน");
  await page.locator(optionQuery).press("Enter");
  await expect(page.locator("[data-pf-editor-status]")).toContainText("ไม่พบ");
  expect(await ids(page)).toEqual(before);
  await page.locator(optionQuery).fill(""); await done(page);
  await expect(page.locator(province)).toContainText("กรุงเทพมหานคร, เชียงใหม่");
  await expect(page.locator(province)).not.toContainText("+2");
  await expect(page.locator("[data-pf-status]")).toContainText("กดค้นหา");
  expect(await ids(page)).toEqual(before);
  await search(page);
  await expect(page.locator("[data-pf-status]")).toHaveText("");
  await expect(page.locator("[data-pf-applied]")).toBeVisible();
  const expected = await page.locator("[data-popular-temple-card]").evaluateAll(nodes => nodes.filter(n => ["กรุงเทพมหานคร", "เชียงใหม่"].includes((n as HTMLElement).dataset.province!)).slice(0, 16).map(n => (n as HTMLElement).dataset.cardKey));
  expect(await ids(page)).toEqual(expected);
  await page.locator(province).click(); await page.locator("[data-pf-clear-working]").click();
  await page.keyboard.press("Escape");
  await expect(page.locator(province)).toBeFocused();
  await page.locator(province).click();
  await expect(page.getByRole("checkbox", { name: "เชียงใหม่", exact: true })).toBeChecked();
  await done(page);
  await expect(page.locator("[data-pf-status]")).toHaveText("");
  await page.locator(mainQuery).fill("วัด");
  await page.locator("[data-pf-restore]").click();
  await expect(page.locator(mainQuery)).toHaveValue("");
  await page.locator("[data-popular-temple-filter-clear]").click();
  expect(await ids(page)).toEqual(before);
  expect(errors).toEqual([]);
});

test("collection sort, CMS refresh and compact card actions preserve their contracts", async ({ page }) => {
  const updatedContent = structuredClone(content);
  const errors = await setup(page);
  await ready(page);
  await page.locator("[data-popular-temple-more]").click();
  await expect(page.locator(cards)).toHaveCount(32);
  await page.getByRole("combobox", { name: "เรียงตาม", exact: true }).click();
  await page.getByRole("option", { name: "ชื่อ ก–ฮ", exact: true }).click();
  const names = await page.locator(cards).evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.name!));
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "th")));
  const firstCard = page.locator('[data-popular-temple-card][data-rank="1"]');
  const href = await firstCard.locator("[data-popular-temple-detail]").getAttribute("href");
  const key = decodeURIComponent(href!).split("/").filter(Boolean).slice(-2).join(":");
  updatedContent.temples ||= { records: {} };
  updatedContent.temples.records[key] = {
    enabled: true, status: "published",
    fields: { name: "วัดทดสอบข้อมูลล่าสุด", province: "เชียงใหม่", blessings: "สุขภาพ/อายุยืน" },
  };
  await page.route("**/api/admin/content?*", route => route.fulfill({ json: { ok: true, content: updatedContent } }));
  await page.evaluate(async () => (window as any).MongkolWelaCMS.reload());
  await expect(firstCard.locator("[data-collection-province]")).toHaveText("เชียงใหม่");
  await expect(firstCard.locator(".temple-collection-v2-province .ui-icon-mask")).toHaveCount(1);
  await expect(firstCard.locator("[data-collection-intent]")).toHaveText("สุขภาพ/อายุยืน");
  const plannerHref = await firstCard.locator(".temple-collection-v2-card-plan").getAttribute("href");
  expect(new URL(plannerHref!, "https://example.test").searchParams.get("start")).toBe("วัดทดสอบข้อมูลล่าสุด");
  expect(new URL(plannerHref!, "https://example.test").searchParams.get("province")).toBe("เชียงใหม่");
  expect(errors).toEqual([]);
});

test("collection mobile 320px, tablet and full-page visual evidence", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await setup(page);
  await ready(page);
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const card = page.locator(cards).first();
    const plan = await card.locator(".temple-collection-v2-card-plan").boundingBox();
    const detail = await card.locator(".temple-collection-v2-card-detail").boundingBox();
    expect(Math.abs(plan!.y - detail!.y)).toBeLessThan(2);
    expect(plan!.x + plan!.width).toBeLessThanOrEqual(detail!.x);
  }
  fs.mkdirSync("artifacts/visitor-collections", { recursive: true });
  for (const collection of ["popular", "mu", "sacred"]) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/temples/${collection}/`);
      await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
      await expect(page.locator("[data-page-loader]")).toHaveAttribute("aria-hidden", "true");
      await expect(page.locator(cards)).toHaveCount(width > 600 ? 16 : 6);
      await page.evaluate(() => document.fonts.ready);
      for (const card of await page.locator(cards).all()) await card.scrollIntoViewIfNeeded();
      await page.locator("main").evaluate(() => window.scrollTo(0, 0));
      await expect.poll(() => page.locator(cards).evaluateAll(nodes => nodes.every(n => {
        const img = n.querySelector("img")!;
        return img.complete && img.naturalWidth > 0;
      }))).toBe(true);
      await page.screenshot({ path: `artifacts/visitor-collections/${collection}-${width}-full.png`, fullPage: true });
    }
  }
  expect(errors).toEqual([]);
});

test("one editor, all versus selected-only, outside Search and AND matching", async ({ page }) => {
  await setup(page); await ready(page);
  await page.locator(province).click(); await choose(page, "เชียงใหม่");
  await page.locator(purpose).click();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await expect(page.locator(province)).toContainText("ทั้งหมด");
  await choose(page, "การงาน"); await choose(page, "โชคลาภ");
  await page.locator("[data-pf-selected-only]").click();
  await expect(page.locator(".pf-option:visible")).toHaveCount(2);
  await page.getByRole("checkbox", { name: "การงาน", exact: true }).uncheck();
  await page.getByRole("checkbox", { name: "โชคลาภ", exact: true }).uncheck();
  await expect(page.locator("[data-pf-editor-status]")).toContainText("ยังไม่ได้เลือก");
  await page.locator("[data-pf-selected-only]").click();
  await choose(page, "การงาน"); await done(page);
  await page.locator(province).click(); await choose(page, "พระนครศรีอยุธยา"); await done(page);
  await page.locator(mainQuery).fill("วัด");
  await page.locator(purpose).click(); await page.locator("[data-pf-clear-working]").click();
  await search(page);
  await expect(page.locator(dialog)).not.toBeVisible();
  await expect(page.locator(purpose)).toContainText("การงาน");
  await expect(page.locator(cards)).toHaveCount(1);
  const matches = await page.locator(cards).evaluateAll(ns => ns.every(n => {
    const d = (n as HTMLElement).dataset;
    return d.province === "พระนครศรีอยุธยา" && d.blessings?.split(";").map(s => s.trim()).includes("การงาน") && d.searchText?.includes("วัด");
  }));
  expect(matches).toBe(true);
});

async function inventory(page: Page, provinces: number, purposes: number, total = 243) {
  await page.evaluate(({ provinces, purposes, total }) => {
    const grid = document.querySelector("[data-popular-temple-grid]")!;
    while (grid.children.length < total) grid.append(grid.firstElementChild!.cloneNode(true));
    [...grid.children].forEach((node, index) => {
      const d = (node as HTMLElement).dataset;
      d.province = provinces ? `จังหวัดทดสอบ ${index % provinces}` : "";
      d.blessings = purposes ? `วัตถุประสงค์ทดสอบ ${index % purposes}` : "";
    });
    document.dispatchEvent(new CustomEvent("mw:temple-overrides-applied"));
  }, { provinces, purposes, total });
}

test("inventory-independent panel and out-of-flow editors, short/long/empty/500 options", async ({ page }) => {
  await setup(page); await ready(page);
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const heights: number[] = [];
    for (const [p, i] of [[3, 120], [120, 3], [1, 1], [0, 50], [500, 500]]) {
      await inventory(page, p, i, 500);
      heights.push((await page.locator(".pf__panel").boundingBox())!.height);
      const resultTop = await page.locator(".temple-collection-v2-results").evaluate(e => e.getBoundingClientRect().top - document.querySelector(".pf")!.getBoundingClientRect().top);
      await page.locator(province).click();
      expect(await page.locator(".temple-collection-v2-results").evaluate(e => e.getBoundingClientRect().top - document.querySelector(".pf")!.getBoundingClientRect().top)).toBeCloseTo(resultTop, 0);
      if (p === 0) await expect(page.locator("[data-pf-editor-status]")).toContainText("ไม่มีตัวเลือก");
      if (p === 500) {
        await page.locator(optionQuery).fill("จังหวัดทดสอบ 499");
        await choose(page, "จังหวัดทดสอบ 499");
        await expect(page.locator("[data-pf-selection-count]")).toContainText("1 จังหวัด");
      }
      await page.locator("[data-pf-close]").click();
    }
    expect(Math.max(...heights) - Math.min(...heights), `panel at ${width}`).toBeLessThanOrEqual(1);
  }
});

test("responsive geometry, collisions, focus and breakpoint state continuity", async ({ page }) => {
  await setup(page); await ready(page);
  for (const [width, height] of [[320,568],[360,800],[390,844],[430,932],[768,1024],[1024,768],[1280,800],[1440,900],[1920,1080],[844,390]]) {
    await page.setViewportSize({ width, height });
    await page.locator(province).click();
    const geometry = await page.locator(dialog).evaluate(e => {
      const r = e.getBoundingClientRect(); const footer = e.querySelector("footer")!.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, mode: (e as HTMLElement).dataset.mode, overflow: document.documentElement.scrollWidth > innerWidth + 1, footerBottom: footer.bottom };
    });
    expect(geometry.overflow, `${width}`).toBe(false);
    expect(geometry.left).toBeGreaterThanOrEqual(-1); expect(geometry.right).toBeLessThanOrEqual(width + 1);
    expect(geometry.top).toBeGreaterThanOrEqual(-1); expect(geometry.bottom).toBeLessThanOrEqual(height + 1);
    if (width < 768) await expect(page.locator("#pf-editor-title")).toBeFocused();
    if (height >= 430) expect(geometry.footerBottom).toBeLessThanOrEqual(height);
    await page.locator("[data-pf-close]").click();
    await expect(page.locator(province)).toBeFocused();
    expect(await page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(province).click(); await choose(page, "เชียงใหม่");
  await page.locator(optionQuery).fill("เชียง");
  for (const width of [768, 1024, 767, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator(optionQuery)).toHaveValue("เชียง");
    await expect(page.getByRole("checkbox", { name: "เชียงใหม่", exact: true })).toBeChecked();
    await expect(page.locator("dialog[open]")).toHaveCount(1);
  }
  await page.keyboard.press("Escape");
});

test("CMS refresh keeps draft/working, missing choices removable; malicious labels remain text", async ({ page }) => {
  await setup(page); await ready(page);
  await page.locator(province).click(); await choose(page, "เชียงใหม่"); await done(page);
  await search(page);
  await page.locator(mainQuery).fill("ยังไม่ได้ค้นหา");
  await page.locator(province).click(); await page.locator(optionQuery).fill("เชียง");
  await page.evaluate(() => {
    document.querySelectorAll("[data-popular-temple-card][data-province='เชียงใหม่']").forEach(e => { (e as HTMLElement).dataset.province = '<img src=x onerror="window.filterXss=1">'; });
    document.dispatchEvent(new CustomEvent("mw:temple-overrides-applied"));
  });
  await expect(page.locator(optionQuery)).toHaveValue("เชียง");
  await expect(page.getByRole("checkbox", { name: "เชียงใหม่ (ไม่มีในข้อมูลล่าสุด)", exact: true })).toBeChecked();
  await page.locator("[data-pf-done]").click();
  await expect(page.locator("[data-pf-editor-status]")).toContainText("กรุณานำออก");
  await page.locator("[data-pf-clear-working]").click(); await done(page);
  await expect(page.locator(mainQuery)).toHaveValue("ยังไม่ได้ค้นหา");
  expect(await page.evaluate(() => (window as any).filterXss)).toBeUndefined();
  await expect(page.locator(cards)).toHaveCount(0);
});

test("failed collection keeps initial cards and provides a real retry", async ({ page }) => {
  let fail = true;
  await page.route("**/assets/data/temple-collections/popular.json?*", route => fail ? route.fulfill({ status: 503, body: "unavailable" }) : route.continue());
  await setup(page);
  await expect(page.locator("[data-pf-status]")).toContainText("โหลดข้อมูลไม่ครบ");
  await expect(page.locator(cards)).toHaveCount(16);
  await expect(page.locator(cards).first().locator("[data-popular-temple-detail]")).toHaveAttribute("href", /\/temples\/popular\//);
  fail = false; await page.locator("[data-pf-retry]").click(); await ready(page);
  await expect(page.locator("[data-pf-retry]")).toBeHidden();
});

test("nearby late responses cannot undo Clear or newer draft; denied is recoverable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "permissions", { value: { query: async () => ({ state: "prompt" }) } });
    Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition: (success: any, failure: any) => { (window as any).locationCallback = success; (window as any).locationFailure = failure; } } });
  });
  await setup(page); await ready(page);
  const before = await ids(page);
  await page.locator("[data-popular-temple-nearby]").click();
  await expect(page.locator("[data-popular-temple-nearby]")).toHaveAttribute("aria-busy", "true");
  await page.locator("[data-popular-temple-filter-clear]").click();
  await page.evaluate(() => (window as any).locationCallback({ coords: { latitude: 13.7, longitude: 100.5 } }));
  await expect(page.locator("[data-popular-temple-nearby]")).toHaveAttribute("aria-pressed", "false");
  expect(await ids(page)).toEqual(before);
  await page.locator("[data-popular-temple-nearby]").click();
  await expect(page.locator("[data-popular-temple-nearby]")).toHaveAttribute("aria-busy", "true");
  await page.locator(mainQuery).fill("เชียงใหม่");
  await page.evaluate(() => (window as any).locationCallback({ coords: { latitude: 13.7, longitude: 100.5 } }));
  expect(await ids(page)).toEqual(before);
  await page.locator("[data-popular-temple-nearby]").click();
  await expect(page.locator("[data-popular-temple-nearby]")).toHaveAttribute("aria-busy", "true");
  await page.evaluate(() => (window as any).locationFailure({ code: 1 }));
  await expect(page.locator("[data-pf-status]")).toContainText("อนุญาต");
  expect(await ids(page)).toEqual(before);
  await search(page);
  await expect(page.locator("[data-pf-applied]")).toBeVisible();
  await page.locator("[data-popular-temple-nearby]").click();
  await expect(page.locator("[data-popular-temple-nearby]")).toHaveAttribute("aria-busy", "true");
  await page.evaluate(() => (window as any).locationCallback({ coords: { latitude: 18.7, longitude: 98.9 } }));
  await expect(page.locator("[data-popular-temple-nearby]")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-collection-sort]")).toHaveValue("nearby");
  await expect(page.getByRole("combobox", { name: "เรียงตาม", exact: true })).toContainText("ใกล้ฉัน");
  await page.locator(mainQuery).fill("วัดอรุณ");
  await page.locator("[data-popular-temple-nearby]").click();
  await expect(page.locator("[data-popular-temple-nearby]")).toHaveAttribute("aria-pressed", "false");
  await page.locator("[data-pf-applied] summary").click();
  await expect(page.locator("[data-collection-sort]")).toHaveValue("rank");
  await expect(page.locator("[data-pf-applied-details]")).toContainText("เชียงใหม่");
  await expect(page.locator("[data-pf-status]")).toContainText("กดค้นหา");
});

test("keyboard, focus traps, scoped accessibility and native mobile menu after sheet", async ({ page }) => {
  await setup(page); await ready(page);
  await page.locator(province).focus(); await page.keyboard.press("Enter");
  await expect(page.locator(optionQuery)).toBeFocused();
  await page.locator("[data-pf-done]").focus(); await page.keyboard.press("Tab");
  await expect(page.locator(dialog)).not.toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(purpose).click();
  await page.locator("[data-pf-done]").focus(); await page.keyboard.press("Tab");
  await expect(page.locator("[data-pf-close]")).toBeFocused();
  await page.keyboard.press("Shift+Tab"); await expect(page.locator("[data-pf-done]")).toBeFocused();
  const axe = await new AxeBuilder({ page }).include("#pf-editor").analyze();
  expect(axe.violations).toEqual([]);
  await page.keyboard.press("Escape");
  const mainAxe = await new AxeBuilder({ page }).include(".pf").analyze();
  expect(mainAxe.violations).toEqual([]);
  await page.locator(".mw-menu-toggle").click();
  await expect(page.locator(".mw-drawer")).toBeVisible();
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => document.body.style.position)).not.toBe("fixed");
});

test("name precedence, unchanged URL, batch reveal, card destinations and sibling collections", async ({ page }) => {
  await setup(page, "/temples/popular/?name=เชียงใหม่&q=กรุงเทพมหานคร");
  await expect(page.locator(mainQuery)).toHaveValue("เชียงใหม่");
  await expect(page.locator("[data-pf-status]")).toHaveText("");
  const url = page.url();
  await page.locator("[data-popular-temple-filter-clear]").click();
  await ready(page); expect(page.url()).toBe(url);
  await page.locator("[data-popular-temple-more]").click();
  await expect(page.locator(cards)).toHaveCount(32);
  await expect(page.locator(cards).first().locator(".temple-collection-v2-card-plan")).toHaveAttribute("href", /\/temples\/planner\/\?start=.+&province=/);
  for (const path of ["/temples/sacred/", "/temples/mu/"]) {
    await page.goto(path); await expect(page.locator(".pf")).toHaveCount(1);
    await expect(page.locator(".temple-collection-v2-advanced-filter")).toHaveCount(0);
    await page.locator(mainQuery).fill("วัด");
    await page.locator("[data-popular-temple-filter-form] button[type=submit]").click();
    await expect(page.locator(cards).first()).toBeVisible();
  }
});

test("no JS keeps readable initial cards and disables custom filters", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${test.info().project.use.baseURL || process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4360"}/temples/popular/`);
  await expect(page.locator("[data-popular-temple-card]")).toHaveCount(16);
  await expect(page.locator(province)).toBeDisabled();
  await expect(page.locator(".pf")).toContainText("เปิด JavaScript", { useInnerText: true });
  await context.close();
});

test("five selected values have a correct remainder, long labels wrap, short viewport actions remain reachable", async ({ page }) => {
  await setup(page); await ready(page);
  await page.locator(province).click();
  for (const name of ["กระบี่", "ขอนแก่น", "เชียงใหม่", "น่าน", "ภูเก็ต"]) await choose(page, name);
  await done(page);
  await expect(page.locator(province)).toContainText("กระบี่, ขอนแก่น +3");
  await page.locator(province).click();
  await page.locator(optionQuery).fill("น่าน");
  await page.locator(".pf-editor__all").click();
  await expect(page.locator("[data-pf-selection-count]")).toContainText("0 จังหวัด");
  await page.locator("[data-pf-close]").click();
  await page.locator("[data-popular-temple-filter-clear]").click();
  await inventory(page, 3, 120);
  await page.evaluate(() => {
    const long = "วัตถุประสงค์สำหรับการเดินทางและการศึกษาเรียนรู้ที่มีชื่อยาวเป็นพิเศษ";
    (document.querySelector("[data-popular-temple-card]") as HTMLElement).dataset.blessings = long;
    document.dispatchEvent(new CustomEvent("mw:temple-overrides-applied"));
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.locator(purpose).click();
  await page.locator(optionQuery).fill("วัตถุประสงค์สำหรับ");
  const option = page.locator(".pf-option:visible");
  expect(await option.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
  await option.click();
  await page.setViewportSize({ width: 390, height: 300 });
  await expect(page.locator(dialog)).toHaveClass(/is-short/);
  await page.locator("[data-pf-done]").scrollIntoViewIfNeeded();
  await done(page);
  await expect(page.locator(purpose)).toContainText("เลือกแล้ว 1 รายการ");
});

test("shared choice chips center labels without shifting on selection at desktop and mobile widths", async ({ page }) => {
  await setup(page); await ready(page);
  fs.mkdirSync("artifacts/chip-centering", { recursive: true });
  const geometry = (chip: ReturnType<Page["locator"]>) => chip.evaluate(node => {
    const box = node.getBoundingClientRect();
    const text = node.querySelector(".ui-choice-chip__label")!.getBoundingClientRect();
    return { width: box.width, height: box.height, x: text.left + text.width / 2 - box.left - box.width / 2, y: text.top + text.height / 2 - box.top - box.height / 2 };
  });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    const region = page.locator("[data-popular-region-tag]").first();
    expect(Math.abs((await geometry(region)).x)).toBeLessThan(1);
    for (const trigger of [province, purpose]) {
      await page.locator(trigger).click();
      const option = page.locator(".pf-option:visible").first();
      const before = await geometry(option);
      expect(Math.abs(before.x)).toBeLessThan(1);
      expect(Math.abs(before.y)).toBeLessThan(1);
      expect(before.height).toBeGreaterThanOrEqual(44);
      const all = await geometry(page.locator(".pf-editor__all"));
      expect(Math.abs(all.x)).toBeLessThan(1);
      expect(Math.abs(all.y)).toBeLessThan(1);
      await option.getByRole("checkbox").check();
      expect(await geometry(option)).toEqual(before);
      await expect(option.locator(".ui-choice-chip__check")).toHaveCSS("opacity", "1");
      if (trigger === province) await page.screenshot({ path: `artifacts/chip-centering/after-${width}.png` });
      await page.keyboard.press("Space");
      await expect(option.getByRole("checkbox")).not.toBeChecked();
      expect(await geometry(option)).toEqual(before);
      await page.locator("[data-pf-close]").click();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
