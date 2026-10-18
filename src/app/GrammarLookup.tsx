import { contentLocale } from '../shared/locale';
import { contentText, messages } from '../locales';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { cambridgeGrammarUrl } from './onlineDictionaries';
import type { Locale } from '../shared/content';
import { recordLookup } from '../data/lookupHistory';
import { lookupHistoryCopy } from './LookupHistory';

const translated = z.object({ 'zh-Hans': z.string().min(1), 'zh-Hant': z.string().min(1), en: z.string().min(1) }).strict();
const entrySchema = z.object({ id: z.string().min(1), title: translated, headword: z.string().min(1), question: translated, keywords: z.array(z.string()), summary: translated, usage: translated, pitfall: translated, examples: z.array(z.string().min(1)).min(2), pattern: z.string().min(1), example: z.string().min(1), contrast: z.string().min(1), related: z.array(z.string()) }).strict();
const referenceSchema = z.object({ reviewStatus: z.string(), entries: z.array(entrySchema).min(1) }).strict();
type Entry = z.infer<typeof entrySchema>;
const labels = messages('grammarLookup');

export function GrammarLookup({ locale, online, profileId, initialQuery = '' }: { locale: Locale; online: boolean; profileId: string; initialQuery?: string }) {
  const t = labels[locale];
  const [entries, setEntries] = useState<Entry[]>();
  const [query, setQuery] = useState(initialQuery.slice(0, 80));
  const [letter, setLetter] = useState('');
  const [error, setError] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  async function remember(term: string) {
    if (!term.trim()) return;
    try { await recordLookup(profileId, 'grammar', term); setHistoryError(false); }
    catch { setHistoryError(true); }
  }
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
  const initial = (headword: string) => headword.match(/[a-z]/i)?.[0].toUpperCase() ?? '#';
  const matches = entries?.filter(entry => (term ? [entry.id, entry.headword, ...Object.values(entry.title), ...Object.values(entry.question), ...Object.values(entry.summary), ...Object.values(entry.usage), ...Object.values(entry.pitfall), ...entry.keywords, entry.pattern, entry.example, ...entry.examples, entry.contrast].some(value => value.toLocaleLowerCase(locale).includes(term)) : !letter || initial(entry.headword) === letter)).sort((a, b) => term ? Number(b.headword.toLocaleLowerCase(locale) === term) - Number(a.headword.toLocaleLowerCase(locale) === term) || Number(b.headword.toLocaleLowerCase(locale).startsWith(term)) - Number(a.headword.toLocaleLowerCase(locale).startsWith(term)) : 0) ?? [];
  const letters = [...new Set(entries?.map(entry => initial(entry.headword)) ?? [])].sort();
  return <section className="reference-page grammar-page"><h1>{t.title}</h1>
    <label className="reference-search">{t.search}<input type="search" value={query} onChange={event => { setQuery(event.target.value); setLetter(''); }} onBlur={() => void remember(query)} onKeyDown={event => { if (event.key === 'Enter') void remember(query); }} maxLength={80}/></label>
    <section className="online-lookup" aria-label={t.online}>
      <div className="online-lookup-links">{online ? <a href={cambridgeGrammarUrl(query)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" onClick={() => void remember(query)}>{t.online} <span aria-hidden="true">↗</span></a> : <span className="online-lookup-disabled" aria-disabled="true">{t.online} ↗</span>}</div>
      <p className="muted">{online ? t.privacy : t.offline}</p>
    </section>
    {!entries && !error && <p role="status">{t.loading}</p>}{error && <p role="alert" className="error">{t.failed}</p>}
    {historyError && <p role="alert" className="error">{lookupHistoryCopy[locale].saveFailed}</p>}
    {entries && <><nav className="grammar-index" aria-label={t.index}><button type="button" aria-pressed={!letter && !term} onClick={() => { setQuery(''); setLetter(''); }}>{t.all}</button>{letters.map(char => <button key={char} type="button" aria-pressed={letter === char && !term} onClick={() => { setQuery(''); setLetter(char); }}>{char}</button>)}</nav><p role="status" className="muted">{matches.length} {t.count}</p>{matches.length === 0 && <p>{t.none}</p>}<div className="grammar-results">{matches.map(entry => <details key={entry.id} id={`grammar-${entry.id}`}><summary onClick={event => { if (!event.currentTarget.parentElement?.hasAttribute('open')) void remember(entry.headword); }}><span><strong lang="en">{entry.headword}</strong><small lang={contentLocale(locale)}>{contentText(entry.question, locale)}</small></span></summary><div className="grammar-detail" lang={contentLocale(locale)}><p><strong lang={locale}>{t.answer}：</strong>{contentText(entry.summary, locale)}</p><div><strong lang={locale}>{t.usage}：</strong>{contentText(entry.usage, locale).split("\n\n").map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div><p><strong lang={locale}>{t.pattern}：</strong><span lang="en">{entry.pattern}</span></p><div><strong lang={locale}>{t.examples}</strong><ul lang="en">{entry.examples.map(example => <li key={example}>{example}</li>)}</ul></div><p><strong lang={locale}>{t.pitfall}：</strong>{contentText(entry.pitfall, locale)}</p><p><strong lang={locale}>{t.contrast}：</strong><span lang="en">{entry.contrast}</span></p>{entry.related.length > 0 && <p className="muted">{t.related}：{entry.related.map(id => { const related = entries.find(other => other.id === id); return related && <button className="grammar-related" key={id} type="button" onClick={() => { setQuery(related.headword); setLetter(''); }}>{related.headword}</button>; })}</p>}</div></details>)}</div></>}
  </section>;
}
