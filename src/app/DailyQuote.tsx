import { contentText, messages } from '../locales';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { localDay, quoteSourceUrl } from '../core/dailyQuoteFormat';
import type { dailyQuoteOnDemand } from '../core/dailyQuoteOnDemand';
import type { Locale } from '../shared/content';
import { retryPage } from './retryPage';

const labels = messages('dailyQuote');
export type DailyQuoteSelection = Awaited<ReturnType<typeof dailyQuoteOnDemand>>;
let preparedQuote: { day: string; previous?: string; promise: Promise<DailyQuoteSelection>; cancel?: () => void } | undefined;
function discardPreparedQuote() {
  preparedQuote?.cancel?.();
  preparedQuote = undefined;
  window.removeEventListener('popstate', discardPreparedQuote);
  window.removeEventListener('pagehide', discardPreparedQuote);
}

export function prepareDailyQuote() {
  if (typeof window === 'undefined' || location.pathname !== '/introduction' || location.search || preparedQuote) return;
  let previous: string | undefined;
  try { previous = localStorage.getItem('lingfern:last-daily-quote') ?? undefined; } catch { /* Allow disabled storage. */ }
  const date = new Date();
  const load = () => import('../core/dailyQuoteOnDemand').then(module => module.dailyQuoteOnDemand(date, previous));
  let cancel: (() => void) | undefined;
  // Let the existing SSR body paint first when the entry arrives before FCP.
  const promise = performance.getEntriesByName('first-contentful-paint', 'paint').length ? load() : new Promise<DailyQuoteSelection>((resolve, reject) => {
    let frame = 0, task = 0, started = false, observer: PerformanceObserver | undefined;
    const start = () => {
      if (started) return;
      started = true; observer?.disconnect();
      if (location.pathname !== '/introduction' || location.search) { reject(new DOMException('Cancelled', 'AbortError')); return; }
      void load().then(resolve, reject);
    };
    cancel = () => { started = true; observer?.disconnect(); cancelAnimationFrame(frame); clearTimeout(task); reject(new DOMException('Cancelled', 'AbortError')); };
    // The first-visit shell has no content to paint before Welcome arrives.
    if (document.getElementById('root')?.dataset.publicPage && typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('paint')) {
      try {
        observer = new PerformanceObserver(list => { if (list.getEntries().some(entry => entry.name === 'first-contentful-paint')) start(); });
        observer.observe({ type: 'paint', buffered: true });
        return;
      } catch { observer?.disconnect(); observer = undefined; }
    }
    frame = requestAnimationFrame(() => { frame = 0; task = window.setTimeout(() => {
      task = 0;
      start();
    }, 0); });
  });
  // Handle early failures now; the consuming component still receives the original rejection.
  void promise.catch(() => {});
  preparedQuote = { day: localDay(date), previous, promise, cancel };
  window.addEventListener('popstate', discardPreparedQuote, { once: true });
  window.addEventListener('pagehide', discardPreparedQuote, { once: true });
}

export function takePreparedDailyQuote(date: Date, previous?: string) {
  const prepared = preparedQuote;
  const matches = prepared && typeof window !== 'undefined' && location.pathname === '/introduction' && !location.search && prepared.day === localDay(date) && prepared.previous === previous;
  if (prepared) { if (matches) prepared.cancel = undefined; discardPreparedQuote(); }
  return matches ? prepared.promise : undefined;
}

export function quoteNeedsExpansion(fullHeight: number, lineHeight: number) {
  return Number.isFinite(fullHeight) && Number.isFinite(lineHeight) && lineHeight > 0 && fullHeight > lineHeight * 4 + 1;
}

export function DailyQuote({ locale, onDayChange, initialSelection, onSelection }: { locale: Locale; onDayChange: (day: string) => void; initialSelection?: DailyQuoteSelection; onSelection?: (selection: DailyQuoteSelection) => void }) {
  const [selection, setSelection] = useState<DailyQuoteSelection>(initialSelection);
  const current = useRef(selection);
  const request = useRef(0);
  const pendingDay = useRef<string | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const retryController = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => retryController.current?.abort(), []);
  async function retry() {
    if (retryController.current) return;
    const controller = new AbortController(); retryController.current = controller;
    setRetrying(true);
    try { await retryPage(controller.signal); }
    catch { /* Keep the existing error visible for another explicit retry. */ }
    finally { retryController.current = undefined; if (!controller.signal.aborted) setRetrying(false); }
  }
  async function choose() {
    const token = ++request.current;
    setLoading(true); setFailed(false);
    let previous = current.current?.quote.id;
    try { previous ??= localStorage.getItem('lingfern:last-daily-quote') ?? undefined; } catch { /* Allow browsers with disabled storage. */ }
    try {
      const date = new Date();
      pendingDay.current = localDay(date);
      const prepared = takePreparedDailyQuote(date, previous);
      const next = prepared ? await prepared : await (await import('../core/dailyQuoteOnDemand')).dailyQuoteOnDemand(date, previous);
      if (token === request.current) { current.current = next; setSelection(next); onSelection?.(next); }
    } catch { if (token === request.current) setFailed(true); }
    finally { if (token === request.current) { pendingDay.current = undefined; setLoading(false); } }
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
    document.fonts?.addEventListener('loadingdone', measure);
    void document.fonts?.ready.then(measure);
    return () => { disposed = true; observer.disconnect(); document.fonts?.removeEventListener('loadingdone', measure); };
  }, [selection?.quote.id, locale]);
  useEffect(() => {
    setExpandedId(undefined);
    try { if (selection) localStorage.setItem('lingfern:last-daily-quote', selection.quote.id); } catch { /* Display quotes even when storage fails. */ }
  }, [selection?.quote.id]);
  useEffect(() => {
    const refresh = () => {
      const day = localDay(new Date()); onDayChange(day);
      if (day !== current.current?.day && day !== pendingDay.current) void chooseRef.current();
    };
    refresh();
    const timer = window.setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => { request.current++; pendingDay.current = undefined; clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [onDayChange]);
  if (!selection) return <section className="daily-quote"><p role="status">{failed ? t.loadError : t.loading}</p>{failed && <button disabled={retrying} aria-busy={retrying} onClick={() => void retry()}>{messages('app')[locale].retry}</button>}</section>;
  const expanded = expandedId === selection.quote.id;
  const canExpand = overflow && overflow.id === selection.quote.id && overflow.needed;
  return <section className="daily-quote" aria-labelledby="daily-quote-title" data-quote-id={selection.quote.id}>
    {failed && <p role="status">{t.loadError} <button disabled={retrying} aria-busy={retrying} onClick={() => void retry()}>{messages('app')[locale].retry}</button></p>}
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
