import { z } from 'zod';
import { db, settings, syncClocks } from './db';
import { sessionSummarySchema, syncAccountSchema, type SessionSummary } from '../shared/auth';
import { canonicalJson, syncChangesSchema, syncDownloadScopeSchema, type SyncDownloadScope } from '../shared/sync';
import { profileIdSchema } from '../shared/repository';
import { confirmSyncUpload, nextSyncUpload, knownSyncFiles, readSyncDownload, receiveSyncPage } from './sync';

const consentSchema = z.object({ scope: syncDownloadScopeSchema, id: z.string().uuid() }).strict();
type Consent = z.infer<typeof consentSchema>;
const consentKey = (profileId: string) => `profile:${profileId}:syncConsent`;

function sessionScope(raw: unknown, scope: SyncDownloadScope): SessionSummary {
  const summary = sessionSummarySchema.parse(raw);
  const binding = summary.bindings?.find(binding => binding.profileId === scope.profileId);
  if (!summary.syncAvailable || !summary.csrfToken || summary.account?.id !== scope.accountId || !binding || binding.disabled || binding.bindingVersion !== scope.bindingVersion) throw new Error('SYNC_SCOPE_CHANGED');
  return summary;
}

async function localScope(profileId: string, scope: SyncDownloadScope) {
  const row = await settings.get(`profile:${profileId}:syncAccount`);
  const association = row && syncAccountSchema.parse(JSON.parse(row.value));
  const clock = await syncClocks.get(profileId);
  const active = await settings.get('activeProfile');
  if ((active && active.value !== profileId) || !association || association.accountId !== scope.accountId || association.profileId !== scope.profileId || (clock?.logicalProfileId ?? profileId) !== scope.profileId) throw new Error('SYNC_SCOPE_CHANGED');
}

// Require explicit upload confirmation; account association/binding is not consent.
export async function allowSyncUpload(profileId: string, scope: SyncDownloadScope, summary: SessionSummary): Promise<Consent> {
  profileIdSchema.parse(profileId); scope = syncDownloadScopeSchema.parse(scope); sessionScope(summary, scope);
  return db.transaction('rw', settings, syncClocks, async () => {
    await localScope(profileId, scope);
    const consent = { scope, id: crypto.randomUUID() };
    await settings.put({ key: consentKey(profileId), value: JSON.stringify(consent) });
    return consent;
  });
}

export async function stopSyncUpload(profileId: string) {
  profileIdSchema.parse(profileId);
  await settings.delete(consentKey(profileId));
}

export async function readSyncConsent(profileId: string): Promise<Consent | undefined> {
  profileIdSchema.parse(profileId);
  const row = await settings.get(consentKey(profileId));
  let consent: Consent;
  try { if (!row) return; consent = consentSchema.parse(JSON.parse(row.value)); } catch { return; }
  await requireConsent(profileId, consent);
  return consent;
}

async function requireConsent(profileId: string, expected: Consent) {
  return db.transaction('r', settings, syncClocks, async () => {
    await localScope(profileId, expected.scope);
    const row = await settings.get(consentKey(profileId));
    let current: Consent | undefined;
    try { current = row && consentSchema.parse(JSON.parse(row.value)); } catch { /* Reject corrupt consent without granting permission. */ }
    if (!current || canonicalJson(current) !== canonicalJson(expected)) throw new Error('SYNC_CONSENT_CHANGED');
  });
}

