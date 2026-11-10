import type { Locale } from '../shared/locale';
import { seoHead } from '../shared/seo';

export function updatePageMetadata(pathname: string, search: string, locale: Locale = 'en') {
  const template = document.createElement('template');
  template.innerHTML = seoHead(pathname, search, locale);
  document.head.querySelectorAll('[data-lingfern-seo]').forEach(element => element.remove());
  for (const element of [...template.content.children]) document.head.appendChild(element);
}
