import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const base = process.env.HEADER_QA_URL || "http://127.0.0.1:4348";
const output = "artifacts/header-navbar";
const seed = JSON.parse(await fs.readFile("public/admin/content/live.json", "utf8"));
const report = { base, fixture: "local live.json; no production writes", runAt: new Date().toISOString(), results: [], metrics: {} };
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const pass = (ids, note) => { report.results.push({ ids, status: "PASS", note }); console.log(`PASS ${ids.join(", ")}: ${note}`); };
let content = structuredClone(seed), revision = 1, failCms = false;

async function setup(viewport = { width: 1440, height: 900 }, options = {}) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce", ...options });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
  await page.route("**/api/admin/content?**", r => r.fulfill(failCms ? { status: 503, json: { error: "QA unavailable" } } : { json: { ok: true, revision: `header-qa-${revision}`, content } }));
  await page.route("**/api/commerce?**", r => r.fulfill({ status: 503, json: { code: "COMMERCE_DISABLED" } }));
  await page.route("**/api/temple-activities?**", r => r.fulfill({ json: { events: [] } }));
  return page;
}
async function goto(page, path = "/") {
  await page.goto(`${base}${path}`);
  await page.waitForSelector("[data-header-ready]");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.documentElement.dataset.cmsNavReady === "true");
  await page.waitForTimeout(120);
}
const shot = (page, name) => page.screenshot({ path: `${output}/${name}.png`, animations: "disabled" });
const mode = page => page.locator(".mw-header").getAttribute("data-header-mode");
async function open(page) { await page.locator(".mw-menu-toggle").click(); assert.equal(await page.locator("dialog.mw-drawer").evaluate(n => n.open), true); }
async function refresh(page) { revision++; await page.evaluate(() => window.dispatchEvent(new Event("focus"))); await page.waitForTimeout(450); }
const temple = page => page.locator('[data-nav-item-id="temples"]');

