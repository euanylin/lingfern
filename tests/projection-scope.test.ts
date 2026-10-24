import { beforeEach, expect, it } from 'vitest';
import { liveQuery } from 'dexie';
import { db, profiles, projectPreferences, settings } from '../src/data/db';
import { readInstallationIntents, saveInstallationIntent } from '../src/data/installationIntent';
import { appendSyncEvent, readSyncEvents } from '../src/data/sync';
import { readLookupHistory, recordLookup } from '../src/data/lookupHistory';

beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });

it('keeps profile settings and installation intentions correct amid unrelated lookup events', async () => {
  await profiles.bulkPut([{ id: 'p', name: 'One', createdAt: '2026-10-01T00:00:00Z' }, { id: 'other', name: 'Two', createdAt: '2026-10-01T00:00:00Z' }]);
  await settings.bulkPut([{ key: 'profile:p:theme', value: 'light' }, { key: 'profile:other:theme', value: 'dark' }, { key: 'activeProfile', value: 'p' }]);
  await recordLookup('p', 'grammar', 'since / for');
  await recordLookup('other', 'ipa', 'ɪ');
  await appendSyncEvent('p', { type: 'setting', payload: { key: 'theme', value: 'dark' } });
  await saveInstallationIntent('p', 'grammar', true);
  const events = await readSyncEvents('p');
  expect((await projectPreferences('p')).values.get('theme')).toBe('dark');
  expect((await projectPreferences('other')).values.get('theme')).toBe('dark');
  expect([...(await readInstallationIntents('p')).current]).toEqual(['grammar']);
  expect((await readLookupHistory('p')).map(row => row.term)).toEqual(['since / for']);
  expect(await readSyncEvents('p')).toEqual(events);
  expect((await settings.get('activeProfile'))?.value).toBe('p');
});

it('updates a live installation view for intent changes without rerunning it for lookup changes', async () => {
  await saveInstallationIntent('p', 'grammar', true);
  const snapshots: string[][] = [];
  const observer = liveQuery(async () => [...(await readInstallationIntents('p')).current]).subscribe(value => snapshots.push(value));
  try {
    await expect.poll(() => snapshots.length).toBe(1);
    await recordLookup('p', 'dictionary', 'apple');
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(snapshots).toEqual([['grammar']]);
    await saveInstallationIntent('p', 'grammar', false);
    await expect.poll(() => snapshots.at(-1)).toEqual([]);
    expect((await readLookupHistory('p')).map(row => row.term)).toEqual(['apple']);
  } finally { observer.unsubscribe(); }
});
