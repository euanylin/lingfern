import { validateWorkspace, type Workspace } from '../shared/practiceWorkspace';
import { localeSchema } from '../shared/locale';
import { validateReadingAnnotations, type ReadingAnnotation } from '../shared/readingAnnotations';
import { communityLessonReady } from './communityInstall';
import { preferencesSchema, type Preferences } from '../shared/preferences';
import { exposureSchema, type Exposure } from '../shared/exposure';
import { appendSyncEvent, boundedReferences, readSyncEvents, type NewEvent } from './sync';
import { canonicalJson, exposureContactKey, projectSyncEvents, syncSettingSchema } from '../shared/sync';
import Dexie, { type Table } from 'dexie';
import type { Card } from 'ts-fsrs';
import { teachingSupport, lessonSchema, questions, score, validateAnswer, validateSelfAssessment, type Answer, type Lesson, type SelfAssessment } from '../shared/content';
import type { SpokenCorpus } from '../core/spokenCorpus';
import type { Corpus } from '../core/corpus';
import type { CommunityDictionaryEntry, CommunitySource } from './communityPack';

export type Assistance = { hintLevel: number; playbackRequests?: number; audioCompleted?: boolean; dictionaryUsed?: boolean; teachingProvided?: boolean };
export type Session = {
  id: string; syncSessionId?: string; profileId: string; lesson: Lesson; contentHash: string;
  ruleHashes?: { scoring: string; generator?: string };
  itemHashes?: Record<string, string>;
  recordsDeleted?: true; position: number; status: 'active' | 'completed' | 'ended'; startedAt: string;
  checkStartedAt?: string; checkEndedAt?: string; checkDeviceId?: string; checkGroupId?: string;
  practiceGroupId?: string;
  workspace?: Workspace;
  readingAnnotations?: ReadingAnnotation[]; draft?: Answer; assistance: Assistance; owner?: string; leaseUntil: number; lockMode?: 'web-lock';
};
export type Attempt = {
  id: string; syncRecordId?: string; sessionId: string; profileId: string; questionId: string; rootId: string;
  answer: Answer; correct: boolean | null; rule: string; assistance: Assistance; submittedAt: string;
  selfAssessment?: SelfAssessment;
};
export type Profile = { id: string; name: string; createdAt: string; preferences?: Preferences };
export type Memory = { profileId: string; memoryId: string; term: string; definition: string; savedAt: string; reviewEnabled: boolean; card?: Card };
export type MemoryReview = { id: string; profileId: string; memoryId: string; occurredAt: string; rating: 1 | 2 | 3 | 4; assistance: { answerRevealed: boolean; hintUsed: boolean }; configId: string };
export type FeedbackNote = { id: string; profileId: string; attemptId: string; kind: 'text' | 'structured'; content: string; unknownReferences: boolean; createdAt: string };
export type CommunityPackageRecord = { profileId: string; hash: string; id: string; lessons: Lesson[]; sources: CommunitySource[]; dictionary?: CommunityDictionaryEntry[]; corpus?: Corpus; spoken?: SpokenCorpus; state: 'staged' | 'ready'; installedAt: string };
export const db = new Dexie('lingfern');
db.version(8).stores({
  sessions: 'id, profileId, status', attempts: 'id, sessionId, profileId', exposures: '[profileId+rootId]', settings: 'key', profiles: 'id',
  memories: '[profileId+memoryId], profileId', memoryReviews: '[profileId+id], [profileId+memoryId], profileId', feedbackNotes: 'id, profileId, attemptId',
  communityPacks: '[profileId+hash], profileId, id, state', syncEvents: '[profileId+id], profileId',
  syncBatches: '[profileId+deviceId+batchId], profileId, [profileId+state]', syncClocks: 'profileId', syncConflicts: '[profileId+hash], profileId',
  syncDownloads: '[profileId+accountId+bindingVersion], profileId', syncReceipts: '[profileId+accountId+bindingVersion+deviceId+batchId], profileId',
  syncUploads: '[profileId+accountId+bindingVersion+deviceId+batchId], profileId',
});
export const syncEvents = db.table('syncEvents');
export const syncClocks = db.table('syncClocks');
export const sessions = db.table('sessions') as Table<Session, string>;
export const attempts = db.table('attempts') as Table<Attempt, string>;
export const exposures = db.table('exposures') as Table<Exposure, [string, string]>;
export const settings = db.table('settings') as Table<{ key: string; value: string }, string>;
export const profiles = db.table('profiles') as Table<Profile, string>;
export const memories = db.table('memories') as Table<Memory, [string, string]>;
export const memoryReviews = db.table('memoryReviews') as Table<MemoryReview, [string, string]>;
export const feedbackNotes = db.table('feedbackNotes') as Table<FeedbackNote, string>;
export const communityPacks = db.table('communityPacks') as Table<CommunityPackageRecord, [string, string]>;

