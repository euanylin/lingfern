import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  for (const width of [1440, 1200, 1024, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('http://127.0.0.1:8787/today');
    await page.getByRole('heading', { name: '今日', exact: true }).waitFor();
    const nav = page.locator(width <= 767 ? '.mobile-nav' : '.desktop-nav');
    assert.equal(await nav.locator('a').count(), 3);
    assert.equal(await nav.locator('a[href="/tasks"], a[href="/progress"]').count(), 0);
    assert.equal(await page.locator('.primary-task a[href="/library"]').count(), 0);
    assert.equal(await page.locator('#today-records').count(), 0);
    const link = page.getByRole('link', { name: '历史记录', exact: true });
    const entry = await link.boundingBox(), reading = await page.locator('.reading-task').boundingBox();
    assert(entry.x + entry.width <= reading.x + reading.width + 1);
    assert(entry.y >= reading.y && entry.y <= reading.y + 24);
    const listening = await page.locator('.primary-task').nth(1).boundingBox(), hero = await page.locator('.today-hero').boundingBox();
    if (width >= 768) {
      assert(Math.abs(reading.x - listening.x) < 1);
      assert(listening.y >= reading.y + reading.height);
      assert(hero.x >= reading.x + reading.width);
      const symmetry = await page.evaluate(() => {
        const layout = document.querySelector('.today-layout').getBoundingClientRect();
        const fern = document.querySelector('.today-hero .fern').getBoundingClientRect();
        const middle = layout.x + layout.width / 2, distance = fern.x + fern.width / 2 - middle;
        return [...document.querySelectorAll('.today-grid .primary-task')].map(task => {
          const range = document.createRange(); range.selectNodeContents(task.querySelector('h2'));
          const title = range.getBoundingClientRect(), button = task.querySelector('.primary').getBoundingClientRect();
          const history = task.querySelector('.records-link')?.getBoundingClientRect();
          return { title: middle - (title.x + title.width / 2) - distance,
            button: middle - (button.x + button.width / 2) - distance,
            overlap: !!history && title.x < history.right && title.right > history.x && title.y < history.bottom && title.bottom > history.y };
        });
      });
      for (const item of symmetry) { assert(Math.abs(item.title) <= 1); assert(Math.abs(item.button) <= 1); assert(!item.overlap); }
    } else {
      // Check mobile fern/quote output because display:contents merges the hero.
      const fern = await page.locator('.today-hero .fern').boundingBox();
      const quote = await page.locator('.daily-quote').boundingBox();
      assert(fern && quote && fern.y + fern.height <= quote.y && quote.y + quote.height <= reading.y);
    }
    await link.click();
    await page.locator('#today-records').waitFor();
    assert.equal(new URL(page.url()).pathname, '/progress');
    assert.equal(await page.getByRole('heading', { name: '记录', exact: true }).count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.locator('.records-back').click();
    await page.getByRole('heading', { name: '今日', exact: true }).waitFor();
  }
  await page.goto('http://127.0.0.1:8787/today');
  await page.getByRole('heading', { name: '今日', exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/today');
  await page.goto('http://127.0.0.1:8787/progress');
  await page.locator('#today-records').waitFor();
  assert.equal(new URL(page.url()).pathname, '/progress');
  console.log('PASS: three navigation entries; compact record link opens a page; no separate library CTA; six widths; direct Today and History routes.');
} finally { await browser.close(); }
