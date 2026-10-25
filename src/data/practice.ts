import type { Preferences } from '../shared/preferences';
import type { Lesson } from '../shared/content';
import type { Attempt, Session } from './db';
import { questions } from '../shared/content';
import type { ResolvedSummary } from './progress';
import { goalReviews } from './goalReview';

type PracticeReason = 'resume' | 'reteach' | 'retry' | 'review' | 'new' | 'first' | 'chosen';

export function activeCorpusPractice(history: Session[], profileId: string, skill: Lesson['skill']) {
  return history.find(session => session.profileId === profileId && session.lesson.skill === skill
    && session.lesson.generation?.generator === 'corpus-v1' && session.lesson.mode !== 'check'
    && session.status === 'active' && !session.recordsDeleted && !session.practiceGroupId);
}

export function selectPractice(
  lessons: Lesson[], history: Session[], attempts: Attempt[], skill: Lesson['skill'],
  available: (lesson: Lesson) => boolean = () => true,
  now = new Date(), preferences?: Preferences, summaries: ResolvedSummary[] = [],
): { lesson: Lesson; session?: Session; reason: PracticeReason } | undefined {
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const target = preferences?.[skill] ?? 'A2';
  const purposeTheme = { 'daily-life': 'daily-life', study: 'campus', work: undefined, travel: 'travel', pleasure: 'culture' };
  const preferred = new Set([...(preferences?.interests ?? []), ...(preferences?.purpose ? [purposeTheme[preferences.purpose]] : [])]);
  const candidates = lessons.filter(lesson => lesson.skill === skill && available(lesson));
  if (!candidates.length) return;
  if (preferences) candidates.sort((a, b) => Math.abs(levels.indexOf(a.targetLevel) - levels.indexOf(target)) - Math.abs(levels.indexOf(b.targetLevel) - levels.indexOf(target)) || Number(b.themes?.some(theme => preferred.has(theme)) ?? false) - Number(a.themes?.some(theme => preferred.has(theme)) ?? false));
  const latest = (lesson: Lesson, status: Session['status']) => history
    .filter(session => session.lesson.id === lesson.id && session.status === status)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  const active = candidates.map(lesson => ({ lesson, session: latest(lesson, 'active') }))
    .filter((item): item is { lesson: Lesson; session: Session } => !!item.session)
    .sort((a, b) => b.session.startedAt.localeCompare(a.session.startedAt))[0];
  if (active) return { ...active, reason: 'resume' };

  const summaryGroups = new Map<string, { lesson: Lesson; answered: Set<string> }>();
  for (const { event, lesson } of summaries) {
    const key = JSON.stringify([lesson.id, event.payload.sessionId, event.payload.contentHash]);
    const group = summaryGroups.get(key) ?? { lesson, answered: new Set<string>() };
    group.answered.add(JSON.stringify([event.payload.rootId, event.payload.questionId]));
    summaryGroups.set(key, group);
  }
  const completedIds = new Set([...summaryGroups.values()].filter(group => questions(group.lesson).every(item => group.answered.has(JSON.stringify([item.material.rootId, item.question.id])))).map(group => group.lesson.id));
  const completed = (lesson: Lesson) => !!latest(lesson, 'completed') || completedIds.has(lesson.id);
  const reviews = goalReviews(candidates, history, attempts, now, summaries);
  const reteach = candidates.find(lesson => {
    const recent = reviews.get(`${lesson.skill}:${lesson.targetLevel}:${lesson.goalId}`)?.recent ?? [];
    return completed(lesson) && recent.length >= 2 && recent.slice(-2).every(event => event.result === 'incorrect');
  });
  if (reteach) return { lesson: reteach, reason: 'reteach' };
  const due = candidates.map(lesson => ({ lesson, review: reviews.get(`${lesson.skill}:${lesson.targetLevel}:${lesson.goalId}`) }))
    .filter(item => completed(item.lesson) && item.review?.state === 'review_due')
    .sort((a, b) => a.review!.nextSuggestedAt!.localeCompare(b.review!.nextSuggestedAt!))[0];
  if (due) return { lesson: due.lesson, reason: due.review?.lastResult === 'independent' ? 'review' : 'retry' };

  const fresh = candidates.find(lesson => !completed(lesson));
  return fresh && { lesson: fresh, reason: preferences ? 'chosen' : history.some(session => session.lesson.skill === skill && session.status === 'completed') ? 'new' : 'first' };
}
