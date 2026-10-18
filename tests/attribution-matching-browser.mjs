import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
const requestLet = process.argv.includes('--request-let');
const b1 = process.argv.includes('--b1');
const reports = requestLet || b1 || process.argv.includes('--reports');
const level = requestLet ? 'C2' : b1 ? 'B1' : 'B2', maxWords = requestLet ? 1200 : b1 ? 220 : 300;
const family = requestLet ? 'request-let' : b1 ? 'b1-report' : reports ? 'named-report' : 'source';
const sourceIds = requestLet ? ['wikipedia-reading-017'] : b1 ? ['wikipedia-reading-005', 'wikipedia-reading-013'] : reports ? ['wikipedia-reading-004', 'wikipedia-reading-013'] : ['wikipedia-reading-003', 'wikipedia-reading-005'];
const expectedRoots = requestLet ? ['wikipedia-article-18362', 'gutenberg-book-1661'] : [b1 ? 'wikipedia-article-24659645' : 'wikipedia-article-3986', 'wikipedia-article-182053'];
const prompt = requestLet ? 'Match each action to what the request asks for or rules out.' : 'Match each claim to the source named in the passage.';
const catalogue = JSON.parse(readFileSync('content/source-packs.json', 'utf8'));
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false } });
let practiceSeed;
try {
  const { corpusLesson, corpusAttributionPairs, corpusRestoration, corpusSequence, corpusQualification, corpusAttribution, corpusDates, corpusRequests, corpusRoleActions, corpusEvaluation, corpusCondition, corpusAssignment, corpusConcession, corpusActionSelection, corpusQualifiedCause } = await server.ssrLoadModule('/src/core/corpus.ts');
  const { inspectCommunityPack } = await server.ssrLoadModule('/src/data/communityPack.ts');
  const { reviewedReading } = await server.ssrLoadModule('/src/data/corpus.ts');
  const installed = [];
  // Dexie profile index traverses the composite primary key in package-hash order.
  const entries = catalogue.packs.filter(pack => sourceIds.includes(pack.id)).sort((a, b) => a.sha256.localeCompare(b.sha256));
  for (const entry of entries) {
    const bytes = readFileSync('public' + entry.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    installed.push(...(await inspectCommunityPack(bytes)).corpus.records);
  }
  const records = await reviewedReading([...['voa', 'gutenberg'].flatMap(source => JSON.parse(readFileSync('public/corpus/' + source + '.json', 'utf8')).records), ...installed], maxWords);
  const pool = records.flatMap(source => source.passages).filter(p => !p.startingPoints && p.wordCount <= maxWords && (p.task || corpusRestoration(p.text,0,p.language) || corpusSequence(p.text,0) || corpusQualification(p.text,0) || corpusAttribution(p.text,0) || corpusDates(p.text,0) || corpusRequests(p.text,0) || corpusRoleActions(p.text,0) || corpusAttributionPairs(p.text,0) || corpusEvaluation(p.text,0) || corpusCondition(p.text,0) || corpusAssignment(p.text,0) || corpusConcession(p.text,0) || corpusActionSelection(p.text,0) || corpusQualifiedCause(p.text,0)));
  for (const [index, passage] of pool.entries()) {
    if (!(requestLet ? corpusRequests(passage.text, 0) : corpusAttributionPairs(passage.text, 0))) continue;
    const seed = (requestLet ? 6 : 1) * pool.length + index;
    const lesson = corpusLesson({ version: 1, failures: [], records }, new Set(), seed, maxWords, level);
    if (lesson?.materials.every(material => material.questions[0].prompt === prompt && (!reports || expectedRoots.includes(material.rootId) && (requestLet || b1 || material.questions[0].pairs.some(pair => /^(?:argued|argues) that /.test(pair.label)))))) { practiceSeed = seed; break; }
  }
  assert.notEqual(practiceSeed, undefined, 'Default normal generation needs two attributed sources');
} finally { await server.close(); }
const origin = 'http://127.0.0.1:8787';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage(), downloads = [];
await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
page.on('response', response => { if (response.url().includes('/source-packs/')) downloads.push(response.url()); });
async function rows(table) {
  return page.evaluate(table => new Promise((resolve, reject) => {
    const open = indexedDB.open('lingfern'); open.onerror = () => reject(open.error);
    open.onsuccess = () => { const db = open.result, request = db.transaction(table).objectStore(table).getAll(); request.onsuccess = () => { resolve(request.result); db.close(); }; request.onerror = () => reject(request.error); };
  }), table);
}
async function openSheet() {
  await expect(page.locator('.question-panel')).toBeVisible();
  const toggle = page.locator('.question-sheet-toggle');
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
}
async function answer(question) {
  if (question.kind === 'completion') await page.locator('.completion-answer input').fill(question.answer);
  else if (question.kind === 'table') for (const [i, row] of question.rows.entries()) await page.locator('.answer-table input').nth(i).fill(row.answer);
  else if (question.kind === 'matching') for (const pair of question.pairs) { await page.getByRole('button', { name: pair.label, exact: true }).click(); await page.getByRole('option', { name: pair.answer, exact: true }).click(); }
  else if (question.kind === 'sequence') for (const step of question.acceptedOrders[0]) await page.locator('.sequence-choices button').filter({ hasText: step }).click();
  else if (question.kind === 'evidence') await page.locator('input[name=answer]').nth(question.accepted[0]).check();
  else if (question.kind === 'response') await page.locator('.response-answer textarea').fill('The passage gives an instruction. I would support my interpretation with its exact wording.');
  else throw Error('Unexpected task');
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await expect(page.locator('.feedback')).toBeVisible();
}
try {
  await page.goto(origin + '/library');
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated');
  await page.reload();
  const readingResources = page.locator('.package-row').filter({ hasText: '阅读语料' });
  await readingResources.getByRole('checkbox').check();
  await page.getByRole('button', { name: '下载所选资源', exact: true }).click();
  await expect(readingResources).toContainText('已安装', { timeout: 90000 });
  await page.goto(origin + '/start');
  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: '跳过这一步', exact: true }).click();
  for (const skill of ['听力', '阅读']) await page.getByRole('group', { name: skill, exact: true }).getByLabel(new RegExp('^' + level + ' ·')).check();
  await page.getByRole('button', { name: '保存并继续', exact: true }).click();
  await page.getByRole('button', { name: '保存并前往今日', exact: true }).click();
  const installedIds = new Set();
  for (const id of sourceIds) {
    const available = catalogue.packs.filter(pack => pack.skill === 'reading' && !installedIds.has(pack.id) && pack.minWords !== null && pack.minWords <= maxWords);
    const packSeed = available.findIndex(pack => pack.id === id); assert(packSeed >= 0);
    await page.evaluate(packSeed => { const original = crypto.getRandomValues.bind(crypto); crypto.getRandomValues = values => values instanceof Uint32Array && values.length === 2 ? (values[0] = packSeed, values[1] = 0, values) : original(values); }, packSeed);
    await page.locator('.corpus-practice[data-skill=reading]').getByRole('button', { name: '开始', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 90000 });
    assert(downloads.some(url => url.endsWith('/' + id + '.zip')));
    await page.getByRole('dialog').getByRole('button', { name: '关闭详情', exact: true }).click();
    installedIds.add(id);
  }
  await context.setOffline(true); await page.reload();
  await page.evaluate(seed => { const original = crypto.getRandomValues.bind(crypto); crypto.getRandomValues = values => values instanceof Uint32Array && values.length === 2 ? (values[0] = 0, values[1] = seed, values) : original(values); }, practiceSeed);
  await page.locator('.corpus-practice[data-skill=reading]').getByRole('button', { name: '开始', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  if (requestLet) {
    for (const locale of ['zh-Hans', 'zh-Hant', 'en']) for (const theme of ['light', 'dark']) {
      await page.goto(origin + '/settings');
      await page.getByRole('button', { name: /^(语言|語言|Language)$/ }).click();
      await page.getByRole('listbox').locator(`[data-value="${locale}"]`).click();
      await page.getByRole('button', { name: /^(外观|外觀|Appearance)$/ }).click();
      await page.getByRole('listbox').locator(`[data-value="${theme}"]`).click();
      await page.goto(origin + '/today');
      await page.evaluate(seed => { const original = crypto.getRandomValues.bind(crypto); crypto.getRandomValues = values => values instanceof Uint32Array && values.length === 2 ? (values[0] = 0, values[1] = seed, values) : original(values); }, practiceSeed);
      await page.locator('.corpus-practice[data-skill=reading]').getByRole('button').first().click();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const legal = page.getByRole('dialog').locator('.gutenberg-licence');
      await expect(legal).toContainText('This eBook is for the use');
      for (const width of [1440, 1200, 1024, 768, 375, 320]) {
        await page.setViewportSize({ width, height: 812 });
        const summary = legal.locator('summary'); await summary.scrollIntoViewIfNeeded(); await summary.focus();
        await page.keyboard.press('Enter'); await expect(legal.locator('details')).toHaveAttribute('open', '');
        await expect(legal.getByText('THE FULL PROJECT GUTENBERG LICENSE', { exact: true })).toBeVisible();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const box = await summary.boundingBox(); assert(box && box.height >= 44 && box.width >= 44);
        await summary.focus(); await page.keyboard.press('Enter');
        await expect(legal.locator('details')).not.toHaveAttribute('open', '');
      }
      if (locale === 'zh-Hans' && theme === 'light') await page.screenshot({ path: 'output/playwright/gutenberg-preview-320-light-zh-Hans.png' });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(origin + '/settings');
    await page.getByRole('button', { name: 'Language', exact: true }).click();
    await page.getByRole('listbox').locator('[data-value="zh-Hans"]').click();
    await page.getByRole('button', { name: '外观', exact: true }).click();
    await page.getByRole('listbox').locator('[data-value="light"]').click();
    await page.goto(origin + '/today');
    await page.evaluate(seed => { const original = crypto.getRandomValues.bind(crypto); crypto.getRandomValues = values => values instanceof Uint32Array && values.length === 2 ? (values[0] = 0, values[1] = seed, values) : original(values); }, practiceSeed);
    await page.locator('.corpus-practice[data-skill=reading]').getByRole('button').first().click();
  }
  await page.getByRole('dialog').locator('button[data-mode=practice]').click();
  const session = (await rows('sessions'))[0];
  assert.equal(new Set(session.lesson.materials.map(material => material.rootId)).size, 2);
  const taught = session.lesson.materials[0].questions[0];
  if (['completion', 'sequence'].includes(taught.kind)) assert.equal(session.lesson.materials[1].questions[0].kind, taught.kind);
  const questions = session.lesson.materials.flatMap(material => material.questions);
  console.log('ACTUAL_SESSION', JSON.stringify({ expectedSeed: practiceSeed, generation: session.lesson.generation, materials: session.lesson.materials.map(material => ({rootId: material.rootId, prompt: material.questions[0].prompt})) }));
  assert(session.lesson.materials.every(material => material.questions[0].prompt === prompt));
  if (reports) { assert.deepEqual(session.lesson.materials.map(material => material.rootId).sort(), expectedRoots.sort()); if (!requestLet) assert(session.lesson.materials[b1 ? 'some' : 'every'](material => material.questions[0].pairs.some(pair => /^(?:argued|argues) that /.test(pair.label)))); }
  if (reports && !requestLet) {
    await expect(page.locator('.teaching')).toContainText('topic, claim and limits');
    await expect(page.locator('.teaching')).toContainText('not a quarrel');
  }
  const target = 0;
  const controls = page.locator('.matching-answers');
  await expect(controls).toBeVisible();
  await expect(page.locator('#learning-question h2')).toContainText(prompt);
  for (const width of [1440, 1200, 1024, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 812 });
    const toggle = page.locator('.question-sheet-toggle');
    if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
    await expect(controls).toBeVisible();
    const panel = page.locator('.question-panel');
    await panel.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))));
    const bounds = await panel.boundingBox();
    assert(bounds && bounds.x >= -1 && bounds.x + bounds.width <= width + 1, 'Answer card extends outside the viewport');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert(await controls.evaluate(element => element.scrollWidth <= element.clientWidth));
    // Layout bounds can settle before Chromium commits the resized backdrop layer.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('header.session-header').count(), 1);
    if ([1440, 320].includes(width)) await page.screenshot({ path: `output/playwright/${family}-matching-${width}-light-zh-Hans-offline.png` });
  }

  for (const height of [480, 360]) {
    await page.setViewportSize({ width: 375, height }); await openSheet();
    const panel = page.locator('.question-panel');
    await panel.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))));
    const bounds = await panel.boundingBox();
    assert(bounds && bounds.x >= -1 && bounds.x + bounds.width <= 376 && bounds.y >= -1 && bounds.y + bounds.height <= height + 1);
    assert(await controls.evaluate(element => element.scrollWidth <= element.clientWidth));
    for (const trigger of await controls.locator('.setting-trigger').all()) {
      const target = await trigger.boundingBox(); assert(target && target.width >= 44 && target.height >= 44);
    }
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  assert(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize)) >= 32);
  assert(await controls.evaluate(element => element.scrollWidth <= element.clientWidth));
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  if (reports) {
    for (const locale of ['zh-Hans', 'zh-Hant', 'en']) for (const theme of ['light', 'dark']) {
      await page.goto(origin + '/settings');
      await page.getByRole('button', { name: /^(语言|語言|Language)$/ }).click();
      await page.getByRole('listbox').locator(`[data-value="${locale}"]`).click();
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await page.getByRole('button', { name: /^(外观|外觀|Appearance)$/ }).click();
      await page.getByRole('listbox').locator(`[data-value="${theme}"]`).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.goto(origin + '/learn/' + session.id);
      for (const width of [1440, 1200, 1024, 768, 375, 320]) {
        await page.setViewportSize({ width, height: 812 }); await openSheet();
        await controls.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        for (const trigger of await controls.locator('.setting-trigger').all()) {
          const box = await trigger.boundingBox(); assert(box && box.width >= 44 && box.height >= 44);
        }
        if ([1440, 320].includes(width)) await page.screenshot({ path: `output/playwright/${family}-${width}-${theme}-${locale}-offline.png` });
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(origin + '/settings');
    await page.getByRole('button', { name: 'Language', exact: true }).click();
    await page.getByRole('listbox').locator('[data-value="zh-Hans"]').click();
    await page.getByRole('button', { name: '外观', exact: true }).click();
    await page.getByRole('listbox').locator('[data-value="light"]').click();
    await page.goto(origin + '/learn/' + session.id); await openSheet();
  }
  await answer(questions[target]);
  await expect(page.locator('.feedback')).toContainText('回答正确');
  await expect(page.locator('.feedback')).toContainText(questions[target].pairs[0].label);
  const saved = (await rows('attempts')).find(row => row.questionId === questions[target].id);
  assert(saved.correct === true && saved.rootId === session.lesson.materials[0].rootId);

  await page.screenshot({ path: `output/playwright/${family}-matching-375-light-zh-Hans-offline.png` });
  await page.reload(); await expect(page.locator('.feedback')).toContainText('回答正确'); await openSheet();
  assert.equal((await rows('attempts')).filter(row => row.questionId === questions[target].id).length, 1);
  for (let index = 1; index < questions.length; index++) {
    await page.getByRole('button', { name: '下一题', exact: true }).click();
    await expect(page.locator('#learning-question h2').first()).toHaveText(questions[index].prompt);
    await openSheet();
    if (questions[index].kind === 'response') {
      if (reports && !requestLet && index === 1) {
        for (let hint = 0; hint < 3; hint++) await page.locator('button.hint').click();
        await expect(page.locator('.hint-text').last()).toContainText('not necessarily a quarrel');
        await expect(page.locator('.hint-text').last()).toContainText('not every possibility');
      }
      const material = session.lesson.materials[Math.floor(index / 2)];
      const claims = material.questions[0].pairs;
      await page.locator('.response-answer textarea').fill(claims.map(pair => `${pair.answer}: “${pair.label}”`).join(' '));
      await page.getByRole('button', { name: '保存答案', exact: true }).click();
      await expect(page.locator('.feedback')).toContainText('未自动评分');
    } else if (reports) {
      const question = questions[index];
      for (const pair of question.pairs) {
        await page.getByRole('button', { name: pair.label, exact: true }).click();
        await page.getByRole('option', { name: question.choices.find(choice => choice !== pair.answer), exact: true }).click();
      }
      await page.getByRole('button', { name: '保存答案', exact: true }).click();
      await expect(page.locator('.feedback')).toContainText('再看一看');
    } else { await answer(questions[index]); await expect(page.locator('.feedback')).toContainText('回答正确'); }
    await page.reload(); await openSheet(); assert.equal((await rows('attempts')).length, index + 1);
  }
  const attempts = await rows('attempts'); assert.equal(attempts.length, 4);
  assert.equal(attempts.filter(attempt => attempt.correct === true).length, reports ? 1 : 2);
  assert.equal(attempts.filter(attempt => attempt.correct === false).length, reports ? 1 : 0);
  assert.equal(attempts.filter(attempt => attempt.correct === null).length, 2);
  if (reports && !requestLet) assert.equal(attempts.find(attempt => attempt.questionId === questions[1].id).assistance.hintLevel, 3);
  await page.reload(); await expect(page.locator('.feedback')).toContainText('未自动评分'); await openSheet();
  assert.equal((await rows('attempts')).length, 4);
  if (requestLet) {
    await page.keyboard.press('Escape');
    await expect(page.locator('.gutenberg-licence').first()).toContainText('This eBook is for the use');
    await page.locator('.ai-handoff > summary').click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: '下载 JSON', exact: true }).click();
    const file = await download, stream = await file.createReadStream(); let bytes = '';
    for await (const chunk of stream) bytes += chunk.toString();
    const exported = JSON.parse(bytes); const source = exported.sections.find(section => section.text.includes('THE FULL PROJECT GUTENBERG LICENSE'));
    assert(source && source.text.includes('1.E.1.') && source.text.includes('Section 5.'));
    await page.goto(origin + '/progress');
    await page.locator('.history summary').first().click();
    await expect(page.locator('.history .gutenberg-licence')).toContainText('THE FULL PROJECT GUTENBERG LICENSE');
  }
  await page.goto(origin + '/today'); await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  console.log(`PASS: actual source download; local ${family} matching on an unfamiliar root; offline response/scoring/save/reload and six widths1440/1200/1024/768/375/320. No authored lesson import.`);
} finally { await browser.close(); }
