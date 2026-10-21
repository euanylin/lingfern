import { beforeEach, expect, it } from 'vitest';
import { db, profiles, settings, savePreferences, saveSetting, projectPreferences, bootstrapSyncEvents, syncEvents, syncClocks } from '../src/data/db';
import { initialPreferences, preferencesSchema } from '../src/shared/preferences';
import { exportBackup, inspectBackup, importBackup } from '../src/data/backup';
import { selectPractice } from '../src/data/practice';
import { lessonSchema } from '../src/shared/content';
import a1 from './fixtures/content/a1-reading.json';
import a2 from './fixtures/content/a2-reading.json';
import c2 from './fixtures/content/c2-reading.json';
import listening from './fixtures/content/a1-listening.json';
import { readPracticeSelection } from '../src/shared/practiceSelection';

it('persists separate practice selections atomically, validates IDs, and retains them in backups', async () => {
  await profiles.add({ id: 'choices', name: 'Choices', createdAt: new Date().toISOString() });
  const reading = { topics: ['culture', 'music'], kinds: ['completion', 'choice'], materials: ['work-a', 'work-b'] };
  const listening = { topics: [], kinds: ['choice'], materials: [] };
  await saveSetting('choices', 'readingPractice', JSON.stringify(reading));
  await saveSetting('choices', 'listeningPractice', JSON.stringify(listening));
  let projected = await projectPreferences('choices');
  expect(readPracticeSelection(projected.values.get('readingPractice'))).toEqual(reading);
  expect(readPracticeSelection(projected.values.get('listeningPractice'))).toEqual(listening);
  const fail = () => { throw new Error('disk failed'); };
  syncEvents.hook('creating', fail);
  try { await expect(saveSetting('choices', 'readingPractice', '{"materials":[]}')).rejects.toThrow('disk failed'); }
  finally { syncEvents.hook('creating').unsubscribe(fail); }
  projected = await projectPreferences('choices');
  expect(readPracticeSelection(projected.values.get('readingPractice'))).toEqual(reading);
  for (const value of ['null', '{"materials":["same","same"]}', '{"kind":"response","materials":[]}', '{"materials":[],"text":"private answer"}']) await expect(saveSetting('choices', 'readingPractice', value)).rejects.toThrow();
  const restored = await importBackup(await inspectBackup(await exportBackup('choices')));
  expect(restored).not.toBe('choices');
  expect(readPracticeSelection((await projectPreferences(restored)).values.get('readingPractice'))).toEqual(reading);
});

beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });
it('saves profile choices and locale atomically and restores them without altering the original', async () => {
  await profiles.add({ id: 'one', name: 'One', createdAt: new Date().toISOString() });
  const preferences = { ...initialPreferences, reading: 'C2' as const, listening: 'A1' as const, step: 4, completed: true };
  await savePreferences('one', preferences, 'en');
  const fail = () => { throw new Error('disk failed'); }; settings.hook('updating', fail);
  try { await expect(savePreferences('one', initialPreferences, 'zh-Hans')).rejects.toThrow('disk failed'); }
  finally { settings.hook('updating').unsubscribe(fail); }
  expect((await profiles.get('one'))?.preferences).toEqual(preferences);
  expect((await settings.get('profile:one:locale'))?.value).toBe('en');
  const restored = await importBackup(await inspectBackup(await exportBackup('one')));
  expect((await profiles.get(restored))?.preferences).toEqual(preferences);
  expect((await profiles.get('one'))?.preferences).toEqual(preferences);
  await expect(savePreferences('missing', preferences, 'en')).rejects.toThrow('NOT_FOUND');
  expect(preferencesSchema.safeParse({ ...preferences, reading: 'C3' }).success).toBe(false);
  expect(preferencesSchema.safeParse({ ...preferences, interests: ['travel', 'travel'] }).success).toBe(false);
});
it('uses separate chosen starting points, defaults unspecified preferences near A2 and respects availability', () => {
  const lessons = [a1, a2, c2, listening].map(raw => lessonSchema.parse(raw));
  expect(selectPractice(lessons, [], [], 'reading', undefined, undefined, { ...initialPreferences, reading: 'C2' })?.lesson.targetLevel).toBe('C2');
  expect(selectPractice(lessons, [], [], 'listening', undefined, undefined, { ...initialPreferences, reading: 'C2', listening: 'A1' })?.lesson.skill).toBe('listening');
  expect(selectPractice(lessons, [], [], 'reading', undefined, undefined, initialPreferences)?.lesson.targetLevel).toBe('A2');
  expect(selectPractice(lessons, [], [], 'reading', lesson => lesson.targetLevel !== 'C2', undefined, { ...initialPreferences, reading: 'C2' })?.lesson.targetLevel).toBe('A2');
  expect(selectPractice(lessons, [], [], 'reading', () => false, undefined, initialPreferences)).toBeUndefined();
});

