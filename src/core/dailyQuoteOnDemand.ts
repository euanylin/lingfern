import index from '../../content/daily-quote-index.json';
import type catalogue from '../../content/daily-quotes-runtime.json';
import { selectDailyQuote } from './dailyQuoteSelection';

type Quote = typeof catalogue.quotes[number];
const chunks = import.meta.glob<{ default: Quote[] }>('../../content/daily-quote-chunks/*.json');

export async function dailyQuoteOnDemand(date: Date, previous?: string, draw?: () => number) {
  const selected = selectDailyQuote(index.filter(quote => quote.eligible && quote.id !== previous), date, draw);
  if (!selected) return undefined;
  const records = (await chunks[`../../content/daily-quote-chunks/${selected.quote.chunk}.json`]()).default;
  const quote = records.find(quote => quote.id === selected.quote.id);
  if (!quote) throw new Error('QUOTE_CHUNK_INTEGRITY');
  return { ...selected, quote };
}
