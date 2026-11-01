import { contentText, messages } from '../locales';
import { useState } from 'react';
import type { Lesson, Locale } from '../shared/content';
import type { ResolvedSummary, CompletionSummary } from '../data/progress';
import { deleteLearningRecord } from '../data/deletion';
import { progressCopy } from './i18n';
import { DeleteHistory } from './DeleteHistory';
import { DisclosurePanel } from './DisclosurePanel';

const summaryCopy = messages('progressRecords_summaryCopy');
type Props = { locale: Locale; summaries: ResolvedSummary[]; unavailable: CompletionSummary[]; conflicts: number; profileId: string; onChange: () => Promise<void> };

export function ProgressRecords({ summaries, unavailable, conflicts, ...props }: Props) {
  const rows: { event: CompletionSummary; lesson?: Lesson }[] = [...summaries, ...unavailable.map(event => ({ event }))];
  rows.sort((a, b) => b.event.occurredAt.localeCompare(a.event.occurredAt) || a.event.payload.recordId.localeCompare(b.event.payload.recordId));
  if (!rows.length && !conflicts) return null;
  return <section className="synced-summary-list" aria-label={summaryCopy[props.locale].summaries}>
    {conflicts > 0 && <p role="status">{summaryCopy[props.locale].conflict} ({conflicts})</p>}
    <div className="history-grid">{rows.map(row => <SummaryEntry key={row.event.payload.recordId} {...row} {...props}/>)}</div>
  </section>;
}

function SummaryEntry({ event, lesson, locale, profileId, onChange }: Pick<Props, 'locale' | 'profileId' | 'onChange'> & { event: CompletionSummary; lesson?: Lesson }) {
  const [open, setOpen] = useState(false), t = progressCopy[locale], labels = summaryCopy[locale], value = event.payload;
  const title = lesson ? contentText(lesson.title, locale) : value.rootId;
  const result = value.correct === null ? t.unscored : !value.correct ? t.incorrect : value.assistance.hintLevel || value.assistance.dictionaryUsed || value.assistance.teachingProvided ? t.assisted : value.mode === 'check' ? t.checkCorrect : labels.correct;
  return <article className="history"><div className="history-entry-heading">
    <div className="history-entry-link history-summary-label" title={title}><span lang={lesson && title === lesson.title.en ? 'en' : undefined}>{title}</span><time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}</time></div>
    <button type="button" className="history-records-toggle" aria-label={`${t.details}: ${title}`} aria-expanded={open} aria-controls={`summary-${value.recordId}`} onClick={() => setOpen(value => !value)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg></button><DeleteHistory locale={locale} title={title} onDelete={() => deleteLearningRecord(profileId, value.recordId, false)} onChange={onChange}/>
  </div><DisclosurePanel className="history-records-panel" id={`summary-${value.recordId}`} open={open}>{() => <div className="history-entry-records">
    <p>{t[value.skill]} · {result}</p><p className="muted">{labels.only}</p>
    {!lesson && <><p>{labels.missing}</p><p className="muted">{labels.content}: <code>{value.contentHash}</code></p></>}
  </div>}</DisclosurePanel></article>;
}