export async function saveFeedbackNote(note: FeedbackNote) {
  await db.transaction('rw', attempts, feedbackNotes, async () => {
    const attempt = await attempts.get(note.attemptId);
    if (!attempt || attempt.profileId !== note.profileId) throw new Error('NOT_FOUND');
    await feedbackNotes.add(note);
  });
}
// Web Locks allow immediate handoff; the 15s lease protects fallback sessions.
const LEASE_MS = 15_000;

// Keep the installation ID across account/profile changes; never import or sync it.
const CHECK_DEVICE_KEY = 'check-device-id';
export async function checkDeviceId() {
  return db.transaction('rw', settings, async () => {
    const prior = await settings.get(CHECK_DEVICE_KEY);
    if (prior) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(prior.value)) throw new Error('CHECK_DEVICE');
      return prior.value;
    }
    const value = crypto.randomUUID();
    await settings.add({ key: CHECK_DEVICE_KEY, value });
    return value;
  });
}
async function assertCheckDevice(session: Session) {
  if (session.lesson.mode !== 'check' || session.status !== 'active') return;
  const local = await settings.get(CHECK_DEVICE_KEY);
  if (!session.checkDeviceId || session.checkDeviceId !== local?.value) throw new Error('CHECK_DEVICE');
}

async function prepareSession(raw: unknown, profileId: string): Promise<Session> {
  const lesson = lessonSchema.parse(raw);
  if (lesson.materials.some(material => material.communityPackageId && material.communityPackageId !== lesson.communityPackageId)) {
    if (!await communityLessonReady(lesson, profileId)) throw new Error('MISSING_MEDIA');
  }
  const digest = async (value: unknown) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))), b => b.toString(16).padStart(2, '0')).join('');
  const contentHash = await digest(lesson);
  const itemHashes = Object.fromEntries(await Promise.all(questions(lesson).map(async item => [item.question.id, await digest(item)])));
  const session: Session = {
    id: crypto.randomUUID(), profileId, lesson, contentHash, itemHashes,
    ruleHashes: { scoring: __LINGFERN_RULE_HASHES__.scoring, ...(lesson.generation ? { generator: __LINGFERN_RULE_HASHES__.generator } : {}) },
    ...(lesson.mode === 'check' ? { checkDeviceId: await checkDeviceId() } : {}),
    position: 0, status: 'active', startedAt: new Date().toISOString(), assistance: { hintLevel: 0, ...(!lesson.mode ? { teachingProvided: true } : {}) }, leaseUntil: 0,
  };
  return session;
}

async function addSession(session: Session) {
  if (session.lesson.generation) {
    const previous = await sessions.where('profileId').equals(session.profileId).filter(item => item.lesson.id === session.lesson.id && item.lesson.mode === session.lesson.mode).first();
    if (previous) throw new Error('VARIANT_ALREADY_SAVED');
  }
  await sessions.add(session);
}

export async function createSession(raw: unknown, profileId = 'local-guest') {
  const session = await prepareSession(raw, profileId);
  await db.transaction('rw', sessions, () => addSession(session));
  return session;
}

export async function createCombinedCheck(readingRaw: unknown, listeningRaw: unknown, profileId = 'local-guest'): Promise<[Session, Session]> {
  const reading = lessonSchema.parse(readingRaw), listening = lessonSchema.parse(listeningRaw);
  const roots = new Set(reading.materials.map(material => material.rootId));
  if (reading.mode !== 'check' || listening.mode !== 'check' || reading.skill !== 'reading' || listening.skill !== 'listening'
    || listening.materials.some(material => roots.has(material.rootId))) throw new Error('CHECK_RESTRICTED');
  // Hash before the transaction; save both snapshots atomically.
  const pair: [Session, Session] = [await prepareSession(reading, profileId), await prepareSession(listening, profileId)];
  const checkGroupId = crypto.randomUUID();
  pair.forEach(session => { session.checkGroupId = checkGroupId; });
  await db.transaction('rw', sessions, async () => { for (const session of pair) await addSession(session); });
  return pair;
}

