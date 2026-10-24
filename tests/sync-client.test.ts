import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { db, profiles, settings } from '../src/data/db';
import { appendSyncEvent, nextSyncUpload } from '../src/data/sync';
import { allowSyncUpload, downloadSyncPage, prepareAutoSync, readSyncState, requestSyncNow, restartSyncDownload, readSyncConsent, stopSyncUpload, synchronize, uploadSyncBatch } from '../src/data/syncClient';
import { validateSyncBatch } from '../src/shared/sync';
import { type SessionSummary } from '../src/shared/auth';
import { exportBackup, inspectBackup, importBackup } from '../src/data/backup';
import { readLookupHistory } from '../src/data/lookupHistory';

const scope = { accountId: 1, profileId: 'p', bindingVersion: 'a'.repeat(43) };
const summary: SessionSummary = { account: { id: 1, login: 'learner' }, csrfToken: 't'.repeat(43), syncAvailable: true, bindings: [{ name: 'lingfern-data', owner: 'learner', profileId: 'p', disabled: false, bindingVersion: scope.bindingVersion }] };
beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()));
  await settings.put({ key: 'activeProfile', value: 'p' });
  await profiles.put({ id: 'p', name: 'Local', createdAt: new Date().toISOString() });
  await settings.put({ key: 'profile:p:syncAccount', value: JSON.stringify({ accountId: 1, profileId: 'p' }) });
  await appendSyncEvent('p', { type: 'saved_item', payload: { memoryId: 'sense', saved: true } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('defaults a configured scope to automatic sync while preserving opt-out and account isolation', async () => {
  const [one, two] = await Promise.all([prepareAutoSync('p', summary), prepareAutoSync('p', summary)]);
  expect(one).toEqual(two); expect(one?.scope).toEqual(scope);
  await stopSyncUpload('p', scope);
  expect(await prepareAutoSync('p', summary)).toBeUndefined();
  db.close(); await db.open();
  expect(await prepareAutoSync('p', summary)).toBeUndefined();
  expect(await prepareAutoSync('p', { ...summary, account: { id: 2, login: 'other' } })).toBeUndefined();
  const enabled = await allowSyncUpload('p', scope, summary);
  expect(await prepareAutoSync('p', summary)).toEqual(enabled);
});

it('reads and applies remote events before uploading, drains both directions and never echoes received batches', async () => {
  const remote = await validateSyncBatch({ product: 'Lingfern', formatVersion: 1, profileId: 'p', deviceId: 'remote', batchId: 'history', events: [{ id: 'lookup-remote', deviceId: 'remote', counter: 1, occurredAt: '2026-10-01T00:00:00.000Z', type: 'lookup', payload: { kind: 'grammar', term: 'each / every', lookedUpAt: '2026-10-01T00:00:00.000Z' } }] });
  const file = { deviceId: 'remote', batchId: 'history', blobSha: 'b'.repeat(40), bytes: remote.bytes.length };
  let applied = false, reads = 0, posts = 0;
  const fetch = vi.fn(async (path: string, init: RequestInit) => {
    if (path === '/api/session') return Response.json(summary);
    if (path.startsWith('/api/sync/changes?')) {
      const params = new URL(path, 'https://local.test').searchParams;
      if (params.has('sinceCommit')) return Response.json({ scope, commit: 'c'.repeat(40), unchanged: true });
      reads++;
      return Response.json({ scope, commit: 'c'.repeat(40), cursor: 'full', total: 1, files: [file], batches: params.has('metadata') ? [] : [{ batch: remote.batch, hash: remote.hash, blobSha: file.blobSha }] });
    }
    expect(applied).toBe(true); posts++;
    const value = JSON.parse(init.body as string);
    expect(value.batch.deviceId).not.toBe('remote');
    return Response.json({ scope, batchId: value.batch.batchId, hash: value.hash, previouslyWritten: false });
  });
  vi.stubGlobal('fetch', fetch);
  const consent = (await prepareAutoSync('p', summary))!;
  const merge = async () => { expect((await readLookupHistory('p'))[0].term).toBe('each / every'); applied = true; };
  await synchronize('p', consent, merge, new AbortController().signal);
  expect(reads).toBe(2); expect(posts).toBe(1);
  expect(await nextSyncUpload('p', scope)).toBeUndefined();
  expect(await readSyncState('p', scope)).toMatchObject({ phase: 'synced', attempts: 0 });
  const success = (await readSyncState('p', scope))!.lastSuccessAt;
  const before = fetch.mock.calls.length;
  await synchronize('p', consent, merge, new AbortController().signal);
  expect(fetch.mock.calls).toHaveLength(before);
  await requestSyncNow('p', scope);
  await synchronize('p', consent, merge, new AbortController().signal);
  expect(fetch.mock.calls).toHaveLength(before + 2); expect(posts).toBe(1);
  expect((await readSyncState('p', scope))!.lastSuccessAt! >= success!).toBe(true);
  const scan = vi.spyOn(db.table('syncBatches'), 'where');
  const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 125000);
  await synchronize('p', consent, merge, new AbortController().signal);
  expect(scan).not.toHaveBeenCalled(); clock.mockRestore();
});

it('retains the outbox and never reports success when the initial remote read fails', async () => {
  vi.stubGlobal('fetch', vi.fn(async (path: string) => path === '/api/session' ? Response.json(summary) : Response.json({ error: 'REPOSITORY_FAILED' }, { status: 503 })));
  const consent = (await prepareAutoSync('p', summary))!;
  await expect(synchronize('p', consent, async () => {}, new AbortController().signal)).rejects.toThrow('REPOSITORY_FAILED');
  const state = await readSyncState('p', scope);
  expect(state).toMatchObject({ phase: 'error', attempts: 1, error: 'REPOSITORY_FAILED' });
  expect(state!.lastSuccessAt).toBeUndefined();
  expect(await nextSyncUpload('p', scope)).toBeDefined();
  expect(await db.table('syncUploads').count()).toBe(0);
});

it('needs explicit scoped consent, never transfers it through backups, and checks fresh session/CSRF before a bounded upload', async () => {
  const fetch = vi.fn(async (path: string, init: RequestInit) => {
    expect(init.credentials).toBe('same-origin'); expect(init.cache).toBe('no-store'); expect(init.redirect).toBe('error');
    if (path === '/api/session') return Response.json({ ...summary, csrfToken: 'n'.repeat(43) });
    expect(path).toBe('/api/sync/batches'); expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'X-CSRF-Token': 'n'.repeat(43) });
    const value = JSON.parse(init.body as string);
    expect(value.scope).toEqual(scope);
    expect(value.batch.events[0].payload).toEqual({ memoryId: 'sense', saved: true });
    return Response.json({ scope, batchId: value.batch.batchId, hash: value.hash, previouslyWritten: false });
  });
  vi.stubGlobal('fetch', fetch);
  expect(await readSyncConsent('p')).toBeUndefined();
  const consent = await allowSyncUpload('p', scope, summary);
  expect(fetch).not.toHaveBeenCalled();
  expect(await readSyncConsent('p')).toEqual(consent);
  const restored = await importBackup(await inspectBackup(await exportBackup('p')));
  expect(await readSyncConsent(restored)).toBeUndefined();
  await settings.put({ key: 'activeProfile', value: 'p' });
  expect(await uploadSyncBatch('p', consent)).toBe('uploaded');
  expect(await uploadSyncBatch('p', consent)).toBe('idle');
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(await db.table('syncUploads').count()).toBe(1);
});

