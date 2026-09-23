import { sitePlaceholderImage } from "../../src/lib/image-placeholder.js";
import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import AxeBuilder from "@axe-core/playwright";

function fixture() {
  const content = JSON.parse(fs.readFileSync("public/admin/content/live.json", "utf8"));
  content.pages.find(p => p.id === "home").patches.find(p => p.selector === "#hero-title").value = "มงคลเวลา";
  return content;
}
async function setup(page: Page, content = fixture(), consent = "declined") {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(value => { if (value) localStorage.setItem("mongkolwela.pdpa.analytics", value); }, consent);
  await page.route("**/api/admin/content?*", r => r.fulfill({ json: { ok: true, content } }));
  await page.route("**/api/admin/analytics", r => r.fulfill({ status: 204 }));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
  await expect(page.locator("[data-page-loader]")).toHaveAttribute("aria-hidden", "true");
  await page.evaluate(() => document.fonts.ready);
  return errors;
}

test("responsive geometry, six intents and truthful canonical counts", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = await setup(page);
  const registry = JSON.parse(fs.readFileSync("public/assets/data/temples-thailand.json", "utf8"));
  const count = registry.rows.length.toLocaleString("en-US");
  await expect(page.locator("[data-temple-count]")).toHaveText([count, count]);
  await expect(page.locator(".home-intent-card")).toHaveCount(6);
  await expect(page.locator(".home-collection-card")).toHaveCount(3);
  await expect(page.locator(".home-sample-plan")).toContainText("เวลาเป็นตัวอย่าง");
  for (const width of [1440, 1280, 1100, 1024, 900, 820, 720, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 960 });
    const geometry = await page.evaluate(() => {
      const rect = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      const media = [...document.querySelectorAll(".home-intent-media")].map(e => e.getBoundingClientRect().height);
      return {
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        mediaSpread: Math.max(...media) - Math.min(...media),
        controlsHeight: rect(".hero-controls").height,
        controlsOverlap: innerWidth > 720
          ? rect(".hero-controls").top < rect(".hero-links").bottom
          : rect(".hero-controls").bottom > rect(".hero-search").top,
        searchFits: rect(".hero-search button").right <= rect(".hero-search").right,
        columns: getComputedStyle(document.querySelector(".home-intent-grid")!).gridTemplateColumns.split(" ").length,
      };
    });
    expect(geometry.overflow, `overflow at ${width}`).toBe(false);
    expect(geometry.mediaSpread, `image ratios at ${width}`).toBeLessThan(1);
    expect(geometry.controlsHeight, `carousel height at ${width}`).toBeLessThan(55);
    expect(geometry.controlsOverlap, `carousel overlaps content at ${width}`).toBe(false);
    expect(geometry.searchFits).toBe(true);
    expect(geometry.columns).toBe(width >= 1280 ? 6 : width > 720 ? 3 : 2);
  }
  expect(errors).toEqual([]);
});

