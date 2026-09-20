import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const content = JSON.parse(readFileSync(new URL("../../public/admin/content/live.json", import.meta.url), "utf8"));
const calendar = "[data-calendar-app]";

async function ready(page: Page) {
  await expect(page.locator(calendar)).toHaveAttribute("data-state", "ready");
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-20T05:00:00Z"));
  await page.route("**/api/admin/content?*", route => route.fulfill({ json: { ok: true, content } }));
  await page.route("**/api/admin/analytics", route => route.fulfill({ status: 204 }));
  await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
});

test("month/year boundaries, leap days, reload and browser history stay in sync", async ({ page }) => {
  await page.goto("/calendar/?year=2569&month=1");
  await ready(page);
  await expect(page.locator(".cal-month-table")).toHaveCount(1);
  await expect(page.locator(".cal-month-tile")).toHaveCount(12);
  await page.locator('[data-month-step="-1"]').click();
  await expect(page.locator("#cal-month-title")).toHaveText("ธันวาคม 2568");
  await expect(page.locator("[data-calendar-year]")).toHaveValue("2568");
  await page.locator('[data-month-step="1"]').click();
  await expect(page.locator("#cal-month-title")).toHaveText("มกราคม 2569");
  await page.goBack();
  await expect(page.locator("#cal-month-title")).toHaveText("ธันวาคม 2568");
  await page.goForward();
  await expect(page.locator("#cal-month-title")).toHaveText("มกราคม 2569");
  await page.locator("[data-calendar-year]").selectOption("2567");
  await page.locator('.cal-month-nav [data-month="2"]').click();
  await expect(page.locator(".cal-day")).toHaveCount(29);
  await page.reload();
  await ready(page);
  await expect(page.locator("#cal-month-title")).toHaveText("กุมภาพันธ์ 2567");
  await expect(page.locator('[data-date="2024-02-29"]')).toBeAttached();
  await page.goto("/calendar/?year=2300&month=1");
  await ready(page);
  await expect(page.locator('[data-month-step="-1"]')).toBeDisabled();
  await page.goto("/calendar/?year=2700&month=12");
  await ready(page);
  await expect(page.locator('[data-month-step="1"]')).toBeDisabled();
});

test("invalid and legacy URLs normalize; Today still opens the actual day detail", async ({ page }) => {
  await page.goto("/calendar/?year=bad&month=20&view=broken");
  await ready(page);
  await expect(page.locator("#cal-month-title")).toHaveText("กันยายน 2569");
  await expect(page.locator('[aria-current="date"]')).toHaveAttribute("data-date", "2026-09-20");
  await page.goto("/calendar/?year=2568#month-7");
  await ready(page);
  await expect(page.locator("#cal-month-title")).toHaveText("กรกฎาคม 2568");
  await expect(page.locator("#cal-month-title")).toBeFocused();
  await expect(page.locator("[data-calendar-today]")).toHaveAttribute("href", "/calendar/day/?date=2026-09-20");
  await page.locator("[data-calendar-today]").click();
  await expect(page).toHaveURL(/\/calendar\/day\/\?date=2026-09-20/);
  await expect(page.locator("h1")).toContainText("20 กันยายน 2569");
  expect(await page.locator('link[href*="calendar-overview"]').count()).toBe(0);
});

test("all three views work and concurrent core events remain reachable", async ({ page }) => {
  await page.goto("/calendar/?year=2569&month=5");
  await ready(page);
  const day = page.locator('[data-date="2026-05-01"]');
  for (const label of ["วันแรงงาน", "วันพระ", "วิสาขบูชา"]) await expect(day).toHaveAttribute("aria-label", new RegExp(label));
  if ((page.viewportSize()?.width || 0) > 600) {
    await expect(day.locator(".cal-more-desktop")).toHaveText("+1");
  }
  await expect(day).toHaveAttribute("href", "/calendar/day/?date=2026-05-01");
  await page.locator('.cal-view-switch [data-view="month"]').click();
  await expect(page.locator(calendar)).toHaveAttribute("data-view", "month");
  await page.locator('.cal-view-switch [data-view="events"]').click();
  await expect(page.locator(".cal-events-group")).toHaveCount(12);
  const row = page.locator('#cal-events-5 a[href="/calendar/day/?date=2026-05-01"]');
  for (const label of ["วันแรงงาน", "วันพระ", "วิสาขบูชา"]) await expect(row).toContainText(label);
  await page.locator('.cal-month-nav [data-month="12"]').click();
  await expect(page.locator("#cal-events-12")).toBeFocused();
  await page.locator('.cal-view-switch [data-view="overview"]').click();
  await expect(page.locator("#cal-month-title")).toHaveText("ธันวาคม 2569");
  await expect(page.locator(".cal-events-group")).toHaveCount(0);
  await page.locator('[data-month-tile][data-month="4"]').click();
  await expect(page.locator("#cal-month-title")).toHaveText("เมษายน 2569");
  await expect(page.locator("#cal-month-title")).toBeFocused();
});

