import type { Lesson } from '../../src/shared/content';
import { questionSlots } from '../../src/shared/practiceQuantity';
import { readFile } from 'node:fs/promises';
import { showLearningPane } from '../browser/learning-pane';
import { confirmTask as confirmNewTask } from '../browser/task-start';
import { confirmFixtureTask as confirmTask } from './fixture-session';
import { expect, test } from '@playwright/test';
import { selectPicker } from '../browser/picker';

async function completeWorkspace(page: import('@playwright/test').Page, response = 'The source supports this interpretation, with its stated conditions and limits.') {
  await expect(page.locator('.material-workspace')).toBeVisible();
  await expect(page).toHaveURL(/\/learn\//);
  const lesson = await page.evaluate(() => new Promise<Lesson>((resolve, reject) => {
    const open = indexedDB.open('lingfern'); open.onerror = () => reject(open.error);
    open.onsuccess = () => { const db = open.result, request = db.transaction('sessions').objectStore('sessions').get(location.pathname.split('/').at(-1)!); request.onsuccess = () => { resolve(request.result.lesson); db.close(); }; request.onerror = () => reject(request.error); };
  }));
  await showLearningPane(page, 'question');
  let slot = 0;
  for (const material of lesson.materials) {
    await page.locator('.workspace-card button').nth(slot).click();
    if (material.audio) {
      const audio = page.locator('audio');
      await page.locator('.audio-play').click();
      await expect.poll(() => audio.evaluate((audio: HTMLAudioElement) => Number.isFinite(audio.duration) && audio.duration > 0)).toBe(true);
      await audio.evaluate((audio: HTMLAudioElement) => { audio.muted = true; audio.playbackRate = 16; });
      await expect.poll(() => audio.evaluate((audio: HTMLAudioElement) => audio.ended && audio.duration > 0), { timeout: 20_000 }).toBe(true);
      await expect(page.getByText('录音已播放，可以选择并保存。', { exact: true })).toBeVisible();
    }
    for (const question of material.questions) {
      await page.locator('.workspace-card button').nth(slot).click();
      const section = page.locator('.workspace-question').filter({ has: page.locator(`[id="prompt-${question.id}"]`) });
      await expect(section).toBeVisible();
      if ('options' in question) await section.getByRole('radio').nth(question.answer).check();
      else if ('spans' in question) await section.getByRole('radio').nth(question.accepted[0]).check();
      else if ('criteria' in question) for (const input of await section.locator('textarea').all()) await input.fill(response);
      else if ('gaps' in question) for (const [index, gap] of question.gaps.entries()) await section.locator('.inline-gap input').nth(index).fill(gap.answer);
      else if ('rows' in question) for (const [index, row] of question.rows.entries()) await section.locator('.answer-table input').nth(index).fill(row.answer);
      else if ('pairs' in question) for (const [index, pair] of question.pairs.entries()) await selectPicker(page, `${slot + index + 1}. ${pair.label}`, pair.answer);
      else if ('steps' in question) for (const step of question.acceptedOrders[0]) await section.locator('.sequence-choices').getByRole('button', { name: `${step} ＋`, exact: true }).click();
      else await section.locator('.completion-answer input').fill(question.answer);
      slot += questionSlots(question);
    }
  }
  await page.locator('.workspace-card button').last().click();
  await page.getByRole('button', { name: '提交练习', exact: true }).click();
  await expect(page.locator('#workspace-result')).toBeVisible();
  return { lesson, slots: slot };
}

test('chosen word materials and question type persist, generate and save offline', async ({ page, context }) => {
  await page.goto('/start');
  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: '跳过这一步', exact: true }).click();
  for (const skill of ['阅读', '听力']) await page.getByRole('group', { name: skill, exact: true }).getByLabel(/^A1 ·/).check();
  await page.getByRole('button', { name: '保存并继续', exact: true }).click();
  await page.getByRole('button', { name: '保存并前往今日', exact: true }).click();
  await page.goto('/library');
  await page.getByRole('button', { name: /^通用材料/ }).last().click();
  await page.locator('.package-row').filter({ hasText: 'IPA 发音与录音' }).locator('input').check();
  await page.getByRole('button', { name: '下载所选资源' }).click();
  await expect(page.locator('.package-row').filter({ hasText: 'IPA 发音与录音' })).toContainText('已安装', { timeout: 90_000 });
  await page.goto('/today');
  const card = page.locator('.primary-task:not(.reading-task):not(.combined-training)').first();
  await card.getByRole('button', { name: '听力设置', exact: true }).click();
  const dialog = page.locator('.practice-options-dialog');
  await dialog.getByRole('button', { name: '主题', exact: true }).click();
  await dialog.locator('[role=option][data-value=science]').click();
  await dialog.locator('[role=option][data-value=daily-life]').click();
  await dialog.getByRole('button', { name: '主题', exact: true }).click();
  await dialog.getByRole('button', { name: '题型', exact: true }).click();
  await dialog.locator('[role=option][data-value=completion]').click();
  await dialog.locator('[role=option][data-value=choice]').click();
  await dialog.getByRole('button', { name: '题型', exact: true }).click();
  for (const word of ['cat', 'bed']) await dialog.getByRole('checkbox', { name: word, exact: true }).check();
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await card.getByRole('button', { name: '听力设置', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '主题', exact: true })).toHaveAttribute('data-value', 'science,daily-life');
  for (const word of ['cat', 'bed']) await expect(dialog.getByRole('checkbox', { name: word, exact: true })).toBeChecked();
  await expect(dialog.getByRole('button', { name: '题型', exact: true })).toHaveAttribute('data-value', 'completion,choice');
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await card.getByRole('button', { name: '开始', exact: true }).click();
  await confirmNewTask(page);
  const snapshot = await page.evaluate(() => new Promise<{ materials: { rootId: string; audio: { src: string }; blocks: { text: string }[]; questions: { kind: string }[] }[] }>((resolve, reject) => {
    const request = indexedDB.open('lingfern');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result, query = db.transaction('sessions').objectStore('sessions').get(location.pathname.split('/').at(-1)!); query.onsuccess = () => { resolve(query.result.lesson); db.close(); }; query.onerror = () => reject(query.error); };
  }));
  expect(snapshot.materials.map(material => material.rootId).sort()).toEqual(['ipa-word-bed', 'ipa-word-cat']);
  expect(snapshot.materials.every(material => material.questions.every(question => question.kind === 'completion'))).toBe(true);
  for (const [index, material] of snapshot.materials.entries()) {
    await page.locator('.workspace-card button').nth(index).click();
    await expect(page.locator('audio')).toHaveAttribute('src', material.audio.src);
    await page.locator('.audio-play').click();
    await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.ended && audio.duration > 0), { timeout: 15_000 }).toBe(true);
    await expect(page.getByText('录音已播放，可以选择并保存。', { exact: true })).toBeVisible();
    await page.locator('.completion-answer input').fill(material.blocks[0].text);
    await expect(page.locator('.workspace-save-status')).toHaveText('已保存在本设备');
  }
  await page.reload();
  await expect(page.locator('.completion-answer input')).toHaveValue(snapshot.materials.at(-1)!.blocks[0].text);
  await page.getByRole('button', { name: '提交练习', exact: true }).click();
  await expect(page.locator('#workspace-result')).toBeVisible();
  await expect(page.locator('.workspace-review')).toHaveCount(snapshot.materials.length);
  await page.reload(); await expect(page.locator('#workspace-result')).toBeVisible();
});

