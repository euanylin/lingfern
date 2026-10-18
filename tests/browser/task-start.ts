import { expect, type Page } from '@playwright/test';

export async function confirmTask(page: Page) {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const practice = dialog.locator('button[data-mode=practice]');
  await (await practice.count() ? practice : dialog.locator('button.primary')).click();
  await expect(dialog).toHaveCount(0);
}
