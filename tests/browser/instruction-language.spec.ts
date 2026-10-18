import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { lessonSchema } from '../../src/shared/content';
import { confirmTask } from './task-start';
import { selectPicker } from './picker';

for (const level of ['b1', 'b2', 'c1', 'c2']) test(`${level} instructions stay English in all interface languages, including saved lessons`, async ({ page }) => {
  const lesson = lessonSchema.parse(JSON.parse(readFileSync(`tests/fixtures/content/${level}-reading.json`, 'utf8')));
  const question = lesson.materials[0].questions[0];
  if (!('options' in question)) throw Error('Expected isolated choice fixture');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/today');
  const row = page.locator('.task-row').filter({ has: page.getByRole('heading', { name: lesson.title['zh-Hans'], exact: true }) });
  await expect(row).toContainText(lesson.goal.en);
  await expect(row).not.toContainText(lesson.goal['zh-Hans']);
  await row.getByRole('button').click();
  await expect(page.getByRole('dialog')).toContainText(lesson.goal.en);
  await confirmTask(page);
  const url = page.url();
  const id = url.split('/').at(-1)!;
  for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
    await page.goto('/settings');
    const label = await page.getByRole('button', { name: /^(语言|語言|Language)$/ }).getAttribute('aria-label');
    await selectPicker(page, label!, locale);
    await page.goto(url);
    await expect(page.locator('.lead')).toHaveText(lesson.goal.en);
    await expect(page.locator('.lead')).toHaveAttribute('lang', 'en');
    await expect(page.locator('.teaching')).toHaveAttribute('lang', 'en');
    await page.locator('.teaching summary').click();
    await expect(page.locator('.teaching')).toContainText(lesson.teaching!.en);
    await expect(page.locator('.teaching')).toContainText('Before you start');
    await expect(page.locator('.teaching')).toContainText(lesson.workedExample!.en.replace(/^Unscored example:\s*/, ''));
    await expect(page.getByRole('button', { name: locale === 'en' ? 'Save answer' : locale === 'zh-Hant' ? '儲存答案' : '保存答案', exact: true })).toBeVisible();
  }
  await page.locator('.hint').click();
  await expect(page.locator('.hint-text')).toHaveText(question.hints![0].en);
  await expect(page.locator('.hint-text')).toHaveAttribute('lang', 'en');
  // The old multilingual snapshot remains intact; only the renderer chooses English.
  expect(await page.evaluate(async id => {
    const { sessions } = await import('/src/data/db.ts' as string);
    return (await sessions.get(id)).lesson;
  }, id)).toEqual(lesson);
  await page.locator('.option input').nth(question.answer).check();
  await page.getByRole('button', { name: 'Save answer', exact: true }).click();
  await expect(page.locator('.feedback')).toContainText(question.explanations[question.answer].en);
  await page.locator('.ai-handoff > summary').click();
  await expect(page.locator('.ai-preview').first()).toContainText(lesson.goal.en);
  await expect(page.locator('.ai-preview').first()).toContainText(question.explanations[question.answer].en);
  await page.goto('/progress');
  const goal = page.locator('.progress-source-list > section').filter({ has: page.getByRole('heading', { name: lesson.goal.en, exact: true }) });
  await expect(goal.locator('h3')).toHaveText(lesson.goal.en);
  await goal.locator('.progress-cell').click();
  await expect(page.locator('#progress-record-detail h3')).toHaveText(lesson.goal.en);
  await page.reload();
  const history = page.locator('.history').filter({ has: page.getByRole('link', { name: new RegExp(lesson.title.en) }) });
  await history.locator('details summary').click();
  await expect(history).toContainText(question.explanations[question.answer].en);
});
