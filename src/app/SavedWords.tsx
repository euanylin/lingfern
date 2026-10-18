import { messages } from '../locales';
import { ReviewTiming } from './ReviewTiming';
import { useEffect, useState } from 'react';
import type { Locale } from '../shared/content';
import { type Memory } from '../data/db';
import { enableReview, rateMemory, removeSense, projectMemories, memoryDue, type MemoryProblem } from '../data/memory';
import { copy } from './i18n';
import { onlineDictionaries, onlineDictionaryUrl, type OnlineDictionaryId } from './onlineDictionaries';

const problemCopy = messages('savedWords_problemCopy');
const labels = messages('savedWords');

export function SavedWords({ locale, profileId, online, defaultId }: { locale: Locale; profileId: string; online: boolean; defaultId: OnlineDictionaryId }) {
  const t = labels[locale];
  const [items, setItems] = useState<Memory[]>([]);
  const [problems, setProblems] = useState<MemoryProblem[]>([]);
  const [shown, setShown] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() { const result = await projectMemories(profileId); setItems(result.items.sort((a, b) => b.savedAt.localeCompare(a.savedAt))); setProblems(result.problems); }
  useEffect(() => { void load().catch(() => setError(t.failed)); }, [profileId, t.failed]);
  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await fn(); await load(); }
    catch { setError(t.failed); }
    finally { setBusy(false); }
  }
  return <section className="saved-words"><h1>{t.title}</h1>{error && <p role="alert" className="error">{error}</p>}{!items.length && !problems.length && <p>{t.empty}</p>}{!online && !!items.length && <p role="status" className="muted">{copy[locale].onlineLookupOffline}</p>}
    {problems.length > 0 && <section className="memory-problems" aria-live="polite"><ul>{problems.map(problem => <li key={problem.memoryId}><span>{items.find(item => item.memoryId === problem.memoryId)?.term ?? problem.memoryId}: {problemCopy[locale][problem.code === 'DICTIONARY_UNAVAILABLE' ? 'dictionary' : problem.code === 'REVIEW_TIMING_INVALID' ? 'timing' : problem.code === 'REVIEW_INVALID' ? 'config' : problem.code === 'REVIEW_CONFLICT' ? 'conflict' : 'clock']}</span>{(problem.code === 'REVIEW_CLOCK' || problem.code === 'REVIEW_ORDER' || problem.code === 'REVIEW_TIMING_INVALID') && <ReviewTiming locale={locale} profileId={profileId} memoryId={problem.memoryId} onChange={load}/>}
      {problem.code === 'DICTIONARY_UNAVAILABLE' && <button type="button" disabled={busy} onClick={() => void act(() => removeSense(profileId, problem.memoryId))}>{t.remove}</button>}</li>)}</ul><button type="button" disabled={busy} onClick={() => void act(load)}>{problemCopy[locale].retry}</button></section>}
    {items.map(item => {
      const visible = shown.includes(item.memoryId);
      const blocked = problems.some(problem => problem.memoryId === item.memoryId);
      const due = !blocked && memoryDue(item);
      const dictionary = onlineDictionaries.find(entry => entry.id === defaultId)!;
      const onlineLabel = copy[locale].onlineLookupLink.replace('{dictionary}', dictionary.name).replace('{query}', item.term);
      return <article key={item.memoryId} className="saved-word"><div className="saved-word-heading"><h2 lang="en">{item.term}</h2>{online ? <a className="saved-word-lookup" href={onlineDictionaryUrl(item.term, defaultId)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" title={onlineLabel} aria-label={onlineLabel}>{copy[locale].onlineLookup} ↗</a> : <span className="saved-word-lookup muted" aria-disabled="true">{copy[locale].onlineLookup} ↗</span>}</div>{item.reviewEnabled && !blocked && <p className="muted">{due ? t.due : `${t.later}: ${new Date(item.card?.due ?? item.savedAt).toLocaleDateString(locale)}`}</p>}
        {(!item.reviewEnabled || visible || !due) && <p lang="en">{item.definition}</p>}
        {!item.reviewEnabled && <button type="button" className="text-button review-enroll" disabled={busy} onClick={() => void act(() => enableReview(profileId, item.memoryId))}>{t.enable}</button>}
        {due && !visible && <button type="button" disabled={busy} onClick={() => setShown(ids => [...ids, item.memoryId])}>{t.reveal}</button>}
        {due && visible && <div className="review-ratings">{([t.again, t.hard, t.good, t.easy] as const).map((label, index) => <button key={label} type="button" disabled={busy} onClick={() => void act(async () => { await rateMemory(profileId, item.memoryId, (index + 1) as 1 | 2 | 3 | 4); setShown(ids => ids.filter(id => id !== item.memoryId)); })}>{label}</button>)}</div>}
        <button type="button" disabled={busy} className="text-button" onClick={() => void act(() => removeSense(profileId, item.memoryId))}>{t.remove}</button>
      </article>;
    })}
  </section>;
}