it('stops before POST after an account, binding, availability or local-association change', async () => {
  const consent = await allowSyncUpload('p', scope, summary);
  for (const changed of [{ ...summary, account: { id: 2, login: 'other' } }, { ...summary, syncAvailable: false }, { ...summary, bindings: [{ ...summary.bindings![0], bindingVersion: 'b'.repeat(43) }] }]) {
    const fetch = vi.fn(async () => Response.json(changed)); vi.stubGlobal('fetch', fetch);
    await expect(uploadSyncBatch('p', consent)).rejects.toThrow('SYNC_SCOPE_CHANGED');
    expect(fetch).toHaveBeenCalledTimes(1);
  }
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  await settings.put({ key: 'profile:p:syncAccount', value: JSON.stringify({ accountId: 2, profileId: 'p' }) });
  await expect(uploadSyncBatch('p', consent)).rejects.toThrow('SYNC_SCOPE_CHANGED');
  expect(fetch).not.toHaveBeenCalled();
  expect(await db.table('syncUploads').count()).toBe(0);
});

it('retries an immutable batch after a lost acknowledgement and rejects oversized or forged replies', async () => {
  const consent = await allowSyncUpload('p', scope, summary), ids: string[] = [];
  let mode = 'lost';
  vi.stubGlobal('fetch', vi.fn(async (path: string, init: RequestInit) => {
    if (path === '/api/session') return Response.json(summary);
    const value = JSON.parse(init.body as string); ids.push(value.batch.batchId);
    if (mode === 'lost') throw new Error('NETWORK');
    if (mode === 'large') return Response.json({ text: 'x'.repeat(65536) });
    return Response.json({ scope: mode === 'wrong' ? { ...scope, accountId: 2 } : scope, batchId: value.batch.batchId, hash: value.hash, previouslyWritten: true });
  }));
  for (const [next, error] of [['lost', 'NETWORK'], ['large', 'SYNC_RESPONSE_LIMIT'], ['wrong', 'SYNC_ACK_INVALID']]) {
    mode = next;
    await expect(uploadSyncBatch('p', consent)).rejects.toThrow(error);
    expect(await db.table('syncUploads').count()).toBe(0);
  }
  mode = 'valid'; expect(await uploadSyncBatch('p', consent)).toBe('uploaded');
  expect(new Set(ids).size).toBe(1);
});

