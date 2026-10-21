import { translateInstruction } from './teaching';
export { translateInstruction } from './teaching';
import en from './en/messages.json' with { type: 'json' };
import hans from './zh-Hans/messages.json' with { type: 'json' };
import hant from './zh-Hant/messages.json' with { type: 'json' };
import ja from './ja/messages.json' with { type: 'json' };
import ko from './ko/messages.json' with { type: 'json' };
import fr from './fr/messages.json' with { type: 'json' };
import es from './es/messages.json' with { type: 'json' };
import de from './de/messages.json' with { type: 'json' };
import pt from './pt/messages.json' with { type: 'json' };
import it from './it/messages.json' with { type: 'json' };
import ru from './ru/messages.json' with { type: 'json' };
import ar from './ar/messages.json' with { type: 'json' };
import hi from './hi/messages.json' with { type: 'json' };
import id from './id/messages.json' with { type: 'json' };
import { contentLocale, localeSchema, type Locale } from '../shared/locale';

// Export the full inventory for checks; render only loaded packages.
export const languagePacks = { en, 'zh-Hans': hans, 'zh-Hant': hant, ja, ko, fr, es, de, pt, it, ru, ar, hi, id } satisfies Record<Locale, typeof en>;
const loaded: Partial<Record<Locale, typeof en>> = { en };
const loaders = {
  'zh-Hans': () => import('./zh-Hans/messages.json'), 'zh-Hant': () => import('./zh-Hant/messages.json'),
  ja: () => import('./ja/messages.json'), ko: () => import('./ko/messages.json'),
  fr: () => import('./fr/messages.json'), es: () => import('./es/messages.json'),
  de: () => import('./de/messages.json'), pt: () => import('./pt/messages.json'),
  it: () => import('./it/messages.json'), ru: () => import('./ru/messages.json'),
  ar: () => import('./ar/messages.json'), hi: () => import('./hi/messages.json'), id: () => import('./id/messages.json'),
};
const loading = new Map<Locale, Promise<void>>();
export async function loadUiLocale(locale: Locale) {
  if (locale === 'en' || loaded[locale]) return;
  if (!loading.has(locale)) loading.set(locale, loaders[locale]().then(pack => { loaded[locale] = pack.default; }).catch(error => { loading.delete(locale); throw error; }));
  await loading.get(locale);
}
// List languages without downloading their full packages.
const nativeNames: Record<Locale, string> = { en: 'English', 'zh-Hans': '简体中文', 'zh-Hant': '繁體中文', ja: '日本語', ko: '한국어', fr: 'Français', es: 'Español', de: 'Deutsch', pt: 'Português', it: 'Italiano', ru: 'Русский', ar: 'العربية', hi: 'हिन्दी', id: 'Bahasa Indonesia' };
const englishLanguageNames = new Intl.DisplayNames('en', { type: 'language', languageDisplay: 'standard' });
export const languageOptions = localeSchema.options.map(value => ({ value, label: nativeNames[value], lang: value }))
  .sort((a, b) => englishLanguageNames.of(a.value)!.localeCompare(englishLanguageNames.of(b.value)!, 'en'));

function interpolate<T>(value: T, parameters: Record<string, string | number>): T {
  if (typeof value === 'string') return value.replace(/\{(\w+)\}/g, (match, key: string) => Object.hasOwn(parameters, key) ? String(parameters[key]) : match) as T;
  if (Array.isArray(value)) return value.map(item => interpolate(item, parameters)) as T;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, interpolate(item, parameters)])) as T;
}

export function messages<K extends keyof typeof en>(namespace: K, parameters?: Record<string, string | number>): Record<Locale, typeof en[K]> {
  // Resolve labels lazily so existing references see newly loaded languages.
  return Object.defineProperties({}, Object.fromEntries(localeSchema.options.map(locale => [locale, { enumerable: true, get: () => {
    const value = (loaded[locale] ?? en)[namespace];
    return parameters ? interpolate(value, parameters) : value;
  } }]))) as Record<Locale, typeof en[K]>;
}

/** Translate display only without changing saved snapshots or hashes. */
export function contentText(value: { 'zh-Hans': string; 'zh-Hant': string; en: string }, locale: Locale) {
  return translateInstruction(value[contentLocale(locale)], locale);
}

export function instructionLanguage(text: string, locale: Locale): Locale {
  const source = contentLocale(locale);
  return source === locale || translateInstruction(text, locale) === text ? source : locale;
}

export function contentLanguage(value: { 'zh-Hans': string; 'zh-Hant': string; en: string }, locale: Locale) {
  return instructionLanguage(value[contentLocale(locale)], locale);
}