it('captures settings atomically, projects logical order without echoes, and isolates restored profiles', async () => {
  for (const id of ['one', 'two']) await profiles.add({ id, name: id, createdAt: new Date().toISOString() });
  await settings.put({ key: 'theme', value: 'light' });
  await saveSetting('one', 'theme', 'dark');
  const before = await syncEvents.count();
  const clock = await syncClocks.get('one');
  const fail = () => { throw new Error('disk failed'); };
  syncEvents.hook('creating', fail);
  try { await expect(saveSetting('one', 'theme', 'system')).rejects.toThrow('disk failed'); }
  finally { syncEvents.hook('creating').unsubscribe(fail); }
  expect((await settings.get('profile:one:theme'))?.value).toBe('dark');
  expect(await syncClocks.get('one')).toEqual(clock);
  expect(await syncEvents.count()).toBe(before);
  await expect(saveSetting('one', 'activeProfile', 'two')).rejects.toThrow();
  await expect(saveSetting('missing', 'theme', 'dark')).rejects.toThrow('NOT_FOUND');
  await expect(saveSetting('one', 'theme', 'invalid')).rejects.toThrow();
  const preferences = { ...initialPreferences, reading: 'C2' as const, completed: true };
  await syncEvents.bulkPut([
    { profileId: 'one', id: 'remote-theme', deviceId: 'remote', counter: 9, occurredAt: '2020-01-01T00:00:00.000Z', type: 'setting', payload: { key: 'theme', value: 'light' } },
    { profileId: 'one', id: 'remote-preferences', deviceId: 'remote', counter: 10, occurredAt: '2020-01-01T00:00:00.000Z', type: 'preferences', payload: preferences },
  ]);
  await syncClocks.put({ ...clock, counter: 10 });
  const count = await syncEvents.count();
  settings.hook('updating', fail);
  try { await expect(projectPreferences('one')).rejects.toThrow('disk failed'); }
  finally { settings.hook('updating').unsubscribe(fail); }
  expect((await profiles.get('one'))?.preferences).toBeUndefined();
  expect((await settings.get('profile:one:theme'))?.value).toBe('dark');
  const result = await projectPreferences('one');
  expect(result.values.get('theme')).toBe('light');
  expect(result.preferences).toEqual(preferences);
  expect((await profiles.get('one'))?.preferences).toEqual(preferences);
  expect((await projectPreferences('two')).values.size).toBe(0);
  expect(await settings.get('activeProfile')).toBeUndefined();
  await projectPreferences('one');
  expect(await syncEvents.count()).toBe(count);
  const restored = await importBackup(await inspectBackup(await exportBackup('one')));
  expect((await projectPreferences(restored)).values.get('theme')).toBe('light');
  expect((await projectPreferences(restored)).preferences).toEqual(preferences);
});