export async function createCombinedPractice(readingRaw: unknown, listeningRaw: unknown, profileId = 'local-guest'): Promise<[Session, Session]> {
  const reading = lessonSchema.parse(readingRaw), listening = lessonSchema.parse(listeningRaw);
  if (reading.mode === 'check' || listening.mode === 'check' || reading.mode !== listening.mode || reading.skill !== 'reading' || listening.skill !== 'listening') throw new Error('PRACTICE_RESTRICTED');
  const pair: [Session, Session] = [await prepareSession(reading, profileId), await prepareSession(listening, profileId)];
  const practiceGroupId = crypto.randomUUID();
  pair.forEach(session => { session.practiceGroupId = practiceGroupId; });
  await db.transaction('rw', sessions, async () => { for (const session of pair) await addSession(session); });
  return pair;
}

export async function claimSession(id: string, owner: string, now = Date.now(), profileId?: string, holdsWebLock = false) {
  return db.transaction('rw', sessions, settings, async () => {
    const session = await sessions.get(id);
    if (!session) throw new Error('NOT_FOUND');
    if (profileId && session.profileId !== profileId) throw new Error('NOT_FOUND');
    await assertCheckDevice(session);
    if (session.owner && session.owner !== owner && session.leaseUntil > now && !(holdsWebLock && session.lockMode === 'web-lock')) throw new Error('BUSY');
    const lockMode = session.owner === owner ? session.lockMode : holdsWebLock ? 'web-lock' : undefined;
    await sessions.update(id, { owner, leaseUntil: now + LEASE_MS, lockMode, ...(session.checkDeviceId ? { checkDeviceId: session.checkDeviceId } : {}) });
    return { ...session, owner, leaseUntil: now + LEASE_MS, lockMode };
  });
}

export async function releaseSession(id: string, owner: string) {
  await db.transaction('rw', sessions, async () => {
    if ((await sessions.get(id))?.owner === owner) await sessions.update(id, { owner: undefined, leaseUntil: 0 });
  });
}

async function owned(id: string, owner: string) {
  const session = await sessions.get(id);
  if (!session) throw new Error('NOT_FOUND');
  if (session.recordsDeleted) throw new Error('RECORD_DELETED');
  if (session.owner !== owner || session.leaseUntil <= Date.now()) throw new Error('BUSY');
  lessonSchema.parse(session.lesson);
  await assertCheckDevice(session);
  if (session.workspace) validateWorkspace(session.lesson, session.workspace);
  return session;
}

export async function saveReadingAnnotation(id: string, owner: string, annotation: ReadingAnnotation) {
  return db.transaction('rw', sessions, settings, async () => {
    const session = await owned(id, owner);
    const next = validateReadingAnnotations(session.lesson, [...(session.readingAnnotations ?? []).filter(item => item.materialId !== annotation.materialId), annotation]);
    await sessions.update(id, { readingAnnotations: next });
    return next;
  });
}

async function writeExposure(session: Session) {
  if (session.lesson.mode === 'check' && !session.checkStartedAt) throw new Error('CHECK_NOT_STARTED');
  const { material, question } = questions(session.lesson)[session.position];
  const previous = await exposures.get([session.profileId, material.rootId]);
  const now = new Date().toISOString();
  const contacts = [...(previous?.contacts ?? [])];
  const index = contacts.findIndex(contact => contact.sessionId === session.id && contact.questionId === question.id);
  const old = contacts[index];
  const contact = { sessionId: session.id, materialId: material.id, questionId: question.id,
    variantGroup: 'variantGroup' in question && question.variantGroup ? question.variantGroup : question.id,
    firstSeenAt: old && old.firstSeenAt < now ? old.firstSeenAt : now,
    lastSeenAt: old && old.lastSeenAt > now ? old.lastSeenAt : now };
  if (index === -1) contacts.push(contact); else contacts[index] = contact;
  await exposures.put(exposureSchema.parse({ profileId: session.profileId, rootId: material.rootId,
    firstSeenAt: previous && previous.firstSeenAt < now ? previous.firstSeenAt : now,
    lastSeenAt: previous && (previous.lastSeenAt ?? previous.firstSeenAt) > now ? (previous.lastSeenAt ?? previous.firstSeenAt) : now, contacts }));
  await captureExposure(session.profileId, exposureSyncEvent(session, { material, question }), contact.firstSeenAt);
}

