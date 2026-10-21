import { questionSlots } from '../shared/practiceQuantity';
import { contentText, messages } from '../locales';
import { DeleteRecord } from './DeleteRecord';
import { useState } from 'react';
import { practiceLocale, type Lesson, type Locale } from '../shared/content';
import type { Attempt, Session } from '../data/db';
import { progressRecords, type ProgressGoal, type ResolvedSummary, type CompletionSummary } from '../data/progress';
import { goalReviews } from '../data/goalReview';
import { progressCopy } from './i18n';

const summaryCopy = messages('progressRecords_summaryCopy');

export function ProgressRecords({ locale, lessons, history, records, summaries = [], unavailable = [], conflicts = 0, profileId, onChange }: { locale: Locale; lessons: Lesson[]; history: Session[]; records: Attempt[]; summaries?: ResolvedSummary[]; unavailable?: CompletionSummary[]; conflicts?: number; profileId?: string; onChange?: () => Promise<void> }) {
  const t = progressCopy[locale];
  const { goals, valid } = progressRecords(lessons, history, records, summaries);
  const reviews = goalReviews(lessons, history, records, new Date(), summaries);
  const [skill, setSkill] = useState<Lesson['skill']>(() => valid.some(entry => entry.session.lesson.skill === 'reading') ? 'reading' : 'listening');
  const [opened, setOpened] = useState<string | null>(null);
  if (!valid.length && !unavailable.length && !conflicts) return null;
  const selected = goals.filter(goal => goal.lesson.skill === skill);
  const active = selected.find(goal => goal.key === opened);
  const activeReview = active && reviews.get(active.key);
  const markLabel = { '◇': t.unscored, '●': t.checkCorrect, '◐': t.independent, '○': t.assisted, '×': t.incorrect };
  const cell = (goal: ProgressGoal) => {
    const latest = [...goal.entries].reverse().slice(0, 5);
    if (!latest.length) return <span className="muted">{t.noRecord}</span>;
    return <button className="progress-cell" type="button" aria-label={`${t.details}: ${contentText(goal.lesson.goal, practiceLocale(goal.lesson, locale))}`} aria-expanded={opened === goal.key} aria-controls={opened === goal.key ? 'progress-record-detail' : undefined} onClick={() => setOpened(current => current === goal.key ? null : goal.key)}>
      {latest.map(entry => <span role="img" aria-label={markLabel[entry.mark]} key={entry.attempt.id}>{entry.mark}</span>)}
      {goal.entries.length > 5 && <small>{t.more.replace('{count}', String(goal.entries.length - 5))}</small>}
    </button>;
  };
  return <section className="progress-records" aria-labelledby="progress-records-title">
    {conflicts > 0 && <p role="status">{summaryCopy[locale].conflict} ({conflicts})</p>}
    {unavailable.length > 0 && <section className="synced-summary-list"><h3>{summaryCopy[locale].summaries}</h3><p className="muted">{summaryCopy[locale].only}</p><ol>{unavailable.map(event => <li key={event.payload.recordId}><p>{t[event.payload.skill]} · {event.payload.rootId} · {event.payload.correct === null ? t.unscored : event.payload.correct ? (event.payload.assistance.hintLevel || event.payload.assistance.dictionaryUsed || event.payload.assistance.teachingProvided ? t.assisted : event.payload.mode === 'check' ? t.checkCorrect : summaryCopy[locale].correct) : t.incorrect}</p><time>{new Date(event.occurredAt).toLocaleString(locale)}</time><p>{summaryCopy[locale].missing}</p><p className="muted">{summaryCopy[locale].content}: <code>{event.payload.contentHash}</code></p>{profileId && onChange && <DeleteRecord locale={locale} profileId={profileId} recordId={event.payload.recordId} onChange={onChange}/>}</li>)}</ol></section>}
    <h2 id="progress-records-title">{t.overview}</h2>
    <div className="progress-skill-summary">{(['reading', 'listening'] as const).map(item => {
      const entries = valid.filter(entry => entry.session.lesson.skill === item);
      const completed = entries.filter(entry => entry.session.status === 'completed').at(-1);
      return <section key={item}><h3>{t[item]}</h3><dl><div><dt>{t.materials}</dt><dd>{new Set(entries.map(entry => entry.attempt.rootId)).size}</dd></div><div><dt>{t.valid}</dt><dd>{entries.reduce((sum, entry) => sum + questionSlots(entry.session.lesson.materials.flatMap(material => material.questions).find(question => question.id === entry.attempt.questionId)!), 0)}</dd></div><div><dt>{t.checks}</dt><dd>{entries.filter(entry => entry.mark === '●').length}</dd></div><div><dt>{t.last}</dt><dd>{completed ? new Date(completed.attempt.submittedAt).toLocaleDateString(locale) : t.none}</dd></div></dl></section>;
    })}</div>
    <h2>{t.matrix}</h2><p className="muted">{t.legend}</p>
    <div className="progress-skill-tabs" role="group" aria-label={t.matrix}>{(['reading', 'listening'] as const).map(item => <button key={item} type="button" aria-pressed={skill === item} onClick={() => { setSkill(item); setOpened(null); }}>{t[item]}</button>)}</div>
    <div className="progress-source-list">{selected.map(goal => <section key={goal.key}><h3 lang={practiceLocale(goal.lesson, locale)}>{contentText(goal.lesson.goal, practiceLocale(goal.lesson, locale))}</h3>{cell(goal)}</section>)}</div>
    {active && <section className="progress-record-detail" id="progress-record-detail"><h3 lang={practiceLocale(active.lesson, locale)}>{contentText(active.lesson.goal, practiceLocale(active.lesson, locale))}</h3>{active.entries.some(entry => !entry.localSessionId) && <p className="muted">{summaryCopy[locale].only}</p>}{activeReview?.clockAnomaly && <p role="status">{summaryCopy[locale].clock}</p>}{activeReview && <p className="muted">{t.reviewStatus}: {activeReview.state === 'independent' ? t.independentState : activeReview.state === 'new' && activeReview.nextSuggestedAt ? t.unscored : t[activeReview.state]} · {t.independentMaterials}: {activeReview.independentMaterials}{activeReview.nextSuggestedAt && <> · {t.nextSuggested}: <time>{new Date(activeReview.nextSuggestedAt).toLocaleDateString(locale)}</time></>}{activeReview.recentlyConsistent && <> · {t.recentlyConsistent}</>}</p>}<ol>{[...active.entries].reverse().slice(0, 5).map(entry => <li key={entry.attempt.id}><span>{entry.materialTitle} · {markLabel[entry.mark]}</span><time>{new Date(entry.attempt.submittedAt).toLocaleString(locale)}</time><span>{entry.localSessionId ? <a href={`/learn/${entry.localSessionId}`}>{t.open}</a> : summaryCopy[locale].summaries}</span>{profileId && onChange && !entry.localSessionId && <DeleteRecord locale={locale} profileId={profileId} recordId={entry.attempt.id} onChange={onChange}/>}</li>)}</ol></section>}
  </section>;
}
