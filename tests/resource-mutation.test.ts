import Dexie from 'dexie';
import { afterEach, expect, it, vi } from 'vitest';
import { communityPacks, db } from '../src/data/db';
import { mutateResourceCache } from '../src/data/resourceMutation';
import { communityDictionary, communityDictionaryTerms } from '../src/data/communityInstall';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('uses the browser cache lock and passes cancellation through without running rejected work', async () => {
  const controller = new AbortController(), work = vi.fn(async () => true);
  const request = vi.fn(async (_name: string, options: LockOptions) => { controller.abort(); options.signal!.throwIfAborted(); });
  vi.stubGlobal('navigator', { locks: { request } });
  await expect(mutateResourceCache('lingfern-resource-test', work, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(request).toHaveBeenCalledWith('lingfern-resource-test', { signal: controller.signal }, expect.any(Function));
  expect(work).not.toHaveBeenCalled();
});

it('serializes fallback mutations across independent IndexedDB connections and cancels queued work', async () => {
  vi.stubGlobal('navigator', {});
  await mutateResourceCache('lingfern-resource-test', async () => {});
  const other = new Dexie('lingfern-resource-mutations'); await other.open();
  let release!: () => void, reached!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }), entered = new Promise<void>(resolve => { reached = resolve; });
  const first = other.transaction('rw', other.table('locks'), async () => { await other.table('locks').get('lingfern-resource-test'); reached(); await Dexie.waitFor(gate, Infinity); });
  await entered;
  const controller = new AbortController(), work = vi.fn(async () => true);
  const second = mutateResourceCache('lingfern-resource-test', work, controller.signal).catch(error => error);
  try {
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(work).not.toHaveBeenCalled();
    controller.abort(); release(); await first;
    expect(await second).toMatchObject({ name: 'AbortError' });
    expect(work).not.toHaveBeenCalled();
    expect(await mutateResourceCache('lingfern-resource-test', async () => 'recovered')).toBe('recovered');
  } finally { release(); await first; other.close(); }
});

it('allows main-database answer coordination while a fallback cache mutation is held', async () => {
  vi.stubGlobal('navigator', {});
  let release!: () => void, reached!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }), entered = new Promise<void>(resolve => { reached = resolve; });
  const held = mutateResourceCache('lingfern-resource-test', async () => { reached(); await gate; });
  const profileId = 'resource-mutation-answer-coordination';
  try {
    await entered;
    await db.transaction('rw', db.table('syncClocks'), async () => {
      await db.table('syncClocks').put({ profileId, deviceId: 'synthetic-device', counter: 1 });
    });
    expect((await db.table('syncClocks').get(profileId)).counter).toBe(1);
  } finally { release(); await held; await db.table('syncClocks').delete(profileId); }
});

it('prevents late fallback work from mutating state after its IndexedDB transaction aborts', async () => {
  vi.stubGlobal('navigator', {});
  let release!: () => void, reached!: () => void, transaction!: IDBTransaction;
  const original = IDBDatabase.prototype.transaction;
  vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function(this: IDBDatabase, ...args: Parameters<IDBDatabase['transaction']>) {
    const current = Reflect.apply(original, this, args) as IDBTransaction;
    if (this.name === 'lingfern-resource-mutations' && current.mode === 'readwrite') transaction = current;
    return current;
  });
  const gate = new Promise<void>(resolve => { release = resolve; }), entered = new Promise<void>(resolve => { reached = resolve; });
  const cleanup = vi.fn();
  let late!: Promise<void>;
  const first = mutateResourceCache('lingfern-resource-test', async assertActive => {
    reached();
    late = gate.then(() => { assertActive(); cleanup(); });
    await late;
  }).catch(error => error);
  await entered;
  transaction.abort();
  expect(await Dexie.ignoreTransaction(() => mutateResourceCache('lingfern-resource-test', async () => 'success'))).toBe('success');
  release();
  await expect(late).rejects.toThrow('RESOURCE_MUTATION_ABORTED');
  expect(await first).toBeInstanceOf(Error);
  expect(cleanup).not.toHaveBeenCalled();
});

it('keeps dictionary output while excluding empty, staged and other-profile packages', async () => {
  const profileId = 'isolated-community-dictionary';
  const entry = { term: 'Apple', definition: 'A fruit.', example: 'I ate an apple.', sourceId: 'fruit' };
  const record = (hash: string, dictionary?: typeof entry[], state: 'ready' | 'staged' = 'ready', profile = profileId) => ({ profileId: profile, hash, id: hash, lessons: [], sources: [], dictionary, state, installedAt: new Date().toISOString() });
  await communityPacks.bulkPut([
    record('undefined'), record('empty', []), record('mixed', [entry, { ...entry, term: 'Banana' }]),
    record('staged', [entry], 'staged'), record('foreign', [entry], 'ready', 'other-dictionary-profile'),
  ]);
  try {
    expect(await communityDictionary(profileId, '  apple  ')).toEqual([{ ...entry, source: 'mixed' }]);
    expect(await communityDictionaryTerms(profileId)).toEqual(['apple', 'banana']);
    expect(await communityDictionary(profileId, '')).toEqual([]);
  } finally { await communityPacks.where('profileId').anyOf([profileId, 'other-dictionary-profile']).delete(); }
});

