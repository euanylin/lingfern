import { confirmTask } from './task-start';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { selectPicker } from './picker';

const reading = JSON.parse(readFileSync('tests/fixtures/content/a1-reading.json', 'utf8')) as { id: string; title: Record<string, string>; goal: Record<string, string>; materials: { questions: { answer: number }[] }[] };

test('progress separates skills and shows first saved response without claiming goal completion', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/today');
  await page.locator('.task-row').filter({ has: page.getByRole('heading', { name: reading.title['zh-Hans'] }) }).getByRole('button', { name: '开始阅读' }).click();
  await confirmTask(page);
  await page.locator('input[type=radio]').nth(reading.materials[0].questions[0].answer).check();
  await page.getByRole('button', { name: '保存答案' }).click();
  await expect(page.getByRole('heading', { name: '✓ 回答正确' })).toBeVisible();
  await page.getByRole('link', { name: '离开任务' }).click();
  await page.goto('/progress');
  await expect(page.locator('.progress-cell [role=img]').filter({ hasText: /^●$/ })).toHaveCount(0);
  const summaries = page.locator('.progress-skill-summary > section');
  await expect(summaries.first()).toContainText('不同材料1');
  await expect(summaries.first()).toContainText('有效作答1');
  await expect(summaries.nth(1)).toContainText('有效作答0');
  const cell = page.getByRole('button', { name: `查看作答: ${reading.goal['zh-Hans']}` });
  await expect(cell).toContainText('○');
  await expect(page.locator('.progress-matrix, .progress-mobile-list')).toHaveCount(0);
  await expect(page.locator('.progress-records')).not.toContainText(/\b(?:A[12]|B[12]|C[12])\b/);
  await cell.focus();
  await cell.press('Enter');
  await expect(cell).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#progress-record-detail')).toContainText('使用帮助后答对');
  await expect(page.locator('#progress-record-detail')).toContainText('尚无完整材料作答');
  await expect(page.locator('#progress-record-detail a')).toHaveAttribute('href', /\/learn\//);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: 'output/playwright/progress-records-1440x900-light-zh-Hans-one-answer.png', fullPage: true });
  await page.getByRole('button', { name: '听力', exact: true }).click();
  await expect(page.getByRole('button', { name: `查看作答: ${reading.goal['zh-Hans']}` })).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.getByRole('button', { name: '阅读', exact: true }).click();
  await expect(page.locator('.progress-source-list .progress-cell')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: 'output/playwright/progress-records-320x640-light-zh-Hans-one-answer.png', fullPage: true });
  await page.goto('/settings');
  await selectPicker(page, '语言', 'zh-Hant');
  await page.goto('/progress');
  await expect(page.getByRole('heading', { name: '分項紀錄' })).toBeVisible();
  await page.goto('/settings');
  await selectPicker(page, '語言', 'en');
  await page.goto('/progress');
  await expect(page.getByRole('heading', { name: 'By skill' })).toBeVisible();
});

test('a completed goal material gets a dated review without a level claim', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-27T10:00:00Z') });
  await page.goto('/today');
  await page.locator('.task-row').filter({ has: page.getByRole('heading', { name: reading.title['zh-Hans'] }) }).getByRole('button', { name: '开始阅读' }).click();
  await confirmTask(page);
  for (const [index, question] of reading.materials.flatMap(material => material.questions).entries()) {
    await page.locator('input[type=radio]').nth(question.answer).check();
    await page.getByRole('button', { name: '保存答案' }).click();
    if (index < 3) await page.getByRole('button', { name: '下一题' }).click();
  }
  await page.getByRole('link', { name: '返回今日' }).click();
  await page.goto('/progress');
  await page.getByRole('button', { name: `查看作答: ${reading.goal['zh-Hans']}` }).click();
  await expect(page.locator('#progress-record-detail')).toContainText('独立完成的不同材料: 1');
  await expect(page.locator('#progress-record-detail')).toContainText('建议下次复习');
  await expect(page.locator('.progress-cell [role=img]').filter({ hasText: /^●$/ })).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 640 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#progress-record-detail').screenshot({ path: 'output/playwright/progress-review-detail-320x640-light-zh-Hans-completed-example.png' });
  await page.clock.fastForward(4 * 86_400_000);
  await page.goto('/today');
  const selection = await page.evaluate(async () => {
    const db = await import('/src/data/db.ts' as string);
    const { selectPractice } = await import('/src/data/practice.ts' as string);
    const history = await db.sessions.toArray();
    const selected = selectPractice(history.map((session: {lesson:unknown}) => session.lesson), history, await db.attempts.toArray(), 'reading', undefined, new Date());
    return { id: selected?.lesson.id, reason: selected?.reason };
  });
  expect(selection).toEqual({ id: reading.id, reason: 'review' });
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: reading.title['zh-Hans'], exact: true })).toBeVisible();
});
