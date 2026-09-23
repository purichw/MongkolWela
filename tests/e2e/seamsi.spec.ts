import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { chooseOption } from "./select-helpers";

const content = JSON.parse(readFileSync(new URL("../../public/admin/content/live.json", import.meta.url), "utf8"));
const route = "/horoscope/seamsi/";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
  await page.route("**/api/admin/content?**", request => request.fulfill({ json: { ok: true, content } }));
});

test("seamsi composition, responsive order and artwork", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(route);
  await expect(page.locator(".mw-select")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".page-fonts-pending")).toHaveCount(0);
  await expect(page.locator("main h1")).toHaveText("คำเซียมซี");
  await expect(page.locator("[data-seamsi-form]")).toHaveCount(1);
  await expect(page.locator("[data-seamsi-category] option")).toHaveCount(6);
  for (const selector of [".seamsi-cup-image", ".seamsi-stage-lotus"]) {
    await expect(page.locator(selector)).toBeVisible();
    expect(await page.locator(selector).evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBeTruthy();
  }
  await page.screenshot({ path: `.local/seamsi-design/empty-${info.project.name}.png`, fullPage: true, animations: "disabled" });

  for (const width of [320, 390, 768, 1024, 1491]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), { message: `${width}px` }).toBeTruthy();
    const form = await page.locator(".seamsi-form").boundingBox();
    const stage = await page.locator(".seamsi-stage").boundingBox();
    const result = await page.locator(".seamsi-result").boundingBox();
    if (width < 768) expect(form!.y + form!.height).toBeLessThanOrEqual(stage!.y);
    else expect(form!.x + form!.width).toBeLessThanOrEqual(stage!.x);
    expect(stage!.y + stage!.height).toBeLessThanOrEqual(result!.y);
    const cup = await page.locator(".seamsi-oracle").boundingBox();
    expect(cup!.width).toBeGreaterThanOrEqual(44);
  }
  expect(errors).toEqual([]);
});

test("category, question, busy state, full reading and reset preserve the journey", async ({ page }, info) => {
  await page.goto(route);
  await chooseOption(page, "[data-seamsi-category]", "work");
  const question = "<img src=x onerror=alert(1)> งานนี้ควรเดินหน้าต่อไหม";
  await page.locator("[data-seamsi-question]").fill(question);
  await page.locator("[data-seamsi-shake]").click();
  await expect(page.locator("[data-seamsi-shake]")).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator("[data-seamsi-shake]")).toBeFocused();
  await expect(page.locator("[data-seamsi-oracle]")).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator("[data-seamsi-result]")).toHaveAttribute("aria-busy", "true");
  const selected = await page.evaluate(() => localStorage.getItem("monkolSeamsiLastNumber"));
  await page.locator("[data-seamsi-form]").evaluate((form: HTMLFormElement) => form.requestSubmit());
  expect(await page.evaluate(() => localStorage.getItem("monkolSeamsiLastNumber"))).toBe(selected);
  await expect(page.locator(".seamsi-result-card")).toBeVisible();
  await expect(page.locator("[data-seamsi-result]")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#seamsi-result-title")).toBeFocused();
  await expect(page.locator(".seamsi-question")).toHaveText(`คำถาม: ${question}`);
  await expect(page.locator(".seamsi-question img")).toHaveCount(0);
  await expect(page.locator(".seamsi-result-copy .section-kicker")).toHaveText("เรื่องการงาน");
  await expect(page.locator(".seamsi-reading-list dt")).toHaveText(["คำทำนาย", "คำแนะนำ", "ข้อควรระวัง", "มงคลประจำใบ"]);
  await expect(page.locator("[data-seamsi-stick]")).toHaveText(selected!);
  await page.screenshot({ path: `.local/seamsi-design/reading-${info.project.name}.png`, fullPage: true, animations: "disabled" });
  const first = await page.locator(".seamsi-result-head strong").innerText();

  await expect(page.locator("[data-seamsi-oracle]")).toHaveAttribute("aria-label", "ดูใบเซียมซี");
  await expect(page.locator("#seamsi-stage-title")).toHaveText("ดูใบเซียมซี");
  await expect(page.locator("[data-seamsi-button-label]")).toHaveText("ตั้งคำถามใหม่");
  await page.locator("[data-seamsi-oracle]").click();
  await expect(page.locator("#seamsi-result-title")).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem("monkolSeamsiLastNumber"))).toBe(first);

  await page.locator("[data-seamsi-reset]").click();
  await expect(page.locator(".seamsi-result-head strong")).toHaveText(first);
  await expect(page.locator("[data-seamsi-previous]")).toHaveText("จากคำถามก่อนหน้า");
  await expect(page.locator("[data-seamsi-question]")).toBeFocused();
  await expect(page.locator("[data-seamsi-question]")).toHaveValue("");
  await expect(page.locator("[data-seamsi-reset]")).toBeHidden();
  await expect(page.locator("[data-seamsi-category]")).toHaveValue("work");
  await expect(page.locator("#seamsi-stage-title")).toHaveText("กดกระบอกเพื่อเขย่าเซียมซี");
  await page.locator("[data-seamsi-oracle]").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".seamsi-result-head strong")).not.toHaveText(first);
});

