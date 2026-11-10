import { z } from 'zod';

export const localeSchema = z.enum(['zh-Hans', 'zh-Hant', 'en', 'ja', 'ko', 'fr', 'es', 'de', 'pt', 'it', 'ru', 'ar', 'hi', 'id']);
export type Locale = z.infer<typeof localeSchema>;
export type ContentLocale = 'zh-Hans' | 'zh-Hant' | 'en';

export function contentLocale(locale: Locale): ContentLocale {
  return locale === 'zh-Hans' || locale === 'zh-Hant' ? locale : 'en';
}

export function browserLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    if (/^zh(?:-|$)/i.test(language)) {
      if (/-Hans(?:-|$)/i.test(language)) return 'zh-Hans';
      return /(?:TW|HK|MO|Hant)/i.test(language) ? 'zh-Hant' : 'zh-Hans';
    }
    const parsed = localeSchema.safeParse(language.toLowerCase().split('-')[0]);
    if (parsed.success) return parsed.data;
  }
  return 'en';
}

export function localeDirection(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export function requestLocale(acceptLanguage: string | null): Locale {
  const preferences = (acceptLanguage ?? '').slice(0, 4096).split(',').slice(0, 32).flatMap(value => {
    const match = /^\s*(\*|[a-z]{1,8}(?:-[a-z0-9]{1,8})*)\s*(?:;\s*q=(0(?:\.\d{1,3})?|1(?:\.0{1,3})?))?\s*$/i.exec(value);
    const quality = Number(match?.[2] ?? 1);
    return match && quality > 0 ? [{ language: match[1] === '*' ? 'en' : match[1], quality }] : [];
  }).sort((a, b) => b.quality - a.quality);
  return browserLocale(preferences.map(item => item.language));
}
