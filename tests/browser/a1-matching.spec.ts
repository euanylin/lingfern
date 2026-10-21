import { confirmTask } from './task-start';
import { showLearningPane } from './learning-pane';
import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';

test('matching preserves partial answers, supports keyboards and cites both messages', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/today');
  const task = page.locator('.task-row').filter({ has: page.getByRole('heading', { name: '配对活动安排' }) });
  await task.getByRole('button', { name: '开始阅读' }).click();
  await confirmTask(page);
  await showLearningPane(page, 'question');
  await expect(page.getByRole('button', { name: '保存答案' })).toBeDisabled();
  const mia = page.getByRole('button', { name: 'Mia', exact: true });
  await mia.focus();
  await mia.press('End');
  await page.getByRole('option', { name: 'library', exact: true }).press('Enter');
  await expect(mia).toContainText('library');
  await expect(page.getByRole('button', { name: '保存答案' })).toBeDisabled();
  await page.waitForTimeout(500); // Wait for the 350ms draft save to finish.
  await page.getByRole('link', { name: '离开任务' }).click();
  await page.goto('/today');
  await task.getByRole('button', { name: '继续任务' }).click();
  await confirmTask(page);
  await showLearningPane(page, 'question');
  await expect(mia).toContainText('library');
  await expect(page.getByRole('button', { name: 'Ben', exact: true })).toContainText('请选择');
  await page.getByRole('button', { name: 'Ben', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'output/playwright/a1-matching-320x640-light-zh-Hans-partial.png' });
  await page.getByRole('option', { name: 'park', exact: true }).click();
  await page.getByRole('button', { name: '保存答案' }).click();
  await expect(page.getByRole('heading', { name: '✓ 回答正确' })).toBeVisible();
  await expect(page.locator('.feedback blockquote')).toHaveText(['at the library', 'at the park']);
  await page.getByRole('button', { name: '下一题' }).click();
  await expect(page.locator('.question-number > span')) .toHaveText('2 / 4');
  await showLearningPane(page, 'question');
  await expect(page.getByRole('heading', { name: 'Match each message to what you bring.' })).toBeVisible();
  await selectPicker(page, 'Mia', 'student card');
  await selectPicker(page, 'Ben', 'water');
  await page.getByRole('button', { name: '保存答案' }).click();
  await page.getByRole('button', { name: '下一题' }).click();
  await expect(page.locator('.question-number > span')) .toHaveText('3 / 4');
  await showLearningPane(page, 'question');
  await expect(page.getByRole('heading', { name: 'Match each message to a place.' })).toBeVisible();
  await selectPicker(page, 'Art club', 'pool');
  await selectPicker(page, 'Swim club', 'café');
  await page.getByRole('button', { name: '保存答案' }).click();
  await expect(page.getByRole('heading', { name: '× 再看一看' })).toBeVisible();
  await expect(page.locator('.feedback blockquote')).toHaveText(['in the café', 'at the pool']);
  await page.getByRole('button', { name: '下一题' }).click();
  await expect(page.locator('.question-number > span')) .toHaveText('4 / 4');
  await showLearningPane(page, 'question');
  await expect(page.getByRole('heading', { name: 'Match each message to what you bring.' })).toBeVisible();
  await selectPicker(page, 'Art club', 'pencil');
  await selectPicker(page, 'Swim club', 'towel');
  await page.getByRole('button', { name: '保存答案' }).click();
  await expect(page.getByText('阅读任务已保存')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'output/playwright/a1-matching-1440x900-light-zh-Hans-complete.png', fullPage: true });
  await page.reload();
  await expect(page.getByText('阅读任务已保存')).toBeVisible();
});

test('matching uses translated instructions and full-size touch options', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, colorScheme: 'dark', locale: 'zh-CN' });
  const page = await context.newPage();
  for (const [locale, languageLabel, title, instruction] of [
    ['en', '语言', 'Match the plans', 'Choose an answer for each row. You may use an answer again.'],
    ['zh-Hant', 'Language', '配對活動安排', '為每一列選擇答案；選項可以重複使用。'],
    ['zh-Hans', '語言', '配对活动安排', '为每一行选择答案；选项可以重复使用。'],
  ]) {
    await page.goto('http://127.0.0.1:5173/settings');
    await selectPicker(page, languageLabel, locale);
    await page.goto('http://127.0.0.1:5173/today');
    const task = page.locator('.task-row').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
    await task.getByRole('button').click();
    await confirmTask(page);
    await showLearningPane(page, 'question');
    await expect(page.getByText(instruction, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Mia', exact: true }).click();
    const option = page.getByRole('option', { name: 'library', exact: true });
    expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (locale === 'en') await page.screenshot({ path: 'output/playwright/a1-matching-375x812-dark-en-touch.png' });
    await page.keyboard.press('Escape');
    await expect(page.locator('.setting-menu')).toHaveCount(0);
    await expect(page.locator('#learning-question')).toHaveAttribute('data-open', 'true');
    await expect(page.getByRole('button', { name: 'Mia', exact: true })).toBeFocused();
  }
  await context.close();
});

test('long selected matching labels stay inside the answer panel after narrowing', async ({ page }) => {
  await page.goto('/today');
  const task = page.locator('.task-row').filter({ has: page.getByRole('heading', { name: '配对活动安排' }) });
  await task.getByRole('button', { name: '开始阅读' }).click();
  await confirmTask(page);
  await showLearningPane(page, 'question');
  await selectPicker(page, 'Mia', 'library');
  // Stress shared-picker DOM length without changing records or answers.
  await page.locator('.matching-answers .setting').first().evaluate(row => {
    row.querySelector('.setting-trigger > span')!.textContent = 'Ancient-period formulation of belief and philosophical systems';
    row.querySelector(':scope > span')!.textContent = 'Hinduism, Buddhism, Confucianism, Judaism, and Greek philosophy';
  });
  for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: 640 });
    await showLearningPane(page, 'question');
    const bounds = await page.locator('.matching-answers').evaluate(fieldset => {
      const panel = fieldset.closest('.question-panel')!.getBoundingClientRect(), box = fieldset.getBoundingClientRect();
      return { panelRight: panel.right, right: box.right, width: box.width, scroll: fieldset.scrollWidth };
    });
    expect(bounds.right).toBeLessThanOrEqual(bounds.panelRight);
    expect(bounds.scroll).toBeLessThanOrEqual(Math.ceil(bounds.width));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