test("mobile hero keeps three shortcuts, readable symbols and the daily card below the photo", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page);
  for (const width of [390, 360, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const geometry = await page.evaluate(() => {
      const rect = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      const tiles = [...document.querySelectorAll(".hero-links a")].map(e => e.getBoundingClientRect());
      return {
        rowSpread: Math.max(...tiles.map(t => t.top)) - Math.min(...tiles.map(t => t.top)),
        photoBottom: rect(".hero-carousel").bottom,
        dailyTop: rect(".home-today-card").top,
        creditRight: rect(".home-hero-credit").right,
        controlsLeft: rect(".hero-controls").left,
        iconWidth: rect(".hero-links .home-symbol").width,
        iconCenters: [...document.querySelectorAll(".home-stat-ticker dl > div:not(.home-stat-note)")].map(item => {
          const card = item.getBoundingClientRect();
          const icon = item.querySelector(".home-symbol")!.getBoundingClientRect();
          return Math.abs(icon.top + icon.height / 2 - card.top - card.height / 2);
        }),
      };
    });
    expect(geometry.rowSpread).toBeLessThan(1);
    expect(geometry.photoBottom).toBeLessThanOrEqual(geometry.dailyTop);
    expect(geometry.creditRight).toBeLessThanOrEqual(geometry.controlsLeft);
    expect(geometry.iconWidth).toBeGreaterThanOrEqual(26);
    expect(Math.max(...geometry.iconCenters)).toBeLessThan(1);
  }
  await page.locator(".mw-menu-toggle").click();
  await page.locator(".mw-drawer-search").click();
  await expect(page.locator("#header-temple-search")).toBeFocused();
  await page.getByRole("button", { name: "ปิดการค้นหา" }).click();
  await expect(page.locator(".home-today-date")).toBeVisible();
  await expect(page.locator(".home-today-date")).toHaveAttribute("href", "/calendar/day/");
  await page.locator(".mw-menu-toggle").click();
  await expect(page.locator(".mw-menu-toggle")).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(page.locator(".mw-menu-toggle")).toHaveAttribute("aria-expanded", "false");
});

test("compact discovery keeps image slots, mobile card rows and every tool reachable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = await setup(page);
  await expect(page.locator("img[data-cms-media]")).toHaveCount(14);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.locator("#supporting-tools").scrollIntoViewIfNeeded();
    await page.evaluate(async () => {
      for (const img of document.querySelectorAll<HTMLImageElement>("img[data-cms-media]")) {
        img.loading = "eager";
        await img.decode();
      }
    });
    const geometry = await page.evaluate(() => {
      const cards = [...document.querySelectorAll(".home-collection-card")].map(e => e.getBoundingClientRect());
      const intents = [...document.querySelectorAll(".home-intent-card")].map(e => e.getBoundingClientRect());
      return {
        collectionRowSpread: Math.max(...cards.map(r => r.top)) - Math.min(...cards.map(r => r.top)),
        maxIntentHeight: Math.max(...intents.map(r => r.height)),
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        media: [...document.querySelectorAll<HTMLImageElement>("img[data-cms-media]")].every(i => i.naturalWidth > 0 && !i.src.includes("placeholder")),
      };
    });
    expect(geometry.overflow).toBe(false);
    expect(geometry.media).toBe(true);
    expect(geometry.collectionRowSpread).toBeLessThan(1);
    if (width < 721) expect(geometry.maxIntentHeight).toBeLessThan(125);
  }
  await expect(page.locator(".home-tool-links a")).toHaveCount(5);
  const lastTool = page.locator(".home-tool-links a").last();
  await lastTool.focus();
  await expect(lastTool).toBeInViewport();
  await expect(lastTool).toHaveAttribute("href", "/horoscope/palmistry/");
  await expect(page.locator(".home-intent-card").first()).toHaveAttribute("href", "/temples/sacred/?q=โชคลาภ");
  expect(errors).toEqual([]);
});

