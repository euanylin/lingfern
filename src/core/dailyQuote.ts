import { readableQuotation } from '../shared/quoteLanguage';
import catalogue from '../../content/daily-quotes-runtime.json';
import exclusions from '../../content/daily-quote-exclusions.json';

import { selectDailyQuote } from './dailyQuoteSelection';
export { localDay, quotePreview, quoteSourceUrl } from './dailyQuoteSelection';

export function dailyQuote(date: Date, previous?: string, draw?: () => number) {
  const previousText = catalogue.quotes.find(quote => quote.id === previous)?.text;
  const normalize = (text: string) => text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en');
  const available = catalogue.quotes.filter(quote => !exclusions.some(exclusion => quote.id === exclusion.id || normalize(quote.text) === normalize(exclusion.text))
    && readableQuotation(quote.text) && quote.id !== previous && (!previousText || normalize(quote.text) !== normalize(previousText)));
  return selectDailyQuote(available, date, draw);
}
