import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
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

export type LearningHandle = { release: () => Promise<void>; confirmLeave: () => boolean };

export default function Learning({ ref, owner, id, profileId, locale, online, onlineDictionary, combinedSessions }: { ref?: Ref<LearningHandle>; owner: string; id: string; profileId: string; locale: Locale; online: boolean; onlineDictionary: OnlineDictionaryId; combinedSessions: Session[] }) {
  const t = copy[locale], [session, setSession] = useState<Session>(), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const mounted = useRef(true), loading = useRef(false), lockRelease = useRef<(() => void) | undefined>(undefined), claimPending = useRef<Promise<Session> | undefined>(undefined);
  const pending = useRef(Promise.resolve()), confirmLeave = useRef(() => true);
  const releasing = useRef<Promise<void> | undefined>(undefined);
  function release() {
    mounted.current = false;
    // Navigation and unmount share one release after every queued write and claim.
    return releasing.current ??= Promise.allSettled([claimPending.current, pending.current]).then(() => {
      lockRelease.current?.(); lockRelease.current = undefined;
      return releaseSession(id, owner);
    });
  }
  useImperativeHandle(ref, () => ({ release, confirmLeave: () => confirmLeave.current() }));
  async function load() {
    if (loading.current) return;
    loading.current = true;
    setError('');
    try {
      const saved = await sessions.get(id);
      if (!saved || saved.profileId !== profileId) throw new Error('NOT_FOUND');
      if (!mounted.current) return;
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
      if (mounted.current) setSession(current);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : 'READ';
      lockRelease.current?.(); lockRelease.current = undefined;
      if (reason === 'CHECK_DEVICE') {
        const saved = await sessions.get(id).catch(() => undefined);
        if (mounted.current && saved?.profileId === profileId && saved.lesson.mode === 'check') setSession(saved);
      }
      if (mounted.current) setError(reason);
    } finally { loading.current = false; }
  }
  useEffect(() => {
    mounted.current = true; releasing.current = undefined; void load();
    const heartbeat = setInterval(() => {
      if (!mounted.current || loading.current || claimPending.current || navigator.locks && !lockRelease.current) return;
      const claim = claimSession(id, owner, Date.now(), profileId);
      claimPending.current = claim;
      void claim.catch(cause => { if (mounted.current) { if (cause instanceof Error && cause.message === 'CHECK_DEVICE') void load(); else setError('BUSY'); } }).finally(() => { if (claimPending.current === claim) claimPending.current = undefined; });
    }, 5000);
    return () => {
      mounted.current = false; clearInterval(heartbeat);
      void release().catch(() => {});
    };
  }, [id]);
  const message = error === 'CHECK_EXPOSED' ? t.checkUnavailable : error === 'CHECK_DEVICE' ? t.checkOriginalDevice : error === 'BUSY' ? t.busy : error === 'NOT_FOUND' ? t.missing : error === 'CONFLICT' ? t.conflict : error === 'READ' ? t.readError : t.saveError;
  if (!session) return <section><h1>{t.learning}</h1>{error ? <div className="error" role="alert"><p>{message}</p><button onClick={() => void load()}>{t.retry}</button></div> : <p>{t.loading}</p>}</section>;
  const instructionLocale = practiceLocale(session.lesson, locale), title = <h1 lang={contentLanguage(session.lesson.title, instructionLocale)}>{contentText(session.lesson.title, instructionLocale)}</h1>;
  if (session.recordsDeleted) return <>{title}<p>{deletionCopy[locale].archived}</p><a className="button" href="/progress">{t.progress}</a></>;
  if (error) return <section>{title}<p role="alert">{message}</p><div className="action-row"><button onClick={() => void load()}>{t.retry}</button><a className="button back-button" href="/today" aria-label={t.finish}>←</a></div></section>;
  if (session.lesson.mode === 'check' && session.status === 'active' && !session.checkStartedAt) return <section className="narrow check-intro">
    {title}<p lang={contentLanguage(session.lesson.goal, instructionLocale)}>{contentText(session.lesson.goal, instructionLocale)}</p><p>{t.checkUnseen}</p>
    <dl><div><dt>{t.checkExpectedDuration}</dt><dd>{session.lesson.expectedMinutes} {t.checkMinutes}</dd></div><div><dt>{t.dictionary}</dt><dd>{t.checkDictionaryRule}</dd></div><div><dt>{t.checkAudioLabel}</dt><dd>{session.lesson.skill === 'listening' ? t.checkAudioRule : t.checkNoAudio}</dd></div></dl>
    <button className="primary" disabled={busy} onClick={async () => { setBusy(true); try { setSession(await beginCheck(id, owner)); } catch (cause) { setError(cause instanceof Error ? cause.message : 'READ'); } finally { setBusy(false); } }}>{t.checkBegin}</button>
  </section>;
  return <MaterialWorkspace session={session} owner={owner} locale={locale} profileId={profileId} online={online} onlineDictionary={onlineDictionary} onSession={setSession} combinedSessions={combinedSessions} pending={pending} confirmLeave={confirmLeave}/>;
}
