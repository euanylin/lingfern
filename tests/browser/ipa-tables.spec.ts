import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { languagePacks } from '../../src/locales';
import { fullPlaces } from '../../src/app/fullIpa';
import { officialIpaChart } from '../../src/app/ipaTables';
import { selectPicker } from './picker';

const chart = JSON.parse(readFileSync('public/ipa/entries.json', 'utf8'));
const fullSounds = JSON.parse(readFileSync('public/ipa/full-sounds.json', 'utf8'));
for (const locale of ['zh-Hans', 'zh-Hant', 'en', 'ar'] as const) for (const theme of ['light', 'dark'] as const) test(`English IPA axes, controls and local scrolling at ${locale}/${theme}`, async ({ page }) => {
  await page.goto('/settings');
  await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
  await selectPicker(page, languagePacks[locale].app.theme, theme);
  await page.goto('/library/ipa');
  await expect(page.getByRole('button', { name: languagePacks[locale].ipaChart.simple, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: languagePacks[locale].ipaChart.detailed, exact: true }).click();
  const t = languagePacks.en.ipaChart;
  await expect(page.locator('.ipa-scope')).toContainText('Full IPA chart.');
  await expect(page.locator('.ipa-table')).toHaveCount(4);
  await expect(page.locator('.ipa-group > h2')).toHaveText(['Vowels', 'Pulmonic consonants', 'Non-pulmonic consonants', 'Other symbols', 'Affricates (examples)', 'Diacritics', 'Suprasegmentals', 'Tones and word accents']);
  expect(await page.locator('.ipa-group').evaluateAll(groups => groups.every(group => group.getAttribute('lang') === 'en' && group.getAttribute('dir') === 'ltr'))).toBe(true);
  await expect(page.locator('.ipa-table-consonants thead th')).toHaveText(['Manner / Place', ...fullPlaces]);
  expect(await page.locator('.ipa-entry').evaluateAll(entries => entries.map(entry => entry.getAttribute('data-ipa')).sort())).toEqual(fullSounds.entries.map((entry: { ipa: string }) => entry.ipa).sort());
  await expect(page.locator('.ipa-table-consonants tr[data-row=lateral-approximant] [data-column=alveolar] .ipa-entry')).toHaveAttribute('data-ipa', 'l');
  await expect(page.locator('.ipa-symbol-item .ipa-entry[data-ipa=w]')).toHaveCount(1);
  expect(await page.locator('.ipa-vowel-row').nth(4).locator('.ipa-vowel-pair').last().locator('.ipa-entry').evaluateAll(entries => entries.map(entry => entry.getAttribute('data-ipa')))).toEqual(['ʌ', 'ɔ']);
  await expect(page.locator('.ipa-english-circle')).toHaveCount(41);
  await expect(page.locator('.ipa-english-variant')).toHaveCount(5);
  await expect(page.locator('.ipa-reference-entry[data-ipa=ɬ] button')).toHaveCount(1);
  for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('.ipa-entry button').evaluateAll(buttons => buttons.length === 167 && buttons.every(button => { const box = button.getBoundingClientRect(); return box.width >= 44 && box.height >= 44; }))).toBe(true);
    await page.screenshot({ path: `output/playwright/ipa-tables-${locale}-${theme}-${width}.png` });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.documentElement.style.fontSize = '200%');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.ipa-table-consonants').locator('..').focus();
  await expect(page.locator('.ipa-table-consonants').locator('..')).toBeFocused();
  // Keep short clips playing long enough to observe the pressed state, then verify native completion.
  await page.locator('audio').evaluate((audio: HTMLAudioElement) => { audio.muted = true; audio.loop = true; });
  await page.getByRole('button', { name: `${t.sound} /w/`, exact: true }).click();
  await expect.poll(() => page.locator('audio').getAttribute('src')).toBe(chart.entries.find((entry: { ipa: string }) => entry.ipa === 'w').soundAudio);
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.played.length > 0 && !audio.paused)).toBe(true);
  await page.getByRole('button', { name: `${t.word} wet`, exact: true }).click();
  await expect.poll(() => page.locator('audio').getAttribute('src')).toBe('/ipa/audio/wet.mp3');
  await expect(page.locator('.ipa-entry[data-ipa=w] .ipa-word')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.loop = false);
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.ended && audio.duration > 0)).toBe(true);
  await expect(page.locator('.ipa-entry[data-ipa=w] .ipa-word')).toHaveAttribute('aria-pressed', 'false');
});

