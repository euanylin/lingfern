import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import 'fake-indexeddb/auto';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';

const origin = 'http://127.0.0.1:8787';
const sequenceSupport = process.argv.includes('--sequence');
const qualificationSupport = process.argv.includes('--qualification');
const discourseSupport = process.argv.includes('--discourse');
const requestSupport = process.argv.includes('--requests');
const relianceSupport = process.argv.includes('--reliance');
const roomSupport = process.argv.includes('--rooms');
const speakerSupport = process.argv.includes('--speakers');
const matchingSupport = requestSupport || relianceSupport || roomSupport || speakerSupport;
const fullFlow = discourseSupport || matchingSupport;
const advancedSupport = qualificationSupport || discourseSupport || requestSupport || relianceSupport;
const sourceFile = relianceSupport ? 'public/source-packs/reading-science-637c5cc7e577.zip' : requestSupport ? 'public/corpus/gutenberg.json' : advancedSupport ? 'public/corpus/additional.json' : 'public/corpus/voa.json';
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false } });
const planned = [];
try {
 const { corpusSchema, corpusLesson, corpusWorkedExample, concessionPrompt } = await server.ssrLoadModule('/src/core/corpus.ts');
 const { asTestLesson } = await server.ssrLoadModule('/src/shared/content.ts');
 const { createSession, sessions } = await server.ssrLoadModule('/src/data/db.ts');
 const bank = relianceSupport ? undefined : corpusSchema.parse(JSON.parse(readFileSync(sourceFile, 'utf8')));
 if (qualificationSupport) bank.records = bank.records.filter(source => ['noaa-article-79852449220319','noaa-article-215039592644680'].includes(source.rootId));
 const attributionPrompt = 'Which sentence explicitly attributes a claim to a named source?';
 const { qualificationPrompt } = await server.ssrLoadModule('/src/core/corpusPractice.ts');
 const open = discourseSupport && corpusSchema.parse(JSON.parse(readFileSync('public/corpus/open-reading.json', 'utf8')));
 let requestBank;
 if (requestSupport || relianceSupport) {
  const catalogue = JSON.parse(readFileSync('content/source-packs.json', 'utf8'));
  const { inspectCommunityPack } = await server.ssrLoadModule('/src/data/communityPack.ts');
  const installed = [];
  for (const id of relianceSupport ? ['reading-science-637c5cc7e577', 'reading-technology-4b8e107b1b8c'] : ['reading-technology-df03ec938d91']) {
   const pack = catalogue.packs.find(pack => pack.id === id), bytes = readFileSync('public' + pack.path);
   assert.equal(createHash('sha256').update(bytes).digest('hex'), pack.sha256);
   installed.push(...(await inspectCommunityPack(bytes)).corpus.records);
  }
  const scopes = relianceSupport ? [['wikipedia-article-9228','3aa87fe6472ecddd65ad7e1f19ae44535fad3c6171604282ced63550231b3c9e'], ['wikipedia-article-46203885','d1460f5ff5f38bfcf5938487bc71d77a77b22cdf05fd3a9e7b1446b233eb817a']] : [['gutenberg-book-1661','f97f124624734f375ade627232284b53174e426abef688654b018d76252c7e83'], ['wikipedia-article-18362','dd6eee7077c0d048b0ddad4f5b25b08b98bb4517578e4d2ffb69bc519f029995']];
  requestBank = { version: 1, failures: [], records: scopes.map(([root,id]) => {
   const source = [...(bank?.records ?? []), ...installed].find(source => source.rootId === root);
   return { ...source, passages: source.passages.filter(passage => passage.id === id) };
  }) };
 }
 const attributionIds = ['d7401fc92dfe88dbccc6d9fa8f4da936aaf31265ec0a43f6b46d09bc09d742cb', 'eca66248958c56e975e5d2c7fb88e7873325c29bed23d88acfb5696b9a9bdcdd'];
 for (const level of advancedSupport ? ['B1','B2','C1','C2'] : ['A1', 'A2']) for (const operation of speakerSupport ? ['speaker-source', 'speaker-fallback'] : roomSupport ? ['room-source', 'room-fallback'] : relianceSupport ? ['matching:In the paired statement, match each reliance to what needs it.'] : requestSupport ? ['matching:Match each action to what the request asks for or rules out.'] : discourseSupport ? [`evidence:${concessionPrompt}`, `evidence:${attributionPrompt}`] : qualificationSupport ? [`evidence:${qualificationPrompt}`] : sequenceSupport ? ['sequence-source', 'sequence-fallback'] : ['choice:requested-address', 'choice:work-phone']) {
  const selected = requestSupport || relianceSupport ? requestBank : discourseSupport ? operation === `evidence:${concessionPrompt}` ? { ...bank, records: bank.records.filter(source => ['nasa-article-194222171056800', 'noaa-article-217121916223523'].includes(source.rootId)) } : { ...open, records: open.records.map(source => ({ ...source, passages: source.passages.filter(passage => attributionIds.includes(passage.id)) })).filter(source => source.passages.length) } : bank;
  const seed = speakerSupport ? operation === 'speaker-source' ? 0 : level === 'A1' ? 8 : 14 : roomSupport ? operation === 'room-source' ? 0 : 1 : advancedSupport ? ['B1','B2','C1','C2'].indexOf(level) : sequenceSupport ? operation === 'sequence-source' ? 0 : level === 'A1' ? 2 : 4 : level === 'A1' ? 0 : 1;
  const lesson = corpusLesson(selected, new Set(), seed, advancedSupport ? 300 : 160, level, [], matchingSupport ? 'matching' : advancedSupport ? 'evidence' : sequenceSupport ? 'sequence' : 'choice', [], sequenceSupport ? undefined : speakerSupport ? 'matching:Who says each sentence? Match it to a person.' : roomSupport ? 'matching:Match each activity to its room.' : operation);
  assert(lesson && new Set(lesson.materials.map(material => material.rootId)).size === 2);
  if (speakerSupport || roomSupport || sequenceSupport) {
   const sourceExample = corpusWorkedExample(lesson.materials[0], seed, level);
   assert.equal(!sourceExample, operation.endsWith('-fallback'));
   if (sourceExample) assert.deepEqual(lesson.workedExample, sourceExample);
   else for (const [locale, marker] of [['en', 'Example:'], ['zh-Hans', '示例：'], ['zh-Hant', '示例：']]) {
    assert(lesson.workedExample[locale].startsWith(marker));
    assert(!/made-up|unscored|illustrative|虚构|虛構|不评分|不評分/i.test(lesson.workedExample[locale]));
   }
  }
  planned.push({ level, operation, practice: await createSession(lesson), test: await createSession(asTestLesson(lesson)) });
  // Each browser plan has its own profile database; mirror that isolation in the in-memory planner.
  if (advancedSupport || roomSupport || speakerSupport) await sessions.clear();
 }
} finally { await server.close(); }
mkdirSync('private/verification', { recursive: true }); mkdirSync('output/playwright', { recursive: true });
const report = { date: new Date().toISOString(), scope: 'Actual source-generated saved snapshots in isolated Chrome profiles; native teaching rendering, settings, answer save/reload and generated Test restrictions. No source acquisition, real learner data or physical-device acceptance.', additionalSourceSha256: discourseSupport ? createHash('sha256').update(readFileSync('public/corpus/open-reading.json')).digest('hex') : undefined, sourceSha256: createHash('sha256').update(readFileSync(sourceFile)).digest('hex'), layouts: [], flows: [], errors: [], untested: ['Physical devices/screen readers', 'Auditory/long-listening acceptance', 'Real GitHub/two-device/MCP clients', 'Mainland carriers/production'] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const rows = (page, table) => page.evaluate(table => new Promise((resolve, reject) => {
 const request = indexedDB.open('lingfern'); request.onerror = () => reject(request.error);
 request.onsuccess = () => { const db = request.result, query = db.transaction(table).objectStore(table).getAll(); query.onsuccess = () => { resolve(query.result); db.close(); }; query.onerror = () => reject(query.error); };
}), table);
async function pane(page) { await expect(page.locator('.question-panel')).toBeVisible(); const toggle = page.locator('.question-sheet-toggle'); if (page.viewportSize().width < 1200) { if (await toggle.getAttribute('aria-expanded') === 'false') { await expect(toggle).toBeVisible(); await toggle.click(); } await expect(toggle).toHaveAttribute('aria-expanded', 'true'); } }
async function answer(page, question) {
 if (question.kind === 'response') await page.locator('.response-answer textarea').fill('I quote the complete source statement and retain its limits: ' + question.prompt);
 else if (question.kind === 'evidence') await page.locator('.evidence-option input').nth(question.accepted[0]).check();
 else if (question.kind === 'matching') {
  for (const [index, pair] of question.pairs.entries()) { await page.locator('.matching-answers .setting-trigger').nth(index).click(); await page.getByRole('option', { name: pair.answer, exact: true }).click(); }
 }
 else if ('options' in question) await page.getByRole('radio', { name: question.options[question.answer], exact: true }).check();
 else {
  while (await page.locator('.sequence-order li').count()) await page.locator('.sequence-controls button:last-child').first().click();
  for (const step of question.acceptedOrders[0]) { const button = page.locator('.sequence-choices button').filter({ hasText: step }); await button.focus(); await button.press('Space'); }
  await expect(page.locator('.sequence-order li')).toHaveCount(3);
 }
}
async function settings(page, locale, theme) {
 await page.goto(origin + '/settings');
 const controls = page.locator('.settings-preferences .setting-trigger');
 await controls.nth(0).click(); await page.locator(`[role=option][data-value="${locale}"]`).click();
 await expect(page.locator('html')).toHaveAttribute('lang', locale);
 await controls.nth(1).click(); await page.locator(`[role=option][data-value="${theme}"]`).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}
try {
 for (const plan of planned) {
  const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1440, height: 900 } });
  const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
  await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  await page.goto(origin + '/today'); await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated');
  const sw = await context.request.get(origin + '/sw.js'); assert.equal(sw.status(), 200); assert.match(sw.headers()['content-type'], /javascript/);
  await page.evaluate(sessions => new Promise((resolve, reject) => {
   const open = indexedDB.open('lingfern'); open.onerror = () => reject(open.error);
   open.onsuccess = () => { const db = open.result, tx = db.transaction('sessions', 'readwrite'); for (const session of sessions) tx.objectStore('sessions').add(session); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
  }), [plan.practice, plan.test]);
  for (const locale of ['zh-Hans', 'zh-Hant', 'en']) for (const theme of ['light', 'dark']) for (const width of [1440, 320]) {
   await page.setViewportSize({ width, height: width === 320 ? 640 : 900 }); await page.emulateMedia({ reducedMotion: width === 320 ? 'reduce' : 'no-preference' });
   await settings(page, locale, theme); await page.goto(origin + '/learn/' + plan.practice.id);
   await expect(page.locator('html')).toHaveAttribute('lang', locale); await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
   const teaching = page.locator('.teaching'); await expect(teaching).toBeVisible(); await expect(teaching).toContainText(plan.practice.lesson.workedExample[advancedSupport ? 'en' : locale]);
   assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
   if (width === 320) await page.screenshot({ path: `output/playwright/contact-${plan.level}-${(speakerSupport || roomSupport ? plan.operation : relianceSupport ? 'paired-reliance' : requestSupport ? 'request-matching' : discourseSupport ? plan.operation.includes('although') ? 'concession' : 'attribution' : qualificationSupport ? 'qualification' : sequenceSupport ? plan.operation : plan.operation.slice(7))}-${locale}-${theme}-320x640.png`, fullPage: true });
   await pane(page);
   let option;
   if (matchingSupport) { const question = plan.practice.lesson.materials[0].questions[0]; await answer(page, question); const trigger = page.locator('.matching-answers .setting-trigger').first(); await trigger.focus(); await trigger.press('Space'); await page.getByRole('option', { name: question.pairs[0].answer, exact: true }).press('Enter'); option = await trigger.boundingBox(); }
   else if (sequenceSupport) { await answer(page, plan.practice.lesson.materials[0].questions[0]); option = await page.locator('.sequence-controls button').first().boundingBox(); }
   else { const radio = page.getByRole('radio').first(); await radio.scrollIntoViewIfNeeded(); await radio.focus(); await page.keyboard.press('Space'); await expect(radio).toBeChecked(); option = await radio.locator('..').boundingBox(); }
   assert(option && option.height >= 44 && option.width >= 44);
   const save = page.locator('button[type=submit]'); await expect(save).toBeEnabled(); const box = await save.boundingBox(); assert(box && box.height >= 44);
   report.layouts.push({ level: plan.level, operation: plan.operation, locale, theme, width, height: width === 320 ? 640 : 900, reducedMotion: width === 320, overflow: false, keyboardSelection: true, touchTargets: true });
  }
  await settings(page, 'zh-Hans', 'light'); await page.goto(origin + '/learn/' + plan.practice.id);
  await context.setOffline(true); await page.reload(); await expect(page.locator('.teaching')).toContainText(plan.practice.lesson.workedExample['zh-Hans']);
  await pane(page);
  const question = plan.practice.lesson.materials[0].questions[0];
  await answer(page, question);
  await page.getByRole('button', { name: '保存答案', exact: true }).click(); await expect(page.locator('.feedback')).toBeVisible(); await page.reload();
  await pane(page); await expect(page.locator('.feedback')).toBeVisible(); await expect(page.locator(matchingSupport ? '.matching-answers .setting-trigger' : sequenceSupport ? '.sequence-controls button' : 'input[type=radio]').first()).toBeDisabled(); const saved = (await rows(page, 'attempts')).filter(attempt => attempt.sessionId === plan.practice.id); assert.equal(saved.length, 1); assert.equal(saved[0].correct, true); assert.equal(saved[0].assistance.teachingProvided, true);
  await page.goto(origin + '/learn/' + plan.test.id); await expect(page.locator('.question-panel')).toBeVisible(); await pane(page); await expect(page.locator('.teaching,.hint,.selection-dictionary,.self-assessment')).toHaveCount(0);
  await answer(page, question); await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await expect(page.locator('.feedback')).toContainText('作答已保存'); await expect(page.locator('.check-result')).toHaveCount(0); await page.reload();
  const tested = (await rows(page, 'attempts')).filter(attempt => attempt.sessionId === plan.test.id); assert.equal(tested.length, 1); assert(!tested[0].assistance.teachingProvided); assert.equal(tested[0].assistance.hintLevel, 0);
  if (fullFlow) {
   for (const [mode, snapshot] of [['practice', plan.practice], ['test', plan.test]]) {
    await page.goto(origin + '/learn/' + snapshot.id); await pane(page);
    const allQuestions = snapshot.lesson.materials.flatMap(material => material.questions);
    for (let index = 1; index < allQuestions.length; index++) {
     await page.getByRole('button', { name: '下一题', exact: true }).click();
     await expect(page.locator('.question-panel h2').first()).toHaveText(allQuestions[index].prompt); await pane(page);
     if (mode === 'test') await expect(page.locator('.teaching,.hint,.selection-dictionary,.self-assessment')).toHaveCount(0);
     await answer(page, allQuestions[index]); await page.getByRole('button', { name: '保存答案', exact: true }).click();
     if (mode === 'test' && index < allQuestions.length - 1) await expect(page.locator('.check-result')).toHaveCount(0);
    }
    if (mode === 'test') await expect(page.locator('.check-result')).toHaveCount(allQuestions.length);
    else await expect(page.getByRole('heading', { name: '阅读任务已保存', exact: true })).toBeVisible();
    await page.reload(); await pane(page);
    if (mode === 'test') { await expect(page.locator('.check-result')).toHaveCount(allQuestions.length); await expect(page.locator('.teaching,.hint,.selection-dictionary,.self-assessment')).toHaveCount(0); }
    else await expect(page.getByRole('heading', { name: '阅读任务已保存', exact: true })).toBeVisible();
    const completed = (await rows(page, 'sessions')).find(session => session.id === snapshot.id);
    assert.equal(completed.status, 'completed');
    const answers = (await rows(page, 'attempts')).filter(attempt => attempt.sessionId === snapshot.id);
    assert.equal(answers.length, allQuestions.length); assert.equal(new Set(answers.map(attempt => attempt.questionId)).size, allQuestions.length);
    for (const attempt of answers) assert.equal(attempt.correct, allQuestions.find(question => question.id === attempt.questionId).kind === 'response' ? null : true);
    assert.equal(new Set(answers.map(attempt => attempt.rootId)).size, 2);
   }
  }
  report.flows.push({ level: plan.level, operation: plan.operation, roots: plan.practice.lesson.materials.map(material => material.rootId), hashes: plan.practice.itemHashes, offlineSavedAndReloaded: true, wholePracticeAndTestCompleted: fullFlow || undefined, completedResultRestored: fullFlow || undefined, assistedPractice: true, testNoTeachingOrEarlyFeedback: true });
  await context.close();
 }
 assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) { report.passed = false; report.failure = error.message; throw error; }
finally { writeFileSync(`private/verification/${speakerSupport ? 'speaker-support' : roomSupport ? 'room-support' : relianceSupport ? 'reliance-support' : requestSupport ? 'request-support' : discourseSupport ? 'discourse-support' : qualificationSupport ? 'qualification' : 'beginner-' + (sequenceSupport ? 'sequence' : 'contact')}-browser-20261011.json`, JSON.stringify(report, null, 2) + '\n'); await browser.close(); }
console.log(JSON.stringify({ passed: report.passed, layouts: report.layouts.length, flows: report.flows.length }));
