import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";

const content = JSON.parse(readFileSync(new URL("../../public/admin/content/live.json", import.meta.url), "utf8"));
const route = "/horoscope/palmistry/";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
  await page.route("**/api/admin/content?**", request => request.fulfill({ json: { ok: true, content } }));
});

test("compact layout, artwork and accessible initial state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(route);
  await expect(page.locator(".plw-card")).toHaveCount(9);
  await expect(page.locator(".palm-features li")).toHaveCount(4);
  await expect(page.locator(".palm-reference-disclosure")).not.toHaveAttribute("open", "");
  await page.evaluate(async () => {
    for (const image of document.images) { image.loading = "eager"; await image.decode().catch(() => {}); }
    await document.fonts.ready;
  });
  expect(await page.locator("main img[src]").evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBeTruthy();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), { message: `${width}px overflow` }).toBeTruthy();
    const rects = await page.locator(".plw-card").evaluateAll(cards => cards.map(card => ({ w: card.getBoundingClientRect().width, h: card.getBoundingClientRect().height })));
    expect(Math.max(...rects.map(r => r.w)) - Math.min(...rects.map(r => r.w))).toBeLessThan(2);
    const shell = await page.locator("#plw").boundingBox();
    expect(shell!.y).toBeLessThan(780);
  }
  const axe = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa"]).analyze();
  const violations = axe.violations.filter(v => ["serious", "critical"].includes(v.impact!));
  expect(violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
  expect(errors).toEqual([]);
});

test("line choices preserve focus, hand meaning and comparisons", async ({ page }) => {
  await page.goto(route);
  await expect(page.locator(".page-fonts-pending")).toHaveCount(0);
  const clear = page.locator('[data-variant="long_clear"][data-select-hand="dominant"]');
  await clear.focus();
  await expect(clear).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(clear).toBeFocused();
  await expect(clear).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".plw-detail-heading")).toContainText("ยาวชัดเจน");
  await page.getByRole("button", { name: "มือไม่ถนัด", exact: true }).click();
  await expect(page.locator(".plw-card.plw-active")).toHaveCount(0);
  await page.getByRole("button", { name: "เทียบสองมือ", exact: true }).click();
  await page.locator('[data-variant="long_clear"] [data-select-hand="nonDominant"]').click();
  await page.locator('[data-variant="broken"] [data-select-hand="dominant"]').click();
  await expect(page.locator(".plw-comparison-result")).toContainText("อ่อนลงในมือถนัด");
  await page.getByRole("button", { name: "ถนัดซ้าย", exact: true }).click();
  await expect(page.locator("[data-plw-context]")).toContainText("มือซ้าย · มือถนัด");
  const head = page.locator('[data-line="head_line"]');
  await head.click();
  await expect(head).toBeFocused();
  await expect(page.locator("[data-plw-line-title]")).toHaveText("เส้นสมอง");
  await page.locator('[data-line="life_line"]').click();
  await expect(page.locator('[data-variant="broken"] [data-select-hand="dominant"]')).toHaveAttribute("aria-pressed", "true");
});

test("annotated palm selects readings and synchronizes physical hands", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(route);
  await expect(page.locator(".page-fonts-pending")).toHaveCount(0);
  await expect(page.locator(".palm-hero-hand")).toHaveCount(0);
  await expect(page.locator(".plw-map-label")).toHaveCount(7);
  await expect(page.locator('[data-map-hand="right"]')).toHaveAttribute("aria-pressed", "true");
  const map = page.locator(".plw-map");
  const photos = page.locator(".plw-photos");
  expect((await map.boundingBox())!.y).toBeLessThan((await photos.boundingBox())!.y);
  await page.locator('[data-map-hand="left"]').click();
  await expect(page.locator('[data-mode="nonDominant"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-map-palm]')).toHaveAttribute("transform", /scale\(-1 1\)/);
  await page.locator('.plw-map-label[data-map-select="heart_line"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-plw-line-title]')).toHaveText("เส้นหัวใจ");
  await expect(page.locator('[data-line="heart_line"]')).toBeFocused();
  await page.getByRole("button", { name: "เทียบสองมือ", exact: true }).click();
  await page.locator('[data-map-hand="right"]').click();
  await expect(page.locator('[data-mode="compare"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('.plw-map-stage').scrollIntoViewIfNeeded();
  // A path's bounding-box center can lie on another line at an intersection.
  const point = await page.locator('.plw-map-line-hit[data-map-select="fate_line"]').evaluate(element => {
    const path = element as SVGPathElement;
    const p = path.getPointAtLength(path.getTotalLength() * 0.9);
    const screen = new DOMPoint(p.x, p.y).matrixTransform(path.getScreenCTM()!);
    return { x: screen.x, y: screen.y, target: (document.elementFromPoint(screen.x, screen.y) as SVGElement)?.dataset.mapSelect };
  });
  expect(point.target).toBe("fate_line");
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('[data-plw-line-title]')).toHaveText("เส้นวาสนา");
  await expect(page.locator('.plw-map-label[data-map-select="fate_line"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-plw-start]').click();
  await expect(page.locator('.plw-card button').first()).toBeFocused();
});