it('revocation or renewed consent during an upload cannot confirm its late reply', async () => {
  let consent = await allowSyncUpload('p', scope, summary);
  for (const renew of [false, true]) {
    vi.stubGlobal('fetch', vi.fn(async (path: string, init: RequestInit) => {
      if (path === '/api/session') return Response.json(summary);
      const value = JSON.parse(init.body as string);
      if (renew) await allowSyncUpload('p', scope, summary); else await stopSyncUpload('p');
      return Response.json({ scope, batchId: value.batch.batchId, hash: value.hash, previouslyWritten: true });
    }));
    await expect(uploadSyncBatch('p', consent)).rejects.toThrow('SYNC_CONSENT_CHANGED');
    expect(await db.table('syncUploads').count()).toBe(0);
    expect((await nextSyncUpload('p', scope))?.state).toBe('pending');
    consent = await allowSyncUpload('p', scope, summary);
  }
  await stopSyncUpload('p');
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  await expect(uploadSyncBatch('p', consent)).rejects.toThrow('SYNC_CONSENT_CHANGED');
  expect(fetch).not.toHaveBeenCalled();
});


it('does not grant consent after storage failure or send when the active profile changes', async () => {
  const fail = () => { throw new Error('STORAGE_FAILURE'); };
  settings.hook('creating', fail);
  await expect(allowSyncUpload('p', scope, summary)).rejects.toThrow('STORAGE_FAILURE');
  settings.hook('creating').unsubscribe(fail);
  expect(await readSyncConsent('p')).toBeUndefined();
  const consent = await allowSyncUpload('p', scope, summary);
  await settings.put({ key: 'activeProfile', value: 'other' });
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  await expect(uploadSyncBatch('p', consent)).rejects.toThrow('SYNC_SCOPE_CHANGED');
  expect(fetch).not.toHaveBeenCalled();
});


async function remotePage() {
  const value = await validateSyncBatch({ product: 'Lingfern', formatVersion: 1, profileId: 'p', deviceId: 'remote', batchId: 'remote-one', events: [{ id: 'remote-event', deviceId: 'remote', counter: 2, occurredAt: '2026-01-01T00:00:00.000Z', type: 'saved_item', payload: { memoryId: 'remote-sense', saved: true } }] });
  const file = { deviceId: 'remote', batchId: 'remote-one', blobSha: 'b'.repeat(40), bytes: value.bytes.length };
  return { scope, commit: 'c'.repeat(40), cursor: 'first', total: 1, files: [file], batches: [{ batch: value.batch, hash: value.hash, blobSha: file.blobSha }] };
}

