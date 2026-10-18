import { useQuestionSheetLayout } from './useQuestionSheetLayout';
import { loadInstructionLocale } from '../locales/teaching';
import { localeDirection, localeSchema } from '../shared/locale';
import { contentLanguage, instructionLanguage, translateInstruction, contentText, messages, languageOptions } from '../locales';
import { ReadingMaterial, readingAnnotationCopy } from './ReadingMaterial';
import { version as appVersion } from '../../package.json';
import { teachingExample } from './teachingCopy';
import { isGutenbergSource } from '../shared/sourceLicence';
import { GutenbergLicence } from './GutenbergLicence';
import { LookupHistory, lookupHistoryCopy } from './LookupHistory';
import { Fern } from './Fern';
import { PlaybackIcon } from './PlaybackIcon';
import { asTestLesson, materialPackageId } from '../shared/content';
import { teachingSupport } from '../shared/content';
import { SyncConflicts } from './SyncConflicts';
import { purgeDeletedRecords, restartPractice } from '../data/deletion';
import { DeleteRecord, deletionCopy } from './DeleteRecord';
import { startSyncSchedule } from '../data/syncSchedule';
import { GithubIdentity } from './GithubIdentity';
import { UnsavedDemo, unsavedCopy } from './UnsavedDemo';
import { FirstRun, firstRunCopy } from './FirstRun';
import { preferencesSchema, type Preferences } from '../shared/preferences';
import { CorpusPractice, prepareCorpusPractice } from './CorpusPractice';
import { DailyQuote } from './DailyQuote';
import { localDay } from '../core/dailyQuoteSelection';
import { TaskDetail, taskMinutes } from './TaskDetail';
import { PracticeCard, practiceCardProgress } from './PracticeCard';
import { corpusPracticeHistory } from '../core/corpusPractice';
import { TaskCatalogue } from './TaskCatalogue';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import QuestionInputs from './QuestionInputs';
const MaterialWorkspace = lazy(() => import('./MaterialWorkspace'));

import { createPortal } from 'react-dom';
import { registerSW } from 'virtual:pwa-register';
import { activateWaitingUpdate } from './serviceWorkerUpdate';
import { answerText, correctAnswerText, explanationText, practiceLocale, questions, validateAnswer, type Answer, type Locale, type Lesson, topicSchema } from '../shared/content';
import { advance, attempts, beginCheck, bootstrapSyncEvents, claimSession, communityPacks, createCombinedPractice, createSession, endCheck, markExposure, profiles, projectPreferences, saveSetting, recordDictionaryUse, recordPlayback, releaseSession, revealHint, saveDraft, sessions, settings, submit, syncClocks, type Attempt, type Session } from '../data/db';
import { copy, initialLocale } from './i18n';
import { About } from './About';
import { AiHandoff } from './AiHandoff';
import { SelfAssessment } from './SelfAssessment';
import { Dictionary } from './Dictionary';
import { SelectionDictionary, type SelectedWord } from './SelectionDictionary';
import { GrammarLookup } from './GrammarLookup';
import { IpaChart } from './IpaChart';
import { OfflineInstall } from './OfflineInstall';
import { CommunityImport, InstalledResources } from './CommunityImport';
import { ProfileBackup } from './ProfileBackup';
import { mergeLearningRecords, progressRecords, type ResolvedSummary, type CompletionSummary } from '../data/progress';
import { readSyncEvents } from '../data/sync';
import { CompletionTiming } from './CompletionTiming';
import type { CompletionTime } from '../data/completionTiming';
import { ProgressRecords } from './ProgressRecords';
import { SavedWords } from './SavedWords';
import { SettingsPicker } from './SettingsPicker';
import { defaultOnlineDictionary, onlineDictionaries, type OnlineDictionaryId } from './onlineDictionaries';
import { installedOfflineGroups } from '../data/offline';
import { communityPackageReady } from '../data/communityInstall';
import { installedSourcePacks, listeningSourcePack, installSourcePack } from '../data/sourcePacks';
import { normaliseTerm } from '../shared/dictionary';
import { selectPractice } from '../data/practice';

const { catalogue } = import.meta.env.MODE === 'test-fixtures'
  ? await import('../../tests/fixtures/catalogue')
  : { catalogue: [] as Lesson[] };
const lesson = catalogue.find(item => item.targetLevel === 'A1' && item.skill === 'reading');
const listeningLesson = catalogue.find(item => item.targetLevel === 'A1' && item.skill === 'listening');
const owner = crypto.randomUUID();
let firstEntry = location.pathname === '/';
const route = () => location.pathname === '/' ? '/today' : location.pathname;
const pageRoute = (path: string) => /^\/(start|today|progress|library(?:\/(?:dictionary|saved|ipa|grammar|history))?|settings(?:\/about)?|learn\/[^/]+)$/.test(path);
type NavDisplay = 'text' | 'icon' | 'both';
const navDisplay = (value?: string): value is NavDisplay => value === 'text' || value === 'icon' || value === 'both';
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

