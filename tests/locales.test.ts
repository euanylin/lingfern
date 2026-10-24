import { beforeAll, describe, expect, it } from 'vitest';
import { aboutCopy } from '../src/app/aboutCopy';
import { languagePacks, languageOptions, messages, contentText, contentLanguage } from '../src/locales';
import { browserLocale, localeSchema, localeDirection } from '../src/shared/locale';
import { practiceLocale } from '../src/shared/content';
import { syncSettingSchema } from '../src/shared/sync';

function leaves(value: unknown, prefix = ''): Record<string, string> {
  if (typeof value === 'string') return { [prefix]: value };
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => Object.entries(leaves(item, `${prefix}.${key}`))));
}
const slots = (text: string) => [...text.matchAll(/\{\w+\}/g)].map(match => match[0]).sort();
describe('independent language packages', () => {
  const source = leaves(languagePacks.en);
  it('lists all language choices in English alphabetical order without changing locale defaults', () => {
    expect(languageOptions.map(option => option.value)).toEqual(['ar', 'zh-Hans', 'zh-Hant', 'en', 'fr', 'de', 'hi', 'id', 'it', 'ja', 'ko', 'pt', 'ru', 'es']);
    expect(localeSchema.options.slice(0, 3)).toEqual(['zh-Hans', 'zh-Hant', 'en']);
  });
  for (const locale of localeSchema.options) it(`${locale} keeps every key and interpolation slot`, () => {
    const translated = leaves(languagePacks[locale]);
    expect(Object.keys(translated).sort()).toEqual(Object.keys(source).sort());
    for (const [key, value] of Object.entries(translated)) {
      expect(value.trim(), key).not.toBe('');
      expect(slots(value), key).toEqual(slots(source[key]));
    }
    expect(languageOptions.find(item => item.value === locale)?.label).toBe(languagePacks[locale].meta.nativeName);
  });
  it('interpolates counts without treating parameters as executable replacements', () => {
    const value = messages('practiceCard', { p0: 2, p1: 7 });
    expect(value.en.progress).toBe('2/7 answered');
    expect(value.ja.progress).toContain('2/7');
    expect(messages('additional', { reading: '$&', listening: '{tests}' }).en.activity).toContain('$&');
  });
  it('negotiates regional browser languages with an English fallback', () => {
    for (const [input, output] of [['ja-JP', 'ja'], ['ko-KR', 'ko'], ['fr-CA', 'fr'], ['es-MX', 'es'], ['zh-HK', 'zh-Hant'], ['zh-Hans-CN', 'zh-Hans'], ['zh-Hans-TW', 'zh-Hans'], ['en-GB', 'en'], ['de-AT', 'de'], ['pt-BR', 'pt'], ['it-IT', 'it'], ['ru-RU', 'ru'], ['ar-EG', 'ar'], ['hi-IN', 'hi'], ['id-ID', 'id']] as const) expect(browserLocale([input])).toBe(output);
    expect(browserLocale(['xx-XX', 'de-DE', 'fr-FR'])).toBe('de');
    expect(browserLocale(['constructor', 'zz'])).toBe('en');
    expect(browserLocale([])).toBe('en');
  });
  it('accepts supported setting values and rejects malformed or unknown values', () => {
    for (const value of localeSchema.options) expect(syncSettingSchema.parse({ key: 'locale', value }).value).toBe(value);
    for (const value of ['jp', 'kr', 'fr-FR', 'constructor', '', '<script>']) expect(syncSettingSchema.safeParse({ key: 'locale', value }).success).toBe(false);
  });
  it('keeps advanced instruction English without mutating original snapshots', () => {
    const text = { en: 'Keep the original meaning.', 'zh-Hans': '保留原意。', 'zh-Hant': '保留原意。' };
    const before = structuredClone(text);
    for (const locale of localeSchema.options) {
      for (const targetLevel of ['B1', 'B2', 'C1', 'C2'] as const) expect(practiceLocale({ targetLevel }, locale)).toBe('en');
      expect(contentText(text, practiceLocale({ targetLevel: 'C2' }, locale))).toBe(text.en);
    }
    expect(text).toEqual(before);
  });
  it('distinguishes revoking access from cancelling an action in every language', () => {
    for (const locale of localeSchema.options) {
      const revoke = languagePacks[locale].sharingManagement.revoke;
      const cancel = languagePacks[locale].profileBackup.cancel;
      expect(revoke, locale).not.toBe(cancel);
    }
  });
});

