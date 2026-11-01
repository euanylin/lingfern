import { expect, test, webkit } from '@playwright/test';
import { openSnapshot, focusQuestion, fillQuestion } from './workspace';

for (const engine of ['chromium', 'webkit'] as const) test(`confirmation motion retains safe focus and cancels stale exits in ${engine}`, async ({ browser }) => {
  const alternate = engine === 'webkit' ? await webkit.launch({ channel: '' }) : undefined;
  const context = await (alternate ?? browser).newContext({ viewport: { width: alternate ? 320 : 1440, height: 900 }, hasTouch: !!alternate, colorScheme: alternate ? 'dark' : 'light', locale: 'zh-CN' });
  const page = await context.newPage(), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('http://127.0.0.1:5173/settings');
    const trigger = page.locator('.backup-download'), dialog = page.locator('.backup-export-dialog');
    let downloads = 0; page.on('download', () => downloads++);
    await trigger.click();
    await expect(dialog).toHaveCSS('animation-name', 'modal-in');
    await expect(dialog.getByRole('button', { name: '取消', exact: true })).toBeFocused();
    await expect(dialog).toHaveCSS('opacity', '1');
    const closing = await dialog.evaluate(async element => {
      (element.querySelector('.offline-remove-dialog-actions button') as HTMLButtonElement).click();
      // A second activation must not export while cancellation is animating.
      (element.querySelector('button[type=submit]') as HTMLButtonElement).click();
      const frames: { opacity: number; modal: boolean }[] = [];
      while (element.isConnected && (element as HTMLDialogElement).open) {
        frames.push({ opacity: Number(getComputedStyle(element).opacity), modal: element.matches(':modal') });
        await new Promise(requestAnimationFrame);
      }
      return frames;
    });
    expect(closing.some(frame => frame.opacity > 0 && frame.opacity < 1)).toBe(true);
    expect(closing.every(frame => frame.modal)).toBe(true);
    await expect(trigger).toBeFocused(); expect(downloads).toBe(0);
    await trigger.click(); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    const interruption = await page.evaluate(async () => {
      const { showModal, closeModal } = await import('/src/app/modal.ts' as string);
      const dialog = document.createElement('dialog'); dialog.className = 'practice-restart-dialog';
      document.body.appendChild(dialog); let completed = 0;
      showModal(dialog); closeModal(dialog, () => completed++); showModal(dialog);
      await new Promise(resolve => setTimeout(resolve, 280));
      const reopened = dialog.open && !dialog.hasAttribute('data-closing') && completed === 0;
      closeModal(dialog, () => completed++); dialog.close();
      await new Promise(resolve => setTimeout(resolve, 280)); dialog.remove();
      return { reopened, completed };
    });
    expect(interruption).toEqual({ reopened: true, completed: 0 });
    await trigger.click();
    await dialog.getByRole('button', { name: '取消', exact: true }).evaluate(element => (element as HTMLButtonElement).click());
    await page.emulateMedia({ reducedMotion: 'reduce' }); await expect(dialog).toHaveCount(0);
    await trigger.click(); await expect(dialog).toHaveCSS('animation-name', 'none');
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await context.close(); await alternate?.close(); }
});

test('navigation, starting choices, suggestions, results and saved icons have bounded motion', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.locator('.settings-page')).toHaveCSS('animation-name', 'none');
  await page.locator('.desktop-nav').getByRole('link', { name: '资料库', exact: true }).click();
  await expect(page.locator('.library-page')).toHaveCSS('animation-name', 'surface-in');
  await page.locator('a[href="/library/dictionary"]').click();
  const query = page.getByRole('combobox');
  await query.fill('book'); await expect(page.locator('.dictionary-suggestions')).toBeVisible();
  await expect(page.locator('.dictionary-suggestions')).toHaveCSS('animation-name', 'surface-in');
  await query.press('Enter');
  await expect(page.locator('.dictionary-results')).toHaveCSS('animation-name', 'content-in');
  const star = page.locator('.sense-star').first(); await star.click();
  await expect(star).toHaveAttribute('aria-pressed', 'true');
  await expect(star.locator('span')).toHaveCSS('animation-name', 'bookmark-in');
  await page.goto('/start'); await page.getByRole('button', { name: '保存并继续', exact: true }).click();
  await expect(page.locator('.first-run-choices')).toHaveCSS('animation-name', 'content-in');
  await page.getByRole('radio', { name: '旅行', exact: true }).check();
  await page.getByRole('button', { name: '保存并继续', exact: true }).click();
  await page.getByRole('button', { name: '上一步', exact: true }).click();
  await expect(page.getByRole('radio', { name: '旅行', exact: true })).toBeChecked();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.first-run-choices')).toHaveCSS('animation-name', 'none');
});

test('sequence moves animate the existing rows and hints appear after saving assistance', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { lesson } = await openSnapshot(page, 'a2-reading');
  const questions = lesson.materials.flatMap(material => material.questions);
  const index = questions.findIndex(question => 'steps' in question);
  const section = await focusQuestion(page, lesson, index);
  await fillQuestion(section, questions[index]);
  const rows = section.locator('.sequence-order>li'), before = await rows.locator(':scope>span').allTextContents();
  const frames = await rows.first().evaluate(async row => {
    (row.querySelectorAll('button')[1] as HTMLButtonElement).click();
    const positions: number[] = [], until = performance.now() + 300;
    while (performance.now() < until) { await new Promise(requestAnimationFrame); positions.push(row.getBoundingClientRect().top); }
    return { distinct: new Set(positions.map(value => Math.round(value))).size, connected: row.isConnected };
  });
  expect(frames.connected).toBe(true); expect(frames.distinct).toBeGreaterThan(2);
  expect(await rows.locator(':scope>span').allTextContents()).toEqual([before[1], before[0], ...before.slice(2)]);
  const hintSection = await focusQuestion(page, lesson, questions.findIndex(question => !!question.hints));
  await hintSection.locator('button.hint').click();
  await expect(hintSection.locator('.hint-text')).toHaveCSS('animation-name', 'content-in');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(hintSection.locator('.hint-text')).toHaveCSS('animation-name', 'none');
  await focusQuestion(page, lesson, index); await rows.first().getByRole('button').nth(1).click();
  expect(await rows.evaluateAll(elements => elements.flatMap(element => element.getAnimations()).length)).toBe(0);
});
