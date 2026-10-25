import { useTaskDialog } from './useTaskDialog';
import { contentLanguage, contentText, messages } from '../locales';
import { GutenbergLicence } from './GutenbergLicence';
import { materialPackageId, practiceLocale } from '../shared/content';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Lesson, Locale } from '../shared/content';
import { communityPacks, type CommunityPackageRecord } from '../data/db';
import { communityCacheName } from '../data/communityInstall';

const labels = messages('taskDetail');
export function TaskDetail({ lesson, locale, profileId, action, busy, onStart, onCheck, onClose, startError, available, practiceReason, additionalLesson, heading }: { additionalLesson?: Lesson; heading?: string; practiceReason?: 'reteach' | 'retry' | 'review'; available: boolean; startError: string; lesson: Lesson; locale: Locale; profileId: string; action: string; busy: boolean; onStart: (lesson: Lesson) => Promise<void>; onCheck?: (lesson: Lesson) => Promise<void>; onClose: () => void }) {
  const { open, close, dialogProps, bodyProps } = useTaskDialog(lesson.id, onClose), t = labels[locale];
  const [source, setSource] = useState<{ title: string; author: string; license: string }>();
  const [mediaLoaded, setMediaLoaded] = useState(() => ![lesson, ...(additionalLesson ? [additionalLesson] : [])].some(preview => preview.materials.some(material => material.audio?.src || material.illustration?.src)));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    const owners = new Map<string, Promise<CommunityPackageRecord | undefined>>();
    const readOwner = (hash: string) => {
      const pending = owners.get(hash) ?? communityPacks.get([profileId, hash]);
      owners.set(hash, pending);
      return pending;
    };
    void (async () => {
      const builtin = !lesson.communityPackageId && !lesson.generation ? (await import('../../content/sources.json')).default.find(item => item.id === lesson.sourceId) : undefined;
      const pack = lesson.communityPackageId ? await readOwner(lesson.communityPackageId) : undefined;
      const record = pack?.sources.find(item => `community:${pack.hash}:${item.id}` === lesson.sourceId) ?? (pack?.spoken && (lesson.generation?.generator === 'corpus-v1' || lesson.generation?.generator === 'corpus-check-v1') ? { title: lesson.materials.map(material => material.title).join(' · '), author: [...new Set(lesson.materials.map(material => material.audio!.author))].join('; '), license: [...new Set(lesson.materials.map(material => material.credit!.license))].join('; ') } : undefined);
      if (lesson.communityPackageId && !record) throw new Error('MISSING_SOURCE');
      controller.signal.throwIfAborted();
      await Promise.all([lesson, ...(additionalLesson ? [additionalLesson] : [])].flatMap(preview => preview.materials.flatMap(material => [material.audio?.src, material.illustration?.src].filter((path): path is string => !!path).map(async path => {
        const hash = materialPackageId(preview, material);
        if (!hash) {
          const response = await fetch(path, { signal: controller.signal });
          if (!response.ok) { await response.body?.cancel().catch(() => {}); throw new Error('MISSING_MEDIA'); }
          await response.blob(); return;
        }
        const owner = await readOwner(hash);
        controller.signal.throwIfAborted();
        const name = communityCacheName(hash);
        if (!owner || owner.state !== 'ready' || !await caches.has(name)) throw new Error('MISSING_MEDIA');
        const response = await (await caches.open(name)).match(path);
        if (!response) throw new Error('MISSING_MEDIA');
        await response.blob();
      }))));
      if (!disposed) { setSource(record ?? builtin); setMediaLoaded(true); }
    })().catch(() => { controller.abort(); if (!disposed) setFailed(true); });
    return () => { disposed = true; controller.abort(); };
  // Keep one immutable lesson snapshot per keyed dialog opening.
  }, [lesson, additionalLesson, profileId]);
  const contentLocale = practiceLocale(lesson, locale);
  const mediaReady = !failed && mediaLoaded;
  const recordings = lesson.materials.flatMap(material => material.audio ? [material.audio] : []);
  return createPortal(<dialog {...dialogProps} className="task-detail" aria-labelledby="task-detail-title">
    <div className="task-detail-body" {...bodyProps}><header><p className="eyebrow">{lesson.skill.toUpperCase()}</p><button type="button" onClick={close}>{t.close}</button></header>
      <h2 id="task-detail-title" lang={!heading && contentText(lesson.title, locale) === lesson.title.en ? 'en' : undefined}>{heading ?? contentText(lesson.title, locale)}</h2>{heading && <h3 lang={contentText(lesson.title, locale) === lesson.title.en ? 'en' : undefined}>{contentText(lesson.title, locale)}</h3>}<p lang={contentLanguage(lesson.goal, contentLocale)}>{contentText(lesson.goal, contentLocale)}</p>{practiceReason && lesson.generation?.generator === 'corpus-v1' && lesson.generation.focus && <p className="muted">{t[practiceReason]}{lesson.generation.focus && <>: {t.kinds[lesson.generation.focus]}</>}</p>}
      <dl><dt>{t.types}</dt><dd>{[...new Set(lesson.materials.flatMap(material => material.questions.map(question => t.kinds['gaps' in question ? 'completion' : 'kind' in question ? question.kind : 'choice'])))].join(' / ')}</dd>
        {recordings.length > 0 && <><dt>{t.audio}</dt><dd>{[...new Set(recordings.map(audio => audio.synthetic ? t.synthetic : t.human))].join(' / ')} · {Math.round(recordings.reduce((sum, audio) => sum + audio.duration, 0))} {t.seconds}{lesson.mode === 'check' && <p>{t.check}</p>}</dd></>}
      </dl>
      {additionalLesson && <section><p className="eyebrow">{additionalLesson.skill.toUpperCase()}</p><h3 lang={contentText(additionalLesson.title, locale) === additionalLesson.title.en ? 'en' : undefined}>{contentText(additionalLesson.title, locale)}</h3>{additionalLesson.materials.some(material => material.audio) && <dl><dt>{t.audio}</dt><dd>{[...new Set(additionalLesson.materials.flatMap(material => material.audio ? [material.audio.synthetic ? t.synthetic : t.human] : []))].join(' / ')} · {Math.round(additionalLesson.materials.reduce((sum, material) => sum + (material.audio?.duration ?? 0), 0))} {t.seconds}</dd></dl>}</section>}
      {failed && <p className="error" role="status">{t.unknown}</p>}
      {startError && <p className="error" role="alert">{startError}</p>}
      <div className={`task-detail-actions${onCheck && !lesson.mode ? ' practice-actions' : ''}`}>
        {available ? <button type="button" className="primary" data-mode="practice" disabled={busy || !open || !mediaReady} onClick={() => void onStart(lesson)}>{onCheck && !lesson.mode ? (messages('taskDetail_practice')[locale]) : action}</button> : <a className="button primary" href="/library">{action}</a>}
        {onCheck && !lesson.mode && <button type="button" className="primary" data-mode="test" disabled={!available || busy || !open || !mediaReady} onClick={() => void onCheck(lesson)}>{(messages('taskDetail_test')[locale])}</button>}
      </div>
      <dl className="task-detail-credits"><dt>{t.source}</dt><dd>{(lesson.generation?.generator === 'corpus-v1' || lesson.generation?.generator === 'corpus-check-v1') ? [...lesson.materials, ...(additionalLesson?.materials ?? [])].map(material => <div key={material.id} lang="en"><p>{material.title}</p><p>{material.credit?.attribution}</p><p>{material.credit?.license}</p><GutenbergLicence sourceUrl={material.credit?.sourceUrl} locale={locale}/>{!lesson.mode && material.credit && <a href={material.credit.sourceUrl} target="_blank" rel="noopener noreferrer">{lesson.goalId === 'heard-word-recognition' ? t.source : material.credit.sourceUrl}</a>}</div>) : source ? <><p lang="en">{source.title}</p><p lang="en">{source.author}</p><p lang="en">{source.license}</p></> : lesson.communityPackageId ? '…' : lesson.sourceId}</dd></dl>
    </div>
  </dialog>, document.body);
}
