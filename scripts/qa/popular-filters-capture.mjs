import { chromium } from "playwright";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const directory = new URL("../../artifacts/popular-filters/", import.meta.url);
await fs.mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
const url = process.env.POPULAR_PREVIEW_URL || "http://127.0.0.1:4361/temples/popular/";
const captures = [];
const capture = async (name, state) => {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, directory)) });
  captures.push({ name, state, viewport: page.viewportSize(), geometry: await page.evaluate(() => {
    const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
    return { panel: rect(".pf__panel"), result: rect(".temple-collection-v2-results"), editor: rect("#pf-editor"), editorMode: document.querySelector("#pf-editor").dataset.mode, overflow: document.documentElement.scrollWidth > innerWidth, font: getComputedStyle(document.querySelector(".pf")).fontFamily };
  }) });
};
const frame = async () => page.locator(".pf").evaluate(e => window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 180));
await page.goto(url);
await page.waitForFunction(() => document.querySelector("[data-popular-temple-count]")?.textContent.includes("243"));
await page.waitForFunction(() => document.documentElement.dataset.cmsReady === "true");
await page.evaluate(() => document.fonts.ready);
await capture("desktop-overview", "closed / unfiltered / real local catalog");
await frame();
await page.locator("[data-pf-group=provinces]").click();
await page.getByRole("checkbox", { name: "กรุงเทพมหานคร", exact: true }).check();
await page.getByRole("checkbox", { name: "เชียงใหม่", exact: true }).check();
await capture("desktop-province", "province working selection, results unchanged");
await page.locator("[data-pf-done]").click();
await page.locator("[data-pf-group=purposes]").click();
for (const name of ["โชคลาภ", "การเงิน/ค้าขาย", "ความรัก/คู่ครอง", "สุขภาพ/อายุยืน", "ความสำเร็จ/ก้าวหน้า"]) {
  const option = page.getByRole("checkbox", { name, exact: true });
  if (await option.count()) await option.check();
}
await capture("desktop-purpose", "purpose working selection / province draft / applied unchanged");
await page.locator("[data-pf-done]").click();
await capture("desktop-closed", "draft summaries + dirty status");
await page.setViewportSize({ width: 390, height: 844 });
await frame();
await capture("mobile-closed", "390px / draft summaries / result context");
await page.locator("[data-pf-group=purposes]").click();
await capture("mobile-sheet", "390px / purpose sheet / pointer focus");
await page.locator("[data-pf-close]").click();
await page.locator(".pf__search button[type=submit]").click();
await frame();
await capture("mobile-applied", "390px / submitted filters / count + result cards");
await page.setViewportSize({ width: 768, height: 1024 });
await page.locator("[data-pf-group=provinces]").click();
await capture("tablet-modal", "768px centered modal / retained values");
await page.setViewportSize({ width: 844, height: 390 });
await capture("short-landscape", "short visible viewport / one dialog scroll");
await page.locator("[data-pf-close]").click();
await fs.writeFile(new URL("capture-provenance.json", directory), JSON.stringify({ url, capturedAt: new Date().toISOString(), source: "Local branch; bundled CMS snapshot via read-only existing preview proxy. Not production. No data writes.", captures }, null, 2));
await browser.close();
const panel = async (name, width) => sharp(fileURLToPath(new URL(`${name}.png`, directory))).resize({ width }).toBuffer();
const title = Buffer.from('<svg width="1860" height="42"><rect width="100%" height="100%" fill="#f1f3f2"/><g font-family="Arial" font-size="16" fill="#182923"><text x="20" y="28">DEVELOPMENT / Desktop 1440px / Purpose popover</text><text x="1090" y="28">Mobile 390px / Closed</text><text x="1480" y="28">Mobile 390px / Purpose sheet</text></g></svg>');
await sharp({ create: { width: 1860, height: 900, channels: 3, background: "#f1f3f2" } }).composite([
  { input: title, left: 0, top: 0 },
  { input: await panel("desktop-purpose", 1080), left: 0, top: 42 },
  { input: await panel("mobile-closed", 390), left: 1080, top: 42 },
  { input: await panel("mobile-sheet", 390), left: 1470, top: 42 },
]).png().toFile(fileURLToPath(new URL("review.png", directory)));
console.log(`Saved ${captures.length} captures to ${fileURLToPath(directory)}`);
