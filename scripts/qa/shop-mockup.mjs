import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { commerceFixture } from "../../tests/helpers/commerce-fixtures.mjs";
import { publicCommerce } from "../../api/commerce/_domain.js";

const base = process.env.SHOP_QA_URL || "http://127.0.0.1:4348";
const output = "artifacts/shop-mockup";
await fs.mkdir(output, { recursive: true });
const content = JSON.parse(await fs.readFile("public/admin/content/live.json", "utf8"));
const fixture = commerceFixture();
const catalog = { ok: true, ...publicCommerce(fixture.state, { templeIds: fixture.templeIds, now: fixture.now }) };
const report = { base, runAt: new Date().toISOString(), state: "Read-only intercepted commerce responses; local CMS fixture", viewports: [], checks: [] };
const browser = await chromium.launch({ channel: "chrome" });
try {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  const errors = [];
  let state = "disabled";
  let reads = 0;
  let writes = 0;
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/admin/content?*", route => route.fulfill({ json: { ok: true, revision: "shop-qa", content } }));
  await page.route("**/api/commerce", route => {
    if (route.request().method() !== "GET") { writes++; return route.fulfill({ status: 405, json: { ok: false, error: "No writes in visual QA" } }); }
    reads++;
    if (state === "disabled") return route.fulfill({ status: 503, json: { ok: false, code: "COMMERCE_DISABLED", error: "ระบบร้านค้าและร่วมบุญยังไม่เปิดบริการ" } });
    if (state === "error") return route.fulfill({ status: 503, json: { ok: false, error: "แหล่งข้อมูลไม่พร้อม" } });
    return route.fulfill({ json: state === "empty" ? { ...catalog, products: [] } : catalog });
  });
  const root = page.locator("[data-commerce-public]");
  const refresh = async () => {
    const previous = reads;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect.poll(() => reads).toBeGreaterThan(previous);
  };
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/shop/`);
    await expect(root).toHaveAttribute("data-commerce-state", "disabled");
    await page.evaluate(() => document.fonts.ready);
    await page.locator(".site-footer").scrollIntoViewIfNeeded();
    await page.evaluate(async () => { await Promise.all([...document.images].map(img => img.decode().catch(() => {}))); window.scrollTo({ top: 0, behavior: "instant" }); });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    const geometry = await page.evaluate(() => ({
      width: window.innerWidth, documentWidth: document.documentElement.scrollWidth, height: document.body.scrollHeight,
      titleFont: getComputedStyle(document.querySelector("h1")).fontSize,
      panelHeight: document.querySelector(".shop-closed").getBoundingClientRect().height,
      destinationIconWidth: document.querySelector(".shop-destination-art--calendar > .site-icon").getBoundingClientRect().width,
      mapPinPosition: getComputedStyle(document.querySelector(".shop-map-pin")).position,
      brokenImages: [...document.querySelectorAll("main img")].filter(img => !img.naturalWidth).map(img => img.src),
      clippedText: [...document.querySelectorAll(".shop-page h1, .shop-page h2, .shop-destination-copy")].filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.textContent),
    }));
    assert.equal(geometry.documentWidth, width);
    assert.deepEqual(geometry.brokenImages, []);
    assert.deepEqual(geometry.clippedText, []);
    assert.equal(geometry.destinationIconWidth, width < 359 ? 48 : width <= 900 ? 57 : width <= 1100 ? 52 : 70);
    assert.equal(geometry.mapPinPosition, "absolute");
    await expect(page.locator("[data-commerce-operational]")).toBeHidden();
    await expect(page.getByRole("button", { name: "ลองใหม่", exact: true })).toHaveCount(0);
    report.viewports.push(geometry);
    await page.screenshot({ path: `${output}/actual-${width}.png`, fullPage: true, animations: "disabled" });
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
  const { root: documentRoot } = await cdp.send("DOM.getDocument");
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: documentRoot.nodeId, selector: "#shop-title" });
  const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
  assert.ok(fonts.some(font => font.isCustomFont && font.familyName.replaceAll(" ", "").includes("NotoSansThai")));
  report.fonts = fonts;
  await page.setViewportSize({ width: 390, height: 844 });
  const summary = page.locator(".shop-faq summary").first();
  await summary.focus(); await page.keyboard.press("Enter");
  await expect(page.locator(".shop-faq details").first()).toHaveAttribute("open", "");
  await refresh();
  await expect(page.locator(".shop-faq details").first()).toHaveAttribute("open", "");
  await expect(summary).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.locator(".shop-faq details").first()).not.toHaveAttribute("open", "");
  const a11y = await new AxeBuilder({ page }).include(".shop-page").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  report.accessibility = a11y.violations;
  assert.deepEqual(a11y.violations, []);
  for (const href of await page.locator(".shop-destination").evaluateAll(nodes => nodes.map(node => node.getAttribute("href")))) assert.equal((await page.request.get(new URL(href, base).href)).status(), 200);
  report.checks.push("Four viewport sizes: no overflow, clipped titles, or missing images; actual Thai webfont used", "FAQ keyboard Enter/Space, expanded state and focus survive refresh", "Shop main passes axe WCAG A/AA; destination routes return 200");

  state = "error"; await refresh();
  await expect(root).toHaveAttribute("data-commerce-state", "error");
  await expect(page.locator(".shop-closed")).toBeHidden();
  await expect(page.getByText("แหล่งข้อมูลไม่พร้อม", { exact: true })).toBeVisible();
  state = "empty"; await page.getByRole("button", { name: "ลองใหม่", exact: true }).click();
  await expect(page.locator(".commerce-empty")).toBeVisible();
  await expect(page.locator(".shop-closed")).toBeHidden();
  await expect(page.locator("[data-commerce-message]")).toBeEmpty();
  state = "disabled"; await refresh();
  await expect(page.locator(".shop-closed")).toBeVisible();
  state = "ready"; await refresh();
  await expect(page.locator(".commerce-products")).toBeVisible();
  await expect(page.locator("[data-commerce-operational]")).toBeVisible();
  await expect(page.locator(".shop-closed")).toBeHidden();
  await page.getByRole("heading", { name: fixture.product.title, exact: true }).getByRole("link").click();
  await page.getByRole("button", { name: "เพิ่มลงตะกร้า", exact: true }).click();
  await page.locator(".commerce-nav").getByRole("link", { name: /ตะกร้า/ }).click();
  await expect(page.locator("[data-cart-quantity]")).toHaveValue("1");
  await page.getByLabel("ชื่อผู้รับ", { exact: true }).fill("ทดสอบโดยไม่ส่งคำขอ");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByLabel("ชื่อผู้รับ", { exact: true })).toHaveValue("ทดสอบโดยไม่ส่งคำขอ");
  await expect(page.getByRole("button", { name: /ชำระเงินออนไลน์/ })).toBeDisabled();
  assert.equal(writes, 0);
  report.checks.push("Disabled, generic error, retry, empty catalog and automatic activation are distinct", "Enabled product/detail/add-to-cart/form remain usable; no payment or POST performed");

  state = "disabled"; await page.goto(`${base}/merit/`);
  await expect(page.getByRole("button", { name: "ลองใหม่", exact: true })).toBeVisible();
  await expect(page.locator("[data-shop-unavailable]")).toHaveCount(0);
  state = "ready"; await page.getByRole("button", { name: "ลองใหม่", exact: true }).click();
  await expect(page.locator(".commerce-campaigns")).toBeVisible();
  report.checks.push("Shared controller: Merit retains its original unavailable/retry and ready rendering");
  assert.deepEqual(errors, []);
  const nojs = await browser.newPage({ javaScriptEnabled: false });
  await nojs.goto(`${base}/shop/`);
  await expect(nojs.locator(".shop-no-script")).toBeVisible();
  await expect(nojs.locator(".shop-closed")).toBeHidden();
  await nojs.close();
  report.checks.push("No-JS does not falsely claim the store is closed; navigation fallback is available", "No uncaught browser errors");
  await fs.writeFile(`${output}/qa-report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
