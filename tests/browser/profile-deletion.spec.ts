import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';

for (const [locale, remove, cancel] of [['zh-Hans', '删除档案', '取消'], ['en', 'Delete profile', 'Cancel'], ['ar', 'حذف الملف الشخصي', 'إلغاء']]) {
  test(`delete only the confirmed profile, switch other tabs and retain a usable last profile: ${locale}`, async ({ page, context }) => {
    await page.goto('/settings');
    await expect(page.locator('.profile-backup .setting-trigger')).toBeVisible();
    if (locale !== 'zh-Hans') await selectPicker(page, '语言', locale);
    const profileName = locale === 'en' ? 'x'.repeat(80) : 'Same name 2026-10-23';
    await page.evaluate(async ({ locale, profileName }) => {
      const data = await import('/src/data/db.ts' as string);
      await data.profiles.update('local-guest', { name: profileName });
      await data.profiles.add({ id: 'remaining', name: profileName, createdAt: new Date().toISOString() });
      await data.saveSetting('remaining', 'locale', locale);
      const raw = (await import('/tests/fixtures/content/a1-reading.json' as string)).default;
      await data.createSession(raw);
    }, { locale, profileName });
    await page.reload();
    const other = await context.newPage(); await other.goto('/settings');
    await expect(other.locator('.profile-backup .setting-trigger')).toHaveAttribute('data-value', 'local-guest');
    const trigger = page.locator('.profile-backup').getByRole('button', { name: remove, exact: true });
    for (const [width, colorScheme] of [[1440, 'light'], [375, 'dark']] as const) {
      await page.setViewportSize({ width, height: 844 }); await page.emulateMedia({ colorScheme, reducedMotion: width === 375 ? 'reduce' : 'no-preference' });
      await trigger.click();
      const dialog = page.getByRole('alertdialog');
      await expect(dialog).toContainText(profileName);
      await expect(dialog.getByRole('button', { name: cancel, exact: true })).toBeFocused();
      expect(await dialog.getByRole('button').evaluateAll(buttons => buttons.every(button => button.getBoundingClientRect().height >= 44))).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.screenshot({ path: `output/playwright/profile-delete-${locale}-${width}-${colorScheme}.png` });
      await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
    }
    expect(await page.evaluate(async () => (await import('/src/data/db.ts' as string)).sessions.count())).toBe(1);
    await trigger.click(); await page.getByRole('alertdialog').getByRole('button', { name: remove, exact: true }).click();
    await expect(page.locator('.profile-backup .setting-trigger')).toHaveAttribute('data-value', 'remaining');
    await expect(other.locator('.profile-backup .setting-trigger')).toHaveAttribute('data-value', 'remaining');
    expect(await page.evaluate(async () => {
      const data = await import('/src/data/db.ts' as string);
      return { ids: (await data.profiles.toArray()).map((profile: { id: string }) => profile.id), sessions: await data.sessions.count() };
    })).toEqual({ ids: ['remaining'], sessions: 0 });
    await trigger.click(); await page.getByRole('alertdialog').getByRole('button', { name: remove, exact: true }).click();
    await expect(page.locator('.profile-backup .setting-trigger')).not.toHaveAttribute('data-value', 'remaining');
    const next = await page.locator('.profile-backup .setting-trigger').getAttribute('data-value');
    expect(next).toMatch(/^[a-f0-9-]{36}$/);
    await page.reload();
    await expect(page.locator('.profile-backup .setting-trigger')).toHaveAttribute('data-value', next!);
    expect(await page.evaluate(async () => (await import('/src/data/db.ts' as string)).profiles.count())).toBe(1);
    expect(await page.pageErrors()).toEqual([]); expect(await other.pageErrors()).toEqual([]);
  });
}

test('an active sync lock blocks deletion and leaves the confirmation retryable', async ({ page }) => {
  await page.goto('/settings'); await expect(page.locator('.profile-backup .setting-trigger')).toBeVisible();
  await page.evaluate(() => {
    void navigator.locks.request('lingfern-sync:local-guest', () => new Promise<void>(resolve => Object.assign(window, { releaseProfileSync: resolve })));
  });
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { releaseProfileSync?: () => void }).releaseProfileSync)).toBe('function');
  await page.locator('.profile-backup').getByRole('button', { name: '删除档案', exact: true }).click();
  const dialog = page.getByRole('alertdialog');
  await dialog.getByRole('button', { name: '删除档案', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('此档案正在使用中');
  await expect(page.locator('.profile-backup .setting-trigger')).toHaveAttribute('data-value', 'local-guest');
  await page.evaluate(() => (window as unknown as { releaseProfileSync: () => void }).releaseProfileSync());
  await dialog.getByRole('button', { name: '删除档案', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.profile-backup .setting-trigger')).not.toHaveAttribute('data-value', 'local-guest');
});