test('official chart opens deliberately in a separate tab without loading external chart resources', async ({ page, context }) => {
  const external: string[] = [];
  await context.route('https://www.internationalphoneticassociation.org/**', route => { external.push(route.request().url()); return route.abort(); });
  await page.goto('/library/ipa');
  await page.getByRole('button', { name: '详细版', exact: true }).click(); await expect(page.locator('.ipa-entry')).toHaveCount(126);
  expect(external).toEqual([]);
  const link = page.getByRole('link', { name: 'IPA 官方图表' });
  await expect(link).toHaveAttribute('href', officialIpaChart);
  await expect(link).toHaveAttribute('target', '_blank'); await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  const [popup] = await Promise.all([page.waitForEvent('popup'), link.click()]);
  await popup.close(); expect(external).toEqual([officialIpaChart]);
  await expect(page).toHaveURL(/\/library\/ipa$/); await expect(page.locator('.ipa-entry')).toHaveCount(126);
});

test('an unexpected non-English chart symbol displays the existing read error instead of a partial chart', async ({ page }) => {
  await page.route('**/ipa/entries.json', route => route.fulfill({ json: { ...chart, entries: [{ ...chart.entries[0], ipa: 'ɬ' }, ...chart.entries.slice(1)] } }));
  await page.goto('/library/ipa'); await expect(page.getByRole('alert')).toContainText('发音表或录音无法读取');
  await expect(page.locator('.ipa-entry')).toHaveCount(0); await expect(page.getByRole('link', { name: 'IPA 官方图表' })).toBeVisible();
});


test('every independent IPA sound plays locally, records history and retains the existing English word controls', async ({ page }) => {
  test.setTimeout(120_000);
  const external: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:5173/')) external.push(request.url()); });
  await page.goto('/library/ipa');
  await page.getByRole('button', { name: '详细版', exact: true }).click();
  await expect(page.locator('.ipa-entry')).toHaveCount(126);
  const audio = page.locator('audio');
  await audio.evaluate((element: HTMLAudioElement) => { element.muted = true; });
  for (const entry of fullSounds.entries as { ipa: string; soundAudio: string }[]) {
    await page.getByRole('button', { name: `Play sound /${entry.ipa}/`, exact: true }).click();
    await expect(audio).toHaveAttribute('src', entry.soundAudio);
    await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime > 0 && element.duration > 0 && !element.error)).toBe(true);
    await audio.evaluate((element: HTMLAudioElement) => element.pause());
  }
  await expect(page.locator('.ipa-entry .ipa-word')).toHaveCount(41);
  await expect(page.locator('.ipa-entry .ipa-symbol[aria-pressed]')).toHaveCount(126);
  await expect(page.locator('.ipa-symbol-item>.ipa-reference-symbol button')).toHaveCount(0);
  await expect.poll(() => page.evaluate(async () => (await (await import('/src/data/lookupHistory.ts' as string)).readLookupHistory('local-guest')).some((row: { kind: string; term: string }) => row.kind === 'ipa' && row.term === 'ɖ͡ʐ'))).toBe(true);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/library/ipa?q=%C9%AC');
  await expect(page.getByRole('button', { name: '详细版', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.ipa-entry[data-ipa=ɬ]')).toBeFocused();
  await page.getByRole('button', { name: 'Play sound /ɬ/', exact: true }).press('Enter');
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime > 0)).toBe(true);
  expect(external).toEqual([]);
});

test('an unsafe full-chart catalogue fails visibly instead of showing a partially playable chart', async ({ page }) => {
  await page.route('**/ipa/full-sounds.json', route => route.fulfill({ json: { ...fullSounds, entries: [{ ...fullSounds.entries[0], soundAudio: 'https://example.com/untrusted.mp3' }, ...fullSounds.entries.slice(1)] } }));
  await page.goto('/library/ipa');
  await page.getByRole('button', { name: '详细版', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('发音表或录音无法读取');
  await expect(page.locator('.ipa-entry')).toHaveCount(0);
});


test('an old installed English package remains usable when the new detailed catalogue is unavailable', async ({ page }) => {
  await page.route('**/ipa/full-sounds.json', route => route.fulfill({ status: 404, body: 'Missing new package' }));
  await page.goto('/library/ipa');
  await page.getByRole('button', { name: '详细版', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('发音表或录音无法读取');
  await expect(page.locator('.ipa-entry')).toHaveCount(0);
  await page.getByRole('button', { name: '简易版', exact: true }).click();
  await expect(page.locator('.ipa-entry')).toHaveCount(41);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.locator('audio').evaluate((audio: HTMLAudioElement) => { audio.muted = true; });
  await page.getByRole('button', { name: '听单词 see', exact: true }).click();
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime > 0 && !audio.error)).toBe(true);
});
