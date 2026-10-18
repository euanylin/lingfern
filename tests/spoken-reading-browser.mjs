import { chromium, expect } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { corpusInterestMatch, corpusPracticeHistory } from '../src/core/corpusPractice.ts';
import { showLearningPane } from './browser/learning-pane.ts';

// Local-only real bank acceptance; no learner profile or raw source enters CI.
const origin = 'http://127.0.0.1:8787';
const starting = process.argv.find(arg => arg.startsWith('--starting='))?.slice(11);
const beginner = starting === 'A1' || starting === 'A2';
const dueFallback = process.argv.includes('--due-fallback');
const due = process.argv.includes('--due');
const retry = process.argv.includes('--retry');
let retried = false;
const interest = process.argv.includes('--interest') ? 'daily-life' : undefined;
const touch = process.argv.includes('--touch');
const sourceName = beginner ? 'VOA Learning English' : 'Wikipedia contributors';
assert(!starting || ['A1','A2','B1','B2','C1','C2'].includes(starting));
const directory = process.argv.find(arg => arg.startsWith('--bank-directory='))?.slice(17) ?? 'private/corpus/spoken/reading-packs';
const files = (await readdir(directory)).filter(name => name.endsWith('.zip')).sort().map(name => `${directory}/${name}`);
const inventory = JSON.parse(await readFile(`${directory}/inventory.json`, 'utf8'));
assert.equal(files.length, inventory.packs.length);
assert(inventory.roots >= 1000);
if (inventory.textReview) assert.equal(inventory.roots, 1076 - inventory.textReview.withheld.length);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1440, height: 900 }, hasTouch: touch });
const page = await context.newPage();
const errors = [], external = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', route => {
  if (route.request().url().startsWith(origin + '/')) return route.continue();
  external.push(route.request().url()); return route.abort();
});
async function rows(table) {
  return page.evaluate(table => new Promise((resolve, reject) => {
    const open = indexedDB.open('lingfern');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, request = db.transaction(table).objectStore(table).getAll();
      request.onsuccess = () => { resolve(request.result); db.close(); };
      request.onerror = () => { reject(request.error); db.close(); };
    };
  }), table);
}
try {
  await page.goto(`${origin}/library`);
  await page.evaluate(() => Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('SERVICE_WORKER_READY_TIMEOUT')), 30000))]));
  await page.reload();
  assert(await page.evaluate(() => !!navigator.serviceWorker.controller));
  if (beginner) {
    const row = page.locator('.package-row').filter({ hasText: '阅读语料' });
    await row.getByRole('checkbox').check();
    await page.getByRole('button', { name: '下载所选资源', exact: true }).click();
    await expect(row).toContainText('已安装', { timeout: 60000 });
  }
  await context.setOffline(true);
  await page.getByLabel('导入 ZIP').setInputFiles(files);
  await expect(page.locator('.community-import').getByRole('status').filter({ hasText: '资源已安装' })).toContainText('资源已安装', { timeout: 180000 });
  const packs = await rows('communityPacks');
  assert.equal(packs.length, inventory.packs.length);
  if ((directory.includes('annotated') || directory.includes('review-filtered'))) assert(packs.every(pack => pack.corpus.records.every(source => source.passages.every(passage => passage.language?.tokens.length > 0))));
  assert(packs.every(pack => pack.state === 'ready' && pack.lessons.length === 0));
  assert.equal(packs.reduce((sum, pack) => sum + pack.corpus.records.length, 0), inventory.roots);
  if (inventory.textReview) for (const root of inventory.textReview.withheld) assert(packs.every(pack => pack.corpus.records.every(record => record.rootId !== root)));
  await page.getByLabel('导入 ZIP').setInputFiles([
    { name: 'valid.zip', mimeType: 'application/zip', buffer: await readFile(files[0]) },
    { name: 'invalid.zip', mimeType: 'application/zip', buffer: Buffer.from('invalid archive') },
  ]);
  await expect(page.locator('.community-import').getByRole('status').filter({ hasText: '资源包无效' })).toBeVisible();
  assert.equal((await rows('communityPacks')).filter(pack => pack.state === 'ready').length, inventory.packs.length);
  await page.goto(`${origin}/today`);
  if (starting) {
    await page.goto(`${origin}/start`);
    for (let step = 0; step < 2; step++) await page.getByRole('button', { name: '跳过这一步', exact: true }).click();
    if (interest) { await page.getByLabel('日常生活', { exact: true }).check(); await page.getByRole('button', { name: '保存并继续', exact: true }).click(); }
    else await page.getByRole('button', { name: '跳过这一步', exact: true }).click();
    await page.getByRole('group', { name: '阅读', exact: true }).getByLabel(new RegExp('^' + starting + ' ·')).check();
    await page.getByRole('group', { name: '听力', exact: true }).getByLabel(/^C2 ·/).check();
    await page.getByRole('button', { name: '保存并继续', exact: true }).click();
    await page.getByRole('button', { name: '保存并前往今日', exact: true }).click();
    assert((await rows('profiles')).some(profile => profile.preferences?.reading === starting));
  }
  const practice = page.locator('.corpus-practice[data-skill=reading]');
  await expect(practice.locator('.setting-trigger')).toHaveCount(0);
  const forcedKind = process.argv.includes('--table') ? 'table' : process.argv.includes('--speakers') ? 'matching' : process.argv.includes('--qualification') ? 'evidence' : undefined;
  if (forcedKind) {
    if (forcedKind !== 'evidence') assert(beginner, 'Speaker acceptance requires a supported beginner starting point');
    const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false } });
    try {
      const { corpusLesson } = await server.ssrLoadModule('/src/core/corpus.ts');
      const corpus = forcedKind !== 'evidence' ? JSON.parse(await readFile('public/corpus/voa.json', 'utf8')) : { version: 1, records: packs.flatMap(pack => pack.corpus.records), failures: [] };
      const maxWords = corpusPracticeHistory([], [], 'test', 'reading', 'all', starting).maxWords;
      let seed;
      for (let candidate = 0; candidate < 1000; candidate++) {
        const lesson = corpusLesson(corpus, new Set(), candidate, maxWords, forcedKind !== 'evidence' ? starting : undefined, interest ? [interest] : []);
        if (lesson?.materials.some(material => material.questions.some(question => forcedKind !== 'evidence' ? question.kind === forcedKind : question.id.endsWith('-qualify')))) { seed = candidate; break; }
      }
      assert.notEqual(seed, undefined, 'Real sources must support the requested generation kind');
      await page.evaluate(seed => {
        const original = crypto.getRandomValues.bind(crypto);
        crypto.getRandomValues = array => { crypto.getRandomValues = original; if (array instanceof Uint32Array && array.length === 1) { array[0] = seed; return array; } return original(array); };
      }, seed);
    } finally { await server.close(); }
  }
  await practice.getByRole('button', { name: '开始', exact: true }).click();
  await expect(page.getByRole('dialog').locator('a[href^="https://' + (beginner ? 'learningenglish.voanews.com/' : 'en.wikipedia.org/') + '"]')).toHaveCount(2);
  await expect(page.getByRole('dialog')).toContainText(beginner ? 'public domain' : 'CC BY-SA');
  await expect(page.getByRole('dialog').locator('.eyebrow')).toHaveText('READING');
  await page.getByRole('dialog').locator('button[data-mode=practice]').click();
  const session = (await rows('sessions'))[0];
  if (process.argv.includes('--qualification')) assert(session.lesson.materials.some(material => material.questions.some(question => forcedKind !== 'evidence' ? question.kind === forcedKind : question.id.endsWith('-qualify'))));
  if (starting) assert.equal(session.lesson.generation.startingPoint, starting);
  if (interest) { assert((await rows('profiles')).some(profile => profile.preferences?.interests.includes(interest))); assert(session.lesson.materials.every(material => corpusInterestMatch(material.title + '\n' + material.blocks[0].text, [interest]))); }
  if (beginner) {
    assert(session.lesson.materials.every(material => material.blocks[0].text.trim().split(/\s+/).length <= 80));
    await expect(page.locator('.teaching')).toContainText('先阅读');
  }
  if (starting === 'B1') assert(session.lesson.materials.every(material => material.blocks.reduce((sum, block) => sum + block.text.trim().split(/\s+/).length, 0) <= 220));
  await expect(page.locator('.session-meta')).toHaveCount(0);
  assert.equal(session.lesson.skill, 'reading');
  await expect(page.getByText('离线', { exact: true })).toBeVisible();
  await expect(page.getByText(/尚未确认资源完整安装/)).toHaveCount(0);
  assert(session.lesson.materials.every(material => material.rootId.startsWith(beginner ? 'voa-article-' : 'wikipedia-article-') && material.credit?.sourceUrl.startsWith(beginner ? 'https://learningenglish.voanews.com/' : 'https://en.wikipedia.org/')));
  assert.equal(new Set(session.lesson.materials.map(material => material.rootId)).size, 2);
  if (!beginner && (directory.includes('annotated') || directory.includes('review-filtered'))) for (const material of session.lesson.materials) {
    const passage = packs.flatMap(pack => pack.corpus.records).flatMap(source => source.passages).find(passage => 'corpus-' + passage.id === material.id);
    for (const question of material.questions) if ('kind' in question && question.kind === 'completion')
      assert(passage.language.tokens.some(token => passage.text.slice(token.start, token.end) === question.answer));
  }
  await expect(page.locator('.learning-grid + .source')).toContainText(sourceName);
  for (const width of [1440, 1200, 1024, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 812 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('.material .passage').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `output/playwright/wikipedia-local-reading-${width}-light-zh-Hans-offline.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('#question-sheet-content')).not.toHaveAttribute('inert');
  const questions = session.lesson.materials.flatMap(material => material.questions);
  if (forcedKind) assert(questions.some(question => question.kind === forcedKind));
  for (let index = 0; index < questions.length; index++) {
    const question = questions[index];
    await expect(page.locator('.question-panel form h2')).toHaveText(question.prompt);
    await expect(page.locator('.feedback')).not.toBeVisible();
    if (question.kind === 'completion') { await page.locator('.completion-answer input').fill(question.answer); await expect(page.locator('.completion-answer input')).toHaveValue(question.answer); }
    else if (question.kind === 'sequence') for (const sentence of question.acceptedOrders[0]) await page.locator('.sequence-choices button').filter({ hasText: sentence }).click();
    else if (question.kind === 'evidence') await page.locator('.evidence-option input').nth(question.accepted[0]).check();
    else if (question.kind === 'table') {
      for (const width of [1440, 1200, 1024, 768, 375, 320]) {
        await page.setViewportSize({ width, height: 812 });
        await showLearningPane(page, 'question');
        await page.locator('.question-panel').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        for (const row of question.rows) {
          const bounds = await page.getByRole('textbox', { name: row.label, exact: true }).boundingBox();
          assert(bounds && bounds.width >= 44 && bounds.height >= 44);
        }
        await page.screenshot({ path: `output/playwright/corpus-table-${width}-light-zh-Hans-offline.png` });
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      for (const [rowIndex, row] of question.rows.entries()) {
        await page.getByRole('textbox', { name: row.label, exact: true }).fill(row.answer);
        if (!rowIndex) {
          await expect(page.getByRole('button', { name: '保存答案', exact: true })).toBeDisabled();
          await expect.poll(async () => (await rows('sessions')).find(item => item.id === session.id).draft).toEqual(question.rows.map((item, i) => i ? '' : item.answer));
          await page.reload();
          await expect(page.getByRole('textbox', { name: row.label, exact: true })).toHaveValue(row.answer);
        }
      }
    }
    else if (question.kind === 'matching') {
      for (const width of [1440, 1200, 1024, 768, 375, 320]) {
        await page.setViewportSize({ width, height: 812 });
        await showLearningPane(page, 'question');
        await page.locator('.question-panel').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        for (const pair of question.pairs) {
          const bounds = await page.getByRole('button', { name: pair.label, exact: true }).boundingBox();
          assert(bounds && bounds.width >= 44 && bounds.height >= 44);
          assert(await page.getByRole('button', { name: pair.label, exact: true }).locator('span').first().evaluate(element => element.scrollWidth <= element.clientWidth));
        }
        await page.screenshot({ path: `output/playwright/corpus-speakers-${width}-light-zh-Hans-offline.png` });
      }
      await page.setViewportSize({ width: touch ? 320 : 1440, height: touch ? 480 : 900 });
      await showLearningPane(page, 'question');
      for (const [pairIndex, pair] of question.pairs.entries()) {
        const trigger = page.getByRole('button', { name: pair.label, exact: true });
        if (touch) await trigger.tap(); else await trigger.click();
        const option = page.getByRole('listbox', { name: pair.label, exact: true }).getByRole('option', { name: pair.answer, exact: true });
        if (touch) await option.tap(); else await option.click();
        if (pairIndex === 0) {
          await expect(page.getByRole('button', { name: '保存答案', exact: true })).toBeDisabled();
          await expect.poll(async () => (await rows('sessions')).find(row => row.id === session.id).draft).toEqual([pair.answer, '']);
          await page.reload();
          await showLearningPane(page, 'question');
          await expect(page.getByRole('button', { name: pair.label, exact: true })).toHaveAttribute('data-value', pair.answer);
          await expect(page.getByRole('button', { name: question.pairs[1].label, exact: true })).toHaveAttribute('data-value', '');
          if (touch) {
            await page.locator('.question-sheet-scrim').tap({ position: { x: 48, y: 100 } });
            await expect(page.locator('.question-panel')).toHaveAttribute('data-open', 'false');
            await expect(page.locator('#question-sheet-content')).toHaveAttribute('inert');
            await page.locator('.question-sheet-toggle').tap();
            await expect(page.locator('.question-panel')).toHaveAttribute('data-open', 'true');
            await expect(page.getByRole('button', { name: pair.label, exact: true })).toHaveAttribute('data-value', pair.answer);
          }
        }
      }
    }
    else await page.locator('.response-answer textarea').fill('The passage describes a topic through specific source details. My interpretation remains limited to the quoted evidence.');
    if (retry && question.kind === 'matching') {
      const pair = question.pairs[0];
      await page.getByRole('button', { name: pair.label, exact: true }).click();
      await page.getByRole('listbox', { name: pair.label, exact: true }).getByRole('option', { name: question.choices.find(name => name !== pair.answer), exact: true }).click();
      retried = true;
    }
    console.log(`Saving real-bank question ${index + 1}: ${question.kind}`);
    const submit = page.getByRole('button', { name: '保存答案', exact: true });
    if (touch && question.kind === 'matching') {
      await expect(page.locator('header.session-header')).toHaveCount(1);
      await submit.scrollIntoViewIfNeeded();
      assert(await submit.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
      }), 'Submit must receive the touch without an overlay');
      await submit.tap();
    } else await submit.click();
    await expect(page.locator('.feedback')).toBeVisible();
    if (beginner && question.kind === 'response') await expect(page.locator('.self-assessment')).toContainText('我的句子符合材料内容。');
    await page.reload();
    if (touch && question.kind === 'matching') await showLearningPane(page, 'question');
    await expect(page.locator('.feedback')).toBeVisible();
    await expect(page.locator('.learning-grid + .source')).toContainText(sourceName);
    if (question.kind === 'table') {
      await expect(page.locator('.feedback h2')).toContainText('正确');
      await expect(page.locator('.feedback blockquote')).toHaveCount(question.rows.length);
      for (const [rowIndex, row] of question.rows.entries()) {
        await expect(page.locator('.feedback blockquote').nth(rowIndex)).toContainText(row.label + ':');
        await expect(page.locator('.feedback blockquote').nth(rowIndex)).toContainText(row.answer);
      }
    }
    if (question.kind === 'matching') {
      await expect(page.locator('.feedback blockquote')).toHaveCount(2);
      for (const [pairIndex, pair] of question.pairs.entries()) {
        await expect(page.locator('.feedback blockquote').nth(pairIndex)).toContainText(pair.answer + ':');
        await expect(page.locator('.feedback blockquote').nth(pairIndex)).toContainText(pair.label);
      }
    }
    if (touch && question.kind === 'matching') {
      await page.locator('.question-panel').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
      await page.locator('.question-sheet-scrim').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
      await page.locator('.feedback h2').scrollIntoViewIfNeeded();
      await expect(page.locator('.feedback h2')).toBeInViewport();
      await expect(page.locator('.feedback h2')).toContainText('正确');
      await page.screenshot({ path: 'output/playwright/corpus-speakers-320x480-light-zh-Hans-offline-touch-saved.png' });
      await page.setViewportSize({ width: 1440, height: 900 });
    }
    if (index === 0) {
      await page.locator('.ai-handoff > summary').click();
      await expect(page.locator('.ai-preview')).toContainText(sourceName);
      await expect(page.locator('.ai-preview')).toContainText(beginner ? 'public domain' : 'CC BY-SA');
      await expect(page.locator('.ai-preview')).not.toContainText('B2 /');
      await expect(page.locator('.ai-preview')).toContainText(session.lesson.materials[0].credit.sourceUrl);
      await page.locator('.ai-handoff > summary').click();
    }
    if (index < questions.length - 1) await page.getByRole('button', { name: '下一题', exact: true }).click();
  }
  const saved = await rows('attempts');
  assert.equal(saved.length, 4); assert.equal(saved.filter(answer => answer.correct === null).length, 2);
  await page.getByRole('link', { name: '返回今日', exact: true }).click();
  await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  await page.goto(`${origin}/progress`);
  await expect(page.locator('.progress-source-list .progress-cell')).toHaveCount(1);
  await expect(page.locator('.progress-matrix')).toHaveCount(0);
  await page.locator('.progress-source-list .progress-cell').click();
  await expect(page.locator('.progress-record-detail')).toContainText('建议下次复习');
  await expect(page.locator('.progress-record-detail')).toContainText('独立完成的不同材料: 0');
  const latestSaved = Math.max(...saved.map(answer => Date.parse(answer.submittedAt)));
  await expect(page.locator('.progress-record-detail > p.muted time')).toHaveText(new Date(latestSaved + 86400000).toLocaleDateString('zh-Hans'));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator('.progress-record-detail').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'output/playwright/corpus-recurrence-375-light-zh-Hans-offline.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  if (due) await page.clock.setFixedTime(new Date(latestSaved + 86400001));
  if (dueFallback) {
    assert(due && beginner);
    const roots = JSON.parse(await readFile('public/corpus/voa.json', 'utf8')).records.filter(source => source.passages[0].startingPoints).map(source => source.rootId);
    // Isolated exposure metadata only: simulate known roots with some unseen passages, not actual reading/review approval.
    await page.evaluate(({ profileId, roots }) => new Promise((resolve, reject) => {
      const open = indexedDB.open('lingfern'); open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result, tx = db.transaction('exposures', 'readwrite'), store = tx.objectStore('exposures');
        for (const rootId of roots) {
          const get = store.get([profileId, rootId]);
          get.onsuccess = () => { if (!get.result) store.put({ profileId, rootId, firstSeenAt: new Date().toISOString() }); };
        }
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); };
      };
    }), { profileId: session.profileId, roots });
  }
  await page.goto(`${origin}/today`);
  const policy = corpusPracticeHistory(await rows('sessions'), saved, session.profileId, 'reading', 'all', starting);
  assert.equal(policy.independent, !retry);
  if (retry) { assert(retried); assert.equal(policy.focus.kind, 'matching'); }
  assert.equal(policy.maxWords, retry && starting === 'A1' ? 120 : starting === 'A1' ? 160 : starting === 'A2' ? 220 : starting === 'B1' ? 300 : 500);
  await practice.getByRole('button', { name: '开始', exact: true }).click();
  if (dueFallback) await expect(page.getByRole('dialog')).not.toContainText('复习:');
  if (due && !dueFallback) {
    await expect(page.getByRole('dialog')).toContainText('复习:');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole('dialog').locator('.muted').filter({ hasText: '复习:' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'output/playwright/corpus-due-375-light-zh-Hans-offline.png' });
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  if (retry) {
    await expect(page.getByRole('dialog')).toContainText('巩固: 信息配对');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole('dialog').locator('.muted').filter({ hasText: '巩固: 信息配对' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'output/playwright/corpus-focus-375-light-zh-Hans-offline.png' });
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  await page.getByRole('dialog').locator('button[data-mode=practice]').click();
  const fresh = (await rows('sessions')).find(item => item.id !== session.id);
  if (due) { assert(fresh.lesson.generation.focus); assert(fresh.lesson.materials.some(material => material.questions.some(question => question.kind === fresh.lesson.generation.focus))); if (!dueFallback) assert(fresh.lesson.materials.every(material => !session.lesson.materials.some(old => old.rootId === material.rootId))); }
  if (retry) { assert.equal(fresh.lesson.generation.focus, 'matching'); assert(fresh.lesson.materials.some(material => material.questions.some(question => question.kind === 'matching'))); }
  assert(fresh.lesson.materials.every(material => material.blocks.reduce((sum, block) => sum + block.text.trim().split(/\s+/).length, 0) <= policy.maxWords));
  assert(fresh && fresh.lesson.materials.every(material => !session.lesson.materials.some(old => old.id === material.id)));
  if (beginner) {
    await page.goto(`${origin}/library/dictionary`);
    for (const [term, definition] of [
      ['supermarket', 'A large shop where people buy food and things for their home.'],
      ['dinner', 'The main meal of the day, often eaten in the evening.'],
      ['wrong number', 'A telephone number for a different person from the one you want to call.'],
    ]) {
      await page.getByRole('combobox').fill(term);
      await page.getByRole('combobox').press('Enter');
      await expect(page.locator('.dictionary-results')).toContainText(definition);
    }
    await page.goto(`${origin}/today`);
    await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  }
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  if (touch) console.log('PASS: touch matching at320x480, partial recovery, outside collapse/reopen and unobstructed submission.');
  console.log(`PASS: all ${packs.length} real reading banks/${inventory.roots} original article roots batch-import offline; client generates from two roots, retains attribution, saves four responses with two unscored, reloads, selects fresh excerpts; six widths, zero external requests. Audio bank integration remains separate.`);
} finally { await context.close(); await browser.close(); }
