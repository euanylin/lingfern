import { contentLanguage, contentText, messages } from '../locales';
import { useState } from 'react';
import { saveSelfAssessment, type Attempt } from '../data/db';
import type { Locale, Question, SelfAssessment as Ratings } from '../shared/content';

const labels = messages('selfAssessment');

export function SelfAssessment({ locale, question, attempt, owner, onSaved }: { locale: Locale; question: Extract<Question, { kind: 'response' }>; attempt: Attempt; owner: string; onSaved: (attempt: Attempt) => void }) {
  const t = labels[locale];
  const [ratings, setRatings] = useState<(Ratings[number] | '')[]>(attempt.selfAssessment ?? question.criteria.map(() => ''));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function save() {
    setBusy(true); setMessage('');
    try { onSaved(await saveSelfAssessment(attempt.sessionId, owner, attempt.questionId, ratings)); setMessage(t.saved); }
    catch { setMessage(t.failed); }
    finally { setBusy(false); }
  }
  return <section className="self-assessment" lang={locale}><h3>{t.title}</h3>
    {question.criteria.map((criterion, index) => <fieldset key={index} disabled={busy}><legend lang={contentLanguage(criterion, locale)}>{contentText(criterion, locale)}</legend>{(['met', 'revise', 'unsure'] as const).map(value => <label key={value}><input type="radio" name={`${attempt.id}-criterion-${index}`} value={value} checked={ratings[index] === value} onChange={() => { setRatings(previous => previous.map((item, i) => i === index ? value : item)); setMessage(''); }}/>{t[value]}</label>)}</fieldset>)}
    <button type="button" disabled={busy || ratings.some(value => !value)} onClick={() => void save()}>{t.save}</button><p role="status">{message}</p>
  </section>;
}
