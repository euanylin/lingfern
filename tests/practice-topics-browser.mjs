import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
const origin = 'http://127.0.0.1:8787';
const reportPath = 'private/verification/practice-topics-browser-20261011.json';
mkdirSync('private/verification', { recursive: true });
mkdirSync('output/playwright', { recursive: true });
if (existsSync(reportPath)) copyFileSync(reportPath, reportPath.replace('.json', `-previous-${Date.now()}.json`));
const catalogue = JSON.parse(readFileSync('content/source-packs.json', 'utf8')).packs;
const sha = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const report = { date: new Date().toISOString(), scope: 'Fresh real UI A1 reading/listening daily-life and B1 reading technology topic selection and core/IPA installation; unchanged active snapshot via Continue; complete offline Practice/Test; three locales/two themes/two widths across three plans; B1 technology-only actual ZIP transfer and installed-bank hashes.', layouts: [], cases: [], errors: [], failures: [], untested: ['B1 technology exact text eligibility requires separate source audit', 'Physical-device audio and screen readers', 'Actual auditory/source acceptance', 'Production/mainland networks'] };
const saveReport = () => writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
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
async function noHelpers(page) { await expect(page.locator('.check-intro,.check-end,.hint,.teaching,.selection-dictionary,.selection-dictionary-menu,.ai-handoff,.self-assessment')).toHaveCount(0); }
async function finish(page, session) {
 const testing = session.lesson.mode === 'test', items = session.lesson.materials.flatMap(material => material.questions.map(question => ({ material, question })));
 await page.goto(origin + '/learn/' + session.id);
 for (const [index, item] of items.entries()) {
  await expect(page.getByRole('heading', { name: item.question.prompt, exact: true, includeHidden: true })).toBeAttached(); await pane(page); await expect(page.locator('.question-panel h2').first()).toHaveText(item.question.prompt); await expect(page.locator('.session-meta')).toHaveCount(0); await expect(page.locator('.session-header')).not.toContainText(/\b(?:[ABC][12]|CEFR)\b/);
  if (testing) await noHelpers(page);
  await answer(page, item.question, item.material);
  if (session.lesson.skill === 'listening') { await expect(page.locator('.audio-timeline input[type=range]')).toBeVisible(); await expect(page.getByRole('button', { name: '保存答案', exact: true })).toBeDisabled(); await page.getByRole('button', { name: '播放 / 重听', exact: true }).click(); await expect(page.getByText('录音已播放，可以选择并保存。', { exact: true })).toBeVisible(); }
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await expect(page.locator('.feedback')).toBeVisible();
  if (testing) { await noHelpers(page); if (index < items.length - 1) { await expect(page.locator('.check-result')).toHaveCount(0); await expect(page.getByText('作答已保存。测试结束后显示答案。', { exact: true })).toBeVisible(); } else await expect(page.locator('.check-result')).toHaveCount(items.length); }
  await page.reload(); await expect(page.getByRole('heading', { name: item.question.prompt, exact: true, includeHidden: true })).toBeAttached(); await pane(page); await expect(page.locator('.session-meta')).toHaveCount(0); await expect(page.locator('.session-header')).not.toContainText(/\b(?:[ABC][12]|CEFR)\b/); await expect(page.locator('.feedback')).toBeVisible();
  const saved = (await rows(page, 'attempts')).filter(attempt => attempt.sessionId === session.id);
  assert.equal(saved.length, index + 1); assert.equal(new Set(saved.map(attempt => attempt.questionId)).size, index + 1);
  if (testing) { await noHelpers(page); await expect(page.locator('.check-result')).toHaveCount(index === items.length - 1 ? items.length : 0); }
  if (index < items.length - 1) { await page.getByRole('button', { name: '下一题', exact: true }).click(); await expect(page.locator('.feedback')).toHaveCount(0); }
 }
 if (!testing) await expect(page.getByRole('heading', { name: session.lesson.skill === 'listening' ? '听力任务已保存' : '阅读任务已保存', exact: true })).toBeVisible();
 const savedSession = (await rows(page, 'sessions')).find(row => row.id === session.id), attempts = (await rows(page, 'attempts')).filter(row => row.sessionId === session.id);
 assert.equal(savedSession.status, 'completed'); assert.equal(attempts.length, items.length); assert.equal(new Set(attempts.map(row => row.rootId)).size, 2);
 for (const attempt of attempts) { const question = items.find(item => item.question.id === attempt.questionId).question; assert.equal(attempt.correct, question.kind === 'response' ? null : true); if (testing) assert(attempt.assistance.hintLevel === 0 && !attempt.assistance.dictionaryUsed && !attempt.assistance.teachingProvided); }
 return { session: savedSession, attempts, reloadedFinalUi: true };
}
const section = (page, skill) => page.locator(`.corpus-practice[data-skill=${skill}]`);
const picker = (page, skill) => section(page, skill).locator('.setting-trigger');
async function topic(page, skill, value) { await picker(page, skill).click(); await section(page, skill).getByRole('listbox').locator(`[data-value="${value}"]`).click(); await expect(picker(page, skill)).toHaveAttribute('data-value', value); }
async function settings(page, locale, theme) {
 await page.goto(origin + '/settings'); await page.getByRole('button', { name: /^(语言|語言|Language)$/ }).click(); await page.getByRole('listbox').locator(`[data-value="${locale}"]`).click();
 await page.getByRole('button', { name: /^(外观|外觀|Appearance)$/ }).click(); await page.getByRole('listbox').locator(`[data-value="${theme}"]`).click(); await expect(page.locator('html')).toHaveAttribute('lang', locale); await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}
