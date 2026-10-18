import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
const origin = 'http://127.0.0.1:8787';
const reportPath = 'private/verification/topic-refresh-browser-20261012.json';
mkdirSync('private/verification', { recursive: true });
mkdirSync('output/playwright', { recursive: true });
if (existsSync(reportPath)) copyFileSync(reportPath, reportPath.replace('.json', `-previous-${Date.now()}.json`));
const report = { date: new Date().toISOString(), scope: 'Topic changes create fresh reading, listening and combined sessions; unchanged Continue, unavailable topics, preview cancellation and old answers retained in isolated profiles.', cases: [], layouts: [], errors: [], failures: [] };
const saveReport = () => writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
const runtime = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const { corpusInterestMatch } = await runtime.ssrLoadModule('/src/core/corpusPractice.ts');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
async function newProfile() {
 const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 375, height: 812 }, acceptDownloads: true });
 const page = await context.newPage();
 page.on('pageerror', error => report.errors.push(error.message));
 await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
 return { context, page };
}
const rows = (page, table) => page.evaluate(table => new Promise((resolve, reject) => {
 const open = indexedDB.open('lingfern'); open.onerror = () => reject(open.error);
 open.onsuccess = () => { const db = open.result, query = db.transaction(table).objectStore(table).getAll(); query.onsuccess = () => { resolve(query.result); db.close(); }; query.onerror = () => { reject(query.error); db.close(); }; };
}), table);
async function onboarding(page, level) {
 await page.goto(origin + '/start');
 for (let step = 0; step < 3; step++) { await page.getByRole('button', { name: '跳过这一步', exact: true }).click(); await expect(page.getByText(`第 ${step + 2} 步，共 5 步`, { exact: true })).toBeVisible(); }
 await page.getByRole('group', { name: '阅读', exact: true }).getByLabel(new RegExp('^' + level + ' ·')).check();
 await page.getByRole('group', { name: '听力', exact: true }).getByLabel(/^A1 ·/).check();
 await page.getByRole('button', { name: '保存并继续', exact: true }).click();
 await page.getByRole('button', { name: '保存并前往今日', exact: true }).click();
 await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
}
async function pane(page) {
 await expect(page.locator('.question-panel')).toBeVisible();
 const toggle = page.locator('.question-sheet-toggle');
 if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
 await expect(page.locator('.question-panel h2').first()).toBeVisible();
}
async function answer(page, question, material) {
 if ('options' in question) await page.getByRole('radio', { name: question.options[question.answer], exact: true }).check();
 else if (question.kind === 'completion') await page.locator('.completion-answer input').fill(question.answer);
 else if (question.kind === 'table') for (const [index, row] of question.rows.entries()) await page.locator('.answer-table input').nth(index).fill(row.answer);
 else if (question.kind === 'matching') for (const pair of question.pairs) { await page.getByRole('button', { name: pair.label, exact: true }).click(); await page.getByRole('listbox', { name: pair.label, exact: true }).getByRole('option', { name: pair.answer, exact: true }).click(); }
 else if (question.kind === 'sequence') for (const step of question.acceptedOrders[0]) await page.locator('.sequence-choices button').filter({ hasText: step }).click();
 else if (question.kind === 'evidence') await page.locator('.evidence-option input').nth(question.accepted[0]).check();
 else if (question.kind === 'response') await page.locator('.response-answer textarea').fill('The source says: ' + material.blocks.find(block => block.id === question.blockId).text.slice(question.evidence.start, question.evidence.end));
 else throw new Error('Unsupported question kind');
}
const section = (page, skill) => page.locator(`.practice-card[data-skill=${skill}]`);
const picker = (page, skill) => section(page, skill).locator('.setting-trigger');
async function topic(page, skill, value) { await picker(page, skill).click(); await section(page, skill).getByRole('listbox').locator(`[data-value="${value}"]`).click(); await expect(picker(page, skill)).toHaveAttribute('data-value', value); }

async function settings(page, locale, theme) {
 await page.goto(origin + '/settings'); await page.getByRole('button', { name: /^(语言|語言|Language)$/ }).click(); await page.getByRole('listbox').locator(`[data-value="${locale}"]`).click();
 await page.getByRole('button', { name: /^(外观|外觀|Appearance)$/ }).click(); await page.getByRole('listbox').locator(`[data-value="${theme}"]`).click(); await expect(page.locator('html')).toHaveAttribute('lang', locale); await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}
