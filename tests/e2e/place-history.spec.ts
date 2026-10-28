import { test, expect } from "@playwright/test";
import { createTempleRoutingServer } from "../helpers/temple-routing-server.mjs";
import { testAccessToken } from "../helpers/supabase-auth-fixture.mjs";
import { ADMIN_ACCESS_COOKIE } from "../../api/admin/_auth.js";
import { templeRouteCatalog } from "../../src/lib/temple-routing.js";
import fs from "node:fs/promises";
import { importPlaceHistories } from "../../scripts/lib/place-history-import.mjs";
import { createPlaceModel, renderHighlights, renderLocation, renderVisit } from "../../src/lib/place-detail-view.js";
import { getTempleVisitInfo } from "../../src/data/temple-visit-info.js";

test("reviewed histories fit the existing overview with blessing and worship content", async ({ page }) => {
  const histories = JSON.parse(await fs.readFile("docs/research/curated-place-histories.json", "utf8"));
  const fixture = await createTempleRoutingServer();
  try {
    fixture.state.content = importPlaceHistories(fixture.state.content, histories, { reviewedAt: "2026-10-28" }).content;
    const places = templeRouteCatalog(fixture.state.content);
    const first = places.find(row => row.collection === "popular")!;
    await page.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${fixture.url}/temples/popular/${first.cmsSlug}/`);
    await expect(page.locator('[data-pd-domain="highlights"] > p')).toHaveText(fixture.state.content.temples.records[first.cmsKey].fields.description);
    await expect(page.locator("html")).toHaveClass(/page-fonts-ready/);
    await page.evaluate(() => document.fonts.ready);
    const variants = places.map(record => {
      const vm = createPlaceModel({ record, visit: getTempleVisitInfo(record) }, fixture.state.content.temples.records[record.cmsKey]);
      return { key: record.cmsKey, html: renderHighlights(vm), location: renderLocation(vm), visit: renderVisit(vm) };
    });
    expect(variants).toHaveLength(625);
    for (const width of [980, 1280, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const overflow = await page.evaluate(variants => {
        const copy = document.querySelector<HTMLElement>('[data-pd-domain="highlights"]')!;
        const card = copy.closest<HTMLElement>(".pd-highlights")!;
        const original = copy.innerHTML;
        const location = document.querySelector<HTMLElement>('[data-pd-domain="location"]')!;
        const visit = document.querySelector<HTMLElement>('[data-pd-domain="visit"]')!;
        const originalLocation = location.innerHTML;
        const originalVisit = visit.innerHTML;
        const issues = [];
        for (const variant of variants) {
          location.innerHTML = variant.location;
          visit.innerHTML = variant.visit;
          copy.innerHTML = "";
          const available = card.getBoundingClientRect().bottom - parseFloat(getComputedStyle(card).paddingBottom);
          copy.innerHTML = variant.html;
          if (copy.getBoundingClientRect().bottom > available + 1 || copy.scrollWidth > copy.clientWidth + 1) issues.push(variant.key);
        }
        copy.innerHTML = original;
        location.innerHTML = originalLocation;
        visit.innerHTML = originalVisit;
        return issues;
      }, variants);
      expect(overflow, `Overview overflow at ${width}px`).toEqual([]);
    }
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.locator(".pd-highlights").scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: `artifacts/place-history/public-${width}.png` });
    }
  } finally { await fixture.close(); }
});

test("history editor saves, reloads, synchronizes memberships and keeps evidence off public pages", async ({ page, context, browser }) => {
  const histories = JSON.parse(await fs.readFile("docs/research/curated-place-histories.json", "utf8"));
  const editedHistory = `ฉบับตรวจการบันทึก: ${histories[0].description}`;
  const fixture = await createTempleRoutingServer();
  const preview = { base: fixture.url, close: fixture.close };
  const visitor = await browser.newContext();
  try {
    await context.addCookies([{ name: ADMIN_ACCESS_COOKIE, value: testAccessToken(), url: preview.base }]);
    const response = await context.request.get(`${preview.base}/api/admin/content?view=editor`);
    expect(response.ok()).toBe(true);
    const original = await response.json();
    const places = templeRouteCatalog(original.content);
    const place = places.find(row => row.collection === "popular")!;
    const related = places.filter(row => row.cmsVisitInfoKey === place.cmsVisitInfoKey);
    expect(related.length).toBeGreaterThan(1);
    for (const row of related) original.content.temples.records[row.cmsKey] = {
      key: row.cmsKey, collection: row.collection,
      fields: { description: "ประวัติฉบับทดสอบสำหรับตรวจการบันทึก" },
      historyResearch: { key: row.cmsVisitInfoKey, sources: [{ url: "https://example.com/editor-only-evidence", title: "หลักฐานสำหรับผู้ดูแล" }] },
    };
    const seeded = await context.request.post(`${preview.base}/api/admin/content`, { headers: { Origin: preview.base }, data: { content: original.content, expectedRevision: original.revision } });
    expect(seeded.ok()).toBe(true);
    await page.goto(`${preview.base}/admin/`);
    await expect(page.locator("#adminStatus")).toHaveText("พร้อมใช้งาน");
    await page.locator('#adminNav [data-section="temples"]').click();
    await page.locator(`[data-edit-temple="${place.cmsKey}"]`).click();
    await expect(page.getByLabel("ประวัติและเรื่องน่ารู้", { exact: true })).toHaveValue("ประวัติฉบับทดสอบสำหรับตรวจการบันทึก");
    await page.locator('[data-editor-panel="history-sources"] > summary').click();
    await expect(page.getByRole("link", { name: "หลักฐานสำหรับผู้ดูแล" })).toHaveAttribute("href", "https://example.com/editor-only-evidence");
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 950 });
      await page.locator(".mw-place-history").scrollIntoViewIfNeeded();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.locator(".mw-place-editor").evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await page.screenshot({ path: `artifacts/place-history/admin-${width}.png` });
    }
    await page.getByLabel("ประวัติและเรื่องน่ารู้", { exact: true }).fill(editedHistory);
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await page.locator('[data-action="publish"]').click();
    await expect(page.locator("#adminStatus")).toHaveText("เผยแพร่แล้ว");
    await page.reload();
    await expect(page.locator("#adminStatus")).toHaveText("พร้อมใช้งาน");
    const editor = await (await context.request.get(`${preview.base}/api/admin/content?view=editor`)).json();
    for (const row of related) {
      expect(editor.content.temples.records[row.cmsKey].fields.description).toBe(editedHistory);
      expect(editor.content.temples.records[row.cmsKey].historyResearch.sources).toHaveLength(1);
    }
    expect((await visitor.request.get(`${preview.base}/api/admin/content?view=editor`)).status()).toBe(401);
    const publicData = await (await visitor.request.get(`${preview.base}/api/admin/content`)).json();
    expect(JSON.stringify(publicData)).not.toContain("editor-only-evidence");
    const publicPage = await visitor.newPage();
    await publicPage.addInitScript(() => localStorage.setItem("mongkolwela.pdpa.analytics", "declined"));
    await publicPage.goto(`${preview.base}/temples/popular/${place.cmsSlug}/`);
    await expect(publicPage.locator('[data-pd-domain="highlights"] > p')).toHaveText(editedHistory);
    expect(await publicPage.content()).not.toContain("editor-only-evidence");
  } finally { await visitor.close(); await preview.close(); }
});
