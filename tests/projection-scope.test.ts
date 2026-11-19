import { beforeEach, expect, it } from 'vitest';
import { db, profiles, projectPreferences, settings } from '../src/data/db';
import { appendSyncEvent, readSyncEvents } from '../src/data/sync';
import { readLookupHistory, recordLookup } from '../src/data/lookupHistory';

beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });

it('keeps profile settings correct amid unrelated lookup events', async () => {
  await profiles.bulkPut([{ id: 'p', name: 'One', createdAt: '2026-10-01T00:00:00Z' }, { id: 'other', name: 'Two', createdAt: '2026-10-01T00:00:00Z' }]);
  await settings.bulkPut([{ key: 'profile:p:theme', value: 'light' }, { key: 'profile:other:theme', value: 'dark' }, { key: 'activeProfile', value: 'p' }]);
  await recordLookup('p', 'grammar', 'since / for');
  await recordLookup('other', 'ipa', 'ɪ');
  await appendSyncEvent('p', { type: 'setting', payload: { key: 'theme', value: 'dark' } });
  const events = await readSyncEvents('p');
  expect((await projectPreferences('p')).values.get('theme')).toBe('dark');
  expect((await projectPreferences('other')).values.get('theme')).toBe('dark');
  expect((await readLookupHistory('p')).map(row => row.term)).toEqual(['since / for']);
  expect(await readSyncEvents('p')).toEqual(events);
  expect((await settings.get('activeProfile'))?.value).toBe('p');
});