export async function markExposure(session: Session) {
  await db.transaction('rw', sessions, settings, exposures, syncEvents, syncClocks, async () => {
    const saved = await sessions.get(session.id);
    if (!saved || saved.profileId !== session.profileId || saved.position !== session.position || saved.contentHash !== session.contentHash) throw new Error('CONFLICT');
    await assertCheckDevice(saved);
    await writeExposure(saved);
  });
}

export async function beginCheck(id: string, owner: string) {
  return db.transaction('rw', sessions, settings, exposures, syncEvents, syncClocks, async () => {
    const session = await owned(id, owner);
    if (session.lesson.mode !== 'check' || session.status !== 'active') throw new Error('CHECK_RESTRICTED');
    if (session.checkStartedAt) return session;
    const roots = new Set(session.lesson.materials.map(material => material.rootId));
    const prior = await sessions.where('profileId').equals(session.profileId).filter(other => other.id !== session.id
      && (other.lesson.mode !== 'check' || !!other.checkStartedAt) && other.lesson.materials.some(material => roots.has(material.rootId))).first();
    const synced = projectSyncEvents(await readSyncEvents(session.profileId));
    if (prior || synced.exposures.some(event => roots.has(event.payload.rootId))
      || (await exposures.bulkGet([...roots].map(root => [session.profileId, root]))).some(Boolean)) throw new Error('CHECK_EXPOSED');
    session.checkStartedAt = new Date().toISOString();
    if (session.lesson.skill === 'reading') await writeExposure(session);
    await sessions.put(session);
    return session;
  });
}

export async function endCheck(id: string, owner: string) {
  return db.transaction('rw', sessions, settings, async () => {
    const session = await owned(id, owner);
    if (session.lesson.mode !== 'check' || !session.checkStartedAt || session.status !== 'active') throw new Error('CHECK_RESTRICTED');
    session.status = 'ended';
    session.checkEndedAt = new Date().toISOString();
    await sessions.put(session);
    return session;
  });
}

export async function saveDraft(id: string, owner: string, answer: Answer) {
  await db.transaction('rw', sessions, settings, async () => {
    const session = await owned(id, owner);
    if (session.lesson.organization) throw new Error('CONFLICT');
    if (session.status === 'ended' || (session.lesson.mode === 'check' && !session.checkStartedAt)) throw new Error('CHECK_RESTRICTED');
    validateAnswer(questions(session.lesson)[session.position].question, answer, true);
    await sessions.update(id, { draft: answer });
  });
}

export async function revealHint(id: string, owner: string) {
  return db.transaction('rw', sessions, settings, async () => {
    const session = await owned(id, owner);
    if (session.lesson.mode) throw new Error('CHECK_RESTRICTED');
    if (session.lesson.organization === 'material-v1' ? !questions(session.lesson)[session.position].material.questions.some(question => question.hints?.length) : !questions(session.lesson)[session.position].question.hints?.length) return session.assistance;
    const assistance = { ...session.assistance, hintLevel: Math.min(3, session.assistance.hintLevel + 1) };
    await sessions.update(id, { assistance });
    return assistance;
  });
}

export async function recordPlayback(id: string, owner: string, questionId: string, completed: boolean) {
  return db.transaction('rw', sessions, settings, attempts, async () => {
    const session = await owned(id, owner);
    if (session.status === 'ended' || (session.lesson.mode === 'check' && !session.checkStartedAt)) throw new Error('CHECK_RESTRICTED');
    if (session.lesson.skill !== 'listening' || questions(session.lesson)[session.position].question.id !== questionId) throw new Error('CONFLICT');
    if (await attempts.get(`${id}:${questionId}`)) return session.assistance;
    if (completed && !session.assistance.playbackRequests) throw new Error('NO_AUDIO');
    const assistance = { ...session.assistance,
      playbackRequests: (session.assistance.playbackRequests ?? 0) + (completed ? 0 : 1),
      audioCompleted: session.assistance.audioCompleted || completed,
    };
    await sessions.update(id, { assistance });
    return assistance;
  });
}

export async function recordDictionaryUse(id: string, owner: string, questionId: string) {
  return db.transaction('rw', sessions, settings, attempts, async () => {
    const session = await owned(id, owner);
    if (session.lesson.mode) throw new Error('CHECK_RESTRICTED');
    if (questions(session.lesson)[session.position].question.id !== questionId) throw new Error('CONFLICT');
    if (await attempts.get(`${id}:${questionId}`)) return session.assistance;
    const assistance = { ...session.assistance, dictionaryUsed: true };
    await sessions.update(id, { assistance });
    return assistance;
  });
}


