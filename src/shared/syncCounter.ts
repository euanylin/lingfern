import { z } from 'zod';

const largestNumber = String(Number.MAX_SAFE_INTEGER);
const decimalCounter = z.string().regex(/^[1-9][0-9]*$(?![\s\S])/).refine(value => value.length > largestNumber.length || value.length === largestNumber.length && value > largestNumber);

// Keep old numeric bytes; only larger counters use canonical decimal strings.
export const syncCounterSchema = z.union([z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), decimalCounter]);
export const syncEventCounterSchema = syncCounterSchema.refine(value => value !== 0);
export type SyncCounter = z.infer<typeof syncCounterSchema>;

export function compareSyncCounters(left: SyncCounter, right: SyncCounter) {
  if (typeof left === 'number' && typeof right === 'number') return left < right ? -1 : left > right ? 1 : 0;
  const a = String(left), b = String(right);
  return a.length < b.length ? -1 : a.length > b.length ? 1 : a < b ? -1 : a > b ? 1 : 0;
}

export function maxSyncCounter(left: SyncCounter, right: SyncCounter): SyncCounter {
  return compareSyncCounters(left, right) >= 0 ? left : right;
}

export function incrementSyncCounter(value: SyncCounter): SyncCounter {
  if (typeof value === 'number' && value < Number.MAX_SAFE_INTEGER) return value + 1;
  const digits = String(value);
  let index = digits.length - 1;
  while (index >= 0 && digits[index] === '9') index--;
  return index < 0 ? `1${'0'.repeat(digits.length)}` : `${digits.slice(0, index)}${Number(digits[index]) + 1}${'0'.repeat(digits.length - index - 1)}`;
}
