export const localDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function quoteSourceUrl(quote: { url: string; text: string }) {
  const url = new URL(quote.url);
  // Preserve text-directive punctuation within its original range/context.
  url.hash = `${url.hash.slice(1).split(':~:')[0]}:~:text=${encodeURIComponent(quote.text).replace(/-/g, '%2D')}`;
  return url.href;
}
