import { z } from 'zod';
import { bootstrapSyncEvents, db, settings, syncClocks } from './db';
import { sessionSummarySchema, type SessionSummary } from '../shared/auth';
import { readSyncAccount } from './syncAccount';
import { canonicalJson, syncChangesSchema, syncMetadataSchema, syncDownloadScopeSchema, type SyncDownloadScope } from '../shared/sync';
import { profileIdSchema } from '../shared/repository';
import { confirmSyncUpload, nextSyncUpload, knownSyncFiles, readSyncDownload, receiveSyncPage } from './sync';

const consentSchema = z.object({ scope: syncDownloadScopeSchema, id: z.string().uuid() }).strict();
type Consent = z.infer<typeof consentSchema>;
const consentKey = (profileId: string) => `profile:${profileId}:syncConsent`;
export function storedSyncConsent(value?: string): Consent | undefined {
  try { return value ? consentSchema.parse(JSON.parse(value)) : undefined; }
  catch { return undefined; }
}
const syncPollInterval = 120000;
const syncStateSchema = z.object({
  phase: z.enum(['syncing', 'synced', 'pending', 'error']),
  checkedAt: z.number().finite().nonnegative().optional(),
  nextCheckAt: z.number().finite().nonnegative().optional(),
  localRevision: z.number().int().nonnegative().optional(),
  requestId: z.string().uuid().optional(),
  lastSuccessAt: z.iso.datetime().optional(),
  attempts: z.number().int().nonnegative().optional(),
  retryAt: z.number().finite().nonnegative().optional(),
  error: z.string().regex(/^[A-Z_0-9]{1,64}$/).optional(),
  needsApply: z.boolean().optional(),
}).strict();
export type SyncState = z.infer<typeof syncStateSchema>;
export const syncControlKey = (profileId: string, scope: SyncDownloadScope, field: 'state' | 'off' | 'request') => `profile:${profileId}:autoSync:${scope.accountId}:${scope.profileId}:${scope.bindingVersion}:${field}`;

export async function readSyncState(profileId: string, scope: SyncDownloadScope): Promise<SyncState | undefined> {
  const row = await settings.get(syncControlKey(profileId, scope, 'state'));
  try { return row ? syncStateSchema.parse(JSON.parse(row.value)) : undefined; }
  catch { return { phase: 'error', error: 'SYNC_STATE_INVALID' }; }
}

function sessionScope(raw: unknown, scope: SyncDownloadScope): SessionSummary {
  const summary = sessionSummarySchema.parse(raw);
  const binding = summary.bindings?.find(binding => binding.profileId === scope.profileId);
  if (!summary.syncAvailable || !summary.csrfToken || summary.account?.id !== scope.accountId || !binding || binding.disabled || binding.bindingVersion !== scope.bindingVersion) throw new Error('SYNC_SCOPE_CHANGED');
  return summary;
}

async function localScope(profileId: string, scope: SyncDownloadScope) {
  const association = await readSyncAccount(profileId);
  const clock = await syncClocks.get(profileId);
  const active = await settings.get('activeProfile');
  if ((active && active.value !== profileId) || !association || association.accountId !== scope.accountId || association.profileId !== scope.profileId || (clock?.logicalProfileId ?? profileId) !== scope.profileId) throw new Error('SYNC_SCOPE_CHANGED');
  if (await syncConfigurationPending(profileId)) throw new Error('SYNC_CONFIGURATION_CHANGED');
}

// First configuration enables sync; an explicit scoped opt-out survives reloads.
export async function allowSyncUpload(profileId: string, scope: SyncDownloadScope, summary: SessionSummary): Promise<Consent> {
  profileIdSchema.parse(profileId); scope = syncDownloadScopeSchema.parse(scope); sessionScope(summary, scope);
  return db.transaction('rw', settings, syncClocks, async () => {
    await localScope(profileId, scope);
    const consent = { scope, id: crypto.randomUUID() };
    await settings.delete(syncControlKey(profileId, scope, 'off'));
    await settings.put({ key: consentKey(profileId), value: JSON.stringify(consent) });
    return consent;
  });
}

export async function stopSyncUpload(profileId: string, scope?: SyncDownloadScope) {
  profileIdSchema.parse(profileId);
  await db.transaction('rw', settings, syncClocks, async () => {
    const row = await settings.get(consentKey(profileId));
    const current = storedSyncConsent(row?.value);
    const target = scope ?? current?.scope;
    if (target) {
      await localScope(profileId, target);
      if (current && canonicalJson(current.scope) !== canonicalJson(target)) throw new Error('SYNC_SCOPE_CHANGED');
      await settings.put({ key: syncControlKey(profileId, target, 'off'), value: '1' });
    }
    await settings.delete(consentKey(profileId));
  });
}

