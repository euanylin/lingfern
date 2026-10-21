import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [], external = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:8787/') ? route.continue() : (external.push(route.request().url()), route.abort()));
async function rows(table) {
  return page.evaluate(table => new Promise((resolve, reject) => {
    const open = indexedDB.open('lingfern'); open.onerror = () => reject(open.error);
    open.onsuccess = () => { const db = open.result, request = db.transaction(table).objectStore(table).getAll(); request.onsuccess = () => { resolve(request.result); db.close(); }; request.onerror = () => { reject(request.error); db.close(); }; };
  }), table);
}
try {
  await page.goto('http://127.0.0.1:8787/library');
  await page.evaluate(() => Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('SW_TIMEOUT')), 30000))]));
  await page.reload();
  await page.locator('.package-row').filter({ hasText: 'IPA 发音与录音' }).getByRole('checkbox').check();
  await page.getByRole('button', { name: '下载所选资源', exact: true }).click();
  await expect(page.locator('.package-row').filter({ hasText: 'IPA 发音与录音' }).getByRole('checkbox').locator('..')).toContainText('已安装', { timeout: 60000 });
  await page.goto('http://127.0.0.1:8787/start');
  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: '跳过这一步', exact: true }).click();
  await page.getByRole('group', { name: '听力', exact: true }).getByLabel(/^A1 ·/).check();
  await page.getByRole('button', { name: '保存并继续', exact: true }).click();
  await page.getByRole('button', { name: '保存并前往今日', exact: true }).click();
  await context.setOffline(true);
  const practice = page.locator('.corpus-practice[data-skill=listening]');
  await page.evaluate(() => { const original = crypto.getRandomValues.bind(crypto); crypto.getRandomValues = values => values instanceof Uint32Array && values.length === 1 ? (values[0] = 0, values) : original(values); });
  await practice.getByRole('button', { name: '开始', exact: true }).click();
  const previewSources = await page.getByRole('dialog').locator('a[target=_blank]').evaluateAll(links => links.map(link => link.href));
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await practice.getByRole('button', { name: '开始', exact: true }).click();
  const nextSources = await page.getByRole('dialog').locator('a[target=_blank]').evaluateAll(links => links.map(link => link.href));
  assert(nextSources.every(source => !previewSources.includes(source)));
  assert.equal((await rows('sessions')).length, 0);
  await page.getByRole('dialog').locator('button[data-mode=practice]').click();
  const session = (await rows('sessions'))[0];
  assert.equal(session.lesson.goalId, 'heard-word-recognition');
  assert.equal(session.lesson.generation.startingPoint, 'A1');
  assert.equal(session.lesson.materials.length, 2);
  await expect(page.locator('.teaching')).toContainText('先听一次');
  for (let index = 0; index < 2; index++) {
    const material = session.lesson.materials[index], question = material.questions[0];
    assert(material.audio.duration < 5 && !material.audio.synthetic);
    await expect(page.locator('.material')).not.toContainText(question.answer);
    await page.locator('.completion-answer input').fill(question.answer);
    await expect(page.getByRole('button', { name: '保存答案', exact: true })).toBeDisabled();
    assert.equal((await rows('attempts')).length, index);
    await page.getByRole('button', { name: '播放 / 重听', exact: true }).click();
    await expect(page.getByText('录音已播放，可以选择并保存。', { exact: true })).toBeVisible();
    await page.locator('.completion-answer input').fill(question.answer);
    await page.getByRole('button', { name: '保存答案', exact: true }).click();
    await expect(page.locator('.feedback')).toContainText('回答正确');
    await expect(page.locator('.feedback')).toContainText(question.answer);
    if(index===0&&process.argv.includes('--reselect')) {
      const before=(await rows('sessions'))[0],savedBefore=await rows('attempts');await page.goto('http://127.0.0.1:8787/today');await expect(practice.getByRole('button',{name:'继续',exact:true})).toBeVisible();await practice.getByRole('button',{name:'重来',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();assert.equal((await rows('sessions')).length,1);assert.deepEqual(await rows('attempts'),savedBefore);await practice.getByRole('button',{name:'重来',exact:true}).click();await page.getByRole('dialog').locator('button[data-mode=practice]').click();await expect(page.locator('.audio-player')).toBeVisible();const all=await rows('sessions');assert.equal(all.length,2);const fresh=all.find(item=>item.id!==session.id);assert.notEqual(fresh.lesson.id,session.lesson.id);assert(fresh.lesson.materials.every(material=>!session.lesson.materials.some(old=>old.rootId===material.rootId)));const kept=all.find(item=>item.id===session.id);for(const field of ['lesson','contentHash','status','position','draft'])assert.deepEqual(kept[field],before[field]);assert.deepEqual(await rows('attempts'),savedBefore);await page.goto('http://127.0.0.1:8787/learn/'+session.id);await expect(page.locator('.feedback')).toContainText('回答正确');
    }
    await page.reload(); await expect(page.locator('.feedback')).toBeVisible();
    if (index === 0) await page.getByRole('button', { name: '下一题', exact: true }).click();
  }
  const saved = await rows('attempts'); assert.equal(saved.length, 2); assert(saved.every(record => record.correct && record.assistance.audioCompleted));
  for (const width of [320,375,768,1024,1200,1440]) { await page.setViewportSize({width,height:812}); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); }
  await page.screenshot({ path: 'output/playwright/a1-word-listening-1440-light-zh-Hans-offline.png' });
  await page.getByRole('link', { name: '返回今日', exact: true }).click();
  await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  if(process.argv.includes('--reselect'))await practice.getByRole('button',{name:'继续',exact:true}).click();else {
  await practice.getByRole('button', { name: '开始', exact: true }).click();
  await page.getByRole('dialog').locator('button[data-mode=practice]').click();}
  const fresh = (await rows('sessions')).find(item => item.id !== session.id);
  assert(fresh.lesson.materials.every(material => !session.lesson.materials.some(old => old.rootId === material.rootId)));
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  console.log('PASS: A1 selects actual single-word recordings; IPA installation, disconnected ended-event gating, two scored saves/reload, unseen fresh words and six widths. Source-specific audio review remains separate.' + (process.argv.includes('--reselect')?' Reselection preview/cancel/new start preserves old active session and audio-completed answer.':''));
} finally { await context.close(); await browser.close(); }