function exposureSyncEvent(session: Session, item: ReturnType<typeof questions>[number]): Extract<NewEvent, { type: 'exposure' }> {
  return { type: 'exposure', payload: {
    sessionId: session.syncSessionId ?? session.id, rootId: item.material.rootId, materialId: item.material.id, questionId: item.question.id,
    variantGroup: 'variantGroup' in item.question && item.question.variantGroup ? item.question.variantGroup : item.question.id,
  } };
}

async function captureExposure(profileId: string, event: Extract<NewEvent, { type: 'exposure' }>, occurredAt: string) {
  const bounded = await Dexie.waitFor(boundedReferences(event));
  // shortcut: profile-event scan; add a contact-key index if large archives slow saves.
  const existing = await readSyncEvents(profileId);
  if (existing.some(prior => prior.type === 'exposure' && canonicalJson(prior.payload) === canonicalJson(bounded.payload))) return;
  await appendSyncEvent(profileId, bounded, db, { occurredAt });
}

function taskSyncEvents(session: Session, saved: Attempt, item: ReturnType<typeof questions>[number]): NewEvent[] {
  const id = session.id;
  return [
    { type: 'completion', payload: {
      recordId: saved.syncRecordId ?? saved.id, sessionId: session.syncSessionId ?? id, questionId: saved.questionId, rootId: saved.rootId,
      goalId: session.lesson.goalId, skill: session.lesson.skill, level: session.lesson.targetLevel,
      mode: session.lesson.mode === 'check' ? 'check' : 'practice', contentHash: session.contentHash,
      ...(session.ruleHashes ? { scoringHash: session.ruleHashes.scoring } : {}), correct: saved.correct,
      assistance: { hintLevel: saved.assistance.hintLevel, dictionaryUsed: !!saved.assistance.dictionaryUsed,
        audioCompleted: !!saved.assistance.audioCompleted, playbackRequests: saved.assistance.playbackRequests ?? 0,
        ...(saved.assistance.teachingProvided ? { teachingProvided: true } : {}) },
    } },
    exposureSyncEvent(session, item),
  ];
}

export async function submit(id: string, owner: string, answer: Answer) {
  return db.transaction('rw', sessions, settings, attempts, syncEvents, syncClocks, async () => {
    const session = await owned(id, owner);
    if (session.lesson.organization) throw new Error('CONFLICT');
    if (session.status === 'ended' || (session.lesson.mode === 'check' && !session.checkStartedAt)) throw new Error('CHECK_RESTRICTED');
    const all = questions(session.lesson);
    const { material, question } = all[session.position];
    if (session.lesson.skill === 'listening' && !session.assistance.audioCompleted) throw new Error('NO_AUDIO');
    const result = score(question, answer);
    const attemptId = `${id}:${question.id}`;
    const existing = await attempts.get(attemptId);
    if (existing) {
      if (JSON.stringify(existing.answer) !== JSON.stringify(answer)) throw new Error('CONFLICT');
      return existing;
    }
    const attempt: Attempt = {
      id: attemptId, ...(session.syncSessionId ? { syncRecordId: `${session.syncSessionId}:${question.id}` } : {}), sessionId: id, profileId: session.profileId, questionId: question.id,
      rootId: material.rootId, answer, ...result, assistance: { ...session.assistance, ...(teachingSupport(session.lesson, material.rootId, session.assistance.teachingProvided) ? { teachingProvided: true } : {}) }, submittedAt: new Date().toISOString(),
    };
    await attempts.add(attempt);
    await sessions.update(id, { draft: answer, status: session.position === all.length - 1 ? 'completed' : 'active' });
    if (session.position === all.length - 1) {
      for (const item of all) {
        const saved = await attempts.get(`${id}:${item.question.id}`);
        if (!saved) throw new Error('UNSAVED');
        for (const event of taskSyncEvents(session, saved, item)) {
          if (event.type === 'exposure') await captureExposure(session.profileId, event, saved.submittedAt);
          else await appendSyncEvent(session.profileId, event, db, { occurredAt: saved.submittedAt });
        }
      }
    }
    return attempt;
  });
}

