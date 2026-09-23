import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";

const content = JSON.parse(readFileSync(new URL("../../public/admin/content/live.json", import.meta.url), "utf8"));

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
  await page.route("**/api/admin/content?**", request => request.fulfill({ json: { ok: true, content } }));
});

test("all error views share readable artwork, recovery actions and accessible markup", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const status of [404, 403, 500]) {
    await page.goto(`/${status}/`);
    await expect(page.locator("main")).toHaveAttribute("data-error-status", String(status));
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("#error-title span").first()).toHaveCSS("font-family", /"Noto Sans Thai"/);
    await expect(page.locator("#error-title")).toHaveCSS("font-weight", "700");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
    await expect(page.locator(".page-fonts-pending")).toHaveCount(0);
    await page.evaluate(async () => {
      await document.fonts.ready;
      for (const image of document.querySelectorAll<HTMLImageElement>("main img")) await image.decode();
    });
    await expect(page.locator(".error-screen__action:visible")).toHaveCount(3);
    await expect(page.locator("main").getByRole("link", { name: "กลับหน้าแรก", exact: true })).toHaveAttribute("href", "/");
    await expect(page.locator("main").getByRole("link", { name: status === 403 ? "ติดต่อมงคลเวลา" : "ดูปฏิทินไทย", exact: true }))
      .toHaveAttribute("href", status === 403 ? "/#consult" : "/calendar/");
    if (status !== 500) await expect(page.locator("main").getByRole("link", { name: "วัดทั่วประเทศไทย", exact: true })).toHaveAttribute("href", "/temples/thailand/");
    const zero = (await page.locator(".error-screen__digit").nth(1).boundingBox())!;
    const lotus = (await page.locator(".error-screen__zero-lotus").boundingBox())!;
    expect(Math.abs(lotus.x + lotus.width / 2 - zero.x - zero.width / 2)).toBeLessThan(2);
    expect(lotus.y).toBeGreaterThan(zero.y);
    expect(lotus.y + lotus.height).toBeLessThan(zero.y + zero.height);
    const actions = await page.locator(".error-screen__action:visible").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height));
    expect(Math.min(...actions)).toBeGreaterThanOrEqual(44);
    expect(Math.max(...actions) - Math.min(...actions)).toBeLessThan(2);
    const axe = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  }
  expect(errors).toEqual([]);
});

test("unmatched nested URLs retain HTTP 404 and load the error stylesheet", async ({ page }) => {
  for (const path of ["/missing-error-page-test/", "/horoscope/palmistry/missing-error-page-test/"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.locator("main")).toHaveAttribute("data-error-status", "404");
    await expect(page.locator(".error-screen")).toHaveCSS("text-align", "center");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://mongkolwela.vercel.app/404.html");
  }
});

test("retry works by keyboard, preserves the URL and only reloads on demand", async ({ page }) => {
  let navigations = 0;
  page.on("request", request => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++;
  });
  await page.goto("/500/?source=retry-test");
  await expect(page.locator(".page-fonts-pending")).toHaveCount(0);
  const retry = page.getByRole("button", { name: "ลองใหม่อีกครั้ง", exact: true });
  await expect(retry).toBeVisible();
  expect(navigations).toBe(1);
  await retry.focus();
  await expect(retry).toBeFocused();
  const reload = page.waitForEvent("load");
  await page.keyboard.press("Enter");
  await reload;
  await expect(page).toHaveURL(/\/500\/\?source=retry-test$/);
  expect(navigations).toBe(2);
});

test("recovery remains available without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${baseURL}/500/?source=no-js`);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByRole("button", { name: "ลองใหม่อีกครั้ง", exact: true })).toBeHidden();
  const retry = page.getByRole("link", { name: "ลองใหม่อีกครั้ง", exact: true });
  await expect(retry).toHaveAttribute("href", "");
  await expect(page.locator(".error-screen__action:visible")).toHaveCount(3);
  const reload = page.waitForEvent("load");
  await retry.click();
  await reload;
  await expect(page).toHaveURL(/\/500\/\?source=no-js$/);
  await context.close();
});

test("mobile, tablet and desktop preserve the content and action bounds", async ({ page }) => {
  await page.goto("/403/");
  await expect(page.locator(".page-fonts-pending")).toHaveCount(0);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), { message: `${width}px overflow` }).toBeTruthy();
    for (const selector of ["h1", ".error-screen__description", ".error-screen__actions", ".error-screen__quote"]) {
      const box = (await page.locator(selector).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    }
    const description = (await page.locator(".error-screen__description").boundingBox())!;
    const actions = (await page.locator(".error-screen__actions").boundingBox())!;
    expect(actions.y).toBeGreaterThanOrEqual(description.y + description.height);
  }
});

test("error content and recovery links survive a CMS outage", async ({ page }) => {
  await page.route("**/api/admin/content?**", request => request.fulfill({ status: 503, json: { ok: false, error: "Test service unavailable" } }));
  await page.goto("/missing-error-page-test/");
  await expect(page.locator(".page-fonts-pending")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ไม่พบหน้านี้ในมงคลเวลาแล้ว");
  await expect(page.locator(".error-screen__action:visible")).toHaveCount(3);
  await expect(page.locator("main").getByRole("link", { name: "กลับหน้าแรก", exact: true })).toHaveAttribute("href", "/");
});
