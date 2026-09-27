import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const [desktopReference, mobileReference] = process.argv.slice(2);
if (!desktopReference || !mobileReference) throw new Error("Pass the desktop and mobile reference PNG paths");
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4327";
const output = path.resolve("artifacts/travel-guide");
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || "chrome" });
const report = { createdAt: new Date().toISOString(), baseURL, data: "Read-only local API preview; guest, analytics declined", references: [], captures: [] };
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 1000 : 844 }, deviceScaleFactor: 1 });
    await context.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("response", response => { if (response.status() >= 400 && !response.url().includes("/api/")) errors.push(`${response.status()} ${response.url()}`); });
    await page.goto(`${baseURL}/guide/`);
    await page.waitForFunction(() => document.documentElement.dataset.cmsReady === "true");
    await page.locator("[data-page-loader]").waitFor({ state: "hidden" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      const images = [...document.images];
      images.forEach(image => { image.loading = "eager"; });
      await Promise.all(images.map(image => image.decode().catch(() => {})));
      scrollTo({ top: 0, behavior: "instant" });
      document.activeElement?.blur();
    });
    await page.waitForFunction(() => scrollY === 0);
    const metrics = await page.evaluate(() => ({
      viewport: { width: innerWidth, height: innerHeight }, scrollY,
      documentHeight: document.documentElement.scrollHeight,
      overflow: document.documentElement.scrollWidth > innerWidth,
      sections: [...document.querySelectorAll("main > *, .guide-chapter, .guide-checklist")].map(node => ({ selector: node.id || node.className, height: node.getBoundingClientRect().height })),
      missingImages: [...document.querySelectorAll("main img")].filter(image => !image.complete || !image.naturalWidth).map(image => image.src),
    }));
    if (metrics.overflow || metrics.missingImages.length || errors.length) throw new Error(JSON.stringify({ metrics, errors }));
    const prefix = `preview-${width}`;
    await page.screenshot({ path: path.join(output, `${prefix}.png`), fullPage: true, animations: "disabled" });
    await page.screenshot({ path: path.join(output, `${prefix}-top.png`), animations: "disabled" });
    report.captures.push({ url: page.url(), prefix, ...metrics, errors });
    await context.close();
  }
} finally {
  await browser.close();
}

const label = (text, width) => Buffer.from(`<svg width="${width}" height="34"><rect width="100%" height="100%" fill="white"/><text x="10" y="23" font-family="Arial" font-size="13" fill="#173c32">${text}</text></svg>`);
async function comparison(reference, crop, preview, width, filename) {
  const panels = [{ file: reference, crop, label: "Reference / approximate content crop" }, { file: preview, label: "Development / local API / original content retained" }];
  const composite = [];
  let x = 0, height = 0;
  for (const panel of panels) {
    const input = sharp(panel.file);
    if (panel.crop) input.extract(panel.crop);
    const { data, info } = await input.resize({ width }).png().toBuffer({ resolveWithObject: true });
    composite.push({ input: label(panel.label, width), left: x, top: 0 }, { input: data, left: x, top: 34 });
    height = Math.max(height, info.height + 34);
    x += width + 16;
  }
  await sharp({ create: { width: x - 16, height, channels: 3, background: "#eff2ed" } }).composite(composite).png().toFile(path.join(output, filename));
  report.references.push({ file: reference, crop, sha256: createHash("sha256").update(await fs.readFile(reference)).digest("hex") });
}
await comparison(desktopReference, { left: 175, top: 0, width: 774, height: 1402 }, path.join(output, "preview-1440.png"), 720, "comparison-desktop.png");
await comparison(mobileReference, { left: 244, top: 60, width: 455, height: 1580 }, path.join(output, "preview-390.png"), 390, "comparison-mobile.png");
await fs.writeFile(path.join(output, "snapshot-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.captures.map(({ prefix, documentHeight, overflow, missingImages, errors }) => ({ prefix, documentHeight, overflow, missingImages, errors }))));