test('open response and self-assessment save and reopen offline without a score', async ({ page, context }) => {
  await page.goto('/today');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.locator('.task-row').filter({ has: page.getByRole('heading', { name: '转述计划与限制' }) }).getByRole('button').click();
  await confirmTask(page);
  const response = 'Wait for Friday’s email. The room needs an inspection; the alternative is online.';
  await completeWorkspace(page, response);
  for (const assessment of await page.locator('.self-assessment').all()) {
    for (const row of await assessment.locator('fieldset').all()) await row.getByRole('radio', { name: 'Unsure', exact: true }).check();
    await assessment.getByRole('button', { name: 'Save self-assessment' }).click();
    await expect(assessment.getByText('Self-assessment saved.')).toBeVisible();
  }
  const selected = await page.locator('.self-assessment input:checked').count();
  expect(selected).toBeGreaterThan(0);
  await page.reload(); await showLearningPane(page, 'question');
  await expect(page.locator('.response-answer textarea').first()).toHaveValue(response);
  await expect(page.locator('.self-assessment input:checked')).toHaveCount(selected);
  await expect(page.locator('.slot-result')).toHaveText(['1: 已保存 · 未自动评分', '2: 已保存 · 未自动评分']);

});

test('matching a new pair of messages works offline and survives reopening', async ({ page, context }) => {
  await page.goto('/today');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.locator('.task-row').filter({ has: page.getByRole('heading', { name: '配对活动安排' }) }).getByRole('button', { name: '开始阅读' }).click();
  await confirmTask(page);
  const { slots } = await completeWorkspace(page);
  expect(slots).toBe(8);
  await page.reload(); await showLearningPane(page, 'question');
  await page.locator('.workspace-card button').first().click();
  await expect(page.locator('.slot-result')).toHaveCount(slots);
  await expect(page.locator('.workspace-review').first().locator('blockquote')).toHaveText(['at the library', 'at the park']);
  await expect(page.getByRole('button', { name: '1. Mia', exact: true })).toBeDisabled();

});

