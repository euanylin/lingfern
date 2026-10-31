import { expect, test, type Page } from '@playwright/test';
import type { CommunityPack } from '../../src/data/communityPack';

type ResourceState = {
  pack: CommunityPack;
  status: 'idle' | 'pending' | 'success' | 'error';
  errorName?: string;
  blocked: boolean;
  markerPuts: number;
  transactions: number;
  requests: number;
  requestSuccesses: number;
  controller?: AbortController;
  release?: () => void;
  task?: Promise<void>;
};
declare global { interface Window { resourceState: ResourceState } }

async function prepare(page: Page, fallback: boolean, hash: string, profileId: string, holdMarker: boolean) {
  await page.goto('/__resource-concurrency-test');
  await page.evaluate(async ({ fallback, hash, profileId, holdMarker }) => {
    Object.defineProperty(navigator.serviceWorker, 'ready', { configurable: true, value: Promise.resolve({ active: {} }) });
    Object.defineProperty(navigator.serviceWorker, 'getRegistration', { configurable: true, value: async () => ({ active: {} }) });
    if (fallback) Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    const state = { status: 'idle', blocked: false, markerPuts: 0, transactions: 0, requests: 0, requestSuccesses: 0 } as ResourceState;
    window.resourceState = state;
    const monitored = new WeakSet<IDBTransaction>();
    const originalTransaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = new Proxy(originalTransaction, {
      apply(target, database: IDBDatabase, args) {
        const transaction = Reflect.apply(target, database, args) as IDBTransaction;
        if (database.name === 'lingfern-resource-mutations' && transaction.mode === 'readwrite') {
          state.transactions++; monitored.add(transaction);
        }
        return transaction;
      },
    });
    for (const method of ['get', 'getAll', 'getAllKeys', 'count', 'openCursor', 'openKeyCursor'] as const) {
      const original = IDBObjectStore.prototype[method];
      Object.defineProperty(IDBObjectStore.prototype, method, { configurable: true, value: new Proxy(original, {
        apply(target, store: IDBObjectStore, args) {
          const request = Reflect.apply(target, store, args) as IDBRequest;
          if (monitored.has(store.transaction)) {
            state.requests++;
            request.addEventListener('success', () => { state.requestSuccesses++; });
          }
          return request;
        },
      }) });
    }
    const marker = `/audio/community-${hash}/ready`, originalPut = Cache.prototype.put;
    Cache.prototype.put = async function(request, response) {
      const path = new URL(request instanceof Request ? request.url : String(request), location.href).pathname;
      if (path === marker) {
        state.markerPuts++;
        if (holdMarker && !state.blocked) {
          state.blocked = true;
          await new Promise<void>(resolve => { state.release = resolve; });
        }
      }
      return originalPut.call(this, request, response);
    };
    const [{ db }, { corpusSchema }] = await Promise.all([import('/src/data/db.ts' as string), import('/src/core/corpus.ts' as string)]);
    await db.open();
    await db.table('profiles').put({ id: profileId, name: 'Synthetic cache concurrency', createdAt: '2026-10-30T00:00:00.000Z' });
    const id = 'lingfern-dialogue-resource-concurrency', url = `https://lingfern.com/corpus/${id}`;
    const text = 'This is synthetic source text for an isolated cache concurrency test.';
    const sourceHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(value => value.toString(16).padStart(2, '0')).join('');
    const source = { id, rootId: id, title: 'Synthetic source only', authors: ['Test fixture'], originalUrl: url, downloadUrl: url,
      acquiredAt: '2026-10-30T00:00:00.000Z', language: 'en', licence: 'Synthetic test content', licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
      attribution: 'Synthetic test fixture', sourceHash, originalText: text, reviewStatus: 'draft', permissionReview: 'Isolated synthetic test only', editorialReview: 'pending', processing: 'Concurrency regression fixture', passages: [] };
    state.pack = { id: 'synthetic-concurrency', hash, lessons: [], dictionary: [], media: {},
      sources: [{ id, title: source.title, author: 'Test fixture', license: source.licence, attribution: source.attribution, sourceUrl: url }],
      corpus: corpusSchema.parse({ version: 1, records: [source], failures: [] }) };
    await import('/src/data/communityInstall.ts' as string);
    state.transactions = 0; state.requests = 0; state.requestSuccesses = 0;
  }, { fallback, hash, profileId, holdMarker });
}

