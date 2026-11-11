import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { pageSeo, publicPages, renderPageHtml, seoHead, siteOrigin } from '../src/shared/seo';
import { localeDirection, localeSchema, requestLocale } from '../src/shared/locale';
import { seoCopy } from '../src/locales/seo';

describe('page metadata', () => {
  it('keeps tab and share titles concise without a brand suffix', () => {
    const titles = { '/introduction': 'Lingfern', '/library/dictionary': 'Dictionary', '/library/ipa': 'IPA chart', '/library/grammar': 'Usage', '/settings/about': 'About' };
    for (const locale of localeSchema.options) for (const [path, title] of Object.entries(titles)) {
      expect(pageSeo(path, '', locale).title).toBe(title);
      expect(seoHead(path, '', locale)).toContain(`property="og:title" content="${title}"`);
      expect(seoHead(path, '', locale)).not.toContain('| Lingfern');
    }
    expect(readFileSync('404.html', 'utf8')).toContain('<title data-lingfern-seo>Page not found</title>');
  });

  it.each(localeSchema.options)('provides complete %s descriptions without extra public URLs', locale => {
    expect(Object.keys(seoCopy[locale]).sort()).toEqual(Object.keys(seoCopy.en).sort());
    for (const path of Object.keys(publicPages)) {
      const seo = pageSeo(path, '', locale);
      expect(seo.canonical).toBe(siteOrigin + path);
      expect(seo.description).toBe(seoCopy[locale][publicPages[path].descriptionKey]);
      expect(seo.description.length).toBeGreaterThan(20);
      if (locale !== 'en') expect(seo.description).not.toBe(pageSeo(path).description);
      const html = renderPageHtml('<html lang="en" dir="ltr"><head><!--seo:start--><!--seo:end--></head></html>', path, '', locale);
      expect(html).toContain(`lang="${locale}" dir="${localeDirection(locale)}"`);
      expect(html).not.toContain('hreflang');
      expect(pageSeo(path, '?q=private-term', locale).canonical).toBe(siteOrigin + path);
      expect(seoHead(path, '?q=private-term', locale)).not.toContain('private-term');
    }
  });

  it('negotiates supported request languages by quality and defaults to English', () => {
    for (const [header, expected] of [[null, 'en'], ['', 'en'], ['xx-ZZ, en-GB;q=0.8', 'en'], ['en;q=0.2, zh-CN;q=0.9', 'zh-Hans'], ['zh-TW,zh;q=0.9', 'zh-Hant'], ['de;q=0,fr;q=0.7', 'fr'], ['*;q=1,ja;q=0.5', 'en'], ['ar;q=2,ja;q=0.9', 'ja'], ['en;q=0,ko;q=0.5', 'ko'], ['zh_CN', 'en']] as const) expect(requestLocale(header)).toBe(expected);
    for (const locale of localeSchema.options) expect(requestLocale(locale)).toBe(locale);
  });

  it('indexes exactly the public sitemap entries with distinct titles and descriptions', () => {
    const sitemap = readFileSync('public/sitemap.xml', 'utf8');
    expect([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1])).toEqual(Object.keys(publicPages).map(path => siteOrigin + path));
    expect(new Set(Object.values(publicPages).map(page => page.title)).size).toBe(5);
    expect(new Set(Object.keys(publicPages).map(path => pageSeo(path).description)).size).toBe(5);
    for (const path of Object.keys(publicPages)) expect(pageSeo(path).robots).toBe('index, follow');
    expect(pageSeo('/').canonical).toBe(siteOrigin + '/introduction');
    for (const path of ['/', '/introduction', '/today']) expect(pageSeo(path).title).toBe('Lingfern');
  });

  it('omits private identifiers and query text from every metadata field', () => {
    for (const path of ['/today', '/start', '/progress', '/settings', '/library', '/library/saved', '/library/history', '/learn/synthetic-private-id', '/missing']) {
      expect(pageSeo(path, '?token=synthetic-secret')).toMatchObject({ robots: 'noindex, follow', canonical: undefined });
      expect(seoHead(path, '?token=synthetic-secret')).not.toMatch(/synthetic|rel="canonical"|og:url/);
    }
    const head = seoHead('/library/dictionary', '?q=synthetic-secret-query');
    expect(head).toContain('noindex, follow');
    expect(head).not.toContain('synthetic-secret-query');
    expect(pageSeo('/library/dictionary', '?utm_source=example').robots).toBe('index, follow');
    expect(pageSeo('/library/dictionary', '?q=example').canonical).toBe(siteOrigin + '/library/dictionary');
  });

  it('changes only one metadata block and rejects missing or duplicate templates', () => {
    const source = '<head><!--seo:start-->old<!--seo:end--></head><body>unchanged</body>';
    expect(renderPageHtml(source, '/settings/about')).toBe(`<head><!--seo:start-->${seoHead('/settings/about')}<!--seo:end--></head><body>unchanged</body>`);
    expect(() => renderPageHtml('unmarked HTML', '/today')).toThrow('SEO_TEMPLATE');
    expect(() => renderPageHtml(source + source, '/today')).toThrow('SEO_TEMPLATE');
    expect(renderPageHtml(renderPageHtml(source, '/today'), '/library/ipa')).toBe(renderPageHtml(source, '/library/ipa'));
  });

  it('reuses the existing installation icon and supplies truthful website structured data', () => {
    const icon = readFileSync('public/icon-512.png');
    expect([icon.readUInt32BE(16), icon.readUInt32BE(20)]).toEqual([512, 512]);
    expect(seoHead('/')).toContain(`${siteOrigin}/icon-512.png`);
    const match = seoHead('/').match(/type="application\/ld\+json">([^<]+)<\/script>/)!;
    expect(JSON.parse(match[1])).toEqual({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Lingfern', url: siteOrigin + '/' });
    expect(seoHead('/library/ipa')).not.toContain('application/ld+json');
    expect(seoHead('/')).not.toMatch(/aggregateRating|reviewCount|hreflang/);
  });
});
