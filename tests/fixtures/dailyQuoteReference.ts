import { readableQuotation } from '../../src/shared/quoteLanguage';
import catalogue from '../../content/daily-quotes-runtime.json';
import exclusions from '../../content/daily-quote-exclusions.json';

import { selectDailyQuote } from '../../src/core/dailyQuoteSelection';

// Independent full-catalogue reference for the chunked runtime selector.
export function dailyQuote(date: Date, previous?: string, draw?: () => number) {
  const previousText = catalogue.quotes.find(quote => quote.id === previous)?.text;
  const normalize = (text: string) => text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en');
  const available = catalogue.quotes.filter(quote => !exclusions.some(exclusion => quote.id === exclusion.id || normalize(quote.text) === normalize(exclusion.text))
    && readableQuotation(quote.text) && quote.id !== previous && (!previousText || normalize(quote.text) !== normalize(previousText)));
  return selectDailyQuote(available, date, draw);
}