function NavIcon({ name }: { name: 'today' | 'library' | 'settings' }) {
  const shapes = {
    today: <><rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M7.5 3v4M16.5 3v4M3.5 10h17"/><circle cx="12" cy="15.5" r="2.5" fill="currentColor" stroke="none"/></>,
    library: <><rect x="3" y="4" width="4.5" height="16" rx="1.2"/><rect x="7.5" y="4" width="5" height="16" rx="1.2"/><path d="m14 5 3.6-.9a1.2 1.2 0 0 1 1.5.9l3.1 12.8a1.2 1.2 0 0 1-.9 1.5l-3.6.9zM4.5 8H6M9 16h2"/></>,
    settings: <><path d="M10 3h4l.6 2.3 1.8 1 2.3-.6 2 3.4-1.7 1.7v2.4l1.7 1.7-2 3.4-2.3-.6-1.8 1L14 21h-4l-.6-2.3-1.8-1-2.3.6-2-3.4L5 13.2v-2.4L3.3 9.1l2-3.4 2.3.6 1.8-1z"/><circle cx="12" cy="12" r="3"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{shapes[name]}</svg>;
}

export function App() {
  const [path, setPath] = useState(route);
  const currentPath = useRef(path); currentPath.current = path;
  const [todayDate, setTodayDate] = useState(() => localDay(new Date()));
  const [unsavedDemo, setUnsavedDemo] = useState(false);
  useEffect(() => { setUnsavedDemo(false); }, [path]);
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const localeRequest = useRef(0);
  const [theme, setTheme] = useState('system');
  const [desktopNavDisplay, setDesktopNavDisplay] = useState<NavDisplay>('text');
  const [mobileNavDisplay, setMobileNavDisplay] = useState<NavDisplay>('both');
  const [onlineDictionary, setOnlineDictionary] = useState<OnlineDictionaryId>('cambridge');
  const [preferences, setPreferences] = useState<Preferences>();
  const [activeProfile, setActiveProfile] = useState('local-guest');
  const [logicalProfile, setLogicalProfile] = useState('local-guest');
  const [online, setOnline] = useState(navigator.onLine);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [practiceDetail, setPracticeDetail] = useState<Lesson>();
  const [combinedDetail, setCombinedDetail] = useState<[Lesson, Lesson]>();
  const combinedInvoker = useRef<HTMLElement | null>(null);
  const [combinedPreparing, setCombinedPreparing] = useState(false);
  const [combinedError, setCombinedError] = useState('');
  const [combinedTopics, setCombinedTopics] = useState<Partial<Record<'reading' | 'listening', Preferences['interests'][number]>>>({});
  const [combinedTopicsChanged, setCombinedTopicsChanged] = useState(false);
  const [history, setHistory] = useState<Session[]>([]);
  const [pageSearch, setPageSearch] = useState(location.search);
  const lookupQuery = new URLSearchParams(pageSearch).get('q') ?? '';
  const [records, setRecords] = useState<Attempt[]>([]);
  const [summaries, setSummaries] = useState<ResolvedSummary[]>([]);
  const [unavailableSummaries, setUnavailableSummaries] = useState<CompletionSummary[]>([]);
  const [timingRows, setTimingRows] = useState<CompletionTime[]>([]);
  const [summaryConflicts, setSummaryConflicts] = useState(0);
  const [communityLessons, setCommunityLessons] = useState<Lesson[]>([]);
  const [localCorpus, setLocalCorpus] = useState(false);
  const [localSpoken, setLocalSpoken] = useState(false);
  const [starting, setStarting] = useState(false);
  const [offlineInstalled, setOfflineInstalled] = useState(false);
  const [installedGroups, setInstalledGroups] = useState<Set<string>>(new Set());
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateBlocked, setUpdateBlocked] = useState(false);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [confirmUpdate, setConfirmUpdate] = useState(false);
  const [applyingUpdate, setApplyingUpdate] = useState(false);
  const updateDialog = useRef<HTMLDialogElement>(null), updateCancel = useRef<HTMLButtonElement>(null), updateTrigger = useRef<HTMLButtonElement | null>(null);
  const [updateCheck, setUpdateCheck] = useState<'idle' | 'checking' | 'current' | 'offline' | 'unavailable' | 'failed'>('idle');
  const t = copy[locale];
  const sessionId = path.startsWith('/learn/') ? path.slice(7) : undefined;
  useEffect(() => {
    if (path !== '/library') return;
    const root = document.getElementById('root'), viewport = window.visualViewport;
    const positionNavigation = () => root?.style.setProperty('--library-navigation-bottom', `${Math.max(0, window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0))}px`);
    positionNavigation();
    window.addEventListener('resize', positionNavigation);
    viewport?.addEventListener('resize', positionNavigation);
    viewport?.addEventListener('scroll', positionNavigation);
    return () => { window.removeEventListener('resize', positionNavigation); viewport?.removeEventListener('resize', positionNavigation); viewport?.removeEventListener('scroll', positionNavigation); root?.style.removeProperty('--library-navigation-bottom'); };
  }, [path]);

  async function load() {
    setError('');
    try {
      if (!await profiles.get('local-guest')) await profiles.put({ id: 'local-guest', name: 'Local profile', createdAt: new Date().toISOString() });
      const saved = await settings.toArray();
      const selectedProfile = saved.find(s => s.key === 'activeProfile')?.value ?? 'local-guest';
      const profileId = await profiles.get(selectedProfile) ? selectedProfile : 'local-guest';
      await bootstrapSyncEvents(profileId).catch(() => setError('save'));
      await purgeDeletedRecords(profileId);
      const [all, answers, imported] = await Promise.all([sessions.where('profileId').equals(profileId).toArray(), attempts.where('profileId').equals(profileId).toArray(), communityPacks.where('profileId').equals(profileId).filter(pack => pack.state === 'ready').toArray()]);
      const available = await Promise.all(imported.map(async pack => ({ pack, ready: await communityPackageReady(pack) })));
      const importedLessons = available.filter(item => item.ready).flatMap(item => item.pack.lessons);
      setCommunityLessons(importedLessons);
      setLocalCorpus(available.some(item => item.ready && !!item.pack.corpus?.records.length));
      setLocalSpoken(available.some(item => item.ready && !!item.pack.spoken?.records.length));
      const effective = await mergeLearningRecords([...catalogue, ...importedLessons], all, answers, await readSyncEvents(profileId));
      setTimingRows(effective.timingRows); setSummaries(effective.summaries); setUnavailableSummaries(effective.unavailable); setSummaryConflicts(effective.conflicting.size);
      setActiveProfile(profileId);
      setLogicalProfile((await syncClocks.get(profileId))?.logicalProfileId ?? profileId);
      const { preferences: storedPreferences, values: savedValues } = await projectPreferences(profileId);
      setPreferences(storedPreferences ? preferencesSchema.parse(storedPreferences) : undefined);
      const showFirstRun = firstEntry && !storedPreferences?.completed && !all.length;
      firstEntry = false;
      if (showFirstRun) { window.history.replaceState(null, '', '/start'); setPath('/start'); }
      else if (location.pathname === '/') { window.history.replaceState(null, '', '/today'); setPath('/today'); }
      const language = localeSchema.safeParse(savedValues.get('locale'));
      const nextLocale = language.success ? language.data : initialLocale();
      await loadInstructionLocale(nextLocale);
      setLocale(nextLocale);
      const appearance = savedValues.get('theme');
      setTheme(appearance && ['system','light','dark'].includes(appearance) ? appearance : 'system');
      const desktopDisplay = savedValues.get('desktopNavDisplay');
      const mobileDisplay = savedValues.get('mobileNavDisplay');
      setDesktopNavDisplay(navDisplay(desktopDisplay) ? desktopDisplay : 'text');
      setMobileNavDisplay(navDisplay(mobileDisplay) ? mobileDisplay : 'both');
      setOnlineDictionary(defaultOnlineDictionary(savedValues.get('onlineDictionary')));
      setHistory(all.sort((a,b) => b.startedAt.localeCompare(a.startedAt))); setRecords(effective.records); setReady(true);
    } catch { setError('read'); setReady(false); }
  }
  const syncLoad = useRef(load); syncLoad.current = load;
  useEffect(() => ready ? startSyncSchedule(activeProfile, () => syncLoad.current()) : undefined, [activeProfile, ready]);
  useEffect(() => {
    const navigate = () => { const next = route(); if (next !== currentPath.current && currentPath.current.startsWith('/learn/')) setReady(false); setPath(next); setPageSearch(location.search); };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>('a[href^="/"]');
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href);
      if (url.origin !== location.origin || !pageRoute(url.pathname)) return;
      event.preventDefault();
      if (url.pathname === location.pathname && url.search === location.search) return;
      window.history.pushState(null, '', url.pathname + url.search);
      navigate(); scrollTo(0, 0);
    };
    const network = () => setOnline(navigator.onLine);
    document.addEventListener('click', click); addEventListener('popstate', navigate); addEventListener('online', network); addEventListener('offline', network);
    return () => { document.removeEventListener('click', click); removeEventListener('popstate', navigate); removeEventListener('online', network); removeEventListener('offline', network); };
  }, []);
  useEffect(() => { void load(); }, [path]);
  useEffect(() => {
    registerSW({ onNeedRefresh: () => { setUpdateAvailable(true); setUpdateDismissed(false); } });
  }, []);
  useEffect(() => {
    void Promise.all([installedOfflineGroups(), installedSourcePacks(activeProfile)]).then(([groups, sources]) => { setInstalledGroups(groups); setOfflineInstalled(groups.size + sources.size > 0); }).catch(() => {});
  }, [activeProfile]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = localeDirection(locale);
    document.documentElement.dataset.theme = theme;
    const systemDark = matchMedia('(prefers-color-scheme: dark)');
    const syncThemeMetadata = () => {
      const dark = theme === 'dark' || (theme === 'system' && systemDark.matches);
      document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]')?.setAttribute('content', dark ? 'dark' : 'light');
      document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1F1E1D' : '#F7F6F2');
    };
    syncThemeMetadata();
    systemDark.addEventListener('change', syncThemeMetadata);
    return () => systemDark.removeEventListener('change', syncThemeMetadata);
  }, [locale, theme]);
  async function setting(key: string, value: string) {
    const request = key === 'locale' ? ++localeRequest.current : undefined;
    try { if (key === 'locale') { await loadInstructionLocale(value as Locale); if (request !== localeRequest.current) return; } await saveSetting(activeProfile, key, value); if (key === 'locale') setLocale(value as Locale); else if (key === 'theme') setTheme(value); else if (key === 'desktopNavDisplay' && navDisplay(value)) setDesktopNavDisplay(value); else if (key === 'mobileNavDisplay' && navDisplay(value)) setMobileNavDisplay(value); else if (key === 'onlineDictionary') setOnlineDictionary(defaultOnlineDictionary(value)); if (key !== 'locale' || request === localeRequest.current) setError(''); }
    catch { if (key !== 'locale' || request === localeRequest.current) setError('save'); }
  }
  async function start(selected: Lesson) {
    setStarting(true); setError('');
    try { if (selected.mode === 'check') throw new Error('CHECK_UNAVAILABLE'); const session = history.find(s => s.status === 'active' && s.lesson.id === selected.id && s.lesson.mode === selected.mode && (!selected.mode || JSON.stringify(s.lesson) === JSON.stringify(selected))) ?? await createSession(selected, activeProfile); if (window.history.state?.practicePreview) window.history.replaceState(null, '', `/learn/${session.id}`); else window.history.pushState(null, '', `/learn/${session.id}`); setPracticeDetail(undefined); setCombinedDetail(undefined); setPath(route()); scrollTo(0, 0); }
    catch { setError('save'); } finally { setStarting(false); }
  }
  async function openCombined(reselect = false) {
    combinedInvoker.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCombinedPreparing(true); setCombinedError('');
    try {
      if (combinedPracticeSession?.lesson.mode === 'test' && !reselect && !combinedTopicsChanged) {
        window.history.pushState(null, '', `/learn/${combinedPracticeSession.id}`); setPath(route()); scrollTo(0, 0);
      } else if (combinedPracticeSession && !reselect && !combinedTopicsChanged) {
        const pair = history.filter(item => item.practiceGroupId === combinedPracticeSession.practiceGroupId);
        setCombinedDetail([pair.find(item => item.lesson.skill === 'reading')!.lesson, pair.find(item => item.lesson.skill === 'listening')!.lesson]);
      } else {
        const reading = await prepareCorpusPractice({ locale, profileId: activeProfile, preferences, history, records, online, skill: 'reading', topic: combinedTopics.reading });
        if (!reading.lesson) { setCombinedError(combinedTopics.reading ? training.readingEmpty : t.checkInsufficient); return; }
        const listening = await prepareCorpusPractice({ locale, profileId: activeProfile, preferences, history, records, online, skill: 'listening', topic: combinedTopics.listening, previewRoots: new Set(reading.lesson.materials.map(material => material.rootId)) });
        if (!listening.lesson) { setCombinedError(combinedTopics.listening ? training.listeningEmpty : t.checkInsufficient); return; }
        setCombinedDetail([reading.lesson, listening.lesson]);
      }
    } catch { setCombinedError(t.checkInsufficient); } finally { setCombinedPreparing(false); }
  }
  async function startCombinedPractice(test = false) {
    if (!combinedDetail) return;
    setStarting(true); setError('');
    try {
      const pair: [Lesson, Lesson] = test ? [asTestLesson(combinedDetail[0]), asTestLesson(combinedDetail[1])] : combinedDetail;
      const resume = combinedPracticeSession && combinedPracticeSession.lesson.mode === pair[0].mode && history.filter(item => item.practiceGroupId === combinedPracticeSession.practiceGroupId).every(item => pair.some(lesson => JSON.stringify(lesson) === JSON.stringify(item.lesson)));
      const destination = resume ? combinedPracticeSession! : (await createCombinedPractice(pair[0], pair[1], activeProfile))[0];
      if (window.history.state?.practicePreview) window.history.replaceState(null, '', `/learn/${destination.id}`); else window.history.pushState(null, '', `/learn/${destination.id}`);
      setCombinedDetail(undefined); setCombinedTopicsChanged(false); setPath(route()); scrollTo(0, 0);
    } catch { setError('save'); } finally { setStarting(false); }
  }
  useEffect(() => { if (confirmUpdate) { updateDialog.current?.showModal(); updateCancel.current?.focus(); } }, [confirmUpdate]);
  function requestUpdate(trigger: HTMLButtonElement) { updateTrigger.current = trigger; setUpdateBlocked(false); setConfirmUpdate(true); }
  function closeUpdate() { if (applyingUpdate) return; updateDialog.current?.close(); setConfirmUpdate(false); updateTrigger.current?.focus(); }
  async function applyUpdate() {
    if (applyingUpdate) return;
    setApplyingUpdate(true);
    try {
      const current = await sessions.where('status').equals('active').toArray();
      if (sessionId || current.some(session => session.owner && session.leaseUntil > Date.now())) { setUpdateBlocked(true); return; }
      setUpdateBlocked(false); setUpdateCheck('idle');
      const registration = await navigator.serviceWorker?.getRegistration('/');
      if (!registration?.active) throw new Error('UPDATE_UNAVAILABLE');
      await activateWaitingUpdate(navigator.serviceWorker, registration);
      window.location.reload();
    } catch { setUpdateCheck('failed'); } finally { setApplyingUpdate(false); }
  }
  async function checkForUpdates() {
    if (!navigator.onLine) { setUpdateCheck('offline'); return; }
    setUpdateCheck('checking');
    try {
      const registration = await navigator.serviceWorker?.getRegistration('/');
      if (!registration?.active) { setUpdateCheck('unavailable'); return; }
      await registration.update();
      if (registration.installing) await new Promise<void>((resolve, reject) => {
        const worker = registration.installing!;
        const timeout = setTimeout(() => { worker.removeEventListener('statechange', changed); reject(new Error('UPDATE_TIMEOUT')); }, 15000);
        const changed = () => { if (worker.state === 'installed' || worker.state === 'redundant' || worker.state === 'activated') { clearTimeout(timeout); worker.removeEventListener('statechange', changed); resolve(); } };
        worker.addEventListener('statechange', changed);
        changed();
      });
      if (registration.waiting) setUpdateAvailable(true);
      setUpdateCheck('current');
    } catch { setUpdateCheck('failed'); }
  }
  const individualHistory = history.filter(item => !item.practiceGroupId || item.status !== 'active');
  const todayReading = selectPractice(catalogue, individualHistory, records, 'reading', undefined, new Date(), preferences, summaries);
  const todayListening = selectPractice(catalogue, individualHistory, records, 'listening', item => online || installedGroups.has(`audio-${item.targetLevel.toLowerCase()}`), new Date(), preferences, summaries);
  const combinedPracticeSession = history.find(item => item.practiceGroupId && item.status === 'active' && !item.recordsDeleted
    && history.filter(peer => peer.practiceGroupId === item.practiceGroupId).length === 2
    && history.filter(peer => peer.practiceGroupId === item.practiceGroupId).every(peer => !peer.recordsDeleted && peer.lesson.mode !== 'check' && peer.lesson.mode === item.lesson.mode)
    && history.some(peer => peer.practiceGroupId === item.practiceGroupId && peer.lesson.skill === 'reading')
    && history.some(peer => peer.practiceGroupId === item.practiceGroupId && peer.lesson.skill === 'listening')
    && (item.lesson.skill === 'reading' || history.some(peer => peer.practiceGroupId === item.practiceGroupId && peer.lesson.skill === 'reading' && peer.status === 'completed')));
  const training = messages('app_training')[locale];
  const combinedPeers = combinedPracticeSession ? history.filter(item => item.practiceGroupId === combinedPracticeSession.practiceGroupId) : [];
  const individualSessions = {
    reading: todayReading?.session ?? corpusPracticeHistory(individualHistory, records, activeProfile, 'reading', 'all', preferences?.reading).active,
    listening: todayListening?.session ?? corpusPracticeHistory(individualHistory, records, activeProfile, 'listening', 'all', preferences?.listening).active,
  };
  const recommendation = ([
    { skill: 'reading', progress: practiceCardProgress(individualSessions.reading ? [individualSessions.reading] : [], records) },
    { skill: 'listening', progress: practiceCardProgress(individualSessions.listening ? [individualSessions.listening] : [], records) },
    { skill: 'combined', progress: practiceCardProgress(combinedPeers, records) },
  ] as const).filter(item => item.progress.answered > 0).sort((a, b) => (b.progress.lastActivityAt ?? '').localeCompare(a.progress.lastActivityAt ?? ''))[0]?.skill;
  async function restartSelected(session: Session) {
    await restartPractice(activeProfile, session.id);
    setPracticeDetail(undefined); setCombinedDetail(undefined); setCombinedError('');
    await load();
  }
  const nav = ['today','library','settings'] as const;
  const activeNav = path === '/progress' ? 'today' : path.startsWith('/library/') ? 'library' : path.startsWith('/settings/') ? 'settings' : path.slice(1);
  return <>
    <a className="skip" href="#main" onClick={e => { e.preventDefault(); document.getElementById('main')?.focus(); }}>{t.skip}</a>
    <header className={sessionId ? 'session-header' : ''}>
      {sessionId ? <><a href="/today" onClick={e => { e.preventDefault(); void releaseSession(sessionId, owner).then(() => { setReady(false); window.history.pushState(null, '', '/today'); setPath(route()); scrollTo(0, 0); }).catch(() => setError('save')); }}>{t.leave}</a><span className="brand-symbol symbol" role="img" aria-label="Lingfern"/>{history.find(session => session.id === sessionId)?.lesson.mode === 'check' ? <span>{t.independentCheck}</span> : history.find(session => session.id === sessionId)?.lesson.mode === 'test' ? <span>{(messages('app_test')[locale])}</span> : null}</> : <>
        <a className="home-mark" href="/today" aria-label="Lingfern"><span className="brand-symbol" aria-hidden="true"/></a>
        <a className="mobile-brand" href="/today" aria-label="Lingfern"><span className="brand-symbol" aria-hidden="true"/></a>
        <nav className="desktop-nav" data-display={desktopNavDisplay} aria-label={t.navigation}>{nav.map(n => <a key={n} aria-label={t[n]} aria-current={activeNav === n ? 'page' : undefined} href={`/${n}`}><NavIcon name={n}/><span className="nav-label">{t[n]}</span></a>)}</nav>
      </>}
    </header>
    <main id="main" tabIndex={-1}>
      {!online && <p className="notice" role="status">{offlineInstalled || localCorpus || localSpoken || communityLessons.length > 0 ? t.offlineInstalled : t.offline}</p>}
      {updateAvailable && !updateDismissed && path !== '/settings' && <div className="notice update-notice"><span className="update-message" role="status">{t.updateReady}</span><div className="update-notice-actions"><button className="update-later" type="button" onClick={() => setUpdateDismissed(true)}>{t.updateLater}</button>{!sessionId && <button className="primary update-action" type="button" onClick={event => requestUpdate(event.currentTarget)}>{t.updateNow}</button>}</div></div>}
      {error && <div className="error" role="alert">{error === 'read' ? t.readError : t.saveError} <button onClick={() => void load()}>{t.retry}</button> {lesson && <button onClick={() => setUnsavedDemo(true)}>{unsavedCopy[locale].open}</button>}</div>}
      {unsavedDemo && lesson ? <UnsavedDemo lesson={lesson} locale={locale} onClose={() => setUnsavedDemo(false)}/> : !ready ? (!error && <p role="status">{t.loading}</p>) : sessionId ? <Learning key={sessionId} id={sessionId} profileId={activeProfile} locale={locale} online={online} onlineDictionary={onlineDictionary} combinedSessions={history.filter(item => item.checkGroupId || item.practiceGroupId)}/> : path === '/start' ? <FirstRun key={activeProfile} profileId={activeProfile} initial={preferences} locale={locale} onLocale={async value => { await loadInstructionLocale(value); setLocale(value); }} onSaved={setPreferences} onStart={start} reading={lesson} listening={listeningLesson} listeningReady={online || installedGroups.has('audio-a1')}/> : path === '/today' ? <>
        <div className="today-home"><div className="today-layout"><section className="hero today-hero"><p className="eyebrow"><time dateTime={todayDate}>{new Date(`${todayDate}T12:00:00`).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}</time></p><Fern key={activeProfile} profileId={activeProfile} entries={progressRecords([], history, records, summaries).valid} locale={locale}/><h1>{t.today}</h1></section>
        <section className="practice-section" aria-labelledby="practice-section-title"><header className="practice-section-heading"><h2 id="practice-section-title">{messages('app_practice')[locale]}</h2><a className="records-link" href="/progress">{messages('app_history')[locale]}</a></header>
        <div className="task-grid today-grid">{(['reading', 'listening'] as const).map(skill => {
          const choice = skill === 'reading' ? todayReading : todayListening;
          return <div className={`primary-task${skill === 'reading' ? ' reading-task' : ''}`} key={skill}>
            {choice ? <PracticeCard title={firstRunCopy[locale][skill]} locale={locale} records={records} sessions={choice.session ? [choice.session] : []} recommended={recommendation === skill} busy={starting} estimatedMinutes={choice.session ? undefined : taskMinutes(choice.lesson)} onStart={() => setPracticeDetail(choice.lesson)} onRestart={choice.session ? () => restartSelected(choice.session!) : undefined}/>
            : <CorpusPractice key={`${activeProfile}:${skill}`} preferences={preferences} skill={skill} locale={locale} profileId={activeProfile} history={history} records={records} online={online} busy={starting} recommended={recommendation === skill} onRestart={restartSelected} onStart={start} onCheck={snapshot => start(asTestLesson(snapshot))} startError={error === 'save' ? t.saveError : ''}/>}
          </div>;
        })}<div className="primary-task combined-training"><PracticeCard title={training.title} locale={locale} records={records} sessions={combinedTopicsChanged ? [] : combinedPeers} recommended={recommendation === 'combined'} busy={starting || combinedPreparing} dataSkill="combined" onStart={() => void openCombined()} onRestart={combinedPracticeSession && !combinedTopicsChanged ? () => restartSelected(combinedPracticeSession) : undefined}>
          {(['reading', 'listening'] as const).map(skill => <SettingsPicker variant="topic" displayLabel={firstRunCopy[locale][skill]} key={`${activeProfile}:${skill}`} label={skill === 'reading' ? training.readingTopic : training.listeningTopic} value={combinedTopics[skill] ?? ''} disabled={starting || combinedPreparing} options={[{ value: '', label: training.automatic }, ...topicSchema.options.map((value, index) => ({ value, label: firstRunCopy[locale].themes[index] }))]} onChange={value => { if (value === (combinedTopics[skill] ?? '')) return; setCombinedTopicsChanged(true); setCombinedDetail(undefined); setCombinedTopics(previous => ({ ...previous, [skill]: value ? topicSchema.parse(value) : undefined })); setCombinedError(''); }}/>) }
        </PracticeCard>{combinedError && <p className="practice-status" role="status">{combinedError} <a href="/library">{t.library}</a></p>}</div></div></section></div>
        <DailyQuote locale={locale} onDayChange={setTodayDate}/></div>
        
        {(communityLessons.length > 0 || catalogue.length > 0) && <TaskCatalogue key={activeProfile} startError={error === 'save' ? t.saveError : ''} profileId={activeProfile} locale={locale} lessons={[...catalogue, ...communityLessons]} history={history} records={records} online={online} installedGroups={installedGroups} localCorpus={localCorpus} localSpoken={localSpoken} busy={starting} onStart={start}/>}
        {practiceDetail && <TaskDetail key={practiceDetail.id} lesson={practiceDetail} locale={locale} profileId={activeProfile} action={t.start} busy={starting} onStart={start} onCheck={snapshot => start(asTestLesson(snapshot))} onClose={() => setPracticeDetail(undefined)} startError={error === 'save' ? t.saveError : ''} available={true}/>}
        {combinedDetail && <TaskDetail key={combinedDetail[0].id + combinedDetail[1].id} lesson={combinedDetail[0]} additionalLesson={combinedDetail[1]} heading={training.title} locale={locale} profileId={activeProfile} action={training.start} busy={starting} onStart={() => startCombinedPractice()} onCheck={() => startCombinedPractice(true)} onClose={() => { setCombinedDetail(undefined); requestAnimationFrame(() => { if (combinedInvoker.current?.isConnected && !combinedInvoker.current.matches(':disabled')) combinedInvoker.current.focus({ preventScroll: true }); }); }} startError={error === 'save' ? t.saveError : ''} available={true}/>}
      </> : path === '/progress' ? <section id="today-records">
        <a className="records-back" href="/today">← {t.today}</a>
        <h1>{t.progress}</h1><div className="progress-overview">
        <dl className="totals"><div><dt>{t.count}</dt><dd>{records.length + summaries.length + unavailableSummaries.length}</dd></div><div><dt>{t.materialCount}</dt><dd>{new Set([...records.map(r => r.rootId), ...summaries.map(row => row.event.payload.rootId), ...unavailableSummaries.map(event => event.payload.rootId)]).size}</dd></div></dl></div>
        {preferences && <p>{firstRunCopy[locale].headings[3]}: {firstRunCopy[locale].reading} {preferences.reading ?? firstRunCopy[locale].unsure} · {firstRunCopy[locale].listening} {preferences.listening ?? firstRunCopy[locale].unsure}</p>}<CompletionTiming key={activeProfile} locale={locale} profileId={activeProfile} rows={timingRows} onChange={load}/><ProgressRecords locale={locale} lessons={[...catalogue, ...communityLessons]} history={history} records={records} summaries={summaries} unavailable={unavailableSummaries} conflicts={summaryConflicts} profileId={activeProfile} onChange={load}/>{!history.length && !records.length && !summaries.length && !unavailableSummaries.length && <p className="progress-empty">{t.empty}</p>}{history.length > 0 && <h2>{t.history}</h2>}<div className="history-grid">{history.map(s => <article className="history" key={s.id}><a href={`/learn/${s.id}`}><span lang={contentText(s.lesson.title, locale) === s.lesson.title.en ? 'en' : undefined}>{contentText(s.lesson.title, locale)}</span> · {s.status === 'active' ? t.resume : t.review}</a><time>{new Date(s.startedAt).toLocaleString(locale)}</time><details><summary>{t.count}: {records.filter(r => r.sessionId === s.id).length}</summary>{(s.lesson.mode === 'check' || s.lesson.mode === 'test') && s.status === 'active' ? <p>{t.checkResponseSaved}</p> : records.filter(r => r.sessionId === s.id).map(r => {
          const item = questions(s.lesson).find(item => item.question.id === r.questionId);
          return item && <section key={r.id}>{s.status !== 'active' && <DeleteRecord locale={locale} profileId={activeProfile} recordId={r.syncRecordId ?? r.id} onChange={load}/>}<h3 lang="en">{item.question.prompt}</h3><p>{t.yourAnswer}: <span lang="en">{answerText(item.question, r.answer)}</span> · <span className="result-status" data-result={r.correct === null ? undefined : r.correct ? 'correct' : 'incorrect'}>{r.correct === null ? t.unscored : r.correct ? `✓ ${t.correct}` : `× ${t.incorrect}`}</span></p><p lang={instructionLanguage(explanationText(item.question, r.answer, practiceLocale(s.lesson, locale)), practiceLocale(s.lesson, locale))}>{translateInstruction(explanationText(item.question, r.answer, practiceLocale(s.lesson, locale)), practiceLocale(s.lesson, locale))}</p><p>{t.conditions}: {r.assistance.hintLevel}/3{teachingSupport(s.lesson, r.rootId, r.assistance.teachingProvided) ? ` · ${t.teachingProvided}` : ""}{r.assistance.dictionaryUsed ? ` · ${t.dictionaryUsed}` : ""}</p>{s.lesson.skill === 'listening' && <p>{t.playbackRequests}: {r.assistance.playbackRequests ?? 0}</p>}<time>{new Date(r.submittedAt).toLocaleString(locale)}</time></section>;
        })}<GutenbergLicence sourceUrl={s.lesson.materials.find(material => isGutenbergSource(material.credit?.sourceUrl))?.credit?.sourceUrl} locale={locale}/></details></article>)}</div>
        </section> : path === '/library' ? <div className="library-page"><div className="library-page-heading"><h1>{t.library}</h1><div className="library-history-entry"><a className="records-link" href="/library/history">{lookupHistoryCopy[locale].entry}</a></div></div><section className="library-references"><h2>{t.references}</h2>{[
          { path: 'dictionary', title: t.dictionaryEntry },
          { path: 'ipa', title: t.ipa },
          { path: 'grammar', title: t.grammar },
        ].map(reference => <a className="library-reference-tile" key={reference.path} href={`/library/${reference.path}`}>{reference.title}</a>)}</section><OfflineInstall key={activeProfile} profileId={activeProfile} locale={locale} online={online} onReady={ready => { setOfflineInstalled(ready); void installedOfflineGroups().then(setInstalledGroups).catch(() => {}); }}/><InstalledResources locale={locale} profileId={activeProfile}/><CommunityImport locale={locale} profileId={activeProfile} onInstalled={() => void load()}/></div>
      : path === '/library/history' ? <LookupHistory key={activeProfile} locale={locale} profileId={activeProfile}/>
      : path === '/library/dictionary' ? <div className="library-page"><Dictionary key={`${activeProfile}:${pageSearch}`} locale={locale} online={online} defaultId={onlineDictionary} profileId={activeProfile} initialQuery={lookupQuery} standalone/></div>
      : path === '/library/saved' ? <div className="library-page"><SavedWords key={activeProfile} locale={locale} profileId={activeProfile} online={online} defaultId={onlineDictionary}/></div>
      : path === '/library/ipa' ? <IpaChart key={`${activeProfile}:${pageSearch}`} locale={locale} profileId={activeProfile} initialQuery={lookupQuery}/>
      : path === '/library/grammar' ? <GrammarLookup key={`${activeProfile}:${pageSearch}`} locale={locale} online={online} profileId={activeProfile} initialQuery={lookupQuery}/>
      : path === '/settings/about' ? <About/>
      : path === '/settings' ? <section className="settings-page">
        <h1>{t.settings}</h1>
        <section className="settings-preferences settings-group" aria-labelledby="settings-preferences-title">
          <h2 id="settings-preferences-title">{t.preferences}</h2>
          <div className="settings-group-list">
            <div className="settings-language settings-card"><SettingsPicker label={t.language} value={locale} options={languageOptions} onChange={value => void setting('locale', value)}/></div>
            <div className="settings-appearance settings-card">
              <SettingsPicker label={t.theme} value={theme} options={[{ value: 'system', label: t.system }, { value: 'light', label: t.light }, { value: 'dark', label: t.dark }]} onChange={value => void setting('theme', value)}/>
              <SettingsPicker label={t.desktopNavDisplay} value={desktopNavDisplay} options={[{ value: 'text', label: t.navText }, { value: 'icon', label: t.navIcons }, { value: 'both', label: t.navBoth }]} onChange={value => void setting('desktopNavDisplay', value)}/>
              <SettingsPicker label={t.mobileNavDisplay} value={mobileNavDisplay} options={[{ value: 'text', label: t.navText }, { value: 'icon', label: t.navIcons }, { value: 'both', label: t.navBoth }]} onChange={value => void setting('mobileNavDisplay', value)}/>
            </div>
            <div className="settings-dictionary-row settings-card">
              <SettingsPicker label={t.defaultOnlineDictionary} description={t.onlineLookupPrivacy} value={onlineDictionary} options={onlineDictionaries.map(dictionary => ({ value: dictionary.id, label: dictionary.shortName }))} onChange={value => void setting('onlineDictionary', value)}/>
            </div>
            <a className="setting settings-start-link settings-card" href="/start"><span>{firstRunCopy[locale].edit}</span><span aria-hidden="true">→</span></a>
          </div>
        </section>
        
        
        <div className="settings-data settings-service-groups">
          <GithubIdentity locale={locale} profileId={logicalProfile} localProfileId={activeProfile} onProfileChange={load}/>
          <SyncConflicts locale={locale} profileId={activeProfile}/>
          <ProfileBackup locale={locale} activeProfile={activeProfile} onProfileChange={load}/>
        </div><section className="settings-update settings-card settings-about-update" aria-label={t.softwareUpdate}>
          <button className="update-action settings-about-row settings-update-row" type="button" disabled={updateCheck === 'checking'} aria-disabled={updateCheck === 'checking'} aria-busy={updateCheck === 'checking'} aria-label={updateAvailable ? t.updateNow : t.checkUpdate} aria-describedby="settings-update-value" data-update-ready={updateAvailable} onClick={event => { if (updateAvailable) requestUpdate(event.currentTarget); else void checkForUpdates(); }}>
            <span>{t.checkUpdate}</span>
            <span id="settings-update-value" className="settings-update-value" role="status" aria-live="polite" data-update-ready={updateAvailable && !updateBlocked}>
              {updateCheck === 'checking' && <svg className="settings-update-spinner" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity=".3"/><path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}
              {updateCheck === 'checking' ? t.updateChecking : updateBlocked ? t.updateBlocked : updateAvailable ? t.updateNow : updateCheck === 'current' ? t.updateCurrent : updateCheck === 'offline' ? t.updateOffline : updateCheck === 'unavailable' ? t.updateUnavailable : updateCheck === 'failed' ? t.updateFailed : `v${appVersion.split('.').slice(0, 2).join('.')}`}
            </span>
          </button>
          <a className="settings-about-row settings-about-link" href="/settings/about"><span>{t.about}</span><span aria-hidden="true">→</span></a>
        </section>
      </section> : <><h1>{t.unsupported}</h1><a href="/today">{t.finish}</a></>}
    </main>
    {confirmUpdate && createPortal(<dialog ref={updateDialog} className="update-confirm-dialog" aria-labelledby="update-confirm-title" aria-describedby="update-confirm-description" onCancel={event => { event.preventDefault(); closeUpdate(); }} onClick={event => { if (event.target === event.currentTarget) closeUpdate(); }}>
      <h2 id="update-confirm-title">{t.updateConfirm}</h2><p id="update-confirm-description">{t.updateConfirmDetail}</p>
      {updateCheck === 'failed' && <p role="alert">{t.updateFailed}</p>}
      {updateBlocked && <p className="error" role="alert">{t.updateBlocked}</p>}
      <div className="update-confirm-actions"><button ref={updateCancel} type="button" disabled={applyingUpdate} onClick={closeUpdate}>{t.updateCancel}</button><button className="primary" type="button" disabled={applyingUpdate} aria-busy={applyingUpdate} onClick={() => void applyUpdate()}>{t.updateNow}</button></div>
    </dialog>, document.body)}
    {!sessionId && path !== '/start' && <nav className="mobile-nav" data-display={mobileNavDisplay} aria-label={t.navigation}>{nav.map(n => <a key={n} aria-label={t[n]} aria-current={activeNav === n ? 'page' : undefined} href={`/${n}`}><NavIcon name={n}/><span className="nav-label">{t[n]}</span></a>)}</nav>}
  </>;
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

