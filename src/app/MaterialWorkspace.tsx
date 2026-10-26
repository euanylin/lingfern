import { showModal } from './modal';
import './MaterialWorkspace.css';
import { localeDirection } from '../shared/locale';
import { useQuestionSheetLayout } from './useQuestionSheetLayout';
import { QuestionSheetResize } from './QuestionSheetResize';
import { useEffect, useRef, useState } from 'react';
import { contentText, contentLanguage, messages } from '../locales';
import { answerText, correctAnswerText, explanationText, practiceLocale, questions, scoreParts, materialPackageId, type Answer, type Locale } from '../shared/content';
import { afterListeningQuestion } from '../shared/practiceQuantity';
import { questionSlots, sameAudio, slotAnswered } from '../shared/practiceWorkspace';
import { attempts, endCheck, markExposure, recordDictionaryUse, recordPlayback, revealHint, saveWorkspaceDraft, skipWorkspaceQuestion, selectWorkspaceQuestion, sessions, submitWorkspace, type Attempt, type Session } from '../data/db';
import { ReadingMaterial, readingAnnotationCopy } from './ReadingMaterial';
import { copy } from './i18n';
import { PlaybackIcon } from './PlaybackIcon';
import QuestionInputs from './QuestionInputs';
import { SelfAssessment } from './SelfAssessment';
import { AiHandoff } from './AiHandoff';
import { installSourcePack, listeningSourcePack } from '../data/sourcePacks';
import type { OnlineDictionaryId } from './onlineDictionaries';

