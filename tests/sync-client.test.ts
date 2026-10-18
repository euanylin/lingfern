import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { db, profiles, settings } from '../src/data/db';
import { appendSyncEvent, nextSyncUpload } from '../src/data/sync';
import { allowSyncUpload, downloadSyncPage, restartSyncDownload, readSyncConsent, stopSyncUpload, uploadSyncBatch } from '../src/data/syncClient';
import { validateSyncBatch } from '../src/shared/sync';
import { type SessionSummary } from '../src/shared/auth';
import { exportBackup, inspectBackup, importBackup } from '../src/data/backup';

const scope = { accountId: 1, profileId: 'p', bindingVersion: 'a'.repeat(43) };
const summary: SessionSummary = { account: { id: 1, login: 'learner' }, csrfToken: 't'.repeat(43), syncAvailable: true, bindings: [{ name: 'lingfern-data', owner: 'learner', profileId: 'p', disabled: false, bindingVersion: scope.bindingVersion }] };
beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()));
  await settings.put({ key: 'activeProfile', value: 'p' });
  await profiles.put({ id: 'p', name: 'Local', createdAt: new Date().toISOString() });
  await settings.put({ key: 'profile:p:syncAccount', value: JSON.stringify({ accountId: 1, profileId: 'p' }) });
  await appendSyncEvent('p', { type: 'saved_item', payload: { memoryId: 'sense', saved: true, reviewEnabled: false } });
});
afterEach(() => vi.unstubAllGlobals());

it('needs explicit scoped consent, never transfers it through backups, and checks fresh session/CSRF before a bounded upload', async () => {
  const fetch = vi.fn(async (path: string, init: RequestInit) => {
    expect(init.credentials).toBe('same-origin'); expect(init.cache).toBe('no-store'); expect(init.redirect).toBe('error');
    if (path === '/api/session') return Response.json({ ...summary, csrfToken: 'n'.repeat(43) });
    expect(path).toBe('/api/sync/batches'); expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'X-CSRF-Token': 'n'.repeat(43) });
    const value = JSON.parse(init.body as string);
    expect(value.scope).toEqual(scope);
    expect(value.batch.events[0].payload).toEqual({ memoryId: 'sense', saved: true, reviewEnabled: false });
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
  const value = await validateSyncBatch({ product: 'Lingfern', formatVersion: 1, profileId: 'p', deviceId: 'remote', batchId: 'remote-one', events: [{ id: 'remote-event', deviceId: 'remote', counter: 2, occurredAt: '2026-01-01T00:00:00.000Z', type: 'saved_item', payload: { memoryId: 'remote-sense', saved: true, reviewEnabled: false } }] });
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
  expect(await readSyncConsent('p')).toBeUndefined(); // Reading does not grant upload consent.
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
