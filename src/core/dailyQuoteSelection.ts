import calendar from '../../content/quote-calendar.json';

const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000;
export const localDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const quotePreview = (text: string) => text.length > 240 ? `${text.slice(0, 239).replace(/\s+\S*$/, '').trimEnd()}…` : text;
export function quoteSourceUrl(quote: { url: string; text: string }) {
  const url = new URL(quote.url);
  // Preserve text-directive punctuation within its original range/context.
  url.hash = `${url.hash.slice(1).split(':~:')[0]}:~:text=${encodeURIComponent(quote.text).replace(/-/g, '%2D')}`;
  return url.href;
}

export function selectDailyQuote<T extends { id: string; pageTitle: string }>(available: T[], date: Date, draw = random) {
  const pick = <U,>(items: U[]) => items[Math.min(items.length - 1, Math.max(0, Math.floor(draw() * items.length)))];
  const today = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const exact = calendar.filter(event => event.date === today).map(event => ({ event, quotes: available.filter(quote => event.pages.includes(quote.pageTitle)) })).filter(item => item.quotes.length);
  const matched = exact.length ? pick(exact) : undefined;
  const pool = matched?.quotes ?? available;
  if (!pool.length) return undefined;
  const pages = new Map<string, typeof pool>();
  for (const quote of pool) {
    const group = pages.get(quote.pageTitle);
    if (group) group.push(quote); else pages.set(quote.pageTitle, [quote]);
  }
  const quote = pick(pick([...pages.values()]));
  return { quote, event: matched?.event, day: localDay(date) };
}
