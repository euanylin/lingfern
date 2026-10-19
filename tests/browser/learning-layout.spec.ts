import { confirmTask } from './task-start';
import { expect, test } from '@playwright/test';

async function startLongReading(page: import('@playwright/test').Page) {
  await page.goto('/today');
  await page.locator('.task-row').filter({ has: page.getByRole('heading', { name: '保留分歧与责任' }) }).getByRole('button', { name: '开始阅读' }).click();
  await confirmTask(page);
  await expect(page.locator('.learning-grid')).toBeVisible();
}

for (const workspace of [false, true]) test(`mobile sheet keeps its frame through browser-bar motion and rapid page scrolling: ${workspace ? 'workspace' : 'legacy'}`, async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await startLongReading(page);
  if (workspace) {
    const id = await page.evaluate(async () => {
      const { sessions, createSession } = await import('/src/data/db.ts' as string);
      const { organizePractice } = await import('/src/core/practiceOrganization.ts' as string);
      const session = await sessions.get(location.pathname.split('/').pop()!);
      return (await createSession(organizePractice(session.lesson))).id;
    });
    await page.goto(`/learn/${id}`); await expect(page.locator('.material-workspace')).toBeVisible();
  }
  const panel = page.locator('.question-panel');
  for (const open of [false, true]) {
    if (open) await panel.locator('.question-sheet-toggle').click();
    await expect.poll(() => panel.evaluate(element => Math.abs(element.getBoundingClientRect().height - parseFloat(getComputedStyle(element).getPropertyValue('--question-sheet-height'))))).toBeLessThanOrEqual(1);
    const samples = await panel.evaluate(async element => {
      const viewport = window.visualViewport!, initial = element.getBoundingClientRect(), sizes: { height: number; bottom: number; target: number }[] = [];
      try {
        for (const [inset, offset] of [[56, 4], [0, 0], [32, 2], [0, 0], [56, 0], [0, 0]]) {
          Object.defineProperty(viewport, 'height', { configurable: true, value: innerHeight - inset });
          Object.defineProperty(viewport, 'offsetTop', { configurable: true, value: offset });
          viewport.dispatchEvent(new Event('resize')); viewport.dispatchEvent(new Event('scroll'));
          scrollTo(0, inset ? document.documentElement.scrollHeight : 0);
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          const box = element.getBoundingClientRect();
          sizes.push({ height: Math.abs(box.height - initial.height), bottom: Math.abs(box.bottom - innerHeight), target: Math.abs(parseFloat(getComputedStyle(element).getPropertyValue('--question-sheet-height')) - initial.height) });
        }
      } finally {
        Reflect.deleteProperty(viewport, 'height'); Reflect.deleteProperty(viewport, 'offsetTop');
        viewport.dispatchEvent(new Event('resize'));
      }
      return sizes;
    });
    expect(Math.max(...samples.flatMap(sample => Object.values(sample)))).toBeLessThanOrEqual(1);
  }
  await expect(panel.locator('.question-sheet-content')).toHaveCSS('overscroll-behavior-y', 'contain');
  const bottom = await panel.evaluate(element => {
    const viewport = window.visualViewport!;
    try {
      Object.defineProperty(viewport, 'height', { configurable: true, value: 512 });
      Object.defineProperty(viewport, 'offsetTop', { configurable: true, value: 40 });
      Object.defineProperty(viewport, 'scale', { configurable: true, value: 1.5 });
      viewport.dispatchEvent(new Event('resize'));
      return element.getBoundingClientRect().bottom;
    } finally {
      for (const key of ['height', 'offsetTop', 'scale']) Reflect.deleteProperty(viewport, key);
      viewport.dispatchEvent(new Event('resize'));
    }
  });
  expect(bottom).toBeCloseTo(552, 0);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(panel).toHaveCSS('position', 'sticky');
  await expect(panel.locator('.question-sheet-content')).toHaveCSS('overscroll-behavior-y', workspace ? 'contain' : 'auto');
});

