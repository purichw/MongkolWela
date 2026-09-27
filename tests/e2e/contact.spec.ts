import { expect, test } from "@playwright/test";
import fs from "node:fs";
import AxeBuilder from "@axe-core/playwright";

const seed = JSON.parse(fs.readFileSync("public/admin/content/live.json", "utf8"));
const attribute = (attr: string, value: string) => ({ selector: "#contact-channel-data", kind: "attr", attr, value });

test.beforeEach(async ({ page }) => {
  await page.route("**/api/admin/content?*", route => route.fulfill({ json: { ok: true, content: seed } }));
  await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
});

for (const width of [1440, 390]) {
  test(`contact channels, entry and clipboard at ${width}`, async ({ page, context }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/guide/");
    const entry = page.locator("[data-header-utility-links] a[href='/contact/']");
    await expect(entry).toHaveText("ติดต่อมงคลเวลา");
    await entry.click();
    await expect(page).toHaveURL(/\/contact\/$/);
    await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("h1")).toHaveText("ติดต่อมงคลเวลา");
    await expect(page.locator("[data-contact-link='email']").first()).toHaveAttribute("href", /^mailto:mongkolwela@mongkolwela.com\?subject=/);
    await expect(page.locator("[data-contact-link='line']")).toHaveAttribute("href", "https://line.me/R/ti/p/%40MongkolWela");
    expect(await page.locator("main").innerText()).not.toContain("Facebook");
    for (const [kind, value] of [["email", "mongkolwela@mongkolwela.com"], ["line", "@MongkolWela"]]) {
      const copy = page.locator(`[data-contact-copy='${kind}']`);
      await expect(copy).toBeVisible();
      await copy.focus();
      await expect(copy).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.locator("[data-contact-status]")).toContainText("คัดลอก");
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(value);
    }
    const correction = new URL(await page.locator("#corrections a").getAttribute("href") || "");
    expect(correction.searchParams.get("subject")).toBe("แจ้งแก้ไขข้อมูลสถานที่บนมงคลเวลา");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator("#contact-hero-image").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("published contact patches update all destinations, copy, text and image; clearing and deletion remain authoritative", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  let content = structuredClone(seed);
  const record = () => content.pages.find((item: { id: string }) => item.id === "contact");
  record().patches = [attribute("data-email", "support@example.com"), attribute("data-line-id", "@updated.line")];
  await page.route("**/api/admin/content?*", route => route.fulfill({ json: { ok: true, content } }));
  await page.goto("/contact/");
  const reload = () => page.evaluate(() => (window as any).MongkolWelaCMS.reload());
  await expect(page.locator("[data-contact-value='email']")).toHaveText("support@example.com");
  for (const link of await page.locator("[data-contact-link='email']").all()) await expect(link).toHaveAttribute("href", /^mailto:support@example.com\?/);
  await expect(page.locator("[data-contact-link='line']")).toHaveAttribute("href", "https://line.me/R/ti/p/%40updated.line");
  await page.locator("[data-contact-copy='email']").click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("support@example.com");
  record().patches.push({ selector: "#contact-title", kind: "text", value: "พูดคุยกับมงคลเวลา" }, { selector: "#contact-hero-image", kind: "image", src: "/assets/images/planner-wat-arun-evening.webp", alt: "ภาพจาก CMS", position: "center 40%" });
  await reload();
  await expect(page.locator("h1")).toHaveText("พูดคุยกับมงคลเวลา");
  await expect(page.locator("#contact-hero-image")).toHaveAttribute("alt", "ภาพจาก CMS");
  record().patches = [attribute("data-email", ""), attribute("data-line-id", "")];
  await reload();
  for (const link of await page.locator("[data-contact-link]").all()) {
    await expect(link).toBeHidden();
    await expect(link).not.toHaveAttribute("href");
  }
  await expect(page.locator("[data-contact-all-unavailable]")).toBeVisible();
  record().patches = [attribute("data-email", "javascript:alert(1)"), attribute("data-line-id", "https://example.com")];
  await reload();
  await expect(page.locator("[data-contact-all-unavailable]")).toBeVisible();
  record().patches = [];
  await reload();
  await expect(page.locator("[data-contact-value='email']")).toHaveText("mongkolwela@mongkolwela.com");
  await expect(page.locator("[data-contact-link='line']")).toBeVisible();
  await expect(page.locator("h1")).toHaveText("ติดต่อมงคลเวลา");
  record().enabled = false;
  await reload();
  await expect(page.locator("[data-contact-link]")).toHaveCount(0);
  record().enabled = true;
  await reload();
  await expect(page.locator("[data-contact-link='line']")).toBeVisible();
});

test("CMS outage preserves last published contacts and provides retry", async ({ page }) => {
  const content = structuredClone(seed);
  content.pages.find((item: { id: string }) => item.id === "contact").patches = [attribute("data-email", "published@example.com")];
  let failed = false;
  await page.route("**/api/admin/content?*", route => failed ? route.fulfill({ status: 503, json: { ok: false } }) : route.fulfill({ json: { ok: true, content } }));
  await page.goto("/contact/");
  await expect(page.locator("[data-contact-value='email']")).toHaveText("published@example.com");
  failed = true;
  await page.evaluate(() => (window as any).MongkolWelaCMS.reload());
  await expect(page.locator("[data-cms-load-error]")).toBeVisible();
  await expect(page.locator("[data-contact-value='email']")).toHaveText("published@example.com");
  failed = false;
  await page.locator("[data-cms-load-error] button").click();
  await expect(page.locator("[data-cms-load-error]")).toHaveCount(0);
});

