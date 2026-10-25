import { useCallback, useEffect, useRef, useState } from 'react';
import { disconnectSummarySchema, sessionSummarySchema, type SessionSummary } from '../shared/auth';

type IdentityState = { summary?: SessionSummary; status: 'loading' | 'ready' | 'unavailable' | 'failed' };

// Keep display state in this app instance; protected operations still verify their session.
export function useGithubSession(active: boolean) {
  const [state, setState] = useState<IdentityState>({ status: 'loading' });
  const request = useRef<AbortController | undefined>(undefined);
  const mutating = useRef(false);
  const channel = useRef<BroadcastChannel | undefined>(undefined);
  const retries = useRef(0), ending = useRef(false);
  const refresh = useCallback(async (automatic = false) => {
    if (mutating.current) return;
    if (!automatic) retries.current = 0;
    ending.current = false;
    request.current?.abort();
    const abort = new AbortController(); request.current = abort;
    setState(previous => previous.status === 'ready' ? previous : { ...previous, status: 'loading' });
    try {
      const response = await fetch('/api/session', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(10000)]) });
      if (response.status === 503 && (await response.json() as { error?: string }).error === 'AUTH_NOT_CONFIGURED') {
        if (!abort.signal.aborted) setState({ status: 'unavailable' });
        return;
      }
      if (!response.ok) throw new Error('SESSION');
      const summary = sessionSummarySchema.parse(await response.json());
      // Retain unchanged bindings so revalidation does not rebuild local profile choices.
      if (!abort.signal.aborted) setState(previous => previous.status === 'ready' && JSON.stringify(previous.summary) === JSON.stringify(summary) ? previous : { summary, status: 'ready' });
    } catch { if (!abort.signal.aborted) setState(previous => ({ ...previous, status: 'failed' })); }
    finally { if (request.current === abort) request.current = undefined; }
  }, []);
  const endSession = useCallback(async (): Promise<'done' | 'partial' | 'failed' | undefined> => {
    const { summary, status } = state;
    if (mutating.current || status !== 'ready' || !summary?.csrfToken) return;
    request.current?.abort();
    const abort = new AbortController(); request.current = abort; mutating.current = true;
    ending.current = true;
    channel.current?.postMessage('ending');
    setState({ summary, status: 'loading' });
    try {
      const response = await fetch('/api/auth/disconnect', { method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(30_000)]), headers: { 'X-CSRF-Token': summary.csrfToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true }) });
      if (!response.ok) throw new Error('SESSION_END');
      const result = disconnectSummarySchema.parse(await response.json());
      if (abort.signal.aborted) return;
      ending.current = false;
      setState({ summary: { account: null, syncAvailable: false }, status: 'ready' });
      channel.current?.postMessage('ended');
      return result.providerRevoked === false ? 'partial' : 'done';
    } catch { if (!abort.signal.aborted) { setState({ summary, status: 'failed' }); channel.current?.postMessage('changed'); return 'failed'; } }
    finally { if (request.current === abort) { request.current = undefined; mutating.current = false; } }
  }, [state]);
  useEffect(() => {
    let endingTimer: ReturnType<typeof setTimeout> | undefined;
    const wake = () => { if (!ending.current && document.visibilityState === 'visible' && navigator.onLine && !request.current) void refresh(); };
    const changes = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('lingfern-identity') : undefined;
    channel.current = changes;
    if (changes) changes.onmessage = event => {
      if (!['ending', 'ended', 'changed'].includes(event.data)) return;
      clearTimeout(endingTimer);
      request.current?.abort(); request.current = undefined; mutating.current = false;
      if (event.data === 'ending') {
        ending.current = true; setState({ status: 'loading' });
        // Recover if the tab ending the session closes before it can report the result.
        endingTimer = setTimeout(() => { ending.current = false; if (navigator.onLine) void refresh(); else setState({ status: 'failed' }); }, 35000);
        return;
      }
      setState({ status: navigator.onLine ? 'loading' : 'failed' });
      if (navigator.onLine) void refresh();
    };
    void refresh();
    window.addEventListener('online', wake); document.addEventListener('visibilitychange', wake);
    return () => { clearTimeout(endingTimer); request.current?.abort(); request.current = undefined; mutating.current = false; changes?.close(); channel.current = undefined; window.removeEventListener('online', wake); document.removeEventListener('visibilitychange', wake); };
  }, [refresh]);
  useEffect(() => {
    if (state.status === 'ready' || state.status === 'unavailable') { retries.current = 0; return; }
    if (state.status !== 'failed' || ending.current || !navigator.onLine || retries.current >= 2) return;
    const timer = setTimeout(() => { if (navigator.onLine) { retries.current++; void refresh(true); } }, 2000 * 2 ** retries.current);
    return () => clearTimeout(timer);
  }, [state, refresh]);
  useEffect(() => { if (active && !ending.current && !request.current) void refresh(); }, [active, refresh]);
  return { ...state, refresh, endSession };
}
