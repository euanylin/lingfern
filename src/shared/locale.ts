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
