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
  const now = page.getByRole('button', { name: '听音标 /aʊ/', exact: true });
  await now.click();
  await page.getByRole('button', { name: '听音标 /i/', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '听音标 /i/', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '听音标 /i/', exact: true }).click();
  await expect(page.locator('.ipa-entry button[aria-pressed=true]')).toHaveCount(0);
  expect(await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);
});

test('IPA playback clears an external pause and restarts with one click', async ({ page }) => {
  await page.goto('/library/ipa');
  const now = page.getByRole('button', { name: '听音标 /aʊ/', exact: true });
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
  await page.getByRole('button', { name: '听音标 /aʊ/', exact: true }).click();
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
  for (const symbol of ['i', 'ɪ', 'ɛ', 'æ', 'ɑ', 'ɔ', 'ʊ', 'u', 'ʌ', 'ə']) await expect(chart.locator(`[data-ipa="${symbol}"] .ipa-english-circle`)).toHaveCount(1);
  for (const symbol of ['ɒ', 'ɜ']) await expect(chart.locator(`[data-ipa="${symbol}"] .ipa-english-variant`)).toHaveCount(1);
  await expect(chart.locator('[data-ipa="y"] .ipa-english-circle, [data-ipa="y"] .ipa-english-variant')).toHaveCount(0);
  await chart.evaluate(element => Promise.allSettled(element.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished)));
  for (const fontSize of ['100%', '200%']) {
    await page.evaluate(value => document.documentElement.style.fontSize = value, fontSize);
    await expect.poll(() => chart.evaluate(el => {
      const bounds = el.getBoundingClientRect();
      return el.scrollWidth <= el.clientWidth + 1
        && [...el.querySelectorAll('.ipa-vowel-columns span')].every(label => {
          const box = label.getBoundingClientRect();
          return box.left >= bounds.left - 1 && box.right <= bounds.right + 1;
        })
        && [...el.querySelectorAll('button')].every(button => button.getBoundingClientRect().bottom <= bounds.bottom + 1);
    })).toBe(true);
    const geometry = await chart.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      const buttons = [...element.querySelectorAll('button')].map(button => ({ name: button.getAttribute('aria-label'), box: button.getBoundingClientRect(), font: parseFloat(getComputedStyle(button).fontSize) }));
      return {
        fitted: element.scrollWidth <= element.clientWidth + 1,
        labels: [...element.querySelectorAll('.ipa-vowel-columns span')].every(label => {
          const box = label.getBoundingClientRect();
          return box.left >= bounds.left - 1 && box.right <= bounds.right + 1;
        }),
        small: buttons.filter(button => button.font < 16).map(button => button.name),
        clipped: buttons.filter(({ box }) => box.top < bounds.top + element.clientTop - 1 || box.bottom > bounds.top + element.clientTop + element.clientHeight + 1 || box.left < bounds.left - 1 || box.right > bounds.right + 1).map(button => button.name),
        overlaps: buttons.flatMap((a, index) => buttons.slice(index + 1).filter(b => Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left) > .5 && Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top) > .5).map(b => [a.name, b.name])),
      };
    });
    expect.soft(geometry, `${fontSize} vowel control bounds`).toEqual({ fitted: true, labels: true, small: [], clipped: [], overlaps: [] });
    expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.evaluate(() => document.documentElement.style.fontSize = '100%');
  const alignment = await chart.locator('.ipa-vowel-body').evaluate(element => {
    const svg = element.querySelector('svg')!.getBoundingClientRect();
    const drift = (symbol: string, x: number, y: number) => {
      const pair = element.querySelector(`[data-ipa="${symbol}"]`)!.closest('.ipa-vowel-pair')!.getBoundingClientRect();
      return Math.hypot(pair.left + pair.width / 2 - (svg.left + svg.width * x / 100), pair.top + pair.height / 2 - (svg.top + svg.height * y / 100));
    };
    return { fills: Math.abs(svg.width - (element.clientWidth - 16)) < 2 && Math.abs(svg.height - (element.clientHeight - 24)) < 2, i: drift('i', 10, 8), a: drift('a', 49, 92), u: drift('u', 91, 8) };
  });
  expect(alignment.fills, 'vowel trapezoid fills the symbol area').toBe(true);
  expect(alignment.i, 'close front sits on the slope').toBeLessThan(2);
  expect(alignment.a, 'open front sits on the slope').toBeLessThan(2);
  expect(alignment.u, 'close back sits on the back line').toBeLessThan(2);
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
  const word = chart.getByRole('button', { name: 'Play sound /ɪ/', exact: true });
  await word.scrollIntoViewIfNeeded();
  expect.soft(await word.evaluate(button => {
    const box = button.getBoundingClientRect();
    return button.contains(document.elementFromPoint(box.left + box.width / 2, box.bottom - 2));
  })).toBe(true);
  await page.locator('audio').evaluate((audio: HTMLAudioElement) => { audio.muted = true; audio.loop = true; });
  await page.keyboard.press('Tab');
  await word.focus();
  await expect(word).toBeFocused();
  await expect(word.locator('span')).toHaveCSS('box-shadow', /inset/);
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
  await expect(page.locator('.ipa-table')).toHaveCount(3);
  await expect(page.locator('.ipa-group > h2')).toHaveText(['Vowels', 'Consonants (pulmonic)', 'Consonants (non-pulmonic)', 'Other symbols', 'Affricates (examples)', 'Diacritics', 'Suprasegmentals', 'Tones and word accents']);
  await expect(page.locator('#ipa-pulmonic')).toHaveText('Consonants (pulmonic)');
  await expect(page.locator('.ipa-table-consonants').locator('..')).toHaveAttribute('aria-labelledby', 'ipa-pulmonic');
  expect(await page.locator('.ipa-group').evaluateAll(groups => groups.every(group => group.getAttribute('lang') === 'en' && group.getAttribute('dir') === 'ltr'))).toBe(true);
  expect(await page.locator('.ipa-table-consonants thead th').evaluateAll(nodes => nodes.map(node => (node.textContent ?? '').replaceAll('-', '')))).toEqual(['', ...fullPlaces]);
  for (const table of ['.ipa-table-rhotic', '.ipa-table-diphthongs']) expect(await page.locator(`${table} thead th`).first().textContent()).toBe('');
  expect(await page.locator('.ipa-entry').evaluateAll(entries => entries.map(entry => entry.getAttribute('data-ipa')).sort())).toEqual(fullSounds.entries.map((entry: { ipa: string }) => entry.ipa).sort());
  await expect(page.locator('.ipa-table-consonants tr[data-row=lateral-approximant] [data-column=alveolar] .ipa-entry')).toHaveAttribute('data-ipa', 'l');
  const rowLines = async (selector: string) => (await page.locator(selector).innerText()).split('\n').map(line => line.trim()).filter(Boolean);
  expect(await rowLines('.ipa-table-consonants tr[data-row="tap-or-flap"] th')).toEqual(['Tap', 'or', 'Flap']);
  expect(await rowLines('.ipa-table-consonants tr[data-row="lateral-approximant"] th')).toEqual(['Lateral', 'approximant']);
  expect(await page.locator('.ipa-airstream').evaluateAll(columns => columns.map(column => [column.querySelector('h3')!.textContent, ...[...column.querySelectorAll('.ipa-airstream-row')].map(row => `${row.querySelector('[data-ipa]')!.getAttribute('data-ipa')} ${row.querySelector(':scope > span')!.textContent}`)]))).toEqual([
    ['Clicks', 'ʘ Bilabial', 'ǀ Dental', 'ǃ (Post)alveolar', 'ǂ Palatoalveolar', 'ǁ Alveolar lateral'],
    ['Voiced implosives', 'ɓ Bilabial', 'ɗ Dental/alveolar', 'ʄ Palatal', 'ɠ Velar', 'ʛ Uvular'],
    ['Ejectives', 'pʼ Bilabial', 'tʼ Dental/alveolar', 'kʼ Velar', 'sʼ Alveolar fricative'],
  ]);
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
    const marks = page.getByRole('button', { name: languagePacks[locale].ipaChart.englishMarks, exact: true });
    await expect(marks).toHaveAttribute('aria-pressed', 'true');
    expect(await marks.evaluate(button => { const box = button.getBoundingClientRect(); return box.width >= 44 && box.height >= 44 && getComputedStyle(button).transform === 'none'; })).toBe(true);
    await expect.poll(() => page.locator('.ipa-vowel-scroll').evaluate(el => {
      const bounds = el.getBoundingClientRect();
      return el.scrollWidth <= el.clientWidth + 1 && [...el.querySelectorAll('.ipa-vowel-columns span')].every(label => {
        const box = label.getBoundingClientRect();
        return box.left >= bounds.left - 1 && box.right <= bounds.right + 1;
      });
    })).toBe(true);
    expect(await page.locator('.ipa-symbol-item .ipa-entry button').evaluateAll(buttons => buttons.length > 0 && buttons.every(button => { const box = button.getBoundingClientRect(); return box.width >= 44 && box.height >= 44; }))).toBe(true);
    expect(await page.locator('.ipa-table-scroll .ipa-entry button, .ipa-vowel-scroll .ipa-entry button').evaluateAll(buttons => buttons.length > 0 && buttons.every(button => parseFloat(getComputedStyle(button).fontSize) >= 16))).toBe(true);
    expect(await page.locator('.ipa-entry button').count()).toBe(126);
    await expect(page.locator('.ipa-entry .playback-icon')).toHaveCount(0);
    const headings = await page.locator('.ipa-table-consonants thead th').evaluateAll(nodes => nodes.slice(1).map(node => {
      const heading = node as HTMLElement;
      return { plain: (heading.textContent ?? '').replaceAll('-', ''), lines: heading.innerText.split('\n').map(line => line.trim()).filter(Boolean) };
    }));
    const breaks: Record<string, string[]> = { Labiodental: ['Labio-', 'dental'], Postalveolar: ['Post-', 'alveolar'], Retroflex: ['Retro-', 'flex'], Pharyngeal: ['Pharyng-', 'eal'] };
    for (const heading of headings) expect(heading.lines).toEqual(breaks[heading.plain] ?? [heading.plain]);
    expect(headings.find(heading => heading.plain === 'Bilabial')?.lines).toEqual(['Bilabial']);
    expect(headings.find(heading => heading.plain === 'Alveolar')?.lines).toEqual(['Alveolar']);
    expect(await page.locator('.ipa-table-consonants .ipa-english-circle, .ipa-table-consonants .ipa-english-variant').evaluateAll(circles => circles.filter(circle => {
      const cell = circle.closest('td')!.getBoundingClientRect(), box = circle.getBoundingClientRect();
      return box.left < cell.left - 1 || box.right > cell.right + 1 || box.top < cell.top - 1 || box.bottom > cell.bottom + 1;
    }).map(circle => circle.textContent))).toEqual([]);
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
  await page.getByRole('button', { name: `${t.sound} /w/`, exact: true }).click();
  await expect(page.locator('.ipa-entry[data-ipa=w] .ipa-symbol')).toHaveAttribute('aria-pressed', 'false');
  expect(await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);
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