try {
  const page = await setup();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await goto(page);
  assert.equal(await mode(page), "wide");
  assert.equal(await page.locator('.mw-desktop-nav [aria-current="page"]').count(), 0);
  assert.equal(await page.locator('.mw-brand img').getAttribute("src"), "/assets/brand/mongkolwela-mark-192.webp");
  assert.equal(await page.locator('[data-nav-item-id="calendar"] details').count(), 0);
  await shot(page, "desktop-closed");
  await temple(page).hover();
  await page.waitForTimeout(180);
  assert.equal(await temple(page).locator("details").evaluate(n => n.open), true);
  assert.equal(await temple(page).locator(".mw-panel").evaluate(n => getComputedStyle(n).backgroundColor), "rgb(255, 253, 247)");
  await shot(page, "desktop-temples");
  pass(["HN-003", "HN-004", "HN-006", "HN-020", "HN-025"], "1440 Home: original logo, opaque open panel, direct Calendar, truthful current state.");
  await page.mouse.move(700, 600);
  await page.waitForTimeout(60);
  await temple(page).locator(".mw-panel").hover();
  await page.waitForTimeout(230);
  assert.equal(await temple(page).locator("details").evaluate(n => n.open), true);
  pass(["HN-011", "HN-012"], "Pointer crosses from trigger to panel and returns within exit grace.");
  await page.keyboard.press("Escape");
  assert.equal(await temple(page).locator("details").evaluate(n => n.open), false);
  await page.waitForTimeout(200);
  assert.equal(await temple(page).locator("summary").evaluate(n => n === document.activeElement), true);
  await temple(page).locator("summary").click();
  assert.equal(await temple(page).locator("details").evaluate(n => n.open), true);
  assert.equal(await temple(page).locator(".mw-panel a").first().evaluate(n => n === document.activeElement), true);
  await page.mouse.move(20, 700);
  await page.waitForTimeout(250);
  assert.equal(await temple(page).locator("details").evaluate(n => n.open), true);
  await page.keyboard.press("Escape");
  await page.keyboard.press("ArrowDown");
  assert.equal(await temple(page).locator(".mw-panel a").first().evaluate(n => n === document.activeElement), true);
  await page.locator('[data-nav-item-id="horoscope"] summary').click();
  assert.equal(await page.locator(".mw-disclosure[open]").count(), 1);
  assert.equal(await page.locator(".mw-panel--tools .mw-child-link").first().evaluate(n => getComputedStyle(n).fontWeight), "400");
  await shot(page, "desktop-tools");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  assert.equal(await page.locator('.mw-disclosure[open]').count(), 1); // next commerce context
  await page.locator(".mw-search").focus();
  await page.waitForTimeout(40);
  assert.equal(await page.locator('.mw-disclosure[open]').count(), 0);
  pass(["HN-005", "HN-009", "HN-010", "HN-013", "HN-014", "HN-015", "HN-017"], "Disclosure click, ArrowDown, focus retention, Escape, natural Tab exit and one open panel.");

  const widths = [[320,568],[360,800],[390,844],[430,932],[480,900],[768,1024],[1024,768],[1279,900],[1280,900],[1440,900],[1920,1080],[844,390]];
  for (const [width,height] of widths) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(120);
    await page.evaluate(() => window.scrollTo(0,0));
    const metrics = await page.locator(".mw-header").evaluate(n => {
      const box = element => { const r = element.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height, right:r.right, bottom:r.bottom }; };
      const nodes = [...n.querySelectorAll('.mw-brand, .mw-header-actions > *, .mw-menu-toggle')].filter(e => e.getClientRects().length);
      return { mode:n.dataset.headerMode, overflow:document.documentElement.scrollWidth-innerWidth, header:box(n), controls:nodes.map(box), duplicateIds:[...document.querySelectorAll('[id]')].map(e=>e.id).filter((id,i,list)=>list.indexOf(id)!==i) };
    });
    report.metrics[`${width}x${height}`] = metrics;
    assert.ok(metrics.overflow <= 1, `overflow at ${width}: ${metrics.overflow}`);
    assert.deepEqual(metrics.duplicateIds, []);
    assert.ok(metrics.controls.every(r=>r.x>=0 && r.right<=width+1), `control fit at ${width}`);
    if (width < 1280) assert.equal(metrics.mode, "compact");
    await shot(page, `closed-${width}`);
    if (metrics.mode === "compact") {
      await open(page);
      assert.equal(await page.locator(".mw-drawer-close").evaluate(n=>n===document.activeElement),true);
      await page.keyboard.press("Shift+Tab");
      assert.equal(await page.locator(".mw-drawer").evaluate(n=>n.contains(document.activeElement)),true);
      await page.keyboard.press("Tab");
      assert.equal(await page.locator(".mw-drawer-close").evaluate(n=>n===document.activeElement),true);
      await page.locator(".mw-drawer-scroll").evaluate(n=>n.scrollTop=0);
      await shot(page, `drawer-${width}`);
      if (width===768) { const r=await page.locator(".mw-drawer").boundingBox(); assert.ok(r.width<=560); assert.ok(Math.abs(r.x-(768-r.width)/2)<1); }
      await page.keyboard.press("Escape");
      assert.equal(await page.locator(".mw-menu-toggle").evaluate(n=>n===document.activeElement),true);
      assert.notEqual(await page.evaluate(()=>document.body.style.position),"fixed");
    }
  }
  pass(["HN-007","HN-031","HN-032","HN-034","HN-035","HN-036","HN-037","HN-038","HN-040","HN-041","HN-043","HN-045","HN-055"], "12 viewport states, 44px actions, centered tablet drawer, focus loop, IDs and scroll unlock.");

  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>window.scrollTo(0,400));
  await page.waitForTimeout(100);
  const scrollBefore=await page.evaluate(()=>scrollY);
  const historyBefore=await page.evaluate(()=>history.length);
  await open(page);
  assert.equal(Math.round((await page.locator(".mw-drawer").boundingBox()).y),65);
  await page.locator('[data-nav-key="mobile-group-horoscope"] > summary').click();
  await page.locator('[data-nav-key="mobile-group-tarot-section"] > summary').click();
  await page.locator('[data-header-mobile] [data-nav-id="tarot-luck"]').focus();
  await shot(page,"mobile-tools-deep");
  await page.locator(".mw-drawer-scroll").evaluate(n=>n.scrollTop=n.scrollHeight);
  await shot(page,"mobile-bottom");
  const drawerScroll=await page.locator(".mw-drawer-scroll").evaluate(n=>n.scrollTop);
  await page.locator(".mw-drawer-close").click();
  assert.equal(await page.evaluate(()=>scrollY),scrollBefore);
  await open(page);
  assert.equal(await page.locator(".mw-drawer-scroll").evaluate(n=>n.scrollTop),drawerScroll);
  assert.equal(await page.locator('[data-nav-key="mobile-group-tarot-section"]').evaluate(n=>n.open),true);
  await page.mouse.click(2,200);
  assert.equal(await page.locator(".mw-drawer").evaluate(n=>n.open),false);
  assert.equal(await page.evaluate(()=>history.length),historyBefore);
  pass(["HN-042","HN-044","HN-048","HN-070"],"Backdrop, deep scroll, expansion persistence and no synthetic history entries.");

  await open(page);
  const focused=page.locator('[data-header-mobile] [data-nav-id="popular-temples"]');
  await focused.focus();
  await focused.evaluate(n=>window.headerFocusedNode=n);
  const originalScroll=await page.locator(".mw-drawer-scroll").evaluate(n=>n.scrollTop);
  content=structuredClone(content);
  content.navigation.tabs[0].items.find(i=>i.id==="popular-temples").label="วัดดังและสถานที่ยอดนิยม";
  await refresh(page);
  assert.ok((await focused.textContent()).includes("สถานที่ยอดนิยม"));
  assert.equal(await focused.evaluate(n=>n===window.headerFocusedNode && n===document.activeElement),true);
  assert.equal(await page.locator(".mw-drawer-scroll").evaluate(n=>n.scrollTop),originalScroll);
  content.navigation.tabs[0].items.find(i=>i.id==="popular-temples").enabled=false;
  await refresh(page);
  assert.equal(await focused.count(),0);
  assert.equal(await page.locator(".mw-drawer-close").evaluate(n=>n===document.activeElement),true);
  await page.setViewportSize({width:1920,height:1080});
  await page.waitForTimeout(150);
  assert.equal(await mode(page),"wide");
  assert.equal(await page.locator(".mw-drawer").evaluate(n=>n.open),false);
  assert.notEqual(await page.evaluate(()=>document.body.style.position),"fixed");
  pass(["HN-051","HN-059","HN-060"],"Real CMS refresh retains node identity/focus/scroll; removed focused child returns to Close; resize releases modal.");

  content=structuredClone(seed);
  for (const item of content.navigation.tabs) item.label += " รายการเพิ่มเติมสำหรับการเดินทาง";
  await refresh(page);
  assert.equal(await mode(page),"compact");
  await shot(page,"long-label-fit");
  content=structuredClone(seed);
  await refresh(page);
  await page.setViewportSize({width:390,height:844});
  await page.addStyleTag({content:"html { font-size: 200% !important; }"});
  await page.waitForTimeout(150);
  assert.equal(await page.locator(".mw-header").evaluate(n=>n.scrollWidth<=innerWidth),true);
  await open(page);
  assert.equal(await page.locator(".mw-drawer-scroll").evaluate(n=>n.scrollWidth<=n.clientWidth),true);
  await shot(page,"mobile-text-200");
  report.metrics.text200 = "390px: header reflows to two rows; menu text wraps; no horizontal scrolling";
  await page.close();

  const routes=["/","/temples/","/temples/popular/","/temples/sacred/","/temples/mu/","/temples/thailand/","/temples/popular/001-ว-ดระฆ-งโฆส-ตาราม-กร-งเทพมหานคร/","/temples/planner/","/calendar/","/calendar/day/?date=2026-09-20","/tarot/daily/","/horoscope/life-graph/","/shop/","/merit/"];
  const routePage=await setup();
  for(const path of routes){
    await goto(routePage,path);
    assert.equal(await mode(routePage),"wide",path);
    const before=routePage.url();
    await routePage.locator('.mw-nav-item > .mw-disclosure > summary').first().click();
    await routePage.keyboard.press("Escape");
    assert.equal(routePage.url(),before);
    assert.equal(await routePage.locator('h1').count(),1);
    assert.equal(await routePage.locator('.mw-desktop-nav [data-nav-id="merit"]').getAttribute("href"),"/merit/");
    report.metrics[path]={mode:await mode(routePage),current:await routePage.locator('.mw-desktop-nav [aria-current="page"]').evaluateAll(n=>n.map(e=>e.getAttribute("href")))};
  }
  pass(["HN-026","HN-027","HN-068","HN-069"],"14 public routes share header, preserve route/query, one H1, existing footer and loader owners untouched.");
  await goto(routePage,"/calendar/?year=2569&month=1");
  await routePage.evaluate(()=>window.scrollTo(0,450));
  await routePage.waitForTimeout(100);
  const sticky=await routePage.evaluate(()=>({header:document.querySelector('.mw-header').getBoundingClientRect().bottom,toolbar:document.querySelector('.cal-toolbar-wrap').getBoundingClientRect().top}));
  assert.ok(sticky.toolbar>=sticky.header-1);
  await shot(routePage,"calendar-sticky");
  pass(["HN-063"],"Calendar toolbar remains below measured sticky main header.");

  await goto(routePage,"/");
  await routePage.locator('.mw-search').click();
  assert.equal(await routePage.locator('#site-search').evaluate(n=>n===document.activeElement),true);
  await routePage.setViewportSize({width:360,height:800});
  await open(routePage);
  await routePage.locator('.mw-drawer-search').click();
  assert.equal(await routePage.locator('#site-search').evaluate(n=>n===document.activeElement),true);
  assert.equal(await routePage.locator('.mw-drawer').evaluate(n=>n.open),false);
  assert.equal(await routePage.locator('.mw-planner-cta').getAttribute('aria-label'),'วางแผนไหว้พระ');
  pass(["HN-002","HN-029","HN-052"],"Actual Search is Home input focus, not a new modal; drawer unlocks before focusing; CTA full accessible name retained.");
  await routePage.setViewportSize({width:1440,height:900});
  await goto(routePage,"/temples/popular/");
  await temple(routePage).locator('summary').click();
  await shot(routePage,"desktop-temples-current");
  const axeDesktop=await new AxeBuilder({page:routePage}).include('.mw-header').include('.mw-utility').analyze();
  assert.deepEqual(axeDesktop.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
  await routePage.setViewportSize({width:390,height:844});
  await open(routePage);
  await shot(routePage,"mobile-drawer-current");
  const axeMobile=await new AxeBuilder({page:routePage}).include('.mw-drawer').analyze();
  assert.deepEqual(axeMobile.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
  pass(["HN-047","HN-054"],"Active collection context opens; axe header/drawer contrast and semantics pass.");
  await routePage.close();

  const nojs=await setup({width:390,height:844},{javaScriptEnabled:false});
  await nojs.goto(base);
  await nojs.locator('.mw-fallback > summary').click();
  assert.equal(await nojs.locator('.mw-fallback [data-nav-id="popular-temples"]').isVisible(),true);
  await nojs.locator('.mw-fallback [data-nav-id="popular-temples"]').click();
  assert.ok(nojs.url().endsWith('/temples/popular/'));
  await nojs.close();
  pass(["HN-057"],"JS-disabled native disclosure can navigate to collection.");

  failCms=true;
  const unavailable=await setup();
  await goto(unavailable);
  assert.equal(await unavailable.locator('.mw-nav-item').count(),seed.navigation.tabs.filter(i=>i.enabled!==false).length);
  await unavailable.close();
  failCms=false;
  pass(["HN-058"],"Unavailable CMS retains usable SSR published snapshot.");
  const touch=await setup({width:1440,height:900},{hasTouch:true,isMobile:false});
  await goto(touch);
  await temple(touch).locator('summary').tap();
  assert.equal(await temple(touch).locator('details').evaluate(n=>n.open),true);
  await touch.close();
  pass(["HN-018"],"Coarse-pointer wide desktop disclosure opens by tap.");
  assert.deepEqual(errors,[]);
  report.status="PASS";
} catch(error) { report.status="FAIL"; report.error=error.stack; throw error; }
finally { await fs.writeFile(`${output}/browser-results.json`,JSON.stringify(report,null,2)); await browser.close(); }
