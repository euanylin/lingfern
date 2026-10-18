import { readFile } from 'node:fs/promises';
import { showLearningPane } from '../browser/learning-pane';
import { confirmTask } from '../browser/task-start';
import { expect, test } from '@playwright/test';
import { selectPicker } from '../browser/picker';

test('open response and self-assessment save and reopen offline without a score', async ({ page, context }) => {
  await page.goto('/today');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.locator('.task-row').filter({ has: page.getByRole('heading', { name: '转述计划与限制' }) }).getByRole('button').click();
  await confirmTask(page);
  const response = 'Wait for Friday’s email. The room needs an inspection; the alternative is online.';
  await page.locator('.response-answer textarea').fill(response);
  await page.getByRole('button', { name: '保存答案' }).click();
  await expect(page.getByRole('heading', { name: '已保存 · 未自动评分' })).toBeVisible();
  for (const row of await page.locator('.self-assessment fieldset').all()) await row.getByRole('radio', { name: 'Unsure', exact: true }).check();
  await page.getByRole('button', { name: 'Save self-assessment' }).click();
  await expect(page.getByText('Self-assessment saved.')).toBeVisible();
  await page.reload();
  await expect(page.locator('.response-answer textarea')).toHaveValue(response);
  await expect(page.locator('.self-assessment input:checked')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: '已保存 · 未自动评分' })).toBeVisible();
});

