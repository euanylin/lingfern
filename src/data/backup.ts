import { assistanceSchema, workspaceSchema, validateWorkspace } from '../shared/practiceWorkspace';
import { readingAnnotationsSchema, validateReadingAnnotations } from '../shared/readingAnnotations';
import { purgeDeletedRecords } from './deletion';
import { preferencesSchema, type Preferences } from '../shared/preferences';
import { exposureSchema, type Exposure } from '../shared/exposure';
import { zipSync } from 'fflate';
import { unpackZip } from './zip';
import { z } from 'zod';
import { lessonSchema, ruleHashesSchema, questions, validateAnswer, selfAssessmentSchema, validateSelfAssessment } from '../shared/content';
import { attempts, bootstrapSyncEvents, db, exposures, feedbackNotes, memories, profiles, sessions, settings, type Attempt, type FeedbackNote, type Memory, type Session } from './db';
import { syncBatchSchema, syncEventSchema, validateSyncBatch, canonicalJson } from '../shared/sync';
import { profileIdSchema } from '../shared/repository';
import { syncAccountSchema } from '../shared/auth';
import type { StoredEvent, StoredBatch, Clock } from './sync';
import { gutenbergNotice, gutenbergTerms, isGutenbergSource } from '../shared/sourceLicence';

const currentNames = ['manifest.json', 'sessions.json', 'attempts.json', 'exposures.json', 'memories.json', 'feedbackNotes.json', 'syncEvents.json', 'syncBatches.json', 'syncClocks.json', 'syncConflicts.json'] as const;
const licenceName = 'gutenberg-license.txt';
const optionalNames = [...currentNames, licenceName] as const;
const MAX_LICENCE = 64 * 1024;
const MAX_ZIP = 32 * 1024 * 1024;
const MAX_UNPACKED = 64 * 1024 * 1024;
const MAX_ROWS = 50_000;
const MAX_PROFILE_NAME = 80;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const sessionSchema = z.object({ id: z.string().min(1).max(80), syncSessionId: z.string().min(1).max(80).optional(), profileId: z.string().min(1).max(80), lesson: lessonSchema, ruleHashes: ruleHashesSchema.optional(), itemHashes: z.record(z.string().min(1).max(80), z.string().regex(/^[a-f0-9]{64}$/)).optional(), contentHash: z.string().regex(/^[a-f0-9]{64}$/), recordsDeleted: z.literal(true).optional(), position: z.number().int().nonnegative(), status: z.enum(['active', 'completed', 'ended']), startedAt: z.iso.datetime(), checkDeviceId: z.uuid().optional(), checkGroupId: z.uuid().optional(), practiceGroupId: z.uuid().optional(), checkStartedAt: z.iso.datetime().optional(), checkEndedAt: z.iso.datetime().optional(), workspace: workspaceSchema.optional(), readingAnnotations: readingAnnotationsSchema.optional(), draft: z.union([z.number(), z.string().max(4000), z.array(z.string())]).optional(), assistance: assistanceSchema, leaseUntil: z.number().nonnegative() }).strict();
const attemptSchema = z.object({ id: z.string().min(1).max(160), syncRecordId: z.string().min(1).max(160).optional(), sessionId: z.string().min(1).max(80), profileId: z.string().min(1).max(80), questionId: z.string().min(1).max(80), rootId: z.string().min(1).max(160), answer: z.union([z.number(), z.string().max(4000), z.array(z.string())]), correct: z.boolean().nullable(), selfAssessment: selfAssessmentSchema.optional(), rule: z.string().min(1).max(120), assistance: assistanceSchema, submittedAt: z.iso.datetime() }).strict();
const fileSchema = z.object({ bytes: z.number().int().nonnegative().max(MAX_UNPACKED), sha256: z.string().regex(/^[a-f0-9]{64}$/), count: z.number().int().nonnegative().max(MAX_ROWS) }).strict();
const manifestSchema = z.object({ format: z.literal('lingfern-local-backup'), version: z.literal(6), createdAt: z.iso.datetime(), sourceProfileId: z.string().min(1).max(80), profileName: z.string().min(1).max(MAX_PROFILE_NAME).default('Local profile'), nameIsCustom: z.literal(true).optional(), preferences: preferencesSchema.optional(), files: z.record(z.string(), fileSchema) }).strict();
const memorySchema = z.object({ profileId: z.string().min(1).max(80), memoryId: z.string().min(1).max(160), term: z.string().min(1).max(80), definition: z.string().min(1).max(2000), savedAt: z.iso.datetime() }).strict();
const feedbackNoteSchema = z.object({ id: z.uuid(), profileId: z.string().min(1).max(80), attemptId: z.string().min(1).max(160), kind: z.enum(['text', 'structured']), content: z.string().min(1).max(64 * 1024), unknownReferences: z.boolean(), createdAt: z.iso.datetime() }).strict();

