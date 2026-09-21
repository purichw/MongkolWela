import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { chromium } from "@playwright/test";

const output = path.resolve("artifacts/temples-hub");
const reference = process.env.HUB_REFERENCE || "/var/folders/3k/m69pt27s00bd_l2yzfjvmk8w0000gn/T/codex-clipboard-bb0d251a-0e5a-43a0-aaa4-39756ee77031.png";
// Source-image pixels, excluding slide/device framing. Both sides retain aspect ratio.
await sharp(reference).extract({ left: 52, top: 30, width: 1037, height: 994 }).toFile(`${output}/reference-desktop.png`);
await sharp(reference).extract({ left: 1150, top: 80, width: 318, height: 914 }).toFile(`${output}/reference-mobile.png`);
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Temple Hub: Reference / Actual</title>
<style>*{box-sizing:border-box}body{margin:0;padding:20px;background:#e8e8e6;color:#202623;font:14px/1.5 system-ui}h1{font-size:20px;margin:0 0 6px}p{margin:0 0 20px}section{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;width:1220px;margin-bottom:24px;align-items:start}section.mobile{width:800px}figure{margin:0;background:white}figcaption{height:44px;padding:10px 14px;font-weight:600}img{display:block;width:100%;height:auto}</style>
<h1>Temple Hub /temples/</h1><p>Reference 2 density + reference 4 photo-card treatment. Published-content local fixture. Images scaled uniformly to equal widths, not equal heights.</p>
<section id="desktop"><figure><figcaption>Reference: Desktop crop (inferred 1440px)</figcaption><img src="reference-desktop.png"></figure><figure><figcaption>Actual: Desktop 1440px</figcaption><img src="actual-1440.png"></figure></section>
<section class="mobile" id="mobile"><figure><figcaption>Reference: Mobile crop (inferred 390px)</figcaption><img src="reference-mobile.png"></figure><figure><figcaption>Actual: Mobile 390px</figcaption><img src="actual-390.png"></figure></section>
<p>Header/footer use the current shared product shell. Reference mobile ends before the footer. No illustrative metrics or social destinations were fabricated.</p></html>`;
await fs.writeFile(`${output}/comparison.html`, html);
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 1260, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(`${output}/comparison.html`).href);
  await page.evaluate(() => Promise.all([...document.images].map(image => image.decode())));
  await page.locator("#desktop").screenshot({ path: `${output}/comparison-desktop.png` });
  await page.locator("#mobile").screenshot({ path: `${output}/comparison-mobile.png` });
} finally { await browser.close(); }
console.log(`${output}/comparison.html`);
