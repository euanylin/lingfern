import { expect, test, type Page } from '@playwright/test';

async function delayedPreparation(page: Page) {
  await page.route(/\/src\/app\/prepareCorpusPractice\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
import combinedReadingFixture from '/tests/fixtures/content/a1-reading.json';
import combinedListeningFixture from '/tests/fixtures/content/a1-listening.json';
prepareCorpusPractice = async function(input) {
  if (input.skill === 'reading') {
    await new Promise(resolve => window.releaseCombined = resolve);
  }
  const lesson = input.skill === 'reading' ? combinedReadingFixture : combinedListeningFixture;
  return { lesson, downloadFailed: false };
};` });
  });
  await page.goto('/today');
  await expect(page.getByRole('heading', { name: '练习', exact: true })).toBeVisible();
  await page.locator('.combined-training .practice-card-action').click();
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { releaseCombined?: unknown }).releaseCombined)).toBe('function');
}

for (const change of ['route', 'profile', 'selection'] as const) test(`combined preparation cannot reopen after changing ${change}`, async ({ page }) => {
  await delayedPreparation(page);
  if (change === 'route') {
    await page.locator('.desktop-nav a[href="/library"]').click();
    await expect(page.locator('.library-page-heading')).toBeVisible();
  } else if (change === 'profile') {
    await page.evaluate(async () => {
      const { db, profiles, settings } = await import('/src/data/db.ts' as string);
      await db.transaction('rw', profiles, settings, async () => {
        await profiles.put({ id: 'other-synthetic', name: 'Other synthetic profile', createdAt: new Date().toISOString() });
        await settings.put({ key: 'activeProfile', value: 'other-synthetic' });
      });
    });
    await expect(page.locator('.combined-training .practice-card-action')).toBeEnabled();
  } else {
    await page.locator('.reading-task [data-practice-skill=reading]').click();
    const options = page.locator('.practice-options-dialog');
    await options.locator('.practice-option-fields .setting-trigger').first().click();
    await options.locator('[role=option][data-value=daily-life]').click();
    await options.locator('.practice-option-fields .setting-trigger').first().click();
    await options.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(options).toHaveCount(0);
  }
  await page.evaluate(async () => {
    const pending = window as unknown as { releaseCombined?: () => void };
    pending.releaseCombined!(); delete pending.releaseCombined;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  if (change === 'route') await page.locator('.desktop-nav a[href="/today"]').click();
  await expect(page.locator('.combined-training .practice-card-action')).toBeEnabled();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(async () => (await import('/src/data/db.ts' as string)).sessions.count())).toBe(0);
  await page.locator('.combined-training .practice-card-action').click();
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { releaseCombined?: unknown }).releaseCombined)).toBe('function');
  await page.evaluate(() => (window as unknown as { releaseCombined: () => void }).releaseCombined());
  await expect(page.getByRole('dialog')).toContainText('综合训练');
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.combined-training .practice-card-action')).toBeFocused();
});
