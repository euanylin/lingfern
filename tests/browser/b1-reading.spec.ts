import { expect, test } from '@playwright/test';
import { openSnapshot, focusQuestion, fillQuestion, submitWorkspace } from './workspace';

test('B1 connected updates use causes and conditions across two materials', async ({ page }) => {
  const { lesson } = await openSnapshot(page, 'b1-reading');
  const questions = lesson.materials.flatMap(material => material.questions);
  for (const [index, question] of questions.entries()) {
    const section = await focusQuestion(page, lesson, index);
    await expect(section.locator('h2')).toContainText(question.prompt);
    await fillQuestion(section, question);
  }
  await submitWorkspace(page);
  const reviews = page.locator('.workspace-review');
  await expect(reviews.nth(0).locator('blockquote')).toContainText('wet ground');
  await expect(reviews.nth(1).locator('blockquote')).toHaveCount(2);
  await expect(reviews.nth(2).locator('blockquote')).toContainText('computer room at two');
  await expect(page.locator('.slot-result')).toHaveText(Array(4).fill(/✓/));
  await page.reload(); await expect(reviews).toHaveCount(4);
});