test("mobile dates open the real detail route and retain selection on Back", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/calendar/?year=2569&month=5");
  await ready(page);
  const day = page.locator('[data-date="2026-05-01"]');
  await expect(day.locator(".cal-mobile-indicators .cal-badge")).toHaveCount(1);
  await expect(day.locator(".cal-mobile-indicators small")).toHaveText("+2");
  await day.click();
  await expect(page).toHaveURL(/\/calendar\/day\/\?date=2026-05-01/);
  await expect(page.locator("h1")).toContainText("1 พฤษภาคม 2569");
  for (const label of ["วันแรงงาน", "วันพระ", "วิสาขบูชา"]) await expect(page.locator("[data-calendar-day-detail]")).toContainText(label);
  await page.goBack();
  await ready(page);
  await expect(day).toHaveClass(/is-selected/);
  await page.reload();
  await ready(page);
  await expect(day).toHaveClass(/is-selected/);
  await page.locator('[data-date="2026-05-02"]').focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/date=2026-05-02/);
  await expect(page.locator("h1")).toContainText("2 พฤษภาคม 2569");
});

test("loading failures are explicit and retry restores content and keyboard focus", async ({ page }) => {
  // Fault the data boundary in the test response, never add a production debug hook.
  await page.route("**/src/scripts/calendar-view-model.js*", async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace("getYear(year) {", "getYear(year) { if (!globalThis.__calendarFaultSeen) { globalThis.__calendarFaultSeen = true; throw new Error('Test calculation fault'); }");
    await route.fulfill({ response, body });
  });
  await page.goto("/calendar/?year=2569&month=1");
  await expect(page.locator(calendar)).toHaveAttribute("data-state", "error");
  await expect(page.getByRole("alert")).toContainText("ไม่สามารถแสดงข้อมูลปฏิทิน");
  await expect(page.locator(".cal-month-table")).toHaveCount(0);
  await page.getByRole("button", { name: "ลองอีกครั้ง", exact: true }).click();
  await ready(page);
  await expect(page.locator("#cal-month-title")).toBeFocused();
  await expect(page.locator(".cal-day")).toHaveCount(31);
});

test("responsive layouts, sticky toolbar, keyboard and reduced motion remain usable", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [1440, 768, 430, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/calendar/?year=2569&month=9");
    await ready(page);
    await expect(page.locator('.cal-month-nav [data-month="9"]')).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const bounds = await page.locator(".cal-day:visible").evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
    expect(Math.min(...bounds)).toBeGreaterThanOrEqual(44);
    await expect(page.locator(".cal-day")).toHaveCount(30);
    await expect(page.locator(".cal-month-table th")).toHaveCount(7);
    await expect(page.locator(".cal-summary-month")).toBeVisible();
    if (width <= 600) {
      await expect(page.locator('.cal-day[aria-current="date"] .cal-lunar-line')).toBeVisible();
      await expect(page.locator(".cal-month-events")).toBeVisible();
      await expect(page.locator(".nav-cta-site")).toBeVisible();
      const columns = await page.locator(".cal-summaries").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length);
      expect(columns).toBe(2);
      const monthIsVisible = await page.locator(".cal-month-nav").evaluate(nav => {
        const selected = nav.querySelector('[aria-pressed="true"]')!.getBoundingClientRect();
        const box = nav.getBoundingClientRect();
        return selected.left >= box.left && selected.right <= box.right;
      });
      expect(monthIsVisible).toBe(true);
      await expect(page.locator('[data-calendar-today]')).toHaveAttribute("href", "/calendar/day/?date=2026-09-20");
    }
    await page.locator('[data-month-tile][data-month="10"]').click();
    await expect(page.locator("#cal-month-title")).toBeFocused();
    const geometry = await page.evaluate(() => ({
      toolbarBottom: document.querySelector(".cal-toolbar")!.getBoundingClientRect().bottom,
      titleTop: document.querySelector("#cal-month-title")!.getBoundingClientRect().top,
    }));
    expect(geometry.titleTop).toBeGreaterThanOrEqual(geometry.toolbarBottom);
    if (width <= 600) {
      await page.locator('[data-calendar-view]').focus();
      await expect(page.locator('[data-calendar-view]')).toBeFocused();
      await page.locator('[data-calendar-view]').selectOption('month');
    } else {
      await page.locator('.cal-view-switch [data-view="month"]').focus();
      await page.keyboard.press("Enter");
    }
    await expect(page.locator(calendar)).toHaveAttribute("data-view", "month");
    await ready(page);
    expect(await page.locator(".cal-day").first().evaluate(node => getComputedStyle(node).transitionDuration)).toBe("0s");
  }
  expect(errors).toEqual([]);
});