it('ignores global choices for the local guest without deleting stored rows or capturing outgoing settings', async () => {
  const id = 'local-guest';
  await profiles.add({ id, name: 'Guest', createdAt: new Date().toISOString() });
  const rows = [{ key: 'locale', value: 'en' }, { key: 'theme', value: 'dark' }, { key: 'profile:other:locale', value: 'en' }];
  await settings.bulkPut(rows);
  expect((await projectPreferences(id)).values.size).toBe(0);
  await bootstrapSyncEvents(id);
  expect(await syncEvents.where('profileId').equals(id).toArray()).toEqual([]);
  expect(await settings.bulkGet(rows.map(row => row.key))).toEqual(rows);
  expect(await settings.get(`profile:${id}:locale`)).toBeUndefined();
  await saveSetting(id, 'locale', 'zh-Hant');
  expect([...((await projectPreferences(id)).values)]).toEqual([['locale', 'zh-Hant']]);
  expect((await syncEvents.where('profileId').equals(id).toArray()).map(event => event.payload)).toEqual([{ key: 'locale', value: 'zh-Hant' }]);
  expect(await settings.bulkGet(rows.map(row => row.key))).toEqual(rows);
});

for (const locale of ['ja', 'ko', 'fr', 'es', 'de', 'pt', 'it', 'ru', 'ar', 'hi', 'id'] as const) it(`saves, sync-projects and restores ${locale} without changing the original profile`, async () => {
  await profiles.add({ id: 'language-profile', name: 'Language test', createdAt: new Date().toISOString() });
  const preferences = { ...initialPreferences, reading: 'A1' as const, completed: true };
  await savePreferences('language-profile', preferences, locale);
  expect((await projectPreferences('language-profile')).values.get('locale')).toBe(locale);
  const events = await syncEvents.where('profileId').equals('language-profile').toArray();
  expect(events.find(event => event.type === 'setting')?.payload).toEqual({ key: 'locale', value: locale });
  const restored = await importBackup(await inspectBackup(await exportBackup('language-profile')));
  expect(restored).not.toBe('language-profile');
  expect((await projectPreferences(restored)).values.get('locale')).toBe(locale);
  await saveSetting(restored, 'locale', 'en');
  expect((await projectPreferences('language-profile')).values.get('locale')).toBe(locale);
  const count = await syncEvents.count();
  await expect(savePreferences('language-profile', preferences, 'jp')).rejects.toThrow('INVALID_LOCALE');
  expect(await syncEvents.count()).toBe(count);
});

it('clears optional starting choices and reads legacy undefined values without changing saved events', async () => {
  const id = 'revisit';
  await profiles.add({ id, name: 'Revisit', createdAt: new Date().toISOString() });
  const chosen = { ...initialPreferences, purpose: 'travel' as const, reading: 'B2' as const, listening: 'A2' as const, interests: ['science' as const], completed: true };
  await savePreferences(id, chosen, 'en');
  const cleared = { ...chosen, purpose: undefined, reading: undefined, listening: undefined };
  await savePreferences(id, cleared, 'en');
  const expected = { interests: ['science'], step: 0, completed: true };
  expect((await projectPreferences(id)).preferences).toEqual(expected);
  expect(Object.keys((await profiles.get(id))!.preferences!)).toEqual(Object.keys(expected));
  // Support legacy IndexedDB rows containing explicit undefined properties.
  await profiles.update(id, { preferences: cleared });
  const event = (await syncEvents.where('profileId').equals(id).toArray()).find(row => row.type === 'preferences' && row.counter === 3)!;
  await syncEvents.update([id, event.id], { payload: cleared });
  const originalEvents = await syncEvents.where('profileId').equals(id).toArray();
  expect((await projectPreferences(id)).preferences).toEqual(expected);
  expect(await syncEvents.where('profileId').equals(id).toArray()).toEqual(originalEvents);
  const { pendingSyncBatch } = await import('../src/data/sync');
  const batch = await pendingSyncBatch(id);
  expect(batch?.batch.events.filter(row => row.type === 'preferences').at(-1)?.payload).toEqual(expected);
  const restored = await importBackup(await inspectBackup(await exportBackup(id)));
  expect((await projectPreferences(restored)).preferences).toEqual(expected);
  expect((await projectPreferences(id)).preferences).toEqual(expected);
  expect(preferencesSchema.safeParse({ ...cleared, extra: true }).success).toBe(false);
});
