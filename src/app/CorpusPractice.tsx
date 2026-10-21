import { messages } from '../locales';
import { useRef, useState } from 'react';
import { activeCorpusPractice } from '../data/practice';
import type { Attempt, Session } from '../data/db';
import { type Lesson, type Locale } from '../shared/content';
import type { Preferences } from '../shared/preferences';
import { TaskDetail, taskMinutes } from './TaskDetail';
import { PracticeCard } from './PracticeCard';
import { PracticeOptions } from './PracticeOptions';
import { practiceSelectionMatches, type PracticeSelection } from '../shared/practiceSelection';

const labels = messages('corpusPractice');

export async function prepareCorpusPractice(input: Parameters<typeof import('./prepareCorpusPractice').prepareCorpusPractice>[0]) {
  return (await import('./prepareCorpusPractice')).prepareCorpusPractice(input);
}

export function CorpusPractice({ locale, profileId, preferences, selection, onSelection, fallback, history, records, busy, online, onStart, onCheck, startError = '', skill = 'reading', recommended = false, onRestart }: { selection: PracticeSelection; onSelection: (value: PracticeSelection) => Promise<void>; fallback?: { lesson: Lesson; session?: Session }; recommended?: boolean; onRestart?: (session: Session) => Promise<void>; preferences?: Preferences; skill?: 'reading' | 'listening'; locale: Locale; profileId: string; history: Session[]; records: Attempt[]; busy: boolean; online: boolean; onStart: (lesson: Lesson) => Promise<void>; onCheck?: (lesson: Lesson) => Promise<void>; startError?: string }) {
  const listenLabels = messages('corpusPractice_listenLabels');
  const t = skill === 'listening' ? { ...labels[locale], ...listenLabels[locale] } : labels[locale];
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [detail, setDetail] = useState<Lesson>();
  const [topicChanged, setTopicChanged] = useState(false);
  const invoker = useRef<HTMLElement | null>(null);
  const preview = useRef<string[]>([]);
  const previewRoots = useRef(new Set<string>());
  const [detailReason, setDetailReason] = useState<'reteach' | 'retry' | 'review' | 'vocabulary'>();
  const previous = activeCorpusPractice(history, profileId, skill);
  const configured = !!(selection.topics.length || selection.kinds.length || selection.materials.length);
  const active = previous && practiceSelectionMatches(previous.lesson, selection) ? previous : !configured ? fallback?.session : undefined;
  async function choose() {
    setLoading(true); setError('');
    try {
      if (fallback && !configured) { setDetailReason(undefined); setDetail(fallback.lesson); return; }
      const { lesson: next, reason, downloadFailed } = await prepareCorpusPractice({ locale, profileId, preferences, history, records, online, skill, selection, previewIds: selection.materials.length ? [] : preview.current, previewRoots: selection.materials.length ? new Set() : previewRoots.current });
      if (next) {
        setDetailReason(reason);
        previewRoots.current = new Set(next.materials.map(material => material.rootId));
        preview.current = next.materials.map(material => material.id.slice('corpus-'.length));
        setDetail(next);
      } else setError(downloadFailed ? t.failed : selection.kinds.length || selection.materials.length ? messages('practiceOptions')[locale].unsuitable : selection.topics.length ? (messages('corpusPractice_no_suitable_materials_for_this')[locale]) : t.empty);
    } catch { setError(t.failed); }
    finally { setLoading(false); }
  }
  return <>
    <PracticeCard title={t.title} locale={locale} dataSkill={skill} sessions={active && !topicChanged ? [active] : []} records={records} recommended={recommended} busy={busy || loading} estimatedMinutes={detail ? taskMinutes(detail) : fallback && !configured ? taskMinutes(fallback.lesson) : undefined} onStart={() => {
      invoker.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!active || topicChanged) { void choose(); return; }
      if (onCheck && active.lesson.mode !== 'test') { setDetailReason(undefined); setDetail(active.lesson); }
      else void onStart(active.lesson);
    }} onRestart={active && !topicChanged && onRestart ? async () => {
      await onRestart(active);
      preview.current = []; previewRoots.current = new Set(); setDetail(undefined); setDetailReason(undefined); setError('');
    } : undefined}>
      <PracticeOptions history={history} records={records} locale={locale} profileId={profileId} skill={skill} preferences={preferences} value={selection} disabled={busy || loading} onChange={async value => { await onSelection(value); setTopicChanged(true); setDetail(undefined); setDetailReason(undefined); setError(''); preview.current = []; previewRoots.current = new Set(); }}/>
    </PracticeCard>
    {error && <p className="practice-status" role="status">{error} <a href="/library">{t.install}</a></p>}
    {detail && <TaskDetail key={detail.id} lesson={detail} locale={locale} profileId={profileId} action={t.confirm} practiceReason={detailReason} available={true} busy={busy} onStart={onStart} onCheck={onCheck} onClose={() => { setDetail(undefined); requestAnimationFrame(() => { if (invoker.current?.isConnected && !invoker.current.matches(':disabled')) invoker.current.focus({ preventScroll: true }); }); }} startError={startError}/>}
  </>;
}
