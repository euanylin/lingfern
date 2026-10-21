import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { advance, attempts, beginCheck, claimSession, createSession, endCheck, markExposure, recordDictionaryUse, recordPlayback, releaseSession, revealHint, saveDraft, sessions, submit, type Attempt, type Session } from '../data/db';
import { installSourcePack, listeningSourcePack } from '../data/sourcePacks';
import { contentLanguage, contentText, instructionLanguage, messages, translateInstruction } from '../locales';
import { answerText, correctAnswerText, explanationText, materialPackageId, practiceLocale, questions, teachingSupport, validateAnswer, type Answer, type Lesson, type Locale } from '../shared/content';
import { normaliseTerm } from '../shared/dictionary';
import { AiHandoff } from './AiHandoff';
import { deletionCopy } from './DeleteRecord';
import { copy } from './i18n';
import { type OnlineDictionaryId } from './onlineDictionaries';
import { PlaybackIcon } from './PlaybackIcon';
import QuestionInputs from './QuestionInputs';
import { QuestionSheetResize } from './QuestionSheetResize';
import { ReadingMaterial, readingAnnotationCopy } from './ReadingMaterial';
import { SelectionDictionary, type SelectedWord } from './SelectionDictionary';
import { SelfAssessment } from './SelfAssessment';
import { SettingsPicker } from './SettingsPicker';
import { teachingExample } from './teachingCopy';
import { useQuestionSheetLayout } from './useQuestionSheetLayout';

const MaterialWorkspace = lazy(() => import('./MaterialWorkspace'));

const minutes = (seconds: number) => `${Math.floor(Math.round(seconds) / 60)}:${String(Math.round(seconds) % 60).padStart(2, '0')}`;
function acquireSessionLock(id: string): Promise<(() => void) | undefined> {
  if (!navigator.locks) return Promise.resolve(undefined);
  return new Promise((resolve, reject) => {
    void navigator.locks.request(`lingfern-session:${id}`, { ifAvailable: true }, lock => {
      if (!lock) throw new Error('BUSY');
      return new Promise<void>(release => resolve(release));
    }).catch(reject);
  });
}

function selectedLookupText(container: HTMLElement): Omit<SelectedWord, 'input'> | undefined {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return;
  const element = range.commonAncestorContainer instanceof Element ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
  if (!element?.closest('.material,.question-panel') || element.closest('.selection-dictionary,.selection-dictionary-menu,.reading-workspace')) return;
  const term = selection.toString().trim();
  if (!normaliseTerm(term)) return;
  const rect = range.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  return { term, rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }, x: (rect.left + rect.right) / 2, y: rect.bottom };
}

