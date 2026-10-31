import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';

test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });
test('short and long pages retain the same document width with native scrollbars', async ({ page }) => {
  await page.setViewportSize({ width: 460, height: 772 });
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/src/app/OfflineInstall.tsx*', async route => { await pending; await route.continue(); });
  await page.goto('/library');
  await expect(page.locator('main > p[role=status]')).toHaveClass('sr-only');
  const box = () => page.locator('body').evaluate(element => ({ x: element.getBoundingClientRect().x, width: element.getBoundingClientRect().width }));
  const before = await box();
  release();
  await expect(page.locator('.offline-search input')).toBeEnabled();
  expect(await box()).toEqual(before);
  expect(before.width).toBe(await page.evaluate(() => document.documentElement.clientWidth));
  await expect(page.locator('html')).toHaveCSS('scrollbar-width', 'auto');
});

for (const locale of ['zh-Hans', 'zh-Hant', 'en']) for (const width of [1440, 600, 375]) {
  test(`Library stays still during resource checks: ${locale}, ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.emulateMedia({ reducedMotion: width === 375 ? 'reduce' : 'no-preference' });
    await page.goto('/settings');
    await selectPicker(page, (await page.locator('.setting-trigger').first().getAttribute('aria-label'))!, locale);
    await selectPicker(page, (await page.locator('.setting-trigger').nth(1).getAttribute('aria-label'))!, width === 1440 ? 'light' : 'dark');
    await page.evaluate("import('/src/data/runtimeResources.ts').then(module => module.loadRuntimeResources())");
    const geometry = () => page.locator('.library-page-heading, .library-references, .offline-install, .community-import').evaluateAll(elements => elements.map(element => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    }));
    for (let visit = 0; visit < 3; visit++) {
      let finishCheck!: () => void;
      const pending = new Promise<void>(resolve => { finishCheck = resolve; });
      await page.route('**/resources/catalogue.json', async route => { await pending; if (visit === 2) await route.abort('failed'); else await route.continue(); });
      await page.locator('nav a[href="/library"]:visible').first().click();
      await expect(page.locator('.offline-install')).toHaveAttribute('aria-busy', 'false');
      const before = await geometry();
      const disabled = await page.locator('.offline-install').evaluate(element => element.querySelector('fieldset')?.disabled);
      finishCheck();
      await expect(page.locator('.offline-search input')).toBeEnabled();
      expect(await geometry()).toEqual(before);
      expect(disabled).toBe(false);
      await expect(page.locator('.offline-install')).toHaveAttribute('aria-busy', 'false');
      await page.unroute('**/resources/catalogue.json');
      await page.locator('nav a[href="/today"]:visible').first().click();
      await expect(page.locator('.practice-card').first()).toBeVisible();
    }
  });
}

test('offline search preserves selected resources when results change', async ({ page }) => {
  await page.goto('/library');
  const row = page.locator('.package-row').filter({ hasText: '英英词典' });
  const search = page.getByRole('searchbox', { name: '搜索内容' });
  await expect(search).toBeVisible();
  await row.locator('input').check();
  await search.fill('no-matching-resource-19482');
  await expect(row).toHaveCount(0);
  await expect(page.locator('.offline-package-heading')).toContainText('已选 1 项');
  await expect(page.getByRole('button', { name: '下载所选资源' })).toBeEnabled();
  await page.getByRole('button', { name: '清除搜索', exact: true }).click();
  await expect(row).toBeVisible();
  await expect(row.locator('input')).toBeChecked();
  await expect(page.locator('.offline-package-toggle')).toHaveCount(0);
});

test('topic collapse retains selection and the group control geometry', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/library');
  const group = page.locator('.offline-source-group').first();
  const toggle = group.locator('.offline-source-group-toggle');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const answer = group.locator('.package-row input').first();
  await answer.check();
  await toggle.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await expect(toggle).toHaveCSS('transform', 'none');
  const before = await toggle.boundingBox();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(answer).toBeHidden();
  await expect(answer).toBeChecked();
  await expect(page.locator('.offline-package-heading')).toContainText('已选 1 项');
  await page.mouse.move(0, 0);
  await expect(toggle).toHaveCSS('transform', 'none');
  const after = await toggle.boundingBox();
  for (const key of ['x', 'width', 'height'] as const) expect(Math.abs(after![key] - before![key])).toBeLessThan(.5);
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(answer).toBeVisible();
  await expect(answer).toBeChecked();
});

test('checking updates keeps the action and status layout stable', async ({ page, context }) => {
  test.setTimeout(90_000);
  // Delay the provider fixture to inspect pending UI; test SW updates separately.
  await page.addInitScript(() => {
    navigator.serviceWorker.getRegistration = async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
      return undefined;
    };
  });
  await page.goto('/settings');
  const section = page.locator('.settings-update');
  const action = section.locator('.update-action');
  const expectFittedStatus = async () => {
    const space = await section.getByRole('status').evaluate(element => {
      const text = document.createRange();
      text.selectNodeContents(element);
      return { box: element.getBoundingClientRect().height, text: text.getBoundingClientRect().height, line: parseFloat(getComputedStyle(element).lineHeight) };
    });
    expect(space.box - space.text).toBeLessThan(space.line / 2);
  };
  for (const locale of ['zh-Hans', 'zh-Hant', 'en']) for (const theme of ['light', 'dark']) {
    await selectPicker(page, (await page.locator('.setting-trigger').first().getAttribute('aria-label'))!, locale);
    await selectPicker(page, (await page.locator('.setting-trigger').nth(1).getAttribute('aria-label'))!, theme);
    for (const width of [1440, 375, 320]) {
      await page.setViewportSize({ width, height: 812 });
      await page.emulateMedia({ reducedMotion: width === 320 ? 'reduce' : 'no-preference' });
      await page.goto('/settings');
      await expect(page.locator('.setting-trigger').first()).toHaveAttribute('data-value', locale);
      await expect(page.locator('.setting-trigger').nth(1)).toHaveAttribute('data-value', theme);
      await action.evaluate(element => element.scrollIntoView({ block: 'center' }));
      const initial = await section.boundingBox();
      await expect(section.getByRole('status')).toHaveText('v0.1');
      await expect(section.getByRole('link')).toHaveAttribute('href', '/settings/about');
      expect(await section.getByRole('button').count()).toBe(1);
      const aboutBox = await section.getByRole('link').boundingBox();
      expect(aboutBox!.height).toBeGreaterThanOrEqual(44);
      expect(initial!.height).toBeGreaterThanOrEqual(88);
      const actionBox = await action.boundingBox();
      const label = await action.locator(':scope > span').first().textContent();
      await action.click();
      await expect(action).toHaveAttribute('aria-busy', 'true');
      await expect(action).toBeDisabled();
      await expect(action.locator(':scope > span').first()).toHaveText(label!);
      const measured = await action.boundingBox();
      expect(measured!.x).toBe(actionBox!.x);
      expect(measured!.width).toBe(actionBox!.width);
      expect(measured!.height).toBeGreaterThanOrEqual(44);
      const pendingHeight = (await section.boundingBox())!.height;
      expect(pendingHeight).toBeGreaterThanOrEqual(initial!.height);
      await expectFittedStatus();
      await expect(action).toBeEnabled();
      await expect(section.getByRole('status')).not.toBeEmpty();
      await expectFittedStatus();
      const settled = await action.boundingBox();
      expect(settled!.x).toBe(actionBox!.x);
      expect(settled!.width).toBe(actionBox!.width);
      expect(settled!.height).toBeGreaterThanOrEqual(44);
      await context.setOffline(true);
      await expect(page.locator('.network-status')).toHaveAttribute('data-state', 'offline');
      await expect(page.locator('main > .notice:not(.update-notice)')).toHaveCount(0);
      await action.evaluate(element => element.scrollIntoView({ block: 'center' }));
      const offlineBox = await action.boundingBox();
      await action.click();
      await expectFittedStatus();
      const offline = await action.boundingBox();
      expect(offline!.x).toBe(offlineBox!.x);
      expect(offline!.width).toBe(offlineBox!.width);
      expect(offline!.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await context.setOffline(false);
      await expect(page.locator('.network-status')).toHaveAttribute('data-state', 'online');
      await expect(page.locator('main > .notice:not(.update-notice)')).toHaveCount(0);
    }
  }
});

test('desktop navigation and reference pages use the main content width without losing reading order', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/library');
  await expect(page.getByRole('heading', { name: '资料库' })).toBeVisible();
  await expect(page.locator('.offline-base-packages .package-row').first()).toBeVisible();
  const library = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
    return { headerLeft: rect('.home-mark').left, mainLeft: rect('main').left, links: [...document.querySelectorAll('.library-references a')].map(link => link.getBoundingClientRect()), installTop: rect('.offline-install').top, packages: [...document.querySelectorAll('.offline-base-packages .package-row')].slice(0, 3).map(row => row.getBoundingClientRect()) };
  });
  expect(library.headerLeft).toBeCloseTo(library.mainLeft, 0);
  expect(library.links[0].bottom).toBeLessThanOrEqual(library.links[1].top);
  expect(library.links.every(link => link.height >= 44)).toBe(true);
  expect(library.links[2].bottom).toBeLessThan(library.installTop);
  expect(new Set(library.packages.map(row => Math.round(row.left))).size).toBe(1);

  await page.goto('/library/ipa');
  await expect(page.locator('.ipa-entry').first()).toBeVisible();
  await expect(page.getByRole('button', { name: '简易版', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '详细版', exact: true }).click();
  await expect(page.locator('.ipa-table')).toHaveCount(4);
  await page.getByRole('button', { name: '简易版', exact: true }).click();
  const ipa = await page.locator('.ipa-grid').first().locator('.ipa-entry').evaluateAll(rows => rows.slice(0, 4).map(row => row.getBoundingClientRect()));
  expect(ipa[0].top).toBeCloseTo(ipa[2].top, 0);
  expect(ipa[3].top).toBeGreaterThan(ipa[2].top);

  await page.goto('/library/grammar');
  await expect(page.locator('.grammar-results details').first()).toBeVisible();
  const entries = page.locator('.grammar-results details');
  const closed = await entries.evaluateAll(rows => rows.slice(0, 2).map(row => row.getBoundingClientRect()));
  expect(closed[0].top).toBeCloseTo(closed[1].top, 0);
  await entries.first().locator('summary').click();
  expect((await entries.first().boundingBox())!.width).toBeGreaterThan(900);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('desktop settings and progress balance columns; narrow layouts stay stacked', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: '设置', exact: true })).toBeVisible();
  const settings = await page.evaluate(() => [document.querySelector('.settings-preferences')!, document.querySelector('.settings-data')!].map(element => element.getBoundingClientRect()));
  expect(settings[0].bottom).toBeLessThanOrEqual(settings[1].top);
  expect(settings[0].left).toBeCloseTo(settings[1].left, 0);
  await page.goto('/progress');
  await expect(page.getByRole('heading', { name: '记录' })).toBeVisible();
  await expect(page.locator('.progress-fern')).toHaveCount(0);
  const progress = await page.evaluate(() => ({ main: document.querySelector('main')!.getBoundingClientRect(), facts: [...document.querySelectorAll('.totals > div')].map(element => element.getBoundingClientRect()) }));
  expect(progress.facts[0].left).toBeGreaterThanOrEqual(progress.main.left);
  expect(progress.facts[1].right).toBeLessThanOrEqual(progress.main.right);
  expect(progress.facts[0].right).toBeLessThanOrEqual(progress.facts[1].left);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/settings');
  await expect(page.locator('.settings-data')).toBeVisible();
  const narrowSettings = await page.evaluate(() => [document.querySelector('.settings-preferences')!, document.querySelector('.settings-data')!].map(element => element.getBoundingClientRect()));
  expect(narrowSettings[1].top).toBeGreaterThan(narrowSettings[0].top);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 320, height: 640 });
  expect(await page.evaluate(() => [...document.querySelectorAll('.setting')].every(row => row.getBoundingClientRect().height >= 44 && row.scrollWidth <= row.clientWidth))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