export async function advance(id: string, owner: string) {
  return db.transaction('rw', sessions, settings, attempts, async () => {
    const session = await owned(id, owner);
    if (session.lesson.organization) throw new Error('CONFLICT');
    if (session.status === 'ended' || (session.lesson.mode === 'check' && !session.checkStartedAt)) throw new Error('CHECK_RESTRICTED');
    const all = questions(session.lesson);
    if (!await attempts.get(`${id}:${all[session.position].question.id}`)) throw new Error('UNSAVED');
    if (session.position < all.length - 1) {
      const sameAudio = session.lesson.skill === 'listening' && all[session.position].material.id === all[session.position + 1].material.id && session.assistance.audioCompleted;
      const sameMaterial = all[session.position].material.id === all[session.position + 1].material.id;
      const taught = teachingSupport(session.lesson, all[session.position].material.rootId, session.assistance.teachingProvided);
      session.position += 1; session.draft = undefined; session.assistance = { hintLevel: 0, ...(sameMaterial && taught ? { teachingProvided: true } : {}), ...(sameAudio ? { audioCompleted: true, playbackRequests: 0 } : {}) };
      await sessions.put(session);
    }
    return session;
  });
}

export async function saveSelfAssessment(id: string, owner: string, questionId: string, value: unknown) {
  return db.transaction('rw', sessions, settings, attempts, async () => {
    const session = await owned(id, owner);
    if (session.lesson.mode) throw new Error('CONFLICT');
    const selected = questions(session.lesson).find(item => item.question.id === questionId)?.question;
    if (!selected) throw new Error('CONFLICT');
    const selfAssessment = validateSelfAssessment(selected, value);
    const attempt = await attempts.get(`${id}:${questionId}`);
    if (!attempt || attempt.profileId !== session.profileId || attempt.correct !== null) throw new Error('UNSAVED');
    await attempts.update(attempt.id, { selfAssessment });
    return { ...attempt, selfAssessment };
  });
}

export async function savePreferences(profileId: string, value: unknown, locale: string) {
  const preferences = preferencesSchema.parse(value);
  const language = localeSchema.safeParse(locale);
  if (!language.success) throw new Error('INVALID_LOCALE');
  await db.transaction('rw', profiles, settings, syncEvents, syncClocks, async () => {
    if (!await profiles.get(profileId)) throw new Error('NOT_FOUND');
    await profiles.update(profileId, { preferences });
    await settings.put({ key: `profile:${profileId}:locale`, value: locale });
    await appendSyncEvent(profileId, { type: 'preferences', payload: preferences });
    await appendSyncEvent(profileId, { type: 'setting', payload: { key: 'locale', value: language.data } });
  });
  return preferences;
}

export async function saveSetting(profileId: string, key: string, value: string) {
  const payload = syncSettingSchema.parse({ key, value });
  await db.transaction('rw', profiles, settings, syncEvents, syncClocks, async () => {
    if (!await profiles.get(profileId)) throw new Error('NOT_FOUND');
    await settings.put({ key: `profile:${profileId}:${key}`, value });
    await appendSyncEvent(profileId, { type: 'setting', payload });
  });
}

// Apply received preferences without emitting events or switching the active profile.
export async function projectPreferences(profileId: string) {
  return db.transaction('rw', profiles, settings, syncEvents, async () => {
    const profile = await profiles.get(profileId);
    if (!profile) throw new Error('NOT_FOUND');
    const merged = projectSyncEvents(await readSyncEvents(profileId));
    const preferences = merged.preferences?.payload ?? profile.preferences;
    if (merged.preferences && canonicalJson(preferences) !== canonicalJson(profile.preferences ? preferencesSchema.parse(profile.preferences) : null)) await profiles.update(profileId, { preferences });
    const values = new Map<string, string>();
    const rows = await settings.toArray();
    const stored = new Map(rows.map(row => [row.key, row.value]));
    const prefix = `profile:${profileId}:`;
    for (const row of rows) if (row.key.startsWith(prefix)) {
      const key = row.key.slice(prefix.length);
      if (syncSettingSchema.safeParse({ key, value: row.value }).success) values.set(key, row.value);
    }
    for (const { payload } of merged.settings.values()) {
      values.set(payload.key, payload.value);
      const key = `profile:${profileId}:${payload.key}`;
      if (stored.get(key) !== payload.value) await settings.put({ key, value: payload.value });
    }
    return { preferences, values };
  });
}

