import { expect, test, type Locator } from '@playwright/test';
import { seedLegacyAnswers } from './workspace';

async function sampleMotion(row: Locator) {
  return row.evaluate(async element => {
    const panel = element.querySelector<HTMLElement>('.history-records-panel')!, icon = element.querySelector('svg')!;
    const samples: { height: number; horizontal: number; vertical: number }[] = [], until = performance.now() + 340;
    while (performance.now() < until) {
      await new Promise(requestAnimationFrame);
      const transform = new DOMMatrixReadOnly(getComputedStyle(icon).transform);
      samples.push({ height: panel.getBoundingClientRect().height, horizontal: transform.a, vertical: transform.d });
    }
    return samples;
  });
}

test('history disclosure matches Library flips, reverses safely and respects reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedLegacyAnswers(page, 4); await page.goto('/library');
  const libraryToggle = page.locator('.offline-source-group-toggle:not([aria-controls$=":general"])').first();
  const libraryIcon = libraryToggle.locator('.offline-group-chevron');
  await expect(libraryToggle).toHaveAttribute('aria-expanded', 'false');
  const libraryMotion = await libraryIcon.evaluate(element => ({ duration: getComputedStyle(element).transitionDuration, easing: getComputedStyle(element).transitionTimingFunction }));
  await libraryToggle.click();
  await expect.poll(() => libraryIcon.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).d)).toBeCloseTo(-1, 2);
  await page.goto('/progress');
  const row = page.locator('.history').first(), toggle = row.locator('.history-records-toggle'), panel = row.locator('.history-records-panel');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle.locator('svg')).toHaveCSS('transition-duration', libraryMotion.duration);
  await expect(toggle.locator('svg')).toHaveCSS('transition-timing-function', libraryMotion.easing);
  const buttonBox = (await toggle.boundingBox())!, iconBox = (await toggle.locator('svg').boundingBox())!;
  expect(buttonBox.width).toBeGreaterThanOrEqual(44); expect(buttonBox.height).toBeGreaterThanOrEqual(44);
  expect(iconBox.x + iconBox.width / 2).toBeCloseTo(buttonBox.x + buttonBox.width / 2, 1);
  expect(iconBox.y + iconBox.height / 2).toBeCloseTo(buttonBox.y + buttonBox.height / 2, 1);
  await toggle.focus(); await toggle.press('Enter');
  const opening = await sampleMotion(row), fullHeight = (await panel.boundingBox())!.height;
  expect(opening.some(frame => frame.height > 1 && frame.height < fullHeight - 1)).toBe(true);
  expect(opening.every(frame => Math.abs(frame.horizontal - 1) < .001)).toBe(true);
  expect(opening.some(frame => Math.abs(frame.vertical) < .99)).toBe(true);
  expect(opening.at(-1)!.vertical).toBeCloseTo(-1, 2);
  await expect(row.locator('.history-entry-records>section')).toHaveCount(4);
  await page.screenshot({ path: 'output/playwright/history-motion-expanded.png', fullPage: true });
  await toggle.press('Space');
  await expect(panel).toHaveAttribute('inert', ''); await expect(panel).toHaveAttribute('aria-hidden', 'true');
  const closing = await sampleMotion(row);
  expect(closing.some(frame => frame.height > 1 && frame.height < fullHeight - 1)).toBe(true);
  expect(closing.every(frame => Math.abs(frame.horizontal - 1) < .001)).toBe(true);
  expect(closing.some(frame => Math.abs(frame.vertical) < .99)).toBe(true);
  expect(closing.at(-1)!.vertical).toBeCloseTo(1, 2);
  expect(closing.at(-1)!.height).toBe(0);
  await expect(row.locator('.history-entry-records')).toHaveCount(0);
  await toggle.evaluate(async element => {
    const button = element as HTMLButtonElement;
    for (let index = 0; index < 5; index++) {
      button.click();
      await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
    }
  });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(async () => (await panel.boundingBox())!.height).toBeCloseTo(fullHeight, 0);
  await expect(row.locator('.history-entry-records>section')).toHaveCount(4);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await toggle.click(); await expect(row.locator('.history-entry-records')).toHaveCount(0);
  await toggle.click(); await expect(row.locator('.history-entry-records>section')).toHaveCount(4);
  expect(await panel.evaluate(element => element.getAnimations().length)).toBe(0);
  expect(await toggle.locator('svg').evaluate(element => element.getAnimations().length)).toBe(0);
  expect((await panel.boundingBox())!.height).toBeCloseTo(fullHeight, 0);
  expect(await page.evaluate(async () => (await import('/src/data/db.ts' as string)).attempts.count())).toBe(4);
});
