import { messages } from '../locales';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { liveQuery } from 'dexie';
import { lookupDictionary, normaliseTerm, rankDictionarySuggestions, suggestDictionary } from '../shared/dictionary';
import type { Locale } from '../shared/content';
import { OnlineLookup } from './OnlineLookup';
import { removeSense, saveSense, projectMemories } from '../data/memory';
import { memories } from '../data/db';
import { communityDictionary, communityDictionaryTerms } from '../data/communityInstall';
import { recordLookup } from '../data/lookupHistory';

type Result = Awaited<ReturnType<typeof lookupDictionary>> & { community: Awaited<ReturnType<typeof communityDictionary>> };
const labels = messages('dictionary');

export function Dictionary({ locale, online, profileId, standalone = false, initialQuery = '', onLookup }: { locale: Locale; online: boolean; profileId: string; standalone?: boolean; initialQuery?: string; onLookup?: () => Promise<void> }) {
  const t = labels[locale];
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savingId, setSavingId] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [communityTerms, setCommunityTerms] = useState<string[]>([]), [termsRequested, setTermsRequested] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const lookupId = useRef(0);
  const queryInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (initialQuery) void searchTerm(initialQuery); }, [initialQuery]);
  async function remember(term: string) {
    try { await recordLookup(profileId, 'dictionary', term); }
    catch { setError(messages('lookupHistory_lookupHistoryCopy')[locale].saveFailed); }
  }
  useEffect(() => {
    if (!termsRequested) return;
    const subscription = liveQuery(() => communityDictionaryTerms(profileId)).subscribe({ next: setCommunityTerms, error: () => setCommunityTerms([]) });
    return () => subscription.unsubscribe();
  }, [termsRequested, profileId]);
  useEffect(() => {
    if (!suggestionsOpen || !normaliseTerm(query)) return;
    let live = true;
    const timer = window.setTimeout(() => {
      void suggestDictionary(query).catch(() => []).then(builtIn => {
        if (live) setSuggestions(rankDictionarySuggestions(query, [...new Set([...communityTerms, ...builtIn])]));
      }).catch(() => { if (live) setSuggestions([]); });
    }, 100);
    return () => { live = false; window.clearTimeout(timer); };
  }, [query, suggestionsOpen, communityTerms]);
  useEffect(() => {
    if (suggestionsOpen && activeSuggestion >= 0) document.getElementById(`dictionary-suggestion-${activeSuggestion}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeSuggestion, suggestionsOpen]);
  async function searchTerm(term: string) {
    const id = ++lookupId.current;
    setQuery(term); setSuggestionsOpen(false); setSuggestions([]); setActiveSuggestion(-1);
    setError(''); setResult(undefined); setAll(false); setSavedIds([]);
    if (!normaliseTerm(term)) { setError(t.invalid); return; }
    queryInput.current?.blur();
    setBusy(true);
    try {
      const community = await communityDictionary(profileId, term);
      const found = await lookupDictionary(term).catch(error => {
        if (!community.length) throw error;
        return { term: normaliseTerm(term), matched: normaliseTerm(term), senses: [], course: [] };
      });
      if (id !== lookupId.current) return;
      await onLookup?.();
      await projectMemories(profileId);
      const saved = (await Promise.all(found.senses.map(async sense => await memories.get([profileId, sense.id]) ? sense.id : ''))).filter(Boolean);
      if (id !== lookupId.current) return;
      setSavedIds(saved);
      if (standalone) await remember(found.term);
      if (id !== lookupId.current) return;
      setResult({ ...found, community });
    } catch { if (id === lookupId.current) setError(t.failed); }
    finally { if (id === lookupId.current) setBusy(false); }
  }
  async function toggle(id: string, term: string, definition: string) {
    const saved = savedIds.includes(id);
    setSavingId(id); setError('');
    try {
      if (saved) await removeSense(profileId, id);
      else await saveSense(profileId, id, term, definition);
      setSavedIds(ids => saved ? ids.filter(item => item !== id) : [...ids, id]);
    }
    catch { setError(t.saveFailed); }
    finally { setSavingId(''); }
  }
  return <section className="dictionary" aria-label={t.title}>
    {standalone ? <div className="dictionary-heading"><h1>{t.title}</h1><a className="dictionary-bookmarks" href="/library/saved">{t.bookmarks}</a></div> : <h2>{t.title}</h2>}
    <form onSubmit={(event: FormEvent) => { event.preventDefault(); void searchTerm(activeSuggestion < 0 ? query : suggestions[activeSuggestion]); }} className="dictionary-search"><label htmlFor="dictionary-query">{t.search}</label><div className="dictionary-search-field"><input ref={queryInput} id="dictionary-query" role="combobox" aria-autocomplete="list" aria-expanded={suggestionsOpen && suggestions.length > 0} aria-controls="dictionary-suggestions" aria-activedescendant={!suggestionsOpen || activeSuggestion < 0 ? undefined : `dictionary-suggestion-${activeSuggestion}`} aria-busy={busy} lang="en" value={query} onChange={event => { lookupId.current++; setBusy(false); setQuery(event.target.value); setResult(undefined); setError(''); setSuggestions([]); setActiveSuggestion(-1); setSuggestionsOpen(true); }} onFocus={() => { setTermsRequested(true); setSuggestionsOpen(true); }} onBlur={event => { if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) setSuggestionsOpen(false); setActiveSuggestion(-1); }} onKeyDown={event => { if (event.key === 'Escape') { setSuggestionsOpen(false); setActiveSuggestion(-1); } else if (suggestionsOpen && suggestions.length && event.key === 'ArrowDown') { event.preventDefault(); setActiveSuggestion(index => (index + 1) % suggestions.length); } else if (suggestionsOpen && suggestions.length && event.key === 'ArrowUp') { event.preventDefault(); setActiveSuggestion(index => (index + suggestions.length - 1) % suggestions.length); } }} maxLength={80} autoComplete="off"/><ul id="dictionary-suggestions" className="dictionary-suggestions" role="listbox" aria-label={t.suggestions} hidden={!suggestionsOpen || !suggestions.length}>{suggestions.map((word, index) => {
      const prefix = normaliseTerm(query);
      const match = prefix && word.toLocaleLowerCase('en').startsWith(prefix.toLocaleLowerCase('en'));
      return <li key={word} id={`dictionary-suggestion-${index}`} role="option" aria-label={word} aria-selected={index === activeSuggestion} onPointerDown={event => event.preventDefault()} onClick={() => void searchTerm(word)}>{match ? <><strong>{word.slice(0, prefix.length)}</strong>{word.slice(prefix.length)}</> : word}</li>;
    })}</ul></div></form>
    <OnlineLookup query={query} locale={locale} online={online} onOpen={standalone ? () => { if (normaliseTerm(query)) void remember(query); } : undefined}/>
    {error && <p role="alert" className="error">{error}</p>}
    {result && <div className="dictionary-results" aria-live="polite"><h3 lang="en">{result.term}</h3>{result.matched !== result.term && <p>{t.lemma}: <span lang="en">{result.matched}</span></p>}
      {!result.course.length && !result.community.length && !result.senses.length && <p>{t.missing}</p>}
      {result.course.map(entry => <article key={entry.term + entry.definition}><p className="eyebrow">{t.course}</p><p lang="en">{entry.definition}</p><p className="muted" lang="en">{entry.example}</p></article>)}
      {result.community.map((entry, index) => <article key={`${entry.sourceId}:${entry.term}:${index}`}><p className="eyebrow">{t.community} · {entry.source}</p><p lang="en">{entry.definition}</p><p className="muted" lang="en">{entry.example}</p></article>)}
      {!!result.senses.length && <><p className="eyebrow">{result.course.length ? t.senses : t.source}</p>{result.senses.slice(0, all ? undefined : 6).map(sense => <article key={sense.id}><span className="muted">{sense.pos}</span><div className="sense-definition"><button className="sense-star" type="button" disabled={!!savingId} aria-pressed={savedIds.includes(sense.id)} aria-label={`${savedIds.includes(sense.id) ? t.remove : t.save} ${sense.definition}`} title={savedIds.includes(sense.id) ? t.remove : t.save} onClick={() => void toggle(sense.id, result.matched, sense.definition)}><span aria-hidden="true">{savedIds.includes(sense.id) ? '★' : '☆'}</span></button><p lang="en">{sense.definition}</p></div>{sense.example && <p className="muted sense-example" lang="en">{sense.example}</p>}</article>)}{result.senses.length > 6 && !all && <button type="button" onClick={() => setAll(true)}>{t.more} ({result.senses.length})</button>}</>}
      
    </div>}
  </section>;
}
