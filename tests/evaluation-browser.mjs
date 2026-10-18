import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
const qualifiedCause = process.argv.includes('--qualified-cause');
const longReading = qualifiedCause || process.argv.includes('--long-reading');
const maxWords = longReading ? 1200 : 300;
const level = longReading ? 'C2' : 'B2';
const longReview = longReading ? JSON.parse(readFileSync('private/corpus/check-source-review/continuous-reading-2026-10-08.json', 'utf8')) : undefined;
const digest = text => createHash('sha256').update(text).digest('hex');
let expectedWindows, corpusOperation;
const postposed = process.argv.includes('--concession-postposed');
const concession = !qualifiedCause && longReading || postposed || process.argv.includes('--concession');
const dates = process.argv.includes('--dates');
const infinitive = process.argv.includes('--infinitive');
const compose = process.argv.includes('--compose');
const assignment = compose || infinitive || process.argv.includes('--assignment');
const family = qualifiedCause ? 'qualified-cause' : longReading ? 'long-reading-concession' : postposed ? 'concession-postposed' : concession ? 'concession' : dates ? 'date-name-context' : compose ? 'compose-assignment' : infinitive ? 'infinitive-assignment' : assignment ? 'assignment' : 'evaluation';
let prompt = qualifiedCause ? undefined : concession ? 'Which sentence uses “although” or “even though” to connect contrasting ideas?' : dates ? 'Complete each sentence with the year given in the passage.' : assignment ? 'Which sentence explicitly states an assigned task?' : 'Which sentence directly names a source and reports their praise or criticism?';
const sourceIds = compose ? ['wikipedia-reading-017', 'wikipedia-reading-025'] : longReading ? ['wikipedia-reading-001', 'wikipedia-reading-007'] : postposed ? ['wikipedia-reading-001', 'wikipedia-reading-002'] : concession ? ['wikipedia-reading-001'] : dates ? ['wikipedia-reading-008', 'wikipedia-reading-010'] : infinitive ? ['wikipedia-reading-010', 'wikipedia-reading-016'] : assignment ? ['wikipedia-reading-017', 'wikipedia-reading-030'] : ['wikipedia-reading-010', 'wikipedia-reading-025'];
const catalogue = JSON.parse(readFileSync('content/source-packs.json', 'utf8'));
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false } });
let practiceSeed;
try {
  const { corpusLesson, corpusConcession, corpusEvaluation, corpusAssignment, corpusAttributionPairs, corpusRestoration, corpusSequence, corpusQualification, corpusAttribution, corpusDates, corpusRequests, corpusRoleActions, corpusCondition, corpusActionSelection, corpusQualifiedCause } = await server.ssrLoadModule('/src/core/corpus.ts');
  if (qualifiedCause) { const practice = await server.ssrLoadModule('/src/core/corpusPractice.ts'); prompt = practice.qualifiedCausePrompt; corpusOperation = practice.corpusOperation; }
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
  const records = await reviewedReading([...['voa', 'gutenberg'].flatMap(source => JSON.parse(readFileSync('public/corpus/' + source + '.json', 'utf8')).records), ...installed], longReading ? maxWords : 700);
  if (longReading) {
    expectedWindows = longReview.sources.map(review => {
      const entry = entries.find(entry => entry.id === review.package); assert.equal(entry.sha256, review.packageHash);
      const record = records.find(record => record.rootId === review.rootId); assert(record);
      assert.equal(record.sourceHash, review.sourceHash); assert.equal(digest(record.originalText), review.originalTextHash);
      const text = record.originalText.slice(review.start, review.end); assert.equal(text, review.text); assert.equal(digest(text), review.textHash);
      assert.equal(text.trim().split(/\s+/).length, review.words); assert.equal(text.length, review.chars);
      const passage = record.passages.find(passage => passage.text === text); assert(passage, `Reviewed long window not reachable at ${maxWords} words: ${review.title}`); assert.equal(passage.id, review.textHash);
      const parts = review.parts.map(part => { const passage = record.passages.find(passage => passage.id === part.id); assert(passage); assert.equal(digest(passage.text), part.hash); assert.equal(record.originalText.indexOf(passage.text), part.start); assert.equal(passage.text.length + part.start, part.end); return { passage, start: part.start }; });
      assert(passage.language); assert.equal(passage.language.generator, review.language.generator); assert.equal(passage.language.modelSha256, review.language.modelSha256);
      assert.deepEqual(passage.language.tokens, parts.flatMap(part => part.passage.language.tokens.map(token => ({ ...token, start: token.start + part.start - review.start, end: token.end + part.start - review.start }))));
      for (const token of passage.language.tokens) assert(token.start >= 0 && token.end > token.start && token.end <= text.length);
      return { rootId: review.rootId, passageId: passage.id, text, sourceHash: record.sourceHash, originalTextHash: review.originalTextHash, textHash: review.textHash, start: review.start, end: review.end, words: review.words, nlpTokens: passage.language.tokens.length, nlpHash: digest(JSON.stringify(passage.language)) };
    });
  }
  const pool = records.flatMap(source => source.passages).filter(p => !p.startingPoints && p.wordCount <= maxWords && (p.task || corpusRestoration(p.text,0,p.language) || corpusSequence(p.text,0) || corpusQualification(p.text,0) || corpusAttribution(p.text,0) || corpusDates(p.text,0) || corpusRequests(p.text,0) || corpusRoleActions(p.text,0) || corpusAttributionPairs(p.text,0) || corpusEvaluation(p.text,0) || corpusAssignment(p.text,0) || corpusConcession(p.text,0) || corpusCondition(p.text,0) || corpusActionSelection(p.text,0) || corpusQualifiedCause(p.text,0)));
  for (const [index, passage] of pool.entries()) {
    if (!qualifiedCause && !concession && !(dates ? corpusDates : assignment ? corpusAssignment : corpusEvaluation)(passage.text, 0)) continue;
    const seed = (qualifiedCause ? 13 : concession ? 12 : dates ? 0 : assignment ? 11 : 2) * pool.length + index;
    const lesson = corpusLesson({ version: 1, failures: [], records }, new Set(), seed, maxWords, level);
    const wanted = lesson?.materials.every(material => qualifiedCause ? corpusOperation(material.questions[0]) === 'choice:qualified-cause' : material.questions[0].prompt === prompt)
      && (!compose || lesson.materials.some(material => material.rootId === 'wikipedia-article-10935109' && material.blocks[0].text.includes('was assigned to compose the script.')) && lesson.materials.some(material => material.rootId === 'wikipedia-article-81194517'))
      && (!concession || longReading || lesson.materials[0].rootId === (postposed ? 'wikipedia-article-1932784' : 'wikipedia-article-40685706'))
      && (!postposed || lesson.materials.every(material => ['wikipedia-article-1932784', 'wikipedia-article-18951490'].includes(material.rootId)))
      && (!dates || lesson.materials[0].rootId === 'wikipedia-article-45094397' && lesson.materials[0].questions[0].rows.some(row => row.answer === '1910' && row.label.includes('by J. Comyns Carr')))
      && (!longReading || lesson.materials.every(material => expectedWindows.some(window => window.rootId === material.rootId && window.text === material.blocks[0].text)));
    if (wanted) { practiceSeed = seed; break; }
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
  if ('options' in question) await page.locator('input[name=answer]').nth(question.answer).check();
  else if (question.kind === 'completion') await page.locator('.completion-answer input').fill(question.answer);
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
  await page.getByRole('dialog').locator('button[data-mode=practice]').click();
  const session = (await rows('sessions'))[0];
  assert.equal(new Set(session.lesson.materials.map(material => material.rootId)).size, 2);
  if (longReading) {
    assert.equal(session.lesson.generation.startingPoint, 'C2'); assert(!session.lesson.mode);
    assert.deepEqual(session.lesson.materials.map(material => material.rootId).sort(), expectedWindows.map(window => window.rootId).sort());
    for (const material of session.lesson.materials) {
      const window = expectedWindows.find(window => window.rootId === material.rootId); assert.equal(material.blocks[0].text, window.text); assert.equal(digest(material.blocks[0].text), window.textHash); assert.equal(material.id, 'corpus-' + window.passageId); assert(window.words >= 700);
      assert.equal(material.questions.length, 2); if (qualifiedCause) { assert('options' in material.questions[0]); assert.equal(material.questions[0].options.length, 3); const question = material.questions[0]; const evidence = material.blocks[0].text.slice(question.evidence.start, question.evidence.end); assert.equal(question.prompt, prompt + '\n' + evidence); assert(/possibly|apparently because of a possible/.test(evidence)); assert(evidence.endsWith('.')); assert.equal(question.options[question.answer], 'The passage states what happened but only proposes an explanation.'); } else assert.equal(material.questions[0].kind, 'evidence'); assert.equal(material.questions[1].kind, 'response');
      for (const question of material.questions) { const block = material.blocks.find(block => block.id === question.blockId); assert(block); assert(question.evidence.start >= 0 && question.evidence.end <= block.text.length); }
      for (const span of material.questions[0].spans ?? []) assert.equal(material.blocks.find(block => block.id === span.blockId).text.slice(span.start, span.end), span.text);
    }
    console.log('EXACT_LONG_WINDOWS', JSON.stringify(expectedWindows.map(window => ({ ...window, text: undefined }))));
  }
  const taught = session.lesson.materials[0].questions[0];
  if (['completion', 'sequence'].includes(taught.kind)) assert.equal(session.lesson.materials[1].questions[0].kind, taught.kind);
  const questions = session.lesson.materials.flatMap(material => material.questions);
  console.log('ACTUAL_SESSION', JSON.stringify({ expectedSeed: practiceSeed, generation: session.lesson.generation, materials: session.lesson.materials.map(material => ({rootId: material.rootId, prompt: material.questions[0].prompt})) }));
  assert(session.lesson.materials.every(material => qualifiedCause ? corpusOperation(material.questions[0]) === 'choice:qualified-cause' : material.questions[0].prompt === prompt));
  if (compose) {
    assert.deepEqual(session.lesson.materials.map(material => material.rootId).sort(), ['wikipedia-article-10935109', 'wikipedia-article-81194517']);
    assert(session.lesson.materials.some(material => material.blocks[0].text.includes('was assigned to compose the script.')));
  }
  if (infinitive) {
    assert.deepEqual(session.lesson.materials.map(material => material.rootId).sort(), ['wikipedia-article-18739', 'wikipedia-article-58719']);
    assert(session.lesson.materials.every(material => material.blocks[0].text.includes('assigned to')));
  }
  const target = 0;
  const optionSelector = qualifiedCause ? '#learning-question form .option' : '.evidence-option';
  const controls = page.locator(dates ? '.answer-table' : optionSelector).first();
  await expect(controls).toBeVisible();
  await expect(page.locator('#learning-question h2')).toContainText(prompt);
  for (const locale of longReading ? ['zh-Hans', 'zh-Hant', 'en'] : ['zh-Hans']) {
   if (longReading) { await page.goto(origin + '/settings'); await page.getByRole('button', { name: /^(语言|語言|Language)$/ }).click(); await page.getByRole('listbox').locator(`[data-value="${locale}"]`).click(); await expect(page.locator('html')).toHaveAttribute('lang', locale); await page.goto(origin + '/learn/' + session.id); await openSheet(); }
   for (const theme of qualifiedCause ? ['light', 'dark'] : ['light']) {
    if (qualifiedCause) { await page.goto(origin + '/settings'); await page.getByRole('button', { name: /^(外观|外觀|Appearance)$/ }).click(); await page.getByRole('listbox').locator(`[data-value="${theme}"]`).click(); await expect(page.locator('html')).toHaveAttribute('data-theme', theme); await page.goto(origin + '/learn/' + session.id); await openSheet(); }
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
    if ([1440, 320].includes(width)) await page.screenshot({ path: `output/playwright/${family}-evidence-${width}-${theme}-${locale}-offline.png` });
  }
   }
  }
  if (longReading) { await page.goto(origin + '/settings'); if (qualifiedCause) { await page.getByRole('button', { name: 'Appearance', exact: true }).click(); await page.getByRole('listbox').locator('[data-value="light"]').click(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'light'); } await page.getByRole('button', { name: 'Language', exact: true }).click(); await page.getByRole('listbox').locator('[data-value="zh-Hans"]').click(); await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans'); await page.goto(origin + '/learn/' + session.id); await openSheet(); }
  for (const height of [480, 360]) {
    await page.setViewportSize({ width: 375, height }); await openSheet();
    const panel = page.locator('.question-panel');
    await panel.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))));
    const bounds = await panel.boundingBox();
    assert(bounds && bounds.x >= -1 && bounds.x + bounds.width <= 376 && bounds.y >= -1 && bounds.y + bounds.height <= height + 1);
    assert(await controls.evaluate(element => element.scrollWidth <= element.clientWidth));
    for (const trigger of await page.locator(dates ? '.answer-table input' : optionSelector).all()) {
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
  await expect(page.locator('.feedback')).toContainText(dates || qualifiedCause ? session.lesson.materials[0].blocks[0].text.slice(questions[target].evidence.start, questions[target].evidence.end) : questions[target].spans[questions[target].accepted[0]].text);
  const saved = (await rows('attempts')).find(row => row.questionId === questions[target].id);
  assert(saved.correct === true && saved.rootId === session.lesson.materials[0].rootId);

  await page.screenshot({ path: `output/playwright/${family}-evidence-375-light-zh-Hans-offline.png` });
  await page.reload(); await openSheet(); await expect(page.locator('.feedback')).toContainText('回答正确');
  if (longReading) { await page.goto(origin + '/today'); await page.locator('.corpus-practice[data-skill=reading]').getByRole('button').first().click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.getByRole('dialog').locator('[data-mode=practice]').click(); await expect(page).toHaveURL(origin + '/learn/' + session.id); await openSheet(); assert.equal((await rows('sessions')).length, 1); }
  assert.equal((await rows('attempts')).filter(row => row.questionId === questions[target].id).length, 1);
  for (let index = 1; index < questions.length; index++) {
    await page.getByRole('button', { name: '下一题', exact: true }).click();
    await expect(page.locator('.feedback')).toHaveCount(0);
    await expect(page.locator('#learning-question form h2').first()).toHaveText(questions[index].prompt);
    await openSheet();
    if (questions[index].kind === 'response') {
      const material = session.lesson.materials[Math.floor(index / 2)];
      const question = material.questions[0];
      const quote = material.blocks[0].text.slice(question.evidence.start, question.evidence.end);
      await page.locator('.response-answer textarea').fill(qualifiedCause ? `The passage states the event, while qualifying its proposed explanation: “${quote}”. This wording does not verify either claim as a real-world fact.` : concession ? `The concessive clause acknowledges one point, while the main clause presents a contrast: “${quote}”. I preserve both clauses and their context.` : dates ? `The passage explicitly gives the year in “${quote}”. I retain the complete event context.` : assignment ? `The task is assigned in “${quote}”. I retain the complete action and its limits without assuming completion.` : `The named source expresses an evaluation: “${quote}”. I retain the complete judgement and its context.`);
      await page.getByRole('button', { name: '保存答案', exact: true }).click();
      await expect(page.locator('.feedback')).toContainText('未自动评分');
    } else if (longReading) { const question = questions[index]; const wrong = qualifiedCause ? question.options.findIndex((_option, position) => position !== question.answer) : question.spans.findIndex((_span, option) => !question.accepted.includes(option)); assert(wrong >= 0); await page.locator('input[name=answer]').nth(wrong).check(); await page.getByRole('button', { name: '保存答案', exact: true }).click(); await expect(page.locator('.feedback')).toContainText('再看一看'); if (qualifiedCause) { const material = session.lesson.materials[Math.floor(index / 2)]; await expect(page.locator('.feedback')).toContainText(material.blocks[0].text.slice(question.evidence.start, question.evidence.end)); } } else { await answer(questions[index]); await expect(page.locator('.feedback')).toContainText('回答正确'); }
    if (longReading) { await page.reload(); await openSheet(); assert.equal((await rows('attempts')).length, index + 1); }
  }
  const attempts = await rows('attempts'); assert.equal(attempts.length, 4);
  assert.equal(attempts.filter(attempt => attempt.correct === true).length, longReading ? 1 : 2);
  assert.equal(attempts.filter(attempt => attempt.correct === null).length, 2);
  await page.reload(); await openSheet(); await expect(page.locator('.feedback')).toContainText('未自动评分');
  if (longReading) { assert.equal(attempts.filter(attempt => attempt.correct === false).length, 1); assert.equal((await rows('sessions'))[0].status, 'completed'); }
  assert.equal((await rows('attempts')).length, 4);
  for (const [locale, oldLabel, newLabel, leave] of [['zh-Hant', '语言', '語言', '離開任務'], ['en', '語言', 'Language', 'Leave task'], ['zh-Hans', 'Language', '语言', '离开任务']]) {
    await page.goto(origin + '/settings');
    await page.getByRole('button', { name: oldLabel, exact: true }).click();
    await page.getByRole('listbox', { name: oldLabel, exact: true }).locator(`[data-value="${locale}"]`).click();
    await expect(page.getByRole('button', { name: newLabel, exact: true })).toBeVisible();
    await page.goto(origin + '/learn/' + session.id);
    await expect(page.getByRole('link', { name: leave, exact: true })).toBeVisible();
    await openSheet();
    await expect(page.locator('#learning-question h2').first()).toHaveText(questions.at(-1).prompt);
    assert.equal((await rows('attempts')).length, 4);
  }
  if (longReading) {
    await page.keyboard.press('Escape'); const credit = page.locator('.source'); await expect(credit).toContainText(session.lesson.materials.at(-1).credit.license); await expect(credit).toContainText(session.lesson.materials.at(-1).credit.attribution);
    assert(await page.locator('.learning-grid').evaluate(grid => !!(grid.compareDocumentPosition(grid.nextElementSibling) & Node.DOCUMENT_POSITION_FOLLOWING)));
    await credit.scrollIntoViewIfNeeded(); await expect(credit).toBeVisible(); await page.screenshot({ path: `output/playwright/${family}-source-375-light-zh-Hans-offline.png`, fullPage: true });
  }
  await page.goto(origin + '/today'); await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  console.log(`PASS: actual source download; local ${family} evidence on an unfamiliar root; offline response/scoring/save/reload and six widths1440/1200/1024/768/375/320. ${longReading ? 'Exact732/786word contiguous windows; projected NLP verified; four saved answers1correct/1incorrect/2unscored, resume, three locales/short/200percent and source/footer placement. ' + (qualifiedCause ? 'Qualified-cause choices and full qualified evidence; light/dark matrix. ' : '') + ' C2 is an effort starting point, not validated ability. ' : ''}No authored lesson import.`);
} finally { await browser.close(); }
