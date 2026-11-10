import { expect, it, vi } from 'vitest';
import worker from '../worker/index';
import { prerenderPath, renderPageHtml } from '../src/shared/seo';

// The OAuth provider's cloudflare: runtime is covered by the workerd integration tests.
vi.mock('../worker/oauth', () => ({ oauthRoute: async () => null }));

it('marks the actual HTML Worker version while retaining document bodies and route cache policy', async () => {
  const id = '22222222-2222-4222-8222-222222222222';
  const shell = '<head><!--seo:start--><!--seo:end--></head><body>exact shell bytes</body>';
  const publicPage = shell.replace('exact shell bytes', 'exact public bytes');
  const fetch = vi.fn(async (request: Request) => new Response(request.method === 'POST' ? null : new URL(request.url).pathname === prerenderPath('/library/ipa') ? publicPage : shell, {
    status: request.method === 'POST' ? 405 : 200,
    headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache', 'Content-Security-Policy': "frame-ancestors 'none'" },
  }));
  const env = { LOCAL_AUTH: 'true', CF_VERSION_METADATA: { id }, ASSETS: { fetch } } as unknown as Parameters<typeof worker.fetch>[1];
  const ctx = {} as ExecutionContext;
  const handle = (request: Request) => worker.fetch(request as Parameters<typeof worker.fetch>[0], env, ctx);
  const response = await handle(new Request('https://lingfern.com/today', { headers: { Accept: 'text/html' } }));
  expect(response.status).toBe(200); expect(response.headers.get('X-Lingfern-Version')).toBe(id);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store'); expect(response.headers.get('Content-Security-Policy')).toBe("frame-ancestors 'none'");
  expect(await response.text()).toBe(renderPageHtml(shell, '/today'));
  expect(fetch.mock.calls[0][0].url).toBe('https://lingfern.com/');
  const publicResponse = await handle(new Request('https://lingfern.com/library/ipa'));
  expect(publicResponse.headers.get('X-Lingfern-Version')).toBe(id);
  expect(publicResponse.headers.get('Cache-Control')).toBe('no-cache');
  expect(publicResponse.headers.get('Content-Security-Policy')).toBe("frame-ancestors 'none'");
  expect(await publicResponse.text()).toBe(renderPageHtml(publicPage, '/library/ipa'));
  expect(fetch.mock.calls[1][0].url).toBe('https://lingfern.com' + prerenderPath('/library/ipa'));
  const asset = await handle(new Request('https://lingfern.com/assets/a.js'));
  expect(asset.headers.has('X-Lingfern-Version')).toBe(false);
  const wrongMethod = await handle(new Request('https://lingfern.com/today', { method: 'POST', headers: { Accept: 'text/html' } }));
  expect(wrongMethod.status).toBe(405); expect(wrongMethod.headers.has('X-Lingfern-Version')).toBe(false);
  const unknownApi = await handle(new Request('https://lingfern.com/api/unknown'));
  expect(unknownApi.status).toBe(404); expect(unknownApi.headers.has('X-Lingfern-Version')).toBe(false);
});

it('redirects only known trailing-slash pages and gives document 404s a return link', async () => {
  const missing = '<h1>Page not found</h1><a href="/today">Back to Today</a>';
  const fetch = vi.fn(async (request: Request) => new URL(request.url).pathname === '/404' ? new Response(missing, { headers: { 'Content-Type': 'text/html' } }) : new Response(null, { status: 404 }));
  const env = { LOCAL_AUTH: 'true', ASSETS: { fetch } } as unknown as Parameters<typeof worker.fetch>[1];
  const handle = (path: string, method = 'GET', accept = 'text/html') => worker.fetch(new Request('https://lingfern.com' + path, { method, headers: { Accept: accept } }) as Parameters<typeof worker.fetch>[0], env, {} as ExecutionContext);
  for (const path of ['/introduction', '/today', '/library', '/settings', '/settings/about', '/learn/valid-session']) {
    const response = await handle(path + '/?q=one%20two&x=1');
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe('https://lingfern.com' + path + '?q=one%20two&x=1');
  }
  const response = await handle('/unknown');
  expect(response.status).toBe(404); expect(await response.text()).toBe(missing);
  const head = await handle('/unknown', 'HEAD'); expect(head.status).toBe(404); expect(await head.text()).toBe('');
  expect(await (await handle('/missing.html')).text()).toBe(missing);
  for (const path of ['/missing.js', '/missing.zip']) expect(await (await handle(path, 'GET', '*/*')).text()).toBe('');
  const api = await handle('/api/missing'); expect(api.status).toBe(404); expect(api.headers.get('Content-Type')).toContain('application/json');
});
