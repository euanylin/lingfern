import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';
import { confirmTask } from './task-start';
import { showLearningPane } from './learning-pane';

for (const locale of ['zh-Hans', 'zh-Hant', 'en']) test(`C1 concessions retain scope and cross-source responsibility (${locale})`, async ({ page }) => {
  await page.goto('/settings');
  const label = await page.getByRole('button', { name: /^(语言|語言|Language)$/ }).getAttribute('aria-label');
  await selectPicker(page, label!, locale);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/today');
  const title = locale === 'en' ? 'Read concessions and conditional recommendations' : locale === 'zh-Hant' ? '讀懂讓步與有條件的建議' : '读懂让步与有条件的建议';
  await page.locator('.task-row').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).getByRole('button').click();
  await expect(page.getByRole('dialog')).toContainText('Repair-centre and oral-history index editorials');
  await confirmTask(page);
  await expect(page.locator('.passage')).toHaveCount(3);
  const save = locale === 'en' ? 'Save answer' : locale === 'zh-Hant' ? '儲存答案' : '保存答案';
  const next = locale === 'en' ? 'Next question' : locale === 'zh-Hant' ? '下一題' : '下一题';
  for (const [position, answer] of [1, 2, 0, 2].entries()) {
    await showLearningPane(page, 'question');
    await page.getByRole('radio').nth(answer).check();
    await page.getByRole('button', { name: save, exact: true }).click();
    await expect(page.locator('.feedback blockquote')).toHaveCount(position === 3 ? 3 : 2);
    await expect(page.locator('.feedback h2').first()).toContainText('✓');
    await expect(page.locator('.feedback')).toContainText('mark the concession');
    if (position === 0) {
      for (const width of [1440, 1200, 1024, 768, 375, 320]) {
        await page.setViewportSize({ width, height: 812 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: `output/playwright/c1-concessions-${width}-light-${locale}-one-answer.png` });
      }
    }
    if (position === 2) await expect(page.locator('.evidence-source')).toContainText(['Review', 'Review']);
    if (position < 3) await page.getByRole('button', { name: next, exact: true }).click();
  }
  const completion = locale === 'en' ? 'Reading task saved' : locale === 'zh-Hant' ? '閱讀任務已儲存' : '阅读任务已保存';
  await expect(page.getByRole('heading', { name: completion, exact: true })).toBeVisible();
  await page.reload();
  await showLearningPane(page, 'question');
  await expect(page.getByRole('heading', { name: completion, exact: true })).toBeVisible();
});