test('A2 controlled completion saves and reopens offline', async ({ page, context }) => {
  await page.goto('/library');
  await page.getByRole('button', { name: /^通用材料/ }).last().click();
  await page.locator('.package-row').filter({ hasText: 'A2 听力录音' }).locator('input').check();
  await page.getByRole('button', { name: '下载所选资源' }).click();
  await expect(page.locator('.package-row').filter({ hasText: 'A2 听力录音' })).toContainText('已安装', { timeout: 90_000 });
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.goto('/today');
  const task = page.locator('.task-row').filter({ has: page.getByRole('heading', { name: '听懂临时变动' }) });
  await task.getByRole('button', { name: '开始听力' }).click();
  await confirmTask(page);
  await completeWorkspace(page);
  await page.reload();
  await expect(page.locator('.workspace-review').first().locator('blockquote')).toContainText('Room Twelve');

});

test('A2 evidence and ordering responses can be saved with the network disconnected', async ({ page, context }) => {
  await page.goto('/today');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  const task = page.locator('.task-row').filter({ has: page.getByRole('heading', { name: '核对开放时间的例外' }) });
  await task.getByRole('button', { name: '开始阅读' }).click();
  await confirmTask(page);
  const { slots } = await completeWorkspace(page);
  await expect(page.locator('.slot-result')).toHaveCount(slots);
  await expect(page.locator('.workspace-review').nth(1).locator('blockquote')).toHaveCount(2);
  await page.reload(); await expect(page.locator('#workspace-result')).toBeVisible();

});

