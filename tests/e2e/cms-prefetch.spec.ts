import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { publicContentPayload } from "../../src/lib/public-content.js";

test.beforeEach(async ({ page }) => {
  await page.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
  await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
});

test("CMS begins before route modules load and is consumed once without revealing unfinished UI", async ({ page }) => {
  const content = JSON.parse(fs.readFileSync("public/admin/content/live.json", "utf8"));
  let reads = 0;
  await page.route("**/api/admin/content?*", route => {
    reads++;
    return route.fulfill({ json: publicContentPayload(content, "/") });
  });
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route(url => url.pathname.endsWith(".js"), async route => { await pending; await route.continue(); });
  try {
    const response = page.waitForResponse(response => response.url().includes("/api/admin/content?"));
    await page.goto("/", { waitUntil: "commit" });
    await response;
    expect(reads).toBe(1);
    expect(await page.evaluate(() => (window as any).MongkolWelaCMS)).toBeUndefined();
    await expect(page.locator("html")).toHaveClass(/page-fonts-pending/);
    release();
    await expect(page.locator("#hero-title")).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/page-fonts-ready/);
    expect(reads).toBe(1);
    expect(await page.evaluate(() => (window as any).MongkolWelaCMSRequest)).toBeUndefined();
    await page.evaluate(() => (window as any).MongkolWelaCMS.reload());
    expect(reads).toBe(2);
  } finally { release(); }
});

test("failed early request uses the existing error and fresh retry without an automatic duplicate", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  let reads = 0;
  const content = JSON.parse(fs.readFileSync("public/admin/content/live.json", "utf8"));
  await page.route("**/api/admin/content?*", route => {
    reads++;
    return route.fulfill(reads === 1
      ? { status: 503, json: { ok: false, error: "CMS unavailable" } }
      : { json: publicContentPayload(content, "/") });
  });
  await page.goto("/");
  await expect(page.locator("[data-cms-load-error]")).toBeVisible();
  expect(reads).toBe(1);
  await page.locator("[data-cms-load-error] button").click();
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
  await expect(page.locator("[data-cms-load-error]")).toHaveCount(0);
  expect(reads).toBe(2);
  expect(errors).toEqual([]);
});
