import { teachingSupport, lessonSchema, questions, type Lesson } from '../shared/content';
import type { Attempt, Session } from './db';
import { completionTiming } from './completionTiming';
import { canonicalJson, projectSyncEvents, type SyncEvent } from '../shared/sync';

export type CompletionSummary = Extract<SyncEvent, { type: 'completion' }>;
export type ResolvedSummary = { event: CompletionSummary; lesson: Lesson };


export type ProgressEntry = { attempt: Pick<Attempt, 'id' | 'sessionId' | 'questionId' | 'rootId' | 'correct' | 'assistance' | 'submittedAt'>; session: Pick<Session, 'id' | 'status' | 'lesson'>; localSessionId?: string; materialTitle: string; mark: '●' | '◐' | '○' | '×' | '◇' };
export type ProgressGoal = { key: string; lesson: Lesson; entries: ProgressEntry[] };

// Display answer coverage without implying correctness or ability.
export function fernActivity(entries: ProgressEntry[]) {
  const sessions = new Map<string, { lesson: Lesson; items: Set<string>; answered: Set<string> }>();
  for (const { session, attempt } of entries) {
    let activity = sessions.get(session.id);
    if (!activity) {
      activity = { lesson: session.lesson, items: new Set(questions(session.lesson).map(item => JSON.stringify([item.material.rootId, item.question.id]))), answered: new Set() };
      sessions.set(session.id, activity);
    }
    const item = JSON.stringify([attempt.rootId, attempt.questionId]);
    if (activity.items.has(item)) activity.answered.add(item);
  }
  const result = { reading: 0, listening: 0, tests: 0 };
  // Sum deterministically so sync/recovery order cannot change the graphic.
  for (const [, { lesson, items, answered }] of [...sessions].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    if (!items.size) continue;
    const completedTest = answered.size === items.size && (lesson.mode === 'test' || lesson.mode === 'check');
    result[lesson.skill] += completedTest ? 3 : answered.size / items.size;
    if (completedTest) result.tests++;
  }
  return result;
}

const goalKey = (lesson: Lesson) => `${lesson.skill}:${lesson.targetLevel}:${lesson.goalId}`;

export function progressRecords(lessons: Lesson[], sessions: Session[], attempts: Attempt[], summaries: ResolvedSummary[] = []) {
  const sessionById = new Map(sessions.map(session => [session.id, session]));
  const goals = new Map<string, ProgressGoal>();
  for (const lesson of [...lessons, ...sessions.map(session => session.lesson)]) {
    const key = goalKey(lesson);
    if (!goals.has(key)) goals.set(key, { key, lesson, entries: [] });
  }
  const valid: ProgressEntry[] = [];
  const seenIds = new Set<string>();
  for (const attempt of attempts) {
    if (seenIds.has(attempt.id)) continue;
    seenIds.add(attempt.id);
    const session = sessionById.get(attempt.sessionId);
    if (!session || attempt.profileId !== session.profileId) continue;
    const item = questions(session.lesson).find(item => item.question.id === attempt.questionId && item.material.rootId === attempt.rootId);
    if (!item) continue;
    const assisted = attempt.assistance.hintLevel > 0 || !!attempt.assistance.dictionaryUsed || teachingSupport(session.lesson, attempt.rootId, attempt.assistance.teachingProvided);
    const mark = 'criteria' in item.question || attempt.correct === null ? '◇' : !attempt.correct ? '×' : assisted ? '○' : session.lesson.mode === 'check' ? '●' : '◐';
    valid.push({ attempt: { ...attempt, id: attempt.syncRecordId ?? attempt.id }, session: { ...session, id: session.syncSessionId ?? session.id }, localSessionId: session.id, materialTitle: item.material.title, mark });
  }
  const localIds = new Set(valid.map(entry => entry.attempt.id));
  for (const { event, lesson } of summaries) {
    const value = event.payload;
    if (localIds.has(value.recordId)) continue;
    const item = questions(lesson).find(item => item.question.id === value.questionId && item.material.rootId === value.rootId);
    if (!item) continue;
    const assisted = value.assistance.hintLevel > 0 || value.assistance.dictionaryUsed || teachingSupport(lesson, value.rootId, value.assistance.teachingProvided);
    const mark = 'criteria' in item.question || value.correct === null ? '◇' : !value.correct ? '×' : assisted ? '○' : value.mode === 'check' ? '●' : '◐';
    const key = goalKey(lesson);
    if (!goals.has(key)) goals.set(key, { key, lesson, entries: [] });
    valid.push({ attempt: { id: value.recordId, sessionId: value.sessionId, questionId: value.questionId, rootId: value.rootId, correct: value.correct, assistance: value.assistance, submittedAt: event.occurredAt }, session: { id: value.sessionId, status: 'completed', lesson }, materialTitle: item.material.title, mark });
  }
  valid.sort((a, b) => a.attempt.submittedAt.localeCompare(b.attempt.submittedAt) || a.attempt.id.localeCompare(b.attempt.id));
  const first = new Set<string>();
  for (const entry of valid) {
    const key = `${goalKey(entry.session.lesson)}:${entry.attempt.rootId}:${entry.attempt.questionId}`;
    if (first.has(key)) continue;
    first.add(key);
    goals.get(goalKey(entry.session.lesson))?.entries.push(entry);
  }
  return { goals: [...goals.values()], valid };
}


