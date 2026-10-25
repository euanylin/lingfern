import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const catalogue = JSON.parse(readFileSync('content/daily-quotes-runtime.json', 'utf8')) as { quotes: { id: string; text: string }[] };
const index = JSON.parse(readFileSync('content/daily-quote-index.json', 'utf8')) as { id: string; pageTitle: string; eligible: boolean }[];
async function recordedQuote(page: Page, predicate: (quote: { text: string }) => boolean) {
  const quote = catalogue.quotes.find(predicate)!;
  expect(quote).toBeDefined();
  const eligible = index.filter(row => row.eligible), selected = eligible.find(row => row.id === quote.id.slice(-16))!;
  expect(selected).toBeDefined();
  const pages = [...new Set(eligible.map(row => row.pageTitle))], pool = eligible.filter(row => row.pageTitle === selected.pageTitle);
  const draws = [(pages.indexOf(selected.pageTitle) + .5) / pages.length, (pool.indexOf(selected) + .5) / pool.length].map(value => Math.floor(value * 0x100000000));
  expect(JSON.parse(readFileSync('content/quote-calendar.json', 'utf8')).some((event: { date: string }) => event.date === '07-02')).toBe(false);
  await page.clock.setFixedTime('2026-07-02T12:00:00');
  await page.addInitScript(draws => {
    const random = crypto.getRandomValues.bind(crypto); let draw = 0;
    crypto.getRandomValues = array => {
      if (array instanceof Uint32Array && array.length === 1) { array[0] = draws[Math.min(draw++, draws.length - 1)]; return array; }
      return random(array);
    };
  }, draws);
  return quote;
}


for (const width of [375, 768, 1440]) test(`quote measurement leaves page position and full-quote controls stable at ${width}px`, async ({ page }) => {
  const recorded = await recordedQuote(page, quote => quote.text.length > 1500);
  await page.setViewportSize({ width, height: 812 }); await page.goto('/today');
  const quote = page.locator('.daily-quote blockquote'); await expect(quote).toBeVisible();
  await expect(quote).toHaveText(recorded.text);
  const expand = page.locator('.daily-quote .update-action'); await expect(expand).toBeVisible();
  const result = await page.evaluate(async () => {
    const quote = document.querySelector('.daily-quote blockquote')!, practice = document.querySelector('.practice-section')!;
    scrollTo(0, 220); await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const original = { scroll: scrollY, height: document.documentElement.scrollHeight, quoteHeight: quote.getBoundingClientRect().height, practiceTop: practice.getBoundingClientRect().top + scrollY };
    const samples = [], layoutChanges: string[] = [];
    const observer = new MutationObserver(rows => rows.forEach(row => layoutChanges.push(row.oldValue ?? '')));
    observer.observe(quote, { attributes: true, attributeFilter: ['style'], attributeOldValue: true });
    for (let i = 0; i < 16; i++) {
      window.visualViewport!.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('resize'));
      samples.push({ scroll: scrollY, height: document.documentElement.scrollHeight, quoteHeight: quote.getBoundingClientRect().height, practiceTop: practice.getBoundingClientRect().top + scrollY });
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
    observer.disconnect(); return { original, samples, layoutChanges };
  });
  expect(result.layoutChanges).toEqual([]);
  for (const sample of result.samples) {
    expect(Math.abs(sample.scroll - result.original.scroll)).toBeLessThanOrEqual(1);
    expect(Math.abs(sample.height - result.original.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(sample.quoteHeight - result.original.quoteHeight)).toBeLessThanOrEqual(1);
    expect(Math.abs(sample.practiceTop - result.original.practiceTop)).toBeLessThanOrEqual(1);
  }
  await test.info().attach('viewport-resize-scroll-positions', { body: JSON.stringify(result), contentType: 'application/json' });
  await expand.click(); await expect(expand).toHaveAttribute('aria-expanded', 'true');
  expect((await quote.boundingBox())!.height).toBeGreaterThan(result.original.quoteHeight * 3);
  await expand.click(); await expect(expand).toHaveAttribute('aria-expanded', 'false');
  expect(Math.abs((await quote.boundingBox())!.height - result.original.quoteHeight)).toBeLessThanOrEqual(1);
  for (const height of [760, 812, 775, 812]) { await page.setViewportSize({ width, height }); await expect(expand).toBeVisible(); }
});

test.describe('rapid native Today scrolling', () => {
  test.use({ hasTouch: true });
  test('fast alternating swipes and browser-bar resizing keep content anchors stable', async ({ page }) => {
    const recorded = await recordedQuote(page, quote => quote.text.startsWith('There is a limit to the legitimate interference'));
    await page.setViewportSize({ width: 375, height: 812 }); await page.goto('/today');
    const quote = page.locator('.daily-quote blockquote'); await expect(quote).toBeVisible();
    await expect(quote).toHaveText(recorded.text);
    await expect(page.locator('.daily-quote .update-action')).toHaveAttribute('aria-expanded', 'false');
    await page.evaluate(() => {
      const quote = document.querySelector('.daily-quote blockquote')!, practice = document.querySelector('.practice-section')!;
      const samples: { scroll: number; practice: number; quote: number; height: number }[] = [], mutations: string[] = [];
      const observer = new MutationObserver(rows => rows.forEach(row => mutations.push(row.oldValue ?? '')));
      observer.observe(quote, { attributes: true, attributeFilter: ['style'], attributeOldValue: true });
      let running = true;
      const sample = () => { samples.push({ scroll: scrollY, practice: practice.getBoundingClientRect().top + scrollY, quote: quote.getBoundingClientRect().top + scrollY, height: quote.getBoundingClientRect().height }); if (running) requestAnimationFrame(sample); };
      sample();
      (window as unknown as { stopScrollSample: () => unknown }).stopScrollSample = () => { running = false; observer.disconnect(); return { samples, mutations }; };
    });
    const cdp = await page.context().newCDPSession(page);
    for (const [height, start, end] of [[760, 640, 180], [812, 180, 640], [775, 640, 180], [812, 180, 640]] as const) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 20, y: start }] });
      for (let step = 1; step <= 6; step++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 20, y: start + (end - start) * step / 6 }] });
        if (step === 3) await page.setViewportSize({ width: 375, height });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    const result = await page.evaluate(() => (window as unknown as { stopScrollSample: () => { samples: { scroll: number; practice: number; quote: number; height: number }[]; mutations: string[] } }).stopScrollSample());
    expect(result.mutations).toEqual([]);
    expect(Math.max(...result.samples.map(row => row.scroll)) - Math.min(...result.samples.map(row => row.scroll))).toBeGreaterThan(100);
    for (const key of ['practice', 'quote', 'height'] as const) expect(Math.max(...result.samples.map(row => row[key])) - Math.min(...result.samples.map(row => row[key]))).toBeLessThanOrEqual(1);
    await expect(page.locator('.daily-quote .update-action')).toHaveAttribute('aria-expanded', 'false');
    await test.info().attach('native-swipe-content-anchors', { body: JSON.stringify(result), contentType: 'application/json' }); await cdp.detach();
  });
});