it('downloads a fixed page atomically, resumes next cursors and sends only verified known receipts', async () => {
  const page = await remotePage();
  const second = await validateSyncBatch({ ...page.batches[0].batch, batchId: 'remote-two', events: page.batches[0].batch.events.map(event => ({ ...event, id: 'remote-event-two', counter: 3 })) });
  const secondPage = { ...page, cursor: 'second', total: 2, files: [{ ...page.files[0], batchId: 'remote-two', blobSha: 'e'.repeat(40), bytes: second.bytes.length }], batches: [{ batch: second.batch, hash: second.hash, blobSha: 'e'.repeat(40) }] };
  let round = 0; const known: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn(async (path: string) => {
    if (path === '/api/session') return Response.json(summary);
    const query = new URL(path, 'http://local').searchParams;
    expect(query.get('profileId')).toBe('p');
    if (round === 0) {
      if (query.get('metadata')) { expect(query.get('cursor')).toBeNull(); return Response.json({ ...page, nextCursor: 'second', total: 2, batches: [] }); }
      expect(query.get('cursor')).toBe('first'); known.push(JSON.parse(query.get('known')!));
      return Response.json({ ...page, nextCursor: 'second', total: 2 });
    }
    if (round === 1) {
      expect(query.get('cursor')).toBe('second');
      return Response.json(query.get('metadata') ? { ...secondPage, batches: [] } : secondPage);
    }
    if (query.get('metadata')) return Response.json({ ...page, commit: 'd'.repeat(40), cursor: 'new-round', batches: [] });
    expect(query.get('cursor')).toBe('new-round'); known.push(JSON.parse(query.get('known')!));
    return Response.json({ ...page, commit: 'd'.repeat(40), cursor: 'new-round', batches: [] });
  }));
  expect((await downloadSyncPage('p', scope)).nextCursor).toBe('second');
  round = 1; expect((await downloadSyncPage('p', scope)).nextCursor).toBeUndefined();
  round = 2; await downloadSyncPage('p', scope);
  expect(known).toEqual([[], [{ deviceId: 'remote', batchId: 'remote-one', blobSha: 'b'.repeat(40) }]]);
  expect(await db.table('syncEvents').count()).toBe(3);
  expect(await db.table('syncReceipts').count()).toBe(2);
  expect(await readSyncConsent('p')).toBeUndefined(); // Reading does not authorize uploads.
});

it('failed, foreign or changed download pages do not advance cursors or overwrite local events', async () => {
  const page = await remotePage(); let mode = 'lost';
  vi.stubGlobal('fetch', vi.fn(async (path: string) => {
    if (path === '/api/session') return Response.json(summary);
    if (new URL(path, 'http://local').searchParams.has('metadata')) return Response.json({ ...page, batches: [] });
    if (mode === 'lost') throw new Error('NETWORK');
    if (mode === 'scope') return Response.json({ ...page, scope: { ...scope, accountId: 2 } });
    if (mode === 'commit') return Response.json({ ...page, commit: 'd'.repeat(40) });
    if (mode === 'profile') await settings.put({ key: 'activeProfile', value: 'other' });
    return Response.json(page);
  }));
  for (const [next, error] of [['lost', 'NETWORK'], ['scope', 'SYNC_SCOPE_CHANGED'], ['commit', 'SYNC_DOWNLOAD_CHANGED'], ['profile', 'SYNC_SCOPE_CHANGED']]) {
    mode = next; await expect(downloadSyncPage('p', scope)).rejects.toThrow(error);
    expect(await db.table('syncDownloads').count()).toBe(0); expect(await db.table('syncReceipts').count()).toBe(0);
    expect(await db.table('syncEvents').count()).toBe(1);
  }
  await settings.put({ key: 'activeProfile', value: 'p' }); mode = 'valid';
  const fail = () => { throw new Error('STORAGE_FAILURE'); }; db.table('syncDownloads').hook('creating', fail);
  await expect(downloadSyncPage('p', scope)).rejects.toThrow('STORAGE_FAILURE');
  expect(await db.table('syncEvents').count()).toBe(1); expect(await db.table('syncReceipts').count()).toBe(0);
  db.table('syncDownloads').hook('creating').unsubscribe(fail);
  await downloadSyncPage('p', scope); expect(await db.table('syncEvents').count()).toBe(2);
});


it('expired cursors require an explicit CAS rescan that keeps records and receipts', async () => {
  const page = await remotePage(); let expired = false;
  vi.stubGlobal('fetch', vi.fn(async (path: string) => {
    if (path === '/api/session') return Response.json(summary);
    if (expired) return Response.json({ error: 'SYNC_CURSOR_INVALID' }, { status: 400 });
    return Response.json(new URL(path, 'http://local').searchParams.has('metadata') ? { ...page, nextCursor: 'expired-next', batches: [] } : { ...page, nextCursor: 'expired-next' });
  }));
  await downloadSyncPage('p', scope); expired = true;
  await expect(downloadSyncPage('p', scope)).rejects.toThrow('SYNC_CURSOR_INVALID');
  await expect(restartSyncDownload('p', scope, 'stale-tab')).rejects.toThrow('SYNC_DOWNLOAD_CHANGED');
  const before = await db.table('syncEvents').toArray();
  const receipts = await db.table('syncReceipts').toArray();
  await restartSyncDownload('p', scope, 'first');
  expect(await db.table('syncDownloads').count()).toBe(0);
  expect(await db.table('syncEvents').toArray()).toEqual(before);
  expect(await db.table('syncReceipts').toArray()).toEqual(receipts);
});

