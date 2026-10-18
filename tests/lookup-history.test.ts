import { beforeEach, expect, it, vi } from 'vitest';
import { db, settings } from '../src/data/db';
import { lookupHistoryUrl, readLookupHistory, recordLookup } from '../src/data/lookupHistory';

beforeEach(async () => { vi.restoreAllMocks(); await settings.clear(); });

it('keeps recent unique lookups per profile and preserves concurrent additions', async () => {
  await Promise.all([recordLookup('p', 'dictionary', ' apple '), recordLookup('p', 'grammar', 'since / for'), recordLookup('other', 'dictionary', 'pear')]);
  await recordLookup('p', 'dictionary', 'APPLE');
  const rows = await readLookupHistory('p');
  expect(rows.map(row => [row.kind, row.term])).toEqual([['dictionary', 'APPLE'], ['grammar', 'since / for']]);
  expect((await readLookupHistory('other')).map(row => row.term)).toEqual(['pear']);
  expect(await readLookupHistory('empty')).toEqual([]);
});

it('bounds history, validates terms and encodes internal destinations', async () => {
  for (let i = 0; i < 105; i++) await recordLookup('p', 'dictionary', `word ${i}`);
  const rows = await readLookupHistory('p');
  expect(rows).toHaveLength(100); expect(rows.at(-1)?.term).toBe('word 5');
  await expect(recordLookup('p', 'grammar', '')).rejects.toThrow();
  await expect(recordLookup('p', 'grammar', 'a'.repeat(81))).rejects.toThrow();
  await expect(recordLookup('p', 'grammar', 'a\u0000b')).rejects.toThrow();
  expect(lookupHistoryUrl({ kind: 'grammar', term: 'since / for & ?#', lookedUpAt: new Date().toISOString() })).toBe('/library/grammar?q=since%20%2F%20for%20%26%20%3F%23');
  expect(await readLookupHistory('p')).toEqual(rows);
});

it('retains valid history after failed writes and rejects corrupt storage without replacing it', async () => {
  await recordLookup('p', 'ipa', 'ɪ');
  const before = await readLookupHistory('p');
  const write = vi.spyOn(settings, 'put').mockRejectedValueOnce(new Error('WRITE_FAILED'));
  await expect(recordLookup('p', 'ipa', 'i')).rejects.toThrow('WRITE_FAILED');
  expect(await readLookupHistory('p')).toEqual(before); write.mockRestore();
  await settings.put({ key: 'profile:p:lookupHistory', value: '{broken' });
  await expect(recordLookup('p', 'dictionary', 'apple')).rejects.toThrow();
  expect((await settings.get('profile:p:lookupHistory'))?.value).toBe('{broken');
  expect(db.verno).toBe(8);
});
