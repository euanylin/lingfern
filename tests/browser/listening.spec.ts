import { openSnapshot, focusQuestion, fillQuestion, playMaterial, submitWorkspace, verifyWorkspace } from './workspace';
import { confirmTask } from './task-start';
import { selectPicker } from './picker';
import { expect, test } from '@playwright/test';

test('four real recordings play from this site, save evidence and resume', async ({ page, context }) => {
  const external: string[] = [];
  await context.route('**/*', route => {
    const url = route.request().url();
    if (!url.startsWith('http://127.0.0.1:5173/')) { external.push(url); return route.abort(); }
    return route.continue();
  });
  const { lesson, id } = await openSnapshot(page, 'a1-listening');
  await expect(page.locator('.passage')).toHaveCount(0);
  for (const [index, material] of lesson.materials.entries()) {
    await fillQuestion(await focusQuestion(page, lesson, index), material.questions[0]);
    await expect(page.locator('.workspace-review')).toHaveCount(0);
    await playMaterial(page);
    if (!index) {
      await expect.poll(() => page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).sessions.get(id)).assistance.audioCompleted, id)).toBe(true);
      await page.reload(); await expect(page.getByRole('radio', { name: 'book', exact: true })).toBeChecked();
    }
  }
  await submitWorkspace(page); await verifyWorkspace(page, lesson);
  await page.goto('/progress'); await expect(page.locator('.totals dd')).toHaveText(['4', '4']);
  expect(external).toEqual([]);
});

test('failed audio never permits scoring and recovers on an explicit replay', async ({ page }) => {
  const { lesson, id } = await openSnapshot(page, 'a1-listening', true);
  await page.route('**/audio/**/*.mp3', route => route.abort());
  await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.load());
  await fillQuestion(await focusQuestion(page, lesson, 0), lesson.materials[0].questions[0]);
  await page.locator('.audio-play').click();
  await expect(page.getByRole('alert')).toContainText('音频播放失败');
  await expect.poll(() => page.evaluate(async () => (await import('/src/data/db.ts' as string)).attempts.count())).toBe(0);
  await focusQuestion(page, lesson, lesson.materials.length - 1);
  await page.locator('button[type=submit]').click();
  await expect(page.getByRole('alert').filter({ hasText: '请先完整播放录音，再保存答案。' })).toBeVisible();
  expect(await page.evaluate(async () => (await import('/src/data/db.ts' as string)).attempts.count())).toBe(0);
  await page.unroute('**/audio/**/*.mp3'); await focusQuestion(page, lesson, 0); await playMaterial(page);
  for (let index = 1; index < lesson.materials.length; index++) { await fillQuestion(await focusQuestion(page, lesson, index), lesson.materials[index].questions[0]); await playMaterial(page); }
  await submitWorkspace(page);
  const records = await page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).attempts.where('sessionId').equals(id).toArray()), id);
  expect(records).toHaveLength(4); expect(records[0].assistance.audioCompleted).toBe(true); expect(records[0].assistance.playbackRequests).toBe(2);
});

test('listening answers share the player page and playback waits, cancels and stops on leaving', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openSnapshot(page, 'a1-listening', true);
  await expect(page.locator('.listening-layout')).toBeVisible();
  await expect(page.locator('.question-sheet-toggle')).toBeHidden();
  await expect(page.locator('.question-sheet-scrim')).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'book', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'book', exact: true }).check();
  const play = page.getByRole('button', { name: '播放 / 重听', exact: true });
  await play.click();
  await expect(page.getByRole('button', { name: '取消播放', exact: true })).toBeEnabled();
  await expect(page.getByRole('status').filter({ hasText: '即将播放' })).toBeVisible();
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
  await expect(page.locator('button[type=submit]')).toHaveCount(0);
  await expect(page.locator('.workspace-questions form>button[type=button]')).toBeEnabled();
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
        expect(panel && player && player.y >= panel.y && player.y + player.height <= panel.y + panel.height).toBe(true);
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
