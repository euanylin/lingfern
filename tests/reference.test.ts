import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import chart from '../public/ipa/entries.json';
import fullAudio from '../public/ipa/full-sounds.json';
import grammar from '../public/grammar/entries.json';
import sources from '../content/ipa-audio-sources.json';
import phonemeSources from '../content/ipa-phoneme-sources.json';
import { ipaChartSchema, ipaSymbols, vowelColumns, vowelRows, consonantColumns, consonantRows, rhoticRows, diphthongRows } from '../src/app/ipaTables';

import { fullVowels, fullPlaces, fullConsonants, otherSymbols, affricates, nonPulmonic, diacritics, suprasegmentals, tones, englishVariants } from '../src/app/fullIpa';
import { fullIpaAudioSchema, fullIpaSoundSymbols } from '../src/app/ipaFullAudio';

describe('offline references', () => {
  it('provides a licensed local recording for all126independent sounds without changing the English inventory', () => {
    expect(fullIpaSoundSymbols).toHaveLength(126);
    expect(fullIpaAudioSchema.parse(fullAudio)).toEqual(fullAudio);
    expect(fullAudio.entries.map(entry => entry.ipa).sort()).toEqual([...fullIpaSoundSymbols].sort());
    expect(phonemeSources).toHaveLength(125);
    for (const entry of fullAudio.entries) {
      const source = phonemeSources.find(source => source.path === entry.soundAudio);
      expect(source?.ipa).toContain(entry.ipa);
      expect(source?.author.trim()).toBeTruthy();
      expect(source?.source).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(['CC BY-SA 3.0', 'CC BY-SA 4.0', 'CC0', 'Public domain']).toContain(source?.license);
      expect(createHash('sha256').update(readFileSync('public' + entry.soundAudio)).digest('hex')).toBe(source?.sha256);
    }
    for (const english of chart.entries) expect(fullAudio.entries.find(entry => entry.ipa === english.ipa)?.soundAudio).toBe(english.soundAudio);
    for (const [symbol] of [...diacritics, ...suprasegmentals, ...tones]) expect(fullAudio.entries.some(entry => entry.ipa === symbol)).toBe(false);
    const groups = new Map<string, string[]>();
    for (const entry of fullAudio.entries) {
      const hash = createHash('sha256').update(readFileSync('public' + entry.soundAudio)).digest('hex');
      groups.set(hash, [...(groups.get(hash) ?? []), entry.ipa]);
    }
    expect([...groups.values()].filter(symbols => symbols.length > 1)).toEqual([['ɝ', 'ɚ']]);
  });
  it('rejects incomplete, duplicated, unknown or unsafe full-chart recording catalogues', () => {
    for (const entries of [fullAudio.entries.slice(1), [...fullAudio.entries.slice(1), fullAudio.entries[1]], [{ ...fullAudio.entries[0], ipa: 'not-a-sound' }, ...fullAudio.entries.slice(1)]]) expect(fullIpaAudioSchema.safeParse({ ...fullAudio, entries }).success).toBe(false);
    for (const soundAudio of ['https://example.com/audio.mp3', '/ipa/phonemes/../sound-41.mp3', '/ipa/phonemes/sound-41.mp3?redirect=1']) expect(fullIpaAudioSchema.safeParse({ ...fullAudio, entries: [{ ...fullAudio.entries[0], soundAudio }, ...fullAudio.entries.slice(1)] }).success).toBe(false);
  });
  it('includes the full chart with exactly one placement for every installed English recording', () => {
    const vowels = fullVowels.flatMap(row => row.cells.flatMap(([, left, right]) => [left, right].filter(Boolean)));
    expect(vowels).toHaveLength(28);
    const consonants = fullConsonants.flatMap(([, ...cells]) => { expect(cells).toHaveLength(fullPlaces.length); return cells.flat().filter(symbol => symbol && symbol !== '—'); });
    expect(consonants).toHaveLength(59);
    expect(fullPlaces).toHaveLength(11);
    const symbols: (string | null)[] = [...vowels, ...consonants, ...otherSymbols.map(([s]) => s), ...affricates.map(([s]) => s), ...rhoticRows.flatMap(row => row.cells.flat()), ...diphthongRows.flatMap(row => row.cells.flat())];
    expect(new Set(symbols).size).toBe(symbols.length);
    expect(symbols.filter(symbol => ipaSymbols.includes(symbol!)).sort()).toEqual([...ipaSymbols].sort());
    expect(englishVariants.every(symbol => symbols.includes(symbol))).toBe(true);
    expect(nonPulmonic.flatMap(([, ...cells]) => cells.flat())).toHaveLength(14);
    expect(diacritics).toHaveLength(31); expect(suprasegmentals).toHaveLength(9); expect(tones).toHaveLength(14);
  });
  it('places exactly the existing English inventory on the IPA axes with correct pair slots', () => {
    expect(ipaSymbols).toHaveLength(41);
    expect(new Set(ipaSymbols).size).toBe(41);
    expect([...ipaSymbols].sort()).toEqual(chart.entries.map(entry => entry.ipa).sort());
    expect(ipaChartSchema.parse(chart)).toEqual(chart);
    for (const row of consonantRows) {
      expect(row.cells).toHaveLength(consonantColumns.length);
      for (const cell of row.cells) for (const [slot, symbol] of cell.entries()) if (symbol) {
        const entry = chart.entries.find(entry => entry.ipa === symbol)!;
        expect(entry.group).toBe('consonant');
        expect(entry.category).toBe(row.key === 'lateral-approximant' ? 'approximant' : row.key);
        expect(entry.voicing).toBe(slot === 0 ? 'voiceless' : 'voiced');
        if (cell[0] && cell[1]) expect(entry.pair).toBe(cell[1 - slot]);
      }
    }
    for (const row of vowelRows) {
      expect(row.cells).toHaveLength(vowelColumns.length);
      for (const cell of row.cells) for (const [slot, symbol] of cell.entries()) if (symbol) {
        expect(chart.entries.find(entry => entry.ipa === symbol)?.category).toBe('simple-vowel');
        expect(slot).toBe(['u', 'ʊ', 'ɔ'].includes(symbol) ? 1 : 0);
      }
    }
    expect(vowelRows.find(row => row.key === 'open-mid')!.cells[vowelColumns.indexOf('back')]).toEqual(['ʌ', 'ɔ']);
    expect(vowelRows.find(row => row.key === 'near-close')!.cells[vowelColumns.indexOf('near-front')]).toEqual(['ɪ', null]);
    expect(vowelRows.find(row => row.key === 'near-close')!.cells[vowelColumns.indexOf('near-back')]).toEqual([null, 'ʊ']);
    expect(consonantRows.find(row => row.key === 'lateral-approximant')!.cells[consonantColumns.indexOf('alveolar')]).toEqual([null, 'l']);
    expect(consonantRows.find(row => row.key === 'approximant')!.cells[consonantColumns.indexOf('labial-velar')]).toEqual([null, 'w']);
    expect(rhoticRows[0].cells).toEqual([['ɝ'], ['ɚ']]);
    expect(diphthongRows.find(row => row.key === 'open')!.cells).toEqual([['aɪ'], ['aʊ']]);
  });
  it('rejects missing, duplicate, non-English or unsafe chart data instead of silently omitting sounds', () => {
    for (const entries of [chart.entries.slice(1), [...chart.entries.slice(1), chart.entries[1]], [{ ...chart.entries[0], ipa: 'ɬ' }, ...chart.entries.slice(1)], [{ ...chart.entries[0], soundAudio: 'https://example.com/audio.mp3' }, ...chart.entries.slice(1)]]) expect(ipaChartSchema.safeParse({ ...chart, entries }).success).toBe(false);
  });
  it('provides separate licensed sound and word recordings, categories, and reciprocal voicing pairs', () => {
    expect(chart.entries).toHaveLength(41);
    expect(new Set(chart.entries.map(entry => entry.ipa)).size).toBe(chart.entries.length);
    expect(new Set(chart.entries.map(entry => entry.group))).toEqual(new Set(['vowel', 'consonant']));
    expect(new Set(chart.entries.map(entry => entry.category))).toEqual(new Set(['simple-vowel', 'rhotic-vowel', 'diphthong', 'stop', 'fricative', 'affricate', 'nasal', 'approximant']));
    for (const entry of chart.entries) {
      expect(entry.before + entry.bold + entry.after).toBe(entry.example);
      expect(entry.soundAudio).not.toBe(entry.audio);
      const source = sources.find(item => item.path === entry.audio);
      expect(source?.word).toBe(entry.example);
      expect(source?.license).toBe('CC BY-SA 3.0');
      expect(createHash('sha256').update(readFileSync('public' + entry.audio)).digest('hex')).toBe(source?.sha256);
      const soundSource = phonemeSources.find(item => item.path === entry.soundAudio);
      expect(soundSource?.ipa).toContain(entry.ipa);
      expect(['CC BY-SA 3.0', 'CC BY-SA 4.0', 'CC0', 'Public domain']).toContain(soundSource?.license);
      expect(createHash('sha256').update(readFileSync('public' + entry.soundAudio)).digest('hex')).toBe(soundSource?.sha256);
      if (entry.pair) expect(chart.entries.find(other => other.ipa === entry.pair)?.pair).toBe(entry.ipa);
    }
  });
  it('shares only the documented rhotic demo and identical example words, never different sound contrasts', () => {
    const groups = (kind: 'soundAudio' | 'audio') => {
      const hashes = new Map<string, typeof chart.entries>();
      for (const entry of chart.entries) {
        const hash = createHash('sha256').update(readFileSync('public' + entry[kind])).digest('hex');
        hashes.set(hash, [...(hashes.get(hash) ?? []), entry]);
      }
      return [...hashes.values()].filter(entries => entries.length > 1);
    };
    expect(groups('soundAudio').map(entries => entries.map(entry => entry.ipa))).toEqual([['ɝ', 'ɚ']]);
    const words = groups('audio');
    expect(words.map(entries => entries.map(entry => entry.ipa))).toEqual([['ɑ', 'ɚ'], ['oʊ', 'ɡ']]);
    for (const entries of words) expect(new Set(entries.map(entry => entry.example)).size).toBe(1);
    expect(JSON.parse(readFileSync('public/ipa/PHONEME_SOURCES.json', 'utf8'))).toEqual(phonemeSources);
    expect(JSON.parse(readFileSync('public/ipa/SOURCES.json', 'utf8'))).toEqual(sources);
  });
  it('has searchable multilingual question-led usage entries without unsupported CEFR labels', () => {
    expect(grammar.entries).toHaveLength(68);
    expect(grammar.entries.every(entry => !('level' in entry))).toBe(true);
    expect(new Set(grammar.entries.map(entry => entry.id)).size).toBe(grammar.entries.length);
    for (const entry of grammar.entries) for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
      expect(entry.title[locale].length).toBeGreaterThan(0);
      expect(entry.question[locale].length).toBeGreaterThan(0);
      expect(entry.summary[locale].length).toBeGreaterThan(0);
      expect(entry.usage[locale].length).toBeGreaterThan(40);
      expect(entry.pitfall[locale].length).toBeGreaterThan(15);
    }
    for (const entry of grammar.entries) {
      expect(entry.contrast.length).toBeGreaterThan(0);
      expect(entry.examples.length).toBeGreaterThanOrEqual(3);
      expect(new Set(entry.examples).size).toBe(entry.examples.length);
      for (const related of entry.related) expect(grammar.entries.some(other => other.id === related)).toBe(true);
    }
  });
});
