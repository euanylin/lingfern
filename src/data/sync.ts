import Dexie from 'dexie';
import { db } from './db';
import { canonicalJson, syncAcknowledgementSchema, syncDownloadScopeSchema, syncKnownFilesSchema, syncChangesSchema, compareSyncEvents, mergeSyncEvents, syncEventSchema, validateSyncBatch, syncByteLimit, type SyncBatch, type SyncEvent, type SyncDownloadScope } from '../shared/sync';
import { profileIdSchema } from '../shared/repository';

export type StoredEvent = SyncEvent & { profileId: string; batchId?: string };
export type StoredBatch = { profileId: string; deviceId: string; batchId: string; hash: string; batch: SyncBatch; state: 'pending' | 'confirmed' | 'received' | 'conflict' };
export type Clock = { profileId: string; deviceId: string; counter: number; logicalProfileId?: string };
export type NewEvent = SyncEvent extends infer Event ? Event extends SyncEvent ? Pick<Event, 'type' | 'payload'> : never : never;

// Imported content may use longer IDs than the bounded wire format. Hash only those references,
// preserving ordinary IDs and avoiding a new restriction on locally valid materials.
export async function boundedReferences(value: NewEvent): Promise<NewEvent> {
  if (value.type === 'preferences' || value.type === 'setting') return value;
  const payload = { ...value.payload } as Record<string, unknown>;
  for (const key of ['recordId', 'questionId', 'rootId', 'goalId', 'materialId', 'variantGroup', 'memoryId', 'targetId', 'contentId']) {
    const reference = payload[key];
    if (typeof reference === 'string' && reference.length > 160) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(reference));
      payload[key] = `sha256:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
    }
  }
  return { ...value, payload } as NewEvent;
}

// These operations are profile scoped. No account selection or remote request is implicit.
export async function appendSyncEvent(profileId: string, value: NewEvent, database: Dexie = db, identity: { id?: string; occurredAt?: string } = {}) {
  profileIdSchema.parse(profileId);
  return database.transaction('rw', database.table('syncEvents'), database.table('syncClocks'), async () => {
    const clock: Clock = await database.table('syncClocks').get(profileId) ?? { profileId, deviceId: crypto.randomUUID(), counter: 0, logicalProfileId: profileId };
    const bounded = await Dexie.waitFor(boundedReferences(value));
    const event = syncEventSchema.parse({ ...bounded, id: identity.id ?? crypto.randomUUID(), deviceId: clock.deviceId, counter: clock.counter + 1, occurredAt: identity.occurredAt ?? new Date().toISOString() });
    await database.table('syncEvents').add({ ...event, profileId });
    await database.table('syncClocks').put({ ...clock, counter: event.counter });
    return event;
  });
}

function unstored({ profileId: _profile, batchId: _batch, ...event }: StoredEvent): SyncEvent {
  void _profile; void _batch;
  return syncEventSchema.parse(event);
}

export async function pendingSyncBatch(profileId: string, database: Dexie = db): Promise<StoredBatch | undefined> {
  profileIdSchema.parse(profileId);
  const pending = await database.table('syncBatches').where('[profileId+state]').equals([profileId, 'pending']).first();
  if (pending) return pending;
  // SHA computation runs outside IndexedDB; the following transaction compares selected rows before sealing.
  const selected: StoredEvent[] = await database.table('syncEvents').where('profileId').equals(profileId).filter(event => !event.batchId).toArray();
  // ponytail: scans the pending queue; add a profile/counter index if large offline queues make sealing slow.
  selected.sort(compareSyncEvents);
  selected.splice(500);
  if (!selected.length) return undefined;
  const clock: Clock | undefined = await database.table('syncClocks').get(profileId);
  if (!clock) throw new Error('SYNC_CLOCK_MISSING');
  const batch: SyncBatch = { product: 'Lingfern', formatVersion: 1, profileId: clock.logicalProfileId ?? profileId, deviceId: selected[0].deviceId, batchId: crypto.randomUUID(), events: [] };
  for (const row of selected) {
    if (row.deviceId !== batch.deviceId) continue;
    const event = unstored(row);
    const candidate = { ...batch, events: [...batch.events, event] };
    if (new TextEncoder().encode(canonicalJson(candidate)).byteLength > syncByteLimit) break;
    batch.events.push(event);
  }
  if (!batch.events.length) throw new Error('SYNC_CAPACITY');
  const validated = await validateSyncBatch(batch);
  return database.transaction('rw', database.table('syncEvents'), database.table('syncBatches'), async () => {
    const concurrent = await database.table('syncBatches').where('[profileId+state]').equals([profileId, 'pending']).first();
    if (concurrent) return concurrent;
    for (const event of batch.events) {
      const current: StoredEvent | undefined = await database.table('syncEvents').get([profileId, event.id]);
      if (!current || current.batchId || canonicalJson(unstored(current)) !== canonicalJson(event)) throw new Error('SYNC_LOCAL_CHANGED');
    }
    const stored: StoredBatch = { profileId, deviceId: batch.deviceId, batchId: batch.batchId, batch, hash: validated.hash, state: 'pending' };
    await database.table('syncBatches').add(stored);
    for (const event of batch.events) await database.table('syncEvents').update([profileId, event.id], { batchId: batch.batchId });
    return stored;
  });
}

export async function confirmSyncBatch(profileId: string, deviceId: string, batchId: string, hash: string, database: Dexie = db) {
  await database.transaction('rw', database.table('syncBatches'), async () => {
    const key = [profileId, deviceId, batchId];
    const prior: StoredBatch | undefined = await database.table('syncBatches').get(key);
    if (!prior || prior.hash !== hash || !['pending', 'confirmed'].includes(prior.state)) throw new Error('SYNC_ACK_INVALID');
    await database.table('syncBatches').update(key, { state: 'confirmed' });
  });
}

// Upload receipts are binding-specific caches, excluded from backups just like download receipts.
export async function confirmSyncUpload(profileId: string, expected: { scope: SyncDownloadScope; deviceId: string; batchId: string; hash: string }, raw: unknown, database: Dexie = db) {
  profileIdSchema.parse(profileId);
  const scope = syncDownloadScopeSchema.parse(expected.scope), ack = syncAcknowledgementSchema.parse(raw);
  if (canonicalJson(ack.scope) !== canonicalJson(scope) || ack.batchId !== expected.batchId || ack.hash !== expected.hash) throw new Error('SYNC_ACK_INVALID');
  return database.transaction('rw', database.table('syncBatches'), database.table('syncUploads'), database.table('syncClocks'), async () => {
    const clock: Clock | undefined = await database.table('syncClocks').get(profileId);
    const key = [profileId, expected.deviceId, expected.batchId];
    const stored: StoredBatch | undefined = await database.table('syncBatches').get(key);
    if ((clock?.logicalProfileId ?? profileId) !== scope.profileId || !stored || stored.state === 'conflict' || stored.batch.profileId !== scope.profileId || stored.hash !== ack.hash) throw new Error('SYNC_ACK_INVALID');
    const validated = await Dexie.waitFor(validateSyncBatch(stored.batch));
    if (validated.hash !== ack.hash || validated.batch.deviceId !== expected.deviceId || validated.batch.batchId !== ack.batchId) throw new Error('SYNC_ACK_INVALID');
    await database.table('syncUploads').put({ ...scope, profileId, deviceId: expected.deviceId, batchId: ack.batchId, hash: ack.hash });
    if (stored.state === 'pending') await database.table('syncBatches').update(key, { state: 'confirmed' });
  });
}

export async function nextSyncUpload(profileId: string, scope: SyncDownloadScope, database: Dexie = db): Promise<StoredBatch | undefined> {
  profileIdSchema.parse(profileId); scope = syncDownloadScopeSchema.parse(scope);
  const outstanding = await database.transaction('r', database.table('syncBatches'), database.table('syncUploads'), database.table('syncClocks'), database.table('syncConflicts'), async () => {
    const clock: Clock | undefined = await database.table('syncClocks').get(profileId);
    if ((clock?.logicalProfileId ?? profileId) !== scope.profileId) throw new Error('SYNC_SCOPE_CHANGED');
    if (await database.table('syncConflicts').where('profileId').equals(profileId).count()) throw new Error('SYNC_BATCH_CONFLICT');
    // ponytail: scan one profile's immutable batches; add a per-scope queue index if large archives make selection slow.
    for (const stored of await database.table('syncBatches').where('profileId').equals(profileId).toArray() as StoredBatch[]) {
      if (stored.state === 'conflict') throw new Error('SYNC_BATCH_CONFLICT');
      const validated = await Dexie.waitFor(validateSyncBatch(stored.batch));
      if (validated.hash !== stored.hash || stored.batch.profileId !== scope.profileId || stored.deviceId !== stored.batch.deviceId || stored.batchId !== stored.batch.batchId) throw new Error('SYNC_INTEGRITY');
      const receipt = await database.table('syncUploads').get([profileId, scope.accountId, scope.bindingVersion, stored.deviceId, stored.batchId]);
      if (!receipt || receipt.hash !== stored.hash) return stored;
    }
  });
  const next = outstanding ?? await pendingSyncBatch(profileId, database);
  if (next && next.batch.profileId !== scope.profileId) throw new Error('SYNC_SCOPE_CHANGED');
  return next;
}

export async function receiveSyncBatch(profileId: string, raw: unknown, expectedHash: string, database: Dexie = db) {
  const { batch, hash } = await validateSyncBatch(raw);
  if (hash !== expectedHash) throw new Error('SYNC_INTEGRITY');
  return database.transaction('rw', database.table('syncEvents'), database.table('syncBatches'), database.table('syncClocks'), database.table('syncConflicts'), () => receiveValidatedBatch(profileId, batch, hash, database));
}

async function receiveValidatedBatch(profileId: string, batch: SyncBatch, hash: string, database: Dexie) {
    const currentClock: Clock | undefined = await database.table('syncClocks').get(profileId);
    if (batch.profileId !== (currentClock?.logicalProfileId ?? profileId)) throw new Error('SYNC_INTEGRITY');
    const key = [profileId, batch.deviceId, batch.batchId];
    const prior: StoredBatch | undefined = await database.table('syncBatches').get(key);
    if (prior && prior.hash !== hash) {
      await database.table('syncConflicts').put({ profileId, hash, batch, reason: 'SYNC_BATCH_CONFLICT' });
      return 'conflict';
    }
    if (prior) return prior.state === 'conflict' ? 'conflict' : 'duplicate';
    const old: StoredEvent[] = await database.table('syncEvents').bulkGet(batch.events.map(event => [profileId, event.id]));
    let conflict = false;
    try { mergeSyncEvents(old.filter(Boolean).map(unstored), batch.events); }
    catch (error) { if (!(error instanceof Error) || error.message !== 'SYNC_EVENT_CONFLICT') throw error; conflict = true; }
    const stored: StoredBatch = { profileId, deviceId: batch.deviceId, batchId: batch.batchId, batch, hash, state: conflict ? 'conflict' : 'received' };
    await database.table('syncBatches').add(stored);
    if (conflict) return 'conflict'; // Retain the incoming copy; no part of a conflicting batch is applied.
    for (const event of batch.events) if (!old.some(row => row?.id === event.id)) await database.table('syncEvents').add({ ...event, profileId, batchId: batch.batchId });
    const clock: Clock = await database.table('syncClocks').get(profileId) ?? { profileId, deviceId: crypto.randomUUID(), counter: 0, logicalProfileId: profileId };
    await database.table('syncClocks').put({ ...clock, counter: Math.max(clock.counter, ...batch.events.map(event => event.counter)) });
    return 'received';
}

export async function readSyncEvents(profileId: string, database: Dexie = db) {
  const rows: StoredEvent[] = await database.table('syncEvents').where('profileId').equals(profileId).toArray();
  return mergeSyncEvents([], rows.map(unstored));
}

// Read-only diagnosis: no choice silently overwrites an immutable batch or original event.
export async function syncConflictReport(profileId: string, hash: string, database: Dexie = db) {
  profileIdSchema.parse(profileId);
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('SYNC_INTEGRITY');
  return database.transaction('r', ['syncConflicts', 'syncBatches', 'syncEvents', 'syncClocks'].map(name => database.table(name)), async () => {
    const incoming = await database.table('syncConflicts').get([profileId, hash]) ?? await database.table('syncBatches').where('profileId').equals(profileId).filter(row => row.hash === hash && row.state === 'conflict').first();
    if (!incoming) throw new Error('NOT_FOUND');
    const validated = await Dexie.waitFor(validateSyncBatch(incoming.batch));
    const clock: Clock | undefined = await database.table('syncClocks').get(profileId);
    if (validated.hash !== hash || validated.batch.profileId !== (clock?.logicalProfileId ?? profileId)) throw new Error('SYNC_INTEGRITY');
    const stored: StoredBatch | undefined = await database.table('syncBatches').get([profileId, validated.batch.deviceId, validated.batch.batchId]);
    const prior = stored && stored.hash !== hash ? await Dexie.waitFor(validateSyncBatch(stored.batch)) : undefined;
    if (prior && (prior.hash !== stored!.hash || prior.batch.profileId !== validated.batch.profileId || prior.batch.deviceId !== validated.batch.deviceId || prior.batch.batchId !== validated.batch.batchId)) throw new Error('SYNC_INTEGRITY');
    const originals: StoredEvent[] = await database.table('syncEvents').bulkGet(validated.batch.events.map(event => [profileId, event.id]));
    return { product: 'Lingfern', formatVersion: 1, kind: 'sync-conflict-diagnosis', incoming: { batch: validated.batch, hash }, ...(prior ? { originalBatch: { batch: prior.batch, hash: prior.hash } } : {}), originalEvents: originals.filter(Boolean).map(unstored) };
  });
}


type DownloadContext = SyncDownloadScope & { expectedCursor?: string; previousCursor?: string };
type DownloadProgress = SyncDownloadScope & { profileId: string; commit: string; cursor: string; nextCursor?: string };
type Receipt = SyncDownloadScope & { profileId: string; deviceId: string; batchId: string; blobSha: string; hash: string };
const scopeKey = (profileId: string, scope: SyncDownloadScope) => [profileId, scope.accountId, scope.bindingVersion];

// Cursors and receipts are account/binding-specific caches, not backup data. A restore safely redownloads.
export async function readSyncDownload(profileId: string, scope: SyncDownloadScope, database: Dexie = db): Promise<DownloadProgress | undefined> {
  profileIdSchema.parse(profileId); syncDownloadScopeSchema.parse(scope);
  return database.table('syncDownloads').get(scopeKey(profileId, scope));
}

async function receiptPresent(profileId: string, scope: SyncDownloadScope, file: { deviceId: string; batchId: string; blobSha: string }, database: Dexie) {
  const receipt: Receipt | undefined = await database.table('syncReceipts').get([...scopeKey(profileId, scope), file.deviceId, file.batchId]);
  if (!receipt || receipt.blobSha !== file.blobSha) return false;
  const stored: StoredBatch | undefined = await database.table('syncBatches').get([profileId, file.deviceId, file.batchId]);
  const conflict = stored?.hash === receipt.hash ? stored : await database.table('syncConflicts').get([profileId, receipt.hash]);
  if (!conflict || conflict.batch.profileId !== scope.profileId || conflict.batch.deviceId !== file.deviceId || conflict.batch.batchId !== file.batchId) return false;
  const validated = await Dexie.waitFor(validateSyncBatch(conflict.batch));
  return validated.hash === receipt.hash;
}

export async function knownSyncFiles(profileId: string, scope: SyncDownloadScope, raw: unknown, database: Dexie = db) {
  profileIdSchema.parse(profileId); syncDownloadScopeSchema.parse(scope);
  const files = syncKnownFilesSchema.parse(raw);
  return database.transaction('r', database.table('syncReceipts'), database.table('syncBatches'), database.table('syncConflicts'), async () => {
    const known = [];
    for (const file of files) if (await receiptPresent(profileId, scope, file, database)) known.push(file);
    return known;
  });
}

// Validate outside IndexedDB. Events, quarantine, receipts and next-page progress commit together.
export async function receiveSyncPage(profileId: string, raw: unknown, database: Dexie = db, context?: DownloadContext, beforeCommit?: () => Promise<void>) {
  profileIdSchema.parse(profileId);
  const page = syncChangesSchema.parse(raw);
  const scope = context ? syncDownloadScopeSchema.parse({ accountId: context.accountId, profileId: context.profileId, bindingVersion: context.bindingVersion }) : undefined;
  if (context?.expectedCursor && page.cursor !== context.expectedCursor) throw new Error('SYNC_DOWNLOAD_CHANGED');
  if (scope && (!page.scope || canonicalJson(scope) !== canonicalJson(page.scope))) throw new Error('SYNC_SCOPE_CHANGED');
  if (page.total < page.files.length || (!scope && page.files.length !== page.batches.length)) throw new Error('SYNC_PAGE_INVALID');
  const files = new Map(page.files.map(file => [`${file.deviceId}/${file.batchId}`, file]));
  if (files.size !== page.files.length || page.files.reduce((sum, file) => sum + file.bytes, 0) > 2 * 1024 * 1024) throw new Error('SYNC_PAGE_INVALID');
  const validated: (Awaited<ReturnType<typeof validateSyncBatch>> & { blobSha: string })[] = [];
  for (const entry of page.batches) {
    const value = await validateSyncBatch(entry.batch);
    const key = `${value.batch.deviceId}/${value.batch.batchId}`;
    const file = files.get(key);
    if (!file || file.blobSha !== entry.blobSha || value.hash !== entry.hash || value.bytes.length > file.bytes || (scope && value.batch.profileId !== scope.profileId)) throw new Error('SYNC_INTEGRITY');
    files.delete(key);
    validated.push({ ...value, blobSha: entry.blobSha });
  }
  const tables = ['syncEvents', 'syncBatches', 'syncClocks', 'syncConflicts', ...(scope ? ['syncDownloads', 'syncReceipts'] : []), ...(beforeCommit ? ['settings'] : [])].map(name => database.table(name));
  return database.transaction('rw', tables, async () => {
    await beforeCommit?.();
    if (scope) {
      const clock: Clock | undefined = await database.table('syncClocks').get(profileId);
      if ((clock?.logicalProfileId ?? profileId) !== scope.profileId) throw new Error('SYNC_INTEGRITY');
      const prior: DownloadProgress | undefined = await database.table('syncDownloads').get(scopeKey(profileId, scope));
      const replay = prior?.cursor === page.cursor && prior.commit === page.commit;
      if (!replay && (prior?.nextCursor !== context?.expectedCursor || (context?.expectedCursor && prior?.commit !== page.commit) || (prior && !context?.expectedCursor && context?.previousCursor !== prior.cursor))) throw new Error('SYNC_DOWNLOAD_CHANGED');
      for (const file of files.values()) if (!await receiptPresent(profileId, scope, file, database)) throw new Error('SYNC_RECEIPT_MISSING');
    }
    const results = [];
    for (const value of validated) {
      results.push(await receiveValidatedBatch(profileId, value.batch, value.hash, database));
      if (scope) await database.table('syncReceipts').put({ ...scope, profileId, deviceId: value.batch.deviceId, batchId: value.batch.batchId, blobSha: value.blobSha, hash: value.hash });
    }
    if (scope) await database.table('syncDownloads').put({ ...scope, profileId, commit: page.commit, cursor: page.cursor, ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}) });
    return { results, commit: page.commit, nextCursor: page.nextCursor };
  });
}
