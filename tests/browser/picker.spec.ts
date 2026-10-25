import { expect, test } from '@playwright/test';

for (const [width, colorScheme] of [[1440, 'light'], [375, 'dark']] as const) test(`keyboard profile picker ignores an already-settled scroll event: ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 800 });
  await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
  await page.goto('/settings');
  const trigger = page.locator('.profile-backup .setting-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.focus();
  await trigger.press('Enter');
  const menu = page.getByRole('listbox', { name: '当前档案', exact: true });
  await expect(menu).toBeVisible();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  // Focus can finish scrolling before its queued notification is delivered.
  await page.evaluate(() => document.dispatchEvent(new Event('scroll')));
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(menu.getByRole('option', { selected: true })).toBeFocused();
  expect(await menu.getByRole('option', { selected: true }).evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  const before = await page.evaluate(() => scrollY);
  await page.evaluate(() => scrollBy(0, scrollY > 80 ? -80 : 80));
  await expect.poll(() => page.evaluate(() => scrollY)).not.toBe(before);
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
