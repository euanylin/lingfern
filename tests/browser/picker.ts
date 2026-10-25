import { expect, type Locator, type Page } from '@playwright/test';

export async function expectPickerAlignment(trigger: Locator) {
  const bounds = await trigger.evaluate(trigger => {
    const root = trigger.closest('.setting')!, menu = root.querySelector<HTMLElement>('.setting-menu')!, anchor = trigger.getBoundingClientRect(), box = menu.getBoundingClientRect();
    const clip = menu.closest('.question-sheet-content,.task-detail-body')?.getBoundingClientRect();
    const visual = window.visualViewport, left = Math.max(visual?.offsetLeft ?? 0, clip?.left ?? 0), top = Math.max(visual?.offsetTop ?? 0, clip?.top ?? 0);
    const right = Math.min((visual?.offsetLeft ?? 0) + (visual?.width ?? innerWidth), clip?.right ?? Infinity), bottom = Math.min((visual?.offsetTop ?? 0) + (visual?.height ?? innerHeight), clip?.bottom ?? Infinity);
    const rtl = getComputedStyle(trigger).direction === 'rtl', field = root.classList.contains('setting-field');
    const aligned = field ? rtl ? anchor.right - box.width : anchor.left : rtl ? anchor.left : anchor.right - box.width;
    return { anchor: anchor.toJSON(), menu: box.toJSON(), left, right, top, bottom, transform: getComputedStyle(trigger).transform, expectedLeft: Math.max(left + 8, Math.min(aligned, right - box.width - 8)) };
  });
  expect(Math.abs(bounds.menu.left - bounds.expectedLeft)).toBeLessThan(1);
  expect(bounds.transform).toBe('none');
  expect(bounds.menu.left).toBeGreaterThanOrEqual(bounds.left + 7.5);
  expect(bounds.menu.right).toBeLessThanOrEqual(bounds.right - 7.5);
  expect(bounds.menu.top).toBeGreaterThanOrEqual(bounds.top + 7.5);
  expect(bounds.menu.bottom).toBeLessThanOrEqual(bounds.bottom - 7.5);
  if (bounds.anchor.bottom + 4 + bounds.menu.height <= bounds.bottom - 8) expect(Math.abs(bounds.menu.top - bounds.anchor.bottom - 4)).toBeLessThan(1);
  else if (bounds.anchor.top - bounds.menu.height - 4 >= bounds.top + 8) expect(Math.abs(bounds.anchor.top - bounds.menu.bottom - 4)).toBeLessThan(1);
  return bounds;
}

export async function selectPicker(page: Page, label: string, value: string) {
  const trigger = page.getByRole('button', { name: label }).and(page.locator('.setting-trigger'));
  const menuId = await trigger.getAttribute('aria-controls');
  const index = await trigger.evaluate(element => [...document.querySelectorAll('.setting-trigger')].indexOf(element));
  await trigger.click();
  const menu = page.locator(`[id="${menuId}"]`);
  await expect(menu).toHaveClass('setting-menu');
  await expect(menu).toHaveCSS('backdrop-filter', /blur\(24px\) saturate\(1\.4\)/);
  expect(await menu.evaluate(el => getComputedStyle(el).backgroundColor)).toMatch(/(?:, |\/ )0\.55\)$/);
  await page.locator(`[id="${menuId}"]`).locator(`[role="option"][data-value="${value}"]`).click();
  await expect(page.locator('.setting-trigger').nth(index)).toHaveAttribute('data-value', value);
}
