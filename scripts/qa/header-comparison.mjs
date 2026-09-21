import fs from "node:fs/promises";
import sharp from "sharp";
import { chromium } from "@playwright/test";

const out = "artifacts/header-navbar";
const handoff = "/Users/point/Downloads/mongkolwela-header-navbar-codex-handoff";
const desktopRef = "/var/folders/3k/m69pt27s00bd_l2yzfjvmk8w0000gn/T/codex-clipboard-96535b9c-6ac8-4632-a02b-1ef16e6e7ee6.png";
const base = process.env.HEADER_QA_URL || "http://127.0.0.1:4349";
const label = (text, width) => Buffer.from(`<svg width="${width}" height="40"><rect width="100%" height="100%" fill="#f2f3ee"/><text x="12" y="25" font-size="14" font-family="Arial" fill="#1b322b">${text}</text></svg>`);

const browser = await chromium.launch({channel:"chrome"});
try {
  const p = await browser.newPage({viewport:{width:1440,height:900},reducedMotion:"reduce"});
  await p.addInitScript(()=>localStorage.setItem("mongkolwela.pdpa.analytics","declined"));
  await p.goto(`${base}/temples/popular/`);
  await p.waitForSelector("[data-header-ready]");
  await p.evaluate(()=>document.fonts.ready);
  await p.locator('[data-nav-item-id="temples"] summary').click();
  await p.evaluate(()=>document.fonts.ready);
  await p.locator('.mw-panel--temples').screenshot({path:`${out}/final-desktop-panel.png`});
  await p.screenshot({path:`${out}/final-desktop-context.png`});
  await p.setViewportSize({width:390,height:844});
  await p.locator('.mw-menu-toggle').click();
  await p.evaluate(()=>document.fonts.ready);
  await p.locator('.mw-drawer-scroll').evaluate(n=>n.scrollTop=0);
  await p.screenshot({path:`${out}/final-mobile-context.png`});
  await p.locator('.mw-drawer-scroll').evaluate(n=>n.scrollTop=n.scrollHeight);
  await p.screenshot({path:`${out}/final-mobile-bottom.png`});
} finally {await browser.close();}

const refPanel = await sharp(desktopRef).extract({left:54,top:8,width:880,height:640}).resize({width:560}).toBuffer();
const actualPanel = await fs.readFile(`${out}/final-desktop-panel.png`);
await sharp({create:{width:1144,height:470,channels:4,background:"#eeeee8"}}).composite([
  {input:label("REFERENCE / cropped, scaled to 560px",560),left:8,top:4},
  {input:label("ACTUAL / 1440px viewport, 560px panel",560),left:576,top:4},
  {input:refPanel,left:8,top:48},{input:actualPanel,left:576,top:48},
]).png().toFile(`${out}/comparison-desktop.png`);
const refMobile = await sharp(`${handoff}/reference/approved-header-mobile.png`).extract({left:133,top:158,width:676,height:1432}).resize({width:390}).toBuffer();
const actualMobile = await fs.readFile(`${out}/final-mobile-context.png`);
await sharp({create:{width:804,height:898,channels:4,background:"#eeeee8"}}).composite([
  {input:label("REFERENCE / inferred 390px scale",390),left:8,top:4},
  {input:label("ACTUAL / 390 x 844, published menu",390),left:406,top:4},
  {input:refMobile,left:8,top:48},{input:actualMobile,left:406,top:48},
]).png().toFile(`${out}/comparison-mobile.png`);

const qa = JSON.parse(await fs.readFile(`${handoff}/qa/QA_CASES.json`,"utf8"));
const results = JSON.parse(await fs.readFile(`${out}/browser-results.json`,"utf8"));
const covered = new Map(results.results.flatMap(result=>result.ids.map(id=>[id,result.note])));
const evidence = {
  "HN-001":"Read-only CMS inventory, dirty worktree baseline and pre-edit screenshots recorded in implementation notes.",
  "HN-022":"commerce-navigation.spec.ts: desktop/mobile enabled destinations and hidden child/tab fixtures pass; no real gate writes.",
  "HN-030":"Runtime test preserves query/fragment; Admin local fixture publishes shop/?category=all and verifies href.",
  "HN-062":"Runtime unsafe protocol/HTML label fixtures pass; shared renderers use the same sanitizer.",
  "HN-067":"Existing CMS freshness Playwright accepts consent and verifies analytics count in an intercepted fixture.",
  "HN-072":"Astro check: zero errors/warnings; build: 735 routes; nfr:cms and diff check pass. Screenshots are actual browser output.",
};
for(const item of qa.cases){
  const note=covered.get(item.id)||evidence[item.id];
  item.status=note?"PASS":"NOT_RUN";
  item.notes=note||"Not fully exercised in this scoped Chromium pass; not inferred from screenshots or code inspection.";
  item.evidence=note?["browser-results.json","../../docs/header-navbar-implementation.md"]:[];
}
// Partial variants are explicitly not promoted to a full handoff case pass.
for(const [id,note] of Object.entries({
  "HN-007":"1280 fit and long CMS labels exercised separately; combined 1280 long-label fixture not run.",
  "HN-010":"ArrowDown, focus opening and click tested; Enter/Space variants not separately exercised.",
  "HN-033":"320px actual brand and all actions fit; hypothetical long replacement brand not exercised.",
  "HN-039":"Font-ready and long-label fit tested; deliberately delayed font response variant not run.",
  "HN-045":"844x390 emulation passes; actual hardware safe areas not exercised.",
  "HN-053":"200% CSS text sizing passes; actual browser zoom was not exercised. These are distinct checks.",
  "HN-056":"Decorative markup and axe checked; actual screen-reader speech not exercised.",
})){const item=qa.cases.find(c=>c.id===id);item.status="NOT_RUN";item.notes=note;}
qa.application_implementation_status="IMPLEMENTED_LOCAL_NOT_DEPLOYED";
qa.generated_at=new Date().toISOString();
qa.summary=Object.fromEntries(["PASS","FAIL","NOT_RUN","BLOCKED"].map(status=>[status,qa.cases.filter(c=>c.status===status).length]));
await fs.writeFile(`${out}/QA_CASES.json`,JSON.stringify(qa,null,2));
await fs.writeFile(`${out}/comparison-provenance.json`,JSON.stringify({base,desktopReference:desktopRef,mobileReference:`${handoff}/reference/approved-header-mobile.png`,desktopCrop:[54,8,880,640],mobileCrop:[133,158,676,1432],referenceScale:"Inferred, not claimed CSS viewport dimensions",actualViewports:[[1440,900],[390,844]],state:"Temples panel / Popular current; closed secondary groups",referenceDifferences:"Published collection order and destinations preserved; full mobile content scrolls",qa:qa.summary},null,2));
console.log(qa.summary);
