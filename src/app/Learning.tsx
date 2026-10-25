import { useEffect, useRef, useState } from 'react';
import { beginCheck, claimSession, markExposure, releaseSession, sessions, type Session } from '../data/db';
import { contentLanguage, contentText } from '../locales';
import { practiceLocale, type Locale } from '../shared/content';
import { deletionCopy } from './DeleteRecord';
import { copy } from './i18n';
import type { OnlineDictionaryId } from './onlineDictionaries';

import MaterialWorkspace from './MaterialWorkspace';

function acquireSessionLock(id: string): Promise<(() => void) | undefined> {
  if (!navigator.locks) return Promise.resolve(undefined);
  return new Promise((resolve, reject) => {
    void navigator.locks.request(`lingfern-session:${id}`, { ifAvailable: true }, lock => {
      if (!lock) throw new Error('BUSY');
      return new Promise<void>(release => resolve(release));
    }).catch(reject);
  });
}

export default function Learning({ owner, id, profileId, locale, online, onlineDictionary, combinedSessions }: { owner: string; id: string; profileId: string; locale: Locale; online: boolean; onlineDictionary: OnlineDictionaryId; combinedSessions: Session[] }) {
  const t = copy[locale], [session, setSession] = useState<Session>(), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const mounted = useRef(true), lockRelease = useRef<(() => void) | undefined>(undefined), claimPending = useRef<Promise<Session> | undefined>(undefined);
  async function load() {
    setError('');
    try {
      if (navigator.locks && !lockRelease.current) {
        const release = await acquireSessionLock(id);
        if (!mounted.current) { release?.(); return; }
        lockRelease.current = release;
      }
      const claim = claimSession(id, owner, Date.now(), profileId, !!lockRelease.current);
      claimPending.current = claim;
      const current = await claim.finally(() => { if (claimPending.current === claim) claimPending.current = undefined; });
      if (!mounted.current) return;
      if ((current.lesson.skill === 'reading' || current.assistance.audioCompleted) && (current.lesson.mode !== 'check' || current.checkStartedAt) && current.status === 'active') await markExposure(current);
      setSession(current);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : 'READ';
      if (reason === 'CHECK_DEVICE') {
        lockRelease.current?.(); lockRelease.current = undefined;
        const saved = await sessions.get(id).catch(() => undefined);
        if (mounted.current && saved?.profileId === profileId && saved.lesson.mode === 'check') setSession(saved);
      }
      if (mounted.current) setError(reason);
    }
  }
  useEffect(() => {
    mounted.current = true; void load();
    const heartbeat = setInterval(() => {
      if (navigator.locks && !lockRelease.current) return;
      void claimSession(id, owner).catch(cause => { if (cause instanceof Error && cause.message === 'CHECK_DEVICE') void load(); else setError('BUSY'); });
    }, 5000);
    return () => {
      mounted.current = false; clearInterval(heartbeat);
      void Promise.resolve(claimPending.current).catch(() => {}).then(() => {
        lockRelease.current?.(); lockRelease.current = undefined;
        return releaseSession(id, owner);
      }).catch(() => {});
    };
  }, [id]);
  const message = error === 'CHECK_EXPOSED' ? t.checkUnavailable : error === 'CHECK_DEVICE' ? t.checkOriginalDevice : error === 'BUSY' ? t.busy : error === 'NOT_FOUND' ? t.missing : error === 'CONFLICT' ? t.conflict : error === 'READ' ? t.readError : t.saveError;
  if (!session) return <section><h1>{t.learning}</h1>{error ? <div className="error" role="alert"><p>{message}</p><button onClick={() => void load()}>{t.retry}</button></div> : <p>{t.loading}</p>}</section>;
  const instructionLocale = practiceLocale(session.lesson, locale), title = <h1 lang={contentLanguage(session.lesson.title, instructionLocale)}>{contentText(session.lesson.title, instructionLocale)}</h1>;
  if (session.recordsDeleted) return <>{title}<p>{deletionCopy[locale].archived}</p><a className="button" href="/progress">{t.progress}</a></>;
  if (error) return <section>{title}<p role="alert">{message}</p><div className="action-row"><button onClick={() => void load()}>{t.retry}</button><a className="button" href="/today">{t.finish}</a></div></section>;
  if (session.lesson.mode === 'check' && session.status === 'active' && !session.checkStartedAt) return <section className="narrow check-intro">
    {title}<p lang={contentLanguage(session.lesson.goal, instructionLocale)}>{contentText(session.lesson.goal, instructionLocale)}</p><p>{t.checkUnseen}</p>
    <dl><div><dt>{t.checkExpectedDuration}</dt><dd>{session.lesson.expectedMinutes} {t.checkMinutes}</dd></div><div><dt>{t.dictionary}</dt><dd>{t.checkDictionaryRule}</dd></div><div><dt>{t.checkAudioLabel}</dt><dd>{session.lesson.skill === 'listening' ? t.checkAudioRule : t.checkNoAudio}</dd></div></dl>
    <button className="primary" disabled={busy} onClick={async () => { setBusy(true); try { setSession(await beginCheck(id, owner)); } catch (cause) { setError(cause instanceof Error ? cause.message : 'READ'); } finally { setBusy(false); } }}>{t.checkBegin}</button>
  </section>;
  return <MaterialWorkspace session={session} owner={owner} locale={locale} profileId={profileId} online={online} onlineDictionary={onlineDictionary} onSession={setSession} combinedSessions={combinedSessions}/>;
}
