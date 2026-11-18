import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('selecting the current tree presentation preserves manual edits', async ({ page }) => {
  await page.goto('/library/trees');
  await expect(page.locator('#tree-source')).toBeEnabled();
  await page.locator('#tree-source').fill('(OriginalRoot (N token))');
  await page.locator('#tree-source').press('Enter');
  await page.locator('#tree-label').fill('EditedRoot');
  await page.getByRole('button', { name: '类型: 成分树', exact: true }).click();
  await page.getByRole('option', { name: '成分树', exact: true }).click();
  await expect(page.getByRole('treeitem', { name: 'EditedRoot', exact: true })).toBeVisible();
});

test('IME confirmation leaves the source in editing mode', async ({ page }) => {
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await source.fill('[unfinished');
  const handled = await source.evaluate(field => !field.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter', isComposing: true, bubbles: true, cancelable: true,
  })));
  expect(handled).toBe(false);
});

test('a failed form switch does not change the next draw', async ({ page }) => {
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await source.fill('[unfinished');
  const form = page.locator('.tree-form .setting-trigger');
  await form.click();
  await page.locator('[role=option][data-value=dependency]').click();
  await expect(page.locator('.tree-page [role=alert]')).toBeVisible();
  await source.fill('She left.');
  await source.press('Enter');
  await expect(page.getByRole('treeitem', { name: 'left', exact: true })).toBeVisible();
  await expect(form).toHaveAttribute('data-value', 'constituency');
});

test('dependency relation labels align between the editor and SVG export', async ({ page }) => {
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await source.fill('1 She 2 nsubj\n2 left 0 root');
  await source.press('Enter');
  const label = page.locator('.tree-edge-label', { hasText: 'nsubj' });
  await expect(label).toBeVisible();
  const y = Number(await label.getAttribute('y'));
  await page.getByRole('button', { name: '导出', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
  const svg = await readFile((await (await download).path())!, 'utf8');
  expect(Number(/<text [^>]* y="([^"]+)"[^>]*>nsubj<\/text>/u.exec(svg)?.[1])).toBeCloseTo(y, 2);
});

test('rejects a PNG encoder fallback when WebP was requested', async ({ page }) => {
  await page.addInitScript(() => {
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      toBlob.call(this, callback, type === 'image/webp' ? 'image/png' : type, quality);
    };
  });
  await page.goto('/library/trees');
  const exportDialog = page.getByRole('dialog');
  await page.getByRole('button', { name: '导出', exact: true }).click();
  await exportDialog.getByRole('button', { name: '格式: .svg' }).click();
  await exportDialog.getByRole('option', { name: 'WebP', exact: true }).click();
  await exportDialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(exportDialog.getByRole('alert')).toContainText('导出失败');
});

test('a picker closes and stops accepting choices when disabled', async ({ page }) => {
  await page.goto('/settings');
  await page.evaluate(async () => {
    const container = document.createElement('div'); container.id = 'review'; document.body.appendChild(container);
    const path = '/tests/browser/reviewControls.tsx';
    Reflect.set(window, 'updateReviewPicker', (await import(path)).mountPicker(container));
  });
  const control = page.locator('#review');
  await control.getByRole('button', { name: 'Audit palette: Default', exact: true }).focus();
  await control.getByRole('button', { name: 'Audit palette: Default', exact: true }).press('Enter');
  await expect(control.getByRole('option', { name: 'Fern' })).toBeVisible();
  await page.evaluate(() => Reflect.get(window, 'updateReviewPicker')(true));
  await expect(control.getByRole('button', { name: 'Audit palette: Default', exact: true })).toBeDisabled();
  await expect(control.getByRole('listbox')).toBeHidden();
  await expect(control).not.toHaveAttribute('data-choice');
});

test('a locale change does not reload a saved tree over manual edits', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: '主题配色: 默认', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const dbPath = '/src/data/db.ts', historyPath = '/src/data/lookupHistory.ts', treePath = '/src/shared/tree.ts', controlsPath = '/tests/browser/reviewControls.tsx';
    const { profiles } = await import(dbPath); const profile = await profiles.toCollection().first();
    const { recordTree } = await import(historyPath); const { drawTree } = await import(treePath);
    await recordTree(profile.id, 'Audit saved', drawTree('(SavedRoot (N token))'));
    const container = document.createElement('div'); container.id = 'review'; document.body.appendChild(container);
    Reflect.set(window, 'updateReviewTree', (await import(controlsPath)).mountTree(container, profile.id));
  });
  const control = page.locator('#review');
  await expect(control.getByRole('treeitem', { name: 'SavedRoot', exact: true })).toBeVisible();
  await control.locator('#tree-label').fill('EditedRoot');
  await page.evaluate(() => Reflect.get(window, 'updateReviewTree')('en'));
  await expect(control.getByRole('heading', { name: 'Syntax tree', exact: true })).toBeVisible();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(control.getByRole('treeitem', { name: 'EditedRoot', exact: true })).toBeVisible();
});

test('tree connectors and SVG exports use visible control boundaries', async ({ page }) => {
  await page.goto('/library/trees');
  await expect(page.locator('#tree-source')).toBeEnabled();
  const color = await page.evaluate(() => {
    const probe = document.createElement('span'); probe.style.color = 'var(--control)'; document.body.appendChild(probe);
    const color = getComputedStyle(probe).color; probe.remove(); return color;
  });
  await expect(page.locator('.tree-board line').first()).toHaveCSS('stroke', color);
  await page.getByRole('button', { name: '导出', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
  const file = await downloaded;
  expect(await readFile((await file.path())!, 'utf8')).toContain(`stroke="${color}"`);
});

test('Tab leaves the palette list instead of visiting every option', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: '主题配色: 默认', exact: true }).press('Enter');
  await expect(page.getByRole('option', { selected: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('listbox', { name: '主题配色', exact: true })).toBeHidden();
});

test('a changing palette list retains usable keyboard focus', async ({ page }) => {
  await page.goto('/settings');
  await page.evaluate(async () => {
    const container = document.createElement('div'); container.id = 'review'; document.body.appendChild(container);
    const path = '/tests/browser/reviewControls.tsx';
    Reflect.set(window, 'updateReviewPicker', (await import(path)).mountPicker(container));
  });
  const control = page.locator('#review');
  await control.getByRole('button', { name: 'Audit palette: Default', exact: true }).press('End');
  await expect(control.getByRole('option', { name: 'Fern' })).toBeFocused();
  await page.evaluate(() => Reflect.get(window, 'updateReviewPicker')(false, 1));
  await expect(control.getByRole('option', { name: 'Default' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(control).toHaveAttribute('data-choice', 'basic');
  await expect(control.getByRole('listbox')).toBeHidden();
});
