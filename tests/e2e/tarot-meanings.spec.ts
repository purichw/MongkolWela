import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';

const content = JSON.parse(readFileSync('public/admin/content/live.json', 'utf8'));
const output = 'artifacts/tarot-meanings';
test.beforeEach(async ({ page }) => {
  mkdirSync(output, { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('mongkolwela.pdpa.analytics', 'declined'));
  await page.route('**/api/admin/content?*', route => route.fulfill({ json: { ok: true, content } }));
});
async function ready(page) {
  await expect(page.locator('html')).toHaveAttribute('data-cms-ready', 'true');
  await expect(page.locator('[data-page-loader]')).toBeHidden();
  await page.evaluate(() => document.fonts.ready);
}
async function fits(page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
async function accessible(page) {
  const audit = await new AxeBuilder({ page }).include('main').withTags(['wcag2a','wcag2aa']).analyze();
  expect(audit.violations.filter(v => ['critical','serious'].includes(v.impact!))).toEqual([]);
}

for (const width of [1440, 390]) {
  test(`library filtering, return context and detail at ${width}`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/tarot/meanings/'); await ready(page);
    await expect(page.locator('.tarot-library')).toHaveCSS('display', 'grid');
    await expect(page.locator('.tarot-meaning-card')).toHaveCount(78);
    await expect(page.locator('.tarot-meaning-card:visible')).toHaveCount(22);
    const columns = await page.locator('#major .tarot-meaning-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(width === 1440 ? 6 : 3);
    await fits(page); await accessible(page);
    // Load lazy images before capturing the expanded category.
    await page.locator('#major .tarot-meaning-card').last().scrollIntoViewIfNeeded();
    await page.evaluate(() => scrollTo(0,0));
    await page.screenshot({ path: `${output}/library-${width}.png`, fullPage: true });
    await page.screenshot({ path: `${output}/library-viewport-${width}.png` });
    await page.locator('[data-library-expand]').click();
    await expect(page.locator('.tarot-meaning-card:visible')).toHaveCount(78);
    if (width === 1440) await page.locator('[data-meaning-category="wands"]').click();
    else await page.locator('#tarot-category').selectOption('wands');
    await expect(page.locator('.tarot-meaning-card:visible')).toHaveCount(14);
    await page.locator('#tarot-card-search').fill('queen');
    await expect(page.locator('.tarot-meaning-card:visible')).toHaveCount(1);
    await expect(page).toHaveURL(/group=wands&q=queen/);
    await page.reload(); await ready(page);
    await expect(page.locator('.tarot-meaning-card:visible')).toHaveCount(1);
    await page.locator('.tarot-meaning-card:visible').click(); await ready(page);
    await expect(page.locator('h1')).toHaveText('THE QUEEN OF WANDS');
    await expect(page.locator('.tarot-card-facts')).toContainText('ไฟ');
    await expect(page.locator('.tarot-card-facts')).not.toContainText('ดาวเคราะห์');
    await expect(page.locator('.tarot-card-topics')).not.toContainText('สุขภาพ');
    await page.getByRole('link', { name: 'กลับไปหน้ารายการ', exact: true }).click(); await ready(page);
    await expect(page.locator('#tarot-card-search')).toHaveValue('queen');
    await expect(page.locator('#tarot-category')).toHaveValue('wands');
    await expect(page.locator('.tarot-meaning-card:visible')).toHaveCount(1);
    await page.locator('#tarot-card-search').fill('<unknown-card>');
    await expect(page.getByText('ไม่พบไพ่ที่ตรงกับคำค้น', { exact: true })).toBeVisible();
    await page.locator('[data-library-reset]').click();
    await expect(page.locator('#tarot-card-search')).toBeFocused();
    await expect(page.locator('.tarot-meaning-card:visible')).toHaveCount(22);
    await page.locator('.tarot-meaning-card[href="/tarot/meanings/the-fool/"]').click(); await ready(page);
    await expect(page.locator('h1')).toHaveText('THE FOOL');
    await expect(page.locator('.tarot-card-facts')).toContainText('Uranus');
    await expect(page.locator('.tarot-card-facts')).toContainText('ลม');
    await expect(page.locator('.tarot-detail-image img')).toBeVisible();
    expect(await page.locator('.tarot-detail-image img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(page.locator('.tarot-detail-disclosures details')).toHaveCount(4);
    await page.locator('.tarot-detail-disclosures summary').first().focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.tarot-detail-disclosures details').first()).toHaveAttribute('open', '');
    await page.keyboard.press('Enter');
    await page.locator('.tarot-detail-more summary').click();
    await expect(page.locator('.tarot-detail-expanded')).toContainText('คำถามทบทวนตัวเอง');
    await expect(page.locator('.tarot-detail-expanded a')).toHaveCount(3);
    await page.locator('.tarot-detail-more summary').click();
    await fits(page); await accessible(page);
    await page.evaluate(() => scrollTo(0,0));
    await page.screenshot({ path: `${output}/detail-${width}.png`, fullPage: true });
    await page.screenshot({ path: `${output}/detail-viewport-${width}.png` });
    await page.locator('.tarot-card-pagination a[rel="next"]').click(); await ready(page);
    await expect(page.locator('h1')).toHaveText('THE MAGICIAN');
    await page.locator('.tarot-card-pagination a[rel="prev"]').click(); await ready(page);
    await expect(page.locator('h1')).toHaveText('THE FOOL');
    await page.locator('.tarot-card-pagination a[rel="prev"]').click(); await ready(page);
    await expect(page.locator('h1')).toHaveText('THE KING OF PENTACLES');
    for (const size of [320,768,1024]) { await page.setViewportSize({ width: size,height:1000 }); await fits(page); }
    await page.goto('/tarot/meanings/?group=cups&q=king'); await ready(page);
    for (const size of [320,768,1024]) { await page.setViewportSize({ width: size,height:1000 }); await fits(page); }
    expect(errors).toEqual([]);
  });
}

test('existing category anchors, all-category search and draw-result entry survive', async ({ page }) => {
  await page.goto('/tarot/meanings/#swords'); await ready(page);
  await expect(page.locator('.tarot-meaning-card:visible')).toHaveCount(14);
  await expect(page.locator('#swords')).toHaveAttribute('open', '');
  await page.locator('[data-meaning-category="all"]').click();
  await page.locator('#tarot-card-search').fill('queen');
  await expect(page.locator('.tarot-meaning-card:visible')).toHaveCount(4);
  await page.locator('.tarot-meaning-card:visible').nth(2).click(); await ready(page);
  await page.getByRole('link', { name: 'กลับไปหน้ารายการ', exact: true }).click(); await ready(page);
  await expect(page.locator('.tarot-meaning-card:visible')).toHaveCount(4);
  await page.goto('/tarot/daily/result/?card=the-fool'); await ready(page);
  await expect(page.locator('.tarot-face-result img')).toBeVisible();
  await page.locator('.tarot-meaning-link').click(); await ready(page);
  await expect(page.locator('h1')).toHaveText('THE FOOL');
  await expect(page.locator('.tarot-card-prose').first()).toContainText('ความหมายโดยรวม');
});

test('library and detail remain readable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${test.info().project.use.baseURL || process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4363'}/tarot/meanings/`);
  await expect(page.locator('.tarot-meaning-card')).toHaveCount(78);
  await page.locator('#cups > summary').click();
  await expect(page.locator('#cups .tarot-meaning-card').first()).toBeVisible();
  await page.locator('#cups .tarot-meaning-card').first().click();
  await expect(page.locator('h1')).toHaveText('THE ACE OF CUPS');
  await page.locator('.tarot-detail-more summary').click();
  await expect(page.locator('.tarot-detail-expanded')).toBeVisible();
  await context.close();
});