test("mobile preview expands to every date, keeps late-date selection, and exposes all months", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/calendar/?year=2569&month=1');
  await ready(page);
  await expect(page.locator('.cal-month-table tbody tr:visible')).toHaveCount(3);
  await expect(page.locator('.cal-day')).toHaveCount(31);
  await expect(page.locator('[data-date="2026-01-31"]')).not.toBeVisible();
  await page.locator('[data-expand-month]').click();
  await expect(page.locator('.cal-day:visible')).toHaveCount(31);
  await expect(page.locator('[data-expand-month]')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('[data-date="2026-01-31"]').click();
  await expect(page).toHaveURL(/date=2026-01-31/);
  await page.goBack();
  await ready(page);
  await expect(page.locator('[data-date="2026-01-31"]')).toBeVisible();
  await page.reload();
  await ready(page);
  await expect(page.locator('[data-date="2026-01-31"]')).toBeVisible();
  await expect(page.locator('.cal-month-table tbody tr:visible')).toHaveCount(3);
  await page.locator('[data-calendar-view]').selectOption('month');
  await expect(page.locator('.cal-day:visible')).toHaveCount(31);
  await expect(page.locator('[data-expand-month]')).not.toBeVisible();
  await page.locator('[data-calendar-view]').selectOption('events');
  await expect(page.locator('.cal-events-group')).toHaveCount(12);
  await page.locator('[data-calendar-view]').selectOption('overview');
  await expect(page.locator('[data-calendar-guide]')).toBeVisible();
  await page.locator('[data-expand-year]').click();
  await expect(page.locator('[data-calendar-overview]')).toHaveClass(/is-expanded/);
  await page.locator('[data-month-tile][data-month="12"]').click();
  await expect(page.locator('#cal-month-title')).toHaveText('ธันวาคม 2569');
  await expect(page.locator('[data-expand-year]')).toHaveAttribute('aria-expanded', 'true');
});

test("CMS calendar media survive view changes and the shared footer renders on both routes", async ({ page }) => {
  const patched = structuredClone(content);
  const patches = patched.pages.find((item: { id: string }) => item.id === 'calendar').patches;
  for (const patch of patches) {
    patch.src = '/assets/images/hero-wat-arun-sunset.webp';
    patch.alt = 'Calendar CMS test image';
    patch.position = '60% 40%';
  }
  await page.route('**/api/admin/content?*', route => route.fulfill({ json: { ok: true, content: patched } }));
  await page.goto('/calendar/?year=2569&month=1');
  await ready(page);
  await expect(page.locator('#calendar-hero-image')).toHaveAttribute('alt', 'Calendar CMS test image');
  await page.locator('.cal-view-switch [data-view="events"]').click();
  await page.locator('.cal-view-switch [data-view="overview"]').click();
  await expect(page.locator('#calendar-guide-image')).toHaveAttribute('alt', 'Calendar CMS test image');
  await expect(page.locator('#calendar-guide-image')).toHaveCSS('object-position', '60% 40%');
  await page.route('**/assets/images/calendar-test-unavailable.webp', route => route.fulfill({ status: 404, body: '' }));
  await page.locator('#calendar-hero-image').evaluate(image => image.setAttribute('src', '/assets/images/calendar-test-unavailable.webp'));
  await expect(page.locator('#calendar-hero-image')).toHaveAttribute('src', '/assets/images/temple-placeholder-auspicious.png');
  for (const route of ['/calendar/', '/']) {
    await page.goto(route);
    await expect(page.locator('.site-footer--home-v2')).toHaveCSS('background-color', 'rgb(26, 16, 11)');
    await expect(page.locator('.site-footer-home-grid')).toHaveCSS('display', 'grid');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.site-footer-home-links')).not.toHaveAttribute('open');
    await page.locator('.site-footer-home-links > summary').click();
    await expect(page.locator('.site-footer-home-navs')).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });
  }
});