for (const width of [375, 1440]) test(`legacy reading reveals the next prompt after scrolling feedback at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: width < 1200 ? 410 : 650 });
  await startLongReading(page);
  const panel = page.locator('.question-panel');
  if (width < 1200) await panel.locator('.question-sheet-toggle').click();
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await expect(page.locator('.feedback h2').first()).toBeVisible();
  await page.getByRole('button', { name: '下一题', exact: true }).click();
  await expect(panel.locator('.question-number')).toContainText('2');
  const prompt = panel.locator('form>h2');
  await expect(prompt).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('next-prompt.png') });
  await expect.poll(async () => {
    const frame = (await panel.locator('.question-sheet-content').boundingBox())!, heading = (await prompt.boundingBox())!;
    return heading.y >= frame.y && heading.y + heading.height <= frame.y + frame.height;
  }).toBe(true);
});

test('learning header keeps the regular logo size without an extra page label', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/today');
  await expect(page.locator('.home-mark .brand-symbol')).toHaveCSS('width', '40px');
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click(); await confirmTask(page);
  const header = page.locator('header.session-header');
  await expect(header.locator('.brand-symbol')).toHaveCSS('width', '40px');
  await expect(header.locator('.brand-symbol')).toHaveCSS('height', '40px');
  await expect(header).not.toContainText('学习');
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(header.locator('.brand-symbol')).toHaveCSS('width', '40px');
  await expect(header.locator('.brand-symbol')).toHaveCSS('height', '40px');
  await expect(header).not.toContainText('学习');
});

test('mobile answer sheet peeks from below, expands, and closes without losing reading or answers', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await startLongReading(page);
  const material = page.locator('#learning-material');
  const sheet = page.locator('#learning-question');
  const toggle = sheet.locator('.question-sheet-toggle');
  const corners = () => sheet.evaluate(el => { const css = getComputedStyle(el); return [css.borderBottomLeftRadius, css.borderBottomRightRadius, css.borderTopLeftRadius]; });
  await expect.poll(corners).toEqual(['0px', '0px', '16px']);
  await expect(toggle.locator('.question-sheet-chevron')).toHaveCount(0);
  await expect(material).toBeVisible();
  await expect(sheet).toHaveAttribute('data-open', 'false');
  await expect(toggle).toContainText('问题 1/4');
  await expect(page.locator('.question-progress')).toBeHidden();
  expect(await sheet.evaluate(el => {
    const card = el.getBoundingClientRect();
    const toggle = el.querySelector('.question-sheet-toggle')!.getBoundingClientRect();
    const reserve = parseFloat(getComputedStyle(el.closest('main')!).getPropertyValue('--question-sheet-clearance'));
    return Math.abs(card.height - toggle.height) < 2 && Math.abs(reserve - card.height) < 2 && getComputedStyle(el.querySelector('.question-sheet-content')!).visibility === 'hidden' && el.querySelector('.question-sheet-content')!.hasAttribute('inert');
  })).toBe(true);
  await page.screenshot({ path: 'output/playwright/learning-sheet-peek-375x812-light-zh-Hans.png' });
  await page.evaluate(() => scrollTo(0, 600));
  const readingPosition = await page.evaluate(() => scrollY);
  await toggle.click();
  await expect(sheet).toHaveAttribute('data-open', 'true');
  await expect.poll(corners).toEqual(['0px', '0px', '16px']);
  await expect(sheet.locator('.question-progress')).toBeVisible();
  await expect(toggle).toBeHidden();
  expect(await sheet.evaluate(el => {
    const card = el.getBoundingClientRect();
    const viewport = window.visualViewport;
    return card.top >= (viewport?.offsetTop ?? 0) && card.bottom <= (viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight) + 1;
  })).toBe(true);
  await expect(material).toBeVisible();
  expect(await page.evaluate(() => scrollY)).toBe(readingPosition);
  await page.getByRole('radio').first().check();
  await page.screenshot({ path: 'output/playwright/learning-sheet-open-375x812-light-zh-Hans.png' });
  await page.mouse.move(6, 100);
  await expect(sheet).toHaveAttribute('data-open', 'true');
  await expect(page.locator('.question-sheet-scrim')).toHaveCSS('backdrop-filter', 'blur(0px)');
  await expect(page.locator('.question-sheet-scrim')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  const marker = (await sheet.locator('.question-number > span').boundingBox())!;
  await page.mouse.move(marker.x + marker.width / 2, marker.y + marker.height / 2);
  await expect(page.locator('.question-sheet-scrim')).toHaveCSS('backdrop-filter', 'blur(0px)');
  await page.mouse.down();
  await expect(page.locator('.question-sheet-scrim')).toHaveCSS('backdrop-filter', 'blur(4px)');
  await page.mouse.up();
  await expect(page.locator('.question-sheet-scrim')).toHaveCSS('backdrop-filter', 'blur(0px)');
  expect(await page.evaluate(() => document.elementFromPoint(6, 100)?.classList.contains('question-sheet-scrim'))).toBe(true);
  await page.mouse.click(6, 100);
  await expect(sheet).toHaveAttribute('data-open', 'false');
  expect(await page.evaluate(() => scrollY)).toBe(readingPosition);
  await toggle.focus();
  await toggle.press('Enter');
  await expect(sheet).toHaveAttribute('data-open', 'true');
  await expect(page.getByRole('radio').first()).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveAttribute('data-open', 'false');
  await toggle.click();
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await expect(page.locator('.feedback h2').first()).toBeVisible();
  await page.setViewportSize({ width: 320, height: 500 });
  await expect(sheet).toHaveCSS('position', 'fixed');
  await expect(page.locator('.feedback h2').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(sheet).toHaveCSS('transition-duration', '0s');
});

test('touching outside closes the answer sheet', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, locale: 'zh-CN' });
  const page = await context.newPage();
  await startLongReading(page);
  await page.locator('.question-sheet-toggle').tap();
  await expect(page.locator('.question-panel')).toHaveAttribute('data-open', 'true');
  await page.touchscreen.tap(6, 100);
  await expect(page.locator('.question-panel')).toHaveAttribute('data-open', 'false');
  await context.close();
});

test('desktop question number stays visible through page and long feedback scrolling', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await startLongReading(page);
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await expect(page.locator('.feedback h2').first()).toBeVisible();
  for (const [width, height] of [[1440, 900], [1200, 900], [1440, 650]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
      const content = document.querySelector('.question-sheet-content')!;
      content.scrollTop = content.scrollHeight;
    });
    const number = page.locator('.question-progress');
    expect(await page.locator('.question-sheet-content').evaluate(el => el.scrollHeight > el.clientHeight && el.scrollTop > 0)).toBe(true);
    await expect(number.locator('.question-number > span')).toHaveText('1 / 4');
    await expect(page.locator('.question-panel').locator('.question-progress')).toHaveCount(1);
    await expect(number).toBeInViewport();
    expect(await number.evaluate(el => {
      const marker = el.getBoundingClientRect();
      const card = el.closest('.question-panel')!.getBoundingClientRect();
      const content = el.nextElementSibling!.getBoundingClientRect();
      return marker.left >= card.left && marker.right <= card.right && marker.top >= card.top && marker.bottom <= content.top;
    })).toBe(true);
    expect(await number.evaluate(el => {
      const box = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(box.x + 20, box.y + box.height / 2));
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'output/playwright/learning-desktop-fixed-1440x900-light-zh-Hans.png' });
  await page.goto('/today');
  await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('intermediate and mobile widths keep the number at the card top and blur the reading behind it', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await startLongReading(page);
  for (const [width, height] of [[1199, 900], [1024, 900], [801, 410], [768, 900], [375, 812]]) {
    await page.setViewportSize({ width, height });
    const sheet = page.locator('.question-panel');
    await expect(sheet).toHaveCSS('position', 'fixed');
    await sheet.locator('.question-sheet-toggle').click();
    await expect(sheet).toHaveAttribute('data-open', 'true');
    await expect(sheet.locator('.question-progress')).toBeVisible();
    const markerBounds = (await sheet.locator('.question-number > span').boundingBox())!;
    await page.mouse.move(markerBounds.x + markerBounds.width / 2, markerBounds.y + markerBounds.height / 2);
    await expect(page.locator('.question-sheet-scrim')).toHaveCSS('backdrop-filter', 'blur(0px)');
    await page.mouse.down();
    await expect(page.locator('.question-sheet-scrim')).toHaveCSS('backdrop-filter', 'blur(4px)');
    await page.mouse.up();
    await sheet.locator('.question-sheet-content').evaluate(el => { el.scrollTop = el.scrollHeight; });
    expect(await sheet.evaluate(el => {
      const card = el.getBoundingClientRect();
      const marker = el.querySelector('.question-progress')!.getBoundingClientRect();
      const content = el.querySelector('.question-sheet-content')!.getBoundingClientRect();
      const handle = el.querySelector('.question-sheet-resize')?.getBoundingClientRect();
      return Math.abs(marker.top - (handle?.bottom ?? card.top)) < 2 && content.top >= marker.bottom - 1 && marker.bottom <= card.bottom;
    })).toBe(true);
    expect(await page.evaluate(() => document.elementFromPoint(6, 100)?.classList.contains('question-sheet-scrim'))).toBe(true);
    await page.mouse.move(6, 100);
    await page.mouse.down();
    await expect(page.locator('.question-sheet-scrim')).toHaveCSS('transform', 'none');
    await page.mouse.up();
    await expect(sheet).toHaveAttribute('data-open', 'false');
  }
});

test('C1 desktop keeps the second question number on the answer card while reading', async ({ page }) => {
  await page.setViewportSize({ width: 2208, height: 1200 });
  await page.goto('/settings');
  await page.getByRole('button', { name: '外观' }).click();
  await page.getByRole('option', { name: '深色' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('/today');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('.task-row').filter({ has: page.getByRole('heading', { name: '读懂支持与承诺' }) }).getByRole('button', { name: '开始阅读' }).click();
  await confirmTask(page);
  await page.locator('input[type=radio]').first().check();
  await page.getByRole('button', { name: '保存答案' }).click();
  await page.getByRole('button', { name: '下一题' }).click();
  await page.locator('input[type=radio]').first().check();
  await page.evaluate(() => scrollTo(0, 650));
  await expect(page.locator('.question-sheet-toggle')).toBeHidden();
  const card = page.locator('.question-panel');
  const number = card.locator('.question-progress');
  await expect(number.locator('.question-number > span')).toHaveText('2 / 4');
  await expect(number).toBeInViewport();
  expect(await number.evaluate(el => {
    const marker = el.getBoundingClientRect();
    const panel = el.closest('.question-panel')!.getBoundingClientRect();
    const content = el.nextElementSibling!.getBoundingClientRect();
    return marker.left >= panel.left && marker.right <= panel.right && marker.top >= panel.top && marker.bottom <= content.top;
  })).toBe(true);
  await card.locator('.question-sheet-content').evaluate(el => { el.scrollTop = el.scrollHeight; });
  expect(await card.evaluate(el => {
    const number = el.querySelector('.question-progress')!.getBoundingClientRect();
    const content = el.querySelector('.question-sheet-content')!.getBoundingClientRect();
    return el.scrollTop === 0 && number.bottom <= content.top;
  })).toBe(true);
  await page.waitForTimeout(100);
  await page.screenshot({ path: 'output/playwright/learning-c1-question-2-2208x1200-dark-zh-Hans.png' });
});

test('short learning viewport scrolls without a lingering blurred header', async ({ page }) => {
  await page.setViewportSize({ width: 801, height: 410 });
  await startLongReading(page);
  await page.evaluate(() => scrollTo(0, 200));
  await expect(page.locator('header')).toHaveCSS('position', 'static');
  expect(await page.locator('header').evaluate(el => getComputedStyle(el, '::before').content)).toBe('none');
  await expect(page.locator('.passage').first()).toBeVisible();
  await page.screenshot({ path: 'output/playwright/learning-short-801x410-light-zh-Hans.png' });
});
