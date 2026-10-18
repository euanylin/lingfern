import type { Locale } from '../shared/content';
import { messages } from '../locales';
import { browserLocale } from '../shared/locale';
export const copy = messages('app');
export const progressCopy = messages('i18n_progressCopy');
export function initialLocale(): Locale {
  return browserLocale(navigator.languages.length ? navigator.languages : [navigator.language]);
}
