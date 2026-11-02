import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { languagePacks } from '../../src/locales';
import { fullPlaces } from '../../src/app/fullIpa';
import { officialIpaChart } from '../../src/app/ipaTables';
import { selectPicker } from './picker';

const chart = JSON.parse(readFileSync('public/ipa/entries.json', 'utf8'));
const fullSounds = JSON.parse(readFileSync('public/ipa/full-sounds.json', 'utf8'));
test('IPA playback ignores superseded requests and the active button stops playback', async ({ page }) => {
  await page.goto('/library/ipa');
  await expect(page.locator('.ipa-entry')).toHaveCount(41);
  await page.evaluate(() => {
    const audio = document.querySelector('audio')!;
    let rejectPrevious: ((reason: Error) => void) | undefined;
    audio.play = () => new Promise<void>((resolve, reject) => {
      if (rejectPrevious) { rejectPrevious(new DOMException('Superseded', 'AbortError')); resolve(); }
      rejectPrevious = reject;
    });
  });
  const now = page.getByRole('button', { name: /now$/, exact: false });
  await now.click();
  await page.getByRole('button', { name: /see$/, exact: false }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /see$/, exact: false })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /see$/, exact: false }).click();
  await expect(page.locator('.ipa-entry button[aria-pressed=true]')).toHaveCount(0);
  expect(await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);
});

test('IPA playback clears an external pause and restarts with one click', async ({ page }) => {
  await page.goto('/library/ipa');
  const now = page.getByRole('button', { name: /now$/ });
  await page.locator('audio').evaluate((audio: HTMLAudioElement) => { audio.muted = true; audio.loop = true; });
  await now.click();
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(.1);
  await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.pause());
  await expect(now).toHaveAttribute('aria-pressed', 'false');
  await now.click();
  await expect(now).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(false);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('now retains audible onset headroom and plays from the beginning through native completion', async ({ page }) => {
  await page.goto('/library/ipa');
  await expect(page.locator('.ipa-entry')).toHaveCount(41);
  const timing = await page.evaluate(async () => {
    const context = new AudioContext();
    try {
      const buffer = await context.decodeAudioData(await (await fetch('/ipa/audio/v2/now.mp3')).arrayBuffer());
      const samples = buffer.getChannelData(0), window = Math.floor(buffer.sampleRate * .01);
      for (let index = 0; index < samples.length; index += window) {
        const segment = samples.subarray(index, index + window);
        if (Math.sqrt(segment.reduce((sum, value) => sum + value * value, 0) / segment.length) > 10 ** (-45 / 20)) return { onset: index / buffer.sampleRate, duration: buffer.duration };
      }
      throw new Error('Silent recording');
    } finally { await context.close(); }
  });
  expect(timing.onset).toBeGreaterThanOrEqual(.25);
  expect(timing.duration - timing.onset).toBeGreaterThan(.35);
  await page.locator('audio').evaluate((audio: HTMLAudioElement) => { audio.muted = true; });
  await page.getByRole('button', { name: /now$/, exact: false }).click();
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.ended && audio.played.length > 0 && audio.played.start(0) < .05 && audio.played.end(0) >= audio.duration - .05)).toBe(true);
  await expect(page.locator('.ipa-entry button[aria-pressed=true]')).toHaveCount(0);
});
test('compound tone accents remain legible without platform font support', async ({ page }) => {
  await page.goto('/library/ipa');
  await page.getByRole('button', { name: '详细版', exact: true }).click();
  const section = page.locator('.ipa-group').filter({ has: page.getByRole('heading', { name: 'Tones and word accents', exact: true }) });
  for (const [symbol, description] of [['e᷄ ˧˥', 'High rising'], ['e᷅ ˩˧', 'Low rising'], ['e᷈ ˦˥˦', 'Rising–falling']]) {
    const row = section.locator('.ipa-symbol-item').filter({ has: page.getByText(description, { exact: true }) });
    await expect(row.locator('.sr-only')).toHaveText(symbol);
    await expect(row.locator('.ipa-compound-tone')).toHaveText('e');
    await expect(row.locator('.ipa-compound-tone svg path')).toHaveCount(1);
    await expect(row.locator('[aria-hidden=true]')).toHaveText('e');
    await expect(row.locator('.ipa-tone-letter polyline')).toHaveAttribute('points', description === 'High rising' ? '2,12 8,2' : description === 'Low rising' ? '2,22 8,12' : '2,7 8,2 14,7');
  }
  await expect(section.locator('.ipa-tone-letter')).toHaveCount(10);
  for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: 812 });
    await section.scrollIntoViewIfNeeded();
    expect(await section.locator('.ipa-compound-tone svg').evaluateAll(marks => marks.every(mark => {
      const box = mark.getBoundingClientRect(), row = mark.closest('.ipa-symbol-item')!.getBoundingClientRect();
      return box.width > 10 && box.height > 6 && box.top >= row.top && box.bottom < row.bottom;
    }))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await section.screenshot({ path: `output/playwright/ipa-tones-${width}.png` });
  }
});