try {
 for (const { skill, level, chosenTopic } of [{ skill: 'reading', level: 'A1', chosenTopic: 'daily-life' }, { skill: 'listening', level: 'A1', chosenTopic: 'daily-life' }, { skill: 'reading', level: 'B1', chosenTopic: 'technology' }]) {
  const { context, page } = await newProfile(); const item = { skill, level, chosenTopic, downloads: [], sessions: [], results: [] }; report.cases.push(item); saveReport();
  const transfers = [];
  page.on('response', response => {
   if (!/\/(?:source-packs|ipa|audio)\//.test(response.url())) return;
   const transfer = { url: response.url(), status: response.status() }; item.downloads.push(transfer);
   if (response.url().includes('/source-packs/') && response.status() === 200) transfers.push(response.body().then(bytes => {
    const entry = catalogue.find(pack => pack.path === new URL(response.url()).pathname); assert(entry); assert.equal(entry.topic, chosenTopic); transfer.bytes = bytes.length; transfer.sha256 = createHash('sha256').update(bytes).digest('hex'); transfer.packId = entry.id; transfer.topic = entry.topic; assert.equal(transfer.bytes, entry.bytes); assert.equal(transfer.sha256, entry.sha256);
   }).catch(error => { transfer.failure = error.message; }));
  });
  await onboarding(page, level); assert.equal((await rows(page, 'sessions')).length, 0); assert.equal((await rows(page, 'attempts')).length, 0); assert.equal((await rows(page, 'exposures')).length, 0);
  await page.goto(origin + '/library'); await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated'); await page.reload();
  for (const label of ['阅读语料', 'IPA 发音与录音']) await page.locator('.package-row').filter({ hasText: label }).getByRole('checkbox').check();
  await page.getByRole('button', { name: '下载所选资源', exact: true }).click();
  for (const label of ['阅读语料', 'IPA 发音与录音']) await expect(page.locator('.package-row').filter({ hasText: label })).toContainText('已安装', { timeout: 90000 });
  for (const locale of ['zh-Hans', 'zh-Hant', 'en']) for (const theme of ['light', 'dark']) for (const width of [320, 1440]) {
   await page.setViewportSize({ width, height: width === 320 ? 640 : 900 }); await page.emulateMedia({ reducedMotion: width === 320 ? 'reduce' : 'no-preference' }); await settings(page, locale, theme); await page.goto(origin + '/today');
   const control = picker(page, skill); await control.scrollIntoViewIfNeeded(); await control.focus(); await page.keyboard.press('Home');
   const menu = section(page, skill).getByRole('listbox'); await expect(menu).toBeVisible(); for (let step = 0; step < (chosenTopic === 'technology' ? 6 : 2); step++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await expect(control).toHaveAttribute('data-value', chosenTopic); await expect(control).toBeFocused();
   await control.click(); await expect(menu).toBeVisible();
   for (const target of [control, ...await menu.getByRole('option').all()]) { const box = await target.boundingBox(); assert(box && box.width >= 44 && box.height >= 44); }
   assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); if (width === 320 && locale === 'en' && theme === 'dark') await page.screenshot({ path: `output/playwright/topic-${skill}-${level}-en-dark-320x640.png` }); await page.keyboard.press('Escape'); await expect(menu).toHaveCount(0); await expect(control).toBeFocused();
   report.layouts.push({ skill, level, topic: chosenTopic, locale, theme, width, height: width === 320 ? 640 : 900, reducedMotion: width === 320, keyboardSelection: true, touchTargets: true, overflow: false }); saveReport();
  }
  await settings(page, 'zh-Hans', 'dark'); await page.setViewportSize({ width: 375, height: 812 }); await page.goto(origin + '/today');
  if (skill === 'listening') {
   await topic(page, skill, 'science'); const priorDownloads = item.downloads.length; await section(page, skill).getByRole('button', { name: '开始', exact: true }).click(); await expect(section(page, skill).getByRole('status')).toContainText('这个主题暂无适用材料。'); assert.equal((await rows(page, 'sessions')).length, 0); assert.equal(item.downloads.length, priorDownloads); item.unsupportedTopic = { topic: 'science', noSession: true, noAudioDownload: true };
   await topic(page, skill, ''); await section(page, skill).getByRole('button', { name: '开始', exact: true }).click(); await expect(page.locator('dialog.task-detail')).toBeVisible(); await page.keyboard.press('Escape'); await expect(page.locator('dialog.task-detail')).toHaveCount(0); item.automaticAfterEmpty = true;
  }
  assert.equal((await rows(page, 'communityPacks')).length, 0);
  await topic(page, skill, chosenTopic); await section(page, skill).getByRole('button', { name: '开始', exact: true }).click(); const dialog = page.locator('dialog.task-detail'); await expect(dialog).toBeVisible({ timeout: 90000 }); await expect(dialog.locator('.eyebrow').first()).not.toContainText(/\b(?:[ABC][12]|CEFR)\b/);
  await Promise.all(transfers); assert(!item.downloads.some(transfer => transfer.failure));
  const installed = await rows(page, 'communityPacks'); item.installedPackages = installed.map(pack => ({ id: pack.id, hash: pack.hash, state: pack.state, sourceBankHash: sha(pack.corpus ?? pack.spoken), roots: (pack.corpus ?? pack.spoken)?.records.map(record => record.rootId) }));
  if (level === 'B1') { assert.equal(installed.length, 1); for (const pack of installed) { const entry = catalogue.find(entry => entry.id === pack.id); assert(entry); assert.equal(entry.topic, 'technology'); assert.equal(pack.hash, entry.sha256); assert.equal(pack.state, 'ready'); } assert(item.downloads.some(transfer => transfer.topic === 'technology' && transfer.sha256)); }
  else { assert.equal(installed.length, 0); assert(!item.downloads.some(transfer => transfer.url.includes('/source-packs/'))); }
  assert.equal((await rows(page, 'sessions')).length, 0); assert.equal((await rows(page, 'exposures')).length, 0); await dialog.locator('[data-mode=practice]').click(); await pane(page);
  const practice = (await rows(page, 'sessions'))[0]; assert.equal(practice.lesson.skill, skill); assert.equal(practice.lesson.generation.startingPoint, level); assert.equal(new Set(practice.lesson.materials.map(material => material.rootId)).size, 2);
  await page.goto(origin + '/today'); const contacts = await rows(page, 'exposures'); await section(page, skill).getByRole('button', { name: '开始', exact: true }).click(); await expect(dialog).toBeVisible(); await expect(dialog.locator('.eyebrow').first()).not.toContainText(/\b(?:[ABC][12]|CEFR)\b/); assert.deepEqual(await rows(page, 'exposures'), contacts); await dialog.locator('[data-mode=test]').click(); await pane(page); await noHelpers(page);
  const sessions = await rows(page, 'sessions'); assert.equal(sessions.length, 2); const test = sessions.find(session => session.lesson.mode === 'test'); const expected = structuredClone(practice.lesson); expected.mode = 'test'; delete expected.teaching; delete expected.workedExample; delete expected.nextStep; for (const material of expected.materials) for (const question of material.questions) { delete question.hints; if ('criteria' in question) delete question.modelAnswer; } assert.deepEqual(test.lesson, expected);
  item.unchangedTopicContinueRetainedSnapshot = true; item.sessions = [practice, test]; saveReport(); await context.setOffline(true); item.results.push(await finish(page, practice)); item.results.push(await finish(page, test)); assert.equal((await rows(page, 'sessions')).length, 2); await context.close(); saveReport();
 }
 assert.deepEqual(report.errors, []); assert.equal(report.layouts.length, 36); report.passed = true;
} catch (error) { report.passed = false; report.failures.push({ message: error.message, stack: error.stack }); throw error; }
finally { saveReport(); await browser.close(); }
console.log(JSON.stringify({ passed: report.passed, layouts: report.layouts.length, completeModes: report.cases.reduce((sum, item) => sum + item.results.length, 0) }));
