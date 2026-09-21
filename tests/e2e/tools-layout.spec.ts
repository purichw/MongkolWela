import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { chooseOption } from "./select-helpers";

const content=JSON.parse(readFileSync(new URL("../../public/admin/content/live.json",import.meta.url),"utf8"));
test.beforeEach(async ({page}) => {
  await page.addInitScript(()=>localStorage.setItem("mongkolwela.pdpa.analytics","declined"));
  await page.route("**/api/admin/content?**", route=>route.fulfill({json:{ok:true,revision:"tools-layout-local-fixture",content}}));
  await page.emulateMedia({reducedMotion:"reduce"});
});

test("all tool families and descendant templates share the shell without overflow", async ({page}, info) => {
  test.setTimeout(120_000);
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  const paths=["/horoscope/thai-astrology/","/horoscope/life-graph/","/horoscope/seamsi/","/horoscope/palmistry/","/tarot/meanings/","/tarot/meanings/the-emperor/","/tarot/daily/","/tarot/monthly/","/tarot/luck/","/tarot/love/","/tarot/money/","/tarot/career/","/tarot/daily/result/","/tarot/monthly/result/","/tarot/luck/result/","/tarot/love/result/","/tarot/money/result/","/tarot/career/result/"];
  for(const path of paths){
    await page.goto(path);await expect(page.locator(".tools-hero")).toBeVisible();
    await expect(page.locator("main h1")).toHaveCount(1);
    await expect(page.locator("body")).toHaveClass(/tools-page/);
    await expect(page.locator(".tools-hero__ornament")).toHaveJSProperty("complete",true);
    expect(await page.locator(".tools-hero__ornament").evaluate((e:HTMLImageElement)=>e.naturalWidth)).toBeGreaterThan(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1),path).toBeTruthy();
    const edges=await page.locator(".tools-hero__inner").boundingBox();
    expect(edges!.width).toBeLessThanOrEqual(1220);
    if(path==="/horoscope/thai-astrology/" || path==="/horoscope/palmistry/" || path==="/horoscope/seamsi/" || path==="/tarot/daily/" || path==="/horoscope/life-graph/"){
      await page.evaluate(()=>document.fonts.ready);
      await page.screenshot({path:`.local/tools-redesign/qa-${path.split("/").filter(Boolean).join("-")}-${info.project.name}.png`,fullPage:true});
    }
  }
  expect(errors).toEqual([]);
});

test("astrology commits one snapshot, escapes names and keeps drafts across resize", async({page})=>{
  await page.goto("/horoscope/thai-astrology/");
  const output=page.locator("[data-thai-astrology-output]");
  await expect(output).toHaveAttribute("data-origin","sample");
  await expect(page.locator(".thai-wheel-house")).toHaveCount(12);
  await expect(page.locator("[data-planet-row]")).toHaveCount(10);
  const old=await page.locator("[data-astro-heading]").innerText();
  const table=await page.locator(".thai-planet-table").textContent();
  await page.locator('[name="name"]').fill('<b>ผู้ทดสอบ</b>');
  await page.locator('[name="birthDate"]').fill("2000-02-29");
  await chooseOption(page,'[name="birthHour"]',"0");
  await expect(output).toHaveAttribute("data-state","dirty");
  expect(await page.locator(".thai-planet-table").textContent()).toBe(table);
  expect(await page.locator("[data-astro-heading]").innerText()).toContain(old);
  await page.getByRole("button",{name:"อัปเดตดวง",exact:true}).click();
  await expect(output).toHaveAttribute("data-origin","user");
  await expect(output).toHaveAttribute("data-state","ready");
  await expect(page.locator("[data-astro-heading]")).toContainText("<b>ผู้ทดสอบ</b>");
  await expect(page.locator("[data-astro-heading] b")).toHaveCount(0);
  await expect(page.locator("#thai-result-title")).toBeFocused();
  const committed=await page.locator(".thai-planet-table").textContent();
  for(const width of [320,360,430,768,1024,1280,1920]){
    await page.setViewportSize({width,height:900});
    await expect(page.locator(".thai-chart-wheel")).toHaveCount(1);
    await expect(page.locator("[data-thai-astrology-form]")).toHaveCount(1);
    expect(await page.locator(".thai-planet-table").textContent()).toBe(committed);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
    if(width<768){const chart=await page.locator(".thai-chart-wheel").boundingBox(),form=await page.locator("[data-thai-astrology-form]").boundingBox();expect(chart!.y+chart!.height).toBeLessThan(form!.y);}
  }
  await page.locator('[name="birthDate"]').fill("");
  await page.getByRole("button",{name:"อัปเดตดวง",exact:true}).click();
  await expect(page.locator('[name="birthDate"]')).toHaveAttribute("aria-invalid","true");
  expect(await page.locator(".thai-planet-table").textContent()).toBe(committed);
  const axe=await new AxeBuilder({page}).include("main").withTags(["wcag2a","wcag2aa"]).analyze();
  expect(axe.violations.filter(v=>["serious","critical"].includes(v.impact!))).toEqual([]);
});

test("existing tarot selection and result flow remains usable",async({page})=>{
  for(const slug of ["daily","love"]){
    await page.goto(`/tarot/${slug}/`);
    await expect(page.locator("[data-tarot-read]")).toBeDisabled();
    await page.locator("[data-tarot-shuffle]").click();
    await expect(page.locator("[data-tarot-deck]")).not.toHaveClass(/is-shuffling/);
    const last=page.locator("[data-card-id]").last();
    await expect(last).toBeEnabled();
    await last.focus();await page.keyboard.press("Enter");
    await expect(page.locator("[data-tarot-count]")).toHaveValue("1");
    await page.locator("[data-tarot-read]").click();
    await expect(page).toHaveURL(new RegExp(`/tarot/${slug}/result/`));
    await expect(page.locator("main h1")).toHaveCount(1);
    await expect(page.locator(".tarot-card-image").first()).toBeVisible();
    await expect(page.locator(".tarot-reading-list").first()).toBeVisible();
  }
});

test("life graph, palm reading and seamsi keep working in the new frame",async({page})=>{
  await page.goto("/horoscope/life-graph/");
  await page.locator('[name="name"]').fill("ผู้ทดสอบกราฟ");
  await page.locator('[data-life-graph-form] [type="submit"]').click();
  await expect(page.locator("[data-life-graph-output]")).toContainText("ผู้ทดสอบกราฟ");
  await page.goto("/horoscope/palmistry/");
  await page.locator('[data-handedness="left"]').click();
  await expect(page.locator('[data-handedness="left"]')).toHaveAttribute("aria-pressed","true");
  await page.locator('[data-mode="compare"]').click();
  await expect(page.locator('[data-mode="compare"]')).toHaveAttribute("aria-pressed","true");
  await expect(page.locator("[data-plw-context]")).toContainText("สองมือ");
  await page.goto("/horoscope/seamsi/");
  await page.locator("[data-seamsi-question]").fill("ควรเตรียมตัวอย่างไร");
  await page.locator("[data-seamsi-shake]").click();
  await expect(page.locator(".seamsi-result-card")).toBeVisible();
  await expect(page.locator(".seamsi-question")).toContainText("ควรเตรียมตัวอย่างไร");
});