import { instructionPacks, loadInstructionLocale, translateInstruction } from '../src/locales/teaching';
beforeAll(async () => { await Promise.all(localeSchema.options.map(loadInstructionLocale)); });
describe('beginner instruction display', () => {
  for (const locale of ['ja', 'ko', 'fr', 'es', 'de', 'pt', 'it', 'ru', 'ar', 'hi', 'id'] as const) it(`${locale} preserves every template slot and quoted source value`, () => {
    const source = instructionPacks.ja!, target = instructionPacks[locale]!;
    expect(Object.keys(target).sort()).toEqual(Object.keys(source).sort());
    expect(Object.keys(target)).toHaveLength(353);
    for (const [english, translated] of Object.entries(target)) {
      expect(slots(translated)).toEqual(slots(english));
      const values = new Map<string, string>();
      for (const slot of slots(english)) values.set(slot, `SOURCE-${slot.slice(1, -1)}-$&`);
      const actual = english.replace(/\{\w+\}/g, slot => values.get(slot)!);
      const expected = translated.replace(/\{\w+\}/g, slot => values.get(slot)!);
      expect(translateInstruction(actual, locale)).toBe(expected);
    }
    expect(translateInstruction('An unknown private lesson.', locale)).toBe('An unknown private lesson.');
    expect(contentText({ en: 'Listen again.', 'zh-Hans': '再听一次。', 'zh-Hant': '再聽一次。' }, locale)).toBe(target['Listen again.']);
  });
  it('retains legacy translated content and advanced English exactly', () => {
    const original = { en: 'Listen again.', 'zh-Hans': '再听一次。', 'zh-Hant': '再聽一次。' };
    expect(contentText(original, 'zh-Hans')).toBe(original['zh-Hans']);
    expect(contentText(original, 'zh-Hant')).toBe(original['zh-Hant']);
    expect(contentText(original, practiceLocale({ targetLevel: 'C1' }, 'ja'))).toBe(original.en);
  });
});

it('translates the History subject in context without forcing different words where the language shares them', () => {
  for (const [locale, subject] of [['ja', '歴史'], ['ko', '역사'], ['fr', 'Histoire'], ['es', 'Historia'], ['de', 'Geschichte'], ['pt', 'História'], ['it', 'Storia'], ['ru', 'История'], ['ar', 'التاريخ'], ['hi', 'इतिहास'], ['id', 'Sejarah']] as const) {
    expect(languagePacks[locale].firstRun_firstRunCopy.themes[8]).toBe(subject);
    if (locale === 'hi') expect(languagePacks[locale].app_history).toBe(subject);
    else expect(languagePacks[locale].app_history).not.toBe(subject);
  }
});

it('uses RTL only for Arabic and native reviewed beginner instruction for the additional languages', () => {
  const original = { en: 'Listen again.', 'zh-Hans': '再听一次。', 'zh-Hant': '再聽一次。' };
  for (const locale of ['de', 'pt', 'it', 'ru', 'ar', 'hi', 'id'] as const) {
    expect(localeDirection(locale)).toBe(locale === 'ar' ? 'rtl' : 'ltr');
    expect(contentText(original, locale)).toBe(instructionPacks[locale]!['Listen again.']);
    expect(contentLanguage(original, locale)).toBe(locale);
  }
  for (const locale of localeSchema.options.filter(value => value !== 'ar')) expect(localeDirection(locale)).toBe('ltr');
});

