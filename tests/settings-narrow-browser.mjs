import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8787/settings');
  for (const locale of ['en', 'zh-Hans', 'zh-Hant']) {
  const language = page.locator('.settings-preferences .setting-trigger').first();
  await language.click();
  await page.locator(`[role=option][data-value="${locale}"]`).click();
  await page.getByRole('heading', { name: { en: 'Settings', 'zh-Hans': '设置', 'zh-Hant': '設定' }[locale], exact: true }).waitFor();
  for (const width of [320, 375, 768, 1024]) {
    await page.setViewportSize({ width, height: 812 });
    for (const scale of ['100%', '200%']) {
      await page.evaluate(scale => { document.documentElement.style.fontSize = scale; }, scale);
      const triggers = page.locator('.settings-preferences .setting-trigger');
      for (const trigger of await triggers.all()) {
        const value = trigger.locator('span').first();
        const row = trigger.locator('..');
        const label = await row.locator(':scope > span').boundingBox();
        const rowBox = await row.boundingBox();
        const bounds = await trigger.boundingBox();
        const required = await row.evaluate(el => { const text = el.querySelector(':scope > span'); const button = el.querySelector('button'); return text.offsetWidth + button.offsetWidth + 12 + 30; });
        if (required > rowBox.width + 1) assert(bounds.y >= label.y + label.height - 1, 'Insufficient space must wrap the control');
        else assert(bounds.y < label.y + label.height, 'Fitting controls must stay inline');
        assert.equal(await value.evaluate(el => getComputedStyle(el).overflow), 'visible');
        const button = await trigger.boundingBox(), text = await value.boundingBox();
        assert(text.x >= button.x - 1 && text.x + text.width <= button.x + button.width + 1);
        await trigger.click();
        const menu = page.locator('.setting-menu');
        const box = await menu.boundingBox();
        assert(box.x >= 0 && box.x + box.width <= width + 1);
        assert.equal(await menu.evaluate(el => el.scrollWidth > el.clientWidth), false);
        await page.keyboard.press('Escape');
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  }
  await page.setViewportSize({ width: 320, height: 812 });
  await page.screenshot({ path: '/tmp/lingfern-settings-en-320.png', fullPage: true });
  await page.goto('http://127.0.0.1:8787/today');
  await page.getByRole('heading', { name: '今日', exact: true }).waitFor();
  console.log('PASS: All three locales automatically wrap only when needed at four widths and100/200% text; 今日 rendered.');
} finally { await browser.close(); }
