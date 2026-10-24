import { z } from 'zod';
import { localeSchema } from './locale';
import { profileIdSchema } from './repository';
import { preferencesSchema } from './preferences';
import { levelSchema } from './content';
import { readPracticeSelection } from './practiceSelection';
import { lookupKey, lookupRecordSchema } from './lookupHistory';

export const syncByteLimit = 250 * 1024;
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const reference = z.string().min(1).max(160);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const assistance = z.object({ hintLevel: z.number().int().min(0).max(3), dictionaryUsed: z.boolean(), audioCompleted: z.boolean(), playbackRequests: z.number().int().min(0).max(10000), teachingProvided: z.boolean().optional() }).strict();
const settingPayload = z.discriminatedUnion('key', [
  z.object({ key: z.literal('locale'), value: localeSchema }).strict(),
  z.object({ key: z.literal('theme'), value: z.enum(['system', 'light', 'dark']) }).strict(),
  z.object({ key: z.enum(['desktopNavDisplay', 'mobileNavDisplay']), value: z.enum(['text', 'icon', 'both']) }).strict(),
  z.object({ key: z.literal('onlineDictionary'), value: z.enum(['cambridge', 'oxford', 'wiktionary', 'merriam-webster']) }).strict(),
  z.object({ key: z.enum(['readingPractice', 'listeningPractice']), value: z.string().max(6000).refine(value => { try { readPracticeSelection(value); return true; } catch { return false; } }) }).strict(),
]);
export { settingPayload as syncSettingSchema };
const base = z.object({ id, deviceId: id, counter: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER), occurredAt: z.iso.datetime() });
const lookupContext = z.record(id, z.number().int().min(1).max(Number.MAX_SAFE_INTEGER)).refine(value => Object.keys(value).length <= 256);
// Sync summaries, preferences and lookups; exclude private answers, notes and materials.
export const syncEventSchema = z.discriminatedUnion('type', [
  base.extend({ type: z.literal('completion'), payload: z.object({ recordId: reference, sessionId: reference, questionId: reference, rootId: reference, goalId: reference, skill: z.enum(['reading', 'listening']), level: levelSchema, mode: z.enum(['practice', 'check']), contentHash: hash, scoringHash: hash.optional(), correct: z.boolean().nullable(), assistance }).strict() }).strict(),
  base.extend({ type: z.literal('exposure'), payload: z.object({ sessionId: reference, rootId: reference, materialId: reference, questionId: reference, variantGroup: reference }).strict() }).strict(),
  base.extend({ type: z.literal('saved_item'), payload: z.object({ memoryId: reference, saved: z.boolean(), reviewEnabled: z.boolean().optional() }).strict() }).strict(),
  base.extend({ type: z.literal('preferences'), payload: preferencesSchema }).strict(),
  base.extend({ type: z.literal('setting'), payload: settingPayload }).strict(),
  base.extend({ type: z.literal('deletion'), payload: z.union([z.object({ target: z.enum(['record', 'exposure']), targetId: reference }).strict(), z.object({ target: z.literal('exposure_contact'), targetId: reference, sessionId: reference, questionId: reference }).strict()]) }).strict(),
  base.extend({ type: z.literal('installation'), payload: z.object({ contentId: reference, contentHash: hash, wanted: z.boolean() }).strict() }).strict(),
  base.extend({ type: z.literal('completion_timing'), payload: z.object({ sourceId: id, sourceHash: hash, time: z.iso.datetime() }).strict() }).strict(),
  // Preserve legacy wire bytes without restoring the retired review feature.
  base.extend({ type: z.literal('review_timing'), payload: z.object({ memoryId: reference, sourceId: id, sourceHash: hash, time: z.iso.datetime() }).strict() }).strict(),
  base.extend({ type: z.literal('memory_review'), payload: z.object({ memoryId: reference, rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), configId: reference, assistance: z.object({ answerRevealed: z.boolean(), hintUsed: z.boolean() }).strict() }).strict() }).strict(),
  base.extend({ type: z.literal('lookup'), payload: lookupRecordSchema }).strict(),
  base.extend({ type: z.literal('lookup_remove'), payload: lookupRecordSchema.pick({ kind: true, term: true }).extend({ seen: lookupContext }).strict() }).strict(),
  base.extend({ type: z.literal('lookup_clear'), payload: z.object({ seen: lookupContext }).strict() }).strict(),
]);
export type SyncEvent = z.infer<typeof syncEventSchema>;
export const syncBatchSchema = z.object({ product: z.literal('Lingfern'), formatVersion: z.literal(1), profileId: profileIdSchema, deviceId: id, batchId: id, events: z.array(syncEventSchema).min(1).max(500) }).strict().superRefine((batch, ctx) => {
  const ids = new Set<string>();
  for (const event of batch.events) {
    if (event.deviceId !== batch.deviceId || ids.has(event.id)) ctx.addIssue({ code: 'custom', message: 'Invalid event ownership or duplicate ID' });
    ids.add(event.id);
  }
});
export type SyncBatch = z.infer<typeof syncBatchSchema>;
export const syncDownloadScopeSchema = z.object({ accountId: z.number().int().positive(), profileId: profileIdSchema, bindingVersion: z.string().regex(/^[\w-]{43}$/) }).strict();
export const syncUploadSchema = z.object({ scope: syncDownloadScopeSchema, batch: syncBatchSchema, hash }).strict();
export const syncAcknowledgementSchema = z.object({ scope: syncDownloadScopeSchema, batchId: id, hash, previouslyWritten: z.boolean() }).strict();
const blobSha = z.string().regex(/^[a-f0-9]{40}$/);
const syncFileSchema = z.object({ deviceId: id, batchId: id, blobSha, bytes: z.number().int().min(0).max(syncByteLimit) }).strict();
export const syncKnownFilesSchema = z.array(syncFileSchema.pick({ deviceId: true, batchId: true, blobSha: true })).max(10);
export type SyncDownloadScope = z.infer<typeof syncDownloadScopeSchema>;
export const syncChangesSchema = z.object({ scope: syncDownloadScopeSchema.optional(), commit: blobSha, cursor: z.string().min(1).max(4096), nextCursor: z.string().min(1).max(4096).optional(), total: z.number().int().min(0).max(5000), files: z.array(syncFileSchema).max(10), batches: z.array(z.object({ batch: syncBatchSchema, hash, blobSha }).strict()).max(10) }).strict();
export const syncMetadataSchema = z.union([syncChangesSchema, z.object({ scope: syncDownloadScopeSchema, commit: blobSha, unchanged: z.literal(true) }).strict()]);


