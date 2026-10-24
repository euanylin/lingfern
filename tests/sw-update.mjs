import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

const root = resolve('dist');
const previousBuild = process.argv.find(argument => argument.startsWith('--previous-dist='))?.slice('--previous-dist='.length);
const previousRoot = previousBuild ? resolve(previousBuild) : root;
let updated = false;
let invalidUpdate = false;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  const pageRoute = /^\/(start|today|progress|library(?:\/(?:dictionary|saved|ipa|grammar|history))?|settings(?:\/about)?|learn\/[^/]+)$/.test(pathname);
  const servingRoot = updated ? root : previousRoot;
  const file = resolve(join(servingRoot, pathname === '/' || pageRoute ? 'index.html' : pathname.slice(1)));
  if (!file.startsWith(servingRoot + '/') && file !== join(servingRoot, 'index.html')) { response.writeHead(404).end(); return; }
  try {
    const original = await readFile(file);
    const body = pathname === '/sw.js' && invalidUpdate ? Buffer.from('This is deliberately invalid JavaScript for an isolated update failure.')
      : pathname === '/sw.js' && updated ? Buffer.concat([original, Buffer.from('\n// verified-update-2\n')]) : original;
    const extension = file.slice(file.lastIndexOf('.'));
    response.writeHead(200, { 'Content-Type': mime[extension] ?? 'application/octet-stream', 'Cache-Control': pathname === '/sw.js' ? 'no-store' : 'no-cache', 'Content-Length': body.byteLength });
    response.end(body);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('No local server');
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ locale: 'zh-CN' });
  context.setDefaultTimeout(30_000);
  const page = await context.newPage();
  await page.goto(`${origin}/today`);
  await page.getByRole('heading', { name: '今日' }).waitFor();
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.ready).active);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), true);
  console.log('Update check: initial worker active.');
  const previousHtml = await readFile(join(previousRoot, 'index.html'), 'utf8');
  const currentHtml = await readFile(join(root, 'index.html'), 'utf8');
  const previousStyle = /<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/.exec(previousHtml)[1];
  const currentStyle = /<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/.exec(currentHtml)[1];
  const previousScripts = [...previousHtml.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g)].map(match => match[1]);
  const currentScripts = [...currentHtml.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g)].map(match => match[1]);
  assert.equal(await page.locator('link[rel=stylesheet]').getAttribute('href'), previousStyle);
  assert.deepEqual(await page.locator('script[type=module]').evaluateAll(scripts => scripts.map(script => script.getAttribute('src'))), previousScripts);
  if (previousBuild) assert.notDeepEqual([previousStyle, previousScripts], [currentStyle, currentScripts], 'The archived predecessor must exercise a real application asset revision');
  await page.goto(`${origin}/settings`);
  await page.getByRole('button', { name: '检查更新' }).click();
  await page.getByText('已是最新版本。').waitFor();
  await context.setOffline(true);
  await page.getByRole('button', { name: '检查更新' }).click();
  await page.getByText('检查更新需要联网。').waitFor();
  await context.setOffline(false);
  console.log('Update check: current and offline checks passed.');
  if (process.argv.includes('--settings-only')) {
    updated = true;
    const section = page.locator('.settings-update');
    await section.getByRole('button', { name: /^检查更新/ }).click();
    await section.getByText('立即更新', { exact: true }).waitFor();
    assert.equal(await section.getByRole('button').count(), 1);
    assert.equal(await section.locator('button[data-update-ready=true]').count(), 1);
    assert.equal(await section.getByRole('link').getAttribute('href'), '/settings/about');
    await page.goto(`${origin}/today`);
    await page.locator('.update-notice').waitFor();
    await page.locator('.update-notice').getByRole('button', { name: '稍后', exact: true }).click();
    assert.equal(await page.locator('.update-notice').count(), 0);
    assert.equal(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting), true);
    await page.getByRole('navigation').first().getByRole('link', { name: '设置', exact: true }).click();
    await section.locator('button[data-update-ready=true]').waitFor();
    for (const theme of ['light', 'dark']) for (const width of [1440, 1200, 1024, 768, 375, 320]) {
      await page.setViewportSize({ width, height: 812 });
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      const { check, update, status } = await section.evaluate(element => {
        const rect = selector => element.querySelector(selector).getBoundingClientRect().toJSON();
        return { check: rect('button'), update: rect('button[data-update-ready=true]'), status: rect('[role=status]') };
      });
      assert.deepEqual(update, check, 'The same row checks and activates the waiting update');
      assert(status.y >= update.y && status.y + status.height <= update.y + update.height, 'Status remains inside the update row');
      assert(update.width >= 44 && update.height >= 44);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (width === 375) {
        await section.evaluate(element => element.scrollIntoView({ block: 'center' }));
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const visibleUpdate = await section.locator('button[data-update-ready=true]').boundingBox();
        assert(visibleUpdate.y >= 0 && visibleUpdate.y + visibleUpdate.height < 740);
        await section.screenshot({ path: `output/playwright/settings-update-375-${theme}-zh-Hans-ready.png` });
      }
    }
    await page.setViewportSize({ width: 320, height: 812 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await section.locator('button[data-update-ready=true]').click();
    const confirmation = page.getByRole('dialog', { name: '现在更新？' });
    await confirmation.waitFor();
    assert.equal(await confirmation.getByRole('button', { name: '取消', exact: true }).evaluate(button => button === document.activeElement), true);
    assert.equal(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting), true);
    await page.keyboard.press('Escape');
    await confirmation.waitFor({ state: 'hidden' });
    assert.equal(await section.locator('button[data-update-ready=true]').evaluate(button => button === document.activeElement), true);
    await section.locator('button[data-update-ready=true]').click();
    const refreshed = page.waitForEvent('load');
    await confirmation.getByRole('button', { name: '立即更新', exact: true }).click();
    await refreshed;
    await page.waitForFunction(async () => !(await navigator.serviceWorker.getRegistration())?.waiting);
    await page.getByRole('heading', { name: '设置', exact: true }).waitFor();
    assert.deepEqual(await page.locator('script[type=module]').evaluateAll(scripts => scripts.map(script => script.getAttribute('src'))), currentScripts);
    assert.equal(await page.locator('link[rel=stylesheet]').getAttribute('href'), currentStyle);
    await section.getByRole('button', { name: /^检查更新/ }).waitFor();
    await page.setViewportSize({ width: 1280, height: 900 });
    await section.evaluate(element => element.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: 'private/verification/record-quote-20261012/update-refreshed.png' });
    console.log('PASS: real waiting service worker updated from the same Settings row at six widths/light and dark/200% text; current/offline checks passed.');
  } else {
  await page.goto(`${origin}/today`);
  await page.locator('.corpus-practice[data-skill=reading]').getByRole('button', { name: '开始', exact: true }).click();
  await page.getByRole('dialog').locator('button[data-mode=practice]').click();
  await page.locator('.learning-grid,.material-workspace').first().waitFor();
  console.log('Update check: practice workspace ready.');
  const firstQuestion = await page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('lingfern');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, request = db.transaction('sessions').objectStore('sessions').getAll();
      request.onerror = () => { db.close(); reject(request.error); };
      request.onsuccess = () => {
        db.close();
        const question = request.result[0]?.lesson.materials[0]?.questions[0];
        if (question) resolve(question);
        else reject(new Error('The practice session has no first question.'));
      };
    };
  }));
  const organized = await page.locator('.material-workspace').count() > 0;
  const inputs = organized ? page.locator('.workspace-question').first() : page;
  let expectedAnswer;
  if ('options' in firstQuestion) { expectedAnswer = firstQuestion.answer; await inputs.getByRole('radio').nth(expectedAnswer).check(); }
  else if (firstQuestion.kind === 'completion') { expectedAnswer = firstQuestion.answer; await inputs.locator('.completion-answer input').fill(expectedAnswer); }
  else if (firstQuestion.kind === 'table') { expectedAnswer = firstQuestion.rows.map(row => row.answer); for (const [index, answer] of expectedAnswer.entries()) await inputs.locator('.answer-table input').nth(index).fill(answer); }
  else if (firstQuestion.kind === 'matching') { expectedAnswer = firstQuestion.pairs.map(pair => pair.answer); for (const [index, pair] of firstQuestion.pairs.entries()) { const label = organized ? `${index + 1}. ${pair.label}` : pair.label; await (organized ? inputs.locator('.matching-answers .setting-trigger').nth(index) : inputs.getByRole('button', { name: label, exact: true })).click(); await inputs.getByRole('listbox', { name: label, exact: true }).getByRole('option', { name: pair.answer, exact: true }).click(); } }
  else if (firstQuestion.kind === 'sequence') { expectedAnswer = firstQuestion.acceptedOrders[0]; for (const step of expectedAnswer) await inputs.getByRole('button', { name: organized ? `${step} ＋` : `添加步骤: ${step}`, exact: true }).click(); }
  else if (firstQuestion.kind === 'evidence') { expectedAnswer = firstQuestion.accepted[0]; await inputs.getByRole('radio').nth(expectedAnswer).check(); }
  else throw new Error('Expected a scored first task');
  async function answerVisible(target) {
    if (organized) await expect(target.locator('.workspace-save-status,.workspace-questions > p[role=status]')).toHaveText('已保存在本设备');
    else if (await target.locator('.material-workspace').count()) {
      const current = target.locator('.workspace-question').first();
      if (typeof expectedAnswer === 'number') await expect(current.getByRole('radio').nth(expectedAnswer)).toBeChecked();
      else if (typeof expectedAnswer === 'string') await expect(current.locator('input:not([type=radio])')).toHaveValue(expectedAnswer);
      else if (firstQuestion.kind === 'matching') for (const [index, answer] of expectedAnswer.entries()) await expect(current.locator('.setting-trigger').nth(index)).toHaveAttribute('data-value', answer);
      else if (firstQuestion.kind === 'sequence') await expect(current.locator('.sequence-order li>span')).toHaveText(expectedAnswer);
      else for (const [index, answer] of expectedAnswer.entries()) await expect(current.locator('input:not([type=radio])').nth(index)).toHaveValue(answer);
      await expect(current.locator('fieldset').first()).toBeDisabled();
    } else await target.getByRole('heading', { name: '✓ 回答正确' }).waitFor();
  }
  if (!organized) await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await answerVisible(page);
  const sessionPath = new URL(page.url()).pathname;
  async function savedState(target) { return target.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('lingfern'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
      const tx = db.transaction(['attempts', 'sessions']);
      const read = name => new Promise((resolve, reject) => { const request = tx.objectStore(name).getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const [attempts, sessions] = await Promise.all([read('attempts'), read('sessions')]);
      return { attempts, sessions: sessions.map(session => ({ id: session.id, profileId: session.profileId, contentHash: session.contentHash, lesson: session.lesson, drafts: session.workspace?.drafts })) };
    } finally { db.close(); }
  }); }
  const saved = await savedState(page);
  assert.equal(saved.sessions.length, 1); assert.equal(saved.attempts.length, organized ? 0 : 1);
  assert.deepEqual(organized ? saved.sessions[0].drafts[firstQuestion.id] : saved.attempts[0].answer, expectedAnswer);
  console.log('Update check: answer saved.');
  invalidUpdate = true;
  const failedChecker = await context.newPage();
  await failedChecker.goto(`${origin}/settings`);
  await failedChecker.getByRole('button', { name: '检查更新' }).click();
  await failedChecker.getByText('检查更新失败，请重试。', { exact: true }).waitFor();
  assert.deepEqual(await failedChecker.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return { active: registration.active.state, waiting: !!registration.waiting };
  }), { active: 'activated', waiting: false });
  await failedChecker.close();
  console.log('Update check: invalid update rejected.');
  await context.setOffline(true);
  await page.reload();
  await answerVisible(page); assert.deepEqual(await savedState(page), saved);
  await context.setOffline(false);
  invalidUpdate = false;
  updated = true;
  const checker = await context.newPage();
  await checker.goto(`${origin}/settings`);
  // Automatic discovery may replace the check button before this tab settles.
  await checker.evaluate(async () => (await navigator.serviceWorker.ready).update());
  await checker.getByText('立即更新', { exact: true }).waitFor();
  await checker.close();
  console.log('Update check: valid update waiting.');
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting, { timeout: 15000 });
  assert.equal(await page.getByRole('button', { name: '立即更新' }).count(), 0);
  await page.getByRole('link', { name: '离开任务' }).click();
  await page.waitForURL(/\/today$/);
  const second = await context.newPage();
  await second.goto(`${origin}/today`);
  await second.locator('.corpus-practice[data-skill=reading]').getByRole('button', { name: /^(开始|继续)$/, exact: true }).click();
  await second.getByRole('dialog').locator('button[data-mode=practice]').click();
  await second.waitForURL(url => url.pathname === sessionPath);
  await answerVisible(second); assert.deepEqual(await savedState(second), saved);
  await page.getByRole('button', { name: '立即更新' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '立即更新', exact: true }).click();
  await page.getByText('另一标签页仍在进行任务。请先完成或离开该任务。').waitFor();
  assert.equal(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting), true);
  await second.getByRole('link', { name: '离开任务' }).click();
  await second.waitForURL(/\/today$/);
  await second.close();
  console.log('Update check: other learning tab released.');
  const refreshed = page.waitForEvent('load');
  await page.getByRole('dialog').getByRole('button', { name: '立即更新', exact: true }).click();
  await refreshed;
  await page.waitForFunction(async () => !(await navigator.serviceWorker.getRegistration())?.waiting, { timeout: 15000 });
  await page.getByRole('heading', { name: '今日' }).waitFor();
  assert.equal(await page.locator('link[rel=stylesheet]').getAttribute('href'), currentStyle);
  assert.deepEqual(await page.locator('script[type=module]').evaluateAll(scripts => scripts.map(script => script.getAttribute('src'))), currentScripts);
  assert.deepEqual(await savedState(page), saved);
  console.log('PASS: invalid update preserved the active worker and offline answer; valid update waited during learning, another active tab blocked activation, exact saved draft/formal answer and lesson snapshot retained.');
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
