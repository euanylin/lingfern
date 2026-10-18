import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
const origin = 'http://127.0.0.1:8787';
const listening = process.argv.includes('--listening');
const skill = listening ? 'listening' : 'reading', term = listening ? 'game' : 'kitchen';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 375, height: 812 } });
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
async function rows(table) {
  return page.evaluate(table => new Promise((resolve, reject) => {
    const open = indexedDB.open('lingfern'); open.onerror = () => reject(open.error);
    open.onsuccess = () => { const db = open.result, request = db.transaction(table).objectStore(table).getAll(); request.onsuccess = () => { resolve(request.result); db.close(); }; request.onerror = () => reject(request.error); };
  }), table);
}
async function choose() {
  await page.evaluate(() => { const original = crypto.getRandomValues.bind(crypto); crypto.getRandomValues = values => values instanceof Uint32Array && values.length === 1 ? (values[0] = 0, values) : original(values); });
  await page.locator(`.corpus-practice[data-skill=${skill}]`).getByRole('button', { name: '开始', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 90000 });
  return page.getByRole('dialog').locator('h2').innerText();
}
try {
  await page.goto(origin + '/library'); await page.evaluate(() => navigator.serviceWorker.ready); await page.reload();
  await page.goto(origin + '/start');
  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: '跳过这一步', exact: true }).click();
  await page.getByRole('group', { name: '阅读', exact: true }).getByLabel(/^A1 ·/).check();
  if (listening) await page.getByRole('group', { name: '听力', exact: true }).getByLabel(/^C2 ·/).check();
  await page.getByRole('button', { name: '保存并继续', exact: true }).click();
  await page.getByRole('button', { name: '保存并前往今日', exact: true }).click();
  if (!listening) {
    await page.goto(origin + '/library');
    const corpus = page.locator('.package-row').filter({ hasText: '阅读语料' });
    await corpus.locator('input[type=checkbox]').check();
    await page.getByRole('button', { name: '下载所选资源', exact: true }).click();
    await expect(corpus).toContainText('已安装', { timeout: 90000 });
    await page.goto(origin + '/today');
  }
  const baseline = await choose();
  await page.getByRole('dialog').getByRole('button', { name: '关闭详情', exact: true }).click();
  await page.goto(origin + '/library/dictionary');
  await page.getByLabel('查询单词或短语').fill(term);
  await page.getByLabel('查询单词或短语').press('Enter');
  await expect(page.locator('.dictionary-results h3')).toHaveText(term);
  await page.getByRole('button', { name: /加入书签：/ }).first().click();
  await expect(page.locator('.dictionary-results .sense-star').first()).toHaveAttribute('aria-pressed', 'true');
  await page.goto(origin + '/library/saved');
  await page.getByRole('button', { name: '加入复习', exact: true }).click();
  await page.getByRole('button', { name: '显示词义', exact: true }).click();
  await page.getByRole('button', { name: '想起来了', exact: true }).click();
  await expect(page.getByText(/^下次复习:/)).toBeVisible();
  const item = (await rows('memories'))[0], reviews = await rows('memoryReviews');
  assert(item.reviewEnabled && item.card && reviews.length === 1);
  await page.clock.setFixedTime(new Date(new Date(item.card.due).getTime() + 1000));
  await context.setOffline(true);
  await page.goto(origin + '/today');
  const selected = await choose(); assert.notEqual(selected, baseline);
  await expect(page.getByRole('dialog').getByText('相关词汇', { exact: true })).toBeVisible();
  await page.screenshot({ path: `output/playwright/vocabulary-${skill}-detail-375-light-zh-Hans-offline.png` });
  await page.getByRole('dialog').locator('button[data-mode=practice]').click();
  await expect(page).toHaveURL(/\/learn\//);
  const session = (await rows('sessions'))[0];
  assert(new RegExp(`\\b${term}\\b`, 'i').test(session.lesson.materials[0].blocks.map(block => block.text).join('\n')));
  assert.equal(new Set(session.lesson.materials.map(material => material.rootId)).size, 2);
  assert.deepEqual(await rows('memoryReviews'), reviews);
  assert.deepEqual((await rows('memories'))[0].card, item.card);
  assert.equal((await rows('attempts')).length, 0);
  await page.screenshot({ path: `output/playwright/vocabulary-${skill}-375-light-zh-Hans-offline.png` });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.goto(origin + '/today'); await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  assert.deepEqual(errors, []);
  console.log('PASS: actual dictionary sense saved and opted in, explicit FSRS rating, simulated due time selects related vocabulary context offline with distinct roots; no implicit memory rating or response; 375px layout and Today. Lexical context selection does not prove general sense disambiguation.');
} finally { await context.close(); await browser.close(); }