test('every independent IPA sound plays from its symbol, records history and has no separate play icon', async ({ page, baseURL }) => {
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
  await expect(page.locator('.ipa-entry .ipa-word, .ipa-entry .playback-icon')).toHaveCount(0);
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

test('detailed English circle switch hides and restores marks without moving symbols', async ({ page }) => {
  await page.goto('/library/ipa');
  await expect(page.getByRole('button', { name: '英语', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '详细版', exact: true }).click();
  const toggle = page.getByRole('button', { name: '英语', exact: true });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.ipa-scope')).toContainText('Solid circles mark General American sounds');
  await expect(page.locator('.ipa-english-circle')).toHaveCount(41);
  await expect(page.locator('.ipa-english-variant')).toHaveCount(5);
  const vowel = page.locator('.ipa-vowel-pair [data-ipa="i"] button');
  const place = () => vowel.evaluate(button => {
    const chart = button.closest('.ipa-vowel-scroll')!.getBoundingClientRect(), box = button.getBoundingClientRect();
    return { x: Math.round(box.x - chart.x), y: Math.round(box.y - chart.y), width: Math.round(box.width), height: Math.round(box.height) };
  });
  const before = await place();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.ipa-english-circle, .ipa-english-variant')).toHaveCount(0);
  await expect(page.locator('.ipa-vowel-pair [data-ipa="ɒ"] span')).not.toHaveAttribute('title', /variant/);
  await expect(page.locator('.ipa-scope')).not.toContainText('Solid circles');
  expect(await place()).toEqual(before);
  await page.getByRole('button', { name: '简易版', exact: true }).click();
  await expect(page.getByRole('button', { name: '英语', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '详细版', exact: true }).click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.ipa-english-circle, .ipa-english-variant')).toHaveCount(0);
  await toggle.click();
  await expect(page.locator('.ipa-english-circle')).toHaveCount(41);
  await expect(page.locator('.ipa-english-variant')).toHaveCount(5);
});

test('an unsafe full-chart catalogue fails visibly instead of showing a partially playable chart', async ({ page }) => {
  await page.route('**/ipa/full-sounds.json', route => route.fulfill({ json: { ...fullSounds, entries: [{ ...fullSounds.entries[0], soundAudio: 'https://example.com/untrusted.mp3' }, ...fullSounds.entries.slice(1)] } }));
  await page.goto('/library/ipa');
  await page.getByRole('button', { name: '详细版', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('发音表或录音无法读取');
  await expect(page.locator('.ipa-entry')).toHaveCount(0);
});


test('an old installed English package remains usable when the new detailed catalogue is unavailable', async ({ page }) => {
  const englishReady = Promise.withResolvers<void>();
  await page.route('**/ipa/entries.json', async route => {
    await englishReady.promise;
    await route.fulfill({ json: chart });
  });
  await page.route('**/ipa/full-sounds.json', route => route.fulfill({ status: 404, body: 'Missing new package' }));
  await page.goto('/library/ipa');
  await page.getByRole('button', { name: '详细版', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('发音表或录音无法读取');
  await expect(page.locator('.ipa-entry')).toHaveCount(0);
  await page.getByRole('button', { name: '简易版', exact: true }).click();
  await expect(page.getByRole('status')).toBeVisible();
  englishReady.resolve();
  await expect(page.locator('.ipa-entry')).toHaveCount(41);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.locator('audio').evaluate((audio: HTMLAudioElement) => { audio.muted = true; });
  await page.getByRole('button', { name: '听音标 /i/', exact: true }).click();
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime > 0 && !audio.error)).toBe(true);
});

test('pressed feedback fills every detailed symbol and follows each example word', async ({ page }) => {
  await page.goto('/library/ipa');
  await page.locator('audio').evaluate((audio: HTMLAudioElement) => { audio.muted = true; audio.loop = true; });
  const word = page.getByRole('button', { name: '听单词 cup', exact: true });
  await word.click();
  expect(await word.evaluate(button => {
    const span = button.querySelector('span')!;
    const mark = span.getBoundingClientRect().width;
    return getComputedStyle(button).backgroundColor === 'rgba(0, 0, 0, 0)' && getComputedStyle(span).backgroundColor !== 'rgba(0, 0, 0, 0)' && mark < 64;
  })).toBe(true);
  await page.getByRole('button', { name: '详细版', exact: true }).click();
  for (const selector of ['.ipa-table-consonants [data-ipa="ɬ"] button', '.ipa-vowel-pair [data-ipa="y"] button', '.ipa-symbol-item [data-ipa="ɥ"] button', '.ipa-airstream [data-ipa="ɓ"] button']) {
    const button = page.locator(selector);
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(await button.evaluate(element => {
      const span = element.querySelector('span')!;
      const mark = span.getBoundingClientRect();
      const radius = getComputedStyle(span).borderTopLeftRadius;
      const vowel = !!element.closest('.ipa-vowel-pair');
      const reference = document.querySelector(vowel ? '.ipa-vowel-pair [data-ipa="i"] .ipa-english-circle' : '.ipa-table-consonants [data-ipa="p"] .ipa-english-circle')!.getBoundingClientRect();
      return getComputedStyle(element).backgroundColor === 'rgba(0, 0, 0, 0)'
        && getComputedStyle(span).backgroundColor !== 'rgba(0, 0, 0, 0)'
        && Math.abs(mark.width - mark.height) <= 1
        && (radius.endsWith('%') ? Math.abs(parseFloat(radius) - 50) <= 0.1 : Math.abs(parseFloat(radius) - mark.width / 2) <= 1)
        && Math.abs(mark.width - reference.width) <= 1
        && Math.abs(mark.height - reference.height) <= 1;
    }), selector).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const other = page.locator('.ipa-cols-other .ipa-symbol-item');
  const otherLeft = await other.evaluateAll(items => items.map(item => Math.round(item.getBoundingClientRect().left)));
  expect(otherLeft[0]).toBe(otherLeft[1]);
  expect(otherLeft[6]).toBeGreaterThan(otherLeft[0]);
  await expect(other.nth(0).locator('> span').last()).toHaveText('Voiceless labial-velar fricative');
  await expect(other.nth(6).locator('> span').last()).toHaveText('Alveolo-palatal fricatives');
  const diacriticLeft = await page.locator('.ipa-cols-3 .ipa-symbol-item').evaluateAll(items => [0, 1, 11].map(index => Math.round(items[index].getBoundingClientRect().left)));
  expect(diacriticLeft[0]).toBe(diacriticLeft[1]);
  expect(diacriticLeft[2]).toBeGreaterThan(diacriticLeft[0]);
  const toneLayout = () => page.locator('.ipa-tone-columns').evaluate(element => {
    const [level, contour] = [...element.children];
    const box = (node: Element) => node.getBoundingClientRect();
    const levelBox = box(level), contourBox = box(contour);
    const levelHead = box(level.querySelector('.ipa-tone-head')!), contourHead = box(contour.querySelector('.ipa-tone-head')!);
    const firstLevel = box(level.querySelector('.ipa-symbol-item')!), firstContour = box(contour.querySelector('.ipa-symbol-item')!);
    return {
      sideBySide: contourBox.left > levelBox.right - 1 && Math.abs(contourBox.top - levelBox.top) <= 1,
      stacked: contourBox.top >= levelBox.bottom - 1 && Math.abs(contourBox.left - levelBox.left) <= 1,
      levelOwns: firstLevel.top >= levelHead.bottom - 1 && Math.abs(firstLevel.left - levelHead.left) <= 1,
      contourOwns: firstContour.top >= contourHead.bottom - 1 && Math.abs(firstContour.left - contourHead.left) <= 1,
    };
  });
  await expect(page.locator('.ipa-tone-columns > div').nth(0).locator('.ipa-symbol-item').first().locator('> span').last()).toHaveText('Extra high');
  await expect(page.locator('.ipa-tone-columns > div').nth(1).locator('.ipa-symbol-item').first().locator('> span').last()).toHaveText('Rising');
  expect(await toneLayout()).toEqual({ sideBySide: true, stacked: false, levelOwns: true, contourOwns: true });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await toneLayout()).toEqual({ sideBySide: false, stacked: true, levelOwns: true, contourOwns: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('touch feedback matches the playback mark and the English circle control', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/library/ipa');
  const paint = (selector: string) => page.locator(selector).evaluate(button => {
    const span = button.querySelector(':scope > span')!;
    const mark = span.getBoundingClientRect();
    const control = button.getBoundingClientRect();
    const radius = getComputedStyle(span).borderTopLeftRadius;
    return {
      buttonBackground: getComputedStyle(button).backgroundColor,
      buttonColor: getComputedStyle(button).color,
      markBackground: getComputedStyle(span).backgroundColor,
      markWidth: Math.round(mark.width),
      markHeight: Math.round(mark.height),
      controlWidth: Math.round(control.width),
      controlHeight: Math.round(control.height),
      radius,
    };
  });
  const word = page.getByRole('button', { name: '听单词 see', exact: true });
  await word.click();
  const playedWord = await paint('.ipa-entry[data-ipa="i"] .ipa-word');
  await word.click();
  await word.evaluate(button => button.setAttribute('data-touch-active', ''));
  const touchedWord = await paint('.ipa-entry[data-ipa="i"] .ipa-word');
  expect(touchedWord.buttonBackground).toBe('rgba(0, 0, 0, 0)');
  expect(touchedWord.markBackground).toBe(playedWord.markBackground);
  expect(touchedWord.markWidth).toBe(playedWord.markWidth);
  expect(touchedWord.markHeight).toBe(playedWord.markHeight);
  expect(touchedWord.radius).toBe(playedWord.radius);
  expect(touchedWord.markWidth).toBeLessThan(touchedWord.controlWidth);
  const symbol = page.getByRole('button', { name: '听音标 /ɪ/', exact: true });
  await symbol.click();
  const playedSymbol = await paint('.ipa-entry[data-ipa="ɪ"] .ipa-symbol');
  await symbol.click();
  await symbol.evaluate(button => button.setAttribute('data-touch-active', ''));
  const touchedSymbol = await paint('.ipa-entry[data-ipa="ɪ"] .ipa-symbol');
  expect(touchedSymbol).toEqual(playedSymbol);
  await page.getByRole('button', { name: '详细版', exact: true }).click();
  const toggle = page.getByRole('button', { name: '英语', exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  const off = await paint('button.ipa-english-marks');
  await toggle.evaluate(button => button.setAttribute('data-touch-active', ''));
  const touchedToggle = await paint('button.ipa-english-marks');
  await toggle.evaluate(button => button.removeAttribute('data-touch-active'));
  await toggle.click();
  const on = await paint('button.ipa-english-marks');
  expect(off.markBackground).toBe('rgba(0, 0, 0, 0)');
  expect(touchedToggle.buttonBackground).toBe('rgba(0, 0, 0, 0)');
  expect(touchedToggle.buttonColor).toBe(on.buttonColor);
  expect(touchedToggle.markBackground).toBe(touchedToggle.buttonColor);
  expect(on.markBackground).toBe(on.buttonColor);
  expect(touchedToggle.markWidth).toBe(on.markWidth);
  expect(touchedToggle.markHeight).toBe(on.markHeight);
  expect(touchedToggle.radius).toBe('50%');
  expect(touchedToggle.markWidth).toBeLessThan(touchedToggle.controlWidth);
  const consonant = page.locator('.ipa-table-consonants [data-ipa="p"] button');
  await consonant.click();
  const playedConsonant = await paint('.ipa-table-consonants [data-ipa="p"] button');
  await consonant.click();
  await consonant.evaluate(button => button.setAttribute('data-touch-active', ''));
  const touchedConsonant = await paint('.ipa-table-consonants [data-ipa="p"] button');
  const englishCircle = await page.locator('.ipa-table-consonants [data-ipa="p"] .ipa-english-circle').evaluate(mark => {
    const box = mark.getBoundingClientRect();
    return { width: Math.round(box.width), height: Math.round(box.height), radius: getComputedStyle(mark).borderTopLeftRadius };
  });
  expect(touchedConsonant.buttonBackground).toBe('rgba(0, 0, 0, 0)');
  expect(touchedConsonant.markBackground).toBe(playedConsonant.markBackground);
  expect(touchedConsonant.markWidth).toBe(playedConsonant.markWidth);
  expect(touchedConsonant.markHeight).toBe(playedConsonant.markHeight);
  expect(touchedConsonant.radius).toBe(playedConsonant.radius);
  expect(touchedConsonant.markWidth).toBe(englishCircle.width);
  expect(touchedConsonant.markHeight).toBe(englishCircle.height);
  expect(touchedConsonant.markWidth).toBeLessThan(touchedConsonant.controlWidth);
});
