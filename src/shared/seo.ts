import { localeDirection, type Locale } from './locale.ts';
import { seoCopy } from '../locales/seo.ts';

export const siteOrigin = 'https://lingfern.com';
export const publicPages: Readonly<Record<string, { title: string; descriptionKey: keyof typeof seoCopy.en }>> = {
  '/introduction': { title: 'Lingfern', descriptionKey: 'description' },
  '/library/dictionary': { title: 'English dictionary | Lingfern', descriptionKey: 'dictionary' },
  '/library/ipa': { title: 'IPA pronunciation chart | Lingfern', descriptionKey: 'ipa' },
  '/library/grammar': { title: 'English usage dictionary | Lingfern', descriptionKey: 'grammar' },
  '/settings/about': { title: 'About Lingfern', descriptionKey: 'about' },
};
// Text objects avoid Static Assets' automatic redirects for HTML filenames.
export const prerenderPath = (path: string, locale: Locale = 'en') => Object.hasOwn(publicPages, path) ? `/prerender${locale === 'en' ? '' : '/' + locale}${path}.html.txt` : undefined;

export function pageSeo(pathname: string, search = '', locale: Locale = 'en') {
  const path = pathname === '/' ? '/introduction' : pathname;
  const page = publicPages[path];
  const query = path.startsWith('/library/') && new URLSearchParams(search).has('q');
  return {
    title: page?.title ?? 'Lingfern',
    description: page ? seoCopy[locale][page.descriptionKey] : seoCopy[locale].description,
    canonical: page ? siteOrigin + path : undefined,
    robots: page && !query ? 'index, follow' : 'noindex, follow',
    website: !!page && path === '/introduction',
  };
}

const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export function seoHead(pathname: string, search = '', locale: Locale = 'en') {
  const seo = pageSeo(pathname, search, locale);
  const meta = (key: string, value: string, property = false) => `<meta data-lingfern-seo ${property ? 'property' : 'name'}="${key}" content="${escape(value)}">`;
  const tags = [
    `<title data-lingfern-seo lang="en">${escape(seo.title)}</title>`,
    meta('description', seo.description), meta('robots', seo.robots),
    meta('og:type', 'website', true), meta('og:site_name', 'Lingfern', true),
    meta('og:title', seo.title, true), meta('og:description', seo.description, true),
    meta('og:image', `${siteOrigin}/icon-512.png`, true), meta('og:image:type', 'image/png', true),
    meta('og:image:width', '512', true), meta('og:image:height', '512', true),
    meta('og:image:alt', 'Lingfern fern symbol', true),
    meta('twitter:card', 'summary'), meta('twitter:title', seo.title), meta('twitter:description', seo.description),
    meta('twitter:image', `${siteOrigin}/icon-512.png`), meta('twitter:image:alt', 'Lingfern fern symbol'),
  ];
  if (seo.canonical) tags.push(`<link data-lingfern-seo rel="canonical" href="${seo.canonical}">`, meta('og:url', seo.canonical, true));
  if (seo.website) tags.push(`<script data-lingfern-seo type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Lingfern', url: siteOrigin + '/' }).replace(/</g, '\\u003c')}</script>`);
  return tags.join('\n');
}

export function renderPageHtml(html: string, pathname: string, search = '', locale: Locale = 'en') {
  let blocks = 0;
  const rendered = html.replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/g, () => {
    blocks++;
    return `<!--seo:start-->${seoHead(pathname, search, locale)}<!--seo:end-->`;
  });
  if (blocks !== 1) throw Error('SEO_TEMPLATE');
  return rendered.replace(/<html\b[^>]*>/i, tag => tag
    .replace(/\s(?:lang|dir)="[^"]*"/gi, '')
    .replace('>', ` lang="${locale}" dir="${localeDirection(locale)}">`));
}
