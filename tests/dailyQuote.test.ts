import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import exclusions from '../content/daily-quote-exclusions.json';
import catalogueData from '../content/daily-quotes.json';
import displayData from '../content/daily-quotes-runtime.json';
import { readFileSync } from 'node:fs';
import calendarData from '../content/quote-calendar.json';
import { dailyQuote } from './fixtures/dailyQuoteReference';
import { localDay, quoteSourceUrl } from '../src/core/dailyQuoteSelection';

type Quote = { quotationYear?: number; id: string; text: string; pageTitle: string; pageId: number; revisionId: number; section: string; locator: string; url: string };
type Event = { date: string; labels: Record<string, string>; url: string; pages: string[] };
type Catalogue = { source: { url: string }; quotes: Quote[] };
type Selection = { quote: Quote; event?: Event; day: string };
const catalogue = catalogueData as unknown as Catalogue;
const calendar = calendarData as unknown as Event[];
const normalize = (text: string) => text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en');
const select = (date: Date, previous?: string, draw?: () => number) => dailyQuote(date, previous, draw) as unknown as Selection;
const monthDay = (date: Date) => localDay(date).slice(5);
const quote = (id: string, pageTitle: string, text = `Quotation ${id}.`): Quote => ({ id, text, pageTitle, pageId: pageTitle.charCodeAt(0), revisionId: 123, section: 'Quotes', locator: 'Work, chapter 1', url: `https://en.wikiquote.org/wiki/${encodeURIComponent(pageTitle)}` });
const event = (date: string, pages: string[]): Event => ({ date, pages, labels: { 'zh-Hans': '当天', 'zh-Hant': '當天', en: 'Today' }, url: 'https://en.wikiquote.org/wiki/January_1' });
async function fixture(quotes: Quote[], events: Event[] = []) {
  vi.resetModules();
  vi.doMock('../content/daily-quotes-runtime.json', () => ({ default: { source: { url: 'https://en.wikiquote.org/' }, quotes } }));
  vi.doMock('../content/quote-calendar.json', () => ({ default: events }));
  return (await import('./fixtures/dailyQuoteReference')).dailyQuote as unknown as (date: Date, previous?: string, draw?: () => number) => Selection;
}
afterEach(() => {
  vi.doUnmock('../content/daily-quotes-runtime.json');
  vi.doUnmock('../content/quote-calendar.json');
  vi.resetModules();
});