test("reduced motion and unavailable history storage still produce accessible readings", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    const set = Storage.prototype.setItem;
    Storage.prototype.getItem = function(key) { if (key === "monkolSeamsiLastNumber") throw new Error("blocked"); return get.call(this, key); };
    Storage.prototype.setItem = function(key, value) { if (key === "monkolSeamsiLastNumber") throw new Error("blocked"); return set.call(this, key, value); };
  });
  await page.goto(route);
  await expect(page.locator(".mw-select")).toBeVisible();
  const initialAxe = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(initialAxe.violations.filter(v => ["serious", "critical"].includes(v.impact!))).toEqual([]);
  await page.locator("[data-seamsi-shake]").click();
  await expect(page.locator(".seamsi-result-card")).toBeVisible();
  expect(await page.locator(".seamsi-cup-image").evaluate(e => getComputedStyle(e).animationName)).toBe("none");
  const first = await page.locator(".seamsi-result-head strong").innerText();
  await page.locator("[data-seamsi-reset]").click();
  await page.locator("[data-seamsi-shake]").click();
  await expect(page.locator(".seamsi-result-head strong")).not.toHaveText(first);
  const readingAxe = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(readingAxe.violations.filter(v => ["serious", "critical"].includes(v.impact!))).toEqual([]);
});

test("draft edits keep the previous result, primary rearm clears only the question", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(route);
  await page.locator("[data-seamsi-question]").fill("คำถามเดิม");
  await page.locator("[data-seamsi-shake]").click();
  await expect(page.locator(".seamsi-result-card")).toBeVisible();
  const number = await page.locator(".seamsi-result-head strong").innerText();
  await chooseOption(page, "[data-seamsi-category]", "love");
  await page.locator("[data-seamsi-question]").fill("คำถามใหม่");
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-seamsi-intent-notice]")).toContainText("คุณเปลี่ยนคำถามแล้ว");
  await expect(page.locator(".seamsi-result-copy .section-kicker")).toHaveText("เรื่องภาพรวมชีวิต");
  await expect(page.locator(".seamsi-question")).toHaveText("คำถาม: คำถามเดิม");
  await expect(page.locator(".seamsi-result-head strong")).toHaveText(number);
  await expect(page.locator("[data-seamsi-reset]")).toBeHidden();
  await page.locator("[data-seamsi-shake]").click();
  await expect(page.locator(".seamsi-result-head strong")).not.toHaveText(number);
  await expect(page.locator(".seamsi-result-copy .section-kicker")).toHaveText("เรื่องความรัก");
  const second = await page.locator(".seamsi-result-head strong").innerText();
  await page.locator("[data-seamsi-shake]").click();
  await expect(page.locator("[data-seamsi-question]")).toHaveValue("");
  await expect(page.locator("[data-seamsi-question]")).toBeFocused();
  await expect(page.locator(".seamsi-result-head strong")).toHaveText(second);
  await expect(page.locator("[data-seamsi-category]")).toHaveValue("love");
});

test("skip, changed motion preference and missing animation events finish exactly the selected slip", async ({ page }) => {
  await page.goto(route);
  await page.locator("[data-seamsi-oracle]").click();
  await page.locator("[data-seamsi-skip]").click();
  await expect(page.locator(".seamsi-result-card")).toBeVisible();
  await expect(page.locator("#seamsi-result-title")).toBeFocused();
  const first = await page.locator(".seamsi-result-head strong").innerText();
  await expect(page.locator("[data-seamsi-stick]")).toHaveText(first);
  await expect(page.locator("[data-seamsi-skip]")).toBeHidden();
  await page.locator("[data-seamsi-reset]").click();
  await page.locator("[data-seamsi-oracle]").click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".seamsi-result-head strong")).not.toHaveText(first);
  await page.locator("[data-seamsi-reset]").click();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addStyleTag({ content: ".seamsi-cup-image,.seamsi-falling-stick { animation: none !important; }" });
  await page.locator("[data-seamsi-oracle]").click();
  await page.getByRole("heading", { name: "ตั้งใจถาม", exact: true }).evaluate(element => { element.setAttribute("tabindex", "-1"); (element as HTMLElement).focus(); });
  await expect(page.locator(".seamsi-shell")).toHaveAttribute("data-seamsi-phase", "revealed");
  await expect(page.getByRole("heading", { name: "ตั้งใจถาม", exact: true })).toBeFocused();
  const number = await page.evaluate(() => localStorage.getItem("monkolSeamsiLastNumber"));
  await expect(page.locator(".seamsi-result-head strong")).toHaveText(number!);
});