test('verified install reopens, looks up an unvisited word, plays audio and saves offline', async ({ page, context, baseURL }) => {
  test.setTimeout(120_000);
  const external: string[] = [];
  page.on('request', request => { if (!request.url().startsWith(`${baseURL}/`)) external.push(request.url()); });
  await page.goto('/library');
  await expect(page.getByRole('searchbox', { name: '搜索内容' })).toBeVisible();
  await expect(page.locator('.package-row input:checked')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '下载所选资源' })).toHaveCount(0);
  await page.getByRole('button', { name: /^通用材料/ }).last().click();
  for (const name of ['英英词典', 'A1 单词录音', 'C2 听力录音', 'IPA 发音与录音', '英语用法词典']) await page.locator('.package-row').filter({ hasText: name }).locator('input').check();
  await page.getByRole('button', { name: '下载所选资源' }).click();
  for (const name of ['英英词典', 'A1 单词录音', 'C2 听力录音', 'IPA 发音与录音', '英语用法词典']) await expect(page.locator('.package-row').filter({ hasText: name })).toContainText('已安装', { timeout: 90_000 });
  await expect(page.locator('.package-row input:checked')).toHaveCount(0);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/library/ipa');
  await expect(page.getByRole('heading', { name: 'IPA 发音表' })).toBeVisible();
  await expect(page.getByRole('button', { name: '简易版', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.ipa-grid .ipa-entry')).toHaveCount(41);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: '详细版', exact: true }).click();
  await expect(page.locator('.ipa-entry')).toHaveCount(126);
  await expect(page.locator('.ipa-compound-tone')).toHaveCount(3);
  expect(await page.locator('.ipa-compound-tone svg').evaluateAll(marks => marks.every(mark => mark.getBoundingClientRect().width > 10))).toBe(true);
  await expect(page.locator('.ipa-entry').first().locator('strong')).toHaveText('ee');
  await page.locator('audio').evaluate((audio: HTMLAudioElement) => { audio.muted = true; });
  await page.getByRole('button', { name: 'Play sound /i/' }).click();
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.ended && audio.duration > 0)).toBe(true);
  const fullSounds = JSON.parse(await readFile('public/ipa/full-sounds.json', 'utf8'));
  for (const entry of fullSounds.entries as { ipa: string; soundAudio: string }[]) {
    await page.getByRole('button', { name: `Play sound /${entry.ipa}/`, exact: true }).click();
    await expect(page.locator('audio')).toHaveAttribute('src', entry.soundAudio);
    await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime > 0 && audio.duration > 0 && !audio.error)).toBe(true);
    await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.pause());
  }
  await page.getByRole('button', { name: '简易版', exact: true }).click();
  await expect(page.locator('.ipa-grid .ipa-entry')).toHaveCount(41);
  await page.getByRole('button', { name: '听单词 see' }).click();
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.ended && audio.duration > 0)).toBe(true);
  await page.getByRole('button', { name: '详细版', exact: true }).click();
  await expect(page.locator('.ipa-table')).toHaveCount(4);
  await page.goto('/library/grammar');
  await page.getByRole('searchbox', { name: '搜索单词、搭配或用法疑问' }).fill('条件句');
  await expect(page.locator('.grammar-results details').first()).toBeVisible();
  expect(await page.locator('.grammar-results details').count()).toBeGreaterThanOrEqual(2);
  await page.locator('.grammar-results summary').first().click();
  await expect(page.getByText('If it rains, we will stay in.')).toBeVisible();
  const range = await page.evaluate(async () => {
    const response = await fetch('/audio/a1-words/word-1.mp3', { headers: { Range: 'bytes=0-99' } });
    return { status: response.status, contentRange: response.headers.get('content-range'), length: (await response.arrayBuffer()).byteLength };
  });
  expect(range).toMatchObject({ status: 206, length: 100 });
  expect(range.contentRange).toMatch(/^bytes 0-99\/\d+$/);
  const advancedRange = await page.evaluate(async () => {
    const response = await fetch('/audio/c2-speech/flood-discussion.mp3', { headers: { Range: 'bytes=0-99' } });
    return { status: response.status, length: (await response.arrayBuffer()).byteLength };
  });
  expect(advancedRange).toEqual({ status: 206, length: 100 });
  await page.goto('/library/dictionary');
  await page.getByRole('combobox', { name: '查询单词或短语' }).fill('zebra');
  await expect(page.getByRole('option', { name: 'zebra', exact: true })).toBeVisible();
  await page.getByLabel('查询单词或短语').press('Enter');
  await expect(page.locator('.dictionary-results h3')).toHaveText('zebra');
  await expect(page.locator('.dictionary-results article').first()).toBeVisible();
  await page.goto('/today');
  await expect(page.getByRole('heading', { name: '今日' })).toBeVisible();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click();
  await confirmTask(page);
  await completeWorkspace(page);
  const readingURL = page.url();
  await page.getByRole('link', { name: '离开任务' }).click();
  await expect(page).toHaveURL(/\/today$/);
  await page.goto(readingURL); await expect(page.locator('#workspace-result')).toBeVisible();
  await page.getByRole('link', { name: '离开任务' }).click();
  await page.locator('.primary-task:not(.reading-task):not(.combined-training)').getByRole('button', { name: '开始', exact: true }).click();
  await confirmTask(page); await completeWorkspace(page);
  expect(await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.ended && audio.duration > 0)).toBe(true);
  await page.getByRole('link', { name: '离开任务' }).click();
  await expect(page).toHaveURL(/\/today$/);
  const c2 = page.locator('.task-row').filter({ has: page.getByRole('heading', { name: '保留分歧与责任' }) });
  await c2.getByRole('button', { name: '开始阅读' }).click();
  await confirmTask(page); await completeWorkspace(page);
  await expect(page.locator('.workspace-review').first().locator('blockquote')).toHaveCount(2);
  expect(await page.evaluate(async () => { try { await fetch('/api/unknown'); return false; } catch { return true; } })).toBe(true);
  expect(external).toEqual([]);
});

