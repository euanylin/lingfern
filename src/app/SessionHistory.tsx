import { useMemo, useState } from 'react';
import { contentText, messages, instructionLanguage, translateInstruction } from '../locales';
import { answerText, explanationText, practiceLocale, questions, teachingSupport, type Locale } from '../shared/content';
import type { Attempt, Session } from '../data/db';
import { isGutenbergSource } from '../shared/sourceLicence';
import { questionSlots } from '../shared/practiceQuantity';
import { copy } from './i18n';
import { DeleteRecord } from './DeleteRecord';
import { GutenbergLicence } from './GutenbergLicence';
import { DeleteHistory } from './DeleteHistory';
import { DisclosurePanel } from './DisclosurePanel';
import { deleteLearningSession } from '../data/deletion';

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
  const items = useMemo(() => questions(s.lesson), [s.lesson]);
  const title = contentText(s.lesson.title, locale), started = new Date(s.startedAt);
  const time = started.toDateString() === new Date().toDateString()
    ? `${messages('practiceCard_today')[locale]} ${started.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`
    : started.toLocaleString(locale, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const count = records.reduce((sum, record) => { const item = items.find(item => item.question.id === record.questionId); return sum + (item ? questionSlots(item.question) : 0); }, 0);
  return <article className="history"><div className="history-entry-heading"><a className="history-entry-link" href={`/learn/${s.id}`} title={title}><span lang={title === s.lesson.title.en ? 'en' : undefined}>{title}</span><time dateTime={s.startedAt}>{time}</time></a><button className="history-records-toggle" type="button" title={`${t.count}: ${count}`} aria-label={`${t.count}: ${count}`} aria-expanded={open} aria-controls={`history-records-${s.id}`} onClick={() => setOpen(value => !value)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg></button><DeleteHistory locale={locale} title={s.lesson.title.en} linked={!!(s.practiceGroupId || s.checkGroupId)} onDelete={() => deleteLearningSession(profileId, s.id)} onChange={onChange}/></div>
    <DisclosurePanel className="history-records-panel" id={`history-records-${s.id}`} open={open}>{() => <div className="history-entry-records">
      {(s.lesson.mode === 'check' || s.lesson.mode === 'test') && s.status === 'active' ? <p>{t.checkResponseSaved}</p> : records.map(r => {
        const item = items.find(item => item.question.id === r.questionId);
        return item && <section key={r.id}>{s.status !== 'active' && <DeleteRecord locale={locale} profileId={profileId} recordId={r.syncRecordId ?? r.id} onChange={onChange}/>}<h3 lang="en">{item.question.prompt}</h3><p>{t.yourAnswer}: <span lang="en">{answerText(item.question, r.answer)}</span> · <span className="result-status" data-result={r.correct === null ? undefined : r.correct ? 'correct' : 'incorrect'}>{r.correct === null ? t.unscored : r.correct ? `✓ ${t.correct}` : `× ${t.incorrect}`}</span></p><p lang={instructionLanguage(explanationText(item.question, r.answer, practiceLocale(s.lesson, locale)), practiceLocale(s.lesson, locale))}>{translateInstruction(explanationText(item.question, r.answer, practiceLocale(s.lesson, locale)), practiceLocale(s.lesson, locale))}</p><p>{t.conditions}: {r.assistance.hintLevel}/3{teachingSupport(s.lesson, r.rootId, r.assistance.teachingProvided) ? ` · ${t.teachingProvided}` : ''}{r.assistance.dictionaryUsed ? ` · ${t.dictionaryUsed}` : ''}</p>{s.lesson.skill === 'listening' && <p>{t.playbackRequests}: {r.assistance.playbackRequests ?? 0}</p>}<time>{new Date(r.submittedAt).toLocaleString(locale)}</time></section>;
      })}
      {items.filter(item => s.workspace?.skipped?.includes(item.question.id)).map(item => <section key={item.question.id}><h3 lang="en">{item.question.prompt}</h3><p>{messages('workspace')[locale].skipped}</p></section>)}
      <GutenbergLicence sourceUrl={s.lesson.materials.find(material => isGutenbergSource(material.credit?.sourceUrl))?.credit?.sourceUrl} locale={locale}/>
    </div>}</DisclosurePanel>
  </article>;
}
