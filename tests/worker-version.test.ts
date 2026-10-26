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
