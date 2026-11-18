import { expect, test } from '@playwright/test';
import { languagePacks } from '../../src/locales';
import { selectPicker } from './picker';

test('long syntax-tree resource titles stay fully visible beside installation status', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/library');
  await expect(page.locator('.offline-install')).toHaveAttribute('aria-busy', 'false');
  await page.evaluate(async () => {
    const { offlineGroups, offlineCacheName, offlineMarker } = await import('/src/data/offline.ts' as string) as typeof import('../../src/data/offline');
    for (const id of ['tree-parser', 'tree-stanza']) {
      const group = offlineGroups.find(item => item.id === id)!;
      const cache = await caches.open(offlineCacheName(group));
      for (const path of [offlineMarker(group), ...group.files.map(file => file.path)]) await cache.put(path, new Response('layout fixture'));
    }
    navigator.serviceWorker.getRegistration = async () => ({ active: {} }) as ServiceWorkerRegistration;
    window.dispatchEvent(new Event('lingfern-resources-installed'));
  });

  const group = page.getByRole('group', { name: '句法树', exact: true });
  const toggle = group.getByRole('button');
  await expect(toggle).toContainText('已装 2');
  await toggle.click();
  const titles = group.locator('.package-title');
  await expect(titles).toHaveCount(4);
  await expect(group.locator('.package-status')).toHaveText(['已安装', '已安装']);
  const layout = () => titles.evaluateAll(nodes => nodes.map(node => {
    const title = node.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(node);
    const lines = [...range.getClientRects()];
    return {
      wrapped: new Set(lines.map(line => line.top)).size > 1,
      fits: lines.every(line => line.left >= title.left - 1 && line.right <= title.right + 1),
    };
  }));
  const narrow = await layout();
  expect(narrow.every(title => title.fits)).toBe(true);
  expect(narrow.some(title => title.wrapped)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await group.screenshot({ path: info.outputPath('wrapped-tree-resources.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
  expect((await layout()).every(title => title.fits && !title.wrapped)).toBe(true);
});

for (const locale of ['zh-Hans', 'zh-Hant', 'en', 'ar'] as const) test(`general reading and listening packages share category controls (${locale})`, async ({ page, context }) => {
  const pack = languagePacks[locale], t = pack.offlineInstall, ui = pack.offlineInstall_libraryLabels;
  await page.goto('/settings');
  await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
  await page.goto('/library');
  for (const [width, theme] of [[1440, 'light'], [320, 'dark']] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    for (const [skill, names] of [['reading', ['corpus', 'corpus-open-reading']], ['listening', ['audio-beginner', 'audio-a1', 'audio-a2', 'audio-b1', 'audio-b2', 'audio-c1', 'audio-c2']]] as const) {
      const category = page.locator('.offline-category').filter({ has: page.getByRole('heading', { name: t.categories[skill], exact: true }) });
      const group = category.getByRole('group', { name: ui.general, exact: true });
      const toggle = group.getByRole('button');
      await expect(group.locator('.package-title')).toHaveText(names.map(id => t.names[id]));
      await expect(group.locator('.package-row')).toHaveCount(names.length);
      const check = page.getByRole('checkbox', { name: `${t.categories[skill]} · ${ui.general}`, exact: true });
      await check.check();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(group.locator('.package-row input:checked')).toHaveCount(names.length);
      await group.locator('.package-row input').first().uncheck();
      await expect(check).toHaveAttribute('aria-checked', 'mixed');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(group.locator('.package-row input:checked')).toHaveCount(names.length - 1);
      await toggle.focus(); await page.keyboard.press('Enter');
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await check.check();
      await check.uncheck();
      expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    const rows = await page.locator('.package-row input').evaluateAll(inputs => inputs.map(input => input.getAttribute('aria-label')));
    expect(new Set(rows).size).toBe(rows.length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `output/playwright/library-groups-${locale}-${width}-${theme}.png`, fullPage: true });
  }
  const search = page.getByRole('textbox', { name: ui.search });
  await search.fill(t.names['audio-a1']);
  await expect(page.locator('.package-row')).toHaveCount(1);
  await page.getByRole('checkbox', { name: `${t.categories.listening} · ${ui.general}`, exact: true }).check();
  await search.fill('no-library-resource-47201');
  await expect(page.locator('.offline-package-heading')).toContainText(t.selectedCount.replace('{count}', '1'));
  await expect(page.locator('.offline-select-all')).toHaveCount(0);
  await search.fill('');
  await expect(page.locator('.offline-select-all')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: t.names['audio-a1'], exact: true })).toBeChecked();
  await context.setOffline(true);
  await expect(page.getByRole('button', { name: t.start, exact: true })).toBeDisabled();
});
