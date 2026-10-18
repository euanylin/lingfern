import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
// Isolated historical-session fixture; this does not approve a draft or add an authored check catalogue.
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false } });
let check;
try { const { lessonSchema } = await server.ssrLoadModule('/src/shared/content.ts'); check = lessonSchema.parse(JSON.parse(readFileSync('tests/fixtures/content/a1-check-reading.json', 'utf8'))); } finally { await server.close(); }
const origin = 'http://127.0.0.1:8787';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const contexts = await Promise.all([0, 1].map(() => browser.newContext({ locale: 'en-US', viewport: { width: 1440, height: 900 } })));
const pages = await Promise.all(contexts.map(context => context.newPage()));
for (const page of pages) await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
const [a, b] = pages;
async function rows(page, table) {
  return page.evaluate(table => new Promise((resolve, reject) => {
    const open = indexedDB.open('lingfern'); open.onerror = () => reject(open.error);
    open.onsuccess = () => { const db = open.result, query = db.transaction(table).objectStore(table).getAll(); query.onsuccess = () => { resolve(query.result); db.close(); }; query.onerror = () => reject(query.error); };
  }), table);
}
async function english(page) {
  await page.goto(origin + '/settings');
  const trigger = page.getByRole('button', { name: /^(Language|语言|語言)$/ });
  await trigger.click(); await page.getByRole('option', { name: 'English', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
}
try {
  await english(a);
  const id = await a.evaluate(async lesson => {
    const contentHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(lesson))))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    const id = crypto.randomUUID();
    const row = { id, profileId: 'local-guest', lesson, contentHash, position: 0, status: 'active', startedAt: new Date().toISOString(), assistance: { hintLevel: 0 }, leaseUntil: 0 };
    await new Promise((resolve, reject) => { const open = indexedDB.open('lingfern'); open.onsuccess = () => { const db = open.result, tx = db.transaction('sessions', 'readwrite'); tx.objectStore('sessions').add(row); tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => reject(tx.error); }; open.onerror = () => reject(open.error); });
    return id;
  }, check);
  await a.goto(origin + '/learn/' + id);
  await expect(a.getByRole('button', { name: 'Begin check', exact: true })).toBeVisible();
  const original = (await rows(a, 'sessions')).find(row => row.id === id);
  assert(original.checkDeviceId && original.checkDeviceId === (await rows(a, 'settings')).find(row => row.key === 'check-device-id').value);
  await a.getByRole('button', { name: 'Begin check', exact: true }).click();
  assert.equal(await a.locator('.hint').count(), 0);
  await a.locator('input[name=answer]').first().check();
  await a.getByRole('button', { name: 'Save answer', exact: true }).click();
  await expect(a.locator('.feedback')).toContainText('Response saved. Answers appear after the check.');
  await a.getByRole('button', { name: 'Next question', exact: true }).click();
  await expect(a.locator('#learning-question h2').first()).toHaveText(check.materials[0].questions[1].prompt);
  await a.locator('input[name=answer]').nth(1).check();
  await expect.poll(async () => (await rows(a, 'sessions')).find(row => row.id === id)?.draft).toBe(1);
  await a.reload(); await expect(a.locator('input[name=answer]').nth(1)).toBeChecked();
  await a.goto(origin + '/settings');
  const download = a.waitForEvent('download'); await a.getByRole('button', { name: 'Download backup', exact: true }).click();
  await (await download).saveAs('/tmp/lingfern-check-device-browser.zip');
  await english(b);
  await b.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated');
  await b.getByLabel('Restore from backup', { exact: true }).setInputFiles('/tmp/lingfern-check-device-browser.zip');
  await expect(b.getByRole('button', { name: 'Import as new profile', exact: true })).toBeVisible();
  await b.getByRole('button', { name: 'Import as new profile', exact: true }).click();
  await expect(b.locator('.profile-backup').getByRole('status').filter({ hasText: 'New profile created and records imported.' })).toBeVisible();
  const copied = (await rows(b, 'sessions')).find(row => row.syncSessionId === id);
  assert(copied && copied.checkDeviceId === original.checkDeviceId);
  const answers = await rows(b, 'attempts'); assert.equal(answers.length, 1);
  await contexts[1].setOffline(true);
  await b.goto(origin + '/learn/' + copied.id);
  await expect(b.locator('.check-readonly').getByRole('status')).toContainText('Continue this check in its original browser.');
  await expect(b.locator('.check-readonly article')).toHaveCount(1);
  await expect(b.locator('.check-readonly')).toContainText(check.materials[0].questions[0].prompt);
  assert.equal(await b.locator('input[name=answer], .passage, .selection-dictionary-menu, .hint').count(), 0);
  assert.equal(await b.getByRole('button', { name: 'Save answer', exact: true }).count(), 0);
  assert.equal(await b.getByText(check.materials[0].questions[1].prompt, { exact: true }).count(), 0);
  for (const width of [1440, 1200, 1024, 768, 375, 320]) {
    await b.setViewportSize({ width, height: 812 });
    await b.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const panel = await b.locator('.check-readonly').boundingBox(); assert(panel && panel.x >= -1 && panel.x + panel.width <= width + 1);
    assert(await b.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const button = await b.locator('.check-readonly a').boundingBox(); assert(button && button.height >= 44);
  }
  await b.screenshot({ path: 'output/playwright/check-device-320-light-en-offline.png' });
  await b.setViewportSize({width:375,height:360});
  await b.locator('.check-readonly a').scrollIntoViewIfNeeded();
  const shortButton=await b.locator('.check-readonly a').boundingBox(); assert(shortButton&&shortButton.height>=44&&shortButton.y>=0&&shortButton.y+shortButton.height<=361);
  await b.setViewportSize({width:375,height:812});
  await b.evaluate(()=>{document.documentElement.style.fontSize='200%';});
  assert(await b.locator('.check-readonly').evaluate(element=>element.scrollWidth<=element.clientWidth));
  assert(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await b.evaluate(()=>{document.documentElement.style.fontSize='';});
  await b.reload(); await expect(b.locator('.check-readonly').getByRole('status')).toContainText('Continue this check in its original browser.');
  assert.deepEqual(await rows(b, 'attempts'), answers);
  assert.equal((await rows(b, 'sessions')).find(row => row.id === copied.id).status, 'active');
  for (const [value, expected] of [['简体中文', '请在原浏览器继续此检查。'], ['繁體中文', '請在原瀏覽器繼續此檢查。']]) {
    await b.goto(origin + '/settings'); await b.getByRole('button', { name: /^(Language|语言|語言)$/ }).click(); await b.getByRole('option', { name: value, exact: true }).click();
    await expect.poll(async () => (await rows(b, 'settings')).find(row => row.key === `profile:${copied.profileId}:locale`)?.value).toBe(value === '简体中文' ? 'zh-Hans' : 'zh-Hant');
    await b.goto(origin + '/learn/' + copied.id); await expect(b.locator('.check-readonly').getByRole('status')).toHaveText(expected);
  }
  await b.goto(origin+'/settings'); await b.getByRole('button',{name:'外觀',exact:true}).click(); await b.getByRole('option',{name:'深色',exact:true}).click();
  await expect(b.locator('html')).toHaveAttribute('data-theme','dark');
  await b.goto(origin+'/learn/'+copied.id); await expect(b.locator('.check-readonly')).toBeVisible();
  await b.screenshot({path:'output/playwright/check-device-375-dark-zh-Hant-offline.png'});
  await contexts[0].setOffline(true); await a.goto(origin + '/learn/' + id);
  await expect(a.locator('input[name=answer]').nth(1)).toBeChecked();
  await a.getByRole('button', { name: 'Save answer', exact: true }).click();
  assert.equal((await rows(a, 'attempts')).filter(row => row.sessionId === id).length, 2);
  await a.getByRole('button', { name: 'End check and switch to learning', exact: true }).click();
  await expect(a.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  assert.equal((await rows(a, 'sessions')).find(row => row.id === id).status, 'ended');
  const savedBeforeStale = await rows(a, 'attempts');
  const stale = await a.evaluate(async originalId => {
    return new Promise((resolve, reject) => { const open = indexedDB.open('lingfern'); open.onerror = () => reject(open.error); open.onsuccess = () => {
      const db = open.result, tx = db.transaction('sessions', 'readwrite'), table = tx.objectStore('sessions'), request = table.get(originalId), id = crypto.randomUUID();
      request.onsuccess = () => { const previous = request.result; table.add({ id, profileId: previous.profileId, lesson: previous.lesson, contentHash: previous.contentHash, checkDeviceId: previous.checkDeviceId, position: 0, status: 'active', startedAt: new Date().toISOString(), assistance: { hintLevel: 0 }, leaseUntil: 0 }); };
      tx.oncomplete = () => { db.close(); resolve(id); }; tx.onabort = () => reject(tx.error);
    }; });
  }, id);
  await a.goto(origin + '/learn/' + stale);
  await a.getByRole('button', { name: 'Begin check', exact: true }).click();
  await expect(a.locator('.check-intro [role=alert]')).toContainText('No reviewed unfamiliar check materials are available yet.');
  await expect(a.getByRole('button', { name: 'Begin check', exact: true })).toBeDisabled();
  assert.equal((await rows(a, 'sessions')).find(row => row.id === stale).checkStartedAt, undefined);
  assert.deepEqual(await rows(a, 'attempts'), savedBeforeStale);
  assert.equal(await a.locator('#learning-material').count(), 0);
  await a.goto(origin + '/today'); await expect(a.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await b.goto(origin + '/today'); await expect(b.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  console.log('PASS: historical fixture binds to original browser; real ZIP export/import into separate storage; disconnected foreign restore is read-only with saved answer retained and no unanswered material/answers; all three languages/six widths/short screen/200%/44px/light and dark; original browser resumes draft and saves/ends without data loss; stale repeated-root launch blocked offline before showing material, with answers unchanged. Not a published check, physical-device or provider test.');
} catch (error) { console.log('BODY', await b.locator('body').innerText()); console.log('SESSIONS', await rows(b, 'sessions')); console.log('SETTINGS', await rows(b, 'settings')); await b.screenshot({path:'output/playwright/check-device-failure.png'}); throw error; } finally { await browser.close(); }
