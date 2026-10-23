import { useCallback, useEffect, useRef, useState } from 'react';
import { sessionSummarySchema, type SessionSummary } from '../shared/auth';

type IdentityState = { summary?: SessionSummary; status: 'loading' | 'ready' | 'unavailable' | 'failed' };

// Keep display state in this app instance; protected operations still verify their session.
export function useGithubSession(active: boolean) {
  const [state, setState] = useState<IdentityState>({ status: 'loading' });
  const request = useRef<AbortController | undefined>(undefined);
  const mutating = useRef(false);
  const update = useCallback((next: IdentityState) => {
    request.current?.abort(); request.current = undefined;
    mutating.current = next.status === 'loading';
    setState(next);
  }, []);
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
      if (!abort.signal.aborted) setState({ summary, status: 'ready' });
    } catch { if (!abort.signal.aborted) setState(previous => ({ ...previous, status: 'failed' })); }
    finally { if (request.current === abort) request.current = undefined; }
  }, []);
  useEffect(() => {
    const wake = () => { if (document.visibilityState === 'visible' && navigator.onLine && !request.current) void refresh(); };
    void refresh();
    window.addEventListener('online', wake); document.addEventListener('visibilitychange', wake);
    return () => { request.current?.abort(); request.current = undefined; window.removeEventListener('online', wake); document.removeEventListener('visibilitychange', wake); };
  }, [refresh]);
  useEffect(() => { if (active && !request.current) void refresh(); }, [active, refresh]);
  return { ...state, refresh, update };
}
