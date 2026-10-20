import { expect, test, type Page } from '@playwright/test';
import { confirmTask } from './task-start';
import { selectPicker } from './picker';
import type { ContentLocale as Locale } from '../../src/shared/locale';

async function startReading(page: Page, locale: Locale = 'zh-Hans') {
  const title = { 'zh-Hans': '保留分歧与责任', 'zh-Hant': '保留分歧與責任', en: 'Preserve disagreement and responsibility' }[locale];
  await page.goto('/today');
  await page.locator('.task-row').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).getByRole('button').click();
  await confirmTask(page);
  await expect(page.locator('.reading-workspace')).toBeVisible();
}

test('native English hyphenation and emergency wrapping preserve the original text', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await startReading(page);
  const result = await page.evaluate(() => {
    const probe = document.createElement('p');
    probe.className = 'passage'; probe.lang = 'en'; probe.textContent = 'responsibility';
    // Isolated layout probe; no lesson, answer, annotation or original source is changed.
    probe.style.cssText = 'width:64px;overflow-wrap:normal';
    document.querySelector<HTMLElement>('.reading-workspace')!.appendChild(probe);
    const lines = () => {
      const node = probe.firstChild!, tops = new Set<number>();
      for (let i = 0; i < node.textContent!.length; i++) {
        const range = document.createRange(); range.setStart(node, i); range.setEnd(node, i + 1);
        tops.add(Math.round(range.getBoundingClientRect().top));
      }
      return tops.size;
    };
    const nativeLines = lines();
    probe.style.hyphens = 'none'; probe.style.setProperty('-webkit-hyphens', 'none');
    const unbrokenLines = lines();
    probe.style.overflowWrap = 'break-word';
    const fallback = { lines: lines(), fits: probe.scrollWidth <= probe.clientWidth, text: probe.textContent };
    probe.remove();
    return { nativeLines, unbrokenLines, fallback };
  });
  expect(result.unbrokenLines).toBe(1);
  expect(result.fallback.lines).toBeGreaterThan(1); expect(result.fallback.fits).toBe(true);
  expect(result.fallback.text).toBe('responsibility');
  if (result.nativeLines === 1) test.info().annotations.push({ type: 'native-dictionary', description: 'This engine has no active English hyphenation dictionary; emergency wrapping is verified.' });
  else expect(result.nativeLines).toBeGreaterThan(result.unbrokenLines);
  await test.info().attach('native-hyphenation', { body: JSON.stringify(result), contentType: 'application/json' });
});