test("daily card groups lunar information beside the moon without overlapping its date or weekday", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-23T18:00:00Z"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = await setup(page);
  await expect(page.locator("[data-home-weekday]")).toHaveText("วันพฤหัสบดี");
  await expect(page.locator(".home-today-date")).toContainText("24 กันยายน 2569");
  await expect(page.locator(".home-today-lunar")).toContainText("คำนวณเบื้องต้น");
  await expect(page.locator("[data-home-lunar]")).toContainText("ค่ำ");
  await expect(page.locator(".home-today-heading a")).toHaveAttribute("href", "/calendar/");
  for (const width of [1440, 1024, 390, 320]) {
    await page.setViewportSize({ width, height: 960 });
    const geometry = await page.evaluate(() => {
      const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
      const card = rect(".home-today-card"), moon = rect(".home-today-moon"), lunar = rect(".home-today-lunar");
      const badge = rect(".home-weekday"), note = rect(".home-today-note"), date = rect(".home-today-date");
      return {
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        dateClear: date.bottom <= moon.top,
        moonSize: moon.width,
        copyAligned: Math.abs(lunar.left - note.left) < 1,
        noteClear: note.top >= Math.max(badge.bottom, lunar.bottom),
        badgeFits: badge.right < card.right,
        overlap: lunar.left < badge.right && lunar.right > badge.left && lunar.top < badge.bottom && lunar.bottom > badge.top,
        cardHeight: card.height,
      };
    });
    expect(geometry.overflow, `overflow at ${width}`).toBe(false);
    expect(geometry.dateClear).toBe(true);
    expect(geometry.moonSize).toBeGreaterThanOrEqual(42);
    expect(geometry.copyAligned).toBe(true);
    expect(geometry.noteClear).toBe(true);
    expect(geometry.badgeFits).toBe(true);
    expect(geometry.overlap).toBe(false);
    if (width <= 720) expect(geometry.cardHeight).toBeLessThan(220);
  }
  expect(errors).toEqual([]);
});

test("home composition keeps mobile controls clear and footer links accessible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = await setup(page);
  const footer = page.locator("[data-home-footer-links]");
  const originalLinks = await footer.locator("a").evaluateAll(links => links.map(a => a.getAttribute("href")));
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const geometry = await page.evaluate(() => {
      const controls = document.querySelector(".hero-controls")!.getBoundingClientRect();
      const hero = document.querySelector(".hero")!.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(document.querySelector(".home-hero-subtitle")!);
      const textRects = [...range.getClientRects()];
      return {
        controlTop: controls.top - hero.top,
        controlRight: innerWidth - controls.right,
        overlapsTitle: textRects.some(r => r.left < controls.right && r.right > controls.left && r.top < controls.bottom && r.bottom > controls.top),
        footerHeight: document.querySelector(".site-footer")!.getBoundingClientRect().height,
      };
    });
    expect(geometry.controlTop).toBe(10);
    expect(geometry.controlRight).toBe(12);
    expect(geometry.overlapsTitle).toBe(false);
    expect(geometry.footerHeight).toBeLessThan(190);
    await expect(footer).not.toHaveAttribute("open");
    await footer.locator("summary").click();
    await expect(footer).toHaveAttribute("open", "");
    await expect(footer.locator("a").last()).toBeVisible();
    await expect(footer.locator("a[href='/temples/thailand/']")).toBeVisible();
    await footer.locator("summary").press("Enter");
    await expect(footer).not.toHaveAttribute("open");
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  await expect(footer).toHaveAttribute("open", "");
  expect(await footer.locator("a").evaluateAll(links => links.map(a => a.getAttribute("href")))).toEqual(originalLinks);
  await expect(page.locator(".home-database-panel")).toBeVisible();
  expect(errors).toEqual([]);
});

test("CMS discovery images refresh source and focal point and restore removed patches", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const content = fixture();
  const home = content.pages.find(p => p.id === "home");
  const patch = home.patches.find(p => p.id === "home-intent-love");
  const original = { ...patch };
  Object.assign(patch, { src: "/assets/images/home-intent-family.webp", position: "25% 75%", alt: "CMS photo override", credit: "CMS photographer" });
  const errors = await setup(page, content);
  const image = page.locator("#home-intent-love");
  await expect(image).toHaveAttribute("src", patch.src);
  await expect(image).toHaveCSS("object-position", patch.position);
  await expect(image).toHaveAttribute("alt", patch.alt);
  await expect(image).toHaveAttribute("data-image-credit", patch.credit);
  Object.assign(patch, { src: original.src, position: "60% 30%" });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(image).toHaveAttribute("src", original.src);
  await expect(image).toHaveCSS("object-position", "60% 30%");
  home.patches = home.patches.filter(p => p.id !== original.id);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(image).toHaveAttribute("src", original.src);
  await expect(image).toHaveCSS("object-position", original.position);
  await expect(image).toHaveAttribute("alt", original.alt);
  await expect(image).toHaveAttribute("data-image-credit", original.credit);
  expect(errors).toEqual([]);
});

