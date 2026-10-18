import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';
import { confirmTask } from './task-start';
import { showLearningPane } from './learning-pane';

const bookOrder = ['Send the book title and your card number.', 'Wait for a message saying the book is ready.', 'Visit the main desk with your card and ask for the book.'];
const itemOrder = ['Send the item description, bus route number and journey date.', 'Wait for a reply saying the item is ready for collection.', 'Visit the transport office with the collection number.'];
for (const locale of ['zh-Hans', 'zh-Hant', 'en']) test(`A2 service instructions save and recover their required order (${locale})`, async ({ page }) => {
  await page.goto('/settings');
  const language = await page.getByRole('button', { name: /^(语言|語言|Language)$/ }).getAttribute('aria-label');
  await selectPicker(page, language!, locale);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/today');
  const title = locale === 'en' ? 'Follow service instructions' : locale === 'zh-Hant' ? '依服務說明辦事' : '按服务说明办事';
  await page.locator('.task-row').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).getByRole('button').click();
  await confirmTask(page);
  const save = locale === 'en' ? 'Save answer' : locale === 'zh-Hant' ? '儲存答案' : '保存答案';
  const next = locale === 'en' ? 'Next question' : locale === 'zh-Hant' ? '下一題' : '下一题';
  const add = locale === 'en' ? 'Add step' : locale === 'zh-Hant' ? '加入步驟' : '添加步骤';
  const advice = locale === 'en' ? 'Next time, list the required details and check which reply tells you that collection can begin.' : locale === 'zh-Hant' ? '下次先列出必須提交的資訊，再確認哪則回覆允許你前往領取。' : '下次先列出必须提交的信息，再确认哪条回复允许你前往领取。';
  for (let position = 0; position < 4; position++) {
    await showLearningPane(page, 'question');
    if (position % 2 === 0) await page.getByRole('radio').nth(position === 0 ? 0 : 1).check();
    else {
      const order = position === 1 ? bookOrder : itemOrder;
      await page.getByRole('button', { name: `${add}: ${order[0]}`, exact: true }).click();
      if (position === 1) {
        await expect.poll(() => page.evaluate(async () => { const path = '/src/data/db.ts'; const { sessions } = await import(path); return (await sessions.toArray()).find((session: { status: string }) => session.status === 'active')?.draft; })).toEqual([order[0]]);
        await page.reload();
        await showLearningPane(page, 'question');
        await expect(page.locator('.sequence-order')).toContainText(order[0]);
      }
      for (const step of order.slice(1)) await page.getByRole('button', { name: `${add}: ${step}`, exact: true }).click();
      if (position === 1) for (const width of [1440, 1200, 1024, 768, 375, 320]) {
        await page.setViewportSize({ width, height: 812 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: `output/playwright/a2-services-${width}-light-${locale}-ordered.png` });
      }
    }
    await showLearningPane(page, 'question');
    await page.getByRole('button', { name: save, exact: true }).click();
    await expect(page.locator('.feedback h2').first()).toContainText('✓');
    await expect(page.locator('.feedback')).toContainText(advice);
    await expect(page.locator('.feedback blockquote')).toHaveCount(position % 2 === 0 ? 1 : 2);
    if (position < 3) await page.getByRole('button', { name: next, exact: true }).click();
  }
  const completed = locale === 'en' ? 'Reading task saved' : locale === 'zh-Hant' ? '閱讀任務已儲存' : '阅读任务已保存';
  await expect(page.getByRole('heading', { name: completed, exact: true })).toBeVisible();
  await page.reload();
  await showLearningPane(page, 'question');
  await expect(page.getByRole('heading', { name: completed, exact: true })).toBeVisible();
});