export default function MaterialWorkspace({ session, owner, locale, profileId, online, onlineDictionary, onSession, combinedSessions }: { session: Session; owner: string; locale: Locale; profileId: string; online: boolean; onlineDictionary: OnlineDictionaryId; onSession: (session: Session) => void; combinedSessions: Session[] }) {
  const t = copy[locale], w = messages('workspace')[locale], lesson = session.lesson, all = questions(lesson), instructionLocale = practiceLocale(lesson, locale);
  const material = all[session.position].material, listening = lesson.skill === 'listening', finished = session.status !== 'active';
  const [answers, setAnswers] = useState<Record<string, Answer>>({ ...(session.draft !== undefined ? { [all[session.position].question.id]: session.draft } : {}), ...session.workspace?.drafts });
  const [skipped, setSkipped] = useState(() => new Set(session.workspace?.skipped));
  const [selected, setSelected] = useState(session.workspace?.selected ?? all[session.position].question.id);
  const [pane, setPane] = useState<'material' | 'question'>(finished ? 'question' : 'material');
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [visibleNumber, setVisibleNumber] = useState<{ material: string; number: number }>();
  const [mobile, setMobile] = useState(() => matchMedia('(max-width:1199px)').matches);
  useEffect(() => { const query = matchMedia('(max-width:1199px)'); const resize = () => setMobile(query.matches); query.addEventListener('change', resize); return () => query.removeEventListener('change', resize); }, []);
  const sheet = useQuestionSheetLayout(`${material.id}:${locale}`, true, mobile && !listening, pane === 'question');
  const [hintLevels, setHintLevels] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<Attempt[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [saving, setSaving] = useState(false);
  const pendingVersions = useRef(new Map<string, number>());
  const pending = useRef(Promise.resolve()), unsaved = useRef(new Map<string, { questionId: string; answer?: Answer; skipped?: boolean }>()), version = useRef(0), annotationDirty = useRef(false);
  const audio = useRef<HTMLAudioElement>(null), playback = useRef<Promise<void>>(Promise.resolve()), audioStart = useRef<AbortController | undefined>(undefined), live = useRef(session);
  live.current = session;
  const [audioStarting, setAudioStarting] = useState(false), [playing, setPlaying] = useState(false), [elapsed, setElapsed] = useState(0), [duration, setDuration] = useState(0), [audioError, setAudioError] = useState(false);
  const playbackMaterial = listening ? lesson.materials.find(item => sameAudio(item, material))! : material;
  const previousMaterial = useRef(playbackMaterial.id);
  const positions = useRef(new Map<string, number>());
  const questionCard = useRef<HTMLDetailsElement>(null), questionContent = useRef<HTMLDivElement>(null), validationDialog = useRef<HTMLDialogElement>(null);
  const validationClose = useRef<HTMLButtonElement>(null), validationInvoker = useRef<HTMLElement | null>(null);
  const [jumpHidden, setJumpHidden] = useState(false);
  const selection = useRef({ version: 0, questionId: selected });
  const focusRequest = useRef<{ questionId: string; slot: number; focused?: HTMLElement } | undefined>(undefined);
  let number = 1;
  const numbered = all.map(item => { const start = number; number += questionSlots(item.question); return { ...item, start }; });
  const visible = numbered.filter(item => listening ? sameAudio(item.material, material) : item.material.id === material.id);
  const active = numbered.find(item => item.question.id === selected) ?? numbered[session.position];
  const currentNumber = active.start + Math.min(selectedSlot, questionSlots(active.question) - 1);
  const displayedNumber = !listening && visibleNumber?.material === material.id ? visibleNumber.number : currentNumber;
  const materialOrder = listening ? lesson.materials.filter((item, index) => !lesson.materials.slice(0, index).some(previous => sameAudio(previous, item))) : lesson.materials;
  const nextMaterial = materialOrder[materialOrder.indexOf(playbackMaterial) + 1];
  useEffect(() => {
    const nav = questionCard.current?.querySelector('nav');
    if (!nav) return;
    const observer = new IntersectionObserver(([entry]) => setJumpHidden(!entry.isIntersecting), { root: listening ? null : questionContent.current });
    observer.observe(nav);
    return () => observer.disconnect();
  }, [material.id, listening, mobile]);
  useEffect(() => {
    const dialog = validationDialog.current!;
    if (error === t.invalidAnswer && !dialog.open) { validationInvoker.current?.focus({ preventScroll: true }); showModal(dialog); validationClose.current?.focus(); }
    else if (error !== t.invalidAnswer && dialog.open) { dialog.close(); validationInvoker.current?.focus({ preventScroll: true }); }
  }, [error, t.invalidAnswer]);
  function openQuestionCard() {
    questionCard.current!.open = true;
    if (listening) questionCard.current!.scrollIntoView({ block: 'center' });
    else questionContent.current!.scrollTop = 0;
    questionCard.current!.querySelector('summary')!.focus({ preventScroll: true });
  }
  function followVisibleQuestion(panel: HTMLElement) {
    const bounds = panel.getBoundingClientRect();
    const selectedAnswer = document.getElementById(`answer-${selected}-${selectedSlot}`) ?? document.getElementById(`prompt-${selected}`)?.closest('.workspace-question')?.querySelectorAll<HTMLElement>('.setting')[selectedSlot];
    const selectedBounds = selectedAnswer?.getBoundingClientRect();
    // A clamped last-page jump can leave earlier slots visible above its target.
    if (document.activeElement?.id === `prompt-${selected}` && selectedBounds && selectedBounds.top >= bounds.top && selectedBounds.bottom <= bounds.bottom) { setVisibleNumber(undefined); return; }
    let fallback: number | undefined;
    for (const item of visible) {
      const heading = document.getElementById(`prompt-${item.question.id}`), section = heading?.closest('.workspace-question');
      if (!section) continue;
      const box = section.getBoundingClientRect();
      if (box.bottom <= bounds.top || box.top >= bounds.bottom) continue;
      fallback ??= item.start;
      const controls = [...section.querySelectorAll<HTMLElement>('h2,[id^="answer-"],.setting')];
      const target = controls.find(element => { const box = element.getBoundingClientRect(); return box.height > 0 && box.bottom >= bounds.top + Math.min(16, box.height / 2) && box.top < bounds.bottom - 8; });
      if (!target) continue;
      const slot = target.id.startsWith('answer-') ? Number(target.id.split('-').at(-1)) : target.matches('.setting') ? controls.filter(element => element.matches('.setting')).indexOf(target) : 0;
      const number = item.start + Math.min(Number.isFinite(slot) ? slot : 0, questionSlots(item.question) - 1);
      setVisibleNumber(current => current?.material === material.id && current.number === number ? current : { material: material.id, number });
      return;
    }
    if (fallback !== undefined) setVisibleNumber(current => current?.material === material.id && current.number === fallback ? current : { material: material.id, number: fallback });
  }
  useEffect(() => { if (finished) requestAnimationFrame(() => document.getElementById('workspace-result')?.focus()); }, [finished]);
  useEffect(() => {
    let current = true;
    void attempts.where('sessionId').equals(session.id).toArray().then(records => {
      if (!current) return;
      setSaved(records); setAnswers(previous => ({ ...Object.fromEntries(records.map(record => [record.questionId, record.answer])), ...previous }));
    }).catch(() => { if (current) setError(t.readError); });
    return () => { current = false; };
  }, [finished, session.id, t.readError]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (unsaved.current.size || annotationDirty.current) { event.preventDefault(); event.returnValue = ''; } };
    const guard = (event: MouseEvent) => { if ((unsaved.current.size || annotationDirty.current) && (event.target as HTMLElement).closest('a[href^="/"]') && !confirm(t.saveError)) { event.preventDefault(); event.stopPropagation(); } };
    addEventListener('beforeunload', warn); document.addEventListener('click', guard, true);
    return () => { removeEventListener('beforeunload', warn); document.removeEventListener('click', guard, true); };
  }, [t.saveError]);
  useEffect(() => {
    const materialChanged = previousMaterial.current !== playbackMaterial.id; previousMaterial.current = playbackMaterial.id;
    const player = audio.current;
    // Metadata may load before this effect; preserve the native duration.
    setAudioStarting(false); setPlaying(false); setElapsed(0); setDuration(player && Number.isFinite(player.duration) ? player.duration : 0); setAudioError(false);
    const frame = requestAnimationFrame(() => {
      if (materialChanged && !listening) scrollTo(0, positions.current.get(material.id) ?? 0);
    });
    return () => { cancelAnimationFrame(frame); const start = audioStart.current; audioStart.current = undefined; start?.abort(); player?.pause(); };
  }, [playbackMaterial.id]);
  useEffect(() => {
    const request = focusRequest.current;
    if (!request) return;
    let frame = 0;
    // Session updates may commit after the first navigation frame.
    const focusQuestion = () => {
      if (focusRequest.current !== request) return;
      if (request.focused && document.activeElement !== request.focused) { focusRequest.current = undefined; return; }
      const answer = document.getElementById(`answer-${request.questionId}-${request.slot}`);
      const element = document.getElementById(`prompt-${request.questionId}`);
      const anchor = request.slot > 0 ? answer?.closest<HTMLElement>('label') ?? element?.closest('.workspace-question')?.querySelectorAll<HTMLElement>('.setting')[request.slot] ?? element : element;
      if (!element) return;
      const panel = element.closest<HTMLElement>('.question-sheet-content');
      if (element.closest('[inert]') || !element.getClientRects().length || getComputedStyle(element).visibility !== 'visible') {
        if (panel?.closest<HTMLElement>('.question-panel')?.dataset.open === 'true') frame = requestAnimationFrame(focusQuestion);
        return;
      }
      if (!request.focused) { request.focused = element; element.focus({ preventScroll: true }); }
      if (listening) {
        const bar = document.querySelector<HTMLElement>('.workspace-questions .question-progress');
        const offset = bar && getComputedStyle(bar).position === 'sticky' ? parseFloat(getComputedStyle(bar).top) + bar.getBoundingClientRect().height + 16 : 16;
        scrollTo(0, scrollY + anchor!.getBoundingClientRect().top - offset);
      } else if (panel) {
        panel.scrollTop += anchor!.getBoundingClientRect().top - panel.getBoundingClientRect().top - 16;
      }
      // Keep the navigation anchor visible until the sheet finishes expanding.
      if (panel?.closest('.question-panel')?.getAnimations().some(animation => animation.playState === 'running')) frame = requestAnimationFrame(focusQuestion);
      else focusRequest.current = undefined;
    };
    frame = requestAnimationFrame(focusQuestion);
    return () => cancelAnimationFrame(frame);
  }, [session, selected, selectedSlot, pane, mobile, listening]);
  function switchPane(next: 'material' | 'question') {
    focusRequest.current = next === 'question' ? { questionId: selected, slot: selectedSlot } : undefined;
    setPane(next);
    if (next === 'material') requestAnimationFrame(() => document.querySelector<HTMLElement>('.workspace-questions .question-sheet-toggle')?.focus({ preventScroll: true }));
  }
  useEffect(() => {
    if (!mobile || listening || pane !== 'question') return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented && !validationDialog.current?.open) switchPane('material'); };
    document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close);
  }, [mobile, listening, pane]);
  async function refresh() { const current = await sessions.get(session.id); if (current) onSession(current); }
  function persist(change: { questionId: string; answer?: Answer; skipped?: boolean }) {
    const { questionId } = change, key = `${questionId}:${change.skipped === undefined ? 'answer' : 'skip'}`;
    if (change.answer !== undefined) setAnswers(previous => ({ ...previous, [questionId]: change.answer! }));
    else setSkipped(previous => { const next = new Set(previous); if (change.skipped) next.add(questionId); else next.delete(questionId); return next; });
    unsaved.current.set(key, change); setSaving(true);
    const revision = ++version.current; pendingVersions.current.set(key, revision);
    pending.current = pending.current.then(async () => {
      try {
        if (change.skipped !== undefined) await skipWorkspaceQuestion(session.id, owner, questionId, change.skipped);
        else await saveWorkspaceDraft(session.id, owner, questionId, change.answer!);
        if (pendingVersions.current.get(key) === revision) unsaved.current.delete(key);
        if (!unsaved.current.size) setError('');
      } catch { setError(t.saveError); }
      finally { if (revision === version.current) setSaving(false); }
    });
  }
  async function navigate(questionId: string, slot = 0) {
    if (busy) return;
    const target = all.find(item => item.question.id === questionId)!;
    if (target.material.id !== material.id && annotationDirty.current && !confirm(readingAnnotationCopy[locale].leave)) return;
    selection.current.questionId = questionId;
    const revision = ++selection.current.version;
    const request = { questionId, slot }; focusRequest.current = request;
    setVisibleNumber(undefined); setSelected(questionId); setSelectedSlot(slot); setPane('question');
    try {
      await pending.current;
      if (revision !== selection.current.version) return;
      const updated = await selectWorkspaceQuestion(session.id, owner, questionId);
      if (revision !== selection.current.version) return;
      if (updated.lesson.skill === 'reading' && target.material.id !== material.id) await markExposure(updated);
      if (target.material.id !== material.id && !listening) positions.current.set(material.id, scrollY);
      if (revision === selection.current.version) onSession(updated);
    } catch { if (revision !== selection.current.version) return; if (focusRequest.current === request) focusRequest.current = undefined; setError(t.saveError); }
  }
  function activateQuestion(item: (typeof all)[number], target: HTMLElement) {
    setVisibleNumber(undefined);
    if (focusRequest.current && focusRequest.current.focused !== target) { focusRequest.current = undefined; selection.current.version++; }
    if (target.id.startsWith(`answer-${item.question.id}-`)) setSelectedSlot(Number(target.id.split('-').at(-1)));
    else if ('pairs' in item.question) {
      const index = Array.from(target.closest('.workspace-question')!.querySelectorAll('.setting')).indexOf(target.closest('.setting')!);
      if (index >= 0) setSelectedSlot(index);
    } else if (questionSlots(item.question) === 1) setSelectedSlot(0);
    if (selection.current.questionId === item.question.id) return;
    selection.current.questionId = item.question.id; setSelected(item.question.id);
    const revision = ++selection.current.version;
    void selectWorkspaceQuestion(session.id, owner, item.question.id).then(updated => { if (revision === selection.current.version) onSession(updated); }).catch(() => { if (revision === selection.current.version) setError(t.saveError); });
  }
  async function lookup() { await recordDictionaryUse(session.id, owner, all[live.current.position].question.id); await refresh(); }
  async function play() {
    const player = audio.current;
    if (!player) return;
    if (audioStart.current) { audioStart.current.abort(); return; }
    if (!player.paused) { player.pause(); setPlaying(false); return; }
    const start = new AbortController(); audioStart.current = start;
    setAudioStarting(true); setAudioError(false);
    try {
      const ready = await new Promise<boolean>(resolve => {
        const timer = window.setTimeout(() => resolve(true), 1500);
        start.signal.addEventListener('abort', () => { clearTimeout(timer); resolve(false); }, { once: true });
      });
      if (!ready || audio.current !== player) return;
      await recordPlayback(session.id, owner, all[live.current.position].question.id, false);
      if (start.signal.aborted || audio.current !== player) return;
      if (audioError) player.load();
      if (player.ended || audioError) player.currentTime = 0;
      await player.play();
      if (start.signal.aborted || audio.current !== player) { player.pause(); return; }
      const exposure = markExposure(live.current); playback.current = exposure; await exposure;
      if (start.signal.aborted || audio.current !== player) { player.pause(); return; }
      setPlaying(true); await refresh();
    } catch { player.pause(); if (!start.signal.aborted) setAudioError(true); }
    finally { if (audioStart.current === start) { audioStart.current = undefined; setAudioStarting(false); } }
  }
  async function ended() {
    const player = audio.current;
    setPlaying(false);
    if (!player || !Number.isFinite(player.duration) || player.duration <= 0) return;
    const tolerance = Math.min(.15, player.duration * .01); let covered = 0;
    for (let index = 0; index < player.played.length; index++) { if (player.played.start(index) > covered + tolerance) return; covered = player.played.end(index); }
    if (covered < player.duration - tolerance) return;
    try {
      await playback.current;
      const current = questions(live.current.lesson)[live.current.position];
      if (audio.current !== player || !sameAudio(current.material, material)) return;
      await recordPlayback(session.id, owner, current.question.id, true); await refresh();
    } catch { if (audio.current === player) setError(t.saveError); }
  }
  async function submitAll(invoker: EventTarget | null = document.activeElement) {
    if (busy) return;
    validationInvoker.current = invoker instanceof HTMLElement ? invoker : null;
    setBusy(true); setError('');
    try {
      await pending.current;
      if (unsaved.current.size) throw new Error('SAVE');
      const result = await submitWorkspace(session.id, owner);
      setSaved(result.attempts); setPane('question'); onSession(result.session);
      document.getElementById('workspace-result')?.focus();
    } catch (cause) { setError(cause instanceof Error && cause.message === 'NO_AUDIO' ? t.listenFirst : cause instanceof Error && ['UNSAVED', 'INVALID_ANSWER'].includes(cause.message) ? t.invalidAnswer : t.saveError); }
    finally { setBusy(false); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ sessionId: session.id, answers, skipped: [...skipped], status: 'draft' })], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'lingfern-answer-drafts.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const repairPack = listeningSourcePack(materialPackageId(lesson, material));
  const next = (session.practiceGroupId || session.checkGroupId) && combinedSessions.find(item => (session.practiceGroupId ? item.practiceGroupId === session.practiceGroupId : item.checkGroupId === session.checkGroupId) && item.id !== session.id && item.status === 'active');
  const points = saved.flatMap(record => scoreParts(all.find(item => item.question.id === record.questionId)!.question, record.answer));
  return <section className="material-workspace" data-pane={pane} data-listening={listening}>
    {listening && <h1 className="session-title sr-only" lang={contentLanguage(lesson.title, instructionLocale)}>{contentText(lesson.title, instructionLocale)}</h1>}
    {mobile && !listening && <button className="question-sheet-scrim" type="button" aria-label={t.material} aria-hidden={pane !== 'question'} tabIndex={pane === 'question' ? 0 : -1} data-open={pane === 'question'} data-blur={sheet.blurBackground} onClick={() => switchPane('material')}/>}
    <div className={`learning-grid workspace-grid${listening ? ' listening-layout' : ''}`}>

      <article className="workspace-material">
        <p className="eyebrow" lang={instructionLocale}>{copy[instructionLocale].goal}</p><p className="lead" lang={contentLanguage(lesson.goal, instructionLocale)}>{contentText(lesson.goal, instructionLocale)}</p>
        {!lesson.mode && lesson.teaching && <details className="teaching" lang={contentLanguage(lesson.teaching, instructionLocale)}><summary>{copy[instructionLocale].teaching}</summary><p>{contentText(lesson.teaching, instructionLocale)}</p>{lesson.workedExample && <p lang={contentLanguage(lesson.workedExample, instructionLocale)}>{contentText(lesson.workedExample, instructionLocale)}</p>}</details>}
        {listening && material.audio ? <section className="material workspace-player">
          {material.illustration && <img className="material-illustration" src={material.illustration.src} alt={contentText(material.illustration.alt, locale)}/>}

          <p className="sr-only" role="status">{audioStarting ? t.audioPreparing : session.assistance.audioCompleted ? t.audioDone : t.listenFirst}</p>
          {audioError && <div className="error" role="alert"><p>{t.audioError}</p><button type="button" onClick={() => { audio.current?.load(); setAudioError(false); }}>{t.retry}</button>{repairPack && <button type="button" disabled={!online || busy} onClick={async () => { setBusy(true); try { await installSourcePack(repairPack.sha256, profileId); audio.current?.load(); setAudioError(false); } catch { setError(t.audioRepairFailed); } finally { setBusy(false); } }}>{t.audioRepair}</button>}<a href="/library">{t.material}</a></div>}
          <details className="source"><summary>{messages('taskDetail')[locale].source}</summary><h2>{material.title}</h2><p>{material.credit?.attribution ?? material.audio.author}</p><p>{material.credit?.license ?? material.audio.license}</p>{(material.credit?.sourceUrl ?? material.audio.sourceUrl).startsWith('https://') && <a href={material.credit?.sourceUrl ?? material.audio.sourceUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{material.credit?.sourceUrl ?? material.audio.sourceUrl}</a>}</details>
          {material.audio.synthetic && <p>{t.syntheticCredit}</p>}
        </section> : <ReadingMaterial key={material.id} material={material} locale={locale} label={t.material} sessionId={session.id} owner={owner} annotation={session.readingAnnotations?.find(item => item.materialId === material.id)} checking={!!lesson.mode} profileId={profileId} online={online} defaultId={onlineDictionary} onLookup={lookup} onDirty={value => { annotationDirty.current = value; }} onSaved={readingAnnotations => onSession({ ...live.current, readingAnnotations })}/>}
      </article>
      <section className="question-panel workspace-questions" aria-label={t.question} aria-busy={busy} data-open={listening || pane === 'question'}>
        {mobile && !listening && pane === 'question' && <QuestionSheetResize locale={locale} controls="workspace-sheet-content" resize={sheet.resize}/>}
        <button className="question-sheet-toggle" type="button" aria-controls="workspace-sheet-content" aria-expanded={pane === 'question'} onClick={() => switchPane('question')}><span className="question-sheet-label"><span>{t.question} <bdi dir="ltr">{currentNumber}/{number - 1}</bdi></span><span className="question-sheet-preview" lang="en" dir="ltr">{active.question.prompt}</span></span></button>
        <div className="question-progress" inert={mobile && !listening && pane !== 'question'}>{!listening && <div className="question-number">{jumpHidden && <button type="button" className="question-jump" aria-label={w.card} title={w.card} aria-controls="workspace-question-nav" onClick={openQuestionCard}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 4h4v4H3zM10 4h4v4h-4zM17 4h4v4h-4zM3 11h4v4H3zM10 11h4v4h-4zM17 11h4v4h-4zM3 18h4v3H3zM10 18h4v3h-4zM17 18h4v3h-4z"/></svg></button>}<span>{t.question} <bdi dir="ltr">{displayedNumber}/{number - 1}</bdi></span>{mobile && !listening && <button type="button" className="question-close" onClick={() => switchPane('material')}>{t.material}</button>}</div>}
      {listening && material.audio && <div className="workspace-player-bar">
          <audio key={playbackMaterial.id} ref={audio} src={material.audio.src} preload="metadata" onLoadedMetadata={() => setDuration(audio.current?.duration ?? 0)} onTimeUpdate={() => setElapsed(audio.current?.currentTime ?? 0)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => void ended()} onError={() => { setAudioError(true); setPlaying(false); }}/>
          <div className="audio-player"><button type="button" className="audio-play" aria-label={audioStarting ? t.cancelPlayback : playing ? t.pause : t.play} disabled={busy} onClick={() => void play()}><PlaybackIcon state={audioStarting ? 'stop' : playing ? 'pause' : 'play'}/></button><div className="audio-timeline" dir="ltr">{lesson.mode === 'check' ? <progress aria-label={t.playbackProgress} max={duration || material.audio.duration} value={Math.min(elapsed, duration || material.audio.duration)}/> : <input type="range" aria-label={t.playbackProgress} min={0} max={duration || material.audio.duration} step="0.1" value={Math.min(elapsed, duration || material.audio.duration)} aria-valuetext={`${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, '0')} / ${Math.floor((duration || material.audio.duration) / 60)}:${String(Math.floor((duration || material.audio.duration) % 60)).padStart(2, '0')}`} disabled={!duration || busy || audioError} style={{ backgroundImage: `linear-gradient(to right, var(--playback-fill, var(--accent)) ${elapsed / (duration || material.audio.duration) * 100}%, var(--line) 0%)` }} onChange={event => { if (audio.current) { audio.current.currentTime = Number(event.target.value); setElapsed(Number(event.target.value)); } }}/>}<div className="audio-times"><span>{Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, '0')}</span><span>{Math.floor((duration || material.audio.duration) / 60)}:{String(Math.floor((duration || material.audio.duration) % 60)).padStart(2, '0')}</span></div></div></div>
      </div>}
        </div>
        <div ref={questionContent} id="workspace-sheet-content" className="question-sheet-content" inert={mobile && !listening && pane !== 'question'} onScroll={!listening ? event => followVisibleQuestion(event.currentTarget) : undefined}>
        <details ref={questionCard} className="workspace-card" open onFocus={() => { focusRequest.current = undefined; }}><summary><span>{w.card}</span></summary><nav id="workspace-question-nav" aria-label={w.card}>{numbered.flatMap(item => Array.from({ length: questionSlots(item.question) }, (_, slot) => <button type="button" key={`${item.question.id}:${slot}`} aria-label={`${item.start + slot}. ${skipped.has(item.question.id) ? w.skipped : slotAnswered(item.question, answers[item.question.id], slot) ? w.answered : w.unanswered}`} aria-current={displayedNumber === item.start + slot ? 'step' : undefined} data-skipped={skipped.has(item.question.id)} data-answered={skipped.has(item.question.id) || slotAnswered(item.question, answers[item.question.id], slot)} onClick={() => void navigate(item.question.id, slot)}>{item.start + slot}</button>))}</nav></details>

        <p className="saved workspace-save-status sr-only" role="status">{saving ? t.saving : unsaved.current.size ? t.saveError : t.saved}</p>
        {error && error !== t.invalidAnswer && <div className="error" role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={event => { for (const change of unsaved.current.values()) persist(change); if (!unsaved.current.size) void submitAll(event.currentTarget); }}>{t.retry}</button><button type="button" onClick={download}>{t.export}</button></div>}
        <form onSubmit={event => { event.preventDefault(); if (!nextMaterial) void submitAll((event.nativeEvent as SubmitEvent).submitter ?? event.currentTarget.querySelector('button[type=submit]')); }}>
          {visible.map(item => {
            const split = 'kind' in item.question && item.question.kind === 'completion' ? item.question.prompt.indexOf('\n') : -1;
            const canSkip = 'criteria' in item.question && !finished && !saved.some(record => record.questionId === item.question.id);
            const hints = !lesson.mode && !finished ? item.question.hints : undefined;
            return <section className="workspace-question" data-selected={selected === item.question.id} key={item.question.id} onFocus={event => activateQuestion(item, event.target as HTMLElement)} onPointerDown={event => {
            const target = event.target as HTMLElement;
            if (target.closest('label,input,textarea,button,.setting')) activateQuestion(item, target);
          }} onChangeCapture={event => activateQuestion(item, event.target as HTMLElement)}>

            {listening && afterListeningQuestion(item.question) && <p lang="en" dir="ltr">After listening</p>}
            <h2 id={`prompt-${item.question.id}`} tabIndex={-1} lang="en" dir="ltr">{item.start}{questionSlots(item.question) > 1 ? `–${item.start + questionSlots(item.question) - 1}` : ''}. {split > 0 ? item.question.prompt.slice(0, split) : item.question.prompt}</h2>
            {split > 0 && <p className="question-sentence" lang="en" dir="ltr">{item.question.prompt.slice(split + 1)}</p>}
            <QuestionInputs question={item.question} answer={answers[item.question.id]} start={item.start} locale={locale} instructionLocale={instructionLocale} listening={listening} disabled={busy || finished || skipped.has(item.question.id) || saved.some(record => record.questionId === item.question.id)} onChange={answer => persist({ questionId: item.question.id, answer })}/>
            {(canSkip || hints) && <div className="workspace-question-actions">
              {canSkip && <button type="button" disabled={busy} onClick={() => persist({ questionId: item.question.id, skipped: !skipped.has(item.question.id) })}>{skipped.has(item.question.id) ? w.resumeAnswer : w.skip}</button>}
              {hints && <button className="hint" type="button" disabled={busy || (hintLevels[item.question.id] ?? 0) >= 3} onClick={async () => {
              try { await revealHint(session.id, owner); await refresh(); setHintLevels(previous => ({ ...previous, [item.question.id]: Math.min(3, (previous[item.question.id] ?? 0) + 1) })); }
              catch { setError(t.saveError); }
            }}>{w.hint}{hintLevels[item.question.id] ? ` ${hintLevels[item.question.id] ?? 0}/3` : ''}</button>}
            </div>}
            {canSkip && skipped.has(item.question.id) && <p className="workspace-skip-status muted" role="status">{w.skipped}</p>}
            {hints && <div className="workspace-hints">{hints.slice(0, hintLevels[item.question.id] ?? 0).map((hint, index) => <p className="hint-text" key={index} lang={contentLanguage(hint, instructionLocale)} dir={localeDirection(instructionLocale)}>{contentText(hint, instructionLocale)}</p>)}</div>}
          </section>; })}
          {!finished && (nextMaterial ? <button type="button" onClick={() => void navigate(nextMaterial.questions[0].id)} disabled={busy || saving}>{t.next}</button> : <button className="primary" disabled={busy || saving} type="submit">{busy ? t.saving : w.submitAll}</button>)}
        </form>
        {lesson.mode === 'check' && !finished && <button type="button" disabled={busy || saving} onClick={async () => { setBusy(true); try { await pending.current; if (unsaved.current.size) throw new Error('SAVE'); onSession(await endCheck(session.id, owner)); } catch { setError(t.saveError); } finally { setBusy(false); } }}>{t.endCheck}</button>}
        {finished && <section className="feedback"><h2 id="workspace-result" tabIndex={-1}>{session.status === 'ended' ? t.checkEnded : t.completed}</h2><p className="muted">{w.groups}: {all.length} · {w.blank}: {all.reduce((sum, item) => sum + ('gaps' in item.question ? item.question.gaps.length : 'rows' in item.question ? item.question.rows.length : 'kind' in item.question && item.question.kind === 'completion' ? 1 : 0), 0)} · {w.slots}: {number - 1}</p>{session.status === 'completed' && points.length > 0 && <p>{w.score}: {points.filter(point => point.correct === true).length}/{points.filter(point => point.correct !== null).length} · {points.filter(point => point.correct === null).length} {t.unscored}</p>}{numbered.map(item => {
          const record = saved.find(record => record.questionId === item.question.id);
          if (!record && skipped.has(item.question.id)) return <article className="workspace-review" key={item.question.id}><h3 lang="en">{item.start}. {item.question.prompt}</h3><p>{w.skipped}</p></article>;
          return record && <article className="workspace-review" key={record.id}><h3 lang="en">{item.start}. {item.question.prompt}</h3><p>{t.yourAnswer}: <span lang="en" dir="ltr">{answerText(item.question, record.answer)}</span></p>{(!('criteria' in item.question) || item.question.modelAnswer) && !('gaps' in item.question) && <p>{'criteria' in item.question ? t.possibleResponse : t.answer}: <span lang="en" dir="ltr">{correctAnswerText(item.question)}</span></p>}<ul>{scoreParts(item.question, record.answer).map((part, index) => <li key={part.id}><span className="slot-result" data-correct={part.correct ?? undefined}>{item.start + index}: {part.correct === null ? t.unscored : part.correct ? `✓ ${t.correct}` : `× ${t.incorrect}`}</span>{'gaps' in item.question && <><p>{t.yourAnswer}: <span lang="en" dir="ltr">{Array.isArray(record.answer) ? record.answer[index] : ''}</span></p><p>{t.answer}: <span lang="en" dir="ltr">{item.question.gaps[index].answer}</span></p><blockquote className="slot-evidence" lang="en" dir="ltr">{item.material.blocks.find(block => block.id === item.question.blockId)?.text.slice(item.question.gaps[index].evidence.start, item.question.gaps[index].evidence.end)}{item.material.audio && <cite>{item.question.gaps[index].evidence.audioTiming ? '≈ ' : ''}{item.question.gaps[index].evidence.audioStart}–{item.question.gaps[index].evidence.audioEnd} s</cite>}</blockquote></>}</li>)}</ul>{[{ blockId: item.question.blockId, ...item.question.evidence }, ...(item.question.additionalEvidence ?? [])].map((span, index) => <blockquote lang="en" dir="ltr" key={index}><cite className="evidence-source">{item.material.blocks.find(block => block.id === span.blockId)?.title ?? item.material.title}</cite>{item.material.blocks.find(block => block.id === span.blockId)?.text.slice(span.start, span.end)}{item.material.audio && <cite>{span.audioTiming ? '≈ ' : ''}{span.audioStart}–{span.audioEnd} s</cite>}</blockquote>)}<p lang={contentLanguage('explanation' in item.question ? item.question.explanation : item.question.explanations[0], instructionLocale)}>{explanationText(item.question, record.answer, instructionLocale)}</p>{!lesson.mode && <>{'criteria' in item.question && <SelfAssessment locale={instructionLocale} question={item.question} attempt={record} owner={owner} onSaved={updated => setSaved(previous => previous.map(record => record.id === updated.id ? updated : record))}/>}<AiHandoff locale={locale} lesson={lesson} material={item.material} question={item.question} attempt={record}/></>}</article>;
        })}{lesson.nextStep && <p lang={contentLanguage(lesson.nextStep, instructionLocale)}>{contentText(lesson.nextStep, instructionLocale)}</p>}<a className="button primary" href={next ? `/learn/${next.id}` : '/today'}>{next ? t.startListening : t.finish}</a></section>}
        </div>
      </section>
    </div>
    <dialog ref={validationDialog} className="update-confirm-dialog" aria-label={w.submitAll} aria-describedby="workspace-validation-message" onCancel={event => { event.preventDefault(); setError(''); }} onClose={() => { if (error === t.invalidAnswer) setError(''); }} onClick={event => { if (event.target === event.currentTarget) setError(''); }}>
      <p id="workspace-validation-message" role={error === t.invalidAnswer ? 'alert' : undefined}>{error === t.invalidAnswer ? error : ''}</p>
      <div className="update-confirm-actions"><button type="button" onClick={download}>{t.export}</button><button ref={validationClose} type="button" onClick={() => setError('')}>{messages('taskDetail')[locale].close}</button></div>
    </dialog>
  </section>;
}
