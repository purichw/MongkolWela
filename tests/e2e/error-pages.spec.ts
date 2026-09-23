import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { authEntryPoints, loginEntryHref } from "../../src/config/auth-entry-points";

const content = JSON.parse(readFileSync(new URL("../../public/admin/content/live.json", import.meta.url), "utf8"));
const statuses = [401, 403, 404, 429, 500, 502, 503, 504];

test.beforeEach(async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
  await context.route("**/api/admin/content?**", request => request.fulfill({ json: { ok: true, content } }));
});

for (const status of statuses) {
  test(`${status}: shared artwork, typography, recovery and accessible markup`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`/${status}/`);
    await expect(page.locator("main")).toHaveAttribute("data-error-status", String(status));
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("#error-title")).toHaveCSS("font-family", /"Noto Sans Thai"/);
    await expect(page.locator("#error-title")).toHaveCSS("font-weight", "700");
    await expect(page.locator(".error-screen__code")).toHaveCSS("color", "rgb(137, 21, 28)");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
    await expect(page.locator(".page-fonts-pending")).toHaveCount(0);
    await expect(page.locator(".mw-header")).toHaveAttribute("data-header-ready", "true");
    const artwork = page.locator(".error-screen__artwork img");
    await expect(artwork).toHaveAttribute("src", `/assets/images/errors/error-${status}.webp`);
    await artwork.evaluate(async (image: HTMLImageElement) => image.decode());
    await expect(artwork).toBeVisible();
    await expect(page.locator(".error-screen__action:visible")).toHaveCount(2);
    await expect(page.locator("main").getByRole("link", { name: "กลับหน้าหลัก", exact: true })).toHaveAttribute("href", "/");
    await expect(page.locator("[data-error-back]")).toHaveAttribute("href", "/");
    if (status === 401) await expect(page.locator("main").getByRole("link", { name: "เข้าสู่ระบบ", exact: true })).toHaveAttribute("href", loginEntryHref);
    if (status === 403) await expect(page.locator("main").getByRole("link", { name: "ติดต่อทีมงาน", exact: true })).toHaveAttribute("href", "/#consult");
    if (status === 404) await expect(page.locator("main").getByRole("link", { name: "ค้นหาวัดหรือสถานที่", exact: true })).toHaveAttribute("href", "/#site-search");
    const actions = await page.locator(".error-screen__action:visible").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height));
    expect(Math.min(...actions)).toBeGreaterThanOrEqual(44);
    expect(Math.max(...actions) - Math.min(...actions)).toBeLessThan(2);
    const image = (await page.locator(".error-screen__artwork").boundingBox())!;
    const copy = (await page.locator(".error-screen__content").boundingBox())!;
    if (page.viewportSize()!.width <= 720) expect(copy.y).toBeGreaterThanOrEqual(image.y + image.height - 1);
    else expect(copy.x).toBeGreaterThanOrEqual(image.x + image.width);
    const axe = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
    expect(errors).toEqual([]);
  });
}

test("unmatched nested URLs retain HTTP 404 and load the error stylesheet", async ({ page }) => {
  for (const path of ["/missing-error-page-test/", "/horoscope/palmistry/missing-error-page-test/"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.locator("main")).toHaveAttribute("data-error-status", "404");
    await expect(page.locator(".error-screen")).toHaveCSS("text-align", "center");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://mongkolwela.vercel.app/404.html");
  }
});

test("retry works by keyboard, preserves query and only reloads on demand", async ({ page }) => {
  let navigations = 0;
  page.on("request", request => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++;
  });
  for (const status of [429, 500, 502, 503, 504]) {
    const before = navigations;
    await page.goto(`/${status}/?source=retry-test`);
    await expect(page.locator(".page-fonts-pending")).toHaveCount(0);
    const retry = page.getByRole("button", { name: "ลองใหม่อีกครั้ง", exact: true });
    await expect(retry).toBeVisible();
    expect(navigations).toBe(before + 1);
    await retry.focus();
    await expect(retry).toBeFocused();
    const reload = page.waitForEvent("load");
    await page.keyboard.press("Enter");
    await reload;
    expect(new URL(page.url()).search).toBe("?source=retry-test");
    expect(navigations).toBe(before + 2);
  }
});

