import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium, expect } from "@playwright/test";

const base = process.env.HUB_QA_URL || "http://127.0.0.1:4349";
const output = "artifacts/temples-hub";
await fs.mkdir(output, { recursive: true });
const content = JSON.parse(await fs.readFile("public/admin/content/live.json", "utf8"));
const report = { base, runAt: new Date().toISOString(), state: "local published-content fixture; anonymous; consent declined", viewports: [], checks: [], fonts: [] };
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  const errors = [];
  const failures = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", response => {
    if (["stylesheet", "font", "image"].includes(response.request().resourceType()) && response.status() >= 400) failures.push(response.url());
  });
  await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
  const settle = async () => {
    await page.waitForFunction(() => document.documentElement.dataset.cmsReady === "true");
    await page.evaluate(() => document.fonts.ready);
    await page.locator(".site-footer").scrollIntoViewIfNeeded();
    await page.evaluate(async () => {
      await Promise.all([...document.querySelectorAll("main img")].map(image => image.decode().catch(() => {})));
      window.scrollTo({ top: 0, behavior: "instant" });
    });
    await page.waitForFunction(() => window.scrollY === 0);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
    await page.goto(`${base}/temples/`);
    await settle();
    const layout = await page.evaluate(() => {
      const rect = selector => [...document.querySelectorAll(selector)].map(node => {
        const { x, y, width, height } = node.getBoundingClientRect();
        return { x, y, width, height };
      });
      return {
        documentWidth: document.documentElement.scrollWidth,
        pageHeight: document.documentElement.scrollHeight,
        cards: rect(".temple-hub-v2-card"), tools: rect(".temple-hub-v2-tool-card"), intents: rect(".temple-hub-v2-intent-list a"),
        icons: rect(".temple-hub-v2-tool-icon, .temple-hub-v2-tool-cta .site-icon"),
        brokenImages: [...document.querySelectorAll("main img")].filter(img => !img.naturalWidth).map(img => img.src),
        search: { fill: getComputedStyle(document.querySelector(".temple-hub-v2-search svg")).fill, fontSize: getComputedStyle(document.querySelector("#temple-hub-search")).fontSize },
      };
    });
    assert.ok(layout.documentWidth <= width, `Overflow at ${width}`);
    assert.deepEqual(layout.brokenImages, []);
    assert.equal(layout.search.fill, "none");
    assert.ok(Math.max(...layout.cards.map(card => card.height)) - Math.min(...layout.cards.map(card => card.height)) < 2, `Uneven cards at ${width}`);
    if (width < 600) assert.equal(layout.intents[0].y, layout.intents[2].y, "Mobile intent grid stays three columns");
    const hrefs = await page.locator("main a[href]").evaluateAll(nodes => nodes.map(node => node.getAttribute("href")));
    for (const href of hrefs) {
      const url = new URL(href, base);
      await fs.access(`dist${url.pathname}index.html`);
    }
    const masks = await page.locator("main .ui-icon-mask").evaluateAll(nodes => nodes.map(node => getComputedStyle(node).maskImage.match(/url\(["']?(.*?)["']?\)/)?.[1]).filter(Boolean));
    for (const url of new Set(masks)) assert.equal((await page.request.get(url)).status(), 200, url);
    report.viewports.push({ width, ...layout });
    if ([1440, 390].includes(width)) {
      await page.screenshot({ path: `${output}/actual-${width}.png`, fullPage: true, animations: "disabled" });
      await page.screenshot({ path: `${output}/viewport-${width}.png`, animations: "disabled" });
    }
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  for (const selector of ["#temple-page-title", ".temple-hub-v2-card-copy strong", ".temple-hub-v2-tool-card p"]) {
    const { root } = await cdp.send("DOM.getDocument");
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    assert.ok(fonts.some(font => font.isCustomFont && font.familyName.replaceAll(" ", "").includes("NotoSansThai")), selector);
    report.fonts.push({ selector, fonts });
  }
  await page.locator(".temple-hub-v2-notice summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".temple-hub-v2-notice")).toHaveAttribute("open", "");
  await expect(page.locator(".temple-hub-v2-notice-content")).toBeVisible();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(".temple-hub-v2-notice").getAttribute("open"), null);
  await page.locator("#temple-hub-search").fill("การงาน");
  await page.locator(".temple-hub-v2-search button").click();
  await page.waitForURL(url => url.pathname === "/temples/sacred/" && url.searchParams.get("name") === "การงาน");
  report.checks.push("Native GET search preserves its sacred-collection destination and Thai query", "Notice opens and closes with Enter", "All Hub links resolve to built routes", "All icon assets load");

  const cms = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await cms.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
  const fixture = structuredClone(content);
  const hub = fixture.pages.find(item => item.route === "/temples/");
  hub.patches = [{ kind: "text", selector: "#temple-page-title", value: "วัดดังจาก CMS" }, { kind: "image", selector: "#temple-hub-hero-image", src: "/assets/images/hero-wat-arun-sunset.webp", alt: "ภาพทดสอบจาก CMS", position: "75% 25%" }];
  let revision = 1;
  await cms.route("**/api/admin/content?*", route => route.fulfill({ json: { ok: true, revision: `hub-test-${revision}`, content: fixture } }));
  await cms.goto(`${base}/temples/`);
  await expect(cms.locator("#temple-page-title")).toHaveText("วัดดังจาก CMS");
  await expect(cms.locator("#temple-hub-hero-image")).toHaveCSS("object-position", "75% 25%");
  await cms.locator("#temple-hub-search").fill("คำค้นที่ยังไม่ได้ส่ง");
  await cms.evaluate(() => { window.hubInput = document.querySelector("#temple-hub-search"); });
  hub.patches[0].value = "วัดดังข้อมูลล่าสุด";
  revision++;
  await cms.evaluate(() => window.MongkolWelaCMS.reload());
  await expect(cms.locator("#temple-page-title")).toHaveText("วัดดังข้อมูลล่าสุด");
  await expect(cms.locator("#temple-hub-search")).toHaveValue("คำค้นที่ยังไม่ได้ส่ง");
  assert.ok(await cms.evaluate(() => window.hubInput === document.querySelector("#temple-hub-search")));
  await cms.route("**/test-missing-hub-image.webp", route => route.fulfill({ status: 404, body: "" }));
  hub.patches[1].src = "/test-missing-hub-image.webp";
  revision++;
  await cms.evaluate(() => window.MongkolWelaCMS.reload());
  await expect(cms.locator("#temple-hub-hero-image")).toHaveAttribute("src", "/assets/images/temple-placeholder-auspicious.png");
  hub.patches = [];
  revision++;
  await cms.evaluate(() => window.MongkolWelaCMS.reload());
  await expect(cms.locator("#temple-hub-hero-image")).toHaveAttribute("src", "/assets/images/temples-hub-golden-panorama.webp");
  report.checks.push("CMS title/image/focal-point override", "CMS refresh preserves unsent search and input identity", "Broken CMS image fallback and patch removal restore defaults");
  await cms.close();

  const noJs = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  await noJs.goto(`${base}/temples/`);
  await expect(noJs.locator(".temple-hub-v2-card")).toHaveCount(3);
  await noJs.locator(".temple-hub-v2-notice summary").click();
  await expect(noJs.locator(".temple-hub-v2-notice-content")).toBeVisible();
  await noJs.locator("#temple-hub-search").fill("กรุงเทพ");
  await noJs.locator("#temple-hub-search").press("Enter");
  await noJs.waitForURL(url => url.pathname === "/temples/sacred/" && url.searchParams.get("name") === "กรุงเทพ");
  await noJs.close();
  report.checks.push("Hub links, disclosure and search submission work without JavaScript");
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  report.status = "PASS";
  await fs.writeFile(`${output}/qa-results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, checks: report.checks, layouts: report.viewports.map(({ width, pageHeight }) => ({ width, pageHeight })) }, null, 2));
} finally {
  await browser.close();
}