test("shared public header keeps the same geometry, search and menu across routes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = await setup(page);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    let headerHeight: number | undefined;
    for (const path of ["/", "/calendar/", "/temples/popular/", "/temples/planner/", "/horoscope/seamsi/"]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
      await expect(page.locator("[data-page-loader]")).toHaveAttribute("aria-hidden", "true");
      await page.evaluate(() => document.fonts.ready);
      const geometry = await page.locator(".site-header").evaluate(header => {
        const r = (s: string) => header.querySelector(s)!.getBoundingClientRect();
        return {
          height: header.getBoundingClientRect().height,
          brandRight: r(".mw-brand").right,
          actionsLeft: r(".mw-header-actions").left,
          actionsRight: r(".mw-header-actions").right,
          menuLeft: r(".mw-menu-toggle").left,
          iconWidth: r(".mw-search .site-icon").width,
          overflow: header.scrollWidth > innerWidth,
        };
      });
      headerHeight ??= geometry.height;
      expect(geometry.height, `${path} / ${width}`).toBeCloseTo(headerHeight, 0);
      expect(geometry.overflow, `${path} / ${width}`).toBe(false);
      expect(geometry.brandRight).toBeLessThanOrEqual(geometry.actionsLeft);
      if (width >= 390) expect(geometry.iconWidth).toBe(22);
      await expect(page.locator(".mw-search")).toHaveAttribute("href", "/search/");
      await expect(page.locator(".mw-planner-cta")).toBeVisible();
      if (width <= 720) {
        expect(geometry.menuLeft).toBeGreaterThan(geometry.brandRight);
        await page.locator(".mw-menu-toggle").click();
        await expect(page.locator(".mw-drawer")).toBeVisible();
        await expect(page.locator(".mw-drawer")).toHaveAttribute("open", "");
        await page.keyboard.press("Escape");
        await expect(page.locator(".mw-menu-toggle")).toBeFocused();
        await expect(page.locator(".mw-drawer")).not.toHaveAttribute("open", "");
      }
    }
  }
  await page.locator(".mw-menu-toggle").click();
  await page.locator(".mw-drawer-search").click();
  await expect(page.locator("#temple-search-dialog")).toBeVisible();
  await expect(page.locator("#header-temple-search")).toBeFocused();
  expect(errors).toEqual([]);
});

test("shared desktop dropdown stays open while crossing from trigger into panel", async ({ page }) => {
  await setup(page);
  const item = page.locator(".mw-nav-item:has(.mw-disclosure)").last();
  const trigger = item.locator(":scope > a");
  const panel = item.locator(".mw-panel");
  await trigger.hover();
  await expect(panel).toHaveCSS("opacity", "1");
  const from = (await trigger.boundingBox())!;
  const to = (await panel.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.move(from.x + from.width / 2, to.y + 20, { steps: 12 });
  await expect(panel).toHaveCSS("opacity", "1");
  await expect(panel.locator("a").first()).toBeVisible();
});

test("carousel icons stay centered and mobile uses compact controls without demo credits", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const geometry = await page.locator(".hero-controls").evaluate(controls => {
      const panel = controls.getBoundingClientRect();
      return {
        width: panel.width, height: panel.height,
        centers: [...controls.querySelectorAll("button .site-icon")].filter(icon => icon.getBoundingClientRect().width).map(icon => {
          const i = icon.getBoundingClientRect();
          const b = icon.closest("button")!.getBoundingClientRect();
          return { x: Math.abs(i.x + i.width / 2 - b.x - b.width / 2), y: Math.abs(i.y + i.height / 2 - b.y - b.height / 2) };
        }),
      };
    });
    for (const center of geometry.centers) {
      expect(center.x).toBeLessThan(1);
      expect(center.y).toBeLessThan(1);
    }
    if (width <= 720) {
      expect(geometry.width).toBeLessThanOrEqual(110);
      expect(geometry.height).toBeLessThanOrEqual(28);
      await expect(page.locator(".carousel-dots")).toBeHidden();
    }
    await expect(page.locator("[data-home-hero-credit]")).toBeHidden();
    await page.locator("[data-carousel-next]").click();
    await expect(page.locator("[data-carousel-current]")).toHaveText("2");
    await expect(page.locator("[data-carousel-dot]").nth(1)).toHaveAttribute("aria-pressed", "true");
    await page.locator("[data-carousel-prev]").click();
    await expect(page.locator("[data-carousel-current]")).toHaveText("1");
  }
});

