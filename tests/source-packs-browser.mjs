import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
const sourceCatalogue = JSON.parse(await readFile('content/source-packs.json', 'utf8'));
const offlineResources = JSON.parse(await readFile('content/offline-resources.json', 'utf8'));
const bundledTexts = Object.fromEntries(await Promise.all(['voa', 'gutenberg'].map(async source => [source, await readFile('public/corpus/' + source + '.json', 'utf8')])));
const starting = process.argv.find(arg => arg.startsWith('--starting='))?.slice(11) ?? 'B2';
assert(['A2','B1','B2','C1','C2'].includes(starting));
const origin = 'http://127.0.0.1:8787';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 375, height: 812 } });
const page = await context.newPage(), errors = [], downloads = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
page.on('response', response => { if (response.url().includes('/source-packs/')) downloads.push({ url: response.url(), status: response.status() }); });
async function rows(table) {
  return page.evaluate(table => new Promise((resolve, reject) => {
    const open = indexedDB.open('lingfern'); open.onerror = () => reject(open.error);
    open.onsuccess = () => { const db = open.result, request = db.transaction(table).objectStore(table).getAll(); request.onsuccess = () => { resolve(request.result); db.close(); }; request.onerror = () => reject(request.error); };
  }), table);
}
try {
  await page.goto(origin + '/library');
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated', undefined, { timeout: 30000 });
  await page.reload();
  assert.equal((await rows('communityPacks')).length, 0);
  await page.goto(origin + '/start');
  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: '跳过这一步', exact: true }).click();
  for (const skill of ['听力', '阅读']) await page.getByRole('group', { name: skill, exact: true }).getByLabel(new RegExp('^' + (skill === '听力' ? starting : 'B2') + ' ·')).check();
  await page.getByRole('button', { name: '保存并继续', exact: true }).click();
  await page.getByRole('button', { name: '保存并前往今日', exact: true }).click();
  await expect(page.locator('.task-catalogue-list > .task-row')).toHaveCount(0);
  await page.evaluate(() => { const original = crypto.getRandomValues.bind(crypto); crypto.getRandomValues = values => values instanceof Uint32Array && values.length === 2 ? (values.fill(0), values) : original(values); });
  const dialog = page.getByRole('dialog');
  const failedPath = '**/source-packs/*.zip';
  await page.route(failedPath, route => route.fulfill({ status: 404, body: 'Not found' }));
  const listening = page.locator('.corpus-practice[data-skill=listening]');
  await listening.getByRole('button', { name: '开始', exact: true }).click();
  await expect(listening.getByRole('status')).toContainText('读取失败');
  await expect(dialog).toHaveCount(0);
  assert.equal((await rows('communityPacks')).length, 0);
  await page.unroute(failedPath);
  downloads.length = 0;
  for (const skill of ['reading', 'listening']) {
    const button = page.locator(`.corpus-practice[data-skill=${skill}]`).getByRole('button', { name: '开始', exact: true });
    await button.click(); await expect(dialog).toBeVisible({ timeout: 90000 });
    const first = await dialog.locator('h2').innerText();
    if (skill === 'reading') {
      const installed = await rows('communityPacks');
      const records = [...['voa', 'gutenberg'].flatMap(source => JSON.parse(bundledTexts[source]).records), ...installed.flatMap(pack => pack.corpus?.records ?? [])];
      const urls = await dialog.locator('.task-detail-credits a[target=_blank]').evaluateAll(links => links.map(link => link.href));
      assert(urls.length > 0 && urls.every(url => records.some(record => record.originalUrl === url)), 'Reading preview source must belong to the actual available bundled/installed collection');
      assert(installed.some(pack => pack.id === 'wikipedia-reading-001' && pack.state === 'ready'), 'Normal online reading package was not installed');
    }
    await dialog.getByRole('button', { name: '关闭详情', exact: true }).click();
    await button.click(); await expect(dialog).toBeVisible({ timeout: 90000 });
    assert.notEqual(await dialog.locator('h2').innerText(), first, skill + ' preview repeated with identical RNG seed');
    assert.equal((await rows('sessions')).length, 0);
    assert.equal((await rows('exposures')).length, 0);
    if (skill === 'reading') await dialog.getByRole('button', { name: '关闭详情', exact: true }).click();
  }
  assert(downloads.length >= 4 && downloads.every(item => item.status === 200));
  await dialog.getByRole('button', { name: '关闭详情', exact: true }).click();
  await page.goto(origin + '/library');
  await expect(page.locator('.package-row')).toHaveCount(sourceCatalogue.packs.length + offlineResources.groups.filter(group => group.id === 'audio-beginner' || !group.id.startsWith('audio-')).length);
  await expect(page.locator('.package-row').filter({ hasText: '阅读 · 001' })).toContainText('已安装');
  await expect(page.locator('.community-import')).not.toContainText('wikipedia-reading-001');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.goto(origin + '/today');
  await page.evaluate(() => { const original = crypto.getRandomValues.bind(crypto); crypto.getRandomValues = values => values instanceof Uint32Array && values.length === 2 ? (values.fill(0), values) : original(values); });
  const installedCount = (await rows('communityPacks')).length;
  const reading = page.locator('.corpus-practice[data-skill=reading]');
  for (const skill of ['reading', 'listening']) {
    const installed = new Set((await rows('communityPacks')).map(pack => pack.hash));
    const entry = sourceCatalogue.packs.find(pack => pack.skill === skill && !installed.has(pack.sha256));
    const files = unzipSync(await readFile('public' + entry.path));
    const corpus = JSON.parse(strFromU8(files[skill === 'reading' ? 'corpus.json' : 'spoken.json']));
    // Isolated regression state: every excerpt in the next real download has already been encountered.
    const profileId = (await rows('profiles'))[0].id, now = new Date().toISOString();
    const excluded = corpus.records.map(record => ({ profileId, rootId: record.rootId, firstSeenAt: now, lastSeenAt: now,
      contacts: (record.passages ?? record.clips).map((clip, index) => ({ sessionId: 'exhausted-bank-fixture', materialId: 'corpus-' + clip.id,
        questionId: 'question-' + index, variantGroup: 'variant-' + index, firstSeenAt: now, lastSeenAt: now })) }));
    await page.evaluate(excluded => new Promise((resolve, reject) => {
      const open = indexedDB.open('lingfern'); open.onerror = () => reject(open.error);
      open.onsuccess = () => { const db = open.result, tx = db.transaction('exposures', 'readwrite');
        for (const exposure of excluded) tx.objectStore('exposures').put(exposure);
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
    }), excluded);
    await page.locator(`.corpus-practice[data-skill=${skill}]`).getByRole('button', { name: '开始', exact: true }).click();
    await expect(dialog).toBeVisible({ timeout: 90000 });
    assert((await rows('communityPacks')).some(pack => pack.hash === entry.sha256), 'Exhausted candidate was not actually downloaded');
    const titles = corpus.records.map(record => record.title);
    await expect(dialog.locator('h2')).not.toHaveText(new RegExp(titles.map(title => title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')));
    await dialog.getByRole('button', { name: '关闭详情', exact: true }).click();
    await page.evaluate(excluded => new Promise((resolve, reject) => {
      const open = indexedDB.open('lingfern'); open.onerror = () => reject(open.error);
      open.onsuccess = () => { const db = open.result, tx = db.transaction('exposures', 'readwrite');
        for (const exposure of excluded) tx.objectStore('exposures').delete([exposure.profileId, exposure.rootId]);
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
    }), excluded);
  }
  const fallbackInstalledCount = (await rows('communityPacks')).length;
  assert.equal(fallbackInstalledCount, installedCount + 2);
  await page.route(failedPath, route => route.fulfill({ status: 404, body: 'Not found' }));
  for (const section of [reading, listening]) {
    await section.getByRole('button', { name: '开始', exact: true }).click();
    await expect(dialog).toBeVisible();
    await expect(section.getByRole('status')).toHaveCount(0);
    assert.equal((await rows('communityPacks')).length, fallbackInstalledCount);
    await dialog.getByRole('button', { name: '关闭详情', exact: true }).click();
  }
  await page.unroute(failedPath);
  await context.setOffline(true);
  await reading.getByRole('button', { name: '开始', exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '关闭详情', exact: true }).click();
  await page.locator('.corpus-practice[data-skill=listening]').getByRole('button', { name: '开始', exact: true }).click();
  await expect(dialog).toBeVisible();
  const packs = await rows('communityPacks'); assert(packs.some(pack => pack.corpus) && packs.some(pack => pack.spoken));
  await context.setOffline(true);
  await dialog.locator('button[data-mode=practice]').click();
  await expect(page).toHaveURL(/\/learn\//);
  const session = (await rows('sessions'))[0], question = session.lesson.materials[0].questions[0];
  await expect(page.locator('.teaching p')).toHaveCount(1);
  await expect(page.locator('.teaching')).not.toContainText(session.lesson.workedExample[starting === 'A2' ? 'zh-Hans' : 'en']);
  await expect(page.locator('.teaching')).toContainText(session.lesson.teaching[starting === 'A2' ? 'zh-Hans' : 'en']);
  await expect(page.locator('.teaching')).not.toContainText('three sentences');
  await page.screenshot({ path: `output/playwright/listening-instruction-375-light-${starting === 'A2' ? 'zh-Hans' : 'en'}.png` });
  await page.locator('audio').evaluate(audio => audio.playbackRate = 4);
  await page.getByRole('button', { name: '播放 / 重听', exact: true }).click();
  await expect(page.locator('.teaching p')).toHaveCount(2, { timeout: 30000 });
  await expect(page.locator('.teaching')).toContainText(session.lesson.workedExample[starting === 'A2' ? 'zh-Hans' : 'en']);
  await expect(page.getByText('录音已播放，可以选择并保存。', { exact: true })).toBeVisible({ timeout: 60000 });
  assert(['completion', 'table'].includes(question.kind), 'This existing audio recovery fixture must save a scorable gap or event-date table');
  await expect(page.locator('.question-panel')).toBeVisible();
  if (await page.locator('.question-sheet-toggle').isVisible()) await page.locator('.question-sheet-toggle').click();
  if (question.kind === 'completion') await page.locator('.completion-answer input').fill(question.answer);
  else for (const [index, row] of question.rows.entries()) await page.locator('.answer-table input').nth(index).fill(row.answer);
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await expect(page.locator('.feedback')).toContainText('回答正确');
  await expect(page.locator('.feedback')).toContainText('已提供引导');
  assert.equal((await rows('attempts'))[0].assistance.teachingProvided, true);
  await page.reload(); await expect(page.locator('.feedback')).toContainText('回答正确');
  assert.equal((await rows('attempts')).length, 1);
  const audioPath = session.lesson.materials[0].audio.src;
  await page.evaluate(async ({ hash, path }) => {
    const cache = await caches.open('lingfern-community-' + hash);
    if (!await cache.delete(path)) throw new Error('Expected installed audio');
  }, { hash: session.lesson.communityPackageId, path: audioPath });
  await page.reload();
  await page.getByRole('button', { name: '播放 / 重听', exact: true }).click();
  await expect(page.getByRole('button', { name: '恢复音频', exact: true })).toBeDisabled();
  await page.screenshot({ path: 'output/playwright/audio-repair-375-light-zh-Hans-offline.png' });
  await context.setOffline(false);
  await page.route(failedPath, route => route.fulfill({ status: 404, body: 'Not found' }));
  await page.getByRole('button', { name: '恢复音频', exact: true }).click();
  await expect(page.getByText('恢复失败，请重试。', { exact: true })).toBeVisible();
  assert.equal((await rows('attempts')).length, 1);
  await expect(page.locator('.feedback')).toContainText('回答正确');
  await page.unroute(failedPath);
  await page.getByRole('button', { name: '恢复音频', exact: true }).click();
  await expect(page.getByRole('button', { name: '恢复音频', exact: true })).toHaveCount(0, { timeout: 90000 });
  assert(await page.evaluate(async ({ hash, path }) => !!await (await caches.open('lingfern-community-' + hash)).match(path), { hash: session.lesson.communityPackageId, path: audioPath }));
  await context.setOffline(true); await page.reload();
  await expect(page.locator('.feedback')).toContainText('回答正确');
  await page.locator('audio').evaluate(audio => audio.playbackRate = 4);
  await page.getByRole('button', { name: '播放 / 重听', exact: true }).click();
  await expect(page.getByRole('button', { name: '暂停', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '播放 / 重听', exact: true })).toBeVisible({ timeout: 60000 });
  assert.equal((await rows('attempts')).length, 1);
  await page.screenshot({ path: 'output/playwright/source-packs-375-light-zh-Hans-offline.png' });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.goto(origin + '/today'); await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  assert.deepEqual(errors, []);
  console.log('PASS: fresh profile, no ZIP imports; same-origin source downloads, non-repeating previews, no preview exposure, exhausted downloads and404 fall back to installed sources, empty listening bank reports failure; actual audio cache loss, offline repair disabled, failed repair preserves answer, canonical repair restores offline playback without duplicating answers; 375px layout and Today.');
} finally { await context.close(); await browser.close(); }