// Capture originals once before remote projection or backup cloning.
export async function bootstrapSyncEvents(profileId: string) {
  return db.transaction('rw', [profiles, sessions, attempts, exposures, memories, memoryReviews, settings, syncEvents, syncClocks], async () => {
    const marker = `profile:${profileId}:syncBootstrap`;
    if (await settings.get(marker)) return;
    const profile = await profiles.get(profileId);
    const events = await readSyncEvents(profileId);
    const merged = projectSyncEvents(events);
    const existingIds = new Map(events.map(event => [event.id, event]));
    const completionKeys = new Set(merged.completions.map(event => canonicalJson([event.payload, event.occurredAt])));
    const exposureKeys = new Set(merged.exposures.map(event => canonicalJson(event.payload)));
    async function queue(value: NewEvent, occurredAt?: string, id?: string) {
      const event = await Dexie.waitFor(boundedReferences(value));
      if (event.type === 'completion') {
        const key = canonicalJson([event.payload, occurredAt]);
        if (merged.deletedRecords.has(event.payload.recordId) || completionKeys.has(key)) return;
        completionKeys.add(key);
      } else if (event.type === 'exposure') {
        const key = canonicalJson(event.payload);
        if (merged.deletedExposures.has(event.payload.rootId) || merged.deletedContacts.has(exposureContactKey(event.payload)) || exposureKeys.has(key)) return;
        exposureKeys.add(key);
      } else if (event.type === 'saved_item' && merged.savedItems.has(event.payload.memoryId)) return;
      if (id && existingIds.has(id)) {
        const prior = existingIds.get(id)!;
        if (prior.type !== event.type || canonicalJson(prior.payload) !== canonicalJson(event.payload) || prior.occurredAt !== occurredAt) throw new Error('SYNC_EVENT_CONFLICT');
        return;
      }
      await appendSyncEvent(profileId, event, db, { id, occurredAt });
    }
    // shortcut: one profile transaction; paginate capture if large archives become slow.
    const localSessions = await sessions.where('profileId').equals(profileId).toArray();
    const sessionById = new Map(localSessions.map(session => [session.id, session]));
    const answers = new Map((await attempts.where('profileId').equals(profileId).toArray()).map(attempt => [attempt.id, attempt]));
    for (const exposure of await exposures.where('profileId').equals(profileId).toArray()) {
      for (const contact of exposure.contacts ?? []) {
        const session = sessionById.get(contact.sessionId);
        if (!session || (session.lesson.mode === 'check' && !session.checkStartedAt)) continue;
        const item = questions(session.lesson).find(item => item.material.rootId === exposure.rootId && item.material.id === contact.materialId && item.question.id === contact.questionId);
        if (!item) continue;
        await queue({ type: 'exposure', payload: { sessionId: session.syncSessionId ?? session.id, rootId: exposure.rootId, materialId: contact.materialId, questionId: contact.questionId, variantGroup: contact.variantGroup } }, contact.firstSeenAt);
      }
    }
    for (const session of localSessions) {
      if (session.status !== 'completed') continue;
      const all = questions(lessonSchema.parse(session.lesson));
      if (!all.every(item => {
        const attempt = answers.get(`${session.id}:${item.question.id}`);
        return attempt?.sessionId === session.id && attempt.rootId === item.material.rootId;
      })) continue;
      for (const item of all) {
        const attempt = answers.get(`${session.id}:${item.question.id}`)!;
        for (const event of taskSyncEvents(session, attempt, item)) await queue(event, attempt.submittedAt);
      }
    }
    for (const memory of await memories.where('profileId').equals(profileId).toArray()) {
      const saved: NewEvent = await Dexie.waitFor(boundedReferences({ type: 'saved_item', payload: { memoryId: memory.memoryId, saved: true, reviewEnabled: memory.reviewEnabled } }));
      if (saved.type !== 'saved_item') throw new Error('SYNC_EVENT_CONFLICT');
      await queue(saved, memory.savedAt);
      const current = merged.savedItems.get(saved.payload.memoryId);
      if (!memory.reviewEnabled || (current && (!current.payload.saved || !current.payload.reviewEnabled))) continue;
      const originals = await memoryReviews.where('[profileId+memoryId]').equals([profileId, memory.memoryId]).toArray();
      originals.sort((a, b) => a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
      for (const review of originals) await queue({ type: 'memory_review', payload: { memoryId: review.memoryId, rating: review.rating, configId: review.configId, assistance: review.assistance } }, review.occurredAt, review.id);
    }
    if (profile?.preferences && !merged.preferences) await queue({ type: 'preferences', payload: preferencesSchema.parse(profile.preferences) });
    const values = new Map<string, string>();
    const rows = await settings.toArray();
    const prefix = `profile:${profileId}:`;
    for (const row of rows) if (row.key.startsWith(prefix)) values.set(row.key.slice(prefix.length), row.value);
    for (const [key, value] of values) {
      const parsed = syncSettingSchema.safeParse({ key, value });
      if (parsed.success && !merged.settings.has(key)) await queue({ type: 'setting', payload: parsed.data });
    }
    await settings.put({ key: marker, value: '1' });
  });
}


export async function saveWorkspaceDraft(id: string, owner: string, questionId: string, answer: Answer) {
  return db.transaction('rw', sessions, settings, async () => {
    const session = await owned(id, owner);
    if (session.status !== 'active' || session.lesson.mode === 'check' && !session.checkStartedAt) throw new Error('CONFLICT');
    const item = questions(session.lesson).find(item => item.question.id === questionId);
    if (!item) throw new Error('INVALID_ANSWER');
    validateAnswer(item.question, answer, true);
    const workspace = session.workspace ?? { drafts: {}, assistance: {} };
    workspace.drafts[questionId] = answer;
    await sessions.update(id, { workspace });
  });
}

export async function selectWorkspaceQuestion(id: string, owner: string, questionId: string) {
  return db.transaction('rw', sessions, settings, async () => {
    const session = await owned(id, owner), all = questions(session.lesson);
    if (session.lesson.mode === 'check' && !session.checkStartedAt) throw new Error('CHECK_RESTRICTED');
    const target = all.find(item => item.question.id === questionId);
    if (!target) throw new Error('INVALID_ANSWER');
    const previous = all[session.position].material;
    const workspace = session.workspace ?? { drafts: {}, assistance: {} };
    workspace.assistance[previous.id] = session.assistance; workspace.selected = questionId;
    if (previous.id !== target.material.id) {
      session.position = all.findIndex(item => item.material.id === target.material.id);
      session.assistance = workspace.assistance[target.material.id] ?? { hintLevel: 0, ...(!session.lesson.mode && target.material.id === session.lesson.materials[0].id ? { teachingProvided: true } : {}) };
    }
    session.workspace = workspace;
    await sessions.put(session);
    return session;
  });
}

export async function submitWorkspace(id: string, owner: string) {
  return db.transaction('rw', sessions, settings, attempts, syncEvents, syncClocks, async () => {
    const session = await owned(id, owner);
    if (session.status === 'ended' || session.lesson.mode === 'check' && !session.checkStartedAt) throw new Error('CHECK_RESTRICTED');
    const all = questions(session.lesson), current = all[session.position].material;
    const workspace = validateWorkspace(session.lesson, session.workspace ?? { drafts: {}, assistance: {} });
    workspace.assistance[current.id] = session.assistance;
    const saved: Attempt[] = [];
    for (const item of all) {
      const recordId = `${id}:${item.question.id}`, existing = await attempts.get(recordId);
      const answer = workspace.drafts[item.question.id] ?? existing?.answer ?? (all[session.position].question.id === item.question.id ? session.draft : undefined);
      if (answer === undefined) throw new Error('UNSAVED');
      const result = score(item.question, answer), assistance = workspace.assistance[item.material.id] ?? { hintLevel: 0 };
      workspace.drafts[item.question.id] = answer;
      if (existing) {
        if (JSON.stringify(existing.answer) !== JSON.stringify(answer)) throw new Error('CONFLICT');
        saved.push(existing); continue;
      }
      if (session.lesson.skill === 'listening' && !assistance.audioCompleted) throw new Error('NO_AUDIO');
      const attempt: Attempt = { id: recordId, ...(session.syncSessionId ? { syncRecordId: `${session.syncSessionId}:${item.question.id}` } : {}), sessionId: id, profileId: session.profileId,
        questionId: item.question.id, rootId: item.material.rootId, answer, ...result, assistance, submittedAt: new Date().toISOString() };
      await attempts.add(attempt); saved.push(attempt);
    }
    if (session.status !== 'completed') for (const [index, item] of all.entries()) for (const event of taskSyncEvents(session, saved[index], item)) {
      if (event.type === 'exposure') await captureExposure(session.profileId, event, saved[index].submittedAt);
      else await appendSyncEvent(session.profileId, event, db, { occurredAt: saved[index].submittedAt });
    }
    session.status = 'completed'; session.workspace = workspace;
    if (session.lesson.mode === 'check') session.checkEndedAt ??= new Date().toISOString();
    await sessions.put(session);
    return { session, attempts: saved };
  });
}
