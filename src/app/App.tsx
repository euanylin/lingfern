import { Component, lazy, startTransition, Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { liveQuery } from 'dexie';
import { registerSW } from 'virtual:pwa-register';
import { version as appVersion } from '../../package.json';
import { localDay } from '../core/dailyQuoteSelection';
import { communityPackageReady } from '../data/communityInstall';
import type { CompletionTime } from '../data/completionTiming';
import { attempts, bootstrapSyncEvents, communityPacks, createCombinedPractice, createSession, db, profiles, projectPreferences, releaseSession, saveSetting, sessions, settings, syncClocks, type Attempt, type Session } from '../data/db';
import { purgeDeletedRecords, restartPractice } from '../data/deletion';
import { installedOfflineGroups } from '../data/offline';
import { readInstallationIntents } from '../data/installationIntent';
import { activeCorpusPractice, selectPractice } from '../data/practice';
import { mergeLearningRecords, progressRecords, type CompletionSummary, type ResolvedSummary } from '../data/progress';
import { installedSourcePacks } from '../data/sourcePacks';
import { readSyncEvents } from '../data/sync';
import { startSyncSchedule } from '../data/syncSchedule';
import { languageOptions, loadUiLocale, messages } from '../locales';
import { loadInstructionLocale } from '../locales/teaching';
import { asTestLesson, type Lesson, type Locale } from '../shared/content';
import { localeDirection, localeSchema } from '../shared/locale';
import { automaticPractice, practiceSelectionMatches, readPracticeSelection, type PracticeSelection } from '../shared/practiceSelection';
import { preferencesSchema, type Preferences } from '../shared/preferences';
import { CorpusPractice, prepareCorpusPractice } from './CorpusPractice';
import { DailyQuote, type DailyQuoteSelection } from './DailyQuote';
import { Fern } from './Fern';
import { FirstRun, firstRunCopy } from './FirstRun';
import { copy, initialLocale } from './i18n';
import { NavIcon } from './NavIcon';
import { defaultOnlineDictionary, onlineDictionaries, type OnlineDictionaryId } from './onlineDictionaries';
import { PracticeCard, practiceCardProgress } from './PracticeCard';
import { PracticeOptions } from './PracticeOptions';
import { scrollbarVisibility } from './scrollbarVisibility';
import { activateWaitingUpdate } from './serviceWorkerUpdate';
import { SettingsPicker } from './SettingsPicker';
import { TaskCatalogue } from './TaskCatalogue';
import { TaskDetail } from './TaskDetail';
import { touchFeedback } from './touchFeedback';
import { useGithubSession } from './useGithubSession';

const Welcome = lazy(() => import('./Welcome').then(module => ({ default: module.Welcome })));
const IpaChart = lazy(() => import('./IpaChart').then(module => ({ default: module.IpaChart })));
const About = lazy(() => import('./About').then(module => ({ default: module.About })));
const Learning = lazy(() => import('./Learning'));
const GithubIdentity = lazy(() => import('./GithubIdentity').then(module => ({ default: module.GithubIdentity })));
const ProfileBackup = lazy(() => import('./ProfileBackup').then(module => ({ default: module.ProfileBackup })));
const Dictionary = lazy(() => import('./Dictionary').then(module => ({ default: module.Dictionary })));
const GrammarLookup = lazy(() => import('./GrammarLookup').then(module => ({ default: module.GrammarLookup })));
const SavedWords = lazy(() => import('./SavedWords').then(module => ({ default: module.SavedWords })));
const ProgressRecords = lazy(() => import('./ProgressRecords').then(module => ({ default: module.ProgressRecords })));
const CompletionTiming = lazy(() => import('./CompletionTiming').then(module => ({ default: module.CompletionTiming })));
const SessionHistory = lazy(() => import('./SessionHistory').then(module => ({ default: module.SessionHistory })));
const SyncConflicts = lazy(() => import('./SyncConflicts').then(module => ({ default: module.SyncConflicts })));
const OfflineInstall = lazy(() => import('./OfflineInstall').then(module => ({ default: module.OfflineInstall })));
const CommunityImport = lazy(() => import('./CommunityImport').then(module => ({ default: module.CommunityImport })));
const InstalledResources = lazy(() => import('./CommunityImport').then(module => ({ default: module.InstalledResources })));
const LookupHistory = lazy(() => import('./LookupHistory').then(module => ({ default: module.LookupHistory })));
const UnsavedDemo = lazy(() => import('./UnsavedDemo').then(module => ({ default: module.UnsavedDemo })));
const lookupHistoryCopy = messages('lookupHistory_lookupHistoryCopy');
const unsavedCopy = messages('unsavedDemo_unsavedCopy');

const { catalogue } = import.meta.env.MODE === 'test-fixtures'
  ? await import('../../tests/fixtures/catalogue')
  : { catalogue: [] as Lesson[] };
const lesson = catalogue.find(item => item.targetLevel === 'A1' && item.skill === 'reading');
const listeningLesson = catalogue.find(item => item.targetLevel === 'A1' && item.skill === 'listening');
const owner = crypto.randomUUID();
let firstEntry = location.pathname === '/';
const route = () => location.pathname === '/' ? '/today' : location.pathname;
const pageRoute = (path: string) => /^\/(introduction|start|today|progress|library(?:\/(?:dictionary|saved|ipa|grammar|history))?|settings(?:\/about)?|learn\/[^/]+)$/.test(path);
type NavDisplay = 'text' | 'icon' | 'both';
const navDisplay = (value?: string): value is NavDisplay => value === 'text' || value === 'icon' || value === 'both';
function welcomeSeen() {
  try { return localStorage.getItem('lingfern.onboarding.seen') === '1'; }
  catch { return true; }
}

export function App() {
  useEffect(touchFeedback, []);
  useEffect(scrollbarVisibility, []);
  const [path, setPath] = useState(route);
  const githubSession = useGithubSession(path === '/settings');
  const currentPath = useRef(path); currentPath.current = path;
  const [todayDate, setTodayDate] = useState(() => localDay(new Date()));
  const todayQuote = useRef<DailyQuoteSelection>(undefined);
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
  const [combinedDetail, setCombinedDetail] = useState<[Lesson, Lesson]>();
  const combinedInvoker = useRef<HTMLElement | null>(null);
  const [combinedPreparing, setCombinedPreparing] = useState(false);
  const [combinedError, setCombinedError] = useState('');
  const [practiceSelections, setPracticeSelections] = useState<Record<'reading' | 'listening', PracticeSelection>>({ reading: automaticPractice, listening: automaticPractice });
  const [combinedTopicsChanged, setCombinedTopicsChanged] = useState(false);
  const [history, setHistory] = useState<Session[]>([]);
  const [pageSearch, setPageSearch] = useState(location.search);
  const resetNavigationScroll = useRef(false);
  useLayoutEffect(() => { if (resetNavigationScroll.current) { resetNavigationScroll.current = false; scrollTo(0, 0); } }, [path, pageSearch]);
  useEffect(() => {
    if (!ready || path !== '/settings' || location.hash !== '#mcp') return;
    const locate = () => { const target = document.getElementById('mcp'); target?.scrollIntoView(); return !!target; };
    if (locate()) return;
    // The lazy identity card may mount after the browser's initial fragment scroll.
    const observer = new MutationObserver(() => { if (locate()) observer.disconnect(); });
    observer.observe(document.getElementById('main')!, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [path, ready]);
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
  const [offlineSnapshot, setOfflineSnapshot] = useState<{ profileId: string; groups: Set<string>; intents: Awaited<ReturnType<typeof readInstallationIntents>> }>();
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
  const loadRevision = useRef(0);
  async function load(rejectFailure = false) {
    const current = ++loadRevision.current;
    setError('');
    try {
      const profileId = await db.transaction('rw', profiles, settings, async () => {
        const selected = (await settings.get('activeProfile'))?.value;
        let profile = selected ? await profiles.get(selected) : undefined;
        profile ??= await profiles.toCollection().first();
        if (!profile) {
          profile = { id: 'local-guest', name: 'Local profile', createdAt: new Date().toISOString() };
          await profiles.add(profile);
        }
        if (selected !== profile.id) await settings.put({ key: 'activeProfile', value: profile.id });
        return profile.id;
      });
      await bootstrapSyncEvents(profileId).catch(() => { if (current === loadRevision.current) setError('save'); });
      await purgeDeletedRecords(profileId);
      const [all, answers, imported] = await Promise.all([sessions.where('profileId').equals(profileId).toArray(), attempts.where('profileId').equals(profileId).toArray(), communityPacks.where('profileId').equals(profileId).filter(pack => pack.state === 'ready').toArray()]);
      const available = await Promise.all(imported.map(async pack => ({ pack, ready: await communityPackageReady(pack) })));
      if (current !== loadRevision.current) return;
      const importedLessons = available.filter(item => item.ready).flatMap(item => item.pack.lessons);
      setCommunityLessons(importedLessons);
      setLocalCorpus(available.some(item => item.ready && !!item.pack.corpus?.records.length));
      setLocalSpoken(available.some(item => item.ready && !!item.pack.spoken?.records.length));
      const effective = await mergeLearningRecords([...catalogue, ...importedLessons], all, answers, await readSyncEvents(profileId, db, ['completion', 'completion_timing', 'deletion']));
      const logicalProfileId = (await syncClocks.get(profileId))?.logicalProfileId ?? profileId;
      if (current !== loadRevision.current) return;
      setTimingRows(effective.timingRows); setSummaries(effective.summaries); setUnavailableSummaries(effective.unavailable); setSummaryConflicts(effective.conflicting.size);
      setActiveProfile(profileId);
      setLogicalProfile(logicalProfileId);
      const { preferences: storedPreferences, values: savedValues } = await projectPreferences(profileId);
      if (current !== loadRevision.current) return;
      setPreferences(storedPreferences ? preferencesSchema.parse(storedPreferences) : undefined);
      const showFirstRun = firstEntry && !storedPreferences?.completed && !all.length;
      firstEntry = false;
      if (showFirstRun) { const next = !storedPreferences && !welcomeSeen() ? '/introduction' : '/start'; window.history.replaceState(null, '', next); setPath(next); }
      else if (location.pathname === '/') { window.history.replaceState(null, '', '/today'); setPath('/today'); }
      const language = localeSchema.safeParse(savedValues.get('locale'));
      const nextLocale = language.success ? language.data : initialLocale();
      await Promise.all([loadUiLocale(nextLocale), loadInstructionLocale(nextLocale)]);
      if (current !== loadRevision.current) return;
      setLocale(nextLocale);
      const appearance = savedValues.get('theme');
      setTheme(appearance && ['system','light','dark'].includes(appearance) ? appearance : 'system');
      const desktopDisplay = savedValues.get('desktopNavDisplay');
      const mobileDisplay = savedValues.get('mobileNavDisplay');
      setDesktopNavDisplay(navDisplay(desktopDisplay) ? desktopDisplay : 'text');
      setMobileNavDisplay(navDisplay(mobileDisplay) ? mobileDisplay : 'both');
      setOnlineDictionary(defaultOnlineDictionary(savedValues.get('onlineDictionary')));
      setPracticeSelections({ reading: readPracticeSelection(savedValues.get('readingPractice')), listening: readPracticeSelection(savedValues.get('listeningPractice')) });
      setHistory(all.sort((a,b) => b.startedAt.localeCompare(a.startedAt))); setRecords(effective.records); setReady(true);
    } catch { if (current === loadRevision.current) { setError('read'); setReady(false); } if (rejectFailure) throw new Error('SYNC_APPLY_FAILED'); }
  }
  const syncLoad = useRef(load); syncLoad.current = load;
  useEffect(() => {
    const summary = githubSession.summary;
    return ready && githubSession.status === 'ready' && summary?.account ? startSyncSchedule(activeProfile, () => syncLoad.current(true), summary) : undefined;
  }, [activeProfile, ready, githubSession.status, githubSession.summary]);
  useEffect(() => {
    const navigate = (event?: PopStateEvent) => { const next = route(); resetNavigationScroll.current = !event; if (next !== currentPath.current && currentPath.current.startsWith('/learn/')) setReady(false); startTransition(() => { setPath(next); setPageSearch(location.search); }); };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>('a[href^="/"]');
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href);
      if (url.origin !== location.origin || !pageRoute(url.pathname) || url.hash) return;
      event.preventDefault();
      if (url.pathname === location.pathname && url.search === location.search) return;
      window.history.pushState(null, '', url.pathname + url.search);
      navigate();
    };
    const network = () => setOnline(navigator.onLine);
    document.addEventListener('click', click); addEventListener('popstate', navigate); addEventListener('online', network); addEventListener('offline', network);
    return () => { document.removeEventListener('click', click); removeEventListener('popstate', navigate); removeEventListener('online', network); removeEventListener('offline', network); };
  }, []);
  useEffect(() => { void load(); }, [path]);
  useEffect(() => {
    if (!ready) return;
    const observer = liveQuery(async () => ({ profile: await profiles.get(activeProfile), selected: (await settings.get('activeProfile'))?.value })).subscribe({ next({ profile, selected }) {
      if (!profile || selected !== activeProfile) void syncLoad.current();
    }, error() { setError('read'); } });
    return () => observer.unsubscribe();
  }, [activeProfile, ready]);
  useEffect(() => {
    registerSW({ onNeedRefresh: () => { setUpdateAvailable(true); setUpdateDismissed(false); } });
  }, []);
  useEffect(() => {
    let live = true, revision = 0;
    const refresh = () => {
      const current = ++revision;
      void Promise.all([installedOfflineGroups(), installedSourcePacks(activeProfile), readInstallationIntents(activeProfile)]).then(([groups, sources, intents]) => {
        if (!live || current !== revision) return;
        setInstalledGroups(groups); setOfflineInstalled(groups.size + sources.size > 0);
        setOfflineSnapshot({ profileId: activeProfile, groups: new Set([...groups, ...sources]), intents });
      }).catch(() => { if (live && current === revision) setOfflineSnapshot(undefined); });
    };
    refresh();
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('lingfern-resources') : undefined;
    if (channel) channel.onmessage = refresh;
    window.addEventListener('lingfern-resources-installed', refresh);
    return () => { live = false; channel?.close(); window.removeEventListener('lingfern-resources-installed', refresh); };
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
    try { if (key === 'locale') { await Promise.all([loadUiLocale(value as Locale), loadInstructionLocale(value as Locale)]); if (request !== localeRequest.current) return; } await saveSetting(activeProfile, key, value); if (key === 'locale') setLocale(value as Locale); else if (key === 'theme') setTheme(value); else if (key === 'desktopNavDisplay' && navDisplay(value)) setDesktopNavDisplay(value); else if (key === 'mobileNavDisplay' && navDisplay(value)) setMobileNavDisplay(value); else if (key === 'onlineDictionary') setOnlineDictionary(defaultOnlineDictionary(value)); if (key !== 'locale' || request === localeRequest.current) setError(''); }
    catch { if (key !== 'locale' || request === localeRequest.current) setError('save'); }
  }
  async function start(selected: Lesson) {
    setStarting(true); setError('');
    try {
      if (selected.mode === 'check') throw new Error('CHECK_UNAVAILABLE');
      const prior = history.find(s => s.status === 'active' && s.lesson.id === selected.id && s.lesson.mode === selected.mode && (!selected.mode || JSON.stringify(s.lesson) === JSON.stringify(selected)));
      const frozenTest = selected.mode === 'test' && history.some(s => !s.lesson.mode && s.lesson.id === selected.id && JSON.stringify(asTestLesson(s.lesson)) === JSON.stringify(selected));
      const prepared = prior || frozenTest ? selected : (await import('../core/practiceOrganization')).organizePractice(selected);
      const session = prior ?? await createSession(prepared, activeProfile);
      if (window.history.state?.practicePreview) window.history.replaceState(null, '', `/learn/${session.id}`); else window.history.pushState(null, '', `/learn/${session.id}`);
      setCombinedDetail(undefined); setPath(route()); scrollTo(0, 0);
    }
    catch { setError('save'); } finally { setStarting(false); }
  }
  async function savePracticeSelection(skill: 'reading' | 'listening', value: PracticeSelection) {
    await saveSetting(activeProfile, `${skill}Practice`, JSON.stringify(value));
    setPracticeSelections(previous => ({ ...previous, [skill]: value }));
    setCombinedTopicsChanged(true); setCombinedDetail(undefined); setCombinedError('');
  }
  async function openCombined(reselect = false) {
    combinedInvoker.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCombinedPreparing(true); setCombinedError('');
    try {
      if (combinedPracticeSession?.lesson.mode === 'test' && !reselect && !combinedTopicsChanged && combinedPeers.every(session => practiceSelectionMatches(session.lesson, practiceSelections[session.lesson.skill]))) {
        window.history.pushState(null, '', `/learn/${combinedPracticeSession.id}`); setPath(route()); scrollTo(0, 0);
      } else if (combinedPracticeSession && !reselect && !combinedTopicsChanged && combinedPeers.every(session => practiceSelectionMatches(session.lesson, practiceSelections[session.lesson.skill]))) {
        const pair = history.filter(item => item.practiceGroupId === combinedPracticeSession.practiceGroupId);
        setCombinedDetail([pair.find(item => item.lesson.skill === 'reading')!.lesson, pair.find(item => item.lesson.skill === 'listening')!.lesson]);
      } else {
        const reading = await prepareCorpusPractice({ locale, profileId: activeProfile, preferences, history, records, online, skill: 'reading', selection: practiceSelections.reading });
        if (!reading.lesson) { setCombinedError(practiceSelections.reading.kinds.length || practiceSelections.reading.materials.length ? messages('practiceOptions')[locale].unsuitable : practiceSelections.reading.topics.length ? training.readingEmpty : t.checkInsufficient); return; }
        const listening = await prepareCorpusPractice({ locale, profileId: activeProfile, preferences, history, records, online, skill: 'listening', selection: practiceSelections.listening, previewRoots: new Set(reading.lesson.materials.map(material => material.rootId)) });
        if (!listening.lesson) { setCombinedError(practiceSelections.listening.kinds.length || practiceSelections.listening.materials.length ? messages('practiceOptions')[locale].unsuitable : practiceSelections.listening.topics.length ? training.listeningEmpty : t.checkInsufficient); return; }
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
    reading: todayReading?.session ?? activeCorpusPractice(individualHistory, activeProfile, 'reading'),
    listening: todayListening?.session ?? activeCorpusPractice(individualHistory, activeProfile, 'listening'),
  };
  const recommendation = ([
    { skill: 'reading', progress: practiceCardProgress(individualSessions.reading ? [individualSessions.reading] : [], records) },
    { skill: 'listening', progress: practiceCardProgress(individualSessions.listening ? [individualSessions.listening] : [], records) },
    { skill: 'combined', progress: practiceCardProgress(combinedPeers, records) },
  ] as const).filter(item => item.progress.answered > 0).sort((a, b) => (b.progress.lastActivityAt ?? '').localeCompare(a.progress.lastActivityAt ?? ''))[0]?.skill;
  async function restartSelected(session: Session) {
    await restartPractice(activeProfile, session.id);
    setCombinedDetail(undefined); setCombinedError('');
    await load();
  }
  const nav = ['today','library','settings'] as const;
  const activeNav = path === '/progress' ? 'today' : path.startsWith('/library/') ? 'library' : path.startsWith('/settings/') ? 'settings' : path.slice(1);
  const introducing = path === '/introduction';
  const entryPending = location.pathname === '/' && !ready && !error;
  useLayoutEffect(() => {
    const header = document.querySelector<HTMLElement>('#root>header'), root = document.documentElement;
    if (!header) return;
    let frame = 0;
    const observer = new ResizeObserver(([entry]) => {
      const height = `${Math.ceil(entry.borderBoxSize?.[0]?.blockSize ?? header.offsetHeight)}px`;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { if (root.style.getPropertyValue('--site-header-height') !== height) root.style.setProperty('--site-header-height', height); });
    });
    observer.observe(header);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); root.style.removeProperty('--site-header-height'); };
  }, [introducing, entryPending]);
  const settingsPage = <section className="settings-page">
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
          <PageBoundary locale={locale}><Suspense fallback={<p className="sr-only" role="status">{t.loading}</p>}><GithubIdentity session={githubSession} locale={locale} profileId={logicalProfile} localProfileId={activeProfile} onProfileChange={load}/></Suspense></PageBoundary>
          <SyncConflicts locale={locale} profileId={activeProfile}/>
          <PageBoundary locale={locale}><Suspense fallback={<p className="sr-only" role="status">{t.loading}</p>}><ProfileBackup locale={locale} activeProfile={activeProfile} onProfileChange={load}/></Suspense></PageBoundary>
        </div><section className="settings-update settings-card settings-about-update" aria-label={t.softwareUpdate}>
          <button className="update-action settings-about-row settings-update-row" type="button" disabled={updateCheck === 'checking'} aria-disabled={updateCheck === 'checking'} aria-busy={updateCheck === 'checking'} data-update-ready={updateAvailable} onClick={event => { if (updateAvailable) requestUpdate(event.currentTarget); else void checkForUpdates(); }}>
            <span>{t.checkUpdate}</span>
            <span id="settings-update-value" className="settings-update-value" role="status" aria-live="polite" data-update-ready={updateAvailable && !updateBlocked}>
              {updateCheck === 'checking' && <svg className="settings-update-spinner" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity=".3"/><path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}
              {updateCheck === 'checking' ? t.updateChecking : updateBlocked ? t.updateBlocked : updateAvailable ? t.updateNow : updateCheck === 'current' ? t.updateCurrent : updateCheck === 'offline' ? t.updateOffline : updateCheck === 'unavailable' ? t.updateUnavailable : updateCheck === 'failed' ? t.updateFailed : `v${appVersion.split('.').slice(0, 2).join('.')}`}
            </span>
          </button>
          <a className="settings-about-row settings-about-link" href="/settings/about"><span>{t.about}</span><span aria-hidden="true">→</span></a>
        </section>
      </section>;
  function beginFirstRun() { try { localStorage.setItem('lingfern.onboarding.seen', '1'); } catch { /* Continue when persistent storage is unavailable. */ } window.history.pushState(null, '', '/start'); setPath('/start'); scrollTo(0, 0); }
  return <>
    <a className="skip" href="#main" onClick={e => { e.preventDefault(); document.getElementById('main')?.focus(); }}>{t.skip}</a>
    {!introducing && !entryPending && <header className={sessionId ? 'session-header' : ''}>
      {sessionId ? <><a href="/today" onClick={e => { e.preventDefault(); void releaseSession(sessionId, owner).then(() => { setReady(false); window.history.pushState(null, '', '/today'); setPath(route()); scrollTo(0, 0); }).catch(() => setError('save')); }}>{t.leave}</a><span className="brand-symbol symbol" role="img" aria-label="Lingfern"/>{history.find(session => session.id === sessionId)?.lesson.mode === 'check' ? <span>{t.independentCheck}</span> : history.find(session => session.id === sessionId)?.lesson.mode === 'test' ? <span>{(messages('app_test')[locale])}</span> : null}</> : <>
        <a className="home-mark" href="/today" aria-label="Lingfern"><span className="brand-symbol" aria-hidden="true"/></a>
        <a className="mobile-brand" href="/today" aria-label="Lingfern"><span className="brand-symbol" aria-hidden="true"/></a>
        <nav className="desktop-nav" data-display={desktopNavDisplay} aria-label={t.navigation}>{nav.map(n => <a key={n} aria-label={t[n]} aria-current={activeNav === n ? 'page' : undefined} href={`/${n}`}><NavIcon name={n}/><span className="nav-label">{t[n]}</span></a>)}</nav>
      </>}
    </header>}
    <main id="main" tabIndex={-1} className={introducing ? 'welcome-main' : undefined}>
      {!online && <p className="notice" role="status">{offlineInstalled || localCorpus || localSpoken || communityLessons.length > 0 ? t.offlineInstalled : t.offline}</p>}
      {updateAvailable && !updateDismissed && path !== '/settings' && <div className="notice update-notice"><span className="update-message" role="status">{t.updateReady}</span><div className="update-notice-actions"><button className="update-later" type="button" onClick={() => setUpdateDismissed(true)}>{t.updateLater}</button>{!sessionId && <button className="primary update-action" type="button" onClick={event => requestUpdate(event.currentTarget)}>{t.updateNow}</button>}</div></div>}
      {error && <div className="error" role="alert">{error === 'read' ? t.readError : t.saveError} <button onClick={() => void load()}>{t.retry}</button> {lesson && <button onClick={() => setUnsavedDemo(true)}>{unsavedCopy[locale].open}</button>}</div>}
      <Suspense fallback={<p className="sr-only" role="status">{t.loading}</p>}><PageBoundary key={path} locale={locale}>
      {unsavedDemo && lesson ? <UnsavedDemo lesson={lesson} locale={locale} onClose={() => setUnsavedDemo(false)}/> : !ready ? (!error && <p className="sr-only" role="status">{t.loading}</p>) : sessionId ? <Learning owner={owner} key={sessionId} id={sessionId} profileId={activeProfile} locale={locale} online={online} onlineDictionary={onlineDictionary} combinedSessions={history.filter(item => item.checkGroupId || item.practiceGroupId)}/> : introducing ? <Suspense fallback={<p className="sr-only" role="status">{t.loading}</p>}><Welcome locale={locale} profileId={activeProfile} date={todayDate} onDayChange={setTodayDate} onContinue={beginFirstRun} settings={settingsPage}/></Suspense> : path === '/start' ? <FirstRun key={activeProfile} profileId={activeProfile} initial={preferences} locale={locale} onLocale={async value => { await Promise.all([loadUiLocale(value), loadInstructionLocale(value)]); setLocale(value); }} onSaved={setPreferences} onStart={start} reading={lesson} listening={listeningLesson} listeningReady={online || installedGroups.has('audio-a1')}/> : path === '/today' ? <>
        <div className="today-home"><div className="today-layout"><section className="hero today-hero"><p className="eyebrow"><time dateTime={todayDate}>{new Date(`${todayDate}T12:00:00`).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}</time></p><Fern key={activeProfile} profileId={activeProfile} entries={progressRecords([], history, records, summaries).valid} locale={locale}/><h1>{t.today}</h1></section>
        <section className="practice-section" aria-labelledby="practice-section-title"><header className="practice-section-heading"><h2 id="practice-section-title">{messages('app_practice')[locale]}</h2><a className="records-link" href="/progress">{messages('app_history')[locale]}</a></header>
        <div className="task-grid today-grid">{(['reading', 'listening'] as const).map(skill => {
          const choice = skill === 'reading' ? todayReading : todayListening;
          return <div className={`primary-task${skill === 'reading' ? ' reading-task' : ''}`} key={skill}>
            <CorpusPractice key={`${activeProfile}:${skill}`} fallback={choice ?? undefined} selection={practiceSelections[skill]} onSelection={value => savePracticeSelection(skill, value)} preferences={preferences} skill={skill} locale={locale} profileId={activeProfile} history={history} records={records} online={online} busy={starting} recommended={recommendation === skill} onRestart={restartSelected} onStart={start} onCheck={snapshot => start(asTestLesson(snapshot))} startError={error === 'save' ? t.saveError : ''}/>
          </div>;
        })}<div className="primary-task combined-training"><PracticeCard title={training.title} locale={locale} records={records} sessions={combinedTopicsChanged ? [] : combinedPeers} recommended={recommendation === 'combined'} busy={starting || combinedPreparing} dataSkill="combined" onStart={() => void openCombined()} onRestart={combinedPracticeSession && !combinedTopicsChanged ? () => restartSelected(combinedPracticeSession) : undefined}>
          {(['reading', 'listening'] as const).map(skill => <PracticeOptions history={history} records={records} key={`${activeProfile}:${skill}`} locale={locale} profileId={activeProfile} skill={skill} preferences={preferences} value={practiceSelections[skill]} disabled={starting || combinedPreparing} onChange={value => savePracticeSelection(skill, value)}/>) }
        </PracticeCard>{combinedError && <p className="practice-status" role="status">{combinedError} <a href="/library">{t.library}</a></p>}</div></div></section></div>
        <DailyQuote locale={locale} onDayChange={setTodayDate} initialSelection={todayQuote.current} onSelection={selection => { todayQuote.current = selection; }}/></div>
        
        {(communityLessons.length > 0 || catalogue.length > 0) && <TaskCatalogue selections={practiceSelections} onSelection={savePracticeSelection} preferences={preferences} key={activeProfile} startError={error === 'save' ? t.saveError : ''} profileId={activeProfile} locale={locale} lessons={[...catalogue, ...communityLessons]} history={history} records={records} online={online} installedGroups={installedGroups} localCorpus={localCorpus} localSpoken={localSpoken} busy={starting} onStart={start}/>}
        {combinedDetail && <TaskDetail key={combinedDetail[0].id + combinedDetail[1].id} lesson={combinedDetail[0]} additionalLesson={combinedDetail[1]} heading={training.title} locale={locale} profileId={activeProfile} action={training.start} busy={starting} onStart={() => startCombinedPractice()} onCheck={() => startCombinedPractice(true)} onClose={() => { setCombinedDetail(undefined); requestAnimationFrame(() => { if (combinedInvoker.current?.isConnected && !combinedInvoker.current.matches(':disabled')) combinedInvoker.current.focus({ preventScroll: true }); }); }} startError={error === 'save' ? t.saveError : ''} available={true}/>}
      </> : path === '/progress' ? <section id="today-records">
        <a className="records-back" href="/today">← {t.today}</a>
        <h1>{t.progress}</h1><div className="progress-overview">
        <dl className="totals"><div><dt>{t.count}</dt><dd>{records.length + summaries.length + unavailableSummaries.length}</dd></div><div><dt>{t.materialCount}</dt><dd>{new Set([...records.map(r => r.rootId), ...summaries.map(row => row.event.payload.rootId), ...unavailableSummaries.map(event => event.payload.rootId)]).size}</dd></div></dl></div>
        <CompletionTiming key={activeProfile} locale={locale} profileId={activeProfile} rows={timingRows} onChange={load}/><ProgressRecords locale={locale} lessons={[...catalogue, ...communityLessons]} history={history} records={records} summaries={summaries} unavailable={unavailableSummaries} conflicts={summaryConflicts} profileId={activeProfile} onChange={load}/>{!history.length && !records.length && !summaries.length && !unavailableSummaries.length && <p className="progress-empty">{t.empty}</p>}{history.length > 0 && <h2>{t.history}</h2>}<SessionHistory history={history} records={records} locale={locale} profileId={activeProfile} onChange={load}/>
        </section> : path === '/library' ? <div className="library-page"><div className="library-page-heading"><h1>{t.library}</h1><div className="library-history-entry"><a className="records-link" href="/library/history">{lookupHistoryCopy[locale].entry}</a></div></div><section className="library-references"><h2>{t.references}</h2>{[
          { path: 'dictionary', title: t.dictionaryEntry },
          { path: 'ipa', title: t.ipa },
          { path: 'grammar', title: t.grammar },
        ].map(reference => <a className="library-reference-tile" key={reference.path} href={`/library/${reference.path}`}>{reference.title}</a>)}</section><OfflineInstall initialIntents={offlineSnapshot?.profileId === activeProfile ? offlineSnapshot.intents : undefined} initialInstalled={offlineSnapshot?.profileId === activeProfile ? offlineSnapshot.groups : undefined} key={activeProfile} profileId={activeProfile} locale={locale} online={online} onReady={(ready, groups) => { setOfflineInstalled(ready); setInstalledGroups(groups); }} onIntentsChange={intents => setOfflineSnapshot(previous => previous?.profileId === activeProfile ? { ...previous, intents } : previous)}/><InstalledResources locale={locale} profileId={activeProfile}/><CommunityImport locale={locale} profileId={activeProfile} onInstalled={() => void load()}/></div>
      : path === '/library/history' ? <LookupHistory key={activeProfile} locale={locale} profileId={activeProfile}/>
      : path === '/library/dictionary' ? <div className="library-page"><Dictionary key={`${activeProfile}:${pageSearch}`} locale={locale} online={online} profileId={activeProfile} initialQuery={lookupQuery} standalone/></div>
      : path === '/library/saved' ? <div className="library-page"><SavedWords key={activeProfile} locale={locale} profileId={activeProfile} online={online} defaultId={onlineDictionary}/></div>
      : path === '/library/ipa' ? <Suspense fallback={<p className="sr-only" role="status">{t.loading}</p>}><IpaChart key={`${activeProfile}:${pageSearch}`} locale={locale} profileId={activeProfile} initialQuery={lookupQuery}/></Suspense>
      : path === '/library/grammar' ? <GrammarLookup key={`${activeProfile}:${pageSearch}`} locale={locale} online={online} profileId={activeProfile} initialQuery={lookupQuery}/>
      : path === '/settings/about' ? <Suspense fallback={<p className="sr-only" role="status">{t.loading}</p>}><About/></Suspense>
      : path === '/settings' ? settingsPage : <><h1>{t.unsupported}</h1><a href="/today">{t.finish}</a></>}
      </PageBoundary></Suspense>
    </main>
    {confirmUpdate && createPortal(<dialog ref={updateDialog} className="update-confirm-dialog" aria-labelledby="update-confirm-title" aria-describedby="update-confirm-description" onCancel={event => { event.preventDefault(); closeUpdate(); }} onClick={event => { if (event.target === event.currentTarget) closeUpdate(); }}>
      <h2 id="update-confirm-title">{t.updateConfirm}</h2><p id="update-confirm-description">{t.updateConfirmDetail}</p>
      {updateCheck === 'failed' && <p role="alert">{t.updateFailed}</p>}
      {updateBlocked && <p className="error" role="alert">{t.updateBlocked}</p>}
      <div className="update-confirm-actions"><button ref={updateCancel} type="button" disabled={applyingUpdate} onClick={closeUpdate}>{t.updateCancel}</button><button className="primary" type="button" disabled={applyingUpdate} aria-busy={applyingUpdate} onClick={() => void applyUpdate()}>{t.updateNow}</button></div>
    </dialog>, document.body)}
    {!sessionId && !introducing && !entryPending && path !== '/start' && <nav className="mobile-nav" data-display={mobileNavDisplay} aria-label={t.navigation}>{nav.map(n => <a key={n} aria-label={t[n]} aria-current={activeNav === n ? 'page' : undefined} href={`/${n}`}><NavIcon name={n}/><span className="nav-label">{t[n]}</span></a>)}</nav>}
  </>;
}

class PageBoundary extends Component<{ locale: Locale; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    const t = copy[this.props.locale];
    return this.state.failed ? <div className="error" role="alert">{t.readError} <button onClick={() => location.reload()}>{t.retry}</button></div> : this.props.children;
  }
}
