export const siteOrigin = 'https://lingfern.com';
const description = 'Read and listen to English at your own pace with Lingfern. Practice offline, save your progress, and optionally sync through GitHub.';
export const publicPages: Readonly<Record<string, { title: string; description: string }>> = {
  '/introduction': { title: 'Lingfern — Read and listen to English', description },
  '/library/dictionary': { title: 'English dictionary | Lingfern', description: 'Look up English words with Open English WordNet, explore definitions and save bookmarks. Download the dictionary for offline use.' },
  '/library/ipa': { title: 'IPA pronunciation chart | Lingfern', description: 'Explore the International Phonetic Alphabet with vowel and consonant charts, articulation guides and pronunciation examples.' },
  '/library/grammar': { title: 'English usage dictionary | Lingfern', description: 'Explore English usage with explanations, examples, common pitfalls and related entries. Download the reference for offline use.' },
  '/settings/about': { title: 'About Lingfern', description: 'Learn about Lingfern, its open-source software, learning resources, licensing and contact information.' },
};
// Text objects avoid Static Assets' automatic redirects for HTML filenames.
export const prerenderPath = (path: string) => Object.hasOwn(publicPages, path) ? `/prerender${path}.html.txt` : undefined;

export function pageSeo(pathname: string, search = '') {
  const path = pathname === '/' ? '/introduction' : pathname;
  const page = publicPages[path];
  const query = path.startsWith('/library/') && new URLSearchParams(search).has('q');
  return {
    title: page?.title ?? 'Lingfern',
    description: page?.description ?? description,
    canonical: page ? siteOrigin + path : undefined,
    robots: page && !query ? 'index, follow' : 'noindex, follow',
    website: !!page && path === '/introduction',
  };
}

const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export function seoHead(pathname: string, search = '') {
  const seo = pageSeo(pathname, search);
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

export function renderPageHtml(html: string, pathname: string, search = '') {
  let blocks = 0;
  const rendered = html.replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/g, () => {
    blocks++;
    return `<!--seo:start-->${seoHead(pathname, search)}<!--seo:end-->`;
  });
  if (blocks !== 1) throw Error('SEO_TEMPLATE');
  return rendered;
}