for (const locale of ['ja', 'ko', 'fr', 'es', 'de', 'pt', 'it', 'ru', 'ar', 'hi', 'id'] as const) it(`${locale} translates reviewed nested explanations while retaining literal source values`, () => {
  const pack = instructionPacks[locale]!;
  const source = '“I am from {v0}.” answers “Where are you from?” “New to {v1}” describes someone new there; it does not give their origin.';
  const explanation = source.replace('{v0}', 'York').replace('{v1}', 'London');
  const expected = pack[source].replace('{v0}', 'York').replace('{v1}', 'London');
  expect(translateInstruction('Yes. ' + explanation, locale)).toBe(pack['Yes. {v0}'].replace('{v0}', expected));
  const wrong = '“{v0}” is not the stated description. {v1}';
  expect(translateInstruction('“Listen again.” is not the stated description. ' + explanation, locale)).toBe(pack[wrong].replace('{v0}', 'Listen again.').replace('{v1}', expected));
  const time = 'The recording states “{v0}”: {v1}. Keep the hour, minutes and a.m./p.m. {v2} No time zone is stated; do not convert it.';
  const helper = 'Both turns repeat the same time; :00 writes the implied zero minutes.';
  const fill = (value: string, nested: string) => value.replace('{v0}', 'seven a.m.').replace('{v1}', '7:00 a.m.').replace('{v2}', nested);
  expect(translateInstruction('Yes. ' + fill(time, helper), locale)).toBe(pack['Yes. {v0}'].replace('{v0}', fill(pack[time], pack[helper])));
  const example = 'Example: “{v0}” → “{v1}”. {v2} “{v3}”. Check the spelling and word ending.';
  const fillExample = (text: string, helper: string) => text.replace('{v0}', 'Read ________.').replace('{v1}', 'Listen again.').replace('{v2}', helper).replace('{v3}', 'Read Listen again.');
  expect(translateInstruction(fillExample(example, 'The passage says'), locale)).toBe(fillExample(pack[example], pack['The passage says']));
  const rule = 'Everyone has to contribute to this party. Or gives alternatives: bringing food and performing are named options, not two duties that everyone must do together. The rule does not ban doing both, and does not prove Anna has already contributed.';
  for (const frame of ['This keeps the stated meaning. {v0}', 'This changes the stated detail. {v0}', 'This changes a relation or action. {v0}']) {
    const original = { en: frame.replace('{v0}', rule), 'zh-Hans': '旧反馈', 'zh-Hant': '舊回饋' };
    const snapshot = structuredClone(original);
    expect(contentText(original, practiceLocale({ targetLevel: 'A2' }, locale))).toBe(pack[frame].replace('{v0}', pack[rule]));
    expect(original).toEqual(snapshot);
  }
  expect(translateInstruction('Unknown private sentence.', locale)).toBe('Unknown private sentence.');
  expect(() => translateInstruction('Yes. '.repeat(1000) + 'Unknown private sentence.', locale)).not.toThrow();
  expect(practiceLocale({ targetLevel: 'B1' }, locale)).toBe('en');
  expect(contentText({ en: explanation, 'zh-Hans': '旧说明', 'zh-Hant': '舊說明' }, practiceLocale({ targetLevel: 'B1' }, locale))).toBe(explanation);
});

it('keeps About-owned copy outside every display-language package', () => {
  const { title, settings, ...aboutKeys } = aboutCopy;
  expect(title).toBe('About');
  expect(settings).toBe('Settings');
  for (const pack of Object.values(languagePacks)) {
    for (const key of Object.keys(aboutKeys)) expect(pack.additional).not.toHaveProperty(key);
    expect(pack.app.about).toBeTruthy();
    expect(pack.app.settings).toBeTruthy();
  }
});