export default function Learning({ catalogue, owner, id, profileId, locale, online, onlineDictionary, combinedSessions }: { catalogue: Lesson[]; owner: string; id: string; profileId: string; locale: Locale; online: boolean; onlineDictionary: OnlineDictionaryId; combinedSessions: Session[] }) {
  const t = copy[locale];
  const [session, setSession] = useState<Session>();
  const [answer, setAnswer] = useState<Answer>();
  const [result, setResult] = useState<Attempt>();
  const [checkAttempts, setCheckAttempts] = useState<Attempt[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const choiceFocus = useRef<HTMLInputElement | undefined>(undefined);
  useEffect(() => {
    if (busy || !choiceFocus.current) return;
    const input = choiceFocus.current; choiceFocus.current = undefined;
    if (input.isConnected && !input.disabled && document.activeElement === document.body) input.focus({ preventScroll: true });
  }, [busy]);
  const feedback = useRef<HTMLHeadingElement>(null);
  const prompt = useRef<HTMLHeadingElement>(null);
  const dirty = useRef(false);
  const annotationDirty = useRef(false);
  const draftTimer = useRef<number | undefined>(undefined);
  const draftVersion = useRef(0);
  const lockRelease = useRef<(() => void) | undefined>(undefined);
  const claimPending = useRef<Promise<Session> | undefined>(undefined);
  const mounted = useRef(true);
  const audio = useRef<HTMLAudioElement>(null);
  const exposurePending = useRef<Promise<void> | undefined>(undefined);
  const [playing, setPlaying] = useState(false);
  const [audioStarting, setAudioStarting] = useState(false);
  const audioStart = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => { audioStart.current?.abort(); }, [id, session?.position]);
  const [elapsed, setElapsed] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const [audioRepairError, setAudioRepairError] = useState(false);
  const [pane, setPane] = useState<'material' | 'question'>('material');
  const [selectedWord, setSelectedWord] = useState<SelectedWord>();
  useEffect(() => {
    if (session?.lesson.mode === 'check' || session?.lesson.mode === 'test') return;
    let timer: number | undefined;
    const selected = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        const grid = document.querySelector<HTMLElement>('.learning-grid');
        const word = grid && selectedLookupText(grid);
        if (word) setSelectedWord({ ...word, input: matchMedia('(any-pointer:coarse)').matches ? 'touch' : 'mouse' });
      }, 180);
    };
    document.addEventListener('selectionchange', selected);
    return () => { clearTimeout(timer); document.removeEventListener('selectionchange', selected); };
  }, [session?.lesson.mode]);
  const [mobile, setMobile] = useState(() => matchMedia('(max-width: 1199px)').matches);
  useEffect(() => {
    const query = matchMedia('(max-width: 1199px)');
    const resize = () => setMobile(query.matches);
    query.addEventListener('change', resize);
    return () => query.removeEventListener('change', resize);
  }, []);
  useEffect(() => {
    if (!mobile || pane !== 'question') return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) setPane('material'); };
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('keydown', close); };
  }, [mobile, pane]);
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
      const q = questions(current.lesson)[current.position].question;
      const saved = await attempts.get(`${id}:${q.id}`);
      setSession(current); setAnswer(saved?.answer ?? current.draft); setResult(saved);
      setPane('material');
      if ((current.lesson.mode === 'check' || current.lesson.mode === 'test') && current.status !== 'active') setCheckAttempts(await attempts.where('sessionId').equals(id).toArray());
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'READ';
      if (reason === 'CHECK_DEVICE') {
        lockRelease.current?.(); lockRelease.current = undefined;
        try {
          const saved = await sessions.get(id);
          if (mounted.current && saved?.profileId === profileId && saved.lesson.mode === 'check') {
            setSession(saved); setCheckAttempts(await attempts.where('sessionId').equals(id).toArray());
          }
        } catch { setError('READ'); return; }
      }
      setError(reason);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void load();
    const heartbeat = setInterval(() => {
      if (navigator.locks && !lockRelease.current) return;
      void claimSession(id, owner).catch(error => { if (error instanceof Error && error.message === 'CHECK_DEVICE') void load(); else setError('BUSY'); });
    }, 5000);
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current || annotationDirty.current) { e.preventDefault(); e.returnValue = ''; } };
    addEventListener('beforeunload', warn);
    return () => {
      mounted.current = false; audioStart.current?.abort(); clearInterval(heartbeat); clearTimeout(draftTimer.current); removeEventListener('beforeunload', warn);
      void Promise.resolve(claimPending.current).catch(() => {}).then(() => {
        lockRelease.current?.(); lockRelease.current = undefined;
        return releaseSession(id, owner);
      }).catch(() => {});
    };
  }, [id]);
  useEffect(() => {
    const guard = (event: MouseEvent) => {
      if ((dirty.current || annotationDirty.current) && (event.target as HTMLElement).closest('a[href^="/"]') && !confirm(annotationDirty.current ? readingAnnotationCopy[locale].leave : t.saveError)) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    document.addEventListener('click', guard, true);
    return () => document.removeEventListener('click', guard, true);
  }, [locale, t.saveError]);
  useEffect(() => {
    if (result && (!mobile || session?.lesson.skill === 'listening' || pane === 'question')) {
      const heading = feedback.current;
      const scroller = heading?.closest<HTMLElement>('.question-sheet-content');
      if (heading && scroller && scroller.scrollHeight > scroller.clientHeight) {
        heading.focus({ preventScroll: true });
        scroller.scrollTop += heading.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 16;
      } else heading?.focus();
    }
    else if (mobile && session?.lesson.skill !== 'listening' && pane === 'material') document.getElementById('learning-material')?.focus({ preventScroll: true });
    else {
      const heading = prompt.current;
      heading?.focus({ preventScroll: true });
      const scroller = heading?.closest<HTMLElement>('.question-sheet-content');
      if (heading && scroller && session?.lesson.skill === 'reading') scroller.scrollTop += heading.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 16;
    }
  }, [result, session?.position, session?.lesson.skill, pane, mobile]);
  function showPane(nextPane: 'material' | 'question') {
    setPane(nextPane);
  }
  const message = error === 'CHECK_EXPOSED' ? t.checkUnavailable : error === 'CHECK_DEVICE' ? t.checkOriginalDevice : error === 'NO_AUDIO' ? t.listenFirst : error === 'BUSY' ? t.busy : error === 'NOT_FOUND' ? t.missing : error === 'CONFLICT' ? t.conflict : error === 'INVALID_ANSWER' ? t.invalidAnswer : error === 'READ' ? t.readError : t.saveError;
  const all = session ? questions(session.lesson) : [];
  const current = session ? all[session.position] : undefined;
  const sheet = useQuestionSheetLayout(`${current?.material.id}:${session?.status}:${session?.checkStartedAt}:${locale}`, !!session && session.lesson.skill !== 'listening' && session.lesson.organization !== 'material-v1', mobile, pane === 'question');
  const audioPack = listeningSourcePack(session && current ? materialPackageId(session.lesson, current.material) : undefined);
  async function repairAudio() {
    if (!audioPack || busy || !online) return;
    setBusy(true); setAudioRepairError(false);
    try {
      await installSourcePack(audioPack.sha256, profileId);
      if (mounted.current) { setAudioError(false); audio.current?.load(); }
    } catch { if (mounted.current) setAudioRepairError(true); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function playAudio() {
    if (!session || !current || !audio.current || playing || audioStart.current || busy) return;
    const player = audio.current;
    const start = new AbortController();
    audioStart.current = start;
    setAudioError(false); setAudioStarting(true); setError('');
    try {
      const ready = await new Promise<boolean>(resolve => {
        const timer = window.setTimeout(() => resolve(true), 1500);
        start.signal.addEventListener('abort', () => { clearTimeout(timer); resolve(false); }, { once: true });
      });
      if (!ready || !mounted.current || audio.current !== player) return;
      const assistance = await recordPlayback(id, owner, current.question.id, false);
      if (start.signal.aborted || !mounted.current || audio.current !== player) return;
      setSession(previous => previous ? { ...previous, assistance } : previous);
      if (audioError) player.load();
      if (player.ended || audioError) player.currentTime = 0;
      await player.play();
      if (start.signal.aborted || !mounted.current || audio.current !== player) { player.pause(); return; }
      const exposure = markExposure(session);
      exposurePending.current = exposure;
      try { await exposure; }
      catch { player.pause(); if (mounted.current) setError('SAVE'); return; }
      if (mounted.current && !start.signal.aborted && audio.current === player) setPlaying(true);
      else player.pause();
    } catch (e) {
      if (start.signal.aborted || !mounted.current) return;
      setPlaying(false);
      if (e instanceof Error && ['BUSY', 'CONFLICT'].includes(e.message)) setError(e.message);
      else setAudioError(true);
    } finally { if (audioStart.current === start) { audioStart.current = undefined; if (mounted.current) setAudioStarting(false); } }
  }
  function pauseAudio() { audio.current?.pause(); setPlaying(false); }
  async function audioEnded() {
    if (!current) return;
    try {
      const player = audio.current;
      if (!player || !Number.isFinite(player.duration) || player.duration <= 0) return;
      const tolerance = Math.min(.15, player.duration * .01);
      let covered = 0;
      for (let index = 0; index < player.played.length; index++) {
        if (player.played.start(index) > covered + tolerance) return;
        covered = player.played.end(index);
      }
      if (covered < player.duration - tolerance) return;
      if (!exposurePending.current) throw new Error('SAVE');
      await exposurePending.current;
      const assistance = await recordPlayback(id, owner, current.question.id, true);
      setSession(previous => previous ? { ...previous, assistance } : previous);
      setAudioError(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'SAVE'); }
    finally { setElapsed(audio.current?.duration ?? 0); setPlaying(false); }
  }
  function download() {
    const blob = new Blob([JSON.stringify({ task: session ? contentText(session.lesson.title, locale) : undefined, question: current?.question.prompt, answer: answer === undefined || !current ? null : answerText(current.question, answer), status: result ? 'saved' : 'not-confirmed-saved' }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'lingfern-current-answer.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function choose(value: number) {
    choiceFocus.current = document.activeElement instanceof HTMLInputElement && document.activeElement.type === 'radio' ? document.activeElement : undefined;
    setAnswer(value); setBusy(true); dirty.current = true; setError('');
    try { await saveDraft(id, owner, value); dirty.current = false; } catch (e) { setError(e instanceof Error ? e.message : 'SAVE'); } finally { setBusy(false); }
  }
  function changeDraft(next: string | string[]) {
    setAnswer(next); dirty.current = true; setError('');
    const version = ++draftVersion.current;
    clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(() => {
      void saveDraft(id, owner, next).then(() => { if (draftVersion.current === version) dirty.current = false; })
        .catch(e => { if (draftVersion.current === version) setError(e instanceof Error ? e.message : 'SAVE'); });
    }, 350);
  }
  function changeCell(index: number, value: string) {
    if (!current || !('rows' in current.question)) return;
    const next = Array.isArray(answer) ? [...answer] : current.question.rows.map(() => '');
    next[index] = value; changeDraft(next);
  }
  function moveStep(index: number, offset: number) {
    if (!Array.isArray(answer) || index + offset < 0 || index + offset >= answer.length) return;
    const next = [...answer];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    changeDraft(next);
  }
  async function save() {
    if (answer === undefined || busy || !current) return;
    try { validateAnswer(current.question, answer); } catch { setError('INVALID_ANSWER'); return; }
    clearTimeout(draftTimer.current); draftVersion.current += 1;
    setBusy(true); setError(''); dirty.current = true;
    try { const saved = await submit(id, owner, answer); setPane('question'); setResult(saved); dirty.current = false;
      if ((session?.lesson.mode === 'check' || session?.lesson.mode === 'test') && session.position === all.length - 1) {
        setCheckAttempts(await attempts.where('sessionId').equals(id).toArray());
        setSession(previous => previous ? { ...previous, status: 'completed' } : previous);
      }
    }
    catch (e) { setError(e instanceof Error ? e.message : 'SAVE'); } finally { setBusy(false); }
  }
  async function hint() {
    if (!session) return;
    setBusy(true); setError('');
    try { const assistance = await revealHint(id, owner); setSession({ ...session, assistance }); }
    catch (e) { setError(e instanceof Error ? e.message : 'SAVE'); } finally { setBusy(false); }
  }
  async function dictionaryLookup() {
    if (!current || result) return;
    const assistance = await recordDictionaryUse(id, owner, current.question.id);
    setSession(previous => previous ? { ...previous, assistance } : previous);
  }
  async function next() {
    if (annotationDirty.current && all[session!.position + 1]?.material.id !== current?.material.id && !confirm(readingAnnotationCopy[locale].leave)) return;
    setBusy(true); setError('');
    setSelectedWord(undefined);
    try {
      const current = await advance(id, owner);
      if (current.lesson.skill === 'reading' || current.assistance.audioCompleted) await markExposure(current);
      const newMaterial = questions(current.lesson)[current.position].material.id !== questions(session!.lesson)[session!.position].material.id;
      if (newMaterial) { setElapsed(0); setAudioDuration(0); }
      setPane(newMaterial ? 'material' : 'question');
      setSession(current); setAnswer(current.draft); setResult(undefined);
    }
    catch (e) { setError(e instanceof Error ? e.message : 'SAVE'); } finally { setBusy(false); }
  }
  async function begin() {
    setBusy(true); setError('');
    try { setSession(await beginCheck(id, owner)); }
    catch (e) { setError(e instanceof Error ? e.message : 'SAVE'); }
    finally { setBusy(false); }
  }
  async function endAndLearn() {
    if (!session || (annotationDirty.current && !confirm(readingAnnotationCopy[locale].leave))) return;
    setBusy(true); setError('');
    try {
      if (session.status === 'active') setSession(await endCheck(id, owner));
      setCheckAttempts(await attempts.where('sessionId').equals(id).toArray());
      let lesson = catalogue.find(item => item.skill === session.lesson.skill && item.goalId === session.lesson.goalId);
      const generation = session.lesson.generation;
      if (!lesson && generation?.generator === 'corpus-check-v1') {
        const { loadReadingCorpus } = await import('../data/corpus');
        const { corpusLesson, filterCorpusRoots } = await import('../core/corpus');
        const bank = await loadReadingCorpus(profileId);
        const roots = new Set(session.lesson.materials.map(material => material.rootId));
        lesson = corpusLesson(filterCorpusRoots(bank, roots, true), new Set(), generation.seed, generation.startingPoint === 'B2' ? 450 : generation.startingPoint === 'B1' ? 400 : 160, generation.startingPoint, [], 'table', [], undefined, bank);
      }
      const prior = lesson && await sessions.where('profileId').equals(profileId).filter(item => item.lesson.id === lesson.id && item.lesson.mode === lesson.mode && item.status === 'active').first();
      const destination = prior ?? (lesson && await createSession(lesson, profileId));
      await releaseSession(id, owner);
      location.assign(destination ? `/learn/${destination.id}` : '/today');
    } catch (e) { setError(e instanceof Error ? e.message : 'SAVE'); setBusy(false); }
  }
  if (!session || !current) return <section><h1>{t.learning}</h1>{error ? <div className="error" role="alert"><p>{message}</p><button onClick={() => void load()}>{t.retry}</button></div> : <p>{t.loading}</p>}</section>;
  const { material, question } = current;
  const contentLocale = practiceLocale(session.lesson, locale);
  const instructions = copy[contentLocale];
  const listening = session.lesson.skill === 'listening';
  const legacyCheck = session.lesson.mode === 'check';
  const testing = session.lesson.mode === 'test';
  const checking = legacyCheck || testing;
  const application = material.rootId !== session.lesson.materials[0].rootId;
  const canSubmit = 'criteria' in question ? typeof answer === 'string' && !!answer.trim() : 'pairs' in question ? Array.isArray(answer) && answer.length === question.pairs.length && answer.every(value => question.choices.includes(value)) : 'steps' in question ? Array.isArray(answer) && answer.length === question.steps.length : 'rows' in question ? Array.isArray(answer) && answer.length === question.rows.length && answer.every(value => typeof value === 'string' && value.trim()) : 'kind' in question && question.kind === 'completion' ? typeof answer === 'string' && !!answer.trim() : typeof answer === 'number';
  const selectedSteps = 'steps' in question && Array.isArray(answer) ? answer : [];
  const evidence = [{ blockId: question.blockId, ...question.evidence }, ...(question.additionalEvidence ?? [])];
  const optionResult = (index: number, accepted: boolean): 'correct' | 'incorrect' | 'answer' | undefined => !result || checking ? undefined : result.answer === index ? (result.correct ? 'correct' : 'incorrect') : accepted ? 'answer' : undefined;
  const optionResultLabel = { correct: `✓ ${t.yourAnswer} · ${t.correct}`, incorrect: `× ${t.yourAnswer}`, answer: `✓ ${t.answer}` };
  if (session.recordsDeleted) return <><h1 lang={contentLanguage(session.lesson.title, contentLocale)}>{contentText(session.lesson.title, contentLocale)}</h1><p>{deletionCopy[locale].archived}</p><a className="button" href="/progress">{t.progress}</a></>;
  if (legacyCheck && error === 'CHECK_DEVICE') return <section className="narrow check-readonly"><h1 lang={contentLanguage(session.lesson.title, contentLocale)}>{contentText(session.lesson.title, contentLocale)}</h1><p role="status">{t.checkOriginalDevice}</p>{checkAttempts.map(saved => {
    const item = all.find(item => item.question.id === saved.questionId);
    return item && <article key={saved.id}><h2 lang="en">{item.question.prompt}</h2><p>{t.yourAnswer}: <span lang="en">{answerText(item.question, saved.answer)}</span></p></article>;
  })}<a className="button primary" href="/today">{t.finish}</a></section>;
  if (session.lesson.organization === 'material-v1') return <Suspense fallback={<p role="status">{t.loading}</p>}><MaterialWorkspace session={session} owner={owner} locale={locale} profileId={profileId} online={online} onlineDictionary={onlineDictionary} onSession={setSession} combinedSessions={combinedSessions}/></Suspense>;
  const practiceNext = session.practiceGroupId && combinedSessions.find(item => item.profileId === profileId && item.practiceGroupId === session.practiceGroupId && item.lesson.mode === session.lesson.mode && item.id !== session.id && item.status === 'active' && !item.recordsDeleted);
  const combinedNext = session.checkGroupId && combinedSessions.find(item => item.profileId === profileId && item.checkGroupId === session.checkGroupId && item.id !== session.id && item.status === 'active' && !item.recordsDeleted);
  const checkReview = checking && session.status !== 'active' && <section className="feedback"><h2 tabIndex={-1} ref={feedback}>{session.status === 'ended' ? t.checkEnded : t.checkFinished}</h2>{session.status === 'ended' && <p>{t.checkPartial}</p>}{all.map(({ material: itemMaterial, question: itemQuestion }, index) => { const saved = checkAttempts.find(attempt => attempt.questionId === itemQuestion.id); if (!saved) return null; return <div className="check-result" data-result={saved.correct === null ? undefined : saved.correct ? 'correct' : 'incorrect'} key={itemQuestion.id}><h3 lang="en">{index + 1}. {itemQuestion.prompt}</h3><p><span className="result-status">{saved.correct === null ? t.unscored : saved.correct ? `✓ ${t.correct}` : `× ${t.incorrect}`}</span> · {t.yourAnswer}: <span lang="en">{answerText(itemQuestion, saved.answer)}</span></p>{!('criteria' in itemQuestion) && <p>{t.answer}: <span lang="en">{correctAnswerText(itemQuestion)}</span></p>}{[{ blockId: itemQuestion.blockId, ...itemQuestion.evidence }, ...(itemQuestion.additionalEvidence ?? [])].map(span => <blockquote key={`${span.blockId}:${span.start}`} lang="en">{itemMaterial.blocks.find(block => block.id === span.blockId)?.text.slice(span.start, span.end)}</blockquote>)}<p lang={instructionLanguage(explanationText(itemQuestion, saved.answer, contentLocale), contentLocale)}>{translateInstruction(explanationText(itemQuestion, saved.answer, contentLocale), contentLocale)}</p></div>; })}{session.status === 'completed' && (testing ? <div className="check-next">{practiceNext && <a className="button primary" href={`/learn/${practiceNext.id}`}>{practiceNext.lesson.skill === 'listening' ? t.startListening : t.start}</a>}</div> : session.checkGroupId ? <div className="check-next">{combinedNext ? <a className="button primary" href={`/learn/${combinedNext.id}`}>{combinedNext.lesson.skill === 'listening' ? t.startListening : t.start}</a> : <a className="button" href="/today">{t.today}</a>}</div> : null)}<a className="button primary" href="/today">{t.finish}</a></section>;
  if (legacyCheck && session.status === 'ended') return <><h1 lang={contentLanguage(session.lesson.title, contentLocale)}>{contentText(session.lesson.title, contentLocale)}</h1>{error && <div className="error" role="alert"><p>{error === 'BUSY' ? message : t.checkLearnError}</p><button className="primary" disabled={busy} onClick={() => void endAndLearn()}>{t.retry}</button></div>}{checkReview}</>;
  if (legacyCheck && session.status === 'active' && !session.checkStartedAt) return <section className="narrow check-intro"><p className="eyebrow">{session.lesson.skill.toUpperCase()}</p><h1 lang={contentLanguage(session.lesson.title, contentLocale)}>{contentText(session.lesson.title, contentLocale)}</h1><p lang={contentLanguage(session.lesson.goal, contentLocale)}>{contentText(session.lesson.goal, contentLocale)}</p><p className="muted">{t.checkUnseen}</p><dl><div><dt>{t.checkMaterialLength}</dt><dd>{listening && material.audio ? minutes(material.audio.duration) : `${material.blocks.map(block => block.text.trim().split(/\s+/).length).reduce((a,b) => a+b,0)} ${t.checkWords}`}</dd></div><div><dt>{t.checkExpectedDuration}</dt><dd>{session.lesson.expectedMinutes} {t.checkMinutes}</dd></div><div><dt>{t.dictionary}</dt><dd>{t.checkDictionaryRule}</dd></div><div><dt>{t.checkAudioLabel}</dt><dd>{listening ? t.checkAudioRule : t.checkNoAudio}</dd></div></dl><button className="primary" disabled={busy || error === 'BUSY' || error === 'CHECK_EXPOSED'} onClick={() => void begin()}>{t.checkBegin}</button>{error && <p className="error" role="alert">{message}</p>}</section>;
  return <>
    {listening && <h1 className="session-title" lang={contentText(session.lesson.title, contentLocale) === session.lesson.title.en ? 'en' : undefined}>{contentText(session.lesson.title, contentLocale)}</h1>}
    {mobile && !listening && <button className="question-sheet-scrim" type="button" aria-label={listening ? t.listening : t.material} aria-hidden={pane !== 'question'} tabIndex={pane === 'question' ? 0 : -1} data-open={pane === 'question'} data-blur={sheet.blurBackground} onClick={() => showPane('material')}/>}
    <div className={`learning-grid${listening ? ' listening-layout' : ''}`}>
      <article id="learning-material" tabIndex={-1}>
        <p className="eyebrow" lang={contentLocale}>{instructions.goal}</p><p className="lead" lang={contentLanguage(session.lesson.goal, contentLocale)}>{contentText(session.lesson.goal, contentLocale)}</p>
        {!checking && session.position === 0 && session.lesson.teaching && session.lesson.workedExample && (listening ? <details className="teaching" lang={contentLocale}><summary>{copy[contentLocale].teaching}</summary><p lang={contentLanguage(session.lesson.teaching, contentLocale)}>{contentText(session.lesson.teaching, contentLocale)}</p>{(session.lesson.generation?.generator !== 'corpus-v1' || session.assistance.audioCompleted) && <p lang={contentLanguage(session.lesson.workedExample, contentLocale)}>{teachingExample(contentText(session.lesson.workedExample, contentLocale))}</p>}</details> : <details className="teaching" lang={contentLocale}><summary>{copy[contentLocale].teaching}</summary><p lang={contentLanguage(session.lesson.teaching, contentLocale)}>{contentText(session.lesson.teaching, contentLocale)}</p><p lang={contentLanguage(session.lesson.workedExample, contentLocale)}>{teachingExample(contentText(session.lesson.workedExample, contentLocale))}</p></details>)}
        {listening && material.audio ? <section className="material">
          <h2>{t.listening}</h2>
          {material.illustration && <img className="material-illustration" src={material.illustration.src} alt={contentText(material.illustration.alt, locale)} loading="lazy"/>}
          <audio key={`${material.id}:${material.audio.src}`} ref={audio} src={material.audio.src} preload="metadata" onLoadedMetadata={() => { const duration = audio.current?.duration ?? 0; setAudioDuration(Number.isFinite(duration) ? duration : 0); }} onTimeUpdate={() => setElapsed(audio.current?.currentTime ?? 0)} onEnded={() => void audioEnded()} onError={() => { setAudioError(true); setPlaying(false); }}/>
          <div className="audio-player">
            <button className="audio-play" type="button" aria-label={audioStarting ? t.cancelPlayback : playing ? t.pause : t.play} title={audioStarting ? t.cancelPlayback : playing ? t.pause : t.play} aria-busy={audioStarting} disabled={busy || error === 'BUSY'} onClick={() => audioStarting ? audioStart.current?.abort() : playing ? pauseAudio() : void playAudio()}><PlaybackIcon state={audioStarting ? 'stop' : playing ? 'pause' : 'play'}/></button>
            <div className="audio-timeline">
              {legacyCheck ? <progress aria-label={t.playbackProgress} max={audioDuration || material.audio.duration} value={Math.min(elapsed, audioDuration || material.audio.duration)}/> : <input type="range" aria-label={t.playbackProgress} min={0} max={audioDuration || material.audio.duration} step="0.1" value={Math.min(elapsed, audioDuration || material.audio.duration)} aria-valuetext={`${minutes(elapsed)} / ${minutes(audioDuration || material.audio.duration)}`} disabled={!audioDuration || busy || audioStarting || audioError || error === 'BUSY'} style={{ backgroundImage: `linear-gradient(to right, var(--accent) ${elapsed / (audioDuration || material.audio.duration) * 100}%, var(--line) 0%)` }} onChange={event => { if (audio.current && audioDuration) { const time = Math.min(audioDuration, Math.max(0, Number(event.target.value))); audio.current.currentTime = time; setElapsed(time); } }}/>}
              <div className="audio-times"><span>{minutes(Math.min(elapsed, audioDuration || material.audio.duration))}</span><span>{minutes(audioDuration || material.audio.duration)}</span></div>
            </div>
          </div>
          <p role="status">{audioStarting ? t.audioPreparing : session.assistance.audioCompleted ? t.audioDone : t.listenFirst}</p>
          {audioError && <><p role="alert" className="error">{t.audioError}</p>{audioPack && <button type="button" aria-busy={busy} disabled={busy || !online} onClick={() => void repairAudio()}>{t.audioRepair}</button>}{audioRepairError && <p role="alert" className="error">{t.audioRepairFailed}</p>}</>}
          {material.audio.synthetic && <p className="muted">{t.syntheticCredit}</p>}

        </section> : <ReadingMaterial key={`${id}:${material.id}`} material={material} locale={locale} label={application ? (session.lesson.targetLevel === 'C2' ? t.newMaterialC2 : t.newMaterial) : t.material} sessionId={id} owner={owner} annotation={session.readingAnnotations?.find(item => item.materialId === material.id)} checking={checking} profileId={profileId} online={online} defaultId={onlineDictionary} onLookup={dictionaryLookup} onDirty={value => { annotationDirty.current = value; }} onSaved={readingAnnotations => setSession(previous => previous ? { ...previous, readingAnnotations } : previous)}/>}
      </article>
      {!checking && selectedWord && <SelectionDictionary key={`${selectedWord.term}:${selectedWord.x}:${selectedWord.y}`} selected={selectedWord} locale={locale} profileId={profileId} online={online} defaultId={onlineDictionary} onLookup={dictionaryLookup} onClose={() => setSelectedWord(undefined)}/>}
      <section id="learning-question" className="question-panel" aria-label={t.question} aria-busy={busy} data-open={listening || pane === 'question'}>
        {mobile && !listening && pane === 'question' && <QuestionSheetResize locale={locale} controls="question-sheet-content" resize={sheet.resize}/>}
        <button className="question-sheet-toggle" type="button" disabled={busy} aria-controls="question-sheet-content" aria-expanded={pane === 'question'} onClick={() => showPane('question')}><span className="question-sheet-label"><span>{t.question} {session.position + 1}/{all.length}</span><span className="question-sheet-preview" lang="en">{question.prompt}</span></span></button>
        <div className="question-progress" inert={mobile && !listening && pane !== 'question'}><div className="question-number"><span><bdi dir="ltr">{session.position + 1} / {all.length}</bdi></span>{mobile && !listening && <button type="button" className="question-close" onClick={() => showPane('material')}>{t.material}</button>}</div><progress aria-label={t.saved} max={all.length} value={session.position + (result ? 1 : 0)}/></div>
        <div id="question-sheet-content" className="question-sheet-content" inert={mobile && !listening && pane !== 'question'}>
        <form onSubmit={e => { e.preventDefault(); void save(); }}>
          <h2 ref={prompt} tabIndex={-1} lang="en">{question.prompt}</h2>
          {'gaps' in question ? <QuestionInputs question={question} answer={answer} locale={locale} instructionLocale={contentLocale} listening={listening} disabled={busy || !!result} onChange={value => { if (typeof value !== 'number') changeDraft(value); }}/> : 'criteria' in question ? <fieldset disabled={busy || !!result || error === 'BUSY'}><label className="response-answer"><span>{instructions.responseInstruction}</span><textarea lang="en" rows={6} maxLength={4000} value={typeof answer === 'string' ? answer : ''} onChange={event => changeDraft(event.target.value)}/></label></fieldset> : 'pairs' in question ? <fieldset disabled={busy || !!result || error === 'BUSY'} className="matching-answers"><legend>{instructions.matchingInstruction}</legend>{question.pairs.map((pair, index) => <SettingsPicker key={pair.label} label={pair.label} value={Array.isArray(answer) ? answer[index] ?? '' : ''} options={[{ value: '', label: t.matchingChoose }, ...question.choices.map(value => ({ value, label: value }))]} disabled={busy || !!result || error === 'BUSY'} onChange={value => { const next = Array.isArray(answer) ? [...answer] : question.pairs.map(() => ''); next[index] = value; changeDraft(next); }}/>)}</fieldset> : 'steps' in question ? <fieldset disabled={busy || !!result || error === 'BUSY'}><legend>{instructions.sequenceInstruction}</legend><ol className="sequence-order" aria-label={t.sequenceOrder}>{selectedSteps.map((step, index) => <li key={step}><span className="sequence-index">{index + 1}.</span><span lang="en">{step}</span><div className="sequence-controls"><button type="button" aria-label={`${t.moveUp}: ${step}`} disabled={index === 0} onClick={() => moveStep(index, -1)}>↑</button><button type="button" aria-label={`${t.moveDown}: ${step}`} disabled={index === selectedSteps.length - 1} onClick={() => moveStep(index, 1)}>↓</button><button type="button" aria-label={`${t.removeStep}: ${step}`} onClick={() => changeDraft(selectedSteps.filter(item => item !== step))}>×</button></div></li>)}</ol><div className="sequence-choices" aria-label={t.sequenceChoices}>{question.steps.filter(step => !selectedSteps.includes(step)).map(step => <button type="button" lang="en" key={step} aria-label={`${t.addStep}: ${step}`} onClick={() => changeDraft([...selectedSteps, step])}>{step} <span aria-hidden="true">＋</span></button>)}</div></fieldset> : 'rows' in question ? <fieldset disabled={busy || !!result || error === 'BUSY'}><legend>{instructions.tableInstruction}</legend><div className="answer-table">{question.rows.map((row,i) => <label key={row.label}><span lang="en">{row.label}</span><input lang="en" inputMode={/^\d{4}$/.test(row.answer) ? 'numeric' : 'text'} maxLength={60} value={Array.isArray(answer) ? answer[i] ?? '' : ''} onChange={e => changeCell(i,e.target.value)} autoComplete="off"/></label>)}</div></fieldset> : 'kind' in question && question.kind === 'completion' ? <fieldset disabled={busy || !!result || error === 'BUSY'}><label className="completion-answer"><span>{listening ? instructions.completionInstruction : (messages('app_type_the_missing_word_from')[contentLocale])}</span><input lang="en" maxLength={80} value={typeof answer === 'string' ? answer : ''} onChange={event => changeDraft(event.target.value)} autoComplete="off" autoCapitalize="off"/></label></fieldset> : 'spans' in question ? <fieldset disabled={busy || !!result || error === 'BUSY'}><legend>{instructions.locateEvidence}</legend>{question.spans.map((span, i) => { const state = optionResult(i, question.accepted.includes(i)); return <label className={`option evidence-option ${answer === i ? 'selected' : ''}`} data-result={state} key={`${span.blockId}:${span.start}`}><input type="radio" name="answer" value={i} checked={answer === i} onChange={() => void choose(i)}/><span className="option-text"><q lang="en">{span.text}</q>{state && <span className="option-result">{optionResultLabel[state]}</span>}</span></label>; })}</fieldset> : <fieldset disabled={busy || !!result || error === 'BUSY'}><legend>{instructions.choice}</legend>{question.options.map((option,i) => { const state = optionResult(i, i === question.answer); return <label className={`option ${answer === i ? 'selected' : ''}`} data-result={state} key={option}><input type="radio" name="answer" value={i} checked={answer === i} onChange={() => void choose(i)}/><span className="option-text"><span lang="en">{option}</span>{state && <span className="option-result">{optionResultLabel[state]}</span>}</span></label>; })}</fieldset>}
          {!result && <>{!checking && !!question.hints?.length && <><button type="button" className="hint" disabled={busy || error === 'BUSY' || session.assistance.hintLevel === 3} onClick={() => void hint()}>{t.hint} {session.assistance.hintLevel}/3 {t.used}</button><div aria-live="polite">{question.hints?.slice(0,session.assistance.hintLevel).map((h,i) => <p className="hint-text" lang={contentLanguage(h, contentLocale)} key={i}>{contentText(h, contentLocale)}</p>)}</div></>}<button className="primary submit" type="submit" disabled={!canSubmit || busy || playing || audioStarting || error === 'BUSY' || (listening && (!session.assistance.audioCompleted || audioError))}>{busy ? t.saving : t.submit}</button></>}
        </form>
        {error && <div className="error" role="alert"><p>{message}</p>{error === 'BUSY' || error === 'CONFLICT' ? <button onClick={() => void load()}>{t.retry}</button> : <button disabled={!canSubmit || busy} onClick={() => void save()}>{t.retry}</button>}<button onClick={download}>{t.export}</button></div>}
        {result && checking && session.status !== 'completed' && <section className="feedback"><h2 tabIndex={-1} ref={feedback}>{t.checkResponseSaved}</h2><button className="primary" disabled={busy || playing || audioStarting} onClick={() => void next()}>{t.next}</button></section>}
        {result && checking && session.status === 'completed' && checkReview}
        {legacyCheck && session.status === 'active' && <button className="secondary-link check-end" type="button" disabled={busy || playing || audioStarting} onClick={() => void endAndLearn()}>{t.checkEndAndLearn}</button>}
        {result && !checking && <section className="feedback" data-result={result.correct === null ? undefined : result.correct ? 'correct' : 'incorrect'}><h2 tabIndex={-1} ref={feedback}>{result.correct === null ? t.unscored : result.correct ? `✓ ${t.correct}` : `× ${t.incorrect}`}</h2><p className="saved">{t.saved}</p><p>{t.yourAnswer}: <span lang="en">{answerText(question, result.answer)}</span></p>{(!('criteria' in question) || question.modelAnswer) && <p>{'criteria' in question ? t.possibleResponse : t.answer}: <span lang="en">{correctAnswerText(question)}</span></p>}<h3>{listening ? t.audioEvidence : t.evidence}</h3>{evidence.map((span,i) => { const block = material.blocks.find(b => b.id === span.blockId)!; return <div key={`${span.blockId}:${span.start}`}>{(block.title || evidence.length > 1 || listening) && <p className="evidence-source" lang="en">{[block.title ?? (evidence.length > 1 ? listening ? `${t.audioSegment} ${i + 1}` : material.title : ''), listening ? `${span.audioStart?.toFixed(2)}–${span.audioEnd?.toFixed(2)} s` : ''].filter(Boolean).join(' · ')}</p>}<blockquote lang="en">{block.text.slice(span.start,span.end)}</blockquote></div>; })}<h3 lang={contentLocale}>{instructions.explanation}</h3><p lang={instructionLanguage(explanationText(question, result.answer, contentLocale), contentLocale)}>{translateInstruction(explanationText(question, result.answer, contentLocale), contentLocale)}</p><p>{t.conditions}: {result.assistance.hintLevel}/3{teachingSupport(session.lesson, result.rootId, result.assistance.teachingProvided) ? ` · ${t.teachingProvided}` : ""}{result.assistance.dictionaryUsed ? ` · ${t.dictionaryUsed}` : ""}</p>{listening && <p>{t.playbackRequests}: {result.assistance.playbackRequests ?? 0}</p>}<p lang={contentLanguage(session.lesson.nextStep ?? session.lesson.goal, contentLocale)}>{contentText(session.lesson.nextStep ?? session.lesson.goal, contentLocale)}</p>
          {'criteria' in question && <SelfAssessment key={result.id} locale={contentLocale} question={question} attempt={result} owner={owner} onSaved={setResult}/>}
          <AiHandoff locale={locale} lesson={session.lesson} material={material} question={question} attempt={result}/>
          {session.position < all.length - 1 ? <button className="primary" disabled={busy || playing || audioStarting} onClick={() => { setAudioError(false); void next(); }}>{t.next}</button> : <><h3>{listening ? t.listeningCompleted : t.completed}</h3><a className="button primary" href={practiceNext ? `/learn/${practiceNext.id}` : "/today"}>{practiceNext ? practiceNext.lesson.skill === 'listening' ? t.startListening : t.start : t.finish}</a></>}
        </section>}
        </div>
      </section>
    </div>
  </>;
}
