import { messages } from '../locales';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { communityDictionary } from '../data/communityInstall';
import { lookupDictionary, suggestDictionary } from '../shared/dictionary';
import type { Locale } from '../shared/content';
import { onlineDictionaryUrl, type OnlineDictionaryId } from './onlineDictionaries';

export type SelectedWord = { term: string; rect: { left: number; right: number; top: number; bottom: number }; x: number; y: number; input: 'mouse' | 'touch' };
type Entry = Awaited<ReturnType<typeof lookupDictionary>>;
type Community = Awaited<ReturnType<typeof communityDictionary>>;

const labels = messages('selectionDictionary');

export function SelectionDictionary({ selected, locale, profileId, online, defaultId, onLookup, onClose, lookupEnabled = true, actions }: { selected: SelectedWord; locale: Locale; profileId: string; online: boolean; defaultId: OnlineDictionaryId; onLookup: () => Promise<void>; onClose: () => void; lookupEnabled?: boolean; actions?: ReactNode }) {
  const t = labels[locale];
  const root = useRef<HTMLDivElement>(null);
  const [term, setTerm] = useState(selected.term);
  const [open, setOpen] = useState(false);
  const [entry, setEntry] = useState<Entry>();
  const [community, setCommunity] = useState<Community>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [all, setAll] = useState(false);
  const [menuSize, setMenuSize] = useState({ width: 116, height: 52 });
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);

  useEffect(() => {
    if (open || !root.current) return;
    const observer = new ResizeObserver(([entry]) => setMenuSize({ width: entry.borderBoxSize[0].inlineSize, height: entry.borderBoxSize[0].blockSize }));
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [open]);

  useEffect(() => { if (open) root.current?.querySelector<HTMLButtonElement>('.selection-dictionary-heading button')?.focus({ preventScroll: true }); }, [open]);
  function dismiss(returnFocus = false) {
    onClose();
    if (returnFocus) document.querySelector<HTMLElement>('.reading-workspace')?.focus({ preventScroll: true });
  }

  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) onClose(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); dismiss(true); } };
    const scroll = (event: Event) => { if (!(event.target instanceof Node && root.current?.contains(event.target))) onClose(); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', onClose);
    const viewport = innerWidth < 1200 ? window.visualViewport : undefined;
    viewport?.addEventListener('scroll', onClose); viewport?.addEventListener('resize', onClose);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); window.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', onClose); viewport?.removeEventListener('scroll', onClose); viewport?.removeEventListener('resize', onClose); };
  }, [onClose]);

  async function lookup(term: string) {
    if (!lookupEnabled) return;
    const token = ++request.current;
    setTerm(term);
    setOpen(true); setLoading(true); setError(''); setEntry(undefined); setCommunity([]); setSuggestions([]); setAll(false);
    try {
      const local = await communityDictionary(profileId, term);
      if (token !== request.current) return;
      const found = await lookupDictionary(term).catch(error => {
        if (!local.length) throw error;
        return { term, matched: term, senses: [], course: [] };
      });
      // A closed or replaced popup must not mark a later question as assisted.
      if (token !== request.current) return;
      await onLookup().catch(() => { throw new Error('LOOKUP_RECORD'); });
      if (token !== request.current) return;
      setEntry(found); setCommunity(local);
      if (!local.length && !found.course.length && !found.senses.length) {
        const suggestions = (await suggestDictionary(term).catch(() => [])).filter(word => word !== term).slice(0, 3);
        if (token === request.current) setSuggestions(suggestions);
      }
    } catch (cause) { if (token === request.current) setError(cause instanceof Error && cause.message === 'LOOKUP_RECORD' ? t.recordFailed : t.failed); }
    finally { if (token === request.current) setLoading(false); }
  }

  const width = Math.min(380, window.innerWidth - 24);
  const left = Math.max(12, Math.min(selected.rect.left, window.innerWidth - width - 12));
  const tip = Math.max(24, Math.min(width - 24, (selected.rect.left + selected.rect.right) / 2 - left - 7));
  const below = window.innerHeight - selected.rect.bottom >= selected.rect.top;
  const availableHeight = Math.max(100, (below ? window.innerHeight - selected.rect.bottom : selected.rect.top) - 26);
  const popupStyle: CSSProperties & { '--lookup-tip-x': string; '--lookup-height': string } = { left, width, '--lookup-height': `${availableHeight}px`, '--lookup-tip-x': `${tip}px`, ...(below ? { top: selected.rect.bottom + 14 } : { bottom: window.innerHeight - selected.rect.top + 14 }) };
  const viewportTop = window.visualViewport?.offsetTop ?? 0;
  const viewportBottom = viewportTop + (window.visualViewport?.height ?? window.innerHeight);
  const menuBelow = viewportBottom - selected.rect.bottom >= menuSize.height + 10;
  return <div ref={root} className={open ? 'selection-dictionary' : 'selection-dictionary-menu'} data-placement={below ? 'below' : 'above'} data-input={selected.input} style={open ? popupStyle : { left: Math.max(8, Math.min(selected.x - menuSize.width / 2, window.innerWidth - menuSize.width - 8)), top: Math.max(viewportTop + 8, Math.min(menuBelow ? selected.rect.bottom + 10 : selected.rect.top - menuSize.height - 10, viewportBottom - menuSize.height - 8)), maxWidth: 'calc(100vw - 16px)', maxHeight: `${Math.max(44, viewportBottom - viewportTop - 16)}px`, overflowY: 'auto' }}>
    {!open ? <>{lookupEnabled && <button type="button" onPointerDown={event => event.preventDefault()} onClick={() => void lookup(selected.term)}>{t.lookup}</button>}{actions}</> : <section role="dialog" aria-modal="false" aria-label={`${t.lookup}: ${term}`}>
      <div className="selection-dictionary-heading"><h2 lang="en">{term}</h2><button type="button" aria-label={t.close} onClick={() => dismiss(true)}>×</button></div>
      <div className="selection-dictionary-body" aria-live="polite">
        {loading && <p role="status">{t.loading}</p>}
        {error && <p role="alert">{error}</p>}
        {entry && <>{entry.matched !== entry.term && <p className="muted">{t.base}: <span lang="en">{entry.matched}</span></p>}
          {!entry.course.length && !community.length && !entry.senses.length && <><p>{t.missing}</p>{suggestions.map(word => <button className="selection-dictionary-suggestion" key={word} type="button" onClick={() => void lookup(word)}>{t.suggestion} <span lang="en">{word}</span>?</button>)}</>}
          {entry.course.map((sense, i) => <article key={`${sense.term}-${i}`}><small>{t.course}</small><p lang="en">{sense.definition}</p><p className="muted" lang="en">{sense.example}</p></article>)}
          {community.map((sense, i) => <article key={`${sense.sourceId}-${i}`}><small>{t.community} · {sense.source}</small><p lang="en">{sense.definition}</p><p className="muted" lang="en">{sense.example}</p></article>)}
          {entry.senses.length > 0 && <><small>{t.source}</small>{entry.senses.slice(0, all ? undefined : 2).map(sense => <article key={sense.id}><small lang="en">{sense.pos}</small><p lang="en">{sense.definition}</p>{sense.example && <p className="muted" lang="en">{sense.example}</p>}</article>)}{entry.senses.length > 2 && !all && <button className="selection-dictionary-more" type="button" onClick={() => setAll(true)}>{t.more} ({entry.senses.length})</button>}</>}
        </>}
      </div>
      {online ? <a className="selection-dictionary-online" href={onlineDictionaryUrl(term, defaultId)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{t.online}</a> : <p className="selection-dictionary-online muted">{t.offline}</p>}
    </section>}
  </div>;
}
