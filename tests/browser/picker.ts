import { expect, type Page } from '@playwright/test';

export async function selectPicker(page: Page, label: string, value: string) {
  const trigger = page.getByRole('button', { name: label, exact: true });
  const index = await trigger.evaluate(element => [...document.querySelectorAll('.setting-trigger')].indexOf(element));
  await trigger.click();
  const menu = page.getByRole('listbox', { name: label });
  await expect(menu).toHaveClass('setting-menu');
  await expect(menu).toHaveCSS('backdrop-filter', /blur\(24px\) saturate\(1\.4\)/);
  expect(await menu.evaluate(el => getComputedStyle(el).backgroundColor)).toMatch(/(?:, |\/ )0\.55\)$/);
  await page.getByRole('listbox', { name: label }).locator(`[role="option"][data-value="${value}"]`).click();
  await expect(page.locator('.setting-trigger').nth(index)).toHaveAttribute('data-value', value);
}
