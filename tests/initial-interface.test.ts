import { beforeEach, expect, it } from 'vitest';
import { db, profiles, settings } from '../src/data/db';
import { defaultInterface, readInitialInterface } from '../src/app/initialInterface';

beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });

it('returns defaults without creating a profile or writing settings', async () => {
  expect(await readInitialInterface('fr')).toEqual(defaultInterface('fr'));
  expect(await profiles.count()).toBe(0); expect(await settings.count()).toBe(0);
});

it('reads the selected profile atomically and leaves both profiles unchanged', async () => {
  await profiles.bulkAdd(['a', 'b'].map(id => ({ id, name: id, createdAt: new Date().toISOString() })));
  await settings.bulkPut([
    { key: 'activeProfile', value: 'b' }, { key: 'profile:a:locale', value: 'fr' },
    ...Object.entries({ locale: 'ar', theme: 'dark', desktopNavDisplay: 'both', mobileNavDisplay: 'icon' }).map(([key, value]) => ({ key: `profile:b:${key}`, value })),
  ]);
  const before = await settings.toArray();
  expect(await readInitialInterface('en')).toEqual({ locale: 'ar', theme: 'dark', desktopNavDisplay: 'both', mobileNavDisplay: 'icon' });
  expect(await settings.toArray()).toEqual(before); expect(await profiles.count()).toBe(2);
});

it('uses the same first-profile fallback as the application without changing selection', async () => {
  await profiles.add({ id: 'first', name: 'First', createdAt: new Date().toISOString() });
  await settings.bulkPut([{ key: 'activeProfile', value: 'missing' }, { key: 'profile:first:locale', value: 'ja' }]);
  expect((await readInitialInterface('en')).locale).toBe('ja');
  expect((await settings.get('activeProfile'))?.value).toBe('missing');
});

it('rejects invalid display values without replacing stored settings', async () => {
  await profiles.add({ id: 'a', name: 'A', createdAt: new Date().toISOString() });
  await settings.bulkPut(['locale', 'theme', 'desktopNavDisplay', 'mobileNavDisplay'].map(key => ({ key: `profile:a:${key}`, value: '<invalid>' })));
  const before = await settings.toArray();
  expect(await readInitialInterface('zh-Hant')).toEqual(defaultInterface('zh-Hant'));
  expect(await settings.toArray()).toEqual(before);
});
