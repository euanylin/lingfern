import { SingleLineField } from './SingleLineField';
import { AnimatedDetails } from './AnimatedDetails';
import { messages } from '../locales';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { cambridgeGrammarUrl } from './onlineDictionaries';
import type { Locale } from '../shared/content';
import { recordLookup } from '../data/lookupHistory';

const translated = z.object({ 'zh-Hans': z.string().min(1), 'zh-Hant': z.string().min(1), en: z.string().min(1) }).strict();
const entrySchema = z.object({ id: z.string().min(1), title: translated, headword: z.string().min(1), question: translated, keywords: z.array(z.string()), summary: translated, usage: translated, pitfall: translated, examples: z.array(z.string().min(1)).min(2), pattern: z.string().min(1), example: z.string().min(1), contrast: z.string().min(1), related: z.array(z.string()) }).strict();
const referenceSchema = z.object({ reviewStatus: z.string(), entries: z.array(entrySchema).min(1) }).strict();
const overlayEntrySchema = z.object({ title: z.string().min(1), question: z.string().min(1), summary: z.string().min(1), usage: z.string().min(1), pitfall: z.string().min(1), keywords: z.array(z.string().min(1)).min(1) }).strict();
const overlaySchema = z.record(z.string().min(1), overlayEntrySchema);
type Entry = z.infer<typeof entrySchema>;
type Overlay = z.infer<typeof overlaySchema>;
type Prose = { title: string; question: string; summary: string; usage: string; pitfall: string };
const labels = messages('grammarLookup');
const initial = (headword: string) => headword.match(/[a-z]/i)?.[0].toUpperCase() ?? '#';
const bundled = (locale: Locale): locale is 'zh-Hans' | 'zh-Hant' | 'en' => locale === 'zh-Hans' || locale === 'zh-Hant' || locale === 'en';
const labelText = (locale: Locale, label: string) => `${label}${locale === 'zh-Hans' || locale === 'zh-Hant' || locale === 'ja' ? '：' : ': '}`;

function proseFor(entry: Entry, locale: Locale, overlay: Overlay | null): { prose: Prose; lang: string } {
  if (bundled(locale)) return { lang: locale, prose: { title: entry.title[locale], question: entry.question[locale], summary: entry.summary[locale], usage: entry.usage[locale], pitfall: entry.pitfall[locale] } };
  const translated = overlay?.[entry.id];
  if (translated) return { lang: locale, prose: translated };
  return { lang: 'en', prose: { title: entry.title.en, question: entry.question.en, summary: entry.summary.en, usage: entry.usage.en, pitfall: entry.pitfall.en } };
}