test("clipboard denial offers a readable manual fallback", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new DOMException("Denied", "NotAllowedError")) } }));
  await page.goto("/contact/");
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
  await page.locator("[data-contact-copy='email']").click();
  await expect(page.locator("[data-contact-status]")).toContainText("ยังคัดลอกอัตโนมัติไม่ได้");
  await expect(page.locator("[data-contact-value='email']")).toBeVisible();
});

test("unchanged CMS refresh does not cancel an in-flight clipboard confirmation", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { value: {
    writeText: () => new Promise<void>(resolve => { (window as any).finishContactCopy = resolve; }),
  } }));
  await page.goto("/contact/");
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
  await page.locator("[data-contact-copy='email']").click();
  await expect.poll(() => page.evaluate(() => typeof (window as any).finishContactCopy)).toBe("function");
  await page.evaluate(() => (window as any).MongkolWelaCMS.reload());
  await page.evaluate(() => (window as any).finishContactCopy());
  await expect(page.locator("[data-contact-status]")).toHaveText("คัดลอกอีเมลแล้ว");
});

test("native contact links and correction anchor work without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${baseURL}/contact/#corrections`);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("#corrections")).toBeInViewport();
  await expect(page.locator("[data-contact-link='line']")).toHaveAttribute("href", "https://line.me/R/ti/p/%40MongkolWela");
  await expect(page.locator("[data-contact-copy='email']")).toBeHidden();
  await expect(page.locator("#corrections a")).toHaveAttribute("href", /^mailto:mongkolwela@mongkolwela.com\?/);
  await context.close();
});

test("contact layout keeps channels, copy controls and topic cards usable across widths", async ({ page }) => {
  await page.goto("/contact/");
  await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
  await page.locator("[data-page-loader]").waitFor({ state: "hidden" });
  await page.evaluate(() => document.fonts.ready);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const geometry = await page.evaluate(() => {
      const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
      const email = box(".contact-channel--email");
      const line = box(".contact-channel--line");
      const address = box(".contact-channel-address");
      const value = box("[data-contact-value='email']");
      const copy = box("[data-contact-copy='email']");
      const action = box(".contact-email-action");
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        stacked: line.top > email.bottom,
        aligned: Math.abs(email.top - line.top) < 1,
        copySize: [copy.width, copy.height],
        valueFits: value.right <= copy.left && value.left >= address.left && value.bottom <= address.bottom,
        actionWidth: action.width, addressWidth: address.width,
      };
    });
    expect(geometry.overflow, `${width}px horizontal overflow`).toBe(false);
    expect(width <= 720 ? geometry.stacked : geometry.aligned, `${width}px channel grouping`).toBe(true);
    expect(geometry.valueFits, `${width}px email/copy overlap`).toBe(true);
    expect(geometry.copySize.every(size => size >= 44)).toBe(true);
    expect(Math.abs(geometry.actionWidth - geometry.addressWidth)).toBeLessThan(1);
    await expect(page.locator(".contact-topic-link")).toHaveCount(3);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".contact-closing a").click();
  await expect(page).toHaveURL(/#contact-channels$/);
  await expect.poll(() => page.locator("#contact-channels").evaluate(node => {
    const top = node.getBoundingClientRect().top;
    const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--site-header-sticky-height")) || 0;
    return top >= header && top < header + 40;
  })).toBe(true);
});

for (const width of [1440, 390]) {
  test(`contact accessibility at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/contact/");
    await expect(page.locator("html")).toHaveAttribute("data-cms-ready", "true");
    await page.locator("[data-page-loader]").waitFor({ state: "hidden" });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))));
    // Axe sees the dark fallback behind the negative-z bitmap, not the gold sky.
    // Review this non-interactive quotation against the rendered image separately.
    const result = await new AxeBuilder({ page }).include("main.contact").exclude(".page-banner__quote").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(result.violations).toEqual([]);
  });
}

test("new copy stays CMS-addressable and long published values do not escape mobile cards", async ({ page }) => {
  const content = structuredClone(seed);
  const email = "contact.partnerships.and.place.corrections@example.com";
  content.pages.find((item: { id: string }) => item.id === "contact").patches = [
    attribute("data-email", email),
    { selector: "#contact-tagline", kind: "text", value: "ร่วมแบ่งปันข้อมูลเพื่อการเดินทางที่มีความหมาย" },
    { selector: "#contact-email-note", kind: "text", value: "ข้อความจากผู้ดูแลเว็บไซต์" },
    { selector: "#contact-hero-image", kind: "image", src: "/assets/images/planner-wat-arun-evening.webp", alt: "ภาพแนวตั้งจาก CMS", position: "center 40%" },
  ];
  await page.route("**/api/admin/content?*", route => route.fulfill({ json: { ok: true, content } }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/contact/");
  await expect(page.locator("#contact-email-note")).toHaveText("ข้อความจากผู้ดูแลเว็บไซต์");
  await expect(page.locator("#contact-tagline")).toHaveAttribute("data-cms-field", "contact-tagline");
  await expect(page.locator("[data-contact-value='email']")).toHaveText(email);
  await expect(page.locator("#contact-hero-image")).toHaveAttribute("alt", "ภาพแนวตั้งจาก CMS");
  const geometry = await page.evaluate(() => {
    const value = document.querySelector("[data-contact-value='email']")!.getBoundingClientRect();
    const copy = document.querySelector("[data-contact-copy='email']")!.getBoundingClientRect();
    const hero = document.querySelector(".contact-banner")!.getBoundingClientRect();
    return { overflow: document.documentElement.scrollWidth > innerWidth, noOverlap: value.right <= copy.left, heroHeight: hero.height };
  });
  expect(geometry.overflow).toBe(false);
  expect(geometry.noOverlap).toBe(true);
  expect(geometry.heroHeight).toBeLessThan(350);
});
