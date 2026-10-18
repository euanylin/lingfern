import { expect, it } from 'vitest';
import { quoteNeedsExpansion } from '../src/app/DailyQuote';

it('keeps the complete quote visible through four actual lines, allowing fractional layout rounding', () => {
  expect(quoteNeedsExpansion(4 * 34.8, 34.8)).toBe(false);
  expect(quoteNeedsExpansion(4 * 31.9 + .6, 31.9)).toBe(false);
  expect(quoteNeedsExpansion(5 * 31.9, 31.9)).toBe(true);
});

it('uses the rendered line height rather than character count and rejects unavailable measurements', () => {
  expect(quoteNeedsExpansion(120, 34.8)).toBe(false);
  expect(quoteNeedsExpansion(170, 31.9)).toBe(true);
  expect(quoteNeedsExpansion(120, Number.NaN)).toBe(false);
  expect(quoteNeedsExpansion(Number.NaN, 34.8)).toBe(false);
  expect(quoteNeedsExpansion(120, 0)).toBe(false);
});
