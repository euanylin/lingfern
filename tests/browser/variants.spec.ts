import { showLearningPane } from './learning-pane';
import { expect, test } from '@playwright/test';
import { currentSnapshot, focusQuestion, fillQuestion, completeWorkspace, verifyWorkspace } from './workspace';

test('generated practice saves exact notices, resumes and gives evidence within the shared quantity budget', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/today'); await page.getByRole('button', { name: '开始变式练习', exact: true }).click();
  const lesson = await currentSnapshot(page);
  await expect(page.locator('.material-workspace')).toBeVisible();
  await showLearningPane(page, 'material'); const text = await page.locator('.material').innerText();
  await fillQuestion(await focusQuestion(page, lesson, 0), lesson.materials[0].questions[0]);
  const url = page.url();
  await expect.poll(() => page.evaluate(async () => Object.keys((await (await import('/src/data/db.ts' as string)).sessions.toArray())[0].workspace.drafts).length)).toBe(1);
  await page.getByRole('link', { name: '离开任务' }).click();
  await page.getByRole('button', { name: '继续变式练习', exact: true }).click(); await expect(page).toHaveURL(url);
  await showLearningPane(page, 'material'); expect(await page.locator('.material').innerText()).toBe(text);
  await completeWorkspace(page, lesson); await verifyWorkspace(page, lesson);
  for (const quote of await page.locator('.workspace-review blockquote').all()) await expect(quote).toContainText('Today');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/today'); await page.getByRole('button', { name: '开始变式练习', exact: true }).click();
  await showLearningPane(page, 'question');
  await expect(page.getByRole('heading', { name: /When does the train leave today\?/ })).toBeVisible(); expect(page.url()).not.toBe(url);
  await page.goto('/progress'); await expect(page.locator('.totals dd')).toHaveText(['2', '2']);
  const seen = await page.evaluate(async () => (await import('/src/data/db.ts' as string)).exposures.toArray());
  expect(seen).toHaveLength(2); expect(seen.flatMap((entry: { contacts: unknown[] }) => entry.contacts)).toHaveLength(3);
  expect(new Set(seen.flatMap((entry: { contacts: { variantGroup: string }[] }) => entry.contacts.map(contact => contact.variantGroup))).size).toBe(2);
});
