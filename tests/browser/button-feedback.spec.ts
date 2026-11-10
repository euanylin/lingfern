import { expect, test, type Locator } from '@playwright/test';

for (const width of [390, 1440]) for (const scheme of ['light', 'dark'] as const) for (const touch of [false, true]) {
  test(`filled actions share feedback: ${width}/${scheme}/${touch ? 'touch' : 'mouse'}`, async ({ browser }, info) => {
    const context = await browser.newContext({ baseURL: info.project.use.baseURL, hasTouch: touch, viewport: { width, height: 900 }, colorScheme: scheme, locale: 'zh-CN' });
    const page = await context.newPage();
    await page.goto('/settings');
    await expect(page.locator('.backup-download')).toBeEnabled();
    await page.evaluate(() => document.addEventListener('click', event => {
      if (document.documentElement.hasAttribute('data-test-feedback')) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true));
    const cdp = touch ? await context.newCDPSession(page) : undefined;
    const probe = async (control: Locator, scale: number) => {
      await expect(control).toHaveCSS('text-decoration-line', 'none');
      await expect(control).toHaveCSS('outline-style', 'none');
      await expect(control).toHaveCSS('box-shadow', 'none');
      await expect.poll(() => control.evaluate(el => {
        const style = getComputedStyle(el), sample = document.createElement('span');
        sample.style.background = style.getPropertyValue('--button-feedback'); sample.style.color = style.getPropertyValue('--button-feedback-ink');
        document.body.appendChild(sample); const expected = getComputedStyle(sample);
        const result = { background: style.backgroundColor === expected.backgroundColor, ink: style.color === expected.color, scale: new DOMMatrixReadOnly(style.transform).a };
        sample.remove(); return result;
      })).toEqual({ background: true, ink: true, scale });
    };
    const sample = async (control: Locator, eventTarget = control, focusTarget = control) => {
      await control.scrollIntoViewIfNeeded(); await page.mouse.move(0, 0);
      await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur(); document.documentElement.dataset.testFeedback = ''; });
      const idle = await control.evaluate(el => getComputedStyle(el).backgroundColor);
      if (!touch) {
        await eventTarget.hover(); await probe(control, 1.025);
        await page.mouse.down(); await probe(control, .98); await page.mouse.up();
        await probe(control, 1.025); await page.mouse.move(0, 0);
      } else {
        const box = (await eventTarget.boundingBox())!;
        for (const end of ['touchEnd', 'touchCancel'] as const) {
          await cdp!.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
          await expect(eventTarget).toHaveAttribute('data-touch-active', ''); await probe(control, .98);
          await cdp!.send('Input.dispatchTouchEvent', { type: end, touchPoints: [] });
          await expect(eventTarget).not.toHaveAttribute('data-touch-active');
          await expect(control).toHaveCSS('background-color', idle);
          await expect(control).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
        }
      }
      await focusTarget.press('Tab'); await page.keyboard.press('Shift+Tab');
      await expect(focusTarget).toBeFocused(); await probe(control, 1.025);
      await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur(); delete document.documentElement.dataset.testFeedback; });
    };
    try {
      await sample(page.locator('.backup-download'));
      const file = page.locator('.profile-backup .backup-file-label');
      await sample(file.locator('.backup-file-button'), file, file.locator('input'));
      await sample(page.locator('.profile-backup .offline-remove'));
      await page.locator('.backup-download').click();
      const exportDialog = page.locator('.backup-export-dialog'); await expect(exportDialog).toBeVisible();
      await sample(exportDialog.locator('.offline-remove-dialog-actions .button'));
      await sample(exportDialog.locator('.primary'));
      await page.screenshot({ path: info.outputPath('export-feedback.png') });
      await page.keyboard.press('Escape');
      await page.locator('.profile-backup .offline-remove').click();
      const deletion = page.locator('.profile-delete-dialog'); await expect(deletion).toBeVisible();
      await sample(deletion.locator('.offline-remove-dialog-actions .button').first());
      await sample(deletion.locator('.offline-remove-confirm'));
      await page.keyboard.press('Escape');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const control = page.locator('.backup-download'); await control.press('Tab'); await page.keyboard.press('Shift+Tab');
      await expect(control).toHaveCSS('transform', 'none'); await expect(control).toHaveCSS('transition-duration', '0s');
    } finally { await cdp?.detach(); await context.close(); }
  });
}

test('touch release ignores stale mouse hover and moving a mouse restores hover feedback', async ({ page }) => {
  await page.goto('/settings');
  const control = page.locator('.backup-download'); await expect(control).toBeEnabled();
  const idle = await control.evaluate(el => getComputedStyle(el).backgroundColor);
  await control.hover(); await expect(control).not.toHaveCSS('background-color', idle);
  await control.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 71, isPrimary: true, clientX: 10, clientY: 10 });
  await control.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 71, isPrimary: true });
  await expect(control).not.toHaveAttribute('data-touch-active'); await expect(control).toHaveCSS('background-color', idle);
  await page.mouse.move(1, 1); await control.hover();
  await expect(page.locator('html')).not.toHaveAttribute('data-touch-input'); await expect(control).not.toHaveCSS('background-color', idle);
});

test('closing a dialog while its picker is present does not crash menu positioning', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/today');
  await page.locator('.practice-card-topics .setting-trigger').first().click();
  const dialog = page.locator('.practice-options-dialog'); await expect(dialog).toBeVisible();
  await dialog.locator('.setting-trigger').first().click(); await expect(dialog.getByRole('listbox')).toBeVisible();
  await dialog.evaluate(element => {
    const dialog = element as HTMLDialogElement;
    dialog.close(); window.dispatchEvent(new Event('resize'));
  });
  await expect(dialog).toBeHidden();
  expect(errors).toEqual([]);
  await page.locator('.practice-card-topics .setting-trigger').first().click();
  await dialog.locator('.setting-trigger').first().click(); await expect(dialog.getByRole('listbox')).toBeVisible();
});
