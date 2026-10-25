import { expect, test } from '@playwright/test';
import { languagePacks } from '../../src/locales';
import { selectPicker } from './picker';

for (const [locale, width, colorScheme] of [['zh-Hans', 390, 'dark'], ['en', 1440, 'light'], ['ar', 375, 'dark']] as const) {
  test(`network status stays outside content and clears after each change: ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ colorScheme, reducedMotion: locale === 'ar' ? 'reduce' : 'no-preference' });
    await page.goto('/settings');
    await expect(page.locator('.settings-language .setting-trigger')).toBeVisible();
    if (locale !== 'zh-Hans') await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
    const status = page.locator('.network-status');
    await expect(status).toBeEmpty();
    await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }));
    await page.reload();
    await expect(status).toHaveText(languagePacks[locale].app.offline);
    await expect(page.locator('main > .notice:not(.update-notice)')).toHaveCount(0);
    const headingTop = (await page.locator('main h1').boundingBox())!.y;
    expect(await status.evaluate(element => getComputedStyle(element).position)).toBe('fixed');
    expect((await status.locator('.network-status-content').boundingBox())!.width).toBeLessThan(width - 32);
    if (locale === 'ar') await expect(status.locator('.network-status-content')).toHaveCSS('animation-name', 'none');
    const bar = (await status.boundingBox())!;
    if (width < 768) expect(bar.y + bar.height).toBeLessThanOrEqual((await page.locator('.mobile-nav').boundingBox())!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.waitForTimeout(220);
    await page.screenshot({ path: `output/playwright/network-status-${locale}-offline.png` });
    const network = async (online: boolean) => page.evaluate(value => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value });
      window.dispatchEvent(new Event(value ? 'online' : 'offline'));
    }, online);
    await network(true);
    await expect(status).toHaveText(languagePacks[locale].app.online);
    expect((await page.locator('main h1').boundingBox())!.y).toBe(headingTop);
    await page.waitForTimeout(220);
    await page.screenshot({ path: `output/playwright/network-status-${locale}-online.png` });
    await network(false);
    await expect(status).toHaveText(languagePacks[locale].app.offline);
    await page.waitForTimeout(3100);
    await expect(status).toHaveText(languagePacks[locale].app.offline);
    await expect(status).toBeEmpty({ timeout: 2000 });
    await page.getByRole('link', { name: languagePacks[locale].app.library, exact: true }).filter({ visible: true }).click();
    await expect(page.locator('main h1')).toHaveText(languagePacks[locale].app.library);
    await expect(status).toBeEmpty();
    await network(true);
    await expect(status).toHaveText(languagePacks[locale].app.online);
    await expect(status).toBeEmpty({ timeout: 5000 });
    expect(await page.pageErrors()).toEqual([]);
  });

  test(`refresh keeps the record-reading status accessible without visible text: ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ colorScheme, reducedMotion: locale === 'ar' ? 'reduce' : 'no-preference' });
    await page.goto('/settings');
    await expect(page.locator('.settings-language .setting-trigger')).toBeVisible();
    if (locale !== 'zh-Hans') await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
    await page.addInitScript(labels => {
      const statuses: { text: string; clipped: boolean }[] = [];
      Object.assign(window, { startupStatuses: statuses });
      const inspect = (node: Node) => {
        if (!(node instanceof Element)) return;
        const elements = [...node.querySelectorAll('[role=status]')];
        if (node.matches('[role=status]')) elements.push(node);
        for (const element of elements) if (labels.includes(element.textContent ?? '')) {
          const style = getComputedStyle(element);
          statuses.push({ text: element.textContent!, clipped: style.position === 'absolute' && style.clip === 'rect(0px, 0px, 0px, 0px)' });
        }
      };
      new MutationObserver(records => { for (const record of records) for (const node of record.addedNodes) inspect(node); }).observe(document, { childList: true, subtree: true });
    }, Object.values(languagePacks).map(pack => pack.app.loading));
    for (const path of ['/today', '/library', '/settings']) {
      await page.goto(path);
      for (let reload = 0; reload < 2; reload++) {
        if (reload) await page.reload();
        const route = path.slice(1) as 'today' | 'library' | 'settings';
        await expect(page.getByRole('heading', { name: languagePacks[locale].app[route], exact: true })).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        const statuses = await page.evaluate(() => (window as unknown as { startupStatuses: { text: string; clipped: boolean }[] }).startupStatuses);
        expect(statuses.length).toBeGreaterThan(0);
        expect(statuses.every(status => status.clipped)).toBe(true);
        await expect(page.locator('main > p.sr-only[role=status]')).toHaveCount(0);
        expect(await page.pageErrors()).toEqual([]);
      }
    }
    await page.screenshot({ path: `output/playwright/startup-status-${locale}-settings.png`, fullPage: true, animations: 'disabled' });
  });
}

test('a real record-read failure stays visible and retry retains the existing profile', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.locator('main h1')).toBeVisible();
  const before = await page.evaluate(async () => {
    const path = '/src/data/db.ts';
    return (await import(path)).profiles.toArray();
  });
  await page.addInitScript(() => {
    const get = IDBObjectStore.prototype.get;
    Object.assign(window, { failProfileRead: true });
    IDBObjectStore.prototype.get = function(...args) {
      if (this.name === 'profiles' && (window as unknown as { failProfileRead: boolean }).failProfileRead) throw new DOMException('Synthetic read failure', 'InvalidStateError');
      return get.apply(this, args);
    };
  });
  await page.reload();
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(languagePacks['zh-Hans'].app.readError);
  await expect(alert.getByRole('button', { name: '重试', exact: true })).toBeEnabled();
  await page.evaluate(() => { Object.assign(window, { failProfileRead: false }); });
  await alert.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.locator('main h1')).toBeVisible();
  await expect(alert).toHaveCount(0);
  expect(await page.evaluate(async () => {
    const path = '/src/data/db.ts';
    return (await import(path)).profiles.toArray();
  })).toEqual(before);
  expect(await page.pageErrors()).toEqual([]);
});