const syncEventRecordSchema = z.object({ profileId: profileIdSchema, batchId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/).optional(), event: syncEventSchema }).strict().transform(({ profileId, batchId, event }) => ({ ...event, profileId, ...(batchId ? { batchId } : {}) }));
const syncBatchRecordSchema = z.object({ profileId: profileIdSchema, deviceId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/), batchId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/), hash: z.string().regex(/^[a-f0-9]{64}$/), batch: syncBatchSchema, state: z.enum(['pending', 'confirmed', 'received', 'conflict']) }).strict();
const syncClockSchema = z.object({ profileId: profileIdSchema, deviceId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/), counter: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), logicalProfileId: profileIdSchema.optional(), localRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional() }).strict();
const syncConflictSchema = z.object({ profileId: profileIdSchema, hash: z.string().regex(/^[a-f0-9]{64}$/), batch: syncBatchSchema, reason: z.literal('SYNC_BATCH_CONFLICT') }).strict();
type SyncConflict = z.infer<typeof syncConflictSchema>;

async function sha256(bytes: Uint8Array) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))), value => value.toString(16).padStart(2, '0')).join('');
}

function backupProfileName(name: string) {
  let prefix = '';
  for (const character of name) {
    if (prefix.length + character.length > MAX_PROFILE_NAME) break;
    prefix += character;
  }
  return prefix || 'Local profile';
}

export async function exportBackup(profileId: string, profileName?: string) {
  const selectedName = profileName === undefined ? undefined : manifestSchema.shape.profileName.parse(profileName);
  await bootstrapSyncEvents(profileId);
  await purgeDeletedRecords(profileId);
  const { profile, ...snapshot } = await db.transaction('r', [profiles, sessions, attempts, exposures, memories, feedbackNotes, db.table('syncEvents'), db.table('syncBatches'), db.table('syncClocks'), db.table('syncConflicts')], async () => ({
      profile: await profiles.get(profileId),
      sessions: (await sessions.where('profileId').equals(profileId).toArray()).map(session => ({ ...session, owner: undefined, leaseUntil: 0, lockMode: undefined })),
      attempts: await attempts.where('profileId').equals(profileId).toArray(),
      exposures: await exposures.where('profileId').equals(profileId).toArray(),
      memories: (await memories.where('profileId').equals(profileId).toArray()).map(memory => ({ profileId: memory.profileId, memoryId: memory.memoryId, term: memory.term, definition: memory.definition, savedAt: memory.savedAt })),
      feedbackNotes: await feedbackNotes.where('profileId').equals(profileId).toArray(),
      syncEvents: (await db.table('syncEvents').where('profileId').equals(profileId).toArray()).map(({ profileId, batchId, ...event }: StoredEvent) => ({ profileId, batchId, event })),
      syncBatches: await db.table('syncBatches').where('profileId').equals(profileId).toArray(),
      syncClocks: await db.table('syncClocks').where('profileId').equals(profileId).toArray(),
      syncConflicts: await db.table('syncConflicts').where('profileId').equals(profileId).toArray(),
    }));
  if (snapshot.syncClocks.some((clock: Clock) => clock.deleted)) throw new Error('PROFILE_DELETED');
  if (Object.values(snapshot).some(rows => rows.length > MAX_ROWS)) throw new Error('BACKUP_SIZE');
  const payload: Record<string, Uint8Array> = {
    'sessions.json': encoder.encode(JSON.stringify(snapshot.sessions)),
    'attempts.json': encoder.encode(JSON.stringify(snapshot.attempts)),
    'exposures.json': encoder.encode(JSON.stringify(snapshot.exposures)),
    'memories.json': encoder.encode(JSON.stringify(snapshot.memories)),
    'feedbackNotes.json': encoder.encode(JSON.stringify(snapshot.feedbackNotes)),
    'syncEvents.json': encoder.encode(JSON.stringify(snapshot.syncEvents)),
    'syncBatches.json': encoder.encode(JSON.stringify(snapshot.syncBatches)),
    'syncClocks.json': encoder.encode(JSON.stringify(snapshot.syncClocks)),
    'syncConflicts.json': encoder.encode(JSON.stringify(snapshot.syncConflicts)),
  };
  if (snapshot.sessions.some(session => session.lesson.materials.some(material => isGutenbergSource(material.credit?.sourceUrl)))) payload[licenceName] = encoder.encode(gutenbergTerms);
  const fileEntries = await Promise.all(Object.entries(payload).map(async ([name, bytes]) => [name, { bytes: bytes.length, sha256: await sha256(bytes), count: name === licenceName ? 1 : snapshot[name.slice(0, -5) as keyof typeof snapshot].length }] as const));
  const manifest = { format: 'lingfern-local-backup', version: 6, createdAt: new Date().toISOString(), sourceProfileId: profileId, profileName: selectedName ?? backupProfileName(profile?.name ?? 'Local profile'), nameIsCustom: (selectedName === undefined ? profile?.nameIsCustom : selectedName.includes('Local profile')) || undefined, preferences: profile?.preferences, files: Object.fromEntries(fileEntries) };
  const files = { 'manifest.json': encoder.encode(JSON.stringify(manifest)), ...payload };
  if (Object.values(files).reduce((total, bytes) => total + bytes.length, 0) > MAX_UNPACKED) throw new Error('BACKUP_SIZE');
  const zip = zipSync(files, { level: 6 });
  if (zip.length > MAX_ZIP) throw new Error('BACKUP_SIZE');
  return zip;
}