it('serializes fallback-tab uploads, releases the lease and preserves immutable retry identity', async () => {
  vi.stubGlobal('navigator', {});
  const consent = await allowSyncUpload('p', scope, summary);
  let enter!: () => void, release!: () => void;
  const entered = new Promise<void>(resolve => { enter = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const fetch = vi.fn(async (path: string, init: RequestInit) => {
    if (path === '/api/session') { enter(); await gate; return Response.json(summary); }
    const value = JSON.parse(init.body as string);
    return Response.json({ scope, batchId: value.batch.batchId, hash: value.hash, previouslyWritten: false });
  });
  vi.stubGlobal('fetch', fetch);
  const first = uploadSyncBatch('p', consent); await entered;
  await expect(uploadSyncBatch('p', consent)).rejects.toThrow('SYNC_BUSY');
  expect(fetch).toHaveBeenCalledTimes(1);
  release(); expect(await first).toBe('uploaded');
  expect(await settings.get('profile:p:syncLease')).toBeUndefined();
  expect(await uploadSyncBatch('p', consent)).toBe('idle');
});

it('honours provider retry timing across calls without confirming batches or blocking a different binding', async () => {
  const consent = await allowSyncUpload('p', scope, summary);
  const fetch = vi.fn(async () => Response.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': '60' } }));
  vi.stubGlobal('fetch', fetch);
  await expect(uploadSyncBatch('p', consent)).rejects.toThrow('RATE_LIMITED');
  await expect(uploadSyncBatch('p', consent)).rejects.toThrow('SYNC_RETRY_LATER');
  expect(fetch).toHaveBeenCalledTimes(1); expect(await db.table('syncUploads').count()).toBe(0);
  const other = { ...scope, bindingVersion: 'b'.repeat(43) };
  const otherSummary = { ...summary, bindings: [{ ...summary.bindings![0], bindingVersion: other.bindingVersion }] };
  const next = await allowSyncUpload('p', other, otherSummary);
  await expect(uploadSyncBatch('p', next)).rejects.toThrow('RATE_LIMITED');
  expect(fetch).toHaveBeenCalledTimes(2);
});


it('rejects withdrawn consent before a busy native lock and makes no network request', async () => {
  const consent = await allowSyncUpload('p', scope, summary);
  await stopSyncUpload('p');
  const request = vi.fn(async (_name: string, _options: unknown, run: (lock: null) => unknown) => run(null));
  const fetch = vi.fn(); vi.stubGlobal('navigator', { locks: { request } }); vi.stubGlobal('fetch', fetch);
  await expect(uploadSyncBatch('p', consent)).rejects.toThrow('SYNC_CONSENT_CHANGED');
  expect(request).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});

it('resumes a bounded multi-page read before sending any local batch and never marks a partial round successful', async () => {
  let reads = 0, posts = 0;
  const remote = await Promise.all(Array.from({ length: 4 }, (_, i) => validateSyncBatch({ product: 'Lingfern', formatVersion: 1, profileId: 'p', deviceId: 'remote', batchId: `page-${i}`, events: [{ id: `entry-${i}`, deviceId: 'remote', counter: i + 1, occurredAt: '2026-10-01T00:00:00.000Z', type: 'lookup', payload: { kind: 'dictionary', term: `word-${i}`, lookedUpAt: '2026-10-01T00:00:00.000Z' } }] })));
  vi.stubGlobal('fetch', vi.fn(async (path: string, init: RequestInit) => {
    if (path === '/api/session') return Response.json(summary);
    if (path.startsWith('/api/sync/changes?')) {
      reads++;
      const params = new URL(path, 'https://local.test').searchParams;
      if (params.has('sinceCommit')) return Response.json({ scope, commit: 'c'.repeat(40), unchanged: true });
      const index = Number(params.get('cursor') ?? 0), value = remote[index];
      const blobSha = String(index + 1).repeat(40), files = [{ deviceId: 'remote', batchId: value.batch.batchId, blobSha, bytes: value.bytes.length }];
      return Response.json({ scope, commit: 'c'.repeat(40), cursor: String(index), total: 4, ...(index < 3 ? { nextCursor: String(index + 1) } : {}), files, batches: params.has('metadata') ? [] : [{ batch: value.batch, hash: value.hash, blobSha }] });
    }
    posts++; expect((await readLookupHistory('p'))).toHaveLength(4);
    const value = JSON.parse(init.body as string); return Response.json({ scope, batchId: value.batch.batchId, hash: value.hash, previouslyWritten: false });
  }));
  const consent = (await prepareAutoSync('p', summary))!;
  await synchronize('p', consent, async () => {}, new AbortController().signal);
  expect(reads).toBe(6); expect(posts).toBe(0);
  expect(await readSyncState('p', scope)).toMatchObject({ phase: 'pending' });
  expect((await readSyncState('p', scope))?.lastSuccessAt).toBeUndefined();
  await requestSyncNow('p', scope); await synchronize('p', consent, async () => {}, new AbortController().signal);
  expect(reads).toBe(9); expect(posts).toBe(1); expect((await readSyncState('p', scope))?.phase).toBe('synced');
});

it('rejects configuration races before sending and after a late read, preserving all pending events', async () => {
  const { pauseSyncConfiguration } = await import('../src/data/syncClient');
  const consent = (await prepareAutoSync('p', summary))!;
  let resume = await pauseSyncConfiguration('p');
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  await expect(synchronize('p', consent, async () => {}, new AbortController().signal)).rejects.toThrow('SYNC_CONFIGURATION_CHANGED');
  expect(fetch).not.toHaveBeenCalled(); await resume();
  vi.stubGlobal('fetch', vi.fn(async (path: string) => {
    if (path === '/api/session') return Response.json(summary);
    resume = await pauseSyncConfiguration('p');
    return Response.json({ scope, commit: 'c'.repeat(40), cursor: 'empty', total: 0, files: [], batches: [] });
  }));
  await expect(synchronize('p', consent, async () => {}, new AbortController().signal)).rejects.toThrow('SYNC_CONFIGURATION_CHANGED');
  expect(await db.table('syncUploads').count()).toBe(0);
  expect(await db.table('syncDownloads').count()).toBe(0); await resume();
  expect(await nextSyncUpload('p', scope)).toBeDefined();
});

it('keeps received data for an apply retry and never acknowledges failed or expired authorisation', async () => {
  const consent = (await prepareAutoSync('p', summary))!;
  const page = await remotePage();
  let deny = false;
  vi.stubGlobal('fetch', vi.fn(async (path: string, init: RequestInit) => {
    if (deny) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    if (path === '/api/session') return Response.json(summary);
    if (path.startsWith('/api/sync/changes?')) return Response.json({ ...page, batches: path.includes('metadata=1') ? [] : page.batches });
    const value = JSON.parse(init.body as string); return Response.json({ scope, batchId: value.batch.batchId, hash: value.hash, previouslyWritten: false });
  }));
  await expect(synchronize('p', consent, async () => { throw new Error('LOCAL_PROJECTION_FAILED'); }, new AbortController().signal)).rejects.toThrow('LOCAL_PROJECTION_FAILED');
  expect(await readSyncState('p', scope)).toMatchObject({ phase: 'error', needsApply: true });
  expect(await db.table('syncReceipts').count()).toBe(1); expect(await db.table('syncUploads').count()).toBe(0);
  deny = true; await requestSyncNow('p', scope);
  await expect(synchronize('p', consent, async () => {}, new AbortController().signal)).rejects.toThrow('UNAUTHENTICATED');
  expect(await readSyncState('p', scope)).toMatchObject({ phase: 'error', error: 'UNAUTHENTICATED', needsApply: true });
  expect((await readSyncState('p', scope))?.lastSuccessAt).toBeUndefined();
  deny = false; await requestSyncNow('p', scope); let applied = 0;
  await synchronize('p', consent, async () => { applied++; }, new AbortController().signal);
  expect(applied).toBe(1); expect((await readSyncState('p', scope))?.phase).toBe('synced');
});

it('stops the automatic download before its next request when automatic sync is turned off mid-read', async () => {
  const consent = (await prepareAutoSync('p', summary))!, page = await remotePage();
  const fetch = vi.fn(async (path: string) => {
    if (path === '/api/session') return Response.json(summary);
    await stopSyncUpload('p'); return Response.json({ ...page, batches: [] });
  });
  vi.stubGlobal('fetch', fetch);
  await expect(synchronize('p', consent, async () => {}, new AbortController().signal)).rejects.toThrow('SYNC_CONSENT_CHANGED');
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(await db.table('syncDownloads').count()).toBe(0); expect(await db.table('syncReceipts').count()).toBe(0);
  expect((await readSyncState('p', scope))?.lastSuccessAt).toBeUndefined();
});
