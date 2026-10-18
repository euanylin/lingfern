import { confirmTask } from './task-start';
import { showLearningPane } from './learning-pane';
import { selectPicker } from './picker';
import { expect, test } from '@playwright/test';

test('four real recordings play from this site, save evidence and resume', async ({ page, context }) => {
  const external: string[] = [];
  await context.route('**/*', route => {
    const url = route.request().url();
    if (!url.startsWith('http://127.0.0.1:5173/')) { external.push(url); return route.abort(); }
    return route.continue();
  });
  await page.goto('/today'); await page.locator('.primary-task:not(.reading-task):not(.combined-training)').getByRole('button', { name: '开始', exact: true }).click(); await confirmTask(page);
  await expect(page.locator('.passage')).toHaveCount(0);
  for (const word of ['book', 'pen', 'bag', 'cup']) {
    await showLearningPane(page, 'question');
    await page.getByRole('radio', { name: word, exact: true }).check();
    await expect(page.getByRole('button', { name: '保存答案', exact: true })).toBeDisabled();
    await expect(page.locator('blockquote')).toHaveCount(0);
    // The test runner has no reliable audio output; decoding and natural ended events still run.
    await page.locator('audio').evaluate((el: HTMLAudioElement) => { el.muted = true; });
    await showLearningPane(page, 'material');
    await page.getByRole('button', { name: '播放 / 重听', exact: true }).click();
    await expect(page.getByText('录音已播放，可以选择并保存。', { exact: true })).toBeVisible();
    expect(await page.locator('audio').evaluate((el: HTMLAudioElement) => el.ended && el.duration > 0)).toBe(true);
    await showLearningPane(page, 'question');
    await page.getByRole('button', { name: '保存答案', exact: true }).click();
    await expect(page.locator('blockquote')).toHaveText(word);
    await expect(page.getByRole('heading', { name: '✓ 回答正确' })).toBeVisible();
    if (word === 'book') {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.screenshot({ path: 'output/playwright/listening-375x812-light-zh-Hans-one-answer.png', fullPage: true });
      const url = page.url();
      await page.getByRole('link', { name: '离开任务' }).click();
      await expect(page).toHaveURL(/\/today$/);
      await page.goto(url);
      await expect(page.locator('blockquote')).toHaveText(word);
      await showLearningPane(page, 'question');
      await expect(page.getByText('播放请求次数: 1', { exact: true })).toBeVisible();
    }
    if (word !== 'cup') await page.getByRole('button', { name: '下一题' }).click();
  }
  await expect(page.getByRole('heading', { name: '听力任务已保存' })).toBeVisible();
  await page.getByRole('link', { name: '返回今日' }).click();
  await page.getByRole('link', { name: '今日', exact: true }).click(); await page.getByRole('link', { name: '历史记录', exact: true }).click();
  await expect(page.locator('.totals dd')).toHaveText(['4', '4']);
  expect(external).toEqual([]);
});