// Bound response size and duration; never store website credentials in IndexedDB.
export async function jsonRequest(path: string, signal: AbortSignal, init: RequestInit = {}, limit = 64 * 1024) {
  const response = await fetch(path, { ...init, credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal });
  if (!response.headers.get('content-type')?.includes('application/json') || !response.body) { await response.body?.cancel(); throw new Error(response.ok ? 'SYNC_RESPONSE_INVALID' : `SYNC_HTTP_${response.status}`); }
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > (response.ok ? limit : 4096)) throw new Error('SYNC_RESPONSE_LIMIT');
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const result: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!response.ok) {
      const error = z.object({ error: z.string().regex(/^[A-Z_]{1,64}$/) }).strict().safeParse(result);
      const delay = response.headers.get('retry-after');
      const seconds = delay && /^\d+$/.test(delay) ? Number(delay) : undefined;
      const date = delay && seconds === undefined ? Date.parse(delay) : NaN;
      const retryAt = seconds !== undefined ? Date.now() + Math.min(seconds, 86400) * 1000 : Number.isFinite(date) ? Math.min(date, Date.now() + 86400000) : response.status === 429 ? Date.now() + 60000 : undefined;
      throw new Error(error.success ? error.data.error : `SYNC_HTTP_${response.status}`, { cause: retryAt ? { retryAt } : undefined });
    }
    return result;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

// Send one bounded batch; retry its immutable ID after lost acknowledgements.
async function uploadBatch(profileId: string, rawConsent: unknown, signal?: AbortSignal): Promise<'idle' | 'uploaded'> {
  profileIdSchema.parse(profileId);
  const consent = consentSchema.parse(rawConsent);
  const abort = signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000);
  await requireConsent(profileId, consent);
  const stored = await nextSyncUpload(profileId, consent.scope);
  if (!stored) return 'idle';
  const summary = sessionScope(await jsonRequest('/api/session', abort), consent.scope);
  await requireConsent(profileId, consent);
  abort.throwIfAborted();
  const ack = await jsonRequest('/api/sync/batches', abort, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': summary.csrfToken! }, body: JSON.stringify({ scope: consent.scope, batch: stored.batch, hash: stored.hash }) });
  await db.transaction('rw', settings, syncClocks, db.table('syncBatches'), db.table('syncUploads'), async () => {
    await requireConsent(profileId, consent);
    abort.throwIfAborted();
    await confirmSyncUpload(profileId, { scope: consent.scope, deviceId: stored.deviceId, batchId: stored.batchId, hash: stored.hash }, ack);
  });
  return 'uploaded';
}


// Read one fixed-commit page; use verified receipts to avoid duplicate downloads.
async function downloadPage(profileId: string, scope: SyncDownloadScope, signal?: AbortSignal) {
  profileIdSchema.parse(profileId); scope = syncDownloadScopeSchema.parse(scope);
  const abort = signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000);
  await db.transaction('r', settings, syncClocks, () => localScope(profileId, scope));
  sessionScope(await jsonRequest('/api/session', abort), scope);
  const prior = await readSyncDownload(profileId, scope);
  const params = new URLSearchParams({ profileId: scope.profileId, metadata: '1' });
  if (prior?.nextCursor) params.set('cursor', prior.nextCursor);
  const metadata = syncChangesSchema.parse(await jsonRequest(`/api/sync/changes?${params}`, abort));
  if (!metadata.scope || canonicalJson(metadata.scope) !== canonicalJson(scope)) throw new Error('SYNC_SCOPE_CHANGED');
  if (metadata.batches.length || (prior?.nextCursor && (metadata.cursor !== prior.nextCursor || metadata.commit !== prior.commit))) throw new Error('SYNC_DOWNLOAD_CHANGED');
  const known = await knownSyncFiles(profileId, scope, metadata.files.map(({ deviceId, batchId, blobSha }) => ({ deviceId, batchId, blobSha })));
  await db.transaction('r', settings, syncClocks, () => localScope(profileId, scope));
  abort.throwIfAborted();
  params.delete('metadata'); params.set('cursor', metadata.cursor); params.set('known', JSON.stringify(known));
  const page = syncChangesSchema.parse(await jsonRequest(`/api/sync/changes?${params}`, abort, {}, 2 * 1024 * 1024 + 65536));
  if ((page.nextCursor && (!page.files.length || page.nextCursor === page.cursor)) || page.cursor !== metadata.cursor || page.commit !== metadata.commit || page.total !== metadata.total || canonicalJson(page.files) !== canonicalJson(metadata.files)) throw new Error('SYNC_DOWNLOAD_CHANGED');
  return receiveSyncPage(profileId, page, db, { ...scope, ...(prior?.nextCursor ? { expectedCursor: prior.nextCursor } : prior ? { previousCursor: prior.cursor } : {}) }, async () => {
    await localScope(profileId, scope);
    abort.throwIfAborted();
  });
}


