import { expect, type Page } from '@playwright/test';

export async function confirmTask(page: Page) {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('button[data-mode=practice]').click();
  await expect(dialog).toHaveCount(0);
}