test("search trims Thai text, keeps q contract and does not navigate on whitespace", async ({ page }) => {
  await setup(page);
  await page.locator("#site-search").fill("   ");
  await page.locator("#site-search").press("Enter");
  await expect(page).toHaveURL(/\/$/);
  expect(await page.locator("#site-search").evaluate((e: HTMLInputElement) => e.validity.valid)).toBe(false);
  await page.route("**/search/?q=*", r => r.fulfill({ body: "<html lang='th'><h1>ปลายทางค้นหา</h1></html>", contentType: "text/html" }));
  await page.locator("#site-search").fill("  วัดอรุณ  ");
  await page.locator("#site-search").press("Enter");
  await expect(page).toHaveURL(/\/search\/\?q=/);
  expect(new URL(page.url()).searchParams.get("q")).toBe("วัดอรุณ");
});

test("published CMS copy/image/sections retain precedence, including long Thai copy", async ({ page }) => {
  const content = fixture();
  const home = content.pages.find(p => p.id === "home");
  const title = "วางแผนไหว้พระและค้นหาสถานที่ศักดิ์สิทธิ์ที่ตรงกับความตั้งใจของครอบครัว";
  home.patches.find(p => p.selector === "#hero-title").value = `<span>${title}</span>`;
  home.patches.find(p => p.selector === ".hero-slide:nth-child(1) img").src = "/assets/images/hero-jtha-98.jpg";
  home.patches.find(p => p.selector === "#site-search").value = "ค้นหาด้วยข้อความจาก CMS";
  home.sections.find(s => s.selector === ".home-intent-panel").enabled = false;
  await setup(page, content);
  await expect(page.locator("#hero-title")).toHaveText(title);
  await expect(page.locator(".hero-slide img").first()).toHaveAttribute("src", "/assets/images/hero-jtha-98.jpg");
  await expect(page.locator("#site-search")).toHaveAttribute("placeholder", "ค้นหาด้วยข้อความจาก CMS");
  await expect(page.locator("#intent")).toBeHidden();
  for (const width of [1440, 820, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const titleBox = await page.locator("#hero-title").boundingBox();
    const searchBox = await page.locator(".hero-search").boundingBox();
    expect(titleBox!.y + titleBox!.height).toBeLessThan(searchBox!.y);
  }
});

test("page fades once without rewinding hero copy, carousel stays lazy", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).titleAnimations = 0;
    (window as any).pageAnimations = 0;
    document.addEventListener("animationstart", e => {
      if ((e.target as Element).id === "hero-title") (window as any).titleAnimations++;
      if (e.animationName === "page-content-enter" && (e.target as Element).tagName === "MAIN") (window as any).pageAnimations++;
    });
  });
  await setup(page);
  await expect.poll(() => page.evaluate(() => (window as any).pageAnimations)).toBe(1);
  expect(await page.evaluate(() => (window as any).titleAnimations)).toBe(0);
  await expect(page.locator(".hero-slide img[src]")).toHaveCount(1);
  await page.locator("#site-search").fill("วัดอรุณ");
  await page.locator("#site-search").press("ArrowLeft");
  await expect(page.locator("[data-carousel-dot]").first()).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-carousel-next]").click();
  await expect(page.locator(".hero-slide img[src]")).toHaveCount(2);
  await expect(page.locator("[data-carousel-dot]").nth(1)).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-carousel-prev]").click();
  expect(await page.evaluate(() => (window as any).titleAnimations)).toBe(0);
  expect(await page.evaluate(() => (window as any).pageAnimations)).toBe(1);
  await page.locator("[data-carousel-pause]").click();
  await expect(page.locator("[data-carousel-pause]")).toHaveAttribute("aria-pressed", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("[data-carousel-pause]")).toBeDisabled();
  expect(await page.locator("#hero-title").evaluate(e => getComputedStyle(e).opacity)).toBe("1");
});