async function start(page: Page, profileId: string) {
  await page.evaluate(async profileId => {
    const { installCommunityPack } = await import('/src/data/communityInstall.ts' as string);
    const state = window.resourceState;
    state.controller = new AbortController(); state.status = 'pending';
    state.task = installCommunityPack(state.pack, profileId, state.controller.signal).then(() => { state.status = 'success'; }, (error: Error) => { state.status = 'error'; state.errorName = error.name; });
  }, profileId);
}

for (const fallback of [false, true]) test(`two tabs preserve a completed resource after another installer cancels: ${fallback ? 'IndexedDB fallback' : 'Web Locks'}`, async ({ context, page }) => {
  await context.route('**/__resource-concurrency-test', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Isolated cache concurrency</title>' }));
  const other = await context.newPage(), hash = (fallback ? 'b' : 'a').repeat(64), profileId = `synthetic-resource-${fallback ? 'fallback' : 'native'}`;
  const name = `lingfern-community-${hash}`, errors: string[] = [];
  for (const tab of [page, other]) tab.on('pageerror', error => errors.push(error.message));
  try {
    await Promise.all([prepare(page, fallback, hash, profileId, true), prepare(other, fallback, hash, profileId, false)]);
    await start(page, profileId);
    await expect.poll(() => page.evaluate(() => window.resourceState.blocked)).toBe(true);
    await start(other, profileId);
    if (fallback) {
      await expect.poll(() => other.evaluate(() => window.resourceState.transactions)).toBeGreaterThan(0);
      await expect.poll(() => other.evaluate(() => window.resourceState.requests)).toBeGreaterThan(0);
      expect(await other.evaluate(() => window.resourceState.requestSuccesses)).toBe(0);
    } else {
      await expect.poll(() => other.evaluate(async name => {
        const locks = await navigator.locks.query();
        return { held: locks.held?.filter(lock => lock.name === name).length, pending: locks.pending?.filter(lock => lock.name === name).length };
      }, name)).toEqual({ held: 1, pending: 1 });
    }
    expect(await other.evaluate(() => ({ status: window.resourceState.status, markerPuts: window.resourceState.markerPuts }))).toEqual({ status: 'pending', markerPuts: 0 });
    await page.evaluate(() => { const state = window.resourceState; state.controller!.abort(); state.release!(); });
    await expect.poll(() => page.evaluate(() => window.resourceState.status)).toBe('error');
    expect(await page.evaluate(() => window.resourceState.errorName)).toBe('AbortError');
    await expect.poll(() => other.evaluate(() => window.resourceState.status)).toBe('success');
    await Promise.all([page, other].map(tab => tab.evaluate(() => window.resourceState.task)));
    const result = await other.evaluate(async ({ profileId, hash, name }) => {
      const { communityPacks } = await import('/src/data/db.ts' as string);
      const { communityPackageReady, communityMarker } = await import('/src/data/communityInstall.ts' as string);
      const cache = await caches.open(name), marker = await cache.match(communityMarker(hash));
      const record = await communityPacks.get([profileId, hash]);
      return { caches: (await caches.keys()).filter(name => name.startsWith('lingfern-community-')), marker: await marker?.text(),
        ready: await communityPackageReady(window.resourceState.pack), state: record?.state,
        rows: await communityPacks.where('profileId').equals(profileId).count(), keys: (await cache.keys()).map(request => new URL(request.url).pathname) };
    }, { profileId, hash, name });
    expect(result).toEqual({ caches: [name], marker: 'ready', ready: true, state: 'ready', rows: 1, keys: [`/audio/community-${hash}/ready`] });
    expect(errors).toEqual([]);
  } finally {
    await Promise.all([page, other].map(tab => tab.evaluate(() => { const state = window.resourceState; state?.controller?.abort(); state?.release?.(); }).catch(() => {})));
    await other.close();
  }
});
