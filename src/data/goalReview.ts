import type { Lesson } from '../shared/content';
import type { Attempt, Session } from './db';
import { progressRecords, type ResolvedSummary } from './progress';

type Result = 'independent' | 'assisted' | 'incorrect';
type Performance = { rootId: string; at: string; result: Result; supportLevel: number; dictionaryUsed: boolean };
export type GoalReview = {
  state: 'new' | 'with_help' | 'independent' | 'review_due';
  practicedMaterials: number;
  independentMaterials: number;
  lastPracticedAt?: string;
  lastSupportLevel?: number;
  lastUsedDictionary?: boolean;
  nextSuggestedAt?: string;
  lastResult?: Result;
  recent: Performance[];
  recentlyConsistent: boolean;
  clockAnomaly?: boolean;
};

const intervals = [1, 3, 7, 14, 30];
const day = 86_400_000;

export function goalReviews(lessons: Lesson[], sessions: Session[], attempts: Attempt[], now = new Date(), summaries: ResolvedSummary[] = []): Map<string, GoalReview> {
  const { goals, valid } = progressRecords(lessons, sessions, attempts, summaries);
  const grouped = new Map<string, typeof valid>();
  const clockAnomalies = new Set<string>();
  const practice = new Map<string, { roots: Set<string>; at: string; support: number; dictionaryUsed: boolean }>();
  for (const entry of valid) {
    const lesson = entry.session.lesson;
    const goalKey = `${lesson.skill}:${lesson.targetLevel}:${lesson.goalId}`;
    if (Date.parse(entry.attempt.submittedAt) > now.getTime() + 5 * 60_000) { clockAnomalies.add(goalKey); continue; }
    const previous = practice.get(goalKey) ?? { roots: new Set<string>(), at: '', support: 0, dictionaryUsed: false };
    previous.roots.add(entry.attempt.rootId);
    if (entry.attempt.submittedAt >= previous.at) { previous.at = entry.attempt.submittedAt; previous.support = entry.attempt.assistance.hintLevel; previous.dictionaryUsed = !!entry.attempt.assistance.dictionaryUsed; }
    practice.set(goalKey, previous);
    const key = `${goalKey}:${entry.session.id}:${entry.attempt.rootId}`;
    const group = grouped.get(key) ?? [];
    group.push(entry);
    grouped.set(key, group);
  }
  const events = new Map<string, Performance[]>();
  const unscoredRecurrences = new Map<string, string>();
  for (const group of grouped.values()) {
    const { session, attempt } = group[0];
    if (session.lesson.mode === 'check' && session.status !== 'completed') continue;
    const material = session.lesson.materials.find(item => item.rootId === attempt.rootId);
    if (!material) continue;
    const first = new Map<string, (typeof group)[number]>();
    for (const entry of group) if (!first.has(entry.attempt.questionId)) first.set(entry.attempt.questionId, entry);
    if (material.questions.some(question => !first.has(question.id))) continue;
    const responses = [...first.values()];
    if (responses.some(entry => entry.mark === '◇')) {
      // Schedule recurrence from mixed practice without treating self-assessment as independent success.
      if (session.status === 'completed' && responses.some(entry => entry.mark !== '◇')) {
        const key = `${session.lesson.skill}:${session.lesson.targetLevel}:${session.lesson.goalId}`;
        const at = responses.at(-1)!.attempt.submittedAt;
        if (Number.isFinite(Date.parse(at)) && at > (unscoredRecurrences.get(key) ?? '')) unscoredRecurrences.set(key, at);
      }
      continue;
    }
    const result: Result = responses.some(entry => !entry.attempt.correct) ? 'incorrect'
      : responses.some(entry => entry.mark === '○') ? 'assisted' : 'independent';
    const at = responses.at(-1)!.attempt.submittedAt;
    if (!Number.isFinite(Date.parse(at))) continue;
    const key = `${session.lesson.skill}:${session.lesson.targetLevel}:${session.lesson.goalId}`;
    events.set(key, [...(events.get(key) ?? []), { rootId: attempt.rootId, at, result, supportLevel: Math.max(...responses.map(entry => entry.attempt.assistance.hintLevel)), dictionaryUsed: responses.some(entry => !!entry.attempt.assistance.dictionaryUsed) }]);
  }
  const reviews = new Map<string, GoalReview>();
  for (const goal of goals) {
    const timeline = (events.get(goal.key) ?? []).sort((a, b) => a.at.localeCompare(b.at) || a.rootId.localeCompare(b.rootId));
    const independentRoots = new Set<string>();
    const streakRoots = new Set<string>();
    const countedDays = new Set<string>();
    let nextSuggestedAt: string | undefined;
    let lastResult: Result | undefined;
    const lastPracticedAt = practice.get(goal.key)?.at || undefined;
    let interval = 1;
    for (const event of timeline) {
      if (event.result === 'independent') {
        const rootDay = `${event.rootId}:${event.at.slice(0, 10)}`;
        if (countedDays.has(rootDay)) continue;
        countedDays.add(rootDay);
        independentRoots.add(event.rootId);
        if (!streakRoots.has(event.rootId)) {
          streakRoots.add(event.rootId);
          interval = intervals[Math.min(streakRoots.size - 1, intervals.length - 1)];
        }
      } else {
        streakRoots.clear();
        interval = 1;
      }
      lastResult = event.result;
      nextSuggestedAt = new Date(Date.parse(event.at) + interval * day).toISOString();
    }
    const unscoredAt = unscoredRecurrences.get(goal.key);
    if (unscoredAt && (!timeline.length || unscoredAt > timeline.at(-1)!.at)) {
      nextSuggestedAt = new Date(Date.parse(unscoredAt) + day).toISOString();
      lastResult = undefined;
    }
    const state = !lastResult ? nextSuggestedAt && now.getTime() >= Date.parse(nextSuggestedAt) ? 'review_due' : 'new' : nextSuggestedAt && now.getTime() >= Date.parse(nextSuggestedAt) ? 'review_due' : lastResult === 'independent' ? 'independent' : 'with_help';
    reviews.set(goal.key, { clockAnomaly: clockAnomalies.has(goal.key), state, practicedMaterials: practice.get(goal.key)?.roots.size ?? 0, independentMaterials: independentRoots.size, lastPracticedAt, lastSupportLevel: practice.get(goal.key)?.support, lastUsedDictionary: practice.get(goal.key)?.dictionaryUsed, nextSuggestedAt, lastResult, recent: timeline.slice(-5), recentlyConsistent: lastResult === 'independent' && streakRoots.size >= 3 });
  }
  return reviews;
}
