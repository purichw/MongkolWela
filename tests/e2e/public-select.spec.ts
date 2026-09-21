import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { chooseOption } from "./select-helpers";

const content = JSON.parse(readFileSync(new URL("../../public/admin/content/live.json", import.meta.url), "utf8"));
const control = (page: Page, selector: string) => page.locator(".mw-select").filter({ has: page.locator(selector) });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
  await page.route("**/api/admin/content?**", route => route.fulfill({ json: { ok: true, revision: "custom-select-qa", content } }));
});

test("custom selects preserve cascading filters, search, clear, and accessibility", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/temples/thailand/");
  const type = control(page, "[data-temple-type]");
  const province = () => control(page, "[data-temple-province]");
  await expect(type).toHaveAttribute("data-searchable", "false");
  await expect(province()).toHaveAttribute("aria-disabled", "true");
  await chooseOption(page, "[data-temple-type]", "พระอารามหลวง");
  await chooseOption(page, "[data-temple-region]", "ภาคกลาง");
  await expect(province()).toHaveAttribute("data-searchable", "true");
  await province().click();
  const popup = page.locator(".choices__list--dropdown:popover-open");
  const search = popup.getByRole("searchbox");
  await expect(search).toBeFocused();
  await search.fill("กรุงเทพ");
  await expect(popup.getByRole("option")).toHaveCount(1);
  await expect(popup.getByRole("option")).toHaveText("กรุงเทพมหานคร");
  const axe = await new AxeBuilder({ page }).include(".mw-select").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.filter(issue => ["serious", "critical"].includes(issue.impact!))).toEqual([]);
  await mkdir(".local/custom-select", { recursive: true });
  await page.screenshot({ path: `.local/custom-select/search-${info.project.name}.png`, scale: "css" });
  await search.fill("zzzznotfound");
  await expect(popup).toContainText("ไม่พบรายการที่ตรงกับคำค้น");
  await search.fill("กรุงเทพ");
  await popup.getByRole("option", { name: "กรุงเทพมหานคร", exact: true }).click();
  await expect(page.locator("[data-temple-province]")).toHaveValue("กรุงเทพมหานคร");
  await expect(page.locator("[data-temple-district]")).toBeEnabled();
  await page.locator("[data-temple-clear]").click();
  await expect(page.locator("[data-temple-type]")).toHaveValue("");
  await expect(type.locator(".choices__list--single")).toContainText("ทั้งหมด");
  await expect(province()).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator(".choices__list--dropdown:popover-open")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("keyboard, native forms, validation, and async option updates share one control", async ({ page }) => {
  await page.goto("/temples/thailand/");
  await expect(control(page, "[data-temple-type]")).toBeVisible();
  await page.evaluate(() => {
    const form = document.createElement("form");
    form.id = "select-contract";
    form.innerHTML = '<label for="contract-select">ตัวเลือกทดสอบ</label><select id="contract-select" name="choice" required><option value="">เลือก</option><option value="a">Alpha</option><option value="b">Beta</option><option value="c">Gamma</option><option value="x" disabled>Disabled</option></select><input aria-label="ช่องถัดไป"><button type="submit">ยืนยัน</button><button type="reset">ล้าง</button>';
    form.addEventListener("submit", event => event.preventDefault());
    form.addEventListener("change", () => { form.dataset.changes = String(Number(form.dataset.changes || 0) + 1); });
    document.querySelector("main")!.prepend(form);
  });
  const form = page.locator("#select-contract");
  const select = page.locator("#contract-select");
  const combo = control(page, "#contract-select");
  await expect(combo).toBeVisible();
  await combo.focus();
  await page.keyboard.press("Space");
  await expect(combo).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(select).toHaveValue("c");
  await expect(combo).toBeFocused();
  expect(await form.evaluate((el: HTMLFormElement) => Object.fromEntries(new FormData(el)))).toEqual({ choice: "c" });
  await expect(form).toHaveAttribute("data-changes", "1");
  await combo.press("Enter");
  await combo.press("Escape");
  await expect(combo).toHaveAttribute("aria-expanded", "false");
  await expect(combo).toBeFocused();
  await combo.press("Tab");
  await expect(form.getByRole("textbox", { name: "ช่องถัดไป" })).toBeFocused();
  await form.getByRole("button", { name: "ล้าง", exact: true }).click();
  await expect(select).toHaveValue("");
  await expect(combo.locator(".choices__list--single")).toHaveText("เลือก");
  await form.getByRole("button", { name: "ยืนยัน", exact: true }).click();
  await expect(combo).toHaveAttribute("aria-invalid", "true");
  await expect(combo).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await select.evaluate((el: HTMLSelectElement) => {
    el.replaceChildren(...Array.from({ length: 10 }, (_, i) => new Option(`Option ${i}`, String(i))));
    el.append(new Option('<img src=x onerror="alert(1)">', "literal"));
    el.value = "2";
  });
  await expect(combo).toHaveAttribute("data-searchable", "true");
  await expect(combo.locator(".choices__list--single")).toHaveText("Option 2");
  await combo.click();
  const popup = combo.locator(":popover-open");
  await popup.getByRole("searchbox").fill("<img");
  await expect(popup.getByRole("option")).toHaveText('<img src=x onerror="alert(1)">');
  await expect(popup.locator("img")).toHaveCount(0);
  await popup.getByRole("searchbox").press("Escape");
  await expect(combo).toBeFocused();
  await select.evaluate((el: HTMLSelectElement) => { el.disabled = true; });
  await expect(combo).toHaveAttribute("aria-disabled", "true");
  await expect(combo).toHaveAttribute("tabindex", "-1");
  await select.evaluate((el: HTMLSelectElement) => { el.disabled = false; });
  await expect(combo).toHaveAttribute("aria-disabled", "false");
  await select.evaluate((el: HTMLSelectElement) => {
    el.replaceChildren(...[...el.options].map(option => option.cloneNode(true)));
  });
  await chooseOption(page, "#contract-select", "3");
  await expect(select).toHaveValue("3");
  await form.evaluate(el => el.remove());
  await expect(page.locator("#contract-select")).toHaveCount(0);
});

test("compact calendar popup stays within a narrow viewport and restores focus", async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/calendar/?year=2569&month=9&view=month");
  const year = control(page, "[data-calendar-year]");
  await expect(year).toHaveAttribute("data-searchable", "true");
  await year.scrollIntoViewIfNeeded();
  await year.click();
  const popup = year.locator(":popover-open");
  await expect(popup.getByRole("searchbox")).toBeFocused();
  await expect.poll(async () => {
    const box = await popup.boundingBox();
    return !!box && box.x >= 0 && box.x + box.width <= 321 && box.y >= 0 && box.y + box.height <= 741;
  }).toBe(true);
  await mkdir(".local/custom-select", { recursive: true });
  await page.screenshot({ path: `.local/custom-select/calendar-${info.project.name}-320.png`, scale: "css" });
  await popup.getByRole("searchbox").fill("2568");
  await expect(popup.getByRole("option")).toHaveCount(1);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-calendar-year]")).toHaveValue("2568");
  await expect(year.locator(".choices__list--single")).toContainText("2568");
  await expect(year).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("native fallback remains usable without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${baseURL}/calendar/`);
  await expect(page.locator("[data-calendar-year]")).toBeVisible();
  await expect(page.locator("[data-calendar-year]")).not.toHaveAttribute("hidden");
  await expect(page.locator(".mw-select")).toHaveCount(0);
  await context.close();
});