function Learning({ id, profileId, locale, online, onlineDictionary, combinedSessions }: { id: string; profileId: string; locale: Locale; online: boolean; onlineDictionary: OnlineDictionaryId; combinedSessions: Session[] }) {
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
  const [blurBackground, setBlurBackground] = useState(true);
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
    const trackPointer = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const card = document.getElementById('learning-question')?.getBoundingClientRect();
      if (card) setBlurBackground(event.clientX >= card.left && event.clientX <= card.right && event.clientY >= card.top && event.clientY <= card.bottom);
    };
    document.addEventListener('keydown', close);
    document.addEventListener('pointermove', trackPointer);
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointermove', trackPointer); };
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
    if (nextPane === 'question') setBlurBackground(true);
    setPane(nextPane);
  }
  const message = error === 'CHECK_EXPOSED' ? t.checkUnavailable : error === 'CHECK_DEVICE' ? t.checkOriginalDevice : error === 'NO_AUDIO' ? t.listenFirst : error === 'BUSY' ? t.busy : error === 'NOT_FOUND' ? t.missing : error === 'CONFLICT' ? t.conflict : error === 'INVALID_ANSWER' ? t.invalidAnswer : error === 'READ' ? t.readError : t.saveError;
  const all = session ? questions(session.lesson) : [];
  const current = session ? all[session.position] : undefined;
  useQuestionSheetLayout(`${current?.material.id}:${session?.status}:${session?.checkStartedAt}:${locale}`, !!session && session.lesson.skill !== 'listening' && session.lesson.organization !== 'material-v1', mobile, pane === 'question');
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
    {mobile && !listening && <button className="question-sheet-scrim" type="button" aria-label={listening ? t.listening : t.material} aria-hidden={pane !== 'question'} tabIndex={pane === 'question' ? 0 : -1} data-open={pane === 'question'} data-blur={blurBackground} onClick={() => showPane('material')}/>}
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
