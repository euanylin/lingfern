import { expect, test } from '@playwright/test';
import { openSnapshot, completeWorkspace } from './workspace';

for (const skill of ['reading', 'listening']) test(`${skill} settings cycle keyboard focus and restore the trigger`, async ({ page }) => {
  await page.goto('/today');
  const trigger = page.locator(`[data-practice-skill=${skill}]`).first();
  await trigger.focus(); await trigger.press('Enter');
  const dialog = page.locator('.practice-options-dialog'), close = dialog.locator('header button');
  await expect(dialog).toHaveAttribute('data-open', 'true');
  await expect(close).toBeFocused();
  await close.press('Shift+Tab');
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Tab'); await expect(close).toBeFocused();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
});

for (const name of ['a1-reading', 'a1-listening']) test(`${name} saves the actual skill with neutral feedback`, async ({ page }) => {
  const { id, lesson } = await openSnapshot(page, name, true);
  await completeWorkspace(page, lesson);
  await expect(page.locator('#workspace-result')).toHaveText('任务已保存');
  expect(await page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).sessions.get(id)).lesson.skill, id)).toBe(lesson.skill);
});

// Exercise a second consumer of showModal, including dynamic controls.
test('task preview cycles both keyboard boundaries without activating the background', async ({ page }) => {
  await page.goto('/today');
  const trigger = page.locator('.reading-task .practice-card-action');
  await trigger.focus(); await trigger.press('Enter');
  const dialog = page.locator('.task-detail'), close = dialog.locator('header button');
  await expect(dialog).toHaveAttribute('data-open', 'true');
  await expect(close).toBeFocused();
  await close.press('Shift+Tab');
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Tab'); await expect(close).toBeFocused();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
});

for (const width of [320, 390, 640]) test(`learning update stays clear of listening answers at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 812 });
  const { id } = await openSnapshot(page, 'a2-listening');
  await page.evaluate(() => {
    navigator.serviceWorker.getRegistration = async () => ({ active: {}, waiting: {} }) as ServiceWorkerRegistration;
    history.pushState(null, '', '/settings'); dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.locator('.settings-update .update-action').click();
  await expect(page.locator('.settings-update .update-action')).toHaveAttribute('data-update-ready', 'true');
  await page.goBack(); await expect(page).toHaveURL(new RegExp(`/learn/${id}$`));
  const notice = page.locator('.update-notice'), question = page.locator('.workspace-question').first();
  await expect(notice).toBeVisible(); await expect(question).toBeVisible();
  await expect(notice).toHaveCSS('position', 'static');
  expect((await notice.boundingBox())!.y + (await notice.boundingBox())!.height).toBeLessThanOrEqual((await question.boundingBox())!.y);
  const input = question.getByRole('textbox').first();
  await input.fill('kept');
  await page.setViewportSize({ width, height: 400 });
  await input.scrollIntoViewIfNeeded(); await expect(input).toBeFocused(); await expect(input).toHaveValue('kept');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `output/playwright/listening-update-${width}.png` });
  await page.setViewportSize({ width, height: 812 });
  await notice.locator('.update-later').click(); await expect(notice).toHaveCount(0);
  await expect(input).toHaveValue('kept');
});
