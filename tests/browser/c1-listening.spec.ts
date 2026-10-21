import { expect, test } from '@playwright/test';
import { openSnapshot, focusQuestion, fillQuestion, submitWorkspace, playMaterial, verifyWorkspace } from './workspace';

test('C1 discussions keep indirect requests and self-corrections in their audio context', async ({ page, context }) => {
  test.setTimeout(90_000);
  const external: string[] = [];
  await context.route('**/*', route => {
    const url = route.request().url();
    if (!url.startsWith('http://127.0.0.1:5173/')) { external.push(url); return route.abort(); }
    return route.continue();
  });
  const { lesson } = await openSnapshot(page, 'c1-listening');
  await expect(page.locator('.passage')).toHaveCount(0);
  let index = 0;
  for (const material of lesson.materials) {
    for (const question of material.questions) await fillQuestion(await focusQuestion(page, lesson, index++), question);
    const player = page.locator('audio');
    await expect.poll(() => player.evaluate((audio: HTMLAudioElement) => audio.readyState > 0)).toBe(true);
    expect(await player.evaluate((audio: HTMLAudioElement) => audio.duration)).toBeGreaterThan(material.audio!.duration - 1);
    await page.locator('.audio-play').click(); await expect(page.locator('.audio-play')).toHaveAttribute('aria-label', '暂停');
    await page.locator('.audio-play').click(); await expect.poll(() => player.evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);
    await playMaterial(page);
    await expect(page.getByRole('status').filter({ hasText: '录音已播放，可以选择并保存。' })).toHaveCount(1);
  }
  await submitWorkspace(page); const records = await verifyWorkspace(page, lesson);
  expect(records.attempts.every((record: { assistance: { audioCompleted: boolean } }) => record.assistance.audioCompleted)).toBe(true);
  await page.reload(); await expect(page.locator('.workspace-review')).toHaveCount(lesson.materials.flatMap(material => material.questions).length);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('c1-listening.png') });
  expect(external).toEqual([]);
});
