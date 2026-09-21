import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import fs from "node:fs/promises";

const seed = JSON.parse(readFileSync(new URL("../../public/admin/content/live.json", import.meta.url), "utf8"));

for (const futureItems of [false, true]) {
  test(`header balances visual gaps with ${futureItems ? "new CMS items" : "current navigation"}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const content = structuredClone(seed);
    if (futureItems) content.navigation.tabs = [
      content.navigation.tabs[0],
      { id: "new-guide", label: "คู่มือ", href: "temples/", items: [] },
      { id: "new-group", label: "เพิ่มเติม", href: "calendar/", items: [{ id: "new-child", label: "ปฏิทิน", href: "calendar/" }] },
      { id: "new-news", label: "ข่าว", href: "calendar/", items: [{ id: "disabled-child", label: "ข่าวเก่า", href: "calendar/", enabled: false }] },
      { id: "new-contact", label: "ติดต่อ", href: "#consult", items: [] },
    ];
    await page.route("**/api/admin/content?**", route => route.fulfill({ json: { ok: true, revision: "header-spacing", content } }));
    await page.goto("/calendar/");
    const header = page.locator(".mw-header");
    await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
    await page.evaluate(() => document.fonts.ready);
    await expect(header).toHaveAttribute("data-header-mode", "wide");
    await expect(page.locator(".mw-desktop-nav > .mw-nav-item")).toHaveCount(content.navigation.tabs.length);
    const gaps = () => page.locator(".mw-desktop-nav").evaluate(nav => {
      const items = [...nav.children];
      return items.slice(0, -1).map((item, index) => {
        const end = item.querySelector(":scope > details > summary > .mw-chevron") || item.querySelector(".mw-top-link");
        return items[index + 1].querySelector(".mw-top-link")!.getBoundingClientRect().left - end!.getBoundingClientRect().right;
      });
    });
    const originalGaps = await gaps();
    expect(Math.max(...originalGaps) - Math.min(...originalGaps)).toBeLessThan(1);
    await fs.mkdir(".local/nav-spacing", { recursive: true });
    await page.screenshot({ path: `.local/nav-spacing/${futureItems ? "future-cms" : "after"}-1440.png`, clip: { x: 0, y: 0, width: 1440, height: 165 } });

    // The compensation must track component sizing, not a one-off pixel offset.
    await page.addStyleTag({ content: ".site-header.mw-header { --mw-nav-trigger-size: 48px; --mw-nav-chevron-size: 20px; }" });
    const resizedGaps = await gaps();
    expect(Math.max(...resizedGaps) - Math.min(...resizedGaps)).toBeLessThan(1);
    expect(resizedGaps[0]).toBeGreaterThan(originalGaps[0]);
    await page.locator(".mw-disclosure > summary").first().click();
    await expect(page.locator(".mw-disclosure[open]")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.locator(".mw-disclosure[open]")).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(header).toHaveAttribute("data-header-mode", "compact");
    await page.locator(".mw-menu-toggle").click();
    await expect(page.locator("dialog[open]")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
  });
}