export function GrammarLookup({ locale, online, profileId, initialQuery = '', initialData, disabled = false }: { locale: Locale; online: boolean; profileId: string; initialQuery?: string; initialData?: unknown; disabled?: boolean }) {
  const t = labels[locale];
  const [entries, setEntries] = useState<Entry[] | undefined>(() => initialData ? referenceSchema.parse(initialData).entries : undefined);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [overlayReady, setOverlayReady] = useState(() => bundled(locale));
  const [query, setQuery] = useState(initialQuery.slice(0, 80));
  const [letter, setLetter] = useState('');
  const [error, setError] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const remember = useCallback(async (term: string) => {
    if (disabled || !term.trim()) return;
    try { await recordLookup(profileId, 'grammar', term); setHistoryError(false); }
    catch { setHistoryError(true); }
  }, [profileId, disabled]);
  const showRelated = useCallback((entry: Entry) => { setQuery(entry.headword); setLetter(''); void remember(entry.headword); }, [remember]);
  useEffect(() => {
    if (initialData) return;
    let live = true;
    fetch('/grammar/entries.json').then(async response => { if (!response.ok) throw new Error('GRAMMAR_UNAVAILABLE'); return referenceSchema.parse(await response.json()); }).then(data => { if (live) setEntries(data.entries); }).catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [initialData]);
  useEffect(() => {
    if (bundled(locale)) { setOverlay(null); setOverlayReady(true); return; }
    let live = true;
    setOverlayReady(false);
    fetch(`/grammar/i18n/${locale}.json`).then(async response => { if (!response.ok) throw new Error('GRAMMAR_LOCALE_UNAVAILABLE'); return overlaySchema.parse(await response.json()); }).then(data => { if (live) { setOverlay(data); setOverlayReady(true); } }).catch(() => { if (live) { setOverlay(null); setOverlayReady(true); } });
    return () => { live = false; };
  }, [locale]);
  useEffect(() => {
    const entry = entries?.find(item => item.headword === initialQuery);
    const detail = entry && document.getElementById(`grammar-${entry.id}`);
    if (detail instanceof HTMLDetailsElement) detail.open = true;
  }, [entries, initialQuery]);
  const term = query.normalize('NFKC').trim().toLocaleLowerCase(locale);
  const indexed = useMemo(() => entries?.map(entry => {
    const { prose } = proseFor(entry, locale, overlay);
    const extra = overlay?.[entry.id];
    return { entry, initial: initial(entry.headword), headword: entry.headword.toLocaleLowerCase(locale),
      terms: [entry.id, entry.headword, ...Object.values(entry.title), ...Object.values(entry.question), ...Object.values(entry.summary), ...Object.values(entry.usage), ...Object.values(entry.pitfall), ...entry.keywords, prose.title, prose.question, prose.summary, prose.usage, prose.pitfall, ...(extra?.keywords ?? []), entry.pattern, entry.example, ...entry.examples, entry.contrast].map(value => value.toLocaleLowerCase(locale)) };
  }) ?? [], [entries, locale, overlay]);
  const matches = indexed.filter(item => term ? item.terms.some(value => value.includes(term)) : !letter || item.initial === letter)
    .sort((a, b) => term ? Number(b.headword === term) - Number(a.headword === term) || Number(b.headword.startsWith(term)) - Number(a.headword.startsWith(term)) : 0).map(item => item.entry);
  const letters = [...new Set(indexed.map(item => item.initial))].sort();
  const ready = entries && overlayReady;
  return <section className="reference-page grammar-page"><h1>{t.title}</h1>
    <label className="reference-search">{t.search}<SingleLineField disabled={disabled} enterKeyHint="search" value={query} onChange={event => { setQuery(event.target.value); setLetter(''); }} onBlur={() => void remember(query)} onKeyDown={event => { if (event.key === 'Enter') void remember(query); }} maxLength={80}/></label>
    <section className="online-lookup" aria-label={t.online}>
      <div className="online-lookup-links">{online ? <a href={cambridgeGrammarUrl(query)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" onClick={() => void remember(query)}>{t.online} <span aria-hidden="true">↗</span></a> : <span className="online-lookup-disabled" aria-disabled="true">{t.online} ↗</span>}</div>
      <p className="muted">{online ? t.privacy : t.offline}</p>
    </section>
    {!ready && !error && <p role="status">{t.loading}</p>}{error && <p role="alert" className="error">{t.failed}</p>}
    {historyError && <p role="alert" className="error">{messages('lookupHistory_lookupHistoryCopy')[locale].saveFailed}</p>}
    {ready && <><nav className="grammar-index" aria-label={t.index}><button type="button" aria-pressed={!letter && !term} onClick={() => { setQuery(''); setLetter(''); }}>{t.all}</button>{letters.map(char => <button key={char} type="button" aria-pressed={letter === char && !term} onClick={() => { setQuery(''); setLetter(char); }}>{char}</button>)}</nav>{matches.length === 0 && <p>{t.none}</p>}<div className="grammar-results">{matches.map(entry => <GrammarEntry key={entry.id} entry={entry} entries={entries} locale={locale} overlay={overlay} onRemember={remember} onRelated={showRelated}/>)}</div></>}
  </section>;
}

const GrammarEntry = memo(function GrammarEntry({ entry, entries, locale, overlay, onRemember, onRelated }: { entry: Entry; entries: Entry[]; locale: Locale; overlay: Overlay | null; onRemember: (term: string) => Promise<void>; onRelated: (entry: Entry) => void }) {
  const [open, setOpen] = useState(false), t = labels[locale];
  const { prose, lang } = proseFor(entry, locale, overlay);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  return <AnimatedDetails id={`grammar-${entry.id}`} onExpandedChange={expanded => { if (expanded) { setOpen(true); void onRemember(entry.headword); } }} onToggle={event => setOpen(event.currentTarget.open)}><summary><span><strong lang="en" dir="ltr">{entry.headword}</strong><small lang={lang} dir={dir}>{prose.question}</small></span></summary>{open && <div className="grammar-detail"><p><strong lang={locale}>{labelText(locale, t.answer)}</strong><span lang={lang} dir={dir}>{prose.summary}</span></p><div><strong lang={locale}>{labelText(locale, t.usage)}</strong>{prose.usage.split('\n\n').map((paragraph, index) => <p key={index} lang={lang} dir={dir}>{paragraph}</p>)}</div><p><strong lang={locale}>{labelText(locale, t.pattern)}</strong><span lang="en" dir="ltr">{entry.pattern}</span></p><div><strong lang={locale}>{t.examples}</strong><ul lang="en" dir="ltr">{entry.examples.map(example => <li key={example}>{example}</li>)}</ul></div><p><strong lang={locale}>{labelText(locale, t.pitfall)}</strong><span lang={lang} dir={dir}>{prose.pitfall}</span></p><p><strong lang={locale}>{labelText(locale, t.contrast)}</strong><span lang="en" dir="ltr">{entry.contrast}</span></p>{entry.related.length > 0 && <p className="muted">{labelText(locale, t.related)}{entry.related.map(id => { const related = entries.find(other => other.id === id); return related && <button className="grammar-related" key={id} type="button" onClick={() => onRelated(related)}>{related.headword}</button>; })}</p>}</div>}</AnimatedDetails>;
});
