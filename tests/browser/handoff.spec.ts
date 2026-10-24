import { openSnapshot, completeWorkspace } from './workspace';
import { expect, test } from '@playwright/test';

test('saved feedback can be selectively exported without contacting an AI site', async ({ page }) => {
  const external: string[] = [];
  page.on('request', request => { if (new URL(request.url()).hostname !== '127.0.0.1') external.push(request.url()); });
  const { lesson } = await openSnapshot(page, 'a1-reading', true);
  await completeWorkspace(page, lesson);
  await page.getByText('询问 AI').first().click();
  await expect(page.getByRole('heading', { name: '上下文阅读视图' })).toBeVisible();
  await page.getByRole('checkbox', { name: '材料' }).uncheck();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 JSON' }).click();
  const file = await download;
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const context = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { sections: { label: string; text: string }[]; request: string };
  expect(context.sections.map(section => section.label)).not.toContain('材料');
  expect(context.sections.map(section => section.label)).toContain('回答');
  expect(context.sections.map(section => section.label)).toContain('已知反馈');
  expect(context.request).toBe('解释我的错误');
  await page.getByRole('radio', { name: '再举一个例子' }).check();
  const markdownDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 Markdown' }).click();
  const markdownFile = await markdownDownload;
  const markdownStream = await markdownFile.createReadStream();
  const markdownChunks: Buffer[] = [];
  for await (const chunk of markdownStream) markdownChunks.push(Buffer.from(chunk));
  const markdown = Buffer.concat(markdownChunks).toString('utf8');
  expect(markdown).toContain('## 请求\n再举一个例子');
  expect(markdown).not.toContain('Meet at the library at ten.');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: '复制 Markdown' }).click();
  await expect(page.getByRole('status').filter({ hasText: '已复制。' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(markdown);
  expect(external).toEqual([]);
});

test('external feedback is reviewed and saved as a note without changing the answer', async ({ page }) => {
  const { lesson } = await openSnapshot(page, 'a1-reading', true);
  await completeWorkspace(page, lesson);
  const handoff = page.locator('.ai-handoff').first();
  await page.getByText('询问 AI').first().click();
  await handoff.getByLabel('粘贴纯文本反馈').fill('The location clue supports the answer.');
  await page.getByRole('button', { name: '检查反馈' }).click();
  await expect(page.getByRole('paragraph').filter({ hasText: 'The location clue supports the answer.' })).toBeVisible();
  await page.getByRole('button', { name: '保存为笔记' }).click();
  await expect(page.getByRole('status').filter({ hasText: '反馈已保存为笔记。' })).toBeVisible();
  await expect(page.getByRole('paragraph').filter({ hasText: 'The location clue supports the answer.' })).toBeVisible();
  await handoff.getByLabel('选择 JSON 反馈').setInputFiles({ name: 'feedback.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ explanation: 'Check the time phrase.', evidence: [{ blockId: 'unknown', comment: 'Unverified.' }] })) });
  await expect(page.getByText('材料或目标引用不存在，按普通文字保存。')).toBeVisible();
  await page.getByRole('button', { name: '保存为笔记' }).click();
  await expect(page.getByRole('status').filter({ hasText: '反馈已保存为笔记。' })).toBeVisible();
  await page.reload();
  await page.getByText('询问 AI').first().click();
  await expect(page.getByRole('paragraph').filter({ hasText: 'The location clue supports the answer.' })).toBeVisible();
  await expect(page.getByRole('paragraph').filter({ hasText: 'Check the time phrase.' })).toBeVisible();
  await expect(page.getByText('材料或目标引用不存在，按普通文字保存。')).toBeVisible();
  await expect(page.locator('.slot-result')).toHaveText([/✓/, /✓/]);
  expect(await page.evaluate(async () => (await (await import('/src/data/db.ts' as string)).attempts.toArray()).map((attempt: {correct:boolean; answer:number}) => ({correct:attempt.correct,answer:attempt.answer})))).toEqual([{correct:true,answer:1},{correct:true,answer:1}]);
});

test('pending feedback saves reject duplicate clicks and preserve the approved draft', async ({ page }) => {
  const { lesson } = await openSnapshot(page, 'a1-reading', true);
  await completeWorkspace(page, lesson);
  const handoff = page.locator('.ai-handoff').first();
  await handoff.locator(':scope > summary').click();
  const pasted = handoff.getByLabel('粘贴纯文本反馈');
  await pasted.fill('One approved synthetic feedback note.');
  await handoff.getByRole('button', { name: '检查反馈', exact: true }).click();
  await page.evaluate(async () => {
    const { db, feedbackNotes } = await import('/src/data/db.ts' as string);
    const add = feedbackNotes.add.bind(feedbackNotes);
    const pending = new Promise<void>(resolve => window.addEventListener('release-feedback-save', () => resolve(), { once: true }));
    feedbackNotes.add = async (note: unknown) => { await db.constructor.waitFor(pending); return add(note); };
  });
  const save = handoff.getByRole('button', { name: '保存为笔记', exact: true });
  await save.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  try {
    await expect(save).toBeDisabled();
    await expect(pasted).toBeDisabled();
    await expect(handoff.getByRole('button', { name: '检查反馈', exact: true })).toBeDisabled();
    await expect(handoff.getByLabel('选择 JSON 反馈')).toBeDisabled();
  } finally { await page.evaluate(() => window.dispatchEvent(new Event('release-feedback-save'))); }
  await expect(handoff.getByRole('status').filter({ hasText: '反馈已保存为笔记。' })).toBeVisible();
  await expect(pasted).toBeEnabled();
  expect(await page.evaluate(async () => (await (await import('/src/data/db.ts' as string)).feedbackNotes.toArray()).map((note: { content: string }) => note.content))).toEqual(['One approved synthetic feedback note.']);
  await page.reload();
  await page.locator('.ai-handoff').first().locator(':scope > summary').click();
  await expect(page.getByText('One approved synthetic feedback note.', { exact: true })).toHaveCount(1);
  await expect(page.locator('.slot-result')).toHaveText([/✓/, /✓/]);
});

test('pending JSON feedback reads cannot save an older preview and unlock after invalid input', async ({ page }) => {
  const { lesson } = await openSnapshot(page, 'a1-reading', true);
  await completeWorkspace(page, lesson);
  const handoff = page.locator('.ai-handoff').first();
  await handoff.locator(':scope > summary').click();
  const pasted = handoff.getByLabel('粘贴纯文本反馈');
  const review = handoff.getByRole('button', { name: '检查反馈', exact: true });
  const file = handoff.getByLabel('选择 JSON 反馈');
  await pasted.fill('Previous synthetic plain text preview.');
  await review.click();
  await expect(handoff.getByRole('button', { name: '保存为笔记', exact: true })).toBeEnabled();
  await page.evaluate(() => {
    const read = File.prototype.text;
    const pending = new Promise<void>(resolve => window.addEventListener('release-feedback-json', () => resolve(), { once: true }));
    File.prototype.text = async function () {
      if (this.name === 'pending-feedback.json') await pending;
      return read.call(this);
    };
  });
  await file.setInputFiles({ name: 'pending-feedback.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ explanation: 'New synthetic JSON feedback.' })) });
  try {
    await expect(handoff.getByRole('button', { name: '保存为笔记', exact: true })).toHaveCount(0);
    await expect(pasted).toBeDisabled();
    await expect(review).toBeDisabled();
    await expect(file).toBeDisabled();
    expect(await page.evaluate(async () => (await import('/src/data/db.ts' as string)).feedbackNotes.count())).toBe(0);
  } finally { await page.evaluate(() => window.dispatchEvent(new Event('release-feedback-json'))); }
  await expect(handoff.getByText('New synthetic JSON feedback.', { exact: true })).toBeVisible();
  await expect(pasted).toBeEnabled();
  await handoff.getByRole('button', { name: '保存为笔记', exact: true }).click();
  await expect(handoff.getByRole('status').filter({ hasText: '反馈已保存为笔记。' })).toBeVisible();
  expect(await page.evaluate(async () => (await (await import('/src/data/db.ts' as string)).feedbackNotes.toArray()).map((note: { content: string }) => note.content))).toEqual(['New synthetic JSON feedback.']);
  await file.setInputFiles({ name: 'invalid-feedback.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  await expect(handoff.getByRole('status').filter({ hasText: '反馈无效或过大' })).toBeVisible();
  await expect(review).toBeEnabled();
  await expect(file).toBeEnabled();
  await pasted.fill('Recovered synthetic feedback after invalid JSON.');
  await review.click();
  await expect(handoff.getByRole('paragraph').filter({ hasText: 'Recovered synthetic feedback after invalid JSON.' })).toBeVisible();
  await expect(page.locator('.slot-result')).toHaveText([/✓/, /✓/]);
});

test('material excerpt is selected from the original text and clearly labelled in export', async ({ page }) => {
  const { lesson } = await openSnapshot(page, 'a1-reading', true);
  await completeWorkspace(page, lesson);
  const handoff = page.locator('.ai-handoff').first();
  await page.getByText('询问 AI').first().click();
  await handoff.getByText('选取材料节选').click();
  await handoff.locator('.ai-excerpt textarea').evaluate(element => {
    const input = element as HTMLTextAreaElement;
    const start = input.value.indexOf('at the library');
    input.focus();
    input.setSelectionRange(start, start + 'at the library'.length);
    input.dispatchEvent(new Event('select', { bubbles: true }));
  });
  await page.getByRole('button', { name: '使用选中内容' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 JSON' }).click();
  const file = await download;
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const context = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { sections: { label: string; text: string }[] };
  const material = context.sections.find(section => section.label === '材料')!.text;
  expect(material).toContain('仅含节选\nat the library');
  expect(material).not.toContain('Bring your student card.');
  await page.getByRole('button', { name: '使用完整材料' }).click();
  await expect(page.locator('.ai-preview').first()).toContainText('Bring your student card.');
});