test("CMS hero media refreshes crop and credit, preserves lazy loading and restores removed patches", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const content = fixture();
  const home = content.pages.find(p => p.id === "home");
  const second = home.patches.find(p => p.id === "home-hero-image-2");
  const original = { ...second };
  Object.assign(second, { src: "/assets/images/hero-jtha-98.jpg", position: "60% 35%", credit: "CMS photographer", sourceUrl: "https://example.com/photo", license: "CMS license", licenseUrl: "https://example.com/license" });
  const errors = await setup(page, content);
  const image = page.locator(".hero-slide img").nth(1);
  const credit = page.locator("[data-home-hero-credit]");
  await expect(page.locator(".hero-slide img[src]")).toHaveCount(1);
  await expect(image).toHaveAttribute("data-carousel-src", second.src);
  await page.locator("[data-carousel-next]").click();
  await expect(image).toHaveAttribute("src", second.src);
  await expect(image).toHaveCSS("object-position", "60% 35%");
  await expect(credit).toContainText("CMS photographer");
  await expect(credit.locator("a").first()).toHaveAttribute("href", "https://example.com/photo");

  const refresh = () => page.evaluate(() => window.dispatchEvent(new Event("focus")));
  Object.assign(second, { src: "/assets/images/hero-jtha-83.jpg", position: "40% 20%", credit: "Changed credit", sourceUrl: "javascript:alert(1)", licenseUrl: "data:text/html,unsafe" });
  await refresh();
  await expect(image).toHaveAttribute("src", second.src);
  await expect(image).toHaveCSS("object-position", "40% 20%");
  await expect(credit).toContainText("Changed credit");
  await expect(credit.locator("a")).toHaveCount(0);

  second.src = "";
  await refresh();
  await expect(image).not.toHaveAttribute("src");
  await expect(credit).toBeHidden();
  await page.locator("[data-carousel-prev]").click();
  await page.locator("[data-carousel-next]").click();
  await expect(image).not.toHaveAttribute("src");

  // Older published image patches have no optional metadata.
  second.src = "/assets/images/hero-jtha-80.jpg";
  for (const key of ["position", "credit", "sourceUrl", "license", "licenseUrl"]) delete second[key];
  await refresh();
  await expect(image).toHaveAttribute("src", second.src);
  await expect(image).toHaveCSS("object-position", "65% 50%");
  await expect(credit).toBeHidden();

  home.patches = home.patches.filter(p => p.id !== second.id);
  await refresh();
  await expect(image).toHaveAttribute("src", original.src);
  await expect(image).toHaveCSS("object-position", original.position);
  await expect(credit).toContainText(original.credit);
  expect(errors).toEqual([]);
});

test("lower sections reveal after refresh and never depend on motion JS to be visible", async ({ page }) => {
  await setup(page);
  await page.locator("#collections").scrollIntoViewIfNeeded();
  await expect(page.locator(".home-collection-card").first()).toHaveClass(/home-entered/);
  await page.reload();
  await page.locator("#collections").scrollIntoViewIfNeeded();
  await expect(page.locator(".home-collection-card").first()).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.locator(".home-collection-card").first().evaluate(e => getComputedStyle(e).opacity)).toBe("1");
});

