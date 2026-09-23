import { expect, test } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";

const content = JSON.parse(readFileSync("public/admin/content/live.json", "utf8"));
const removedCopy = /วิธีกันผลมั่ว|โครงสร้างการอ่านดวง|ฐานความรู้สำหรับรอบถัดไป|แหล่งข้อมูลที่ใช้ยืนยัน|ที่มาของข้อมูล|รายละเอียดการคำนวณ|ephemeris/;

for (const width of [1440, 390]) {
  test(`public tools retain their core UI without internal methodology at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
    await page.route("**/api/admin/content?*", r => r.fulfill({ json: { ok: true, content } }));
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    mkdirSync("artifacts/public-content-cleanup", { recursive: true });

    for (const [name, route, ready] of [
      ["palmistry", "/horoscope/palmistry/", "[data-palm-diagram]"],
      ["calendar", "/calendar/?year=2569&month=9", "#cal-month-title"],
      ["day", "/calendar/day/?date=2026-09-20", '[data-calendar-day-detail][data-state="ready"]'],
    ]) {
      await page.goto(route);
      if (name === "palmistry") {
        await page.locator(".palm-reference-disclosure > summary").click();
      }
      await expect(page.locator(ready)).toBeVisible();
      await page.locator("html[data-cms-ready=true]").waitFor();
      await page.locator("[data-page-loader]").waitFor({ state: "hidden" });
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("main")).not.toContainText(removedCopy);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (name === "palmistry") {
        await page.locator('[data-palm-view="mounts"]').click();
        await expect(page.locator('[data-palm-layer="mounts"]')).toHaveAttribute("aria-hidden", "false");
        await expect(page.locator(".palm-method, .palm-sources")).toHaveCount(0);
        await page.locator("#palmistry-tool [data-line]").first().click();
        await expect(page.locator("#palmistry-tool [data-variant]").first()).toBeVisible();
      }
      if (name === "calendar") {
        await expect(page.locator(".cal-data-note")).toContainText("ประกาศทางการ");
        await expect(page.locator(".cal-data-note details")).toHaveCount(0);
        await expect(page.locator("#cal-year-facts")).not.toContainText("ephemeris");
      }
      await page.evaluate(() => {
        const main = document.querySelector("main")!;
        scrollTo({ top: main.getBoundingClientRect().bottom + scrollY - innerHeight + 150, behavior: "instant" });
      });
      await page.evaluate(async () => {
        for (const image of document.images) {
          const box = image.getBoundingClientRect();
          if (box.bottom > 0 && box.top < innerHeight) {
            image.loading = "eager";
            await image.decode().catch(() => {});
          }
        }
      });
      await page.screenshot({ path: `artifacts/public-content-cleanup/${name}-${width}.png` });
    }
    expect(errors).toEqual([]);
  });
}
