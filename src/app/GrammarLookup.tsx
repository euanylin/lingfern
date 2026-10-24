import { contentLocale } from '../shared/locale';
import { contentText, messages } from '../locales';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { cambridgeGrammarUrl } from './onlineDictionaries';
import type { Locale } from '../shared/content';
import { recordLookup } from '../data/lookupHistory';

const translated = z.object({ 'zh-Hans': z.string().min(1), 'zh-Hant': z.string().min(1), en: z.string().min(1) }).strict();
const entrySchema = z.object({ id: z.string().min(1), title: translated, headword: z.string().min(1), question: translated, keywords: z.array(z.string()), summary: translated, usage: translated, pitfall: translated, examples: z.array(z.string().min(1)).min(2), pattern: z.string().min(1), example: z.string().min(1), contrast: z.string().min(1), related: z.array(z.string()) }).strict();
const referenceSchema = z.object({ reviewStatus: z.string(), entries: z.array(entrySchema).min(1) }).strict();
type Entry = z.infer<typeof entrySchema>;
const labels = messages('grammarLookup');
const initial = (headword: string) => headword.match(/[a-z]/i)?.[0].toUpperCase() ?? '#';

export function GrammarLookup({ locale, online, profileId, initialQuery = '' }: { locale: Locale; online: boolean; profileId: string; initialQuery?: string }) {
  const t = labels[locale];
  const [entries, setEntries] = useState<Entry[]>();
  const [query, setQuery] = useState(initialQuery.slice(0, 80));
  const [letter, setLetter] = useState('');
  const [error, setError] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const remember = useCallback(async (term: string) => {
    if (!term.trim()) return;
    try { await recordLookup(profileId, 'grammar', term); setHistoryError(false); }
    catch { setHistoryError(true); }
  }, [profileId]);
  const showRelated = useCallback((entry: Entry) => { setQuery(entry.headword); setLetter(''); void remember(entry.headword); }, [remember]);
  useEffect(() => {
    let live = true;
    fetch('/grammar/entries.json').then(async response => { if (!response.ok) throw new Error('GRAMMAR_UNAVAILABLE'); return referenceSchema.parse(await response.json()); }).then(data => { if (live) setEntries(data.entries); }).catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    const entry = entries?.find(item => item.headword === initialQuery);
    const detail = entry && document.getElementById(`grammar-${entry.id}`);
    if (detail instanceof HTMLDetailsElement) detail.open = true;
  }, [entries, initialQuery]);
  const term = query.normalize('NFKC').trim().toLocaleLowerCase(locale);
  const indexed = useMemo(() => entries?.map(entry => ({ entry, initial: initial(entry.headword), headword: entry.headword.toLocaleLowerCase(locale),
    terms: [entry.id, entry.headword, ...Object.values(entry.title), ...Object.values(entry.question), ...Object.values(entry.summary), ...Object.values(entry.usage), ...Object.values(entry.pitfall), ...entry.keywords, entry.pattern, entry.example, ...entry.examples, entry.contrast].map(value => value.toLocaleLowerCase(locale)),
  })) ?? [], [entries, locale]);
  const matches = indexed.filter(item => term ? item.terms.some(value => value.includes(term)) : !letter || item.initial === letter)
    .sort((a, b) => term ? Number(b.headword === term) - Number(a.headword === term) || Number(b.headword.startsWith(term)) - Number(a.headword.startsWith(term)) : 0).map(item => item.entry);
  const letters = [...new Set(indexed.map(item => item.initial))].sort();
  return <section className="reference-page grammar-page"><h1>{t.title}</h1>
    <label className="reference-search">{t.search}<input type="search" value={query} onChange={event => { setQuery(event.target.value); setLetter(''); }} onBlur={() => void remember(query)} onKeyDown={event => { if (event.key === 'Enter') void remember(query); }} maxLength={80}/></label>
    <section className="online-lookup" aria-label={t.online}>
      <div className="online-lookup-links">{online ? <a href={cambridgeGrammarUrl(query)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" onClick={() => void remember(query)}>{t.online} <span aria-hidden="true">↗</span></a> : <span className="online-lookup-disabled" aria-disabled="true">{t.online} ↗</span>}</div>
      <p className="muted">{online ? t.privacy : t.offline}</p>
    </section>
    {!entries && !error && <p role="status">{t.loading}</p>}{error && <p role="alert" className="error">{t.failed}</p>}
    {historyError && <p role="alert" className="error">{messages('lookupHistory_lookupHistoryCopy')[locale].saveFailed}</p>}
    {entries && <><nav className="grammar-index" aria-label={t.index}><button type="button" aria-pressed={!letter && !term} onClick={() => { setQuery(''); setLetter(''); }}>{t.all}</button>{letters.map(char => <button key={char} type="button" aria-pressed={letter === char && !term} onClick={() => { setQuery(''); setLetter(char); }}>{char}</button>)}</nav><p role="status" className="muted">{matches.length} {t.count}</p>{matches.length === 0 && <p>{t.none}</p>}<div className="grammar-results">{matches.map(entry => <GrammarEntry key={entry.id} entry={entry} entries={entries} locale={locale} onRemember={remember} onRelated={showRelated}/>)}</div></>}
  </section>;
}


const GrammarEntry = memo(function GrammarEntry({ entry, entries, locale, onRemember, onRelated }: { entry: Entry; entries: Entry[]; locale: Locale; onRemember: (term: string) => Promise<void>; onRelated: (entry: Entry) => void }) {
  const [open, setOpen] = useState(false), t = labels[locale];
  return <details id={`grammar-${entry.id}`} onToggle={event => { const expanded = event.currentTarget.open; setOpen(expanded); if (expanded) void onRemember(entry.headword); }}><summary><span><strong lang="en">{entry.headword}</strong><small lang={contentLocale(locale)}>{contentText(entry.question, locale)}</small></span></summary>{open && <div className="grammar-detail" lang={contentLocale(locale)}><p><strong lang={locale}>{t.answer}：</strong>{contentText(entry.summary, locale)}</p><div><strong lang={locale}>{t.usage}：</strong>{contentText(entry.usage, locale).split("\n\n").map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div><p><strong lang={locale}>{t.pattern}：</strong><span lang="en">{entry.pattern}</span></p><div><strong lang={locale}>{t.examples}</strong><ul lang="en">{entry.examples.map(example => <li key={example}>{example}</li>)}</ul></div><p><strong lang={locale}>{t.pitfall}：</strong>{contentText(entry.pitfall, locale)}</p><p><strong lang={locale}>{t.contrast}：</strong><span lang="en">{entry.contrast}</span></p>{entry.related.length > 0 && <p className="muted">{t.related}：{entry.related.map(id => { const related = entries.find(other => other.id === id); return related && <button className="grammar-related" key={id} type="button" onClick={() => onRelated(related)}>{related.headword}</button>; })}</p>}</div>}</details>;
});