test("recovery remains available without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${baseURL}/500/?source=no-js`);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByRole("button", { name: "ลองใหม่อีกครั้ง", exact: true })).toBeHidden();
  const retry = page.getByRole("link", { name: "ลองใหม่อีกครั้ง", exact: true });
  await expect(retry).toHaveAttribute("href", "");
  await expect(page.locator(".error-screen__action:visible")).toHaveCount(2);
  const reload = page.waitForEvent("load");
  await retry.click();
  await reload;
  await expect(page).toHaveURL(/\/500\/\?source=no-js$/);
  await expect(page.locator("[data-error-back]")).toHaveAttribute("href", "/");
  await context.close();
});

test("mobile, tablet and desktop preserve content and action bounds", async ({ page }) => {
  await page.goto("/403/");
  await expect(page.locator(".page-fonts-pending")).toHaveCount(0);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), { message: `${width}px overflow` }).toBeTruthy();
    for (const selector of ["h1", ".error-screen__artwork", ".error-screen__description", ".error-screen__actions", ".error-screen__back"]) {
      const box = (await page.locator(selector).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    }
    const description = (await page.locator(".error-screen__description").boundingBox())!;
    const actions = (await page.locator(".error-screen__actions").boundingBox())!;
    expect(actions.y).toBeGreaterThanOrEqual(description.y + description.height);
  }
});

test("back restores an in-site history entry and direct visits recover to Home", async ({ page, baseURL }) => {
  await page.route("**/error-back-source/", route => route.fulfill({ contentType: "text/html", body: '<a href="/404/">Open missing page</a>' }));
  await page.goto("/error-back-source/");
  await page.getByRole("link", { name: "Open missing page" }).click();
  await expect(page.locator(".page-fonts-pending")).toHaveCount(0);
  await page.locator("[data-error-back]").click();
  await expect(page).toHaveURL(`${baseURL}/error-back-source/`);

  const direct = await page.context().newPage();
  await direct.goto(`${baseURL}/403/`);
  await expect(direct.locator(".page-fonts-pending")).toHaveCount(0);
  await direct.locator("[data-error-back]").click();
  await expect(direct).toHaveURL(`${baseURL}/`);
  await direct.close();
});

test("401 leads to the role-neutral login entry with real configured destinations", async ({ page }) => {
  await page.goto("/401/");
  await expect(page.locator(".page-fonts-pending")).toHaveCount(0);
  await page.locator("main").getByRole("link", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(loginEntryHref + "$"));
  await expect(page.locator("h1")).toHaveText("เข้าสู่ระบบ");
  await expect(page.locator(".login-entry__mark")).toBeVisible();
  await expect(page.locator("[data-login-entry]")).toHaveCount(authEntryPoints.length);
  for (const entry of authEntryPoints) {
    await expect(page.locator(`[data-login-entry="${entry.id}"]`)).toHaveAttribute("href", entry.href);
    await expect(page.locator(`[data-login-entry="${entry.id}"]`)).toHaveText(entry.label);
  }
});

test("shared navigation stays usable on an error page", async ({ page }) => {
  await page.goto("/404/");
  await expect(page.locator(".mw-header")).toHaveAttribute("data-header-ready", "true");
  const toggle = page.getByRole("button", { name: "เปิดเมนู", exact: true });
  if (await toggle.isVisible()) {
    await toggle.click();
    await expect(page.locator("#mw-navigation-dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#mw-navigation-dialog")).not.toBeVisible();
    await expect(toggle).toBeFocused();
  } else {
    const menu = page.locator(".mw-desktop-nav details").first();
    await menu.locator("summary").click();
    await expect(menu).toHaveAttribute("open", "");
    await page.keyboard.press("Escape");
    await expect(menu).not.toHaveAttribute("open", "");
  }
});

test("error content and recovery links survive a CMS outage", async ({ page }) => {
  await page.route("**/api/admin/content?**", request => request.fulfill({ status: 503, json: { ok: false, error: "Test service unavailable" } }));
  await page.goto("/missing-error-page-test/");
  await expect(page.locator(".page-fonts-pending")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ไม่พบหน้านี้ในมงคลเวลาแล้ว");
  await expect(page.locator(".error-screen__action:visible")).toHaveCount(2);
  await expect(page.locator("main").getByRole("link", { name: "กลับหน้าหลัก", exact: true })).toHaveAttribute("href", "/");
});
