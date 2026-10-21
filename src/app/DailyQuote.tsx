import { contentText, messages } from '../locales';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { localDay, quoteSourceUrl } from '../core/dailyQuoteSelection';
import { dailyQuoteOnDemand } from '../core/dailyQuoteOnDemand';
import type { Locale } from '../shared/content';

const labels = messages('dailyQuote');

export function quoteNeedsExpansion(fullHeight: number, lineHeight: number) {
  return Number.isFinite(fullHeight) && Number.isFinite(lineHeight) && lineHeight > 0 && fullHeight > lineHeight * 4 + 1;
}

export function DailyQuote({ locale, onDayChange }: { locale: Locale; onDayChange: (day: string) => void }) {
  const [selection, setSelection] = useState<Awaited<ReturnType<typeof dailyQuoteOnDemand>>>();
  const current = useRef<typeof selection>(undefined);
  const request = useRef(0);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  async function choose() {
    const token = ++request.current;
    setLoading(true); setFailed(false);
    let previous = current.current?.quote.id;
    try { previous ??= localStorage.getItem('lingfern:last-daily-quote') ?? undefined; } catch { /* Allow browsers with disabled storage. */ }
    try {
      const next = await dailyQuoteOnDemand(new Date(), previous);
      if (token === request.current) { current.current = next; setSelection(next); }
    } catch { if (token === request.current) setFailed(true); }
    finally { if (token === request.current) setLoading(false); }
  }
  const chooseRef = useRef(choose); chooseRef.current = choose;
  const t = labels[locale];
  const [expandedId, setExpandedId] = useState<string>();
  const quoteElement = useRef<HTMLQuoteElement>(null);
  const [overflow, setOverflow] = useState<{ id: string; needed: boolean }>();
  useLayoutEffect(() => {
    const element = quoteElement.current, id = selection?.quote.id;
    if (!element || !id) return;
    let disposed = false, observedWidth: number | undefined;
    const measure = () => {
      if (disposed) return;
      // Measure overflow without expanding the page during browser-bar motion.
      const needed = quoteNeedsExpansion(element.scrollHeight, parseFloat(getComputedStyle(element).lineHeight));
      setOverflow(current => current && current.id === id && current.needed === needed ? current : { id, needed });
    };
    measure();
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined && (observedWidth === undefined || Math.abs(width - observedWidth) > .1)) { observedWidth = width; measure(); }
    });
    observer.observe(element);
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    document.fonts?.addEventListener('loadingdone', measure);
    void document.fonts?.ready.then(measure);
    return () => { disposed = true; observer.disconnect(); window.removeEventListener('resize', measure); window.visualViewport?.removeEventListener('resize', measure); document.fonts?.removeEventListener('loadingdone', measure); };
  }, [selection?.quote.id, locale]);
  useEffect(() => {
    setExpandedId(undefined);
    try { if (selection) localStorage.setItem('lingfern:last-daily-quote', selection.quote.id); } catch { /* Display quotes even when storage fails. */ }
  }, [selection?.quote.id]);
  useEffect(() => {
    const refresh = () => {
      const day = localDay(new Date()); onDayChange(day);
      if (day !== current.current?.day) void chooseRef.current();
    };
    refresh();
    const timer = window.setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => { request.current++; clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [onDayChange]);
  if (!selection) return <section className="daily-quote"><p role="status">{failed ? t.loadError : t.loading}</p>{failed && <button onClick={() => location.reload()}>{messages('app')[locale].retry}</button>}</section>;
  const expanded = expandedId === selection.quote.id;
  const canExpand = overflow && overflow.id === selection.quote.id && overflow.needed;
  return <section className="daily-quote" aria-labelledby="daily-quote-title" data-quote-id={selection.quote.id}>
    {failed && <p role="status">{t.loadError} <button onClick={() => location.reload()}>{messages('app')[locale].retry}</button></p>}
    <div className="daily-quote-heading"><h2 id="daily-quote-title" className="sr-only">{t.title}</h2></div>
    <blockquote ref={quoteElement} data-expanded={expanded} key={selection.quote.id} id="daily-quote-text" lang="en-US" dir="ltr" aria-live="polite">{selection.quote.text}</blockquote>
    {canExpand && <button type="button" className="update-action" aria-expanded={expanded} aria-controls="daily-quote-text" onClick={() => setExpandedId(expanded ? undefined : selection.quote.id)}>{expanded ? t.collapse : t.expand}</button>}
    <div className="daily-quote-source-row">
      <div className="daily-quote-credit">
        <p className="daily-quote-attribution" lang="en"><a href={quoteSourceUrl(selection.quote)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{selection.quote.pageTitle}{selection.quote.locator && <> · <cite>{selection.quote.locator}</cite></>}</a></p>
        {selection.event && <p className="daily-quote-event"><a href={selection.event.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{contentText(selection.event.labels, locale)}</a></p>}
        {'kind' in selection.quote.rightsEvidence && selection.quote.rightsEvidence.kind === 'cc-by-4.0' && <p className="daily-quote-license"><a href={selection.quote.rightsEvidence.rightsUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">CC BY 4.0</a></p>}
      </div>
      <button type="button" className="daily-quote-next" aria-label={t.next} aria-disabled={loading} aria-busy={loading} onClick={() => { if (!loading) void choose(); }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 17.9 17"/></svg></button>
    </div>
  </section>;
}