// Resolve exact lesson snapshots without inventing original answers.
export async function mergeLearningRecords(lessons: Lesson[], sessions: Session[], attempts: Attempt[], events: SyncEvent[]) {
  const merged = projectSyncEvents(events);
  const timing = await completionTiming(events);
  const byRecord = new Map<string, CompletionSummary>();
  const conflicting = new Set<string>();
  for (const event of merged.completions) {
    const prior = byRecord.get(event.payload.recordId);
    if (prior && (canonicalJson(prior.payload) !== canonicalJson(event.payload) || prior.occurredAt !== event.occurredAt)) conflicting.add(event.payload.recordId);
    byRecord.set(event.payload.recordId, event);
  }
  const effectiveByRecord = new Map([...timing.recordTimes].filter(([id]) => !conflicting.has(id)));
  const records: Attempt[] = [];
  const localIds = new Set<string>();
  for (const record of attempts) {
    const id = record.syncRecordId ?? record.id;
    if (merged.deletedRecords.has(id) || timing.invalidRecords.has(id) || localIds.has(id)) continue;
    localIds.add(id); records.push(effectiveByRecord.get(id) ? { ...record, submittedAt: effectiveByRecord.get(id)! } : record);
  }
  const remote = [...byRecord.values()].filter(event => !localIds.has(event.payload.recordId) && !conflicting.has(event.payload.recordId) && !timing.invalidRecords.has(event.payload.recordId)).map(event => timing.recordTimes.has(event.payload.recordId) ? { ...event, occurredAt: timing.recordTimes.get(event.payload.recordId)! } : event);
  const byHash = new Map(sessions.map(session => [session.contentHash, session.lesson]));
  for (const raw of lessons) {
    const lesson = lessonSchema.parse(raw);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(lesson)));
    byHash.set(Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''), lesson);
  }
  const summaries: ResolvedSummary[] = [], unavailable: CompletionSummary[] = [];
  for (const event of remote) {
    const value = event.payload, lesson = byHash.get(value.contentHash);
    if (!lesson || lesson.skill !== value.skill || lesson.targetLevel !== value.level || lesson.goalId !== value.goalId || (lesson.mode ?? 'practice') !== value.mode || !questions(lesson).some(item => item.material.rootId === value.rootId && item.question.id === value.questionId)) unavailable.push(event);
    else summaries.push({ event, lesson });
  }
  return { records, summaries, unavailable, timingRows: timing.rows, deletedExposures: merged.deletedExposures, exposedRoots: new Set(merged.exposures.map(event => event.payload.rootId)), conflicting };
}
