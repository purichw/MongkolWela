import { expect, test } from "@playwright/test";
import fs from "node:fs";

const content = JSON.parse(fs.readFileSync("public/admin/content/live.json", "utf8"));
const collections = [
  { key: "popular", label: "วัดดังน่าไป", count: 243 },
  { key: "sacred", label: "วัดเด่นขอพร", count: 217 },
  { key: "mu", label: "พิกัดสายมู", count: 165 },
];

for (const width of [1440, 390]) {
  test(`collection names remain consistent with unchanged routes at ${width}px`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
    await page.route("**/api/admin/content?*", route => route.fulfill({ json: { ok: true, content } }));
    await page.route("**/api/admin/analytics", route => route.fulfill({ status: 204 }));
    const ready = async (path: string) => {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
      await expect(page.locator("[data-page-loader]")).toHaveAttribute("aria-hidden", "true");
      await page.evaluate(() => document.fonts.ready);
    };
    for (const path of ["/", "/temples/"]) {
      await ready(path);
      for (const { key, label } of collections) {
        await expect(page.locator("#collections").getByRole("link", { name: new RegExp(label) })).toHaveAttribute("href", `/temples/${key}/`);
      }
    }
    await page.locator("#collections").scrollIntoViewIfNeeded();
    fs.mkdirSync("artifacts/collection-labels", { recursive: true });
    await page.screenshot({ path: `artifacts/collection-labels/hub-${width}.png` });
    if (width < 720) await page.getByRole("button", { name: "เปิดเมนู", exact: true }).click();
    else await page.getByLabel("เปิดเมนู วัดดังเสริมมงคล", { exact: true }).click();
    for (const { key, label } of collections) {
      const link = page.locator(width < 720 ? "#mw-navigation-dialog" : ".mw-panel--temples").getByRole("link", { name: label, exact: true });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", `/temples/${key}/`);
    }
    await page.screenshot({ path: `artifacts/collection-labels/menu-${width}.png` });
    for (const { key, label, count } of collections) {
      await ready(`/temples/${key}/`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(label);
      await expect(page).toHaveTitle(`${label} | มงคลเวลา`);
      await expect(page.locator("[data-popular-temple-count]")).toContainText(String(count));
      for (const peer of collections) {
        await expect(page.locator('[aria-label="หมวดวัด"]').getByRole("link", { name: peer.label, exact: true })).toHaveAttribute("href", `/temples/${peer.key}/`);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const detail = await page.locator("[data-popular-temple-card]:visible").first().getByRole("link", { name: "รายละเอียด", exact: true }).getAttribute("href");
      await ready(detail!);
      await expect(page.getByRole("link", { name: `กลับไป${label}`, exact: true })).toHaveAttribute("href", `/temples/${key}/`);
    }
    expect(errors).toEqual([]);
  });
}
