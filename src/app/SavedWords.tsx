import { messages } from '../locales';
import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import type { Locale } from '../shared/content';
import { syncEvents, type Memory } from '../data/db';
import { removeSense, saveSense, projectMemories, type MemoryProblem } from '../data/memory';
import { copy } from './i18n';
import { onlineDictionaries, onlineDictionaryUrl, type OnlineDictionaryId } from './onlineDictionaries';

const problemCopy = messages('savedWords_problemCopy');
const labels = messages('savedWords');
const dictionaryLabels = messages('dictionary');

export function SavedWords({ locale, profileId, online, defaultId }: { locale: Locale; profileId: string; online: boolean; defaultId: OnlineDictionaryId }) {
  const t = labels[locale];
  const star = dictionaryLabels[locale];
  const [items, setItems] = useState<Memory[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [problems, setProblems] = useState<MemoryProblem[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    const result = await projectMemories(profileId);
    setItems(previous => {
      // Keep row order and unchecked entries until the page is reopened or refreshed.
      const rows = new Map(previous.map(item => [item.memoryId, item]));
      for (const item of result.items.sort((a, b) => b.savedAt.localeCompare(a.savedAt))) rows.set(item.memoryId, item);
      return [...rows.values()];
    });
    setSavedIds(result.items.map(item => item.memoryId)); setProblems(result.problems);
  }
  useEffect(() => {
    let live = true;
    const observer = liveQuery(() => syncEvents.where('profileId').equals(profileId).count()).subscribe({ next() { if (live) void load().catch(() => { if (live) setError(t.failed); }); }, error() { if (live) setError(t.failed); } });
    return () => { live = false; observer.unsubscribe(); };
  }, [profileId, t.failed]);
  async function act(fn?: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await fn?.(); await load(); }
    catch { setError(t.failed); }
    finally { setBusy(false); }
  }
  return <section className="saved-words"><h1>{t.title}</h1>{error && <p role="alert" className="error">{error}</p>}{!items.length && !problems.length && <p>{t.empty}</p>}{!online && !!items.length && <p role="status" className="muted">{copy[locale].onlineLookupOffline}</p>}
    {problems.length > 0 && <section className="memory-problems" aria-live="polite"><ul>{problems.map(problem => <li key={problem.memoryId}><span>{items.find(item => item.memoryId === problem.memoryId)?.term ?? problem.memoryId}: {problemCopy[locale].dictionary}</span>
      <button type="button" disabled={busy} onClick={() => void act(() => removeSense(profileId, problem.memoryId))}>{t.remove}</button></li>)}</ul><button type="button" disabled={busy} onClick={() => void act()}>{problemCopy[locale].retry}</button></section>}
    {!!items.length && <div className="saved-words-list">{items.map(item => {
      const saved = savedIds.includes(item.memoryId);
      const dictionary = onlineDictionaries.find(entry => entry.id === defaultId)!;
      const onlineLabel = copy[locale].onlineLookupLink.replace('{dictionary}', dictionary.name).replace('{query}', item.term);
      return <article key={item.memoryId} className="saved-word"><details open><summary className="saved-word-heading"><h2 lang="en" dir="ltr">{item.term}</h2><span className="saved-word-actions">{online ? <a className="saved-word-lookup" href={onlineDictionaryUrl(item.term, defaultId)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" title={onlineLabel} aria-label={onlineLabel}>{copy[locale].onlineLookup} ↗</a> : <span className="saved-word-lookup muted" aria-disabled="true">{copy[locale].onlineLookup} ↗</span>}
        <button type="button" disabled={busy} className="sense-star" aria-pressed={saved} aria-label={`${saved ? star.remove : star.save} ${item.definition}`} title={saved ? star.remove : star.save} onClick={() => void act(async () => {
          if (saved) await removeSense(profileId, item.memoryId);
          else await saveSense(profileId, item.memoryId, item.term, item.definition);
        })}><span aria-hidden="true">{saved ? '★' : '☆'}</span></button></span></summary><div className="sense-definition"><p lang="en" dir="ltr">{item.definition}</p></div>
      </details></article>;
    })}</div>}
  </section>;
}
