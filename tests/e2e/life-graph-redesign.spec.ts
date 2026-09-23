import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";

const content = JSON.parse(readFileSync("public/admin/content/live.json", "utf8"));

test("draft edits during a calendar request are not marked as committed", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.addInitScript(() => {
    localStorage.setItem("mongkolwela.pdpa.analytics", "declined");
    (window as any).MONKOL_WELA_THAI_CALENDAR_ENDPOINT = location.origin + "/__life-calendar";
  });
  await page.route("**/api/admin/content?*", route => route.fulfill({ json: { ok: true, content } }));
  await page.route("**/__life-calendar/*", async route => {
    if (route.request().url().endsWith("2001-05-14")) await pending;
    await route.fulfill({ json: { data: { lunar_date: { month: 10, year_animal: "ชวด", phase: "ขึ้น", day: 9, month_name: "เดือนสิบ" } } } });
  });
  await page.goto("/horoscope/life-graph/");
  const output = page.locator("[data-life-graph-output]");
  await expect(output).toHaveAttribute("data-state", "ready");
  await expect(page.locator(".calendar-source")).toContainText("CalenOS");
  await expect(page.locator("[data-page-loader]")).toHaveAttribute("aria-hidden", "true");
  await page.locator('[name="birthDate"]').fill("2001-05-14");
  await page.getByRole("button", { name: "คำนวณกราฟชีวิต", exact: true }).click();
  await expect(output).toHaveAttribute("aria-busy", "true");
  await page.locator('[name="name"]').fill("ข้อมูลใหม่ระหว่างรอ");
  release();
  await expect(output).toHaveAttribute("aria-busy", "false");
  await expect(output).toHaveAttribute("data-state", "dirty");
  await expect(page.locator("#life-result-title")).toHaveText("ผู้มาเยือน");
  await expect(page.locator('[name="name"]')).toHaveValue("ข้อมูลใหม่ระหว่างรอ");
  await expect(page.locator('[name="name"]')).toBeFocused();
  await page.getByRole("button", { name: "คำนวณกราฟชีวิต", exact: true }).click();
  await expect(output).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#life-result-title")).toHaveText("ข้อมูลใหม่ระหว่างรอ");
});

for (const width of [1440, 390]) {
  test(`life graph real calculation, responsive presentation and sharing at ${width}`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => {
      localStorage.setItem("mongkolwela.pdpa.analytics", "declined");
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
      Object.defineProperty(navigator, "clipboard", { value: { writeText: async (text: string) => { (window as any).__sharedText = text; } }, configurable: true });
    });
    await page.route("**/api/admin/content?*", route => route.fulfill({ json: { ok: true, content } }));
    await page.goto("/horoscope/life-graph/");
    const output = page.locator("[data-life-graph-output]");
    await expect(output).toHaveAttribute("data-origin", "sample");
    await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
    await expect(page.locator("[data-page-loader]")).toHaveAttribute("aria-hidden", "true");
    await page.evaluate(() => document.fonts.ready);
    await page.locator('[name="birthDate"]').fill("1996-09-21");
    await page.locator('[name="transitDate"]').fill("2026-09-21");
    await page.locator('[name="name"]').fill('<b>ผู้ทดสอบกราฟ</b>');
    await page.getByRole("button", { name: "คำนวณกราฟชีวิต", exact: true }).click();
    await expect(output).toHaveAttribute("data-origin", "user");
    await expect(page.locator("#life-result-title")).toHaveText('<b>ผู้ทดสอบกราฟ</b>');
    await expect(page.locator("#life-result-title b")).toHaveCount(0);
    await expect(page.locator("#life-result-title")).toBeFocused();
    const values = await page.locator('.life-score-table:visible [data-life-score]').allTextContents();
    expect(values).toHaveLength(12);
    const average = Number((values.reduce((sum, val) => sum + Number(val), 0) / 12).toFixed(1));
    await expect(page.locator(".life-score strong")).toHaveText(String(average));
    await expect(page.locator(".life-chart")).toHaveCount(1);
    await expect(page.locator(".life-point")).toHaveCount(12);
    await expect(page.locator(".life-house-card")).toHaveCount(12);
    await page.locator(".life-point").first().focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".life-house-card").first()).toHaveAttribute("open", "");
    await expect(page.locator(".life-house-card summary").first()).toBeFocused();
    await page.locator(".life-house-card summary").first().click();
    await page.locator(".life-basis-details summary").click();
    await expect(page.locator(".life-basis-table tbody tr")).toHaveCount(5);
    await page.locator(".life-basis-details summary").click();
    await page.locator("[data-life-share]").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.locator("[data-life-share-confirm]").click();
    await expect(page.locator("[data-life-share-status]")).toHaveText("คัดลอกผลลัพธ์แล้ว");
    const shared = await page.evaluate(() => (window as any).__sharedText);
    expect(shared).toContain(`ค่าเฉลี่ย ${average}`);
    expect(shared).not.toContain("ผู้ทดสอบกราฟ");
    expect(shared).not.toContain("2539");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.locator("[data-life-share]")).toBeFocused();
    await page.locator('[name="birthDate"]').fill("");
    await page.getByRole("button", { name: "คำนวณกราฟชีวิต", exact: true }).click();
    await expect(page.locator(".life-score strong")).toHaveText(String(average));
    await expect(output).toHaveAttribute("data-state", "dirty");
    await page.locator('[name="birthDate"]').fill("1996-09-21");
    await page.locator('[name="name"]').fill("ผู้มาเยือน");
    await page.getByRole("button", { name: "คำนวณกราฟชีวิต", exact: true }).click();
    await expect(output).toHaveAttribute("data-state", "ready");
    for (const size of [320, 768, 1024, width]) {
      await page.setViewportSize({ width: size, height: 1000 });
      await expect(page.locator(".life-chart")).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow at ${size}`).toBe(true);
      await expect(page.locator(".life-score strong")).toHaveText(String(average));
    }
    const art = page.locator(".tools-hero__ornament");
    expect(await art.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    const axe = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.filter(v => ["serious", "critical"].includes(v.impact!))).toEqual([]);
    await page.evaluate(() => scrollTo(0, 0));
    mkdirSync("artifacts/life-graph-redesign", { recursive: true });
    await page.screenshot({ path: `artifacts/life-graph-redesign/actual-${width}.png`, fullPage: true });
    await output.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `artifacts/life-graph-redesign/result-${width}.png` });
    expect(errors).toEqual([]);
  });
}