for (const [width, theme] of [[1440, 'dark'], [375, 'light']] as const) test(`vowel chart keeps its central line and complete button feedback at ${width}/${theme}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ colorScheme: theme });
  await page.goto('/library/ipa');
  await page.getByRole('button', { name: '详细版', exact: true }).click();
  const chart = page.locator('.ipa-vowel-scroll');
  await expect(chart).toBeVisible();
  await chart.evaluate(element => Promise.allSettled(element.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished)));
  for (const fontSize of ['100%', '200%']) {
    await page.evaluate(value => document.documentElement.style.fontSize = value, fontSize);
    const geometry = await chart.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      const buttons = [...element.querySelectorAll('button')].map(button => ({ name: button.getAttribute('aria-label'), box: button.getBoundingClientRect() }));
      return {
        small: buttons.filter(({ box }) => box.width < 44 || box.height < 44).map(button => button.name),
        clipped: buttons.filter(({ box }) => box.top < bounds.top + element.clientTop || box.bottom > bounds.top + element.clientTop + element.clientHeight).map(button => button.name),
        overlaps: buttons.flatMap((a, index) => buttons.slice(index + 1).filter(b => Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left) > .5 && Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top) > .5).map(b => [a.name, b.name])),
      };
    });
    expect.soft(geometry, `${fontSize} vowel control bounds`).toEqual({ small: [], clipped: [], overlaps: [] });
    expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.evaluate(() => document.documentElement.style.fontSize = '100%');
  for (const symbol of ['ɪ', 'ə']) {
    await chart.locator(`[data-ipa="${symbol}"]`).scrollIntoViewIfNeeded();
    const line = await chart.locator('.ipa-vowel-body').evaluate((element, symbol) => {
      const svg = element.querySelector('svg')!, bounds = svg.getBoundingClientRect();
      // Include the front slope beside sit, which crosses its button on compressed charts.
      return (symbol === 'ɪ' ? [22, 26, 30] : [50, 55]).map(y => {
        const x = symbol === 'ɪ' ? 10 + (y - 8) * 39 / 84 : 51 + (y - 8) * 20 / 84;
        const stack = document.elementsFromPoint(bounds.left + bounds.width * x / 100, bounds.top + bounds.height * y / 100);
        const lineIndex = stack.indexOf(svg);
        return lineIndex >= 0 && stack.slice(0, lineIndex).every(layer => getComputedStyle(layer).backgroundColor === 'rgba(0, 0, 0, 0)');
      });
    }, symbol);
    expect.soft(line).toEqual(symbol === 'ɪ' ? [true, true, true] : [true, true]);
  }
  const word = chart.getByRole('button', { name: 'Play word sit', exact: true });
  await word.scrollIntoViewIfNeeded();
  expect.soft(await word.evaluate(button => {
    const box = button.getBoundingClientRect();
    return button.contains(document.elementFromPoint(box.left + box.width / 2, box.bottom - 2));
  })).toBe(true);
  await page.locator('audio').evaluate((audio: HTMLAudioElement) => { audio.muted = true; audio.loop = true; });
  await page.keyboard.press('Tab');
  await word.focus();
  await expect(word).toBeFocused();
  await expect(word).toHaveCSS('box-shadow', /inset/);
  await word.press('Enter');
  await expect(word).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime > 0 && !audio.paused)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`vowel-feedback-${width}-${theme}.png`) });
  await word.press('Enter');
  await expect(word).toHaveAttribute('aria-pressed', 'false');
  expect(await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);
});

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
  // Measure 44px targets after finite entrance translations have settled.
  await page.locator('.ipa-page').evaluate(element => Promise.allSettled(element.getAnimations({ subtree: true }).filter(animation => animation instanceof CSSAnimation && animation.animationName === 'content-in' && animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished)));
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
  // Observe pressed state during short clips, then verify native completion.
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


test('every independent IPA sound plays locally, records history and retains the existing English word controls', async ({ page, baseURL }) => {
  test.setTimeout(120_000);
  const external: string[] = [];
  page.on('request', request => { if (new URL(request.url()).origin !== new URL(baseURL!).origin) external.push(request.url()); });
  await page.goto('/library/ipa');
  await page.getByRole('button', { name: '详细版', exact: true }).click();
  await expect(page.locator('.ipa-entry')).toHaveCount(126);
  const audio = page.locator('audio');
  await audio.evaluate((element: HTMLAudioElement) => { element.muted = true; });
  for (const entry of fullSounds.entries as { ipa: string; soundAudio: string }[]) {
    await page.getByRole('button', { name: `Play sound /${entry.ipa}/`, exact: true }).click();
    await expect(audio).toHaveAttribute('src', entry.soundAudio);
    await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime > 0 && element.duration > 0 && !element.error), { message: `Native playback /${entry.ipa}/ (${entry.soundAudio})` }).toBe(true);
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
