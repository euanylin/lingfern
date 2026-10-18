import type { AuthEnv } from '../../worker/auth';

// Isolated workerd fixture only. No upstream network fallback or real credentials.
const owner = { id: 1, login: 'synthetic', type: 'User' };
const nativeFetch = globalThis.fetch;
const repository = { id: 21, name: 'lingfern-data', owner, private: true, fork: false, archived: false, disabled: false, default_branch: 'main', permissions: { pull: true, push: true } };
const installation = { id: 31, account: owner, repository_selection: 'selected', permissions: { contents: 'write', metadata: 'read' }, suspended_at: null };
const blobs = new Map<string, string>();
const records = new Map<string, { content: string; sha: string }>();
type Entry = { path: string; type: string; mode: string; sha: string; size: number };
const snapshots = new Map<string, Entry[]>();
let marker: string | undefined, serial = 1, writes = 0, lost = false, revokeOnPut = false;
let lastFailure = '', calls = 0, redirecting = false;
const sha = () => (++serial).toString(16).padStart(40, '0');
const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function fixtureControl(request: Request, env: AuthEnv) {
  const mode = new URL(request.url).searchParams.get('mode');
  if (mode === 'local-redirect') return Response.redirect('http://127.0.0.1:8792/forbidden', 302);
  if (mode === 'native-manual') { const response = await nativeFetch('http://127.0.0.1:8791/__fixture?mode=local-redirect', { redirect: 'manual', headers: { Authorization: 'Bearer synthetic-local-probe' } }); return json({ status: response.status }); }
  if (mode === 'native-redirect') { try { await nativeFetch('http://127.0.0.1:8791/__fixture?mode=stats', { redirect: 'error' }); return json({ nativeRedirect: 'accepted' }); } catch (error) { return json({ nativeRedirect: error instanceof Error ? error.message : 'unknown' }); } }
  if (mode === 'diagnostic') return json({ lastFailure, calls });
  if (mode === 'lost') lost = true;
  else if (mode === 'redirect') redirecting = true;
  else if (mode === 'clear-redirect') redirecting = false;
  else if (mode === 'revoke-on-put') revokeOnPut = true;
  else if (mode === 'restore') await env.AUTH_DB!.prepare('UPDATE accounts SET revoked=0 WHERE id=1').run();
  else if (mode === 'conflict') {
    const [path, item] = [...records][0];
    const batch = JSON.parse(atob(item.content));
    batch.events[0].payload.correct = !batch.events[0].payload.correct;
    const content = btoa(JSON.stringify(batch)), next = sha();
    records.set(path, { content, sha: next }); blobs.set(next, content);
  } else if (mode !== 'stats') return json({ error: 'FIXTURE_MODE' }, 400);
  return json({ writes, paths: [...records.keys()], serial, calls });
}

export function installProvider(env: AuthEnv) {
  globalThis.fetch = async (input, init) => {
    try {
    calls++;
    const request = new Request(input, init), url = new URL(request.url);
    if (url.origin !== 'https://api.github.com') throw new Error('SYNTHETIC_PROVIDER_NO_NETWORK');
    if (request.redirect !== 'manual') throw new Error('SYNTHETIC_PROVIDER_REDIRECT_MODE');
    if (redirecting) return Response.redirect('http://127.0.0.1:8792/forbidden', 302);
    const access = request.headers.get('Authorization');
    if (!['Bearer synthetic-access-1', 'Bearer synthetic-access-2'].includes(access ?? '')) return json({}, 401);
    const path = decodeURIComponent(url.pathname);
    if (path === '/user') return json(access?.endsWith('-2') ? { ...owner, id: 2, login: 'synthetic2' } : owner);
    if (path === '/user/installations') return json({ total_count: 1, installations: [installation] });
    if (path === '/user/installations/31/repositories') return json({ total_count: 1, repositories: [repository] });
    if (path === '/repos/synthetic/lingfern-data') return json(repository);
    const prefix = '/repos/synthetic/lingfern-data/';
    if (path.startsWith(prefix + 'commits/')) {
      const ref = path.slice((prefix + 'commits/').length), commit = ref === 'main' ? sha() : ref;
      if (ref === 'main') snapshots.set(commit, [{ path: 'README.md', type: 'blob', mode: '100644', sha: 'a'.repeat(40), size: 10 }, ...(marker ? [{ path: 'profile.json', type: 'blob', mode: '100644', sha: 'b'.repeat(40), size: atob(marker).length }] : []), ...[...records].map(([path, item]) => ({ path, type: 'blob', mode: '100644', sha: item.sha, size: atob(item.content).length }))]);
      return snapshots.has(commit) ? json({ sha: commit, commit: { tree: { sha: commit } } }) : json({}, 404);
    }
    if (path.startsWith(prefix + 'git/trees/')) return json({ truncated: false, tree: snapshots.get(path.slice((prefix + 'git/trees/').length)) ?? [] });
    if (path === prefix + 'git/blobs/' + 'b'.repeat(40) && marker) return json({ encoding: 'base64', content: marker });
    if (path.startsWith(prefix + 'git/blobs/')) {
      const content = blobs.get(path.slice((prefix + 'git/blobs/').length));
      return content ? json({ encoding: 'base64', content }) : json({}, 404);
    }
    if (path.startsWith(prefix + 'contents/') && request.method === 'PUT') {
      const file = path.slice((prefix + 'contents/').length), body = await request.json() as { content: string; branch: string; sha?: string };
      if (body.sha !== undefined || body.branch !== 'main') throw new Error('SYNTHETIC_PROVIDER_UNSAFE_WRITE');
      if (file === 'profile.json') {
        if (marker) return json({}, 422);
        marker = body.content; return json({ content: { sha: 'b'.repeat(40) } }, 201);
      }
      if (!/^records\/[\w-]+\/[\w-]+\.json$/.test(file)) throw new Error('SYNTHETIC_PROVIDER_PATH');
      if (records.has(file)) return json({}, 422);
      const id = sha(); records.set(file, { content: body.content, sha: id }); blobs.set(id, body.content); writes++;
      if (revokeOnPut) { revokeOnPut = false; await env.AUTH_DB!.prepare('UPDATE accounts SET revoked=1 WHERE id=1').run(); }
      if (lost) { lost = false; throw new Error('SYNTHETIC_PROVIDER_LOST_ACK'); }
      return json({ content: { sha: id } }, 201);
    }
    throw new Error('SYNTHETIC_PROVIDER_UNEXPECTED_PATH');
    } catch (error) { lastFailure = error instanceof Error ? error.message : 'unknown'; throw error; }
  };
}
