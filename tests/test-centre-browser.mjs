import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
const origin = 'http://127.0.0.1:8787';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 375, height: 812 } });
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
const rows = table => page.evaluate(table => new Promise((resolve, reject) => {
 const open = indexedDB.open('lingfern'); open.onerror = () => reject(open.error);
 open.onsuccess = () => { const db = open.result, query = db.transaction(table).objectStore(table).getAll(); query.onsuccess = () => { resolve(query.result); db.close(); }; query.onerror = () => { reject(query.error); db.close(); }; };
}), table);
async function pane() { await expect(page.locator('.question-panel')).toBeVisible(); const toggle = page.locator('.question-sheet-toggle'); if (page.viewportSize().width < 1200 && await page.locator('.learning-grid:not(.listening-layout)').count()) { if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click(); await expect(page.locator('.question-sheet-content')).toBeVisible(); } }
async function answer(question, material) {
 await pane();
 if ('options' in question) await page.getByRole('radio', { name: question.options[question.answer], exact: true }).check();
 else if (question.kind === 'completion') await page.locator('.completion-answer input').fill(question.answer);
 else if (question.kind === 'table') for (const [index, row] of question.rows.entries()) await page.locator('.answer-table input').nth(index).fill(row.answer);
 else if (question.kind === 'matching') for (const pair of question.pairs) { await page.getByRole('button', { name: pair.label, exact: true }).click(); await page.getByRole('listbox', { name: pair.label, exact: true }).getByRole('option', { name: pair.answer, exact: true }).click(); }
 else if (question.kind === 'sequence') for (const step of question.acceptedOrders[0]) await page.locator('.sequence-choices button').filter({ hasText: step }).click();
 else if (question.kind === 'evidence') await page.locator('.evidence-option input').nth(question.accepted[0]).check();
 else if (question.kind === 'response') await page.locator('.response-answer textarea').fill('The source says: ' + material.blocks.find(block => block.id === question.blockId).text.slice(question.evidence.start, question.evidence.end));
 else throw new Error('Unsupported question kind');
}
async function pair(dialog, locale, enabled) {
 const practice = dialog.locator('[data-mode=practice]'), check = dialog.locator('[data-mode=test]');
 await expect(practice).toHaveText(locale === 'en' ? 'Practice' : locale === 'zh-Hant' ? '練習' : '练习');
 await expect(check).toHaveText(locale === 'en' ? 'Test' : locale === 'zh-Hant' ? '測試' : '测试');
 await expect(practice).toBeEnabled(); if (enabled) await expect(check).toBeEnabled(); else await expect(check).toBeDisabled();
 await practice.scrollIntoViewIfNeeded();
 const a = await practice.boundingBox(), b = await check.boundingBox(); assert(a && b && a.width >= 44 && b.width >= 44 && a.height >= 44 && b.height >= 44);
 assert(Math.abs(a.y - b.y) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1 && a.x < b.x);
 assert(await dialog.locator('[data-mode]').evaluateAll(buttons => { const styles = buttons.map(button => getComputedStyle(button)); return ['backgroundColor', 'color', 'borderRadius', 'fontSize', 'fontWeight'].every(key => styles[0][key] === styles[1][key]); }));
 assert(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth));
}
async function noHelpers() { await expect(page.locator('.check-intro,.check-end,.hint,.teaching,.selection-dictionary,.selection-dictionary-menu,.ai-handoff,.self-assessment')).toHaveCount(0); }
function assertTest(session) { assert(session && session.lesson.mode === 'test' && session.lesson.generation.generator === 'corpus-v1'); assert(!session.checkStartedAt && !session.checkDeviceId && !session.checkGroupId); assert(!session.lesson.teaching && !session.lesson.workedExample && !session.lesson.nextStep); assert(session.lesson.materials.every(material => material.questions.every(question => !question.hints && !question.modelAnswer))); }
async function finishSession(session, test, afterFirst) {
 const items = session.lesson.materials.flatMap(material => material.questions.map(question => ({ material, question })));
 for (const [index, item] of items.entries()) {
  await pane(); if (test) await noHelpers(); await answer(item.question, item.material);
  if (session.lesson.skill === 'listening') {
   await expect(page.locator('.audio-timeline input[type=range]')).toBeVisible();
   if (!await page.getByText('录音已播放，可以选择并保存。', { exact: true }).isVisible()) await expect(page.getByRole('button', { name: '保存答案', exact: true })).toBeDisabled();
   await page.getByRole('button', { name: '播放 / 重听', exact: true }).click(); await expect(page.getByText('录音已播放，可以选择并保存。', { exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: '保存答案', exact: true }).click(); await expect(page.locator('.feedback')).toBeVisible();
  if (test) { await noHelpers(); if (index < items.length - 1) { await expect(page.locator('.check-result')).toHaveCount(0); await expect(page.getByText('作答已保存。测试结束后显示答案。', { exact: true })).toBeVisible(); } else await expect(page.locator('.check-result')).toHaveCount(items.length); }
  await page.reload(); await pane();
  assert.equal((await rows('attempts')).filter(attempt => attempt.sessionId === session.id).length, index + 1);
  if (afterFirst && index === 0) await afterFirst();
  if (index < items.length - 1) { await page.getByRole('button', { name: '下一题', exact: true }).click(); await expect(page.locator('.feedback')).toHaveCount(0); }
 }
 assert.equal((await rows('sessions')).find(saved => saved.id === session.id).status, 'completed');
 if (test) { await noHelpers(); const saved = (await rows('attempts')).filter(attempt => attempt.sessionId === session.id); assert(saved.every(attempt => attempt.assistance.hintLevel === 0 && !attempt.assistance.dictionaryUsed && !attempt.assistance.teachingProvided)); }
}
async function beginGroup(test, dialog) {
 await page.goto(origin + '/today'); await page.locator('.combined-training button').first().click(); await expect(dialog).toBeVisible();
 await dialog.locator(`[data-mode=${test ? 'test' : 'practice'}]`).click(); await expect(page.locator('.question-panel')).toBeVisible();
 const candidates = (await rows('sessions')).filter(session => session.practiceGroupId && session.status === 'active' && (test ? session.lesson.mode === 'test' : !session.lesson.mode)); assert.equal(candidates.length, 2);
 const reading = candidates.find(session => session.lesson.skill === 'reading'), listening = candidates.find(session => session.lesson.skill === 'listening'); assert(reading && listening); assert.equal(reading.practiceGroupId, listening.practiceGroupId); assert(candidates.every(session => !session.checkGroupId)); assert(page.url().endsWith(reading.id)); if (test) candidates.forEach(assertTest); return [reading, listening];
}
async function resumeGroup(session, test, dialog) {
 await page.goto(origin + '/today'); await page.locator('.combined-training button').first().click();
 if (test) await expect(dialog).toHaveCount(0); else { await expect(dialog).toBeVisible(); await dialog.locator('[data-mode=practice]').click(); }
 await expect(page).toHaveURL(origin + '/learn/' + session.id); await pane(); assert.equal((await rows('sessions')).filter(saved => saved.practiceGroupId === session.practiceGroupId).length, 2);
}
async function finishGroup(group, test, dialog) {
 const [reading, listening] = group;
 await finishSession(reading, test, () => resumeGroup(reading, test, dialog));
 await expect(page.locator(`a[href="/learn/${listening.id}"]`)).toBeVisible(); await resumeGroup(listening, test, dialog);
 await finishSession(listening, test); assert(group.every(session => test ? session.lesson.mode === 'test' : !session.lesson.mode));
}

try {
 await page.goto(origin + '/library'); await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated'); await page.reload();
 for (const name of ['阅读语料', 'IPA 发音与录音']) await page.locator('.package-row').filter({ hasText: name }).getByRole('checkbox').check();
 await page.getByRole('button', { name: '下载所选资源', exact: true }).click();
 for (const name of ['阅读语料', 'IPA 发音与录音']) await expect(page.locator('.package-row').filter({ hasText: name })).toContainText('已安装', { timeout: 90000 });
 await page.goto(origin + '/start'); for (let step = 0; step < 3; step++) await page.getByRole('button', { name: '跳过这一步', exact: true }).click();
 for (const skill of ['阅读', '听力']) await page.getByRole('group', { name: skill, exact: true }).getByLabel(/^A1 ·/).check();
 await page.getByRole('button', { name: '保存并继续', exact: true }).click(); await page.getByRole('button', { name: '保存并前往今日', exact: true }).click();
 await context.setOffline(true);
 for (const locale of ['zh-Hans', 'zh-Hant', 'en']) {
  await page.goto(origin + '/settings'); await page.getByRole('button', { name: /^(语言|語言|Language)$/ }).click(); await page.getByRole('listbox').locator(`[data-value="${locale}"]`).click(); await expect(page.locator('html')).toHaveAttribute('lang', locale);
  for (const theme of ['light', 'dark']) {
   await page.goto(origin + '/settings'); await page.getByRole('button', { name: /^(外观|外觀|Appearance)$/ }).click(); await page.getByRole('listbox').locator(`[data-value="${theme}"]`).click(); await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
   for (const width of [1440, 1200, 1024, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 812 }); await page.goto(origin + '/today');
    await expect(page.locator('a[href="/tests"],.today-tests,.test-centre')).toHaveCount(0);
    await expect(page.locator('.combined-training h2')).toHaveText(locale === 'en' ? 'Combined training' : locale === 'zh-Hant' ? '綜合訓練' : '综合训练');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    for (const button of await page.locator('.corpus-practice > button,.combined-training button').all()) { const box = await button.boundingBox(); assert(box && box.width >= 44 && box.height >= 44); }
    for (const skill of ['reading', 'listening']) {
     await page.locator(`.corpus-practice[data-skill=${skill}]`).getByRole('button').first().click(); const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible(); await pair(dialog, locale, true);
     await expect(dialog.locator('.passage,audio')).toHaveCount(0); assert.equal((await rows('sessions')).length, 0);
     await page.goBack(); await expect(dialog).toHaveCount(0); await expect(page).toHaveURL(origin + '/today');
    }
    await page.locator('.combined-training button').first().click(); const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible(); await pair(dialog, locale, true); await expect(dialog).toContainText('READING'); await expect(dialog.locator('.task-detail-body > section .eyebrow')).toContainText('LISTENING'); await expect(dialog.locator('.task-detail-body > section h3')).toHaveText(locale === 'en' ? 'Listen to words' : locale === 'zh-Hant' ? '聽單字' : '听单词'); await expect(dialog.locator('.task-detail-body > section')).toContainText(locale === 'en' ? 'Human recording' : locale === 'zh-Hant' ? '真人錄音' : '真人录音');
    if ((width === 320 && locale === 'zh-Hans' && theme === 'dark') || (width === 1440 && locale === 'en' && theme === 'light')) await page.screenshot({ path: `output/playwright/training-entry-${width}-${theme}-${locale}-offline.png` });
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); assert.equal((await rows('sessions')).length, 0);
    if (locale === 'zh-Hans' && ((width === 1440 && theme === 'light') || (width === 375 && theme === 'dark'))) await page.screenshot({ path: `output/playwright/today-training-${width}-${theme}-zh-Hans-offline.png`, fullPage: true });
   }
  }
 }
 console.log('PASS_MATRIX: actual resources, three locales × two themes × six widths; Practice/Test equally available from the same preview.');
 await page.goto(origin + '/settings'); await page.getByRole('button', { name: 'Language', exact: true }).click(); await page.getByRole('listbox').locator('[data-value="zh-Hans"]').click(); await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
 await page.goto(origin + '/today'); await expect(page).toHaveURL(origin + '/today'); await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
 await page.emulateMedia({ reducedMotion: 'reduce' }); await page.locator('.corpus-practice[data-skill=reading]').getByRole('button').first().click();
 const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible(); const previewTitle = await dialog.locator('#task-detail-title').textContent();
 await dialog.locator('[data-mode=test]').focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); await expect(dialog.locator('[data-mode=test]')).toBeFocused();
 await dialog.locator('[data-mode=test]').click(); await expect(dialog).toHaveCount(0); await expect(page.locator('.question-panel')).toBeVisible(); await noHelpers(); await expect(page.locator('.passage').first()).toBeVisible();
 const readingTest = (await rows('sessions'))[0]; assertTest(readingTest); assert.equal(readingTest.lesson.skill, 'reading'); assert.equal(readingTest.lesson.title['zh-Hans'], previewTitle); assert(!readingTest.practiceGroupId);
 await page.goBack(); await expect(page).toHaveURL(origin + '/today'); await page.goForward(); await expect(page.locator('.question-panel')).toBeVisible(); await page.reload(); await pane(); await noHelpers();
 await answer(readingTest.lesson.materials[0].questions[0], readingTest.lesson.materials[0]); await page.getByRole('button', { name: '保存答案', exact: true }).click();
 await expect(page.getByText('作答已保存。测试结束后显示答案。', { exact: true })).toBeVisible(); await expect(page.locator('.check-result')).toHaveCount(0); await noHelpers();
 await page.screenshot({ path: 'output/playwright/generated-test-reading-320-dark-zh-Hans-offline.png' });
 await page.reload(); await pane(); assert.equal((await rows('attempts')).length, 1); const savedReadingTest = await rows('attempts');
 await page.goto(origin + '/today'); await page.locator('.corpus-practice[data-skill=reading]').getByRole('button').first().click(); await expect(page).toHaveURL(origin + '/learn/' + readingTest.id); await expect(dialog).toHaveCount(0); await pane();
 assert.equal((await rows('sessions')).length, 1); await noHelpers();
 await page.goto(origin + '/today'); await page.locator('.corpus-practice[data-skill=listening]').getByRole('button').first().click(); await expect(dialog).toBeVisible(); await expect(dialog.locator('[data-mode=test]')).toBeEnabled();
 await dialog.locator('[data-mode=test]').click(); await expect(page.locator('.question-panel')).toBeVisible();
 const listeningTest = (await rows('sessions')).find(session => session.lesson.skill === 'listening'); assertTest(listeningTest); assert(!listeningTest.practiceGroupId);
 await finishSession(listeningTest, true);
 await page.screenshot({ path: 'output/playwright/generated-test-listening-320-dark-zh-Hans-offline.png' });
 const savedListeningTest = (await rows('attempts')).filter(attempt => attempt.sessionId === listeningTest.id);
 console.log('PASS_MODULE_TESTS: generated reading direct/save/reload/resume; generated listening direct/full audio/save/reload/final delayed review.');
 const ordinary = await beginGroup(false, dialog); await finishGroup(ordinary, false, dialog);
 console.log('PASS_ORDINARY_COMBINED: existing reading→listening sequence, save/reload, same-group resume, ordinary immediate feedback retained.');
 const tested = await beginGroup(true, dialog); await finishGroup(tested, true, dialog);
 await page.screenshot({ path: 'output/playwright/generated-test-combined-320-dark-zh-Hans-offline.png' });
 for (const saved of [...savedReadingTest, ...savedListeningTest]) assert.deepEqual((await rows('attempts')).find(attempt => attempt.id === saved.id), saved);
 assert((await rows('sessions')).filter(session => session.practiceGroupId).every(session => session.status === 'completed'));
 await page.goto(origin + '/today'); await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible(); assert.deepEqual(errors, []);
 console.log(JSON.stringify({ ordinaryCombinedResponses: (await rows('attempts')).filter(attempt => ordinary.some(session => session.id === attempt.sessionId)).length, generatedCombinedTestResponses: (await rows('attempts')).filter(attempt => tested.some(session => session.id === attempt.sessionId)).length, preservedReadingTestResponses: savedReadingTest.length, completedListeningTestResponses: savedListeningTest.length }));
 console.log('PASS: actual installed/offline same-generator Practice/Test entries; no separate Today test link/page; three locales × two themes × six widths; identical44px controls; keyboard/back/reduced-motion; direct module tests, no check intro/helpers/AI/self-assessment; actual full word-audio gate with draggable timeline/replay retained; delayed test answers and reload; ordinary and test combined two-session reading→listening and mode-specific resume. No legacy-check/source acceptance changes or authored lesson imports.');
} finally { await context.close(); await browser.close(); }