test("mobile reveals every example without losing the selection", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(route);
  const grid = page.locator("#plw-grid");
  expect(await grid.evaluate(el => el.scrollWidth > el.clientWidth)).toBeTruthy();
  await page.locator("[data-plw-show-all]").click();
  await expect(page.locator("[data-plw-show-all]")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator('[data-variant="curves_to_moon"]')).toBeInViewport();
  await page.locator('[data-variant="curves_to_moon"]').click();
  await expect(page.locator(".plw-detail-heading")).toContainText("โค้งไปเนินจันทร์");
  await page.locator("[data-plw-show-all]").click();
  await expect(page.locator('[data-variant="curves_to_moon"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-line="fate_line"]').click();
  await expect(page.locator(".plw-card")).toHaveCount(10);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
});

test("photos remain local, validate inputs and retain editing controls", async ({ page }) => {
  const posts: string[] = [];
  page.on("request", request => { if (request.method() === "POST") posts.push(request.url()); });
  await page.goto(route);
  const input = page.locator('[data-photo-input="left"][data-photo-source="library"]');
  await input.setInputFiles({ name: "unsupported.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
  await expect(page.locator('[data-photo-message="left"]')).toContainText("JPG, PNG หรือ WebP");
  await input.setInputFiles({ name: "too-large.png", mimeType: "image/png", buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
  await expect(page.locator('[data-photo-message="left"]')).toContainText("ไม่เกิน 10 MB");
  await input.setInputFiles("public/images/lines/life_line_long_clear.png");
  const preview = page.locator('[data-photo-preview="left"]');
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute("src", /^blob:/);
  await page.locator('[data-photo-rotate="left"]').click();
  await expect(preview).toHaveAttribute("style", /rotate\(90deg\)/);
  await page.getByRole("button", { name: "เทียบสองมือ", exact: true }).click();
  await expect(preview).toBeVisible();
  await page.locator('[data-photo-remove="left"]').click();
  await expect(preview).toBeHidden();
  await expect(page.locator('[data-photo-dropzone="left"]')).toHaveAttribute("data-photo-empty", "true");
  expect(posts).toEqual([]);
});

test("reference views and camera-denial recovery preserve the current public content", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: () => Promise.reject(new DOMException("Test denial", "NotAllowedError")) });
  });
  await page.goto(route);
  await page.locator(".palm-reference-disclosure > summary").click();
  await page.locator('[data-palm-view="mounts"]').click();
  await expect(page.locator("[data-palm-mount-legend]")).toBeVisible();
  await page.locator('[data-palm-view="minor"]').click();
  await expect(page.locator('[data-palm-layer="minor"]')).toBeVisible();
  await expect(page.locator(".palm-source-disclosure, .palm-method, [data-palm-line-guide]")).toHaveCount(0);
  await page.locator('[data-photo-trigger="left"][data-photo-source="camera"]').click();
  await expect(page.locator("[data-camera-message]")).toContainText("เปิดกล้องไม่ได้");
  await expect(page.locator("[data-camera-capture]")).toBeDisabled();
  await page.locator("[data-camera-close]").click();
  await expect(page.locator("[data-camera-panel]")).toBeHidden();
});
