import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { pageSeo, publicPages, renderPageHtml, seoHead, siteOrigin } from '../src/shared/seo';

describe('page metadata', () => {
  it('indexes exactly the public sitemap entries with distinct titles and descriptions', () => {
    const sitemap = readFileSync('public/sitemap.xml', 'utf8');
    expect([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1])).toEqual(Object.keys(publicPages).map(path => siteOrigin + path));
    expect(new Set(Object.values(publicPages).map(page => page.title)).size).toBe(5);
    expect(new Set(Object.values(publicPages).map(page => page.description)).size).toBe(5);
    for (const path of Object.keys(publicPages)) expect(pageSeo(path).robots).toBe('index, follow');
    expect(pageSeo('/').canonical).toBe(siteOrigin + '/introduction');
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