// Reset only the scoped rescan cursor; preserve installed records and receipts.
export async function restartSyncDownload(profileId: string, scope: SyncDownloadScope, expectedCursor: string) {
  profileIdSchema.parse(profileId); scope = syncDownloadScopeSchema.parse(scope);
  z.string().min(1).max(4096).parse(expectedCursor);
  return db.transaction('rw', settings, syncClocks, db.table('syncDownloads'), async () => {
    await localScope(profileId, scope);
    const prior = await readSyncDownload(profileId, scope);
    if (!prior || prior.cursor !== expectedCursor) throw new Error('SYNC_DOWNLOAD_CHANGED');
    await db.table('syncDownloads').delete([profileId, scope.accountId, scope.bindingVersion]);
  });
}


// Release native locks automatically when tabs close.
// shortcut: suspended 90s leases may overlap; IDs/CAS protect data; renew for longer rounds.
async function syncLock<T>(profileId: string, scope: SyncDownloadScope, signal: AbortSignal | undefined, work: () => Promise<T>): Promise<T> {
  profileIdSchema.parse(profileId); scope = syncDownloadScopeSchema.parse(scope);
  const retryKey = `profile:${profileId}:syncRetry:${scope.accountId}:${scope.bindingVersion}`;
  const run = async () => {
    signal?.throwIfAborted();
    const retry = await settings.get(retryKey);
    if (retry && Number(retry.value) > Date.now()) throw new Error('SYNC_RETRY_LATER');
    try { return await work(); }
    catch (error) {
      const retryAt = error instanceof Error && error.cause && typeof error.cause === 'object' && 'retryAt' in error.cause ? error.cause.retryAt : undefined;
      if (typeof retryAt === 'number' && Number.isFinite(retryAt)) await db.transaction('rw', settings, syncClocks, async () => {
        if (!(await syncClocks.get(profileId))?.deleted) await settings.put({ key: retryKey, value: String(retryAt) });
      });
      throw error;
    }
  };
  if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request(`lingfern-sync:${profileId}`, { ifAvailable: true }, lock => { if (!lock) throw new Error('SYNC_BUSY'); return run(); });
  const key = `profile:${profileId}:syncLease`, owner = crypto.randomUUID();
  await db.transaction('rw', settings, async () => {
    const prior = await settings.get(key);
    if (prior) { const lease = z.object({ owner: z.string().uuid(), expiresAt: z.number().finite() }).strict().parse(JSON.parse(prior.value)); if (lease.expiresAt > Date.now()) throw new Error('SYNC_BUSY'); }
    await settings.put({ key, value: JSON.stringify({ owner, expiresAt: Date.now() + 90000 }) });
  });
  try { return await run(); }
  finally {
    await db.transaction('rw', settings, async () => {
      const current = await settings.get(key);
      if (current && JSON.parse(current.value).owner === owner) await settings.delete(key);
    });
  }
}

export async function uploadSyncBatch(profileId: string, rawConsent: unknown, signal?: AbortSignal): Promise<'idle' | 'uploaded'> {
  profileIdSchema.parse(profileId);
  const consent = consentSchema.parse(rawConsent);
  await requireConsent(profileId, consent);
  return syncLock(profileId, consent.scope, signal, () => uploadBatch(profileId, consent, signal));
}

export async function downloadSyncPage(profileId: string, scope: SyncDownloadScope, signal?: AbortSignal) {
  return syncLock(profileId, scope, signal, () => downloadPage(profileId, scope, signal));
}
