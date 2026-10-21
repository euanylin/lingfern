import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import catalogue from '../content/daily-quotes-runtime.json';
import index from '../content/daily-quote-index.json';
import calendar from '../content/quote-calendar.json';
import { dailyQuote } from '../src/core/dailyQuote';
import { dailyQuoteOnDemand } from '../src/core/dailyQuoteOnDemand';
import { readableQuotation } from '../src/shared/quoteLanguage';
import exclusions from '../content/daily-quote-exclusions.json';

it('retains every full display record exactly once and derives the same eligibility and order', () => {
  const chunks = readdirSync('content/daily-quote-chunks').sort().flatMap(name => JSON.parse(readFileSync('content/daily-quote-chunks/' + name, 'utf8')));
  expect(chunks).toEqual(catalogue.quotes);
  const normalize = (text: string) => text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en');
  expect(new Set(catalogue.quotes.map(quote => normalize(quote.text))).size).toBe(catalogue.quotes.length);
  expect(new Set(index.map(quote => quote.id)).size).toBe(index.length);
  expect(index.every(quote => /^[a-f0-9]{16}$/.test(quote.id))).toBe(true);
  expect(index).toEqual(catalogue.quotes.map((quote, position) => ({ id: quote.id.slice(-16), pageTitle: quote.pageTitle, chunk: String(Math.floor(position / 64)).padStart(3, '0'), eligible: readableQuotation(quote.text) && !exclusions.some(exclusion => quote.id === exclusion.id || normalize(quote.text) === normalize(exclusion.text)) })));
});

describe('on-demand selection preserves current calendar, random draws, previous exclusion and complete credits', () => {
  for (let month = 0; month < 12; month++) it(`month ${month + 1} has identical selections`, async () => {
    const dates = new Set([`${String(month + 1).padStart(2, '0')}-01`, ...calendar.filter(event => Number(event.date.slice(0, 2)) === month + 1).map(event => event.date)]);
    for (const date of dates) for (const draw of [0, .37, .999999]) {
      const now = new Date(2026, month, Number(date.slice(3)), 12);
      const previous = dailyQuote(now, undefined, () => draw)?.quote.id;
      for (const prior of [undefined, previous, 'unknown-old-quote', previous?.slice(-16), previous?.replace('wikiquote-', 'unknown-')]) expect(await dailyQuoteOnDemand(now, prior, () => draw)).toEqual(dailyQuote(now, prior, () => draw));
    }
  }, 30000);
});
