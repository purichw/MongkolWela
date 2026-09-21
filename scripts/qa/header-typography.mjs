import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "@playwright/test";

const base = process.env.HEADER_QA_URL || "http://127.0.0.1:4349";
const report = { base, runAt: new Date().toISOString(), typography: [], layouts: [], tokenRoutes: [] };
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const stylesheetErrors = [];
  page.on("response", response => {
    if (response.request().resourceType() === "stylesheet" && response.status() >= 400) stylesheetErrors.push(response.url());
  });
  await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
  const settled = async () => {
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const font = async (selector, family, weight) => {
    const locator = page.locator(selector).first();
    const computed = await locator.evaluate(node => {
      const style = getComputedStyle(node);
      return { family: style.fontFamily, weight: style.fontWeight, size: style.fontSize, lineHeight: style.lineHeight };
    });
    assert.ok(computed.family.includes(family), `${selector}: ${computed.family}`);
    assert.equal(computed.weight, weight, selector);
    const { root } = await cdp.send("DOM.getDocument");
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    assert.ok(fonts.some(face => face.isCustomFont && face.familyName.replaceAll(" ", "").includes(family.replaceAll(" ", ""))), `${selector}: actual font ${JSON.stringify(fonts)}`);
    report.typography.push({ selector, ...computed, renderedFonts: fonts });
  };

  await page.goto(`${base}/temples/popular/`);
  await page.waitForSelector("[data-header-ready]");
  await page.waitForFunction(() => document.documentElement.dataset.cmsNavReady === "true");
  await settled();
  await font(".mw-brand strong", "Prompt", "700");
  await font(".mw-brand small", "IBM Plex Mono", "400");
  await font(".mw-top-link .mw-link-copy > span", "Prompt", "600");
  await font(".mw-planner-cta .mw-cta-full", "Prompt", "600");
  await page.locator('[data-nav-item-id="temples"] summary').click();
  await settled();
  await font(".mw-feature-link .mw-link-copy > span", "Noto Sans Thai", "700");
  await font(".mw-feature-link small", "Noto Sans Thai", "400");
  await font(".mw-collection-links .mw-child-link .mw-link-copy > span", "Noto Sans Thai", "400");
  await page.locator('[data-nav-item-id="horoscope"] summary').click();
  await settled();
  await font(".mw-panel--tools .mw-child-link .mw-link-copy > span", "IBM Plex Sans Thai", "400");
  await page.keyboard.press("Escape");

  for (const width of [1440, 1280, 390, 320]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
    await settled();
    const expectedMode = width >= 1280 ? "wide" : "compact";
    await page.waitForFunction(mode => document.querySelector(".mw-header").dataset.headerMode === mode, expectedMode);
    if (expectedMode === "wide") await page.locator('[data-nav-item-id="temples"] summary').click();
    else await page.locator(".mw-menu-toggle").click();
    await settled();
    if (width === 390) {
      await font(".mw-drawer-intro h2", "Noto Sans Thai", "600");
      await font(".mw-mobile-row .mw-link-copy > span", "Noto Sans Thai", "500");
      await font(".mw-mobile-children .mw-child-link .mw-link-copy > span", "Noto Sans Thai", "400");
    }
    const metrics = await page.evaluate(() => {
      const header = document.querySelector(".mw-header");
      const surface = header.dataset.headerMode === "wide" ? document.querySelector(".mw-disclosure[open] .mw-panel") : document.querySelector(".mw-drawer-scroll");
      const box = surface.getBoundingClientRect();
      return { mode: header.dataset.headerMode, documentWidth: document.documentElement.scrollWidth, surfaceWidth: surface.clientWidth, contentWidth: surface.scrollWidth, x: box.x, right: box.right, height: box.height };
    });
    assert.ok(metrics.documentWidth <= width, JSON.stringify(metrics));
    assert.ok(metrics.contentWidth <= metrics.surfaceWidth + 1, JSON.stringify(metrics));
    assert.ok(metrics.x >= 0 && metrics.right <= width, JSON.stringify(metrics));
    report.layouts.push({ width, ...metrics });
    await page.keyboard.press("Escape");
  }
  for (const route of ["/", "/calendar/", "/seller/"]) {
    await page.goto(`${base}${route}`);
    await settled();
    const token = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--font-thai"));
    assert.ok(token.includes("Noto Sans Thai"), `${route}: missing shared font token`);
    report.tokenRoutes.push({ route, token });
  }
  assert.deepEqual(stylesheetErrors, [], "All linked stylesheets must load from the built preview");
  report.status = "PASS";
  await fs.writeFile("artifacts/header-navbar/typography-results.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
