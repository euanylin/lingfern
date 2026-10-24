import { useCallback, useEffect, useRef, useState } from 'react';
import { disconnectSummarySchema, sessionSummarySchema, type SessionSummary } from '../shared/auth';

type IdentityState = { summary?: SessionSummary; status: 'loading' | 'ready' | 'unavailable' | 'failed' };

// Keep display state in this app instance; protected operations still verify their session.
export function useGithubSession(active: boolean) {
  const [state, setState] = useState<IdentityState>({ status: 'loading' });
  const request = useRef<AbortController | undefined>(undefined);
  const mutating = useRef(false);
  const channel = useRef<BroadcastChannel | undefined>(undefined);
  const refresh = useCallback(async () => {
    if (mutating.current) return;
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
  const endSession = useCallback(async (action: 'logout' | 'disconnect'): Promise<'done' | 'partial' | 'failed' | undefined> => {
    const { summary, status } = state;
    if (mutating.current || status !== 'ready' || !summary?.csrfToken) return;
    request.current?.abort();
    const abort = new AbortController(); request.current = abort; mutating.current = true;
    setState({ summary, status: 'loading' });
    try {
      const response = await fetch(`/api/auth/${action}`, { method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(30_000)]), headers: { 'X-CSRF-Token': summary.csrfToken, ...(action === 'disconnect' && { 'Content-Type': 'application/json' }) }, ...(action === 'disconnect' && { body: JSON.stringify({ confirm: true }) }) });
      if (!response.ok) throw new Error('SESSION_END');
      const result = action === 'disconnect' ? disconnectSummarySchema.parse(await response.json()) : undefined;
      if (abort.signal.aborted) return;
      setState({ summary: { account: null, syncAvailable: false }, status: 'ready' });
      channel.current?.postMessage('ended');
      return result?.providerRevoked === false ? 'partial' : 'done';
    } catch { if (!abort.signal.aborted) { setState({ summary, status: 'failed' }); return 'failed'; } }
    finally { if (request.current === abort) { request.current = undefined; mutating.current = false; } }
  }, [state]);
  useEffect(() => {
    const wake = () => { if (document.visibilityState === 'visible' && navigator.onLine && !request.current) void refresh(); };
    const changes = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('lingfern-identity') : undefined;
    channel.current = changes;
    if (changes) changes.onmessage = event => {
      if (event.data !== 'ended') return;
      request.current?.abort(); request.current = undefined; mutating.current = false;
      setState({ status: navigator.onLine ? 'loading' : 'failed' });
      if (navigator.onLine) void refresh();
    };
    void refresh();
    window.addEventListener('online', wake); document.addEventListener('visibilitychange', wake);
    return () => { request.current?.abort(); request.current = undefined; mutating.current = false; changes?.close(); channel.current = undefined; window.removeEventListener('online', wake); document.removeEventListener('visibilitychange', wake); };
  }, [refresh]);
  useEffect(() => { if (active && !request.current) void refresh(); }, [active, refresh]);
  return { ...state, refresh, endSession };
}
