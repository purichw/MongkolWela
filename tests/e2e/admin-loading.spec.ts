import { expect, test } from "@playwright/test";
import { createAdminAuthPreview } from "../helpers/admin-auth-preview.mjs";
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from "../helpers/supabase-auth-fixture.mjs";

let preview;
test.beforeAll(async () => { preview = await createAdminAuthPreview({ astroBase: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4324" }); });
test.afterAll(async () => { await preview?.close(); });
test.beforeEach(() => { Object.assign(preview.auth.state, { active: true, outage: false, authOutage: false }); });

async function signIn(context) {
  const response = await context.request.post(`${preview.base}/api/admin/session`, {
    headers: { Origin: preview.base }, data: { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD },
  });
  expect(response.ok()).toBe(true);
}

async function holdSession(page) {
  let release, reached;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const requested = new Promise<void>(resolve => { reached = resolve; });
  await page.route("**/api/admin/session", async route => {
    if (route.request().method() === "GET") { reached(); await gate; }
    await route.continue();
  });
  return { release, requested };
}

test.describe("initial document", () => {
  test.use({ javaScriptEnabled: false });
  test("does not include the Dashboard before JavaScript runs", async ({ page }) => {
    await page.goto(`${preview.base}/admin/`);
    await expect(page.locator(".mw-admin-shell")).toHaveCount(0);
    await expect(page.locator("[data-admin-auth-pending]")).toBeVisible();
    expect(await page.locator("noscript").textContent()).toContain("JavaScript");
    await expect(page.locator("noscript p")).toBeVisible();
  });
});

for (const outcome of ["signed-out", "revoked", "unavailable"]) {
  test(`pending session stays outside the Dashboard: ${outcome}`, async ({ page, context }, info) => {
    if (outcome !== "signed-out") await signIn(context);
    if (outcome === "revoked") preview.auth.state.active = false;
    if (outcome === "unavailable") preview.auth.state.authOutage = true;
    const errors = [], dataRequests = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => {
      if (/\/api\/admin\/(content|temples|analytics|media|activities)/.test(request.url())) dataRequests.push(request.url());
    });
    // Observe parser output and every subsequent render, not just the final login screen.
    await page.addInitScript(() => {
      (window as any).__adminShellSeen = false;
      new MutationObserver(() => {
        if (document.querySelector(".mw-admin-shell")) (window as any).__adminShellSeen = true;
      }).observe(document, { childList: true, subtree: true });
    });
    const held = await holdSession(page);
    try {
      await page.goto(`${preview.base}/admin/`, { waitUntil: "domcontentloaded" });
      await held.requested;
      await expect(page.locator(".mw-admin-shell")).toHaveCount(0);
      await expect(page.locator("[data-page-loader]")).toHaveAttribute("aria-hidden", "false");
      await expect(page.locator("#adminApp")).toHaveCSS("visibility", "hidden");
      expect(dataRequests).toEqual([]);
      if (outcome === "signed-out") {
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: info.outputPath("session-pending.png"), fullPage: true });
      }
      held.release();
      await expect(page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true })).toBeVisible();
      await expect(page.locator("[data-admin-auth-pending]")).toHaveCount(0);
      await expect(page.locator(".mw-admin-shell")).toHaveCount(0);
      expect(await page.evaluate(() => (window as any).__adminShellSeen)).toBe(false);
      expect(dataRequests).toEqual([]);
      if (outcome === "signed-out") {
        await expect(page.locator("#loginError")).toBeEmpty();
        await page.screenshot({ path: info.outputPath("signed-out.png"), fullPage: true });
      } else await expect(page.locator("#loginError")).not.toBeEmpty();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
      expect(errors).toEqual([]);
    } finally { held.release(); }
  });
}

test("valid session renders the Dashboard only after verification, including reload", async ({ page, context }) => {
  await signIn(context);
  for (let attempt = 0; attempt < 2; attempt++) {
    const held = await holdSession(page);
    try {
      if (attempt) await page.reload({ waitUntil: "domcontentloaded" });
      else await page.goto(`${preview.base}/admin/`, { waitUntil: "domcontentloaded" });
      await held.requested;
      await expect(page.locator("[data-page-loader]")).toHaveAttribute("aria-hidden", "false");
      await expect(page.locator("#adminApp")).toHaveCSS("visibility", "hidden");
      await expect(page.locator(".mw-admin-shell")).toHaveCount(0);
      held.release();
      await expect(page.locator(".mw-admin-profile strong")).toHaveText(TEST_ADMIN_EMAIL);
      await expect(page.locator("#adminContent")).toBeVisible();
      await expect(page.locator("[data-admin-auth-pending]")).toHaveCount(0);
    } finally {
      held.release();
      await page.unroute("**/api/admin/session");
    }
  }
});

test("sign-in rechecks the session before rendering and logout returns to login", async ({ page }) => {
  await page.goto(`${preview.base}/admin/`);
  await page.getByLabel("อีเมล", { exact: true }).fill(TEST_ADMIN_EMAIL);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(TEST_ADMIN_PASSWORD);
  const held = await holdSession(page);
  try {
    await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
    await held.requested;
    await expect(page.locator("[data-admin-auth-pending]")).toBeVisible();
    await expect(page.locator(".mw-admin-shell")).toHaveCount(0);
    held.release();
    await expect(page.locator(".mw-admin-profile strong")).toHaveText(TEST_ADMIN_EMAIL);
    await page.getByLabel("บัญชีผู้ดูแล", { exact: true }).click();
    await page.getByRole("button", { name: "ออกจากระบบ", exact: true }).click();
    await expect(page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true })).toBeVisible();
    await expect(page.locator(".mw-admin-shell")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true })).toBeVisible();
    await expect(page.locator(".mw-admin-shell")).toHaveCount(0);
  } finally { held.release(); }
});