test("art failure and route lifecycle do not break or duplicate the draw", async ({ page }) => {
  await page.route("**/assets/images/seamsi-fortune-cup.webp", request => request.abort());
  await page.goto(route);
  await expect(page.locator("[data-seamsi-art-fallback]")).toBeVisible();
  await page.locator("[data-seamsi-question]").fill("ร่างคำถาม");
  await page.evaluate(() => { document.dispatchEvent(new Event("astro:page-load")); document.dispatchEvent(new Event("astro:page-load")); });
  await expect(page.locator("[data-seamsi-question]")).toHaveValue("ร่างคำถาม");
  await page.locator("[data-seamsi-oracle]").click();
  await page.locator("[data-seamsi-skip]").click();
  await expect(page.locator(".seamsi-result-card")).toBeVisible();
  await page.evaluate(() => { document.dispatchEvent(new Event("astro:before-swap")); document.dispatchEvent(new Event("astro:page-load")); });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("[data-seamsi-shake]").click();
  await expect(page.locator(".seamsi-shell")).toHaveAttribute("data-seamsi-phase", "revealed");
});

test("known-record errors retry that record, even after editing the draft", async ({ page }, info) => {
  await page.route("**/src/scripts/seamsi-data.js*", request => request.fulfill({ contentType: "text/javascript", body: `
    export const seamsiCategories = [{ id: "overview", label: "ภาพรวมชีวิต" }];
    let attempts = 0;
    export const seamsiFortunes = [{ number: "๐๗", title: "ข้อมูลทดสอบเท่านั้น", get verse() { return ++attempts === 1 ? "" : "บรรทัดแรก\\nบรรทัดถัดไป"; }, interpretation: "ข้อมูลสังเคราะห์ ไม่ใช่คำทำนายจริง" }];
  ` }));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(route);
  await page.locator("[data-seamsi-question]").fill("คำถามที่ใช้กับใบเดิม");
  await page.locator("[data-seamsi-shake]").click();
  await expect(page.locator("[data-seamsi-feedback]")).toContainText("ไม่สามารถเปิดคำอ่านใบนี้ได้");
  await expect(page.locator(".seamsi-empty")).toBeHidden();
  await page.locator("[data-seamsi-question]").fill("ร่างคำถามรอบใหม่");
  await page.screenshot({ path: `.local/seamsi-behavior/error-${info.project.name}.png`, fullPage: true, animations: "disabled" });
  await page.locator("[data-seamsi-retry]").click();
  await expect(page.locator(".seamsi-result-head strong")).toHaveText("๐๗");
  await expect(page.locator(".seamsi-question")).toHaveText("คำถาม: คำถามที่ใช้กับใบเดิม");
  await expect(page.locator("[data-seamsi-question]")).toHaveValue("ร่างคำถามรอบใหม่");
  await expect(page.locator("[data-seamsi-previous]")).toBeVisible();
  await expect(page.locator("#seamsi-result-title")).toBeFocused();
  await expect(page.locator(".seamsi-result-copy blockquote")).toHaveCSS("white-space", "pre-line");
});

test("empty corpus is not an undrawn fortune, and validation never draws", async ({ page }) => {
  await page.route("**/src/scripts/seamsi-data.js*", request => request.fulfill({ contentType: "text/javascript", body: `export const seamsiCategories = [{id:"overview",label:"ภาพรวมชีวิต"}]; export const seamsiFortunes = [];` }));
  await page.goto(route);
  await expect(page.locator("[data-seamsi-feedback]")).toContainText("ข้อมูลเซียมซียังไม่พร้อมใช้งาน");
  await expect(page.locator(".seamsi-empty")).toBeHidden();
  await expect(page.locator("[data-seamsi-shake]")).toHaveAttribute("aria-disabled", "true");
  expect(await page.evaluate(() => localStorage.getItem("monkolSeamsiLastNumber"))).toBeNull();
  await page.unroute("**/src/scripts/seamsi-data.js*");
  await page.reload();
  await page.locator("[data-seamsi-question]").evaluate((field: HTMLTextAreaElement) => { field.value = "ก".repeat(181); field.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.locator("[data-seamsi-shake]").click();
  await expect(page.locator("[data-seamsi-validation]")).toContainText("180");
  expect(await page.evaluate(() => localStorage.getItem("monkolSeamsiLastNumber"))).toBeNull();
});