export async function prepareAutoSync(profileId: string, summary: SessionSummary): Promise<Consent | undefined> {
  const account = summary.account;
  if (!summary.syncAvailable || !account || !summary.csrfToken) return;
  const association = await readSyncAccount(profileId);
  if (!association || association.accountId !== account.id) return;
  const binding = summary.bindings?.find(binding => binding.profileId === association.profileId && !binding.disabled && binding.bindingVersion);
  if (!binding?.bindingVersion) return;
  const scope = { accountId: account.id, profileId: binding.profileId, bindingVersion: binding.bindingVersion };
  sessionScope(summary, scope);
  return db.transaction('rw', settings, syncClocks, async () => {
    await localScope(profileId, scope);
    if ((await settings.get(syncControlKey(profileId, scope, 'off')))?.value === '1') return;
    const row = await settings.get(consentKey(profileId));
    const current = storedSyncConsent(row?.value);
    if (current && canonicalJson(current.scope) === canonicalJson(scope)) return current;
    const consent = { scope, id: crypto.randomUUID() };
    await settings.put({ key: consentKey(profileId), value: JSON.stringify(consent) });
    return consent;
  });
}

export async function requestSyncNow(profileId: string, scope: SyncDownloadScope) {
  profileIdSchema.parse(profileId); scope = syncDownloadScopeSchema.parse(scope);
  await db.transaction('rw', settings, syncClocks, async () => {
    await localScope(profileId, scope);
    await settings.put({ key: syncControlKey(profileId, scope, 'request'), value: crypto.randomUUID() });
  });
}

const configurationSchema = z.object({ id: z.string().uuid(), until: z.number().finite() }).strict();
const configurationKey = (profileId: string) => `profile:${profileId}:syncConfiguration`;
export async function syncConfigurationPending(profileId: string) {
  const row = await settings.get(configurationKey(profileId));
  try { return row ? configurationSchema.parse(JSON.parse(row.value)).until > Date.now() : false; }
  catch { return false; }
}

export async function pauseSyncConfiguration(profileId: string) {
  profileIdSchema.parse(profileId);
  const key = configurationKey(profileId), value = JSON.stringify({ id: crypto.randomUUID(), until: Date.now() + 60000 });
  await db.transaction('rw', settings, syncClocks, async () => {
    if ((await syncClocks.get(profileId))?.deleted || (await settings.get('activeProfile'))?.value !== profileId) throw new Error('SYNC_SCOPE_CHANGED');
    await settings.put({ key, value });
  });
  return () => db.transaction('rw', settings, async () => { if ((await settings.get(key))?.value === value) await settings.delete(key); });
}

export async function readSyncConsent(profileId: string): Promise<Consent | undefined> {
  profileIdSchema.parse(profileId);
  const row = await settings.get(consentKey(profileId));
  const consent = storedSyncConsent(row?.value);
  if (!consent) return;
  await requireConsent(profileId, consent);
  return consent;
}

async function requireConsent(profileId: string, expected: Consent) {
  return db.transaction('r', settings, syncClocks, async () => {
    await localScope(profileId, expected.scope);
    const row = await settings.get(consentKey(profileId));
    const current = storedSyncConsent(row?.value);
    if (!current || canonicalJson(current) !== canonicalJson(expected)) throw new Error('SYNC_CONSENT_CHANGED');
  });
}

