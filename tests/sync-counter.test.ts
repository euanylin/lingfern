import { expect, it } from 'vitest';
import fc from 'fast-check';
import { compareSyncCounters, incrementSyncCounter, maxSyncCounter, syncCounterSchema, syncEventCounterSchema } from '../src/shared/syncCounter';

it('keeps the safe numeric representation and crosses its boundary exactly', () => {
  expect(incrementSyncCounter(0)).toBe(1);
  expect(incrementSyncCounter(Number.MAX_SAFE_INTEGER - 1)).toBe(Number.MAX_SAFE_INTEGER);
  expect(incrementSyncCounter(Number.MAX_SAFE_INTEGER)).toBe('9007199254740992');
  expect(incrementSyncCounter('9999999999999999')).toBe('10000000000000000');
  for (const value of [0, 1, Number.MAX_SAFE_INTEGER, '9007199254740992', '10000000000000000']) expect(syncCounterSchema.parse(value)).toBe(value);
  expect(syncEventCounterSchema.safeParse(0).success).toBe(false);
  for (const value of [-1, .5, Infinity, Number.MAX_SAFE_INTEGER + 1, '', '0', '1', String(Number.MAX_SAFE_INTEGER), '09007199254740992', '+9007199254740992', '9e20', '9007199254740992.0', '9007199254740992\n']) expect(syncCounterSchema.safeParse(value).success).toBe(false);
});

it('compares and increments decimal counters exactly against an independent bigint oracle', () => {
  const represent = (value: bigint) => value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString();
  fc.assert(fc.property(fc.bigInt({ min: 0n, max: 10n ** 80n }), fc.bigInt({ min: 0n, max: 10n ** 80n }), (a, b) => {
    const left = represent(a), right = represent(b);
    expect(compareSyncCounters(left, right)).toBe(a < b ? -1 : a > b ? 1 : 0);
    expect(maxSyncCounter(left, right)).toBe(a >= b ? left : right);
    expect(incrementSyncCounter(left)).toBe(represent(a + 1n));
  }));
});

it('does not introduce another maximum-digit boundary while handling large input linearly', () => {
  const value = '9'.repeat(250 * 1024);
  expect(syncCounterSchema.parse(value)).toBe(value);
  const next = incrementSyncCounter(value);
  expect(next).toBe(`1${'0'.repeat(value.length)}`);
  expect(syncCounterSchema.parse(next)).toBe(next);
  expect(compareSyncCounters(next, value)).toBe(1);
});
