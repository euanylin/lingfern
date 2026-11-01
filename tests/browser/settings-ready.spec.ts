import { expect, test } from '@playwright/test';
import { languagePacks } from '../../src/locales';
import { selectPicker } from './picker';

test.afterEach(async ({ page }) => { expect(await page.pageErrors()).toEqual([]); });

const account = { account: { id: 1234, login: 'synthetic-learner' }, csrfToken: 'c'.repeat(43), syncAvailable: false };

test('a delayed page load cannot replace a more recently saved appearance choice', async ({ page }) => {
  await page.goto('/today');
  await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const data = await import('/src/data/db.ts' as string);
    const transaction = data.db.transaction.bind(data.db);
    data.db.transaction = (...args: unknown[]) => {
      if (!args.includes(data.profiles) || !args.includes(data.syncEvents) || args.includes(data.syncClocks)) return transaction(...args);
      data.db.transaction = transaction;
      return transaction(...args).then((snapshot: unknown) => new Promise(resolve => {
        Reflect.set(window, 'releasePagePreferences', () => resolve(snapshot));
      }));
    };
  });
  await page.locator('nav a[href="/settings"]:visible').first().click();
  await expect.poll(() => page.evaluate(() => typeof Reflect.get(window, 'releasePagePreferences'))).toBe('function');
  await selectPicker(page, languagePacks['zh-Hans'].app.theme, 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.evaluate(() => Reflect.get(window, 'releasePagePreferences')());
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(async () => (await (await import('/src/data/db.ts' as string)).settings.get('profile:local-guest:theme'))?.value)).toBe('dark');
});

test('an old profile appearance save cannot change the newly selected profile', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(async () => {
    const data = await import('/src/data/db.ts' as string);
    await data.profiles.add({ id: 'synthetic-second-profile', name: 'Second profile', createdAt: new Date().toISOString() });
    await data.saveSetting('synthetic-second-profile', 'theme', 'light');
    const transaction = data.db.transaction.bind(data.db);
    data.db.transaction = (...args: unknown[]) => {
      if (!args.includes(data.profiles) || !args.includes(data.syncClocks)) return transaction(...args);
      data.db.transaction = transaction;
      return transaction(...args).then((result: unknown) => new Promise(resolve => {
        Reflect.set(window, 'releaseOldProfileSetting', () => resolve(result));
      }));
    };
  });
  await page.getByRole('button', { name: languagePacks['zh-Hans'].app.theme }).and(page.locator('.setting-trigger')).click();
  await page.locator('[role="option"][data-value="dark"]').click();
  await expect.poll(() => page.evaluate(() => typeof Reflect.get(window, 'releaseOldProfileSetting'))).toBe('function');
  await selectPicker(page, languagePacks['zh-Hans'].profileBackup.profile, 'synthetic-second-profile');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.evaluate(() => Reflect.get(window, 'releaseOldProfileSetting')());
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(async () => {
    const { settings } = await import('/src/data/db.ts' as string);
    return [(await settings.get('profile:local-guest:theme'))?.value, (await settings.get('profile:synthetic-second-profile:theme'))?.value];
  })).toEqual(['dark', 'light']);
});

test('identity preloads on Today, stays visible during revalidation, and removes stale access after failure', async ({ page }) => {
  let requests = 0, release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/session', async route => {
    if (++requests === 1) return route.fulfill({ json: account });
    await pending; await route.fulfill({ status: 401, json: { error: 'SESSION_EXPIRED' } });
  });
  await page.goto('/today');
  await expect.poll(() => requests).toBe(1);
  await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  await page.locator('nav a[href="/settings"]:visible').first().click();
  await expect.poll(() => requests).toBe(2);
  await expect(page.locator('.github-status-line')).toHaveAttribute('data-status', 'connected');
  await expect(page.locator('.github-identity')).toContainText('synthetic-learner');
  release();
  await expect(page.locator('.github-status-line')).toHaveAttribute('data-status', 'failed');
  await expect(page.locator('.github-session-actions')).toHaveCount(0);
  await expect(page.locator('.github-identity')).not.toContainText('synthetic-learner');
  await page.unroute('**/api/session');
  await page.route('**/api/session', route => route.fulfill({ json: { ...account, account: { id: 5678, login: 'new-synthetic-account' } } }));
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.locator('.github-identity')).toContainText('new-synthetic-account');
  await expect(page.locator('.github-identity')).not.toContainText('synthetic-learner');
});