test('a failed selected package preserves earlier packages and learning records', async ({ page, context }) => {
  await page.goto('/today');
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click();
  await confirmTask(page);
  await completeWorkspace(page);
  await page.getByRole('link', { name: '离开任务' }).click();
  await expect(page).toHaveURL(/\/today$/);
  const license = Buffer.from(await readFile('/tmp/lingfern-offline-fixtures-resources/public/audio/a1-words/CC-BY-SA-3.0.txt'));
  license[0] ^= 1;
  await page.route('**/audio/a1-words/CC-BY-SA-3.0.txt?offline-install=*', route => route.fulfill({ status: 200, contentType: 'text/plain', body: license }));
  await page.goto('/library');
  await expect(page.locator('.package-row input:checked')).toHaveCount(0);
  await page.locator('.package-row').filter({ hasText: '英语用法词典' }).locator('input').check();
  await page.getByRole('button', { name: /^通用材料/ }).last().click();
  await page.locator('.package-row').filter({ hasText: 'A1 单词录音' }).locator('input').check();
  await page.getByRole('button', { name: '下载所选资源' }).click();
  await expect(page.getByRole('alert')).toContainText('校验失败');
  await expect(page.locator('.package-row').filter({ hasText: '英语用法词典' })).toContainText('已安装');
  await expect(page.locator('.package-row').filter({ hasText: 'A1 单词录音' })).not.toContainText('已安装');
  await context.setOffline(true);
  await page.goto('/library/grammar');
  await expect(page.getByRole('heading', { name: '英语用法词典' })).toBeVisible();
  await page.getByRole('searchbox', { name: '搜索单词、搭配或用法疑问' }).fill('被动');
  await expect(page.locator('.grammar-results details')).toHaveCount(1);
  await page.goto('/progress');
  await expect(page.locator('.totals dd').first()).toHaveText('4');
});

test('select all toggles all packages and removal keeps learning records', async ({ page, context }) => {
  await page.goto('/today');
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click();
  await confirmTask(page);
  await completeWorkspace(page);
  await page.goto('/progress');
  await expect(page.locator('.totals dd').first()).toHaveText('4');
  await page.goto('/library');
  await expect(page.locator('.package-row input:checked')).toHaveCount(0);
  await page.getByRole('button', { name: '全选', exact: true }).click();
  await expect(page.locator('.package-row input:checked')).toHaveCount(await page.locator('.package-row').count());
  await page.getByRole('button', { name: '取消全选' }).click();
  await expect(page.locator('.package-row input:checked')).toHaveCount(0);
  const grammar = page.locator('.package-row').filter({ hasText: '英语用法词典' });
  await grammar.locator('input').check();
  await expect(grammar).toBeVisible();
  await expect(page.getByRole('button', { name: '下载所选资源' })).toBeEnabled();
  await page.getByRole('button', { name: '下载所选资源' }).click();
  await expect(grammar).toContainText('已安装');
  await page.reload();
  await expect(page.locator('.package-row input:checked')).toHaveCount(0);
  await grammar.locator('input').check();
  await expect(grammar).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByRole('button', { name: '删除所选资源' })).toBeEnabled();
  await page.getByRole('button', { name: '删除所选资源' }).click();
  const removal = page.getByRole('alertdialog');
  await expect(removal.getByRole('button', { name: '取消', exact: true })).toBeFocused();
  await removal.getByRole('button', { name: '删除所选资源', exact: true }).click();
  await expect(grammar).not.toContainText('已安装');
  await page.reload();
  await expect(grammar).not.toContainText('已安装');
  await page.goto('/progress');
  await expect(page.locator('.totals dd').first()).toHaveText('4');
});


