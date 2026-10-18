import { expect, test } from '@playwright/test';

for (const removeExposure of [false, true]) test(`record deletion requires confirmation and persists after reopening (remove exposure: ${removeExposure})`, async ({ page }) => {
  await page.goto('/today');
  await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  const { id, prompt } = await page.evaluate(async () => {
    const dataPath = '/src/data/db.ts', lessonPath = '/tests/fixtures/content/a1-reading.json';
    const data = await import(dataPath), raw = (await import(lessonPath)).default;
    const session = await data.createSession(raw).catch((error: Error) => { throw new Error(`create: ${error.name}: ${error.message}`); }); await data.claimSession(session.id, 'test'); await data.markExposure(session).catch((error: Error) => { throw new Error(`exposure: ${error.name}: ${error.message}`); });
    for (const answer of [1, 2, 1]) { await data.submit(session.id, 'test', answer); await data.advance(session.id, 'test'); }
    await data.submit(session.id, 'test', 2);
    const record = (await data.attempts.where('sessionId').equals(session.id).toArray()).find((item: { questionId: string }) => item.questionId === session.lesson.materials[0].questions[0].id)!;
    await data.feedbackNotes.put({ id: 'private-note', profileId: 'local-guest', attemptId: record.id, kind: 'text', content: 'private feedback', unknownReferences: false, createdAt: new Date().toISOString() });
    return { id: record.id, prompt: session.lesson.materials[0].questions[0].prompt };
  });
  await page.setViewportSize({ width: 375, height: 812 }); await page.goto('/progress');
  await page.locator('.history details summary').click();
  const remove = page.locator('.history details section').filter({ has: page.getByRole('heading', { name: prompt, exact: true }) }).getByRole('button', { name: '删除此记录', exact: true });
  await remove.click(); await page.getByRole('button', { name: '取消', exact: true }).click();
  expect(await page.evaluate(async id => { const path = '/src/data/db.ts'; return Boolean(await (await import(path)).attempts.get(id)); }, id)).toBe(true);
  await remove.click(); await expect(page.getByText('旧备份及 Git 历史不会被清除。', { exact: false })).toBeVisible();
  const exposure = page.getByRole('checkbox', { name: '同时删除本题的接触记录', exact: true });
  await expect(exposure).not.toBeChecked();
  if (removeExposure) {
    await exposure.check(); await expect(exposure).toBeChecked();
    await expect.poll(() => exposure.evaluate(element => { const style = getComputedStyle(element); return style.backgroundColor === style.borderTopColor; })).toBe(true);
  }
  await page.screenshot({ path: `output/playwright/record-deletion-confirm-${removeExposure}-375-zh-Hans-light.png` });
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(page.getByRole('button', { name: '删除此记录', exact: true })).toHaveCount(3);
  const stored = await page.evaluate(async id => {
    const path = '/src/data/db.ts', syncPath = '/src/data/sync.ts'; const data = await import(path);
    return { contacts: await data.exposures.count(), answer: await data.attempts.get(id), note: await data.feedbackNotes.get('private-note'), markers: (await (await import(syncPath)).readSyncEvents('local-guest')).filter((event: { type: string }) => event.type === 'deletion') };
  }, id);
  expect(stored.answer).toBeUndefined(); expect(stored.note).toBeUndefined(); expect(stored.markers).toHaveLength(removeExposure ? 2 : 1); expect(stored.contacts).toBe(removeExposure ? 0 : 1);
  await page.goto(`/learn/${id.split(':')[0]}`);
  await expect(page.getByText('此任务的部分记录已删除。保留的答案可在记录页面查看。', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '提交答案', exact: true })).toHaveCount(0);
  await page.goto('/progress'); await page.locator('.history details summary').click();
  await expect(page.getByRole('button', { name: '删除此记录', exact: true })).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'output/playwright/record-deletion-375-zh-Hans-light.png' });
});