describe('English Wikiquote daily quotations', () => {
  it('preserves the complete catalogue offline and every rendered quote/credit in the lightweight index', () => {
    const full = readFileSync('public' + displayData.fullCatalogue.path);
    expect(createHash('sha256').update(full).digest('hex')).toBe(displayData.fullCatalogue.sha256);
    expect(JSON.parse(full.toString())).toEqual(catalogueData);
    expect(createHash('sha256').update(readFileSync('content/daily-quotes.json')).digest('hex')).toBe(displayData.fullCatalogue.sourceSha256);
    expect(displayData.source).toEqual(catalogueData.source);
    expect(displayData.quotes).toHaveLength(catalogueData.quotes.length);
    for (const [index, quote] of catalogueData.quotes.entries()) {
      const display = displayData.quotes[index];
      for (const field of ['id', 'text', 'pageTitle', 'locator', 'url'] as const) expect(display[field]).toBe(quote[field]);
      if ('kind' in quote.rightsEvidence) expect(display.rightsEvidence.kind).toBe(quote.rightsEvidence.kind);
      if ('rightsUrl' in quote.rightsEvidence) expect(display.rightsEvidence.rightsUrl).toBe(quote.rightsEvidence.rightsUrl);
    }
  });
  it('excludes the inspected religious narrative by identity and exact wording, including calendar selection', async () => {
    const excluded = exclusions[0];
    expect(createHash('sha256').update(excluded.text).digest('hex')).toBe(excluded.textSha256);
    expect(catalogue.quotes.some(item => item.id === excluded.id || normalize(item.text) === normalize(excluded.text))).toBe(false);
    const records = [quote(excluded.id, 'Mecca', excluded.text), quote('copy-with-new-id', 'Another page', excluded.text), quote('safe-mecca', 'Mecca', 'The city has streets and buildings.'), quote('safe-abraham', 'Abraham', 'A carefully stated public observation.')];
    const choose = await fixture(records, [event('10-12', ['Mecca'])]);
    for (const date of [new Date(2026, 9, 12), new Date(2026, 9, 13)]) for (const draw of [0, .25, .5, .75, .999999]) {
      const selected = choose(date, undefined, () => draw);
      expect(['safe-mecca', 'safe-abraham']).toContain(selected.quote.id);
    }
    const blockedOnly = await fixture(records.slice(0, 2), [event('10-12', ['Mecca'])]);
    expect(blockedOnly(new Date(2026, 9, 12), undefined, () => 0)).toBeUndefined();
  });
  it('links the complete quote without losing the fixed revision or section', () => {
    for (const item of catalogue.quotes) {
      const url = new URL(quoteSourceUrl(item));
      expect(url.search).toBe(new URL(item.url).search);
      expect(url.hash.split(':~:')[0]).toBe(new URL(item.url).hash || '#');
      expect(decodeURIComponent(url.hash.split(':~:text=')[1])).toBe(item.text);
    }
    expect(quoteSourceUrl({ url: 'https://en.wikiquote.org/wiki/Test', text: 'one-two, three & four' })).toContain('one%2Dtwo%2C%20three%20%26%20four');
  });
  it('publishes only credited English Wikiquote records with unique identities and display text', () => {
    expect(catalogue.source.url).toBe('https://en.wikiquote.org/');
    expect(catalogueData).not.toHaveProperty('sources');
    expect(catalogue.quotes.length).toBeGreaterThan(0);
    expect(new Set(catalogue.quotes.map(item => item.id)).size).toBe(catalogue.quotes.length);
    expect(new Set(catalogue.quotes.map(item => normalize(item.text))).size).toBe(catalogue.quotes.length);
    for (const item of catalogue.quotes) {
      expect(item.id).toBeTruthy();
      expect(item.id).not.toMatch(/^(?:maxim-|prophet-|poe-|bartlett-)/);
      expect(item.text.trim()).toBeTruthy();
      expect(item.pageTitle.trim()).toBeTruthy();
      expect(Number.isSafeInteger(item.pageId) && item.pageId > 0).toBe(true);
      expect(Number.isSafeInteger(item.revisionId) && item.revisionId > 0).toBe(true);
      expect(item.section.trim()).toBeTruthy();
      expect(item.locator.trim()).toBeTruthy();
      const url = new URL(item.url);
      expect(url.protocol).toBe('https:');
      expect(url.hostname).toBe('en.wikiquote.org');
      expect(item).not.toHaveProperty('anchor');
      expect(item).not.toHaveProperty('themes');
      expect(item).not.toHaveProperty('source');
    }
  });

  it.each(Array.from({ length: 12 }, (_, month) => month))('associates only an exact local calendar date in month %i with an eligible Wikiquote page', month => {
    for (const anchor of calendar) {
      expect(anchor.date).toMatch(/^\d{2}-\d{2}$/);
      expect(anchor.pages.length).toBeGreaterThan(0);
      expect(anchor).not.toHaveProperty('source');
      expect(anchor).not.toHaveProperty('themes');
    }
    for (let day = 1; day <= new Date(2028, month + 1, 0).getDate(); day++) {
      const date = new Date(2028, month, day, 12);
      const selected = select(date, undefined, () => .5);
      expect(selected.day).toBe(localDay(date));
      expect(catalogue.quotes.some(item => item.id === selected.quote.id)).toBe(true);
      if (selected.event) {
        expect(selected.event.date).toBe(monthDay(date));
        expect(selected.event.pages).toContain(selected.quote.pageTitle);
      }
      expect(selected).not.toHaveProperty('nearby');
      expect(selected).not.toHaveProperty('theme');
    }
  });

  it('does not repeat the last actual quotation across month, leap and year boundaries', () => {
    expect(catalogue.quotes.length).toBeGreaterThan(1);
    let previous: Quote | undefined;
    for (const date of [new Date(2027, 11, 31), new Date(2028, 0, 1), new Date(2028, 1, 28), new Date(2028, 1, 29), new Date(2028, 2, 1), new Date(2028, 11, 31)]) {
      const selected = select(date, previous?.id, () => 0);
      if (previous) expect(normalize(selected.quote.text)).not.toBe(normalize(previous.text));
      if (selected.event) expect(selected.event.date).toBe(monthDay(date));
      previous = selected.quote;
    }
    expect(localDay(new Date(2026, 9, 7, 0, 0))).toBe('2026-10-07');
  });

  it('chooses pages uniformly before quotations rather than weighting a prolific page', async () => {
    const items = [quote('a1', 'Alpha'), quote('a2', 'Alpha'), quote('a3', 'Alpha'), quote('b1', 'Beta'), quote('c1', 'Charlie')];
    const choose = await fixture(items);
    const seen = new Map<string, number>();
    for (let page = 0; page < 30; page++) {
      let call = 0;
      const selected = choose(new Date(2026, 6, 2), undefined, () => call++ === 0 ? (page + .5) / 30 : 0);
      seen.set(selected.quote.pageTitle, (seen.get(selected.quote.pageTitle) ?? 0) + 1);
    }
    expect(Object.fromEntries(seen)).toEqual({ Alpha: 10, Beta: 10, Charlie: 10 });
    let call = 0;
    expect(choose(new Date(2026, 6, 2), undefined, () => call++ === 0 ? 0 : .999).quote.id).toBe('a3');
    expect(choose(new Date(2026, 6, 2), undefined, () => .999).quote.id).toBe('c1');
  });

  it('uses today only, never nearby dates or invalid leap-date rollover', async () => {
    const choose = await fixture([quote('a', 'Alpha'), quote('b', 'Beta'), quote('c', 'Charlie')], [event('01-01', ['Alpha']), event('02-29', ['Beta'])]);
    expect(choose(new Date(2026, 0, 1), undefined, () => 0).event?.date).toBe('01-01');
    for (const date of [new Date(2025, 11, 31), new Date(2026, 0, 2), new Date(2026, 1, 28), new Date(2026, 2, 1), new Date(2028, 1, 28), new Date(2028, 2, 1)]) {
      expect(choose(date, undefined, () => 0).event).toBeUndefined();
    }
    expect(choose(new Date(2028, 1, 29), undefined, () => 0).quote.pageTitle).toBe('Beta');
    expect(choose(new Date(2028, 1, 29), undefined, () => 0).event?.date).toBe('02-29');
  });

  it('falls back to the whole collection without an event when today has only the previous quote', async () => {
    const choose = await fixture([quote('a', 'Alpha'), quote('b', 'Beta'), quote('c', 'Charlie')], [event('04-23', ['Alpha'])]);
    const first = choose(new Date(2026, 3, 23), undefined, () => 0);
    expect(first.quote.id).toBe('a');
    expect(first.event?.date).toBe('04-23');
    const next = choose(new Date(2026, 3, 23), first.quote.id, () => 0);
    expect(next.quote.id).toBe('b');
    expect(next.event).toBeUndefined();
    expect(choose(new Date(2026, 3, 22), undefined, () => .999).quote.id).toBe('c');
  });

  it('excludes normalized duplicate wording across pages and ignores unknown previous identifiers', async () => {
    const choose = await fixture([quote('a', 'Alpha', 'The same words.'), quote('b', 'Beta', ' THE  SAME words. '), quote('c', 'Charlie', 'Different words.')], [event('04-23', ['Beta'])]);
    const selected = choose(new Date(2026, 3, 23), 'a', () => 0);
    expect(selected.quote.id).toBe('c');
    expect(selected.event).toBeUndefined();
    expect(choose(new Date(2026, 6, 2), 'removed-old-id', () => 0).quote.id).toBe('a');
  });
});

 it('keeps readable older English and modern translations, excludes archaic forms without an age cutoff', async () => {
  const old = quote('old', 'Older source', 'Older eligible wording.');
  const translation = quote('translation', 'Ancient author', 'A clear modern translation.');
  const archaic = quote('archaic', 'Old wording', 'Thou shalt retain thy words.');
  const choose = await fixture([old, translation, archaic], [event('10-12',['Older source']), event('10-13',['Old wording'])]);
  expect(choose(new Date(2026,9,12),undefined,()=>0).quote.id).toBe('old');
  expect(choose(new Date(2026,9,12),undefined,()=>0).event?.date).toBe('10-12');
  expect(choose(new Date(2026,9,13),'old',()=>0).quote.id).toBe('translation');
  expect(choose(new Date(2026,9,13),'old',()=>0).event).toBeUndefined();
 });
