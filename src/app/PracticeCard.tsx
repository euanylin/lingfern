import { messages } from '../locales';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Attempt, Session } from '../data/db';
import { questions, type Locale } from '../shared/content';

export function practiceCardProgress(sessions: readonly Session[], records: readonly Attempt[]) {
  let answered = 0, total = 0, lastActivityAt: string | undefined;
  const seen = new Set<string>();
  const latest = (at: string) => {
    if (Number.isFinite(Date.parse(at)) && (!lastActivityAt || Date.parse(at) > Date.parse(lastActivityAt))) lastActivityAt = at;
  };
  for (const session of sessions) {
    if (session.recordsDeleted || seen.has(session.id)) continue;
    seen.add(session.id);
    const roots = new Map(questions(session.lesson).map(item => [item.question.id, item.material.rootId]));
    total += roots.size;
    const saved = records.filter(record => record.sessionId === session.id && record.profileId === session.profileId && roots.get(record.questionId) === record.rootId);
    answered += new Set(saved.map(record => record.questionId)).size;
    latest(session.startedAt);
    saved.forEach(record => latest(record.submittedAt));
  }
  return { answered, total, lastActivityAt };
}

export function practiceCardDate(at: string, locale: Locale, now = new Date()) {
  const date = new Date(at);
  if (!Number.isFinite(date.getTime())) return '';
  // Use the device's calendar day across daylight-saving changes.
  const localDay = (value: Date) => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  const days = Math.round((localDay(now) - localDay(date)) / 86400000);
  if (days === 0) return messages('practiceCard_today')[locale];
  if (days === 1) return messages('practiceCard_yesterday')[locale];
  if (days > 1 && days <= 6) return new Intl.RelativeTimeFormat(locale).format(-days, 'day');
  return new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric' }).format(date);
}

export type PracticeCardProps = {
  title: string; locale: Locale; sessions?: readonly Session[]; records: readonly Attempt[];
  recommended?: boolean; busy?: boolean; onStart: () => void; onRestart?: () => Promise<void>;
  children?: ReactNode; status?: string; estimatedMinutes?: number; dataSkill?: 'reading' | 'listening' | 'combined';
};

export function PracticeCard({ title, locale, sessions = [], records, recommended = false, busy = false, onStart, onRestart, children, dataSkill }: PracticeCardProps) {
  const { answered, total } = practiceCardProgress(sessions, records);
  const t = messages('practiceCard', { p0: answered, p1: total })[locale];
  const completed = total > 0 && answered === total && sessions.length > 0 && sessions.every(session => !session.recordsDeleted && session.status === 'completed');
  const [confirming, setConfirming] = useState(false), [restarting, setRestarting] = useState(false), [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null), trigger = useRef<HTMLButtonElement>(null), action = useRef<HTMLButtonElement>(null), focusAction = useRef(false);
  const headingId = useId(), confirmId = useId();
  useEffect(() => { if (confirming) { dialog.current?.showModal(); cancel.current?.focus(); } else if (focusAction.current) { focusAction.current = false; action.current?.focus(); } }, [confirming]);
  function close() { if (restarting) return; dialog.current?.close(); setConfirming(false); setError(''); trigger.current?.focus(); }
  async function restart() {
    if (!onRestart || restarting) return;
    setRestarting(true); setError('');
    try { await onRestart(); dialog.current?.close(); focusAction.current = true; setConfirming(false); }
    catch { setError(t.failed); }
    finally { setRestarting(false); }
  }
  return <section className={`practice-card${dataSkill && dataSkill !== 'combined' ? ' corpus-practice' : ''}`} data-skill={dataSkill} data-state={completed ? 'completed' : answered > 0 ? 'active' : 'empty'} aria-labelledby={headingId}>
    <header className="practice-card-heading"><h2 id={headingId}>{title}</h2>
      {answered > 0 && !completed && onRestart && <button type="button" ref={trigger} className="practice-card-restart" aria-label={`${title} ${t.restart}`} disabled={busy || restarting} onClick={() => { setError(''); setConfirming(true); }}>{t.restart}</button>}
    </header>
    {(answered > 0 || completed) && total > 0 && <div className="practice-card-progress" role="progressbar" aria-label={t.progress} aria-valuemin={0} aria-valuemax={total} aria-valuenow={answered}><span className="practice-card-progress-fill" style={{ width: `${answered / total * 100}%` }}/></div>}
    <div className="practice-card-actions">
      <div className="practice-card-topics">{children}</div>
      <button type="button" ref={action} className={`${recommended && answered > 0 && !completed ? 'primary' : 'button'} practice-card-action`} disabled={busy || restarting} onClick={onStart}>{completed ? t.again : answered > 0 ? t.resume : t.start}</button>
    </div>
    {confirming && createPortal(<dialog ref={dialog} className="practice-restart-dialog" aria-labelledby={confirmId} onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}><h2 id={confirmId}>{t.confirm}</h2><p>{t.clear}</p>{error && <p className="error" role="alert">{error}</p>}<div className="practice-restart-actions"><button type="button" ref={cancel} disabled={restarting} onClick={close}>{t.cancel}</button><button type="button" className="primary" disabled={restarting || busy} onClick={() => void restart()}>{t.restart}</button></div></dialog>, document.body)}
  </section>;
}
