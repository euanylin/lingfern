import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';

const origin = 'http://127.0.0.1:8787';
const reportPath = 'private/verification/today-full-flow-browser-20261011.json';
mkdirSync('private/verification', { recursive: true });
if (existsSync(reportPath)) copyFileSync(reportPath, reportPath.replace('.json', `-previous-${Date.now()}.json`));
const sourceCatalogue = JSON.parse(readFileSync('content/source-packs.json', 'utf8'));
const digest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const report = { date: new Date().toISOString(), scope: 'Fresh isolated A1/B1 reading profiles; UI onboarding, real core downloads and B1 automatic topic installation, native Today preview and same-snapshot Practice/Test, complete offline transactions and UI backup import. No RNG replacement or database writes by the runner.', cases: [], errors: [], failures: [], untested: ['Physical devices/screen readers', 'Listening/auditory acceptance', 'Real GitHub/two-device/MCP', 'Mainland networks/production'] };
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
 await page.getByRole('button', { name: '保存并继续', exact: true }).click();
 await page.getByRole('button', { name: '保存并前往今日', exact: true }).click();
 await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
}
async function pane(page) {
 await expect(page.locator('.question-panel')).toBeVisible();
 const toggle = page.locator('.question-sheet-toggle');
 if (await toggle.count() && await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
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
  await answer(page, item.question, item.material); await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await expect(page.locator('.feedback')).toBeVisible();
  if (testing) { await noHelpers(page); if (index < items.length - 1) { await expect(page.locator('.check-result')).toHaveCount(0); await expect(page.getByText('作答已保存。测试结束后显示答案。', { exact: true })).toBeVisible(); } else await expect(page.locator('.check-result')).toHaveCount(items.length); }
  await page.reload(); await expect(page.getByRole('heading', { name: item.question.prompt, exact: true, includeHidden: true })).toBeAttached(); await pane(page); await expect(page.locator('.session-meta')).toHaveCount(0); await expect(page.locator('.session-header')).not.toContainText(/\b(?:[ABC][12]|CEFR)\b/); await expect(page.locator('.feedback')).toBeVisible();
  const saved = (await rows(page, 'attempts')).filter(attempt => attempt.sessionId === session.id);
  assert.equal(saved.length, index + 1); assert.equal(new Set(saved.map(attempt => attempt.questionId)).size, index + 1);
  if (testing) { await noHelpers(page); await expect(page.locator('.check-result')).toHaveCount(index === items.length - 1 ? items.length : 0); }
  if (index < items.length - 1) { await page.getByRole('button', { name: '下一题', exact: true }).click(); await expect(page.locator('.feedback')).toHaveCount(0); }
 }
 if (!testing) await expect(page.getByRole('heading', { name: '阅读任务已保存', exact: true })).toBeVisible();
 const savedSession = (await rows(page, 'sessions')).find(row => row.id === session.id), attempts = (await rows(page, 'attempts')).filter(row => row.sessionId === session.id);
 assert.equal(savedSession.status, 'completed'); assert.equal(attempts.length, items.length); assert.equal(new Set(attempts.map(row => row.rootId)).size, 2);
 for (const attempt of attempts) { const question = items.find(item => item.question.id === attempt.questionId).question; assert.equal(attempt.correct, question.kind === 'response' ? null : true); if (testing) assert(attempt.assistance.hintLevel === 0 && !attempt.assistance.dictionaryUsed && !attempt.assistance.teachingProvided); }
 return { session: savedSession, attempts, reloadedFinalUi: true };
}
try {
 for (const level of ['A1', 'B1']) {
  const { context, page } = await newProfile(), item = { level, downloads: [], sessions: [], results: [] }; report.cases.push(item); saveReport();
  const downloadChecks = [];
  page.on('response', response => {
   if (!/\/(?:corpus|source-packs|resources)\//.test(response.url())) return;
   const transfer = { url: response.url(), status: response.status() }; item.downloads.push(transfer);
   if (response.url().includes('/source-packs/') && response.status() === 200) downloadChecks.push(response.body().then(bytes => {
    transfer.bytes = bytes.length; transfer.sha256 = createHash('sha256').update(bytes).digest('hex');
    const entry = sourceCatalogue.packs.find(pack => pack.path === new URL(response.url()).pathname); assert(entry);
    assert.equal(transfer.bytes, entry.bytes); assert.equal(transfer.sha256, entry.sha256);
   }).catch(error => { transfer.failure = error.message; }));
  });
  await onboarding(page, level); assert.equal((await rows(page, 'sessions')).length, 0); assert.equal((await rows(page, 'attempts')).length, 0); assert.equal((await rows(page, 'exposures')).length, 0);
  await page.goto(origin + '/library'); await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated'); await page.reload();
  const core = page.locator('.package-row').filter({ hasText: '阅读语料' }); await core.getByRole('checkbox').check(); await page.getByRole('button', { name: '下载所选资源', exact: true }).click(); await expect(core).toContainText('已安装', { timeout: 90000 });
  const before = await rows(page, 'communityPacks'); assert.equal(before.length, 0);
  await page.goto(origin + '/today'); await page.locator('.corpus-practice[data-skill=reading]').getByRole('button', { name: '开始', exact: true }).click();
  const dialog = page.locator('dialog.task-detail'); await expect(dialog).toBeVisible({ timeout: 90000 }); await expect(dialog.locator('.eyebrow').first()).not.toContainText(/\b(?:[ABC][12]|CEFR)\b/); await expect(dialog.locator('[data-mode=practice]')).toBeEnabled(); await expect(dialog.locator('[data-mode=test]')).toBeEnabled();
  const installed = await rows(page, 'communityPacks'); item.installedPackages = installed.map(pack => ({ id: pack.id, hash: pack.hash, state: pack.state, sourceBankHash: digest(pack.corpus ?? pack.spoken), roots: (pack.corpus ?? pack.spoken)?.records.map(source => source.rootId) }));
  await Promise.all(downloadChecks); assert(!item.downloads.some(transfer => transfer.failure)); assert.equal((await rows(page, 'sessions')).length, 0); assert.equal((await rows(page, 'attempts')).length, 0); assert.equal((await rows(page, 'exposures')).length, 0); item.freshPreviewNoRecords = true;
  const topicDownloads = item.downloads.filter(row => row.url.includes('/source-packs/'));
  if (level === 'A1') { assert.equal(topicDownloads.length, 0); assert.equal(installed.length, 0); }
  else { assert(topicDownloads.some(row => row.status === 200)); assert.equal(installed.length, 1); assert.equal(installed[0].state, 'ready'); }
  await dialog.locator('[data-mode=practice]').click(); await pane(page); let sessions = await rows(page, 'sessions'); assert.equal(sessions.length, 1); const practice = sessions[0]; assert(!practice.lesson.mode); assert.equal(practice.lesson.generation.startingPoint, level);
  const beforeContinueExposures = await rows(page, 'exposures');
  await page.goto(origin + '/today'); await page.locator('.corpus-practice[data-skill=reading]').getByRole('button', { name: '继续', exact: true }).click(); await expect(dialog).toBeVisible(); await expect(dialog.locator('.eyebrow').first()).not.toContainText(/\b(?:[ABC][12]|CEFR)\b/); assert.deepEqual(await rows(page, 'exposures'), beforeContinueExposures); assert.equal((await rows(page, 'attempts')).length, 0); item.continuePreviewNoNewExposure = true; await dialog.locator('[data-mode=test]').click(); await pane(page); await noHelpers(page);
  sessions = await rows(page, 'sessions'); assert.equal(sessions.length, 2); const test = sessions.find(session => session.lesson.mode === 'test'); assert(test);
  const expected = structuredClone(practice.lesson); expected.mode = 'test'; delete expected.teaching; delete expected.workedExample; delete expected.nextStep; for (const material of expected.materials) for (const question of material.questions) { delete question.hints; if ('criteria' in question) delete question.modelAnswer; }
  assert.deepEqual(test.lesson, expected); assert.equal(test.lesson.id, practice.lesson.id); assert.equal(new Set(practice.lesson.materials.map(material => material.rootId)).size, 2);
  item.sessions = [practice, test]; item.materialEvidence = practice.lesson.materials.map(material => ({ rootId: material.rootId, materialId: material.id, blocks: material.blocks.map(block => ({ id: block.id, textSha256: digest(block.text) })), evidence: material.questions.map(question => ({ id: question.id, kind: question.kind ?? 'choice', range: question.evidence, additionalEvidence: question.additionalEvidence })) })); saveReport();
  await context.setOffline(true); item.results.push(await finish(page, practice)); item.results.push(await finish(page, test)); assert.equal((await rows(page, 'sessions')).length, 2);
  await page.goto(origin + '/settings'); const downloading = page.waitForEvent('download'); await page.locator('.profile-backup').getByRole('button', { name: '下载备份', exact: true }).click(); const download = await downloading, backupPath = `private/verification/today-${level}-ui-backup-20261011.zip`; await download.saveAs(backupPath);
  const recovery = await newProfile(); await onboarding(recovery.page, level); await recovery.page.goto(origin + '/settings'); await recovery.page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated'); await recovery.page.reload(); await expect(recovery.page.locator('.profile-backup')).toBeVisible(); await recovery.context.setOffline(true); await recovery.page.locator('.profile-backup input[type=file]').setInputFiles(backupPath); await expect(recovery.page.locator('.backup-preview')).toBeVisible(); await recovery.page.getByRole('button', { name: '导入为新档案', exact: true }).click(); await expect(recovery.page.getByText('已建立新档案并导入记录。', { exact: true })).toBeVisible();
  const restored = await rows(recovery.page, 'sessions'), restoredAttempts = await rows(recovery.page, 'attempts'); assert.equal(restored.length, 2); assert.equal(restoredAttempts.length, item.results.reduce((sum, result) => sum + result.attempts.length, 0));
  for (const result of item.results) { const row = restored.find(session => session.syncSessionId === result.session.id); assert(row); assert.deepEqual(row.lesson, result.session.lesson); assert.deepEqual(row.itemHashes, result.session.itemHashes); assert.equal(row.contentHash, result.session.contentHash); assert.equal(row.status, 'completed'); const actual = restoredAttempts.filter(attempt => attempt.sessionId === row.id); for (const old of result.attempts) { const imported = actual.find(attempt => attempt.questionId === old.questionId); assert(imported); for (const field of ['rootId', 'answer', 'correct', 'rule', 'assistance']) assert.deepEqual(imported[field], old[field]); } }
  for (const row of restored) {
   const questions = row.lesson.materials.flatMap(material => material.questions);
   const completedUi = async () => {
    await expect(recovery.page.locator('.question-panel h2').first()).toHaveText(questions.at(-1).prompt);
    if (row.lesson.mode === 'test') await expect(recovery.page.locator('.check-result')).toHaveCount(questions.length);
    else await expect(recovery.page.getByRole('heading', { name: '阅读任务已保存', exact: true, includeHidden: true })).toBeAttached();
    await pane(recovery.page); await expect(recovery.page.locator('.feedback')).toBeVisible();
    if (row.lesson.mode === 'test') { await noHelpers(recovery.page); for (const result of await recovery.page.locator('.check-result').all()) await expect(result).toBeVisible(); }
    else await expect(recovery.page.getByRole('heading', { name: '阅读任务已保存', exact: true })).toBeVisible();
   };
   await recovery.page.goto(origin + '/learn/' + row.id); await completedUi(); await recovery.page.reload(); await completedUi();
  }
  item.backupRecovery = { path: backupPath, sessions: restored.length, attempts: restoredAttempts.length, passed: true, offlineImport: true, bothCompletedModesOpenedAndReloadedOffline: true, scope: 'Learning records restored through UI into a separate isolated browser profile; resource caches are not part of this backup.' };
  await recovery.context.close(); await context.close(); saveReport();
 }
 assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) { report.passed = false; report.failures.push({ message: error.message, stack: error.stack }); throw error; }
finally { saveReport(); await browser.close(); }
console.log(JSON.stringify({ passed: report.passed, cases: report.cases.length, completeModes: report.cases.reduce((sum, item) => sum + item.results.length, 0) }));
