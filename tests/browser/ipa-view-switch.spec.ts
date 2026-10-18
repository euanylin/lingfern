import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { languagePacks } from '../../src/locales';
import { selectPicker } from './picker';

const chart = JSON.parse(readFileSync('public/ipa/entries.json', 'utf8'));
for (const locale of ['zh-Hans', 'zh-Hant', 'en', 'ar'] as const) for (const theme of ['light', 'dark'] as const) test(`original simple IPA and detailed switch at ${locale}/${theme}`, async ({ page }, testInfo) => {
  await page.goto('/settings');
  await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
  await selectPicker(page, languagePacks[locale].app.theme, theme);
  await page.goto('/library/ipa');
  const t = languagePacks[locale].ipaChart;
  const simple = page.getByRole('button', { name: t.simple, exact: true });
  const detailed = page.getByRole('button', { name: t.detailed, exact: true });
  await expect(simple).toHaveAttribute('aria-pressed', 'true');
  await detailed.focus(); await detailed.press('Enter');
  await expect(detailed).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.ipa-table')).toHaveCount(4);
  await simple.focus(); await simple.press('Enter');
  await expect(simple).toBeFocused(); await expect(simple).toHaveAttribute('aria-pressed', 'true');
  await expect(detailed).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.ipa-table')).toHaveCount(0);
  await expect(page.locator('.ipa-scope')).toHaveText(t.scope);
  await expect(page.getByRole('link', { name: t.officialChart })).toBeVisible();
  await expect(page.locator('.ipa-grid')).toHaveCount(8);
  await expect(page.locator('.ipa-pair')).toHaveCount(8);
  for (const group of ['vowel', 'consonant'] as const) {
    const categories = ['simple-vowel', 'rhotic-vowel', 'diphthong', 'stop', 'fricative', 'affricate', 'nasal', 'approximant'] as const;
    await expect(page.locator('.ipa-group').nth(group === 'vowel' ? 0 : 1).locator('h3')).toHaveText([
      ...(group === 'consonant' ? [t.contrast] : []),
      ...categories.filter(category => chart.entries.some((entry: { group: string; category: string }) => entry.group === group && entry.category === category)).map(category => t.categories[category]),
    ]);
  }
  expect(await page.locator('.ipa-entry').evaluateAll(entries => entries.map(entry => entry.getAttribute('data-ipa')))).toEqual(chart.entries.map((entry: { ipa: string }) => entry.ipa));
  expect(await page.locator('.ipa-entry').first().evaluate(entry => [...entry.children].map(child => child.tagName))).toEqual(['SPAN', 'BUTTON', 'SPAN', 'BUTTON']);
  await expect(page.locator('.ipa-entry').first().locator('strong')).toHaveText('ee');
  for (const width of [1440, 640, 375, 320]) {
    await page.setViewportSize({ width, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const header = await page.locator('.ipa-heading').evaluate(el => {
      const title = el.querySelector('h1')!, scope = el.querySelector('.ipa-scope')!, link = el.querySelector('a')!;
      return { title: title.getBoundingClientRect().toJSON(), scope: scope.getBoundingClientRect().toJSON(), link: link.getBoundingClientRect().toJSON(), background: getComputedStyle(link).backgroundColor, decorated: getComputedStyle(link).textDecorationLine };
    });
    expect(header.scope.top).toBeGreaterThanOrEqual(header.title.bottom);
    expect(header.link.height).toBeGreaterThanOrEqual(44);
    expect(header.background).toBe('rgba(0, 0, 0, 0)');
    expect(header.decorated).toBe('none');
    expect(Math.abs(header.link.top - header.title.top)).toBeLessThanOrEqual(1);
    const segments = await page.locator('.ipa-view-switch button').evaluateAll(buttons => buttons.map(button => ({ box: button.getBoundingClientRect().toJSON(), background: getComputedStyle(button).backgroundColor, transform: getComputedStyle(button).transform })));
    expect(segments).toHaveLength(2);
    expect(Math.abs(segments[0].box.right - segments[1].box.left) < 1 || Math.abs(segments[1].box.right - segments[0].box.left) < 1).toBe(true);
    expect(segments[0].background).not.toBe(segments[1].background);
    expect(segments.every(segment => segment.transform === 'none')).toBe(true);
    const columns = await page.locator('.ipa-grid').first().evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(width === 1440 ? 3 : width === 640 ? 2 : 1);
    expect(await page.locator('.ipa-entry button, .progress-skill-tabs button').evaluateAll(buttons => buttons.length === 84 && buttons.every(button => { const box = button.getBoundingClientRect(); return box.width >= 44 && box.height >= 44; }))).toBe(true);
    if (width === 1440 || width === 375) await page.screenshot({ path: testInfo.outputPath(`simple-${width}.png`), fullPage: true });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.documentElement.style.fontSize = '200%');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const audio = page.locator('audio');
  await audio.evaluate((audio: HTMLAudioElement) => { audio.muted = true; audio.loop = true; });
  await page.getByRole('button', { name: `${t.sound} /w/`, exact: true }).click();
  await expect.poll(() => audio.evaluate((audio: HTMLAudioElement) => audio.played.length > 0 && !audio.paused)).toBe(true);
  expect(await audio.getAttribute('src')).toBe(chart.entries.find((entry: { ipa: string }) => entry.ipa === 'w').soundAudio);
  await detailed.focus(); await detailed.press('Space');
  await expect(detailed).toBeFocused(); await expect(page.locator('.ipa-table')).toHaveCount(4);
  await expect(page.getByRole('button', { name: `${languagePacks.en.ipaChart.sound} /w/`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await audio.evaluate((audio: HTMLAudioElement) => !audio.paused)).toBe(true);
  await page.getByRole('button', { name: `${languagePacks.en.ipaChart.word} wet`, exact: true }).click();
  await simple.click();
  await expect(page.getByRole('button', { name: `${t.word} wet`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await audio.getAttribute('src')).toBe('/ipa/audio/wet.mp3');
  await audio.evaluate((audio: HTMLAudioElement) => audio.loop = false);
  await expect.poll(() => audio.evaluate((audio: HTMLAudioElement) => audio.ended && audio.duration > 0)).toBe(true);
  await expect(page.getByRole('button', { name: `${t.word} wet`, exact: true })).toHaveAttribute('aria-pressed', 'false');
  expect(await page.locator('.ipa-entry').count()).toBe(41);
});

test('IPA opens simple on every screen without overriding a manual choice on resize', async ({ page }) => {
  for (const width of [320, 375, 767, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/library/ipa');
    const automatic = '简易版';
    const manual = '详细版';
    await expect(page.getByRole('button', { name: automatic, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.ipa-entry')).toHaveCount(41);
    await page.getByRole('button', { name: manual, exact: true }).click();
    await page.setViewportSize({ width: width <= 767 ? 1440 : 375, height: 900 });
    await expect(page.getByRole('button', { name: manual, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('button', { name: manual, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.getByRole('button', { name: automatic, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.ipa-entry')).toHaveCount(41);
  }
});

for (const theme of ['light', 'dark'] as const) test(`English detailed tables fit mobile controls with fixed axes at ${theme}`, async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, locale: 'zh-CN', colorScheme: theme, reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    await page.goto('http://127.0.0.1:5173/library/ipa');
    await expect(page.getByRole('button', { name: '简易版', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: '详细版', exact: true }).tap();
    await expect(page.locator('.ipa-group > h2')).toHaveText(['Vowels', 'Pulmonic consonants', 'Non-pulmonic consonants', 'Other symbols', 'Affricates (examples)', 'Diacritics', 'Suprasegmentals', 'Tones and word accents']);
    for (const width of [320, 375, 767]) {
      await page.setViewportSize({ width, height: 812 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const name of ['rhotic', 'diphthongs']) expect(await page.locator(`.ipa-table-${name}`).locator('..').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      const scroll = page.locator('.ipa-table-consonants').locator('..');
      await scroll.scrollIntoViewIfNeeded();
      await scroll.evaluate(el => { el.scrollLeft = 0; el.scrollTop = 0; });
      const rowHeader = page.locator('.ipa-table-consonants tbody th').first();
      const columnHeader = page.locator('.ipa-table-consonants thead th').nth(1);
      const beforeRow = (await rowHeader.boundingBox())!, beforeCol = (await columnHeader.boundingBox())!;
      expect(beforeRow.width).toBe(96);
      expect(await scroll.evaluate(el => el.clientHeight <= innerHeight * .7 + 1)).toBe(true);
      await scroll.evaluate(el => { el.scrollLeft = el.scrollWidth; el.scrollTop = el.scrollHeight; });
      expect(Math.abs((await rowHeader.boundingBox())!.x - beforeRow.x)).toBeLessThanOrEqual(1);
      expect(Math.abs((await columnHeader.boundingBox())!.y - beforeCol.y)).toBeLessThanOrEqual(1);
      await scroll.evaluate(el => { el.scrollLeft = 0; el.scrollTop = 0; });
      expect(await page.locator('.ipa-entry button').evaluateAll(buttons => buttons.length === 167 && buttons.every(button => { const box = button.getBoundingClientRect(); return box.width >= 44 && box.height >= 44; }))).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`detailed-mobile-${width}.png`), fullPage: true });
    }
  } finally { await context.close(); }
});
