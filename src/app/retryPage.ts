export async function retryPage(signal: AbortSignal) {
  if (signal.aborted) throw signal.reason ?? new DOMException('Cancelled', 'AbortError');
  const current = location.href;
  const modules = new Set<string>();
  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]')) {
    try {
      const url = new URL(link.href, current);
      if (['https:', 'http:'].includes(url.protocol) && url.origin === location.origin && /^\/assets\/[\w.-]+\.js$/.test(url.pathname) && !url.search && !url.hash) modules.add(url.href);
    } catch { /* Ignore malformed links outside the build's public module list. */ }
  }
  const request = new AbortController(), abort = () => request.abort(signal.reason);
  signal.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(() => request.abort(new DOMException('Module retry timed out', 'TimeoutError')), 10000);
  try {
    await Promise.all([...modules].map(async url => {
      // Reload replaces WebKit's cached preload failure; no-store leaves it poisoned.
      const response = await fetch(url, { cache: 'reload', credentials: 'omit', redirect: 'error', signal: request.signal });
      // Missing old hashes need fresh HTML instead of a successful old-asset fetch.
      if (response.status === 404 || response.status === 410) { await response.body?.cancel(); return; }
      if (!response.ok || !/^(?:text|application)\/(?:javascript|ecmascript)(?:;|$)/i.test(response.headers.get('Content-Type') ?? '')) {
        await response.body?.cancel();
        throw new Error('MODULE_RETRY_FAILED');
      }
      await response.arrayBuffer();
    }));
    if (request.signal.aborted) throw request.signal.reason ?? new DOMException('Cancelled', 'AbortError');
    if (location.href === current) location.reload();
  } finally { request.abort(); clearTimeout(timeout); signal.removeEventListener('abort', abort); }
}
