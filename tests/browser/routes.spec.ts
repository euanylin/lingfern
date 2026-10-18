import { expect, test } from '@playwright/test';

test('page links use clean URLs and support direct entry, refresh, back', async ({ page }) => {
  await page.goto('/today');
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('heading', { name: '今日' })).toBeVisible();
  await page.evaluate(() => { (window as Window & { routeMarker?: boolean }).routeMarker = true; });
  await page.getByRole('link', { name: '资料库', exact: true }).first().click();
  await expect(page).toHaveURL(/\/library$/);
  expect(await page.evaluate(() => (window as Window & { routeMarker?: boolean }).routeMarker)).toBe(true);
  await page.goBack();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.locator('a[href="/tests"], .today-tests, .test-centre')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '综合训练', exact: true })).toBeVisible();
  await page.goto('/library/ipa');
  await expect(page.getByRole('heading', { name: 'IPA 发音表' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'IPA 发音表' })).toBeVisible();
});
