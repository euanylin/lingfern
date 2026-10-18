import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
const stageRun = process.env.LINGFERN_ACTION_FAMILY === 'stage';
const family = stageRun ? 'stage-action' : 'action-selection';
const prompt = stageRun ? 'Which action is required ' : 'What must the player do if ';
const packIds = stageRun ? ['wikipedia-reading-008', 'wikipedia-reading-009'] : ['wikipedia-reading-018', 'wikipedia-reading-021'];
const maxWords = stageRun ? 500 : 300;
const startingPoint = stageRun ? 'C1' : 'B2';
const catalogue = JSON.parse(readFileSync('content/source-packs.json', 'utf8'));
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false } });
let practiceSeed;
try {
  const { corpusLesson, corpusActionSelection, corpusCondition, corpusEvaluation, corpusAttributionPairs, corpusRestoration, corpusSequence, corpusQualification, corpusAttribution, corpusDates, corpusRequests, corpusRoleActions } = await server.ssrLoadModule('/src/core/corpus.ts');
  const { inspectCommunityPack } = await server.ssrLoadModule('/src/data/communityPack.ts');
  const { reviewedReading } = await server.ssrLoadModule('/src/data/corpus.ts');
  const installed = [];
  // Dexie profile index traverses the composite primary key in package-hash order.
  const entries = catalogue.packs.filter(pack => packIds.includes(pack.id)).sort((a, b) => a.sha256.localeCompare(b.sha256));
  for (const entry of entries) {
    const bytes = readFileSync('public' + entry.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    installed.push(...(await inspectCommunityPack(bytes)).corpus.records);
  }
  const records = await reviewedReading([...['voa', 'gutenberg'].flatMap(source => JSON.parse(readFileSync('public/corpus/' + source + '.json', 'utf8')).records), ...installed]);
  const pool = records.flatMap(source => source.passages).filter(p => !p.startingPoints && p.wordCount <= maxWords && (p.task || corpusRestoration(p.text,0,p.language) || corpusSequence(p.text,0) || corpusQualification(p.text,0) || corpusAttribution(p.text,0) || corpusDates(p.text,0) || corpusRequests(p.text,0) || corpusRoleActions(p.text,0) || corpusAttributionPairs(p.text,0) || corpusEvaluation(p.text,0) || corpusCondition(p.text,0) || corpusActionSelection(p.text,0)));
  for (const [index, passage] of pool.entries()) {
    if (!corpusActionSelection(passage.text, 0)) continue;
    const seed = 4 * pool.length + index;
    const lesson = corpusLesson({ version: 1, failures: [], records }, new Set(), seed, maxWords, startingPoint);
    if (lesson?.materials.every(material => material.questions[0].prompt.startsWith(prompt))) { practiceSeed = seed; break; }
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
  else if (Array.isArray(question.options)) await page.locator('input[name=answer]').nth(question.answer).check();
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
  for (const skill of ['听力', '阅读']) await page.getByRole('group', { name: skill, exact: true }).getByLabel(new RegExp('^' + startingPoint + ' ·')).check();
  await page.getByRole('button', { name: '保存并继续', exact: true }).click();
  await page.getByRole('button', { name: '保存并前往今日', exact: true }).click();
  const installedIds = new Set();
  for (const id of packIds) {
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
  await page.getByRole('dialog').locator('button[data-mode=practice]').click();
  const session = (await rows('sessions'))[0];
  assert.equal(new Set(session.lesson.materials.map(material => material.rootId)).size, 2);
  const taught = session.lesson.materials[0].questions[0];
  if (['completion', 'sequence'].includes(taught.kind)) assert.equal(session.lesson.materials[1].questions[0].kind, taught.kind);
  const questions = session.lesson.materials.flatMap(material => material.questions);
  console.log('ACTUAL_SESSION', JSON.stringify({ expectedSeed: practiceSeed, generation: session.lesson.generation, materials: session.lesson.materials.map(material => ({rootId: material.rootId, prompt: material.questions[0].prompt})) }));
  assert(session.lesson.materials.every(material => material.questions[0].prompt.startsWith(prompt)));
  const target = 0;
  const controls = page.locator('.option:has(input[name=answer])').first();
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
    if ([1440, 320].includes(width)) await page.screenshot({ path: `output/playwright/${family}-evidence-${width}-light-zh-Hans-offline.png` });
  }

  for (const height of [480, 360]) {
    await page.setViewportSize({ width: 375, height }); await openSheet();
    const panel = page.locator('.question-panel');
    await panel.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))));
    const bounds = await panel.boundingBox();
    assert(bounds && bounds.x >= -1 && bounds.x + bounds.width <= 376 && bounds.y >= -1 && bounds.y + bounds.height <= height + 1);
    assert(await controls.evaluate(element => element.scrollWidth <= element.clientWidth));
    for (const trigger of await page.locator('.option:has(input[name=answer])').all()) {
      const target = await trigger.boundingBox(); assert(target && target.width >= 44 && target.height >= 44);
    }
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  assert(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize)) >= 32);
  assert(await controls.evaluate(element => element.scrollWidth <= element.clientWidth));
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await answer(questions[target]);
  await expect(page.locator('.feedback')).toContainText('回答正确');
  await expect(page.locator('.feedback')).toContainText(session.lesson.materials[0].blocks[0].text.slice(questions[target].evidence.start, questions[target].evidence.end));
  const saved = (await rows('attempts')).find(row => row.questionId === questions[target].id);
  assert(saved.correct === true && saved.rootId === session.lesson.materials[0].rootId);

  await page.screenshot({ path: `output/playwright/${family}-evidence-375-light-zh-Hans-offline.png` });
  await page.reload(); await expect(page.locator('.feedback')).toContainText('回答正确'); await openSheet();
  assert.equal((await rows('attempts')).filter(row => row.questionId === questions[target].id).length, 1);
  for (let index = 1; index < questions.length; index++) {
    await page.getByRole('button', { name: '下一题', exact: true }).click();
    await expect(page.locator('#learning-question h2').first()).toHaveText(questions[index].prompt);
    await openSheet();
    if (questions[index].kind === 'response') {
      const material = session.lesson.materials[Math.floor(index / 2)];
      const question = material.questions[0];
      const quote = material.blocks[0].text.slice(question.evidence.start, question.evidence.end);
      const other = question.additionalEvidence[0];
      const otherQuote = material.blocks[0].text.slice(other.start, other.end);
      await page.locator('.response-answer textarea').fill(`The source requires an action in this context: “${quote}”. The other context is “${otherQuote}”. I retain both complete contexts and action bundles.`);
      await page.getByRole('button', { name: '保存答案', exact: true }).click();
      await expect(page.locator('.feedback')).toContainText('未自动评分');
    } else {
      const question = questions[index];
      await page.locator('input[name=answer]').nth((question.answer + 1) % question.options.length).check();
      await page.getByRole('button', { name: '保存答案', exact: true }).click();
      await expect(page.locator('.feedback')).toContainText('再看一看');
    }
  }
  const attempts = await rows('attempts'); assert.equal(attempts.length, 4);
  assert.equal(attempts.filter(attempt => attempt.correct === true).length, 1);
  assert.equal(attempts.filter(attempt => attempt.correct === null).length, 2);
  assert.equal(attempts.filter(attempt => attempt.correct === false).length, 1);
  await page.reload(); await expect(page.locator('.feedback')).toContainText('未自动评分'); await openSheet();
  assert.equal((await rows('attempts')).length, 4);
  await page.goto(origin + '/today'); await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  console.log(`PASS: actual source download; local ${family} evidence on an unfamiliar root; one correct/one incorrect action choice plus two unscored conditional response interpretations; offline save/reload and six widths1440/1200/1024/768/375/320. No authored lesson import.`);
} finally { await browser.close(); }
