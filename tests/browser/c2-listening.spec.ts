import { confirmTask } from './task-start';
import { expect, test } from '@playwright/test';

test('C2 discussion audio stays local, pauses, shares a full play within its material and resets for a new one', async ({ page, context }) => {
  const external: string[] = [];
  await context.route('**/*', route => {
    const url = route.request().url();
    if (!url.startsWith('http://127.0.0.1:5173/')) { external.push(url); return route.abort(); }
    return route.continue();
  });
  await page.goto('/today');
  const task = page.locator('.task-row').filter({ has: page.getByRole('heading', { name: '听出限定与责任' }) });
  await task.getByRole('button', { name: '开始听力' }).click();
  await confirmTask(page);
  await expect(page.locator('.passage')).toHaveCount(0);
  await expect(page.getByText('合成语音', { exact: false })).toBeVisible();
  await page.locator('input[type=radio]').nth(0).check();
  await expect(page.getByRole('button', { name: '保存答案' })).toBeDisabled();
  await page.getByRole('button', { name: '播放 / 重听' }).click();
  await page.getByRole('button', { name: '暂停' }).click();
  await expect(page.getByRole('button', { name: '播放 / 重听' })).toBeVisible();
  await page.getByRole('button', { name: '播放 / 重听' }).click();
  await expect(page.getByRole('button', { name: '暂停', exact: true })).toBeVisible();
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => Number.isFinite(audio.duration) && audio.duration > 90)).toBe(true);
  await page.locator('audio').evaluate((audio: HTMLAudioElement) => { audio.muted = true; audio.playbackRate = 16; audio.currentTime = 0; });
  await expect(page.getByText('录音已播放，可以选择并保存。', { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: '保存答案' }).click();
  await expect(page.locator('.feedback blockquote')).toHaveCount(2);
  await expect(page.locator('.evidence-source')).toContainText(['Priya', 'Omar']);
  await page.screenshot({ path: 'output/playwright/c2-listening-1440x900-light-zh-Hans-one-answer.png', fullPage: true });
  await page.getByRole('button', { name: '下一题' }).click();
  await expect(page.getByRole('heading', { name: 'What is Omar implying by “A faster map is not more timely”?' })).toBeVisible();
  await page.locator('input[type=radio]').nth(0).check();
  await page.getByRole('button', { name: '保存答案' }).click();
  await expect(page.getByText('播放请求次数: 0', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '下一题' }).click();
  await expect(page.getByRole('heading', { name: 'Which summary accurately preserves June and Rowan’s difference?' })).toBeVisible();
  await page.locator('input[type=radio]').nth(0).check();
  await expect(page.getByRole('button', { name: '保存答案' })).toBeDisabled();
  await page.getByRole('button', { name: '播放 / 重听' }).click();
  await expect(page.getByRole('button', { name: '暂停', exact: true })).toBeVisible();
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => Number.isFinite(audio.duration) && audio.duration > 90)).toBe(true);
  await page.locator('audio').evaluate((audio: HTMLAudioElement) => { audio.muted = true; audio.playbackRate = 16; audio.currentTime = 0; });
  await expect(page.getByText('录音已播放，可以选择并保存。', { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: '保存答案' }).click();
  await expect(page.locator('.feedback blockquote')).toHaveCount(2);
  expect(external).toEqual([]);
});
