import { expect, test } from '@playwright/test';
import { openSnapshot, focusQuestion, fillQuestion, submitWorkspace } from './workspace';

test('C2 draft compares two sources, saves evidence and transfers to a new pair', async ({ page }) => {
  const { lesson } = await openSnapshot(page, 'c2-reading');
  await expect(page.locator('.material h3')).toHaveText(['Mara · Access lead', 'Elias · Collections archivist']);
  await expect(page.locator('.passage')).toHaveCount(2);
  const questions = lesson.materials.flatMap(material => material.questions);
  for (const [index, question] of questions.entries()) {
    const section = await focusQuestion(page, lesson, index);
    await expect(section.locator('h2')).toContainText(question.prompt);
    if (index === 2) await expect(page.locator('.material h3')).toHaveText(['Nia · Community liaison', 'Owen · Translation reviewer']);
    await fillQuestion(section, question);
    if (!index) { await expect(page.locator('.workspace-save-status')).toHaveText('已保存在本设备'); await page.reload(); await expect(page.getByRole('radio').first()).toBeChecked(); }
  }
  await submitWorkspace(page);
  for (const index of [0, 2]) await expect(page.locator('.workspace-review').nth(index).locator('blockquote')).toHaveCount(2);
  await expect(page.locator('.slot-result')).toHaveText(Array(4).fill(/✓/));
  await page.reload(); await expect(page.locator('.workspace-review')).toHaveCount(4);
});