export type BackupInspection = {
  summary: { preferences?: Preferences; createdAt: string; profileName: string; nameIsCustom?: true; sourceProfileId: string; sessions: number; attempts: number; exposures: number; memories: number; feedbackNotes: number; bytes: number };
  records: { sessions: Session[]; attempts: Attempt[]; exposures: Exposure[]; memories: Memory[]; feedbackNotes: FeedbackNote[]; syncEvents: StoredEvent[]; syncBatches: StoredBatch[]; syncClocks: Clock[]; syncConflicts: SyncConflict[] };
};

export async function inspectBackup(bytes: Uint8Array): Promise<BackupInspection> {
  const files = unpackZip(bytes, { maxCompressed: MAX_ZIP, maxExpanded: MAX_UNPACKED, maxFiles: optionalNames.length, validCounts: [currentNames.length, optionalNames.length], allowName: name => optionalNames.some(allowed => allowed === name), error: 'BACKUP' });
  const manifest = manifestSchema.parse(JSON.parse(decoder.decode(files['manifest.json'])));
  const hasLicence = Object.hasOwn(files, licenceName);
  const expectedNames = hasLicence ? optionalNames : currentNames;
  if (Object.keys(files).length !== expectedNames.length || Object.keys(manifest.files).length !== expectedNames.length - 1 || expectedNames.some(name => !files[name]) || expectedNames.slice(1).some(name => !manifest.files[name])) throw new Error('BACKUP_ZIP');
  if (hasLicence) {
    const file = files[licenceName], expected = manifest.files[licenceName];
    if (file.length > MAX_LICENCE || file.length !== expected.bytes || expected.count !== 1 || await sha256(file) !== expected.sha256) throw new Error('BACKUP_INTEGRITY');
    const text = decoder.decode(file);
    // Treat terms as inert text; hashes prove integrity, not rights.
    if (!text.startsWith(gutenbergNotice + '\n\nSTART: FULL LICENSE\n') || !text.includes('\nTHE FULL PROJECT GUTENBERG LICENSE\n') || [1, 2, 3, 4, 5].some(section => !text.includes(`\nSection ${section}. `)) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw new Error('BACKUP_INTEGRITY');
  }
  const read = async <T>(name: string, schema: z.ZodType<T>) => {
    const file = files[name];
    const expected = manifest.files[name];
    if (file.length !== expected.bytes || await sha256(file) !== expected.sha256) throw new Error('BACKUP_INTEGRITY');
    const rows = z.array(schema).max(MAX_ROWS).parse(JSON.parse(decoder.decode(file)));
    if (rows.length !== expected.count) throw new Error('BACKUP_INTEGRITY');
    return rows;
  };
  const [savedSessions, savedAttempts, savedExposures] = await Promise.all([
    read('sessions.json', sessionSchema), read('attempts.json', attemptSchema), read('exposures.json', exposureSchema),
  ]);
  for (const session of savedSessions) if (session.readingAnnotations) validateReadingAnnotations(session.lesson, session.readingAnnotations);
  if (!hasLicence && savedSessions.some(session => session.lesson.materials.some(material => isGutenbergSource(material.credit?.sourceUrl)))) throw new Error('BACKUP_INTEGRITY');
  const savedMemories = await read('memories.json', memorySchema);
  const savedFeedback = await read('feedbackNotes.json', feedbackNoteSchema);
  const [savedSyncEvents, savedSyncBatches, savedSyncClocks, savedSyncConflicts] = await Promise.all([
    read('syncEvents.json', syncEventRecordSchema), read('syncBatches.json', syncBatchRecordSchema), read('syncClocks.json', syncClockSchema), read('syncConflicts.json', syncConflictSchema),
  ]);
  if (savedSyncClocks.length > 1 || [...savedSyncEvents, ...savedSyncBatches, ...savedSyncClocks, ...savedSyncConflicts].some(row => row.profileId !== manifest.sourceProfileId)) throw new Error('BACKUP_REFERENCE');
  const logicalProfileId = savedSyncClocks[0]?.logicalProfileId ?? manifest.sourceProfileId;
  if (new Set(savedSyncEvents.map(event => event.id)).size !== savedSyncEvents.length || new Set(savedSyncBatches.map(row => `${row.deviceId}/${row.batchId}`)).size !== savedSyncBatches.length || new Set(savedSyncConflicts.map(row => row.hash)).size !== savedSyncConflicts.length) throw new Error('BACKUP_DUPLICATE');
  const syncById = new Map(savedSyncEvents.map(({ profileId: _profile, batchId: _batch, ...event }) => { void _profile; void _batch; return [event.id, event] as const; }));
  for (const row of [...savedSyncBatches, ...savedSyncConflicts]) {
    const validated = await validateSyncBatch(row.batch);
    if (validated.hash !== row.hash || row.batch.profileId !== logicalProfileId) throw new Error('BACKUP_INTEGRITY');
    if ('deviceId' in row && (row.deviceId !== row.batch.deviceId || row.batchId !== row.batch.batchId)) throw new Error('BACKUP_REFERENCE');
    if ('state' in row && row.state !== 'conflict') for (const event of row.batch.events) {
      const existing = syncById.get(event.id);
      if (!existing || canonicalJson(existing) !== canonicalJson(event)) throw new Error('BACKUP_REFERENCE');
    }
  }
  for (const event of savedSyncEvents) if (event.batchId && !savedSyncBatches.some(row => row.deviceId === event.deviceId && row.batchId === event.batchId && row.batch.events.some(item => item.id === event.id))) throw new Error('BACKUP_REFERENCE');
  if (savedSyncEvents.length && (!savedSyncClocks.length || savedSyncClocks[0].counter < Math.max(...savedSyncEvents.map(event => event.counter)))) throw new Error('BACKUP_REFERENCE');
  const byId = new Map(savedSessions.map(session => [session.id, session]));
  const checkGroups = new Map<string, Session[]>(), practiceGroups = new Map<string, Session[]>();
  if (byId.size !== savedSessions.length || new Set(savedAttempts.map(attempt => attempt.id)).size !== savedAttempts.length || new Set(savedExposures.map(exposure => exposure.rootId)).size !== savedExposures.length) throw new Error('BACKUP_DUPLICATE');
  for (const session of savedSessions) {
    if (session.practiceGroupId) {
      const pair = practiceGroups.get(session.practiceGroupId) ?? [];
      if (pair.length >= 2 || session.checkGroupId || session.lesson.mode === 'check') throw new Error('BACKUP_REFERENCE');
      pair.push(session); practiceGroups.set(session.practiceGroupId, pair);
    }
    if (session.checkGroupId) {
      const pair = checkGroups.get(session.checkGroupId) ?? [];
      if (pair.length >= 2) throw new Error('BACKUP_REFERENCE');
      pair.push(session); checkGroups.set(session.checkGroupId, pair);
    }
    if (session.profileId !== manifest.sourceProfileId || session.position >= questions(session.lesson).length) throw new Error('BACKUP_REFERENCE');
    if (session.lesson.mode !== 'check' && (session.status === 'ended' || session.checkDeviceId || session.checkStartedAt || session.checkEndedAt)) throw new Error('BACKUP_REFERENCE');
    if (session.lesson.mode === 'check' && (session.status === 'ended' ? !session.checkStartedAt || !session.checkEndedAt : session.status === 'active' ? !!session.checkEndedAt : !!session.checkEndedAt && !session.checkStartedAt)) throw new Error('BACKUP_REFERENCE');
    if (session.workspace) validateWorkspace(session.lesson, session.workspace);
    if (session.draft !== undefined) validateAnswer(questions(session.lesson)[session.position].question, session.draft, true);
    if (await sha256(encoder.encode(JSON.stringify(session.lesson))) !== session.contentHash) throw new Error('BACKUP_INTEGRITY');
    if (session.itemHashes) {
      const items = questions(session.lesson);
      if (Object.keys(session.itemHashes).length !== items.length) throw new Error('BACKUP_INTEGRITY');
      for (const item of items) if (session.itemHashes[item.question.id] !== await sha256(encoder.encode(JSON.stringify(item)))) throw new Error('BACKUP_INTEGRITY');
    }
  }
  for (const pair of checkGroups.values()) {
    if (pair.length !== 2 || pair.some(session => session.lesson.mode !== 'check') || new Set(pair.map(session => session.lesson.skill)).size !== 2
      || !pair[0].checkDeviceId || pair[0].checkDeviceId !== pair[1].checkDeviceId
      || pair[0].lesson.materials.some(material => pair[1].lesson.materials.some(other => other.rootId === material.rootId))) throw new Error('BACKUP_REFERENCE');
  }
  for (const [groupId, pair] of practiceGroups) {
    if (checkGroups.has(groupId) || pair.length !== 2 || pair.some(session => session.lesson.mode === 'check')
      || pair[0].lesson.mode !== pair[1].lesson.mode || new Set(pair.map(session => session.lesson.skill)).size !== 2) throw new Error('BACKUP_REFERENCE');
  }
  for (const attempt of savedAttempts) {
    const session = byId.get(attempt.sessionId);
    const item = session && questions(session.lesson).find(item => item.question.id === attempt.questionId);
    if (attempt.profileId !== manifest.sourceProfileId || attempt.id !== `${attempt.sessionId}:${attempt.questionId}` || !item || item.material.rootId !== attempt.rootId) throw new Error('BACKUP_REFERENCE');
    validateAnswer(item.question, attempt.answer);
    if ('criteria' in item.question) {
      if (attempt.correct !== null || attempt.rule !== 'open-response-unscored-v1') throw new Error('BACKUP_REFERENCE');
      if (attempt.selfAssessment !== undefined) validateSelfAssessment(item.question, attempt.selfAssessment);
    } else if (attempt.correct === null || attempt.selfAssessment !== undefined) throw new Error('BACKUP_REFERENCE');
  }
  const attemptIds = new Set(savedAttempts.map(attempt => attempt.id));
  if (new Set(savedFeedback.map(note => note.id)).size !== savedFeedback.length || savedFeedback.some(note => note.profileId !== manifest.sourceProfileId || !attemptIds.has(note.attemptId))) throw new Error('BACKUP_REFERENCE');
  if (savedExposures.some(exposure => exposure.profileId !== manifest.sourceProfileId)) throw new Error('BACKUP_REFERENCE');
  for (const exposure of savedExposures) for (const contact of exposure.contacts ?? []) {
    const session = byId.get(contact.sessionId);
    const item = session && questions(session.lesson).find(item => item.question.id === contact.questionId);
    if (!item || item.material.rootId !== exposure.rootId || item.material.id !== contact.materialId || contact.variantGroup !== ('variantGroup' in item.question && item.question.variantGroup ? item.question.variantGroup : item.question.id)) throw new Error('BACKUP_REFERENCE');
  }
  const memoryIds = new Set(savedMemories.map(memory => memory.memoryId));
  if (memoryIds.size !== savedMemories.length) throw new Error('BACKUP_DUPLICATE');
  if (savedMemories.some(memory => memory.profileId !== manifest.sourceProfileId)) throw new Error('BACKUP_REFERENCE');
  return { summary: { preferences: manifest.preferences, createdAt: manifest.createdAt, profileName: manifest.profileName, ...(manifest.nameIsCustom ? { nameIsCustom: true } : {}), sourceProfileId: manifest.sourceProfileId, sessions: savedSessions.length, attempts: savedAttempts.length, exposures: savedExposures.length, memories: savedMemories.length, feedbackNotes: savedFeedback.length, bytes: bytes.length }, records: { sessions: savedSessions, attempts: savedAttempts, exposures: savedExposures, memories: savedMemories, feedbackNotes: savedFeedback, syncEvents: savedSyncEvents, syncBatches: savedSyncBatches, syncClocks: savedSyncClocks, syncConflicts: savedSyncConflicts } };
}

export async function importBackup(inspection: BackupInspection, accountId?: number, expectedActiveProfile?: string | null, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (expectedActiveProfile != null) profileIdSchema.parse(expectedActiveProfile);
  const oldClock = inspection.records.syncClocks[0];
  const logicalProfileId = oldClock?.logicalProfileId ?? inspection.summary.sourceProfileId;
  const association = accountId === undefined ? undefined : syncAccountSchema.parse({ accountId, profileId: logicalProfileId });
  const id = crypto.randomUUID();
  const ids = new Map(inspection.records.sessions.map(session => [session.id, crypto.randomUUID()]));
  const importedSessions = inspection.records.sessions.map(session => ({ ...session, id: ids.get(session.id)!, syncSessionId: session.syncSessionId ?? session.id, profileId: id, owner: undefined, leaseUntil: 0 }));
  const importedAttempts = inspection.records.attempts.map(attempt => ({ ...attempt, id: `${ids.get(attempt.sessionId)}:${attempt.questionId}`, syncRecordId: attempt.syncRecordId ?? attempt.id, sessionId: ids.get(attempt.sessionId)!, profileId: id }));
  const attemptIds = new Map(inspection.records.attempts.map((attempt, index) => [attempt.id, importedAttempts[index].id]));
  const importedExposures = inspection.records.exposures.map(exposure => ({ ...exposure, profileId: id, ...(exposure.contacts ? { contacts: exposure.contacts.map(contact => ({ ...contact, sessionId: ids.get(contact.sessionId)! })) } : {}) }));
  const importedMemories = inspection.records.memories.map(memory => ({ ...memory, profileId: id }));
  const importedFeedback = inspection.records.feedbackNotes.map(note => ({ ...note, id: crypto.randomUUID(), profileId: id, attemptId: attemptIds.get(note.attemptId)! }));
  await db.transaction('rw', [profiles, sessions, attempts, exposures, memories, feedbackNotes, settings, db.table('syncEvents'), db.table('syncBatches'), db.table('syncClocks'), db.table('syncConflicts')], async () => {
    signal?.throwIfAborted();
    if (expectedActiveProfile !== undefined && (((await settings.get('activeProfile'))?.value ?? null) !== expectedActiveProfile || expectedActiveProfile !== null && !await profiles.get(expectedActiveProfile))) throw new Error('SYNC_SCOPE_CHANGED');
    await profiles.add({ id, preferences: inspection.summary.preferences, name: inspection.summary.profileName, ...(inspection.summary.nameIsCustom ? { nameIsCustom: true } : {}), createdAt: new Date().toISOString() });
    await sessions.bulkAdd(importedSessions);
    await attempts.bulkAdd(importedAttempts);
    await exposures.bulkAdd(importedExposures);
    await memories.bulkAdd(importedMemories);
    await feedbackNotes.bulkAdd(importedFeedback);
    await db.table('syncEvents').bulkAdd(inspection.records.syncEvents.map(row => ({ ...row, profileId: id })));
    // Do not inherit another account's acknowledgement during explicit imports.
    await db.table('syncBatches').bulkAdd(inspection.records.syncBatches.map(row => ({ ...row, profileId: id, ...(association && row.state !== 'conflict' ? { state: 'pending' } : {}) })));
    await db.table('syncConflicts').bulkAdd(inspection.records.syncConflicts.map(row => ({ ...row, profileId: id })));
    await db.table('syncClocks').add({ profileId: id, deviceId: crypto.randomUUID(), counter: oldClock?.counter ?? 0, logicalProfileId });
    if (association) await settings.put({ key: `profile:${id}:syncAccount`, value: JSON.stringify(association) });
    await settings.put({ key: 'activeProfile', value: id });
    signal?.throwIfAborted();
  });
  return id;
}
