import { useQuestionSheetLayout } from './useQuestionSheetLayout';
import { QuestionSheetResize } from './QuestionSheetResize';
import { useEffect, useRef, useState } from 'react';
import { contentText, contentLanguage, messages } from '../locales';
import { answerText, correctAnswerText, explanationText, practiceLocale, questions, scoreParts, materialPackageId, type Answer, type Locale } from '../shared/content';
import { questionSlots, slotAnswered } from '../shared/practiceWorkspace';
import { attempts, markExposure, recordDictionaryUse, recordPlayback, revealHint, saveWorkspaceDraft, selectWorkspaceQuestion, sessions, submitWorkspace, type Attempt, type Session } from '../data/db';
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
  const material = all[session.position].material, listening = lesson.skill === 'listening', finished = session.status === 'completed';
  const [answers, setAnswers] = useState<Record<string, Answer>>(session.workspace?.drafts ?? {});
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
  const pending = useRef(Promise.resolve()), unsaved = useRef(new Map<string, Answer>()), version = useRef(0), annotationDirty = useRef(false);
  const audio = useRef<HTMLAudioElement>(null), playback = useRef<Promise<void>>(Promise.resolve()), starting = useRef(false), live = useRef(session);
  live.current = session;
  const [playing, setPlaying] = useState(false), [elapsed, setElapsed] = useState(0), [duration, setDuration] = useState(0), [audioError, setAudioError] = useState(false);
  const previousMaterial = useRef(material.id);
  const positions = useRef(new Map<string, number>());
  const focusRequest = useRef<{ questionId: string; slot: number; target: 'answer' | 'prompt'; focused?: HTMLElement } | undefined>(undefined);
  let number = 1;
  const numbered = all.map(item => { const start = number; number += questionSlots(item.question); return { ...item, start }; });
  const visible = numbered.filter(item => item.material.id === material.id);
  const active = numbered.find(item => item.question.id === selected) ?? numbered[session.position];
  const currentNumber = active.start + Math.min(selectedSlot, questionSlots(active.question) - 1);
  const displayedNumber = !mobile && !listening && visibleNumber?.material === material.id ? visibleNumber.number : currentNumber;
  function followVisibleQuestion(panel: HTMLElement) {
    const bounds = panel.getBoundingClientRect();
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
  useEffect(() => { if (finished) void attempts.where('sessionId').equals(session.id).toArray().then(setSaved).catch(() => setError(t.readError)); }, [finished, session.id, t.readError]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (unsaved.current.size || annotationDirty.current) { event.preventDefault(); event.returnValue = ''; } };
    const guard = (event: MouseEvent) => { if ((unsaved.current.size || annotationDirty.current) && (event.target as HTMLElement).closest('a[href^="/"]') && !confirm(t.saveError)) { event.preventDefault(); event.stopPropagation(); } };
    addEventListener('beforeunload', warn); document.addEventListener('click', guard, true);
    return () => { removeEventListener('beforeunload', warn); document.removeEventListener('click', guard, true); };
  }, [t.saveError]);
  useEffect(() => {
    const materialChanged = previousMaterial.current !== material.id; previousMaterial.current = material.id;
    const player = audio.current;
    // Cached metadata can arrive before this effect; retain the native duration.
    setPlaying(false); setElapsed(0); setDuration(player && Number.isFinite(player.duration) ? player.duration : 0); setAudioError(false);
    requestAnimationFrame(() => {
      if (materialChanged && !listening) scrollTo(0, positions.current.get(material.id) ?? 0);
    });
    return () => { player?.pause(); };
  }, [material.id]);
  useEffect(() => {
    const request = focusRequest.current;
    if (!request) return;
    let frame = 0;
    // Parent session updates can commit after the navigation callback's first frame.
    const focusQuestion = () => {
      if (focusRequest.current !== request) return;
      if (request.focused && document.activeElement !== request.focused) { focusRequest.current = undefined; return; }
      const answer = document.getElementById(`answer-${request.questionId}-${request.slot}`);
      const element = (request.target === 'answer' ? answer : null) ?? document.getElementById(`prompt-${request.questionId}`);
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
        scrollTo(0, scrollY + element.getBoundingClientRect().top - offset);
      } else if (panel) {
        panel.scrollTop += element.getBoundingClientRect().top - panel.getBoundingClientRect().top - 16;
        if (request.target === 'prompt' && answer?.matches('input:not([type=radio],[type=checkbox]),textarea')) {
          const bottom = answer.getBoundingClientRect().bottom - panel.getBoundingClientRect().bottom + 8;
          if (bottom > 0) panel.scrollTop += bottom;
        }
      }
      // Keep the selected field visible while the sheet finishes expanding.
      if (panel?.closest('.question-panel')?.getAnimations().some(animation => animation.playState === 'running')) frame = requestAnimationFrame(focusQuestion);
      else focusRequest.current = undefined;
    };
    frame = requestAnimationFrame(focusQuestion);
    return () => cancelAnimationFrame(frame);
  }, [session, selected, selectedSlot, pane, mobile, listening]);
  function switchPane(next: 'material' | 'question') {
    focusRequest.current = next === 'question' ? { questionId: selected, slot: selectedSlot, target: 'prompt' } : undefined;
    setPane(next);
    if (next === 'material') requestAnimationFrame(() => document.querySelector<HTMLElement>('.workspace-questions .question-sheet-toggle')?.focus({ preventScroll: true }));
  }
  useEffect(() => {
    if (!mobile || listening || pane !== 'question') return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) switchPane('material'); };
    document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close);
  }, [mobile, listening, pane]);
  async function refresh() { const current = await sessions.get(session.id); if (current) onSession(current); }
  function persist(questionId: string, answer: Answer) {
    setAnswers(previous => ({ ...previous, [questionId]: answer })); unsaved.current.set(questionId, answer); setSaving(true);
    const revision = ++version.current; pendingVersions.current.set(questionId, revision);
    pending.current = pending.current.then(async () => {
      try {
        await saveWorkspaceDraft(session.id, owner, questionId, answer);
        if (pendingVersions.current.get(questionId) === revision) unsaved.current.delete(questionId);
        if (!unsaved.current.size) setError('');
      } catch { setError(t.saveError); }
      finally { if (revision === version.current) setSaving(false); }
    });
  }
  async function navigate(questionId: string, slot = 0) {
    if (busy) return;
    const target = all.find(item => item.question.id === questionId)!;
    if (target.material.id !== material.id && annotationDirty.current && !confirm(readingAnnotationCopy[locale].leave)) return;
    const request = { questionId, slot, target: 'answer' as const }; focusRequest.current = request;
    setVisibleNumber(undefined); setSelected(questionId); setSelectedSlot(slot); setPane('question');
    try {
      await pending.current;
      const updated = await selectWorkspaceQuestion(session.id, owner, questionId);
      if (updated.lesson.skill === 'reading' && target.material.id !== material.id) await markExposure(updated);
      if (target.material.id !== material.id && !listening) positions.current.set(material.id, scrollY);
      onSession(updated);
    } catch { if (focusRequest.current === request) focusRequest.current = undefined; setError(t.saveError); }
  }
  async function lookup() { await recordDictionaryUse(session.id, owner, all[live.current.position].question.id); await refresh(); }
  async function play() {
    const player = audio.current, original = material.id;
    if (!player || starting.current) return;
    if (!player.paused) { player.pause(); setPlaying(false); return; }
    starting.current = true; setAudioError(false);
    try {
      await recordPlayback(session.id, owner, all[live.current.position].question.id, false);
      const exposure = markExposure(live.current); playback.current = exposure; await exposure;
      if (audio.current !== player || questions(live.current.lesson)[live.current.position].material.id !== original) return;
      if (player.ended) player.currentTime = 0;
      await player.play(); setPlaying(true); await refresh();
    } catch { setAudioError(true); }
    finally { starting.current = false; }
  }
  async function ended() {
    const player = audio.current;
    setPlaying(false);
    if (!player || !Number.isFinite(player.duration) || player.duration <= 0) return;
    const tolerance = Math.min(.15, player.duration * .01); let covered = 0;
    for (let index = 0; index < player.played.length; index++) { if (player.played.start(index) > covered + tolerance) return; covered = player.played.end(index); }
    if (covered < player.duration - tolerance) return;
    try { await playback.current; await recordPlayback(session.id, owner, all[live.current.position].question.id, true); await refresh(); }
    catch { setError(t.saveError); }
  }
  async function submitAll() {
    if (busy) return;
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
    const url = URL.createObjectURL(new Blob([JSON.stringify({ sessionId: session.id, answers, status: 'draft' })], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'lingfern-answer-drafts.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const repairPack = listeningSourcePack(materialPackageId(lesson, material));
  const next = session.practiceGroupId && combinedSessions.find(item => item.practiceGroupId === session.practiceGroupId && item.id !== session.id && item.status === 'active');
  const points = saved.flatMap(record => scoreParts(all.find(item => item.question.id === record.questionId)!.question, record.answer));
  return <section className="material-workspace" data-pane={pane} data-listening={listening}>
    <h1 className="session-title sr-only" hidden={!listening} lang={contentLanguage(lesson.title, instructionLocale)}>{contentText(lesson.title, instructionLocale)}</h1>
    {mobile && !listening && <button className="question-sheet-scrim" type="button" aria-label={t.material} aria-hidden={pane !== 'question'} tabIndex={pane === 'question' ? 0 : -1} data-open={pane === 'question'} data-blur={sheet.blurBackground} onClick={() => switchPane('material')}/>}
    <div className={`learning-grid workspace-grid${listening ? ' listening-layout' : ''}`}>

      <article className="workspace-material">
        <p className="eyebrow" lang={instructionLocale}>{copy[instructionLocale].goal}</p><p className="lead" lang={contentLanguage(lesson.goal, instructionLocale)}>{contentText(lesson.goal, instructionLocale)}</p>
        {!lesson.mode && lesson.teaching && <details className="teaching"><summary>{t.teaching}</summary><p lang={contentLanguage(lesson.teaching, instructionLocale)}>{contentText(lesson.teaching, instructionLocale)}</p></details>}
        {listening && material.audio ? <section className="material workspace-player">
          {material.illustration && <img className="material-illustration" src={material.illustration.src} alt={contentText(material.illustration.alt, locale)}/>}

          <p className="sr-only" role="status">{session.assistance.audioCompleted ? t.audioDone : t.listenFirst}</p>
          {audioError && <div className="error" role="alert"><p>{t.audioError}</p><button type="button" onClick={() => { audio.current?.load(); setAudioError(false); }}>{t.retry}</button>{repairPack && <button type="button" disabled={!online || busy} onClick={async () => { setBusy(true); try { await installSourcePack(repairPack.sha256, profileId); audio.current?.load(); setAudioError(false); } catch { setError(t.audioRepairFailed); } finally { setBusy(false); } }}>{t.audioRepair}</button>}<a href="/library">{t.material}</a></div>}
          <details className="source"><summary>{messages('taskDetail')[locale].source}</summary><h2>{material.title}</h2><p>{material.credit?.attribution ?? material.audio.author}</p><p>{material.credit?.license ?? material.audio.license}</p>{(material.credit?.sourceUrl ?? material.audio.sourceUrl).startsWith('https://') && <a href={material.credit?.sourceUrl ?? material.audio.sourceUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{material.credit?.sourceUrl ?? material.audio.sourceUrl}</a>}</details>
          {material.audio.synthetic && <p>{t.syntheticCredit}</p>}
        </section> : <ReadingMaterial key={material.id} material={material} locale={locale} label={t.material} sessionId={session.id} owner={owner} annotation={session.readingAnnotations?.find(item => item.materialId === material.id)} checking={!!lesson.mode} profileId={profileId} online={online} defaultId={onlineDictionary} onLookup={lookup} onDirty={value => { annotationDirty.current = value; }} onSaved={readingAnnotations => onSession({ ...live.current, readingAnnotations })}/>}
      </article>
      <section className="question-panel workspace-questions" aria-label={t.question} aria-busy={busy} data-open={listening || pane === 'question'}>
        {mobile && !listening && pane === 'question' && <QuestionSheetResize locale={locale} controls="workspace-sheet-content" resize={sheet.resize}/>}
        <button className="question-sheet-toggle" type="button" aria-controls="workspace-sheet-content" aria-expanded={pane === 'question'} onClick={() => switchPane('question')}><span className="question-sheet-label"><span>{t.question} <bdi dir="ltr">{currentNumber}/{number - 1}</bdi></span><span className="question-sheet-preview" lang="en" dir="ltr">{active.question.prompt}</span></span></button>
        <div className="question-progress" inert={mobile && !listening && pane !== 'question'}>{!listening && <div className="question-number"><span>{t.question} <bdi dir="ltr">{displayedNumber}/{number - 1}</bdi></span>{mobile && !listening && <button type="button" className="question-close" onClick={() => switchPane('material')}>{t.material}</button>}</div>}
      {listening && material.audio && <div className="workspace-player-bar">
          <audio key={material.id} ref={audio} src={material.audio.src} preload="metadata" onLoadedMetadata={() => setDuration(audio.current?.duration ?? 0)} onTimeUpdate={() => setElapsed(audio.current?.currentTime ?? 0)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => void ended()} onError={() => { setAudioError(true); setPlaying(false); }}/>
          <div className="audio-player"><button type="button" className="audio-play" aria-label={playing ? t.pause : t.play} disabled={busy} onClick={() => void play()}><PlaybackIcon state={playing ? 'pause' : 'play'}/></button><div className="audio-timeline" dir="ltr"><input type="range" aria-label={t.playbackProgress} min={0} max={duration || material.audio.duration} step="0.1" value={Math.min(elapsed, duration || material.audio.duration)} aria-valuetext={`${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, '0')} / ${Math.floor((duration || material.audio.duration) / 60)}:${String(Math.floor((duration || material.audio.duration) % 60)).padStart(2, '0')}`} disabled={!duration || busy || audioError} style={{ backgroundImage: `linear-gradient(to right, var(--playback-fill, var(--accent)) ${elapsed / (duration || material.audio.duration) * 100}%, var(--line) 0%)` }} onChange={event => { if (audio.current) { audio.current.currentTime = Number(event.target.value); setElapsed(Number(event.target.value)); } }}/><div className="audio-times"><span>{Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, '0')}</span><span>{Math.floor((duration || material.audio.duration) / 60)}:{String(Math.floor((duration || material.audio.duration) % 60)).padStart(2, '0')}</span></div></div></div>
      </div>}
        </div>
        <div id="workspace-sheet-content" className="question-sheet-content" inert={mobile && !listening && pane !== 'question'} onScroll={!mobile && !listening ? event => followVisibleQuestion(event.currentTarget) : undefined}>
        <details className="workspace-card" open><summary><span>{w.card}</span></summary><nav aria-label={w.card}>{numbered.flatMap(item => Array.from({ length: questionSlots(item.question) }, (_, slot) => <button type="button" key={`${item.question.id}:${slot}`} aria-label={`${item.start + slot}. ${slotAnswered(item.question, answers[item.question.id], slot) ? w.answered : w.unanswered}`} aria-current={displayedNumber === item.start + slot ? 'step' : undefined} data-answered={slotAnswered(item.question, answers[item.question.id], slot)} onClick={() => void navigate(item.question.id, slot)}>{item.start + slot}</button>))}</nav></details>

        <p className="saved workspace-save-status sr-only" role="status">{saving ? t.saving : unsaved.current.size ? t.saveError : t.saved}</p>
        {error && <div className="error" role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={() => { for (const [id, answer] of unsaved.current) persist(id, answer); if (!unsaved.current.size) void submitAll(); }}>{t.retry}</button><button type="button" onClick={download}>{t.export}</button></div>}
        <form onSubmit={event => { event.preventDefault(); void submitAll(); }}>
          {visible.map(item => {
            const split = 'kind' in item.question && item.question.kind === 'completion' ? item.question.prompt.indexOf('\n') : -1;
            return <section className="workspace-question" data-selected={selected === item.question.id} key={item.question.id} onFocus={event => {
            const target = event.target as HTMLElement;
            setVisibleNumber(undefined);
            if (focusRequest.current && focusRequest.current.focused !== target) focusRequest.current = undefined;
            if (target.id.startsWith(`answer-${item.question.id}-`)) setSelectedSlot(Number(target.id.split('-').at(-1)));
            else if ('pairs' in item.question) { const index = Array.from(event.currentTarget.querySelectorAll('.setting')).indexOf(target.closest('.setting')!); if (index >= 0) setSelectedSlot(index); }
            else if (questionSlots(item.question) === 1) setSelectedSlot(0);
            if (selected === item.question.id) return; setSelected(item.question.id); void selectWorkspaceQuestion(session.id, owner, item.question.id).then(onSession).catch(() => setError(t.saveError));
          }}>
            <h2 id={`prompt-${item.question.id}`} tabIndex={-1} lang="en" dir="ltr">{item.start}{questionSlots(item.question) > 1 ? `–${item.start + questionSlots(item.question) - 1}` : ''}. {split > 0 ? item.question.prompt.slice(0, split) : item.question.prompt}</h2>
            {split > 0 && <p className="question-sentence" lang="en" dir="ltr">{item.question.prompt.slice(split + 1)}</p>}
            <QuestionInputs question={item.question} answer={answers[item.question.id]} start={item.start} locale={locale} instructionLocale={instructionLocale} listening={listening} disabled={busy || finished} onChange={answer => persist(item.question.id, answer)}/>
            {!lesson.mode && !finished && item.question.hints && <div className="workspace-hints"><button type="button" disabled={busy || (hintLevels[item.question.id] ?? 0) >= 3} onClick={async () => {
              try { await revealHint(session.id, owner); await refresh(); setHintLevels(previous => ({ ...previous, [item.question.id]: Math.min(3, (previous[item.question.id] ?? 0) + 1) })); }
              catch { setError(t.saveError); }
            }}>{w.hint}{hintLevels[item.question.id] ? ` ${hintLevels[item.question.id] ?? 0}/3` : ''}</button>{['Focus on the goal above.', listening ? 'Listen for the complete statement that supports your answer.' : 'Find the complete statement that supports your answer.', 'Check the wording, including negatives, pronouns and word endings.'].slice(0, hintLevels[item.question.id] ?? 0).map((hint, index) => <p key={index} lang="en" dir="ltr">{hint}</p>)}</div>}
          </section>; })}
          {!finished && <button className="primary" disabled={busy || saving} type="submit">{busy ? t.saving : w.submitAll}</button>}
        </form>
        {finished && <section className="feedback"><h2 id="workspace-result" tabIndex={-1}>{t.completed}</h2><p className="muted">{w.groups}: {all.length} · {w.blank}: {all.reduce((sum, item) => sum + ('gaps' in item.question ? item.question.gaps.length : 'rows' in item.question ? item.question.rows.length : 'kind' in item.question && item.question.kind === 'completion' ? 1 : 0), 0)} · {w.slots}: {number - 1}</p>{!lesson.mode && lesson.workedExample && <details className="teaching"><summary>{t.teaching}</summary><p lang={contentLanguage(lesson.workedExample, instructionLocale)}>{contentText(lesson.workedExample, instructionLocale)}</p></details>}<p>{w.score}: {points.filter(point => point.correct === true).length}/{points.filter(point => point.correct !== null).length} · {points.filter(point => point.correct === null).length} {t.unscored}</p>{numbered.map(item => {
          const record = saved.find(record => record.questionId === item.question.id);
          return record && <article className="workspace-review" key={record.id}><h3 lang="en">{item.start}. {item.question.prompt}</h3><p>{t.yourAnswer}: <span lang="en" dir="ltr">{answerText(item.question, record.answer)}</span></p>{(!('criteria' in item.question) || item.question.modelAnswer) && !('gaps' in item.question) && <p>{'criteria' in item.question ? t.possibleResponse : t.answer}: <span lang="en" dir="ltr">{correctAnswerText(item.question)}</span></p>}<ul>{scoreParts(item.question, record.answer).map((part, index) => <li key={part.id}><span className="slot-result">{item.start + index}: {part.correct === null ? t.unscored : part.correct ? `✓ ${t.correct}` : `× ${t.incorrect}`}</span>{'gaps' in item.question && <><p>{t.yourAnswer}: <span lang="en" dir="ltr">{Array.isArray(record.answer) ? record.answer[index] : ''}</span></p><p>{t.answer}: <span lang="en" dir="ltr">{item.question.gaps[index].answer}</span></p><blockquote className="slot-evidence" lang="en" dir="ltr">{item.material.blocks.find(block => block.id === item.question.blockId)?.text.slice(item.question.gaps[index].evidence.start, item.question.gaps[index].evidence.end)}{item.material.audio && <cite>{item.question.gaps[index].evidence.audioStart}–{item.question.gaps[index].evidence.audioEnd} s</cite>}</blockquote></>}</li>)}</ul>{[{ blockId: item.question.blockId, ...item.question.evidence }, ...(item.question.additionalEvidence ?? [])].map((span, index) => <blockquote lang="en" dir="ltr" key={index}>{item.material.blocks.find(block => block.id === span.blockId)?.text.slice(span.start, span.end)}{item.material.audio && <cite>{span.audioStart}–{span.audioEnd} s</cite>}</blockquote>)}<p lang={contentLanguage('explanation' in item.question ? item.question.explanation : item.question.explanations[0], instructionLocale)}>{explanationText(item.question, record.answer, instructionLocale)}</p>{!lesson.mode && <>{'criteria' in item.question && <SelfAssessment locale={instructionLocale} question={item.question} attempt={record} owner={owner} onSaved={updated => setSaved(previous => previous.map(record => record.id === updated.id ? updated : record))}/>}<AiHandoff locale={locale} lesson={lesson} material={item.material} question={item.question} attempt={record}/></>}</article>;
        })}{lesson.nextStep && <p lang={contentLanguage(lesson.nextStep, instructionLocale)}>{contentText(lesson.nextStep, instructionLocale)}</p>}<a className="button primary" href={next ? `/learn/${next.id}` : '/today'}>{next ? t.startListening : t.finish}</a></section>}
        </div>
      </section>
    </div>
  </section>;
}