// Bound response size and duration; never store website credentials in IndexedDB.
export async function jsonRequest(path: string, signal: AbortSignal, init: RequestInit = {}, limit = 64 * 1024) {
  const response = await fetch(path, { ...init, credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal });
  if (!response.headers.get('content-type')?.includes('application/json') || !response.body) { await response.body?.cancel().catch(() => {}); throw new Error(response.ok ? 'SYNC_RESPONSE_INVALID' : `SYNC_HTTP_${response.status}`); }
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
async function uploadBatch(profileId: string, rawConsent: unknown, signal?: AbortSignal, verifiedSession?: SessionSummary): Promise<'idle' | 'uploaded'> {
  profileIdSchema.parse(profileId);
  const consent = consentSchema.parse(rawConsent);
  const abort = signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000);
  await requireConsent(profileId, consent);
  const stored = await nextSyncUpload(profileId, consent.scope);
  if (!stored) return 'idle';
  const summary = sessionScope(verifiedSession ?? await jsonRequest('/api/session', abort), consent.scope);
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
async function downloadPage(profileId: string, scope: SyncDownloadScope, signal?: AbortSignal, verifiedSession?: SessionSummary, consent?: Consent) {
  profileIdSchema.parse(profileId); scope = syncDownloadScopeSchema.parse(scope);
  const abort = signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000);
  const verifyLocal = async () => { if (consent) await requireConsent(profileId, consent); else await localScope(profileId, scope); };
  await db.transaction('r', settings, syncClocks, verifyLocal);
  sessionScope(verifiedSession ?? await jsonRequest('/api/session', abort), scope);
  const prior = await readSyncDownload(profileId, scope);
  const params = new URLSearchParams({ profileId: scope.profileId, metadata: '1' });
  if (prior?.nextCursor) params.set('cursor', prior.nextCursor);
  else if (prior) params.set('sinceCommit', prior.commit);
  const metadata = syncMetadataSchema.parse(await jsonRequest(`/api/sync/changes?${params}`, abort));
  if (!metadata.scope || canonicalJson(metadata.scope) !== canonicalJson(scope)) throw new Error('SYNC_SCOPE_CHANGED');
  if ('unchanged' in metadata) {
    if (!prior || prior.nextCursor || metadata.commit !== prior.commit) throw new Error('SYNC_DOWNLOAD_CHANGED');
    await db.transaction('r', settings, syncClocks, verifyLocal);
    abort.throwIfAborted();
    return { results: [], commit: metadata.commit, nextCursor: undefined };
  }
  if (metadata.batches.length || (prior?.nextCursor && (metadata.cursor !== prior.nextCursor || metadata.commit !== prior.commit))) throw new Error('SYNC_DOWNLOAD_CHANGED');
  const known = await knownSyncFiles(profileId, scope, metadata.files.map(({ deviceId, batchId, blobSha }) => ({ deviceId, batchId, blobSha })));
  await db.transaction('r', settings, syncClocks, verifyLocal);
  abort.throwIfAborted();
  params.delete('metadata'); params.delete('sinceCommit'); params.set('cursor', metadata.cursor); params.set('known', JSON.stringify(known));
  const page = syncChangesSchema.parse(await jsonRequest(`/api/sync/changes?${params}`, abort, {}, 2 * 1024 * 1024 + 65536));
  if ((page.nextCursor && (!page.files.length || page.nextCursor === page.cursor)) || page.cursor !== metadata.cursor || page.commit !== metadata.commit || page.total !== metadata.total || canonicalJson(page.files) !== canonicalJson(metadata.files)) throw new Error('SYNC_DOWNLOAD_CHANGED');
  return receiveSyncPage(profileId, page, db, { ...scope, ...(prior?.nextCursor ? { expectedCursor: prior.nextCursor } : prior ? { previousCursor: prior.cursor } : {}) }, async () => {
    await verifyLocal();
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

const transientCodes = new Set(['SYNC_NETWORK', 'SYNC_TIMEOUT', 'SYNC_HTTP_500', 'SYNC_HTTP_502', 'SYNC_HTTP_503', 'SYNC_HTTP_504', 'SYNC_HTTP_429', 'SYNC_PENDING', 'RATE_LIMITED', 'SYNC_RATE_LIMITED', 'REPOSITORY_FAILED', 'AUTH_UNAVAILABLE', 'SYNC_LOCAL_CHANGED', 'SYNC_DOWNLOAD_CHANGED']);
export const syncConnectionError = (code?: string) => ['SYNC_SCOPE_CHANGED', 'SYNC_CONSENT_CHANGED', 'AUTHORISATION_CHANGED', 'UNAUTHENTICATED', 'GITHUB_PERMISSION', 'SYNC_NOT_BOUND', 'SYNC_UNAVAILABLE', 'ACCOUNT_CHANGED'].includes(code ?? '');

// One lock covers reading, merging and uploading; partial rounds never claim success.
export async function synchronize(profileId: string, consent: Consent, onMerge: () => Promise<void>, signal: AbortSignal, wake = false) {
  const abort = AbortSignal.any([signal, AbortSignal.timeout(60000)]);
  return syncLock(profileId, consent.scope, abort, async () => {
    await requireConsent(profileId, consent);
    let state = await readSyncState(profileId, consent.scope) ?? { phase: 'pending' as const };
    const requestId = (await settings.get(syncControlKey(profileId, consent.scope, 'request')))?.value;
    const requested = requestId !== state.requestId;
    const revision = (await syncClocks.get(profileId))?.localRevision ?? 0;
    const now = Date.now();
    const drained = !requested && !wake && state.phase === 'synced' && revision === state.localRevision;
    if (!requested && !wake && state.phase === 'error' && (!transientCodes.has(state.error ?? '') || (state.retryAt ?? Infinity) > now)) return;
    if (!requested && now < (state.retryAt ?? 0)) return;
    if (!requested && now - (state.checkedAt ?? -Infinity) < 15000) return wake ? { wakeAt: state.checkedAt! + 15000 } : undefined;
    if (!requested && !wake && state.phase === 'synced' && revision === state.localRevision && now < (state.nextCheckAt ?? 0)) return;
    if (!requested && !wake && state.phase === 'pending' && now < (state.nextCheckAt ?? 0)) return;
    const save = async (patch: Partial<SyncState>, failed = false) => {
      const next = syncStateSchema.parse({ ...state, ...patch });
      await db.transaction('rw', settings, syncClocks, async () => {
        await requireConsent(profileId, consent);
        if (failed) signal.throwIfAborted(); else abort.throwIfAborted();
        await settings.put({ key: syncControlKey(profileId, consent.scope, 'state'), value: JSON.stringify(next) });
      });
      state = next;
    };
    const apply = async () => {
      if (!state.needsApply) return;
      await onMerge();
      await save({ needsApply: false });
    };
    const partial = async () => {
      await apply();
      await save({ phase: 'pending', nextCheckAt: Date.now() + 60000, error: undefined, retryAt: undefined, attempts: 0 });
    };
    try {
      await save({ phase: 'syncing', checkedAt: now, requestId, error: undefined, retryAt: undefined });
      await bootstrapSyncEvents(profileId);
      const summary = sessionScope(await jsonRequest('/api/session', abort), consent.scope);
      await apply();
      const deadline = Date.now() + 20000;
      let steps = 0, resetCursor = false;
      while (true) {
        while (true) {
          if (steps >= 6 || Date.now() >= deadline) { await partial(); return; }
          await requireConsent(profileId, consent); abort.throwIfAborted();
          let page;
          try { page = await downloadPage(profileId, consent.scope, abort, summary, consent); }
          catch (error) {
            if (resetCursor || !(error instanceof Error) || error.message !== 'SYNC_CURSOR_INVALID') throw error;
            const prior = await readSyncDownload(profileId, consent.scope);
            if (!prior) throw error;
            await restartSyncDownload(profileId, consent.scope, prior.cursor);
            resetCursor = true; steps += 2; continue;
          }
          steps += 2;
          if (page.results.includes('conflict')) throw new Error('SYNC_BATCH_CONFLICT');
          if (page.results.includes('received')) await save({ needsApply: true });
          if (!page.nextCursor) break;
        }
        await apply();
        let uploaded = false;
        while (true) {
          await requireConsent(profileId, consent); abort.throwIfAborted();
          const completedRevision = (await syncClocks.get(profileId))?.localRevision ?? 0;
          const pending = drained && completedRevision === state.localRevision ? undefined : await nextSyncUpload(profileId, consent.scope);
          if (!pending) {
            if (uploaded) break;
            await db.transaction('rw', settings, syncClocks, async () => {
              if (((await syncClocks.get(profileId))?.localRevision ?? 0) !== completedRevision) await save({ phase: 'pending', nextCheckAt: Date.now(), attempts: 0 });
              else await save({ phase: 'synced', localRevision: completedRevision, lastSuccessAt: new Date().toISOString(), nextCheckAt: Date.now() + syncPollInterval, attempts: 0 });
            });
            return;
          }
          if (steps >= 6 || Date.now() >= deadline) { await partial(); return; }
          await uploadBatch(profileId, consent, abort, summary); steps++; uploaded = true;
        }
      }
    } catch (error) {
      if (signal.aborted) return;
      const raw = abort.aborted || error instanceof Error && error.name === 'TimeoutError' ? 'SYNC_TIMEOUT' : error instanceof TypeError ? 'SYNC_NETWORK' : error instanceof Error ? error.message : 'SYNC_FAILED';
      const code = /^[A-Z_0-9]{1,64}$/.test(raw) ? raw : 'SYNC_FAILED';
      const attempts = requested || wake || (state.attempts ?? 0) >= 3 ? 1 : (state.attempts ?? 0) + 1;
      const headerRetry = error instanceof Error && error.cause && typeof error.cause === 'object' && 'retryAt' in error.cause && typeof error.cause.retryAt === 'number' ? error.cause.retryAt : 0;
      const retryAt = transientCodes.has(code) ? Math.max(headerRetry, Date.now() + (attempts >= 3 ? 300000 : 10000 * 2 ** (attempts - 1)) + Math.random() * 1000) : undefined;
      await save({ phase: 'error', error: code, attempts, retryAt }, true).catch(() => {});
      throw error;
    }
  });
}
