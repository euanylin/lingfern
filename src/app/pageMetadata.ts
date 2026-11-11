import type { Locale } from '../shared/locale';
import { seoHead } from '../shared/seo';
import { pageRoute } from '../shared/pageRoutes';
import { messages } from '../locales';

export function updatePageMetadata(pathname: string, search: string, locale: Locale = 'en') {
  const template = document.createElement('template');
  template.innerHTML = seoHead(pathname, search, locale);
  if (pathname !== '/' && !pageRoute(pathname)) {
    const title = template.content.querySelector('title')!;
    title.textContent = messages('notFound')[locale].title;
    title.lang = locale;
    for (const meta of template.content.querySelectorAll('meta[property="og:title"],meta[name="twitter:title"]')) meta.setAttribute('content', title.textContent);
    template.content.querySelector('meta[name="robots"]')!.setAttribute('content', 'noindex, nofollow');
  }
  document.head.querySelectorAll('[data-lingfern-seo]').forEach(element => element.remove());
  for (const element of [...template.content.children]) document.head.appendChild(element);
}
