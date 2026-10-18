import { request } from '@octokit/request';
import { boundedBody } from './auth';

// Only the Worker imports Octokit. Bound bodies before the library parses untrusted JSON.
export function github(access: string) {
  return request.defaults({ baseUrl: 'https://api.github.com', headers: { authorization: `Bearer ${access}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'Lingfern' }, request: { fetch: async (url: string, init: RequestInit) => {
    if (new URL(url).origin !== 'https://api.github.com') throw new Error('GITHUB_ORIGIN');
    const response = await fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(15_000) });
    if (response.status >= 300 && response.status < 400) { await response.body?.cancel(); throw new Error('GITHUB_REDIRECT'); }
    if (!response.body) return response;
    const body = await boundedBody(response.body, 2 * 1024 * 1024);
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  }, log: { debug() {}, info() {}, warn() {}, error() {} } } });
}
