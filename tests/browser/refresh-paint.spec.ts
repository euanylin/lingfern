import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';

for (const width of [390, 1440]) test(`refresh paints saved navigation and complete fern together: ${width}`, async ({ browser }, info) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:8787', viewport: { width, height: 900 }, colorScheme: 'light', locale: 'zh-CN', serviceWorkers: 'block' });
  const page = await context.newPage();
  try {
    await page.goto('/settings');
    for (const [selector, value] of [['.settings-language .setting-trigger', 'en'], ['.settings-appearance .setting-trigger', 'dark']]) {
      const control = page.locator(selector).first(); await selectPicker(page, (await control.getAttribute('aria-label'))!, value);
    }
    await selectPicker(page, 'Desktop navigation', 'both'); await selectPicker(page, 'Mobile navigation', 'icon');
    await page.locator(`.${width < 768 ? 'mobile-nav' : 'desktop-nav'} a[href="/today"]`).click();
    await expect(page.locator('.today-hero .fern')).toHaveAttribute('aria-busy', 'false');
    await page.addInitScript(() => {
      const state = { frames: [] as { visible: boolean; display: string | undefined; labels: string[]; theme: string | undefined }[], fern: undefined as { visibility: string; busy: string | null } | undefined, running: true };
      Object.assign(window, { refreshPaint: state });
      const sample = () => {
        if (!state.running) return;
        const logo = [...document.querySelectorAll('.home-mark,.mobile-brand')].find(el => el.getClientRects().length);
        const nav = document.querySelector<HTMLElement>(innerWidth < 768 ? '.mobile-nav' : '.desktop-nav');
        if (logo) state.frames.push({ visible: !!nav?.getClientRects().length && getComputedStyle(nav).visibility === 'visible', display: nav?.dataset.display, labels: [...nav?.querySelectorAll('a') ?? []].map(el => el.getAttribute('aria-label')!), theme: document.documentElement.dataset.theme });
        const fern = document.querySelector('.today-hero .fern');
        if (fern) state.fern ??= { visibility: getComputedStyle(fern).visibility, busy: fern.getAttribute('aria-busy') };
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await page.reload(); await expect(page.locator('.today-hero .fern')).toHaveAttribute('aria-busy', 'false');
    await expect.poll(() => page.evaluate(() => (window as unknown as { refreshPaint: { frames: unknown[] } }).refreshPaint.frames.length)).toBeGreaterThan(0);
    const state = await page.evaluate(() => {
      const state = (window as unknown as { refreshPaint: { frames: { visible: boolean; display: string; labels: string[]; theme: string }[]; fern: { visibility: string; busy: string }; running: boolean } }).refreshPaint;
      state.running = false; return state;
    });
    await info.attach('refresh-paint', { body: JSON.stringify(state), contentType: 'application/json' });
    expect(state.frames.every(frame => frame.visible && frame.display === (width < 768 ? 'icon' : 'both') && frame.theme === 'dark' && JSON.stringify(frame.labels) === JSON.stringify(['Today', 'Library', 'Settings']))).toBe(true);
    expect(state.fern).toEqual({ visibility: 'visible', busy: 'false' });
    await page.screenshot({ path: info.outputPath('refreshed-today.png') });
  } finally { await context.close(); }
});
