import { useMemo, useState } from 'react';
import { contentText, instructionLanguage, translateInstruction } from '../locales';
import { answerText, explanationText, practiceLocale, questions, teachingSupport, type Locale } from '../shared/content';
import type { Attempt, Session } from '../data/db';
import { isGutenbergSource } from '../shared/sourceLicence';
import { copy } from './i18n';
import { DeleteRecord } from './DeleteRecord';
import { GutenbergLicence } from './GutenbergLicence';

const noAnswers: Attempt[] = [];

type Props = { history: Session[]; records: Attempt[]; locale: Locale; profileId: string; onChange: () => Promise<void> };

export function SessionHistory({ history, records, ...props }: Props) {
  const bySession = useMemo(() => {
    const grouped = new Map<string, Attempt[]>();
    for (const record of records) {
      const rows = grouped.get(record.sessionId);
      if (rows) rows.push(record); else grouped.set(record.sessionId, [record]);
    }
    return grouped;
  }, [records]);
  return <div className="history-grid">{history.map(session => <HistoryEntry key={session.id} session={session} records={bySession.get(session.id) ?? noAnswers} {...props}/>)}</div>;
}

function HistoryEntry({ session: s, records, locale, profileId, onChange }: Omit<Props, 'history'> & { session: Session }) {
  const t = copy[locale], [open, setOpen] = useState(false);
  const items = open ? questions(s.lesson) : [];
  return <article className="history"><a href={`/learn/${s.id}`}><span lang={contentText(s.lesson.title, locale) === s.lesson.title.en ? 'en' : undefined}>{contentText(s.lesson.title, locale)}</span> · {s.status === 'active' ? t.resume : t.review}</a><time>{new Date(s.startedAt).toLocaleString(locale)}</time>
    <details onToggle={event => setOpen(event.currentTarget.open)}><summary>{t.count}: {records.length}</summary>{open && <>
      {(s.lesson.mode === 'check' || s.lesson.mode === 'test') && s.status === 'active' ? <p>{t.checkResponseSaved}</p> : records.map(r => {
        const item = items.find(item => item.question.id === r.questionId);
        return item && <section key={r.id}>{s.status !== 'active' && <DeleteRecord locale={locale} profileId={profileId} recordId={r.syncRecordId ?? r.id} onChange={onChange}/>}<h3 lang="en">{item.question.prompt}</h3><p>{t.yourAnswer}: <span lang="en">{answerText(item.question, r.answer)}</span> · <span className="result-status" data-result={r.correct === null ? undefined : r.correct ? 'correct' : 'incorrect'}>{r.correct === null ? t.unscored : r.correct ? `✓ ${t.correct}` : `× ${t.incorrect}`}</span></p><p lang={instructionLanguage(explanationText(item.question, r.answer, practiceLocale(s.lesson, locale)), practiceLocale(s.lesson, locale))}>{translateInstruction(explanationText(item.question, r.answer, practiceLocale(s.lesson, locale)), practiceLocale(s.lesson, locale))}</p><p>{t.conditions}: {r.assistance.hintLevel}/3{teachingSupport(s.lesson, r.rootId, r.assistance.teachingProvided) ? ` · ${t.teachingProvided}` : ''}{r.assistance.dictionaryUsed ? ` · ${t.dictionaryUsed}` : ''}</p>{s.lesson.skill === 'listening' && <p>{t.playbackRequests}: {r.assistance.playbackRequests ?? 0}</p>}<time>{new Date(r.submittedAt).toLocaleString(locale)}</time></section>;
      })}
      <GutenbergLicence sourceUrl={s.lesson.materials.find(material => isGutenbergSource(material.credit?.sourceUrl))?.credit?.sourceUrl} locale={locale}/>
    </>}</details>
  </article>;
}