test('a late background session response cannot restore an account after disconnect', async ({ page }) => {
  let requests = 0, release!: () => void, delivered!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const completed = new Promise<void>(resolve => { delivered = resolve; });
  await page.route('**/api/session', async route => {
    if (++requests === 1) return route.fulfill({ json: account });
    await pending;
    try { await route.fulfill({ json: account }); } finally { delivered(); }
  });
  await page.route('**/api/auth/disconnect', route => route.fulfill({ json: { disconnected: true, providerRevoked: true } }));
  await page.goto('/today'); await expect.poll(() => requests).toBe(1);
  await page.locator('nav a[href="/settings"]:visible').first().click();
  await expect.poll(() => requests).toBe(2);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '断开 GitHub 身份', exact: true }).click();
  await expect(page.locator('.github-status-line')).toHaveAttribute('data-status', 'signed-out');
  release(); await completed;
  await expect(page.locator('.github-status-line')).toHaveAttribute('data-status', 'signed-out');
  await expect(page.locator('.github-identity')).not.toContainText('synthetic-learner');
});

test('cold Library does not enable unchecked content before its first resource response', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/resources/catalogue.json', async route => { await pending; await route.continue(); });
  await page.goto('/library');
  await expect(page.locator('.offline-install')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('.offline-search input')).toBeDisabled();
  release();
  await expect(page.locator('.offline-install')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.offline-search input')).toBeEnabled();
});

for (const [locale, width, colorScheme] of [['zh-Hans', 390, 'dark'], ['en', 1440, 'light'], ['ar', 375, 'dark']] as const) test.describe(`navigation state: ${locale}, ${width}px`, () => {
  test.use({ viewport: { width, height: 844 }, locale: locale === 'zh-Hans' ? 'zh-CN' : locale, colorScheme, reducedMotion: locale === 'ar' ? 'reduce' : 'no-preference' });

test('Today retains its chosen quotation across navigation while refresh and day changes still work', async ({ page }) => {
  await page.clock.setSystemTime(new Date('2026-10-23T12:00:00Z'));
  await page.goto('/today');
  await expect(page.getByRole('heading', { name: languagePacks[locale].app.today, exact: true })).toBeVisible();
  const quote = page.locator('.daily-quote[data-quote-id]');
  await expect(quote).toBeVisible();
  let id = (await quote.getAttribute('data-quote-id'))!;
  for (const path of ['library', 'settings', 'library']) {
    await page.locator(`nav a[href="/${path}"]:visible`).first().click();
    await expect(page.locator('main h1').first()).toBeVisible();
    await page.locator('nav a[href="/today"]:visible').first().click();
    await expect(quote).toHaveAttribute('data-quote-id', id);
  }
  await page.locator('.daily-quote-next').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.daily-quote-next')).toBeFocused();
  await expect(quote).not.toHaveAttribute('data-quote-id', id);
  id = (await quote.getAttribute('data-quote-id'))!;
  await page.locator('nav a[href="/settings"]:visible').first().click();
  await page.locator('nav a[href="/today"]:visible').first().click();
  await expect(quote).toHaveAttribute('data-quote-id', id);
  await page.locator('nav a[href="/library"]:visible').first().click();
  await page.clock.setSystemTime(new Date('2026-10-24T12:00:00Z'));
  await page.locator('nav a[href="/today"]:visible').first().click();
  await expect(quote).not.toHaveAttribute('data-quote-id', id);
  await expect(page.locator('.today-hero time')).toHaveAttribute('datetime', '2026-10-24');
  await expect(quote.locator('blockquote')).toHaveCSS('direction', 'ltr');
  await page.screenshot({ path: `output/playwright/video-bug-${locale}-today.png`, fullPage: true, animations: 'disabled' });
});

});