try {
 for (const skill of ['reading', 'listening', 'combined']) {
  const { context, page } = await newProfile();
  const item = { skill }; report.cases.push(item);
  await onboarding(page, 'A1');
  await page.goto(origin + '/library');
  for (const label of ['阅读语料', 'IPA 发音与录音']) await page.locator('.package-row').filter({ hasText: label }).getByRole('checkbox').check();
  await page.getByRole('button', { name: '下载所选资源', exact: true }).click();
  for (const label of ['阅读语料', 'IPA 发音与录音']) await expect(page.locator('.package-row').filter({ hasText: label })).toContainText('已安装', { timeout: 90000 });
  await page.goto(origin + '/today');
  const card = section(page, skill), dialog = page.locator('dialog.task-detail');
  await card.getByRole('button', { name: '开始', exact: true }).click();
  await expect(dialog).toBeVisible({ timeout: 90000 });
  await dialog.locator('[data-mode=practice]').click(); await pane(page);
  const old = await rows(page, 'sessions');
  const first = old.find(session => session.lesson.skill === (skill === 'combined' ? 'reading' : skill));
  const material = first.lesson.materials[0], question = material.questions[0];
  await answer(page, question, material);
  if (first.lesson.skill === 'listening') {
   await page.getByRole('button', { name: '播放 / 重听', exact: true }).click();
   await expect(page.getByText('录音已播放，可以选择并保存。', { exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await expect(page.locator('.feedback')).toBeVisible();
  const saved = await rows(page, 'sessions'), attempts = await rows(page, 'attempts');
  await page.goto(origin + '/today');
  await card.getByRole('button', { name: '继续', exact: true }).click();
  await expect(dialog).toBeVisible(); await page.keyboard.press('Escape');
  assert.deepEqual(await rows(page, 'sessions'), saved);
  const choose = async value => {
   if (skill !== 'combined') return topic(page, skill, value);
   const control = card.locator('.setting-trigger').first();
   await control.click(); await card.getByRole('listbox').locator(`[data-value="${value}"]`).click();
   await expect(control).toHaveAttribute('data-value', value);
  };
  if (skill === 'listening') {
   await choose('science');
   await card.getByRole('button', { name: '开始', exact: true }).click();
   await expect(page.getByRole('status')).toContainText('这个主题暂无适用材料。');
   assert.deepEqual(await rows(page, 'sessions'), saved);
  }
  await choose('daily-life');
  await expect(card.getByRole('button', { name: '开始', exact: true })).toBeVisible();
  await card.getByRole('button', { name: '开始', exact: true }).click();
  await expect(dialog).toBeVisible({ timeout: 90000 });
  await page.keyboard.press('Escape');
  assert.deepEqual(await rows(page, 'sessions'), saved); assert.deepEqual(await rows(page, 'attempts'), attempts);
  // Clear the cancelled preview's reservations by changing the topic again.
  await choose(''); await choose('daily-life');
  await card.getByRole('button', { name: '开始', exact: true }).click();
  await expect(dialog).toBeVisible({ timeout: 90000 });
  await dialog.locator('[data-mode=practice]').click(); await pane(page);
  const refreshed = await rows(page, 'sessions');
  assert.equal(refreshed.length, saved.length + (skill === 'combined' ? 2 : 1));
  for (const session of saved) assert.deepEqual(refreshed.find(row => row.id === session.id), session);
  assert.deepEqual(await rows(page, 'attempts'), attempts);
  const added = refreshed.filter(row => !saved.some(session => session.id === row.id));
  for (const session of added) {
   assert(!saved.some(old => old.lesson.id === session.lesson.id));
   if (session.lesson.skill === 'reading') for (const material of session.lesson.materials) assert(corpusInterestMatch(material.title + '\n' + material.blocks.map(block => block.text).join('\n'), ['daily-life']));
  }
  item.oldSessions = saved.map(row => row.id); item.newSessions = added.map(row => row.id); item.retainedAnswers = attempts.length; item.cancelPreserved = true; item.unchangedContinue = true;
  await page.goto(origin + '/today'); await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  assert.equal((await page.request.get(origin + '/sw.js')).status(), 200);
  if (skill === 'combined') {
   const listeningTopic = card.locator('.setting-trigger').nth(1);
   await listeningTopic.click(); await card.getByRole('listbox').locator('[data-value="daily-life"]').click();
   await card.getByRole('button', { name: '开始', exact: true }).click(); await expect(dialog).toBeVisible();
   await dialog.locator('[data-mode=test]').click(); await pane(page);
   const tested = await rows(page, 'sessions'), testPair = tested.filter(row => !refreshed.some(previous => previous.id === row.id));
   assert.equal(testPair.length, 2); assert(testPair.every(row => row.lesson.mode === 'test' && !row.lesson.teaching && !row.lesson.workedExample));
   for (const session of refreshed) assert.deepEqual(tested.find(row => row.id === session.id), session);
   assert.deepEqual(await rows(page, 'attempts'), attempts); item.changedListeningTestPair = testPair.map(row => row.id);
  }
  for (const locale of ['zh-Hans', 'zh-Hant', 'en']) for (const theme of ['light', 'dark']) for (const width of [375, 1440]) {
   await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
   await page.emulateMedia({ reducedMotion: width === 375 ? 'reduce' : 'no-preference' });
   await settings(page, locale, theme); await page.goto(origin + '/today');
   const control = card.locator('.setting-trigger').first();
   await choose(await control.getAttribute('data-value') === 'daily-life' ? '' : 'daily-life');
   const action = card.getByRole('button', { name: locale === 'en' ? 'Start' : locale === 'zh-Hant' ? '開始' : '开始', exact: true });
   await expect(action).toBeVisible();
   for (const target of [control, action]) { const box = await target.boundingBox(); assert(box && box.width >= 44 && box.height >= 44); }
   assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
   report.layouts.push({ skill, locale, theme, width, reducedMotion: width === 375, startAfterTopicChange: true, touchTargets: true });
  }

  await context.close(); saveReport();
 }
 assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) { report.passed = false; report.failures.push({ message: error.message, stack: error.stack }); throw error; }
finally { saveReport(); await browser.close(); await runtime.close(); }
console.log(JSON.stringify({ passed: report.passed, cases: report.cases.length, layouts: report.layouts.length }));