test('failed audio never permits scoring and recovers on an explicit replay', async ({ page }) => {
  const exposureCount = () => page.evaluate(() => new Promise<number>((resolve, reject) => {
    const open = indexedDB.open('lingfern');
    open.onsuccess = () => {
      const count = open.result.transaction('exposures').objectStore('exposures').count();
      count.onsuccess = () => resolve(count.result);
      count.onerror = () => reject(count.error);
    };
    open.onerror = () => reject(open.error);
  }));
  await page.goto('/today'); await page.locator('.primary-task:not(.reading-task):not(.combined-training)').getByRole('button', { name: '开始', exact: true }).click(); await confirmTask(page);
  // The preview must read real media before Practice starts; fail the player's own request afterwards.
  await page.route('**/audio/**/*.mp3', route => route.abort());
  await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.load());
  expect(await exposureCount()).toBe(0);
  await page.getByRole('radio', { name: 'book', exact: true }).check();
  await page.getByRole('button', { name: '播放 / 重听', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('音频播放失败');
  await expect(page.getByRole('button', { name: '保存答案', exact: true })).toBeDisabled();
  expect(await exposureCount()).toBe(0);
  await page.unroute('**/audio/**/*.mp3');
  await page.locator('audio').evaluate((el: HTMLAudioElement) => { el.muted = true; });
  await page.getByRole('button', { name: '播放 / 重听', exact: true }).click();
  await expect(page.getByText('录音已播放，可以选择并保存。', { exact: true })).toBeVisible();
  expect(await exposureCount()).toBe(1);
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await expect(page.getByText('播放请求次数: 2', { exact: true })).toBeVisible();
});


test('listening answers share the player page and playback waits, cancels and stops on leaving', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/today');
  await page.locator('.primary-task:not(.reading-task):not(.combined-training)').getByRole('button', { name: '开始', exact: true }).click(); await confirmTask(page);
  await expect(page.locator('.listening-layout')).toBeVisible();
  await expect(page.locator('.question-sheet-toggle')).toBeHidden();
  await expect(page.locator('.question-sheet-scrim')).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'book', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'book', exact: true }).check();
  const play = page.getByRole('button', { name: '播放 / 重听', exact: true });
  await play.click();
  await expect(page.getByRole('button', { name: '取消播放', exact: true })).toBeEnabled();
  await expect(page.getByRole('status')).toContainText('即将播放');
  expect(await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.paused && audio.currentTime === 0)).toBe(true);
  await page.getByRole('button', { name: '取消播放', exact: true }).click();
  await expect(play).toBeVisible();
  await page.waitForTimeout(1600);
  expect(await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.paused && audio.currentTime === 0)).toBe(true);
  expect(await page.evaluate(async () => (await import('/src/data/db.ts' as string)).exposures.count())).toBe(0);
  await page.locator('audio').evaluate((audio: HTMLAudioElement) => {
    audio.muted = true;
    const clicked = performance.now();
    audio.addEventListener('play', () => audio.dataset.delay = String(performance.now() - clicked), { once: true });
  });
  await play.click();
  await expect.poll(() => page.locator('audio').getAttribute('data-delay')).not.toBeNull();
  expect(Number(await page.locator('audio').getAttribute('data-delay'))).toBeGreaterThanOrEqual(1400);
  await expect(page.getByRole('button', { name: '保存答案', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await expect(page.getByRole('heading', { name: '✓ 回答正确' })).toBeVisible();
  await play.click();
  await page.getByRole('link', { name: '离开任务', exact: true }).click();
  await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  await page.waitForTimeout(1600);
  expect(await page.evaluate(async () => (await import('/src/data/db.ts' as string)).sessions.toArray().then((rows: Array<{ assistance: { playbackRequests: number } }>) => rows[0].assistance.playbackRequests))).toBe(1);
});


test('listening layout uses shared controls in three locales, both themes and narrow screens', async ({ page }) => {
  await page.goto('/today');
  await page.locator('.primary-task:not(.reading-task):not(.combined-training)').getByRole('button', { name: '开始', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.task-detail-credits')).toContainText('来源与许可');
  await confirmTask(page);
  await expect(page.locator('.listening-layout')).toBeVisible();
  const url = page.url();
  for (const [locale, language, theme] of [['en', '语言', 'Appearance'], ['zh-Hant', 'Language', '外觀'], ['zh-Hans', '語言', '外观']] as const) {
    await page.goto('/settings');
    await selectPicker(page, language, locale);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    for (const appearance of ['light', 'dark']) {
      await selectPicker(page, theme, appearance);
      await page.goto(url);
      for (const width of [1440, 1200, 768, 375, 320]) {
        await page.setViewportSize({ width, height: 812 });
        await expect(page.locator('.listening-layout')).toBeVisible();
        await expect(page.locator('.question-sheet-toggle')).toBeHidden();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const panel = await page.locator('.question-panel').boundingBox();
        const player = await page.locator('.audio-player').boundingBox();
        expect(panel && player && player.y + player.height <= panel.y).toBe(true);
        await expect(page.locator('.question-panel')).toHaveCSS('position', 'static');
        for (const control of await page.locator('.audio-play,.audio-timeline input,.question-panel .option,.submit').all()) {
          const box = await control.boundingBox(); expect(box && box.height >= 44).toBe(true);
        }
      }
      await page.screenshot({ path: `output/playwright/listening-layout-320-${appearance}-${locale}.png`, animations: 'disabled', fullPage: true });
      await page.goto('/settings');
    }
  }
});