for (const width of [320, 900, 1440]) test(`book-style line alignment preserves source and last-line spacing at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await startReading(page);
  const result = await page.locator('.passage').first().evaluate(paragraph => {
    const original = paragraph.textContent, html = paragraph.innerHTML;
    const lines = (element = paragraph) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT), rows = new Map<number, { right: number; forced: boolean }>();
      while (walker.nextNode()) {
        const node = walker.currentNode;
        for (let i = 0; i < node.textContent!.length; i++) {
          const character = node.textContent![i];
          if (/\s/.test(character) && character !== '\n') continue;
          const range = document.createRange(); range.setStart(node, i); range.setEnd(node, i + 1);
          const rect = range.getBoundingClientRect(), top = Math.round(rect.top);
          const row = rows.get(top);
          if (character === '\n') { if (row) row.forced = true; }
          else rows.set(top, { right: Math.max(row?.right ?? 0, rect.right), forced: row?.forced ?? false });
        }
      }
      return [...rows.values()].map(row => ({ gap: element.getBoundingClientRect().right - row.right, forced: row.forced }));
    };
    const justified = lines();
    (paragraph as HTMLElement).style.textAlign = 'start'; const ragged = lines();
    (paragraph as HTMLElement).style.removeProperty('text-align');
    // A fixed short forced line tests alignment independently of platform font metrics.
    const probe = paragraph.cloneNode(false) as HTMLElement;
    probe.textContent = 'Short line.\nA final line.';
    paragraph.parentNode!.insertBefore(probe, paragraph.nextSibling);
    const forced = lines(probe); probe.remove();
    return { justified, ragged, forced, sourcePreserved: paragraph.textContent === original && paragraph.innerHTML === html,
      fits: paragraph.scrollWidth <= paragraph.clientWidth, width: paragraph.clientWidth,
      limit: parseFloat(getComputedStyle(paragraph).maxInlineSize),
      limits: { standard: CSS.supports('hyphenate-limit-chars', '6 3 3'), webkit: CSS.supports('-webkit-hyphenate-limit-lines', '2') } };
  });
  await test.info().attach('line-alignment', { body: JSON.stringify(result), contentType: 'application/json' });
  expect(result.sourcePreserved).toBe(true); expect(result.fits).toBe(true);
  expect(result.width).toBeLessThanOrEqual(Math.ceil(result.limit));
  expect(result.justified.length).toBeGreaterThan(1);
  expect(result.justified.slice(0, -1).filter(row => !row.forced).every(row => row.gap < 10)).toBe(true);
  expect(result.justified.at(-1)!.gap).toBeGreaterThan(12);
  expect(result.forced.some(row => row.forced && row.gap > 12), JSON.stringify(result)).toBe(true);
  expect(result.justified.filter(row => row.forced).map(row => row.gap)).toEqual(result.ragged.filter(row => row.forced).map(row => row.gap));
  expect(result.justified.slice(0, -1).reduce((sum, row) => sum + row.gap, 0)).toBeLessThan(result.ragged.slice(0, -1).reduce((sum, row) => sum + row.gap, 0));
});

for (const [width, theme, locale] of [[1440, 'light', 'zh-Hans'], [375, 'dark', 'zh-Hant'], [320, 'light', 'en'], [1440, 'dark', 'en']] as const) {
  test(`reader keeps its article title and English typography at ${width}/${theme}/${locale}`, async ({ page, browserName }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/settings');
    await selectPicker(page, '语言', locale);
    await selectPicker(page, locale === 'en' ? 'Appearance' : locale === 'zh-Hant' ? '外觀' : '外观', theme);
    await startReading(page, locale);
    await expect(page.locator('.session-title')).toHaveCount(0);
    await expect(page.locator('.session-meta')).toHaveCount(0);
    await expect(page.locator('.question-number bdi')).toHaveText('1 / 4');
    await expect(page.locator('.paragraph-number')).toHaveCount(0);
    await expect(page.locator('main h1')).toHaveCount(1);
    const title = page.locator('.reading-workspace > h1');
    await expect(title).toHaveText('Two notes on an archive pilot');
    await expect(title).toHaveCSS('font-size', '24px');
    expect(await title.evaluate(el => parseFloat(getComputedStyle(el).lineHeight))).toBeCloseTo(33.6, 2);
    await expect(title).toHaveCSS('margin-top', '12px');
    await expect(title).toHaveCSS('margin-bottom', '16px');
    await expect(page.locator('.reading-workspace h3').first()).toHaveText('Mara · Access lead');
    const passage = page.locator('.passage').first();
    await expect(passage).toHaveAttribute('lang', 'en');
    await expect(passage).toHaveCSS('hyphens', 'auto');
    await expect(passage).toHaveCSS('word-break', 'normal');
    await expect(passage).toHaveCSS('text-align', 'justify');
    await expect(passage).toHaveCSS('text-align-last', 'start');
    await expect(passage).toHaveCSS('overflow-wrap', 'break-word');
    await expect(passage).toHaveCSS('font-size', '16px');
    expect(await passage.evaluate(el => parseFloat(getComputedStyle(el).lineHeight))).toBeCloseTo(29.6, 2);
    await expect(passage).toHaveCSS('margin-bottom', '20px');
    const body = await passage.locator('[data-block-text]').textContent();
    expect(body).not.toContain('\u00ad');
    await page.locator('.reading-notes summary').click();
    await expect(page.locator('.reading-notes textarea')).toHaveJSProperty('lang', '');
    expect(await page.locator('.reading-notes').evaluate(el => el.closest('[lang]')?.getAttribute('lang'))).toBe(locale);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const gap = await page.evaluate(() => { const main = document.querySelector('main')!; return document.querySelector('.learning-grid')!.getBoundingClientRect().top - main.getBoundingClientRect().top - parseFloat(getComputedStyle(main).paddingTop); });
    expect(gap).toBeGreaterThanOrEqual(0); expect(gap).toBeLessThanOrEqual(1);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `output/playwright/reader-ui-${browserName}-${width}-${theme}-${locale}.png` });
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`answer scrim interpolates in both directions and survives reversal in ${theme}`, async ({ page, browserName }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/settings'); await selectPicker(page, '外观', theme);
    await startReading(page);
    const scrim = page.locator('.question-sheet-scrim'), sheet = page.locator('.question-panel');
    await expect(scrim).toHaveCSS('backdrop-filter', 'blur(0px)');
    const sample = () => page.evaluate(() => new Promise<{ blur: number; opacity: number }[]>(resolve => {
      const frames: { blur: number; opacity: number }[] = [], el = document.querySelector('.question-sheet-scrim')!;
      const start = performance.now();
      const frame = () => {
        const style = getComputedStyle(el), filter = style.backdropFilter || style.getPropertyValue('-webkit-backdrop-filter');
        frames.push({ blur: Number(/blur\(([\d.]+)px\)/.exec(filter)?.[1] ?? 0), opacity: Number(style.opacity) });
        if (performance.now() - start < 550) requestAnimationFrame(frame); else resolve(frames);
      };
      requestAnimationFrame(frame);
    }));
    await sheet.locator('.question-sheet-toggle').click();
    await expect(scrim).toHaveCSS('backdrop-filter', 'blur(0px)');
    const marker = sheet.locator('.question-number > span');
    const press = async () => {
      const box = (await marker.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
    };
    const opening = sample(); await press(); const entered = await opening;
    expect(new Set(entered.filter(f => f.blur > 0 && f.blur < 4).map(f => f.blur)).size).toBeGreaterThanOrEqual(3);
    await expect(scrim).toHaveCSS('backdrop-filter', 'blur(4px)');
    await page.mouse.up(); await expect(scrim).toHaveCSS('backdrop-filter', 'blur(0px)');
    await page.getByRole('radio').first().check();
    await page.screenshot({ path: `output/playwright/reader-sheet-open-${browserName}-375-${theme}.png` });
    await press(); await expect(scrim).toHaveCSS('backdrop-filter', 'blur(4px)');
    const closing = sample();
    await page.keyboard.press('Escape'); await page.mouse.up();
    const exited = await closing;
    expect(new Set(exited.filter(f => f.blur > 0 && f.blur < 4).map(f => f.blur)).size).toBeGreaterThanOrEqual(3);
    await expect(scrim).toHaveCount(1);
    await expect(scrim).toHaveCSS('backdrop-filter', 'blur(0px)');
    await expect(scrim).toHaveCSS('opacity', '0');
    await expect(sheet).toHaveAttribute('data-open', 'false');
    await sheet.locator('.question-sheet-toggle').click();
    await press(); await expect(scrim).toHaveCSS('backdrop-filter', 'blur(4px)');
    await page.mouse.up(); await page.waitForTimeout(160);
    await press(); await expect(scrim).toHaveCSS('backdrop-filter', 'blur(4px)');
    await page.mouse.up();
    await expect(page.getByRole('radio').first()).toBeChecked();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(scrim).toHaveCSS('transition-duration', '0s');
    await page.keyboard.press('Escape');
    await expect(scrim).toHaveCSS('backdrop-filter', 'blur(0px)');
    await test.info().attach('native-blur-frames', { body: JSON.stringify({ entered, exited }), contentType: 'application/json' });
  });
}

test('task drawer owns its edge radii at the existing full-screen breakpoint', async ({ page, browserName }) => {
  await page.goto('/today');
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click();
  const panel = page.locator('.task-detail');
  await expect(panel).toHaveCSS('transform', 'none');
  for (const [width, height] of [[1440, 900], [1024, 768], [768, 600], [767, 812], [375, 812], [320, 500], [812, 375]]) {
    await page.setViewportSize({ width, height });
    await expect(panel).toHaveCSS('border-top-left-radius', width < 768 ? '0px' : '16px');
    await expect(panel).toHaveCSS('border-bottom-left-radius', width < 768 ? '0px' : '16px');
    await expect(panel).toHaveCSS('border-top-right-radius', '0px');
    await expect(panel).toHaveCSS('border-bottom-right-radius', '0px');
    const box = (await panel.boundingBox())!;
    expect(Math.abs(box.x + box.width - width)).toBeLessThanOrEqual(1);
    expect(box.y).toBe(0); expect(box.height).toBe(height);
    expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await panel.getByRole('button', { name: '关闭详情', exact: true }).scrollIntoViewIfNeeded();
    await expect(panel.getByRole('button', { name: '关闭详情', exact: true })).toBeInViewport();
    if (width === 1440 || width === 375) await page.screenshot({ path: `output/playwright/reader-drawer-${browserName}-${width}-light-zh-Hans.png` });
  }
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
});

test('picker choices retain touch and keyboard activation without premature blur dismissal', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, locale: 'zh-CN' });
  try {
    const page = await context.newPage();
    await page.goto('/settings');
    const trigger = page.getByRole('button', { name: '外观', exact: true });
    await trigger.tap();
    await page.getByRole('option', { name: '深色', exact: true }).tap();
    await expect(trigger).toHaveAttribute('data-value', 'dark');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await trigger.focus(); await trigger.press('ArrowUp'); await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('data-value', 'light');
    await page.reload(); await expect(trigger).toHaveAttribute('data-value', 'light');
    await trigger.tap(); await page.touchscreen.tap(6, 110);
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(trigger).toHaveAttribute('data-value', 'light');
  } finally { await context.close(); }
});



test('mobile answer peek scales smoothly in both directions without shifting its layout', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.mouse.move(0, 0);
  await startReading(page);
  const toggle = page.locator('.question-sheet-toggle');
  await expect(toggle).toBeVisible();
  const sampleScale = () => toggle.evaluate(element => new Promise<number[]>(resolve => {
    const values: number[] = [], start = performance.now();
    const frame = () => {
      const transform = getComputedStyle(element).transform;
      values.push(transform === 'none' ? 1 : new DOMMatrixReadOnly(transform).a);
      if (performance.now() - start < 400) requestAnimationFrame(frame); else resolve(values);
    };
    requestAnimationFrame(frame);
  }));
  const layout = await toggle.evaluate(element => { const item = element as HTMLElement; return [item.offsetTop, item.offsetLeft, item.offsetWidth, item.offsetHeight]; });
  const box = (await toggle.boundingBox())!;
  const entering = sampleScale(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); const enlarged = await entering;
  expect(new Set(enlarged.filter(value => value > 1 && value < 1.025)).size).toBeGreaterThanOrEqual(3);
  expect(enlarged.at(-1)).toBeCloseTo(1.025, 4);
  const leaving = sampleScale(); await page.mouse.move(0, 0); const restored = await leaving;
  expect(new Set(restored.filter(value => value > 1 && value < 1.025)).size).toBeGreaterThanOrEqual(3);
  expect(restored.at(-1)).toBe(1);
  expect(await toggle.evaluate(element => { const item = element as HTMLElement; return [item.offsetTop, item.offsetLeft, item.offsetWidth, item.offsetHeight]; })).toEqual(layout);
  await page.keyboard.press('Tab');
  await toggle.focus(); await expect(toggle).toBeFocused();
  await expect.poll(() => toggle.evaluate(element => element.matches(':focus-visible'))).toBe(true);
  await expect(toggle).toHaveCSS('outline-style', 'none');
  await expect(toggle).toHaveCSS('text-decoration-line', 'underline');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(toggle).toHaveCSS('transition-duration', '0s');
});