// Canonicalize validated data only; reject undefined, code and non-finite numbers.
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
  }
  throw new Error('SYNC_INVALID_JSON');
}

export async function eventHash(event: SyncEvent) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson(event)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function validateSyncBatch(raw: unknown) {
  const batch = syncBatchSchema.parse(raw);
  const bytes = new TextEncoder().encode(canonicalJson(batch));
  if (bytes.byteLength > syncByteLimit) throw new Error('SYNC_CAPACITY');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return { batch, bytes, hash: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') };
}

export function compareSyncEvents(a: SyncEvent, b: SyncEvent) {
  // Sort by code units independently of locale and device clocks.
  const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
  return a.counter - b.counter || compare(a.deviceId, b.deviceId) || compare(a.id, b.id);
}

export function mergeSyncEvents(existing: readonly SyncEvent[], incoming: readonly SyncEvent[]) {
  const events = new Map<string, SyncEvent>();
  for (const raw of [...existing, ...incoming]) {
    const event = syncEventSchema.parse(raw);
    const prior = events.get(event.id);
    if (prior && canonicalJson(prior) !== canonicalJson(event)) throw new Error('SYNC_EVENT_CONFLICT');
    events.set(event.id, event);
  }
  return [...events.values()].sort(compareSyncEvents);
}

export function projectLookupHistory(raw: readonly SyncEvent[]) {
  // Clear observed versions without erasing concurrent or later lookups.
  const events = mergeSyncEvents([], raw);
  const cleared = new Map<string, number>(), removed = new Map<string, Map<string, number>>();
  for (const event of events) {
    if (event.type !== 'lookup_clear' && event.type !== 'lookup_remove') continue;
    const key = event.type === 'lookup_remove' ? lookupKey(event.payload) : undefined;
    const context = key === undefined ? cleared : removed.get(key) ?? new Map<string, number>();
    if (key !== undefined) removed.set(key, context);
    for (const [device, counter] of Object.entries(event.payload.seen)) context.set(device, Math.max(context.get(device) ?? 0, counter));
  }
  const latest = new Map<string, Extract<SyncEvent, { type: 'lookup' }>>();
  for (const event of events) if (event.type === 'lookup') {
    const key = lookupKey(event.payload);
    if (event.counter > Math.max(cleared.get(event.deviceId) ?? 0, removed.get(key)?.get(event.deviceId) ?? 0)) latest.set(key, event);
  }
  return [...latest.values()].sort((a, b) => b.payload.lookedUpAt.localeCompare(a.payload.lookedUpAt) || compareSyncEvents(b, a))
    .slice(0, 100).map(event => ({ ...event.payload, id: event.id }));
}

export const exposureContactKey = (value: { rootId: string; sessionId: string; questionId: string }) => canonicalJson([value.rootId, value.sessionId, value.questionId]);

export function projectSyncEvents(raw: readonly SyncEvent[]) {
  const events = mergeSyncEvents([], raw);
  const deletedRecords = new Set<string>();
  const deletedExposures = new Set<string>();
  const deletedContacts = new Set<string>();
  for (const event of events) if (event.type === 'deletion') {
    if (event.payload.target === 'exposure_contact') deletedContacts.add(exposureContactKey({ ...event.payload, rootId: event.payload.targetId }));
    else (event.payload.target === 'record' ? deletedRecords : deletedExposures).add(event.payload.targetId);
  }
  const completions: Extract<SyncEvent, { type: 'completion' }>[] = [];
  const exposures: Extract<SyncEvent, { type: 'exposure' }>[] = [];
  const savedItems = new Map<string, Extract<SyncEvent, { type: 'saved_item' }>>();
  const settings = new Map<string, Extract<SyncEvent, { type: 'setting' }>>();
  const installations = new Map<string, Extract<SyncEvent, { type: 'installation' }>>();
  let preferences: Extract<SyncEvent, { type: 'preferences' }> | undefined;
  for (const event of events) {
    switch (event.type) {
      case 'completion': if (!deletedRecords.has(event.payload.recordId)) completions.push(event); break;
      case 'exposure': if (!deletedExposures.has(event.payload.rootId) && !deletedContacts.has(exposureContactKey(event.payload))) exposures.push(event); break;
      case 'saved_item': savedItems.set(event.payload.memoryId, event); break;
      case 'setting': settings.set(event.payload.key, event); break;
      case 'installation': installations.set(event.payload.contentId, event); break;
      case 'preferences': preferences = event; break;
    }
  }
  return { completions, exposures, savedItems, settings, installations, preferences, deletedRecords, deletedExposures, deletedContacts, counter: events.at(-1)?.counter ?? 0 };
}