test('finite variants generate, save and reload with the network disconnected', async ({ page, context }) => {
  await page.goto('/today');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.getByRole('button', { name: '开始变式练习', exact: true }).click();
  const { lesson, slots } = await completeWorkspace(page);
  expect(slots).toBeLessThanOrEqual(12);
  await page.reload(); await expect(page.locator('#workspace-result')).toBeVisible();
  await expect(page.locator('.slot-result')).toHaveCount(slots);
  expect(await page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('lingfern'); open.onerror = () => reject(open.error);
    open.onsuccess = () => { const db = open.result, request = db.transaction('sessions').objectStore('sessions').get(location.pathname.split('/').at(-1)!); request.onsuccess = () => { resolve(request.result.lesson); db.close(); }; };
  }))).toEqual(lesson);
});

test('first-run choices persist and route to available reading while disconnected', async ({ page, context }) => {
  await page.goto('/start');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.goto('/introduction'); await expect(page).toHaveURL(/\/introduction$/); await expect(page.locator('.welcome')).toBeVisible();
  await page.reload(); await expect(page.locator('.welcome')).toBeVisible();
  for (const index of [1, 2, 0]) {
    await page.locator('.welcome-dots button').nth(index).click();
    await expect(page.locator('.welcome-card[data-current=true]')).toHaveAttribute('aria-label', `第 ${index + 1} 张，共 3 张`);
  }
  expect(await page.evaluate(() => localStorage.getItem('lingfern.onboarding.seen'))).toBeNull();
  await page.locator('.welcome-start').click(); await expect(page.locator('.first-run')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('lingfern.onboarding.seen'))).toBe('1');
  for (let step = 0; step < 3; step++) {
    await page.getByRole('button', { name: '跳过这一步' }).click();
    await expect(page.locator('.first-run-top span')).toHaveText(`第 ${step + 2} 步，共 5 步`);
  }
  await page.getByRole('group', { name: '阅读', exact: true }).getByRole('radio', { name: /^B1/ }).check();
  await page.getByRole('button', { name: '保存并继续', exact: true }).click();
  await expect(page.getByRole('heading', { name: '试一份简短任务' })).toBeVisible();
  await expect(page.getByRole('button', { name: '试试听力示例' })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('heading', { name: '试一份简短任务' })).toBeVisible();
  await page.getByRole('button', { name: '保存并前往今日' }).click();
  await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  await page.locator('.primary-task').first().getByRole('button', { name: '开始', exact: true }).click();
  await confirmTask(page);
  await expect(page.locator('.material-workspace')).toBeVisible();
  await expect(page.locator('.question-panel')).toBeVisible();
});

test('built learning lookup preserves native context menu and frosted surfaces', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/today');
  await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click();
  await confirmTask(page);
  await page.locator('.passage').first().evaluate(paragraph => {
    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    let text: Node | null;
    while ((text = walker.nextNode()) && !text.textContent?.includes('library')) {}
    if (!text) throw new Error('Passage word not found');
    const offset = text.textContent!.indexOf('library');
    const range = document.createRange();
    range.setStart(text, offset); range.setEnd(text, offset + 7);
    getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
    const rect = range.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });
  expect(await page.locator('.passage').first().evaluate(el => el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })))).toBe(true);
  await expect(page.locator('.selection-dictionary-menu')).toHaveCSS('backdrop-filter', /blur/);
  await expect(page.locator('.selection-dictionary-menu')).toHaveCSS('background-color', 'rgba(48, 50, 48, 0.25)');
  await page.getByRole('button', { name: '查词', exact: true }).click();
  await expect(page.locator('.selection-dictionary')).toHaveCSS('backdrop-filter', /blur/);
  await expect(page.locator('.selection-dictionary')).toHaveCSS('background-color', 'rgba(48, 50, 48, 0.25)');
  await expect(page.getByText('A place where you can read or borrow books.')).toBeVisible();
  await page.screenshot({ path: 'output/playwright/selection-lookup-1440x900-dark-built.png' });
});