test('matching a new pair of messages works offline and survives reopening', async ({ page, context }) => {
  await page.goto('/today');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.locator('.task-row').filter({ has: page.getByRole('heading', { name: '配对活动安排' }) }).getByRole('button', { name: '开始阅读' }).click();
  await confirmTask(page);
  await selectPicker(page, 'Mia', 'library');
  await selectPicker(page, 'Ben', 'park');
  await page.getByRole('button', { name: '保存答案' }).click();
  await expect(page.getByRole('heading', { name: '✓ 回答正确' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.feedback blockquote')).toHaveText(['at the library', 'at the park']);
  await expect(page.getByRole('button', { name: 'Mia', exact: true })).toBeDisabled();
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
  await page.getByRole('textbox', { name: '填写听到的缺失内容。' }).fill('Room 12');
  await page.getByRole('button', { name: '播放 / 重听' }).click();
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => Number.isFinite(audio.duration) && audio.duration > 20)).toBe(true);
  await page.locator('audio').evaluate((audio: HTMLAudioElement) => { audio.muted = true; audio.playbackRate = 16; audio.currentTime = 0; });
  await expect(page.getByRole('button', { name: '保存答案' })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole('button', { name: '保存答案' }).click();
  await expect(page.getByRole('heading', { name: '✓ 回答正确' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.feedback blockquote')).toContainText('Room Twelve');
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
  await page.getByRole('textbox', { name: 'Friday' }).fill('11:00');
  await page.getByRole('textbox', { name: 'Wednesday' }).fill('9:00');
  await page.getByRole('button', { name: '保存答案' }).click();
  await page.getByRole('button', { name: '下一题' }).click();
  await page.locator('input[type=radio]').nth(1).check();
  await page.getByRole('button', { name: '保存答案' }).click();
  await expect(page.getByRole('heading', { name: '✓ 回答正确' })).toBeVisible();
  await expect(page.locator('.feedback blockquote')).toHaveCount(2);
  await page.getByRole('button', { name: '下一题' }).click();
  await page.getByRole('textbox', { name: 'Thursday' }).fill('12:00');
  await page.getByRole('textbox', { name: 'Tuesday' }).fill('10:00');
  await page.getByRole('button', { name: '保存答案' }).click();
  await page.getByRole('button', { name: '下一题' }).click();
  for (const name of ['Check the usual opening days and times.', "Check Thursday's changed opening time.", 'Plan to collect reserved materials after the doors open.']) {
    await page.getByRole('button', { name: `添加步骤: ${name}` }).click();
  }
  await page.getByRole('button', { name: '保存答案' }).click();
  await expect(page.getByRole('heading', { name: '✓ 回答正确' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '✓ 回答正确' })).toBeVisible();
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
  await page.getByRole('radio', { name: 'At the library.' }).check();
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await expect(page.getByRole('heading', { name: '✓ 回答正确' })).toBeVisible();
  const readingURL = page.url();
  await page.getByRole('link', { name: '离开任务' }).click();
  await expect(page).toHaveURL(/\/today$/);
  await page.goto(readingURL);
  await expect(page.getByRole('heading', { name: '✓ 回答正确' })).toBeVisible();
  await page.getByRole('link', { name: '离开任务' }).click();
  await page.locator('.primary-task:not(.reading-task):not(.combined-training)').getByRole('button', { name: '开始', exact: true }).click();
  await confirmTask(page);
  await page.getByRole('radio', { name: 'book', exact: true }).check();
  await page.locator('audio').evaluate((audio: HTMLAudioElement) => { audio.muted = true; });
  await page.getByRole('button', { name: '播放 / 重听', exact: true }).click();
  await expect(page.getByText('录音已播放，可以选择并保存。', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await expect(page.getByRole('heading', { name: '✓ 回答正确' })).toBeVisible();
  expect(await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.ended && audio.duration > 0)).toBe(true);
  await page.getByRole('link', { name: '离开任务' }).click();
  await expect(page).toHaveURL(/\/today$/);
  await page.getByRole('link', { name: '今日', exact: true }).click();
  const c2 = page.locator('.task-row').filter({ has: page.getByRole('heading', { name: '保留分歧与责任' }) });
  await c2.getByRole('button', { name: '开始阅读' }).click();
  await confirmTask(page);
  await page.locator('input[type=radio]').first().check();
  await page.getByRole('button', { name: '保存答案' }).click();
  await expect(page.locator('.feedback blockquote')).toHaveCount(2);
  expect(await page.evaluate(async () => { try { await fetch('/api/unknown'); return false; } catch { return true; } })).toBe(true);
  expect(external).toEqual([]);
});

test('a failed selected package preserves earlier packages and learning records', async ({ page, context }) => {
  await page.goto('/today');
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click();
  await confirmTask(page);
  await page.getByRole('radio', { name: 'At the library.' }).check();
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await expect(page.getByRole('heading', { name: '✓ 回答正确' })).toBeVisible();
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
  await expect(page.locator('.totals dd').first()).toHaveText('1');
});

test('select all toggles all packages and removal keeps learning records', async ({ page, context }) => {
  await page.goto('/today');
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click();
  await confirmTask(page);
  await page.getByRole('radio', { name: 'At the library.' }).check();
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
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
  await expect(page.locator('.totals dd').first()).toHaveText('1');
});


test('finite variants generate, save and reload with the network disconnected', async ({ page, context }) => {
  await page.goto('/today');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.getByRole('button', { name: '开始变式练习', exact: true }).click();
  await page.getByRole('radio').nth(1).check();
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await expect(page.getByRole('heading', { name: '✓ 回答正确' })).toBeVisible();
  const text = await page.locator('.material').innerText();
  await page.reload();
  expect(await page.locator('.material').innerText()).toBe(text);
  await expect(page.getByRole('heading', { name: '✓ 回答正确' })).toBeVisible();
});

test('first-run choices persist and route to available reading while disconnected', async ({ page, context }) => {
  await page.goto('/start');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
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
  await expect(page.locator('.session-header')).toBeVisible();
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
  for (const [position, answer] of [1, 2, 0, 2].entries()) {
    await showLearningPane(page, 'question');
    await page.getByRole('radio').nth(answer).check();
    await page.getByRole('button', { name: '保存答案', exact: true }).click();
    await expect(page.locator('.feedback blockquote')).toHaveCount(position === 3 ? 3 : 2);
    if (position < 3) await page.getByRole('button', { name: '下一题', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: '阅读任务已保存', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '阅读任务已保存', exact: true })).toBeVisible();
  await page.goto('/library/dictionary');
  await page.getByRole('combobox', { name: '查询单词或短语' }).fill('provided');
  await page.getByRole('option', { name: 'provided', exact: true }).click();
  await expect(page.getByText('Only if a stated condition is met. In a recommendation, it introduces a condition on support.')).toBeVisible();
  await page.goto(url);
  await expect(page.getByRole('heading', { name: '阅读任务已保存', exact: true })).toBeVisible();
});

test('A2 service instructions save orders and retain course-specific advice offline', async ({ page, context }) => {
  await page.goto('/today');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.locator('.task-row').filter({ has: page.getByRole('heading', { name: '按服务说明办事' }) }).getByRole('button').click();
  await confirmTask(page);
  const orders = [['Send the book title and your card number.', 'Wait for a message saying the book is ready.', 'Visit the main desk with your card and ask for the book.'], ['Send the item description, bus route number and journey date.', 'Wait for a reply saying the item is ready for collection.', 'Visit the transport office with the collection number.']];
  for (let position = 0; position < 4; position++) {
    if (position % 2 === 0) await page.getByRole('radio').nth(position === 0 ? 0 : 1).check();
    else for (const step of orders[(position - 1) / 2]) await page.getByRole('button', { name: `添加步骤: ${step}`, exact: true }).click();
    await page.getByRole('button', { name: '保存答案', exact: true }).click();
    await expect(page.locator('.feedback')).toContainText('下次先列出必须提交的信息，再确认哪条回复允许你前往领取。');
    if (position < 3) await page.getByRole('button', { name: '下一题', exact: true }).click();
  }
  await page.reload();
  await expect(page.getByRole('heading', { name: '阅读任务已保存', exact: true })).toBeVisible();
});
