import provenance from '../content/corpus/gutenberg-license-provenance.json';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { GutenbergLicence } from '../src/app/GutenbergLicence';
import { gutenbergLicence, gutenbergNotice, gutenbergTerms, isGutenbergSource } from '../src/shared/sourceLicence';

it('retains the acquired required notice and complete local terms with public-resource parity', () => {
  const notice = provenance.requiredNotice;
  expect(createHash('sha256').update(gutenbergLicence).digest('hex')).toBe(provenance.licenceTextSha256);
  expect(gutenbergNotice).toBe(notice);
  expect(gutenbergTerms).toBe(notice + '\n\n' + gutenbergLicence);
  expect(readFileSync('public/corpus/gutenberg-license.txt', 'utf8')).toBe(gutenbergLicence);
  for (let section = 1; section <= 5; section++) expect(gutenbergLicence).toContain(`Section ${section}.`);
  expect(gutenbergLicence).toContain('1.E.1.');
  expect(gutenbergLicence).toContain('Any alternate format must include the full');
  expect(gutenbergLicence).toContain('Section 5. General Information');
});

it('offers the notice and offline full terms in all UI locales only for the actual source host', () => {
  for (const [locale, label] of [['zh-Hans', '完整来源许可条款'], ['zh-Hant', '完整來源許可條款'], ['en', 'Full source licence']] as const) {
    const markup = renderToStaticMarkup(createElement(GutenbergLicence, { sourceUrl: 'https://www.gutenberg.org/ebooks/1661', locale }));
    expect(markup).toContain(gutenbergNotice);
    expect(markup).toContain(label);
    expect(markup).toContain('1.E.1.');
    expect(markup).toContain('Section 5. General Information');
    expect(markup).not.toContain('<script');
    expect(markup).not.toContain('<iframe');
  }
  for (const sourceUrl of [undefined, 'https://www.gutenberg.org.evil/ebooks/1661', 'https://example.org/1661', 'javascript:alert(1)']) {
    expect(isGutenbergSource(sourceUrl)).toBe(false);
    expect(renderToStaticMarkup(createElement(GutenbergLicence, { sourceUrl, locale: 'en' }))).toBe('');
  }
});