test('MCP settings reopens offline without a cloud session prerequisite', async ({ page, context }) => {
  await page.goto('/today');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'MCP', exact: true })).toBeVisible();
  await expect(page.locator('.sharing-endpoint')).toHaveText('https://lingfern.com/mcp');
  await expect(page.locator('.github-identity')).toContainText('暂时无法检查连接状态。');
  await expect(page.locator('.mobile-nav a[aria-current=page]')).toHaveAttribute('href', '/settings');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'MCP', exact: true })).toBeVisible();
});

test('C1 concessions complete and reopen with new course definitions while disconnected', async ({ page, context }) => {
  await page.goto('/today');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.locator('.task-row').filter({ has: page.getByRole('heading', { name: '读懂让步与有条件的建议' }) }).getByRole('button').click();
  await confirmTask(page);
  const url = page.url();
  await completeWorkspace(page);
  await expect(page.locator('.workspace-review').last().locator('blockquote')).toHaveCount(3);
  await page.reload(); await expect(page.locator('#workspace-result')).toBeVisible();
  await page.goto('/library/dictionary');
  await page.getByRole('combobox', { name: '查询单词或短语' }).fill('provided');
  await page.getByRole('option', { name: 'provided', exact: true }).click();
  await expect(page.getByText('Only if a stated condition is met. In a recommendation, it introduces a condition on support.')).toBeVisible();
  await page.goto(url);
  await expect(page.locator('#workspace-result')).toBeVisible();
});

test('A2 service instructions save orders and retain course-specific advice offline', async ({ page, context }) => {
  await page.goto('/today');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.locator('.task-row').filter({ has: page.getByRole('heading', { name: '按服务说明办事' }) }).getByRole('button').click();
  await confirmTask(page);
  await completeWorkspace(page);
  await page.reload(); await expect(page.locator('#workspace-result')).toBeVisible();
  await expect(page.locator('.workspace-review')).toHaveCount(4);

});

test('downloads a local ZIP and restores answers into a separate profile while offline', async ({ page, context }) => {
  await page.goto('/today');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click(); await confirmNewTask(page);
  const { slots } = await completeWorkspace(page);
  expect(slots).toBe(2);
  await page.getByRole('link', { name: '离开任务' }).click();
  await page.getByRole('link', { name: '设置', exact: true }).click();
  await context.setOffline(true);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载备份' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^lingfern-backup-.*\.zip$/);
  const bytes = await readFile((await file.path())!);
  await expect(page.locator('.backup-file-button')).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.backup-file-button').click();
  await (await chooser).setFiles({ name: 'saved.zip', mimeType: 'application/zip', buffer: bytes });
  await expect(page.locator('.backup-file-name')).toHaveText('saved.zip');
  await expect(page.getByText('待导入：本机档案')).toBeVisible();
  await expect(page.locator('.backup-preview')).toContainText('任务 1 · 作答 2');
  await page.getByRole('button', { name: '导入为新档案' }).click();
  await expect(page.getByRole('status').filter({ hasText: '已建立新档案并导入记录。' })).toBeVisible();
  const current = await page.getByRole('button', { name: '当前档案' }).getAttribute('data-value');
  expect(current).not.toBe('local-guest');
  await page.getByRole('link', { name: '今日', exact: true }).click(); await page.getByRole('link', { name: '历史记录', exact: true }).click();
  await expect(page.locator('.totals dd').first()).toHaveText('2');
  await page.getByRole('link', { name: '设置', exact: true }).click();
  await selectPicker(page, '当前档案', 'local-guest');
  await page.getByRole('link', { name: '今日', exact: true }).click(); await page.getByRole('link', { name: '历史记录', exact: true }).click();
  await expect(page.locator('.totals dd').first()).toHaveText('2');
});