test("image failures preserve fixed media geometry and a readable hero", async ({ page }) => {
  await setup(page);
  const image = page.locator(".home-intent-media img").first();
  const before = await page.locator(".home-intent-media").first().boundingBox();
  await image.evaluate((e: HTMLImageElement) => {
    e.removeAttribute("srcset");
    e.src = "/missing-home-qa-image.jpg";
  });
  await expect(image).toHaveAttribute("src", sitePlaceholderImage);
  await expect(image).not.toHaveAttribute("srcset");
  const after = await page.locator(".home-intent-media").first().boundingBox();
  expect(after!.height).toBe(before!.height);
  await page.locator(".hero-slide img").first().evaluate((e: HTMLImageElement) => { e.src = "/missing-hero-qa.jpg"; });
  await expect(page.locator(".hero-slide img").first()).toHaveAttribute("src", sitePlaceholderImage);
  await expect(page.locator("#hero-title")).toBeVisible();
  await expect(page.locator("#site-search")).toBeVisible();
});

test("Bangkok date wins over visitor timezone", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.setFixedTime(new Date("2026-09-20T18:30:00Z"));
  await setup(page);
  await expect(page.locator(".home-today-date")).toContainText("21 กันยายน 2569");
  await expect(page.locator(".home-today-card")).not.toContainText("เลขมงคล");
});

test("automatic carousel can be paused, and respects a live reduced-motion change", async ({ page }) => {
  await setup(page);
  await page.clock.install();
  await page.mouse.move(0, 0);
  await page.clock.runFor(8100);
  await expect(page.locator("[data-carousel-dot]").nth(1)).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-carousel-pause]").click();
  await page.locator("[data-carousel-pause]").blur();
  await page.mouse.move(0, 0);
  await page.clock.runFor(16100);
  await expect(page.locator("[data-carousel-dot]").nth(1)).toHaveAttribute("aria-pressed", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.runFor(16100);
  await expect(page.locator("[data-carousel-dot]").nth(1)).toHaveAttribute("aria-pressed", "true");
});

test("acceptance persists and shared consent CSS is available on Calendar", async ({ page }) => {
  await setup(page, fixture(), "");
  await page.locator("[data-pdpa-accept]").click();
  await expect(page.locator(".pdpa-consent")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".pdpa-consent")).toHaveCount(0);
  await page.evaluate(() => localStorage.removeItem("mongkolwela.pdpa.analytics"));
  await page.goto("/calendar/");
  await expect(page.locator(".pdpa-consent")).toBeVisible();
  expect(await page.locator(".pdpa-consent").evaluate(e => getComputedStyle(e).position)).toBe("fixed");
});

test("static Home remains readable without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("#hero-title")).toBeVisible();
  await expect(page.locator(".hero-links a").first()).toBeVisible();
  await expect(page.locator(".home-collection-card")).toHaveCount(3);
  expect(await page.locator(".home-collection-card").first().evaluate(e => getComputedStyle(e).opacity)).toBe("1");
  await context.close();
});

test("consent stays styled, declines persist, and mobile navigation stays internally scrollable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, fixture(), "");
  const banner = page.locator(".pdpa-consent");
  await expect(banner).toBeVisible();
  expect(await banner.evaluate(e => getComputedStyle(e).position)).toBe("fixed");
  await page.locator("[data-pdpa-decline]").click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(banner).toHaveCount(0);
  await page.getByRole("button", { name: "เปิดเมนู", exact: true }).click();
  await expect(page.locator(".mw-drawer")).toBeVisible();
  expect(await page.locator(".mw-drawer-scroll").evaluate(e => ["auto", "scroll"].includes(getComputedStyle(e).overflowY))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "เปิดเมนู", exact: true })).toHaveAttribute("aria-expanded", "false");
});

test("main accessibility floor at desktop and mobile", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 });
    const result = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
  }
});
