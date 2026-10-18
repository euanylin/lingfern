import { sessionSummarySchema } from '../src/shared/auth';
import { repositoryBindingSchema } from '../src/shared/repository';
import { syncChangesSchema, validateSyncBatch } from '../src/shared/sync';
import { repositoryRoute } from '../worker/repository';
import { webhookRoute } from '../worker/webhook';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach, expect, test, vi } from 'vitest';
import { authRoute, digest, githubJson, githubToken, randomSecret, revokeAccount, sealTokens, type AuthEnv } from '../worker/auth';
import { github } from '../worker/github';

function environment() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('worker/migrations/0001_identity.sql', 'utf8'));
  sqlite.exec(readFileSync('worker/migrations/0002_token_refresh.sql', 'utf8'));
  sqlite.exec(readFileSync('worker/migrations/0003_repository_binding.sql', 'utf8'));
  sqlite.exec(readFileSync('worker/migrations/0004_binding_confirmation.sql', 'utf8'));
  sqlite.exec(readFileSync('worker/migrations/0005_repository_revocation.sql', 'utf8'));
  sqlite.exec(readFileSync('worker/migrations/0006_binding_generation.sql', 'utf8'));
  sqlite.exec(readFileSync('worker/migrations/0007_temporary_sharing.sql', 'utf8'));
  // Minimal D1 adapter backed by real SQLite, including atomic DELETE RETURNING.
  const database = {
    prepare(sql: string) {
      let values: (string | number)[] = [];
      const query = { bind(...parameters: (string | number)[]) { values = parameters; return query; }, async first() { return sqlite.prepare(sql).get(...values) ?? null; }, async run() { return sqlite.prepare(sql).run(...values); }, async all() { return { results: sqlite.prepare(sql).all(...values) }; } };
      return query;
    },
    async batch(queries: { run(): Promise<unknown> }[]) { sqlite.exec('BEGIN'); try { const result = []; for (const query of queries) result.push(await query.run()); sqlite.exec('COMMIT'); return result; } catch (error) { sqlite.exec('ROLLBACK'); throw error; } },
  };
  const env: AuthEnv = { AUTH_DB: database as unknown as D1Database, LOCAL_AUTH: 'true', GITHUB_CLIENT_ID: 'test-app', GITHUB_CLIENT_SECRET: 'test-secret', TOKEN_ENCRYPTION_KEY: btoa('k'.repeat(32)) };
  return { env, sqlite };
}
afterEach(() => vi.unstubAllGlobals());
const request = (path: string, init?: RequestInit) => new Request(`http://127.0.0.1:8787${path}`, init);

async function start(env: AuthEnv) {
  const response = (await authRoute(request('/api/auth/start'), env))!;
  const target = new URL(response.headers.get('Location')!);
  const cookie = response.headers.get('Set-Cookie')!.split(';')[0];
  return { response, target, cookie };
}

test('OAuth binds PKCE state to the browser, consumes it once and never exposes upstream tokens', async () => {
  const { env, sqlite } = environment();
  const flow = await start(env);
  expect(flow.target.origin).toBe('https://github.com');
  expect(flow.target.searchParams.get('code_challenge_method')).toBe('S256');
  expect(flow.target.searchParams.has('scope')).toBe(false);
  const state = flow.target.searchParams.get('state')!;
  const stored = sqlite.prepare('SELECT * FROM auth_states').get()!;
  expect(stored.hash).toBe(await digest(state));
  expect(flow.target.searchParams.get('code_challenge')).toBe(await digest(stored.verifier as string));
  const callback = `/api/auth/callback?state=${state}&code=test-code`;
  expect((await authRoute(request(callback), env))!.status).toBe(400);
  expect(sqlite.prepare('SELECT count(*) AS n FROM auth_states').get()!.n).toBe(1);
  const upstream = vi.fn(async (url: string, init: RequestInit) => {
    if (url.includes('access_token')) {
      expect(new URLSearchParams(init.body as URLSearchParams).get('code_verifier')).toBe(stored.verifier);
      return Response.json({ access_token: 'private-access', refresh_token: 'private-refresh', expires_in: 28800, token_type: 'bearer' });
    }
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer private-access');
    return Response.json({ id: 1234, login: 'learner' });
  });
  vi.stubGlobal('fetch', upstream);
  const response = (await authRoute(request(callback, { headers: { Cookie: flow.cookie } }), env))!;
  expect(response.status).toBe(303);
  expect(response.headers.get('Location')).toBe('/settings');
  expect(response.headers.get('Set-Cookie')).not.toMatch(/private-access|private-refresh/);
  const encrypted = sqlite.prepare('SELECT encrypted_tokens FROM accounts').get()!.encrypted_tokens as string;
  expect(encrypted).not.toContain('private-access');
  expect((await authRoute(request(callback, { headers: { Cookie: flow.cookie } }), env))!.status).toBe(400);
  expect(upstream).toHaveBeenCalledTimes(2);
  const sessionCookie = response.headers.getSetCookie().find(value => value.startsWith('lingfern_local_session='))!.split(';')[0];
  const summary = await (await authRoute(request('/api/session', { headers: { Cookie: sessionCookie } }), env))!.json() as { csrfToken: string; account: { id: number } };
  expect(summary.account.id).toBe(1234);
  expect(JSON.stringify(summary)).not.toContain('private');
  expect((await authRoute(request('/api/auth/logout', { method: 'POST', headers: { Cookie: sessionCookie } }), env))!.status).toBe(403);
  expect((await authRoute(request('/api/auth/logout', { method: 'POST', headers: { Cookie: sessionCookie, Origin: 'https://evil.test', 'X-CSRF-Token': summary.csrfToken } }), env))!.status).toBe(403);
  expect((await authRoute(request('/api/auth/logout', { method: 'POST', headers: { Cookie: sessionCookie, Origin: 'http://127.0.0.1:8787', 'X-CSRF-Token': summary.csrfToken } }), env))!.status).toBe(204);
  expect(sqlite.prepare('SELECT count(*) AS n FROM sessions').get()!.n).toBe(0);
});

test('expired states, unsafe return paths, cross-origin starts and excessive starts fail closed', async () => {
  const { env, sqlite } = environment();
  expect((await authRoute(request('/api/auth/start?return=https://evil.test'), env))!.status).toBe(400);
  expect((await authRoute(request('/api/auth/start', { headers: { 'Sec-Fetch-Site': 'cross-site' } }), env))!.status).toBe(403);
  const flow = await start(env);
  sqlite.exec('UPDATE auth_states SET expires_at=0');
  expect((await authRoute(request(`/api/auth/callback?state=${flow.target.searchParams.get('state')}&code=x`, { headers: { Cookie: flow.cookie } }), env))!.status).toBe(400);
  for (let i = 0; i < 9; i++) expect((await start(env)).response.status).toBe(303);
  expect((await authRoute(request('/api/auth/start'), env))!.status).toBe(429);
  expect((await authRoute(request('/api/session'), {}))!.status).toBe(503);
});

test('expired sessions never renew; production cookies are secure and token sealing is nondeterministic', async () => {
  const { env, sqlite } = environment();
  const credential = randomSecret();
  sqlite.prepare('INSERT INTO accounts(id,login,encrypted_tokens,updated_at) VALUES(?,?,?,?)').run(1, 'user', '{}', 0);
  sqlite.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(await digest(credential), 1, randomSecret(), 0, 0);
  const summary = await (await authRoute(request('/api/session', { headers: { Cookie: `lingfern_local_session=${credential}` } }), env))!.json();
  expect(summary).toEqual({ account: null, syncAvailable: false });
  const production = (await authRoute(new Request('https://lingfern.com/api/auth/start'), env))!;
  expect(production.headers.get('Set-Cookie')).toMatch(/__Host-lingfern_auth=.*HttpOnly.*Secure/);
  const one = await sealTokens({ access_token: 'secret' }, env.TOKEN_ENCRYPTION_KEY!, 1);
  const two = await sealTokens({ access_token: 'secret' }, env.TOKEN_ENCRYPTION_KEY!, 1);
  expect(one).not.toBe(two);
  const sealed = JSON.parse(one) as { iv: string; data: string };
  const decode = (value: string) => Uint8Array.from(atob(value), character => character.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', decode(env.TOKEN_ENCRYPTION_KEY!), 'AES-GCM', false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(sealed.iv), additionalData: new TextEncoder().encode('github:1') }, key, decode(sealed.data));
  expect(JSON.parse(new TextDecoder().decode(plain))).toEqual({ access_token: 'secret' });
  await expect(crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(sealed.iv), additionalData: new TextEncoder().encode('github:2') }, key, decode(sealed.data))).rejects.toThrow();
});

test('the local Vite proxy origin is allowed only in the explicit local environment', async () => {
  const { env, sqlite } = environment();
  const credential = randomSecret(), csrf = randomSecret();
  const now = Math.floor(Date.now() / 1000);
  sqlite.prepare('INSERT INTO accounts(id,login,encrypted_tokens,updated_at) VALUES(?,?,?,?)').run(1, 'user', '{}', now);
  sqlite.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(await digest(credential), 1, csrf, now + 100, now + 200);
  const result = (await authRoute(request('/api/auth/logout', { method: 'POST', headers: { Cookie: `lingfern_local_session=${credential}`, Origin: 'http://127.0.0.1:5173', 'X-CSRF-Token': csrf } }), env))!;
  expect(result.status).toBe(204);
  const production = (await authRoute(new Request('https://lingfern.com/api/auth/start', { headers: { Origin: 'http://127.0.0.1:5173' } }), env))!;
  expect(production.status).toBe(403);
});

async function tokenAccount(env: AuthEnv, sqlite: DatabaseSync, id = 1, expired = true) {
  const tokens = { access_token: 'old-access', refresh_token: 'old-refresh', token_type: 'bearer', obtainedAt: Math.floor(Date.now() / 1000) - 100, expires_in: expired ? 1 : 28800, refresh_token_expires_in: 10000 };
  sqlite.prepare('INSERT INTO accounts(id,login,encrypted_tokens,updated_at) VALUES(?,?,?,?)').run(id, 'user', await sealTokens(tokens, env.TOKEN_ENCRYPTION_KEY!, id), 0);
}
const refreshedTokens = { access_token: 'new-access', refresh_token: 'new-refresh', token_type: 'bearer', expires_in: 28800, refresh_token_expires_in: 10000 };

test.each([301, 302, 303, 307, 308])('GitHub adapters refuse %i without following or reporting grant revocation', async status => {
  const { env, sqlite } = environment();
  await tokenAccount(env, sqlite, 1, false);
  const credential = randomSecret(), csrf = randomSecret();
  sqlite.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(await digest(credential), 1, csrf, 9999999999, 9999999999);
  const fetch = vi.fn(async (_url: string, init: RequestInit) => {
    expect(init.redirect).toBe('manual');
    return new Response('untrusted redirect body', { status, headers: { Location: 'https://redirect.invalid/forbidden' } });
  });
  vi.stubGlobal('fetch', fetch);
  await expect(githubJson('https://api.github.com/user', { headers: { Authorization: 'Bearer synthetic' } })).rejects.toMatchObject({ status });
  await expect(github('synthetic')('GET /user')).rejects.toThrow('GITHUB_REDIRECT');
  const response = (await authRoute(request('/api/auth/disconnect', { method: 'POST', headers: { Cookie: `lingfern_local_session=${credential}`, Origin: 'http://127.0.0.1:8787', 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' }, body: '{"confirm":true}' }), env))!;
  expect(await response.json()).toEqual({ disconnected: true, providerRevoked: false });
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(fetch.mock.calls.every(([url]) => new URL(url).origin === 'https://api.github.com')).toBe(true);
  expect(sqlite.prepare('SELECT revoked FROM accounts').get()!.revoked).toBe(1);
  expect(sqlite.prepare('SELECT count(*) AS n FROM sessions').get()!.n).toBe(0);
});

test.each(['logout', 'revocation', 'idle-expiry', 'absolute-expiry', 'new-login', 'account-switch', 'binding-read'])('session summary fences %s during upstream verification', async mode => {
  const { env, sqlite } = environment();
  await tokenAccount(env, sqlite, 1, false);
  const credential = randomSecret(), hash = await digest(credential);
  sqlite.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(hash, 1, randomSecret(), 9999999999, 9999999999);
  const renewed = await sealTokens({ ...refreshedTokens, obtainedAt: Math.floor(Date.now() / 1000) }, env.TOKEN_ENCRYPTION_KEY!, 1);
  if (mode === 'account-switch') await tokenAccount(env, sqlite, 2, false);
  const invalidate = () => {
    if (mode === 'revocation') sqlite.exec("UPDATE accounts SET revoked=1,encrypted_tokens=''; DELETE FROM sessions");
    else if (mode === 'idle-expiry') sqlite.exec('UPDATE sessions SET expires_at=0');
    else if (mode === 'absolute-expiry') sqlite.exec('UPDATE sessions SET absolute_expires_at=0');
    else if (mode === 'new-login') {
      sqlite.prepare('UPDATE accounts SET encrypted_tokens=? WHERE id=1').run(renewed);
      sqlite.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run('new-session', 1, 'new-csrf', 9999999999, 9999999999);
    } else if (mode === 'account-switch') sqlite.prepare('UPDATE sessions SET account_id=2 WHERE hash=?').run(hash);
    else sqlite.exec('DELETE FROM sessions');
  };
  if (mode === 'binding-read') {
    const prepare = env.AUTH_DB!.prepare.bind(env.AUTH_DB);
    env.AUTH_DB!.prepare = (sql: string) => {
      const statement = prepare(sql);
      if (sql.startsWith('SELECT repository_name AS name')) {
        const all = statement.all.bind(statement);
        statement.all = async <T = Record<string, unknown>>() => { const result = await all<T>(); invalidate(); return result; };
      }
      return statement;
    };
  }
  vi.stubGlobal('fetch', vi.fn(async () => {
    if (mode !== 'binding-read') invalidate();
    return Response.json({ id: 1, login: 'user' });
  }));
  const response = (await authRoute(request('/api/session', { headers: { Cookie: `lingfern_local_session=${credential}` } }), env))!;
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ account: null, syncAvailable: false });
  if (mode === 'new-login') {
    expect(sqlite.prepare('SELECT encrypted_tokens,revoked FROM accounts WHERE id=1').get()).toEqual(expect.objectContaining({ encrypted_tokens: renewed, revoked: 0 }));
    expect(sqlite.prepare('SELECT expires_at FROM sessions WHERE hash=?').get(hash)!.expires_at).toBe(9999999999);
    expect(sqlite.prepare("SELECT csrf FROM sessions WHERE hash='new-session'").get()!.csrf).toBe('new-csrf');
  }
  if (mode === 'account-switch') expect(sqlite.prepare('SELECT account_id,expires_at FROM sessions WHERE hash=?').get(hash)).toEqual(expect.objectContaining({ account_id: 2, expires_at: 9999999999 }));
  if (mode === 'idle-expiry') expect(sqlite.prepare('SELECT expires_at FROM sessions').get()!.expires_at).toBe(0);
});

test('concurrent requests rotate a single refresh token once and use the committed result', async () => {
  const { env, sqlite } = environment();
  await tokenAccount(env, sqlite);
  let release!: () => void, started!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const called = new Promise<void>(resolve => { started = resolve; });
  const upstream = vi.fn(async (_url: string, init: RequestInit) => {
    expect(new URLSearchParams(init.body as URLSearchParams).get('refresh_token')).toBe('old-refresh');
    started(); await waiting;
    return Response.json(refreshedTokens);
  });
  vi.stubGlobal('fetch', upstream);
  const first = githubToken(env, 1);
  await called;
  const second = githubToken(env, 1);
  release();
  expect(await Promise.all([first, second])).toEqual(['new-access', 'new-access']);
  expect(upstream).toHaveBeenCalledTimes(1);
  expect(sqlite.prepare('SELECT refresh_lease FROM accounts').get()!.refresh_lease).toBe(null);
});

test('revocation during refresh cannot be overwritten by the late upstream response', async () => {
  const { env, sqlite } = environment();
  await tokenAccount(env, sqlite);
  vi.stubGlobal('fetch', vi.fn(async () => { await revokeAccount(env.AUTH_DB!, 1); return Response.json(refreshedTokens); }));
  await expect(githubToken(env, 1)).rejects.toThrow('REAUTHORISE');
  expect(sqlite.prepare('SELECT revoked,encrypted_tokens FROM accounts').get()).toEqual(expect.objectContaining({ revoked: 1, encrypted_tokens: '' }));
});

test('unknown refresh outcome and expired lock never retry a possibly consumed token', async () => {
  const { env, sqlite } = environment();
  await tokenAccount(env, sqlite);
  sqlite.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run('old-session', 1, 'old-csrf', 9999999999, 9999999999);
  const upstream = vi.fn(async () => { throw new Error('lost response'); });
  vi.stubGlobal('fetch', upstream);
  await expect(githubToken(env, 1)).rejects.toThrow('REAUTHORISE');
  await expect(githubToken(env, 1)).rejects.toThrow('REAUTHORISE');
  expect(upstream).toHaveBeenCalledTimes(1);
  expect(sqlite.prepare('SELECT count(*) AS n FROM sessions').get()!.n).toBe(0);
  await tokenAccount(env, sqlite, 2);
  sqlite.prepare('UPDATE accounts SET refresh_lease=?,refresh_until=0 WHERE id=2').run('abandoned');
  await expect(githubToken(env, 2)).rejects.toThrow('REAUTHORISE');
  expect(upstream).toHaveBeenCalledTimes(1);
});

async function webhook(env: AuthEnv, id: string, sender = 1, extra = '', kind = 'github_app_authorization', payload?: unknown) {
  const body = JSON.stringify(payload ?? { action: 'revoked', sender: { id: sender }, extra });
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.GITHUB_WEBHOOK_SECRET!), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
  const signature = 'sha256=' + [...signed].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return request('/api/auth/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature, 'X-GitHub-Delivery': id, 'X-GitHub-Event': kind }, body });
}

test('signed revocation clears credentials and sessions atomically; duplicates cannot revoke a later login', async () => {
  const { env, sqlite } = environment();
  env.GITHUB_WEBHOOK_SECRET = 'synthetic-webhook-secret';
  await tokenAccount(env, sqlite);
  sqlite.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run('test-session', 1, 'test-csrf', 9999999999, 9999999999);
  const id = crypto.randomUUID();
  expect((await webhookRoute(await webhook(env, id), env))!.status).toBe(202);
  expect(sqlite.prepare('SELECT revoked,encrypted_tokens FROM accounts').get()).toEqual(expect.objectContaining({ revoked: 1, encrypted_tokens: '' }));
  expect(sqlite.prepare('SELECT count(*) AS n FROM sessions').get()!.n).toBe(0);
  sqlite.exec("UPDATE accounts SET revoked=0,encrypted_tokens='new-login'");
  expect((await webhookRoute(await webhook(env, id), env))!.status).toBe(202);
  expect(sqlite.prepare('SELECT encrypted_tokens FROM accounts').get()!.encrypted_tokens).toBe('new-login');
  expect((await webhookRoute(await webhook(env, id, 1, 'changed'), env))!.status).toBe(409);
  expect(sqlite.prepare('SELECT encrypted_tokens FROM accounts').get()!.encrypted_tokens).toBe('new-login');
});

test('webhook tampering and browser cookies do not authorise revocation; API 401 invalidates sessions', async () => {
  const { env, sqlite } = environment();
  env.GITHUB_WEBHOOK_SECRET = 'synthetic-webhook-secret';
  await tokenAccount(env, sqlite, 1, false);
  const signed = await webhook(env, crypto.randomUUID());
  const forged = new Request(signed.url, { method: 'POST', headers: signed.headers, body: (await signed.text()) + ' ' });
  expect((await webhookRoute(forged, env))!.status).toBe(401);
  expect(sqlite.prepare('SELECT revoked FROM accounts').get()!.revoked).toBe(0);
  expect((await webhookRoute(request('/api/auth/webhook', { method: 'POST', headers: { Cookie: 'a=b' }, body: '{}' }), env))!.status).toBe(401);
  const credential = randomSecret();
  sqlite.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(await digest(credential), 1, randomSecret(), 9999999999, 9999999999);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })));
  const response = (await authRoute(request('/api/session', { headers: { Cookie: `lingfern_local_session=${credential}` } }), env))!;
  expect(await response.json()).toEqual({ account: null, syncAvailable: false });
  expect(sqlite.prepare('SELECT count(*) AS n FROM sessions').get()!.n).toBe(0);
});

test('identity disconnection requires explicit confirmation and revokes only that account on all devices', async () => {
  const { env, sqlite } = environment();
  await tokenAccount(env, sqlite, 1, false);
  await tokenAccount(env, sqlite, 2, false);
  const credential = randomSecret(), csrf = randomSecret();
  for (const [hash, id] of [[await digest(credential), 1], ['other-device', 1], ['other-account', 2]] as const) sqlite.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(hash, id, csrf, 9999999999, 9999999999);
  const headers = { Cookie: `lingfern_local_session=${credential}`, Origin: 'http://127.0.0.1:8787', 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' };
  const upstream = vi.fn(async (url: string, init: RequestInit) => {
    expect(url).toBe('https://api.github.com/applications/test-app/grant');
    expect(init.method).toBe('DELETE');
    expect(new Headers(init.headers).get('Authorization')).toBe(`Basic ${btoa('test-app:test-secret')}`);
    expect(JSON.parse(init.body as string)).toEqual({ access_token: 'old-access' });
    return new Response(null, { status: 204 });
  });
  vi.stubGlobal('fetch', upstream);
  expect((await authRoute(request('/api/auth/disconnect', { method: 'POST', headers, body: '{"confirm":false}' }), env))!.status).toBe(400);
  expect((await authRoute(request('/api/auth/disconnect', { method: 'POST', headers: { ...headers, 'X-CSRF-Token': 'wrong' }, body: '{"confirm":true}' }), env))!.status).toBe(403);
  expect(upstream).not.toHaveBeenCalled();
  const response = (await authRoute(request('/api/auth/disconnect', { method: 'POST', headers, body: '{"confirm":true}' }), env))!;
  expect(await response.json()).toEqual({ disconnected: true, providerRevoked: true });
  expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');
  expect(sqlite.prepare('SELECT hash FROM sessions').all()).toEqual([expect.objectContaining({ hash: 'other-account' })]);
  expect(sqlite.prepare('SELECT encrypted_tokens,revoked FROM accounts WHERE id=1').get()).toEqual(expect.objectContaining({ encrypted_tokens: '', revoked: 1 }));
  expect(sqlite.prepare('SELECT revoked FROM accounts WHERE id=2').get()!.revoked).toBe(0);
});

test('GitHub failures are not misreported as successful remote revocation or treated as invalid credentials', async () => {
  const { env, sqlite } = environment();
  await tokenAccount(env, sqlite, 1, false);
  const credential = randomSecret(), csrf = randomSecret();
  sqlite.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(await digest(credential), 1, csrf, 9999999999, 9999999999);
  const headers = { Cookie: `lingfern_local_session=${credential}`, Origin: 'http://127.0.0.1:8787', 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' };
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 403 })));
  expect((await authRoute(request('/api/session', { headers }), env))!.status).toBe(503);
  expect(sqlite.prepare('SELECT revoked FROM accounts').get()!.revoked).toBe(0);
  const response = (await authRoute(request('/api/auth/disconnect', { method: 'POST', headers, body: '{"confirm":true}' }), env))!;
  expect(await response.json()).toEqual({ disconnected: true, providerRevoked: false });
  expect(sqlite.prepare('SELECT count(*) AS n FROM sessions').get()!.n).toBe(0);
});

test('a failed old refresh cannot clear credentials or sessions from a new login', async () => {
  const { env, sqlite } = environment();
  await tokenAccount(env, sqlite);
  const renewed = await sealTokens({ ...refreshedTokens, obtainedAt: Math.floor(Date.now() / 1000) }, env.TOKEN_ENCRYPTION_KEY!, 1);
  vi.stubGlobal('fetch', vi.fn(async () => {
    sqlite.prepare('UPDATE accounts SET encrypted_tokens=?,refresh_lease=NULL,refresh_until=0 WHERE id=1').run(renewed);
    sqlite.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run('new-session', 1, 'new-csrf', 9999999999, 9999999999);
    throw new Error('old request failed');
  }));
  await expect(githubToken(env, 1)).rejects.toThrow('REAUTHORISE');
  expect(sqlite.prepare('SELECT encrypted_tokens,revoked FROM accounts').get()).toEqual(expect.objectContaining({ encrypted_tokens: renewed, revoked: 0 }));
  expect(sqlite.prepare('SELECT count(*) AS n FROM sessions').get()!.n).toBe(1);
  expect(await githubToken(env, 1)).toBe('new-access');
});

test('a late API 401 for an old token cannot invalidate a newly authorised identity', async () => {
  const { env, sqlite } = environment();
  await tokenAccount(env, sqlite, 1, false);
  const credential = randomSecret();
  sqlite.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(await digest(credential), 1, randomSecret(), 9999999999, 9999999999);
  const renewed = await sealTokens({ ...refreshedTokens, obtainedAt: Math.floor(Date.now() / 1000) }, env.TOKEN_ENCRYPTION_KEY!, 1);
  vi.stubGlobal('fetch', vi.fn(async () => {
    sqlite.prepare('UPDATE accounts SET encrypted_tokens=? WHERE id=1').run(renewed);
    return new Response(null, { status: 401 });
  }));
  expect(await (await authRoute(request('/api/session', { headers: { Cookie: `lingfern_local_session=${credential}` } }), env))!.json()).toEqual({ account: null, syncAvailable: false });
  expect(sqlite.prepare('SELECT encrypted_tokens,revoked FROM accounts').get()).toEqual(expect.objectContaining({ encrypted_tokens: renewed, revoked: 0 }));
  expect(sqlite.prepare('SELECT count(*) AS n FROM sessions').get()!.n).toBe(1);
});

async function repositoryEnvironment() {
  const { env, sqlite } = environment();
  env.SYNC_ENABLED = 'true'; env.GITHUB_WEBHOOK_SECRET = 'test-webhook'; env.GITHUB_APP_SLUG = 'lingfern-test';
  await tokenAccount(env, sqlite, 1, false);
  const credential = randomSecret(), csrf = randomSecret();
  const hash = await digest(credential);
  sqlite.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(hash, 1, csrf, 9999999999, 9999999999);
  const headers = { Cookie: `lingfern_local_session=${credential}`, Origin: 'http://127.0.0.1:8787', 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' };
  const owner = { id: 1, login: 'user', type: 'User' };
  const fixture = {
    repository: { id: 21, name: 'lingfern-data', owner: { ...owner }, private: true, fork: false, archived: false, disabled: false, default_branch: 'main', permissions: { pull: true, push: true } },
    installation: { id: 31, account: owner, repository_selection: 'selected', permissions: { contents: 'write', metadata: 'read' }, suspended_at: null as string | null },
    marker: undefined as unknown,
    extraFiles: [] as { path: string; mode: string; type: string; sha: string; size?: number }[],
    truncated: false, putCount: 0, lostAck: false, head: 'a'.repeat(40), snapshots: new Map<string, { path: string; type: string; mode: string; sha: string; size?: number }[]>(),
    batches: new Map<string, { content: string; sha: string }>(), batchWrites: 0, batchLostAck: false, conflicts: 0, retryAfter: undefined as string | undefined,
    duringPut: undefined as (() => Promise<void>) | undefined,
  };
  const upstream = vi.fn(async (url: string, init: RequestInit) => {
    const parsed = new URL(url), path = decodeURIComponent(parsed.pathname);
    expect(parsed.origin).toBe('https://api.github.com');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer old-access');
    if (path === '/user') return Response.json(owner);
    if (path === '/user/installations') return Response.json({ total_count: 1, installations: [fixture.installation] });
    if (path === '/user/installations/31/repositories') return Response.json({ total_count: 1, repositories: [fixture.repository] });
    if (path === '/repos/user/lingfern-data') return Response.json(fixture.repository);
    if (path.startsWith('/repos/user/lingfern-data/commits/')) {
      const ref = path.slice('/repos/user/lingfern-data/commits/'.length), head = ref === 'main' ? fixture.head : ref;
      if (ref === 'main') fixture.snapshots.set(head, [{ path: 'README.md', type: 'blob', mode: '100644', sha: 'c'.repeat(40), size: 10 }, ...(fixture.marker ? [{ path: 'profile.json', type: 'blob', mode: '100644', sha: 'd'.repeat(40), size: 100 }] : []), ...fixture.extraFiles, ...Array.from(fixture.batches, ([path, item]) => ({ path, type: 'blob', mode: '100644', sha: item.sha, size: atob(item.content).length }))]);
      if (!fixture.snapshots.has(head)) return Response.json({}, { status: 404 });
      return Response.json({ sha: head, commit: { tree: { sha: head === 'a'.repeat(40) ? 'b'.repeat(40) : head } } });
    }
    if (path.startsWith('/repos/user/lingfern-data/git/trees/')) {
      const tree = path.slice('/repos/user/lingfern-data/git/trees/'.length), head = tree === 'b'.repeat(40) ? 'a'.repeat(40) : tree;
      return Response.json({ truncated: fixture.truncated, tree: fixture.snapshots.get(head) ?? [] });
    }
    if (path === '/repos/user/lingfern-data/git/blobs/' + 'd'.repeat(40)) return Response.json({ encoding: 'base64', content: btoa(JSON.stringify(fixture.marker)) });
    const remoteBlob = [...fixture.batches.values()].find(item => path === '/repos/user/lingfern-data/git/blobs/' + item.sha);
    if (remoteBlob) return Response.json({ encoding: 'base64', content: remoteBlob.content });
    if (path.startsWith('/repos/user/lingfern-data/contents/records/') && init.method === 'PUT') {
      const file = path.slice('/repos/user/lingfern-data/contents/'.length);
      const body = JSON.parse(init.body as string);
      expect(body.sha).toBeUndefined(); expect(body.branch).toBe('main');
      if (fixture.retryAfter) return Response.json({ message: 'slow down' }, { status: 422, headers: { 'retry-after': fixture.retryAfter } });
      if (fixture.conflicts > 0) { fixture.conflicts--; return Response.json({ message: 'branch moved' }, { status: 409 }); }
      if (fixture.batches.has(file)) return Response.json({ message: 'exists' }, { status: 422 });
      fixture.batchWrites++;
      const sha = fixture.batchWrites.toString(16).padStart(40, '0');
      fixture.batches.set(file, { content: body.content, sha });
      await fixture.duringPut?.();
      if (fixture.batchLostAck) throw new Error('response lost');
      return Response.json({ content: { sha } }, { status: 201 });
    }
    if (path === '/repos/user/lingfern-data/contents/profile.json' && init.method === 'PUT') {
      const body = JSON.parse(init.body as string) as { content: string; branch: string; sha?: string };
      expect(body.sha).toBeUndefined(); expect(body.branch).toBe('main');
      if (fixture.marker) return Response.json({ message: 'already exists' }, { status: 422 });
      fixture.putCount++; fixture.marker = JSON.parse(atob(body.content));
      await fixture.duringPut?.();
      if (fixture.lostAck) throw new Error('response lost');
      return Response.json({ content: { sha: 'd'.repeat(40) } }, { status: 201 });
    }
    throw new Error('Unexpected test endpoint');
  });
  vi.stubGlobal('fetch', upstream);
  const invoke = (path: string, body?: unknown, override?: Record<string, string>) => repositoryRoute(request(path, { ...(body !== undefined ? { method: 'POST', body: JSON.stringify(body) } : {}), headers: { ...headers, ...override } }), env).then(result => result!);
  const choice = { installationId: 31, repositoryId: 21, name: 'lingfern-data', profileId: 'local-guest' };
  const verify = async () => { const response = await invoke('/api/sync/inspect', choice); expect(response.status).toBe(200); const result = await response.json() as { intent: string }; return { intent: result.intent }; };
  return { env, sqlite, fixture, upstream, headers, invoke, choice, verify, hash };
}

test('repository discovery and installation return verify actual scope; confirmation alone writes the marker', async () => {
  const { invoke, fixture, sqlite, verify, hash } = await repositoryEnvironment();
  const choices = await (await invoke('/api/sync/repositories')).json();
  expect(choices).toEqual({ repositories: [{ installationId: 31, repositoryId: 21, name: 'lingfern-data' }], installationUrl: 'https://github.com/apps/lingfern-test/installations/new' });
  expect((await invoke('/api/auth/setup?installation_id=31')).status).toBe(303);
  expect((await invoke('/api/auth/setup?installation_id=999')).status).toBe(403);
  expect(fixture.putCount).toBe(0);
  const intent = await verify();
  expect((await invoke('/api/sync/bind', { ...intent, confirm: false })).status).toBe(400);
  expect((await invoke('/api/sync/bind', { ...intent, confirm: true }, { 'X-CSRF-Token': 'wrong' })).status).toBe(403);
  expect(fixture.putCount).toBe(0);
  expect((await invoke('/api/sync/bind', { ...intent, confirm: true })).status).toBe(200);
  expect(fixture.marker).toEqual({ product: 'Lingfern', formatVersion: 1, profileId: 'local-guest' });
  expect(sqlite.prepare('SELECT profile_id,repository_id,disabled FROM repository_bindings').get()).toEqual(expect.objectContaining({ profile_id: 'local-guest', repository_id: 21, disabled: 0 }));
  expect((await invoke('/api/sync/bind', { ...intent, confirm: true })).status).toBe(409);
  const again = await verify();
  expect((await invoke('/api/sync/bind', { ...again, confirm: true })).status).toBe(200);
  expect(fixture.putCount).toBe(1);
  expect((await invoke('/api/sync/disconnect', { profileId: 'local-guest', confirm: true })).status).toBe(200);
  expect(sqlite.prepare('SELECT count(*) AS n FROM repository_bindings').get()!.n).toBe(0);
  expect(sqlite.prepare('SELECT hash FROM sessions').get()!.hash).toBe(hash);
});

test('unsafe repositories, broad installations, other-profile markers and arbitrary paths cannot bind', async () => {
  const { invoke, fixture, choice } = await repositoryEnvironment();
  fixture.repository.private = false;
  expect((await invoke('/api/sync/inspect', choice)).status).toBe(409);
  fixture.repository.private = true; fixture.repository.owner.id = 2;
  expect((await invoke('/api/sync/inspect', choice)).status).toBe(409);
  fixture.repository.owner.id = 1; fixture.installation.repository_selection = 'all';
  expect((await invoke('/api/sync/inspect', choice)).status).toBe(403);
  fixture.installation.repository_selection = 'selected';
  fixture.extraFiles = [{ path: '.github/workflows/build.yml', mode: '100644', type: 'blob', sha: 'e'.repeat(40), size: 10 }];
  expect((await invoke('/api/sync/inspect', choice)).status).toBe(409);
  fixture.extraFiles = [{ path: 'README.md', mode: '120000', type: 'blob', sha: 'e'.repeat(40), size: 10 }];
  expect((await invoke('/api/sync/inspect', choice)).status).toBe(409);
  fixture.extraFiles = []; fixture.marker = { product: 'Lingfern', formatVersion: 1, profileId: 'another-profile' };
  expect(await (await invoke('/api/sync/inspect', choice)).json()).toEqual({ error: 'PROFILE_MISMATCH' });
  expect((await invoke('/api/sync/inspect', { ...choice, name: '../private' })).status).toBe(400);
  expect(fixture.putCount).toBe(0);
});

test('binding intents are session-bound, expire and recheck privacy before writing', async () => {
  const { env, sqlite, invoke, fixture, verify, headers } = await repositoryEnvironment();
  const intent = await verify();
  const another = randomSecret();
  sqlite.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(await digest(another), 1, headers['X-CSRF-Token'], 9999999999, 9999999999);
  expect((await invoke('/api/sync/bind', { ...intent, confirm: true }, { Cookie: `lingfern_local_session=${another}` })).status).toBe(409);
  expect(sqlite.prepare('SELECT count(*) AS n FROM binding_intents').get()!.n).toBe(1);
  sqlite.exec('UPDATE binding_intents SET expires_at=0');
  expect((await invoke('/api/sync/bind', { ...intent, confirm: true })).status).toBe(409);
  const fresh = await verify(); fixture.repository.private = false;
  expect((await invoke('/api/sync/bind', { ...fresh, confirm: true })).status).toBe(409);
  expect(fixture.putCount).toBe(0);
  expect((await repositoryRoute(request('/api/sync/inspect', { method: 'POST', headers: { Origin: 'https://evil.test' }, body: '{}' }), env))!.status).toBe(403);
});

test('unknown marker-write acknowledgement recovers by reinspection without replacing or duplicating it', async () => {
  const { fixture, verify, invoke, sqlite } = await repositoryEnvironment();
  const intent = await verify(); fixture.lostAck = true;
  expect((await invoke('/api/sync/bind', { ...intent, confirm: true })).status).toBe(503);
  expect(fixture.putCount).toBe(1);
  expect(sqlite.prepare('SELECT count(*) AS n FROM repository_bindings').get()!.n).toBe(0);
  const recovered = await verify();
  expect((await invoke('/api/sync/bind', { ...recovered, confirm: true })).status).toBe(200);
  expect(fixture.putCount).toBe(1);
});

test('installation revocation wins over an in-flight bind and invalidates associated identity sessions', async () => {
  const { env, fixture, verify, invoke, sqlite, headers } = await repositoryEnvironment();
  const intent = await verify();
  fixture.duringPut = async () => { expect((await webhookRoute(await webhook(env, crypto.randomUUID(), 1, '', 'installation', { action: 'suspend', installation: { id: 31 } }), env))!.status).toBe(202); };
  expect(await (await invoke('/api/sync/bind', { ...intent, confirm: true })).json()).toEqual({ error: 'AUTHORISATION_CHANGED' });
  expect(sqlite.prepare('SELECT count(*) AS n FROM repository_bindings').get()!.n).toBe(0);
  fixture.duringPut = undefined;
  expect((await invoke('/api/sync/repositories')).status).toBe(401);
  // Simulate provider unsuspension and a separately completed new login.
  await webhookRoute(await webhook(env, crypto.randomUUID(), 1, '', 'installation', { action: 'unsuspend', installation: { id: 31 } }), env);
  const credential = randomSecret(), csrf = randomSecret();
  const encrypted = await sealTokens({ access_token: 'old-access', token_type: 'bearer', obtainedAt: Math.floor(Date.now() / 1000), expires_in: 28800 }, env.TOKEN_ENCRYPTION_KEY!, 1);
  sqlite.prepare('UPDATE accounts SET revoked=0,encrypted_tokens=? WHERE id=1').run(encrypted);
  sqlite.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(await digest(credential), 1, csrf, 9999999999, 9999999999);
  headers.Cookie = `lingfern_local_session=${credential}`; headers['X-CSRF-Token'] = csrf;
  const renewed = await verify();
  expect((await invoke('/api/sync/bind', { ...renewed, confirm: true })).status).toBe(200);
  expect((await webhookRoute(await webhook(env, crypto.randomUUID(), 1, '', 'installation', { action: 'deleted', installation: { id: 31 } }), env))!.status).toBe(202);
  expect(sqlite.prepare('SELECT disabled FROM repository_bindings').get()!.disabled).toBe(1);
  expect(sqlite.prepare('SELECT count(*) AS n FROM sessions').get()!.n).toBe(0);
  expect(sqlite.prepare('SELECT revoked,encrypted_tokens FROM accounts').get()).toEqual(expect.objectContaining({ revoked: 1, encrypted_tokens: '' }));
});

test('selection and visibility webhooks require fresh binding without deleting learning or GitHub identity', async () => {
  const { env, verify, invoke, sqlite } = await repositoryEnvironment();
  const intent = await verify();
  expect((await invoke('/api/sync/bind', { ...intent, confirm: true })).status).toBe(200);
  for (const [kind, payload] of [['installation_repositories', { action: 'removed', installation: { id: 31 } }], ['repository', { action: 'publicized', repository: { id: 21 } }]] as const) {
    expect((await webhookRoute(await webhook(env, crypto.randomUUID(), 1, '', kind, payload), env))!.status).toBe(202);
    expect(sqlite.prepare('SELECT disabled FROM repository_bindings').get()!.disabled).toBe(1);
    expect(sqlite.prepare('SELECT count(*) AS n FROM sessions').get()!.n).toBe(1);
  }
});

test('truncated trees and large response bodies stop inspection, with no writes', async () => {
  const { fixture, invoke, choice, upstream } = await repositoryEnvironment();
  fixture.truncated = true;
  expect((await invoke('/api/sync/inspect', choice)).status).toBe(413);
  fixture.truncated = false;
  upstream.mockImplementationOnce(async () => new Response(' '.repeat(2 * 1024 * 1024 + 1)));
  expect((await invoke('/api/sync/inspect', choice)).status).toBe(503);
  expect(fixture.putCount).toBe(0);
});

test('foreign accounts cannot use an intent and uninitialised repositories return an actionable error', async () => {
  const { env, sqlite, invoke, verify, headers, upstream, choice } = await repositoryEnvironment();
  const intent = await verify();
  await tokenAccount(env, sqlite, 2, false);
  const foreign = randomSecret();
  sqlite.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(await digest(foreign), 2, headers['X-CSRF-Token'], 9999999999, 9999999999);
  expect((await invoke('/api/sync/bind', { ...intent, confirm: true }, { Cookie: `lingfern_local_session=${foreign}` })).status).toBe(409);
  const normal = upstream.getMockImplementation()!;
  upstream.mockImplementation(async (url: string, init: RequestInit) => url.includes('/commits/') ? Response.json({ message: 'Git repository is empty' }, { status: 409 }) : normal(url, init));
  expect(await (await invoke('/api/sync/inspect', choice)).json()).toEqual({ error: 'REPOSITORY_UNINITIALISED' });
  expect(sqlite.prepare('SELECT count(*) AS n FROM repository_bindings').get()!.n).toBe(0);
});

test('a revocation received during repository inspection invalidates that verification generation', async () => {
  const { env, invoke, upstream, choice, sqlite } = await repositoryEnvironment();
  const normal = upstream.getMockImplementation()!;
  upstream.mockImplementation(async (url: string, init: RequestInit) => {
    if (url.includes('/git/trees/')) await webhookRoute(await webhook(env, crypto.randomUUID(), 1, '', 'installation', { action: 'deleted', installation: { id: 31 } }), env);
    return normal(url, init);
  });
  expect(await (await invoke('/api/sync/inspect', choice)).json()).toEqual({ error: 'AUTHORISATION_CHANGED' });
  expect(sqlite.prepare('SELECT count(*) AS n FROM binding_intents').get()!.n).toBe(0);
});

test('repository API 401 disables only the checked credential generation and respects the request limit', async () => {
  const { invoke, sqlite, upstream } = await repositoryEnvironment();
  upstream.mockImplementationOnce(async () => Response.json({ message: 'Bad credentials' }, { status: 401 }));
  expect((await invoke('/api/sync/repositories')).status).toBe(403);
  expect(sqlite.prepare('SELECT count(*) AS n FROM sessions').get()!.n).toBe(0);
  const fresh = await repositoryEnvironment();
  for (let i = 0; i < 20; i++) expect((await fresh.invoke('/api/sync/repositories')).status).toBe(200);
  expect((await fresh.invoke('/api/sync/repositories')).status).toBe(429);
});

test('a marker created concurrently for another profile is never overwritten', async () => {
  const { invoke, verify, fixture, upstream, sqlite } = await repositoryEnvironment();
  const intent = await verify();
  const normal = upstream.getMockImplementation()!;
  const other = { product: 'Lingfern', formatVersion: 1, profileId: 'another-profile' };
  upstream.mockImplementation(async (url: string, init: RequestInit) => {
    if (init.method === 'PUT') fixture.marker = other;
    return normal(url, init);
  });
  expect((await invoke('/api/sync/bind', { ...intent, confirm: true })).status).toBe(409);
  expect(fixture.marker).toEqual(other);
  expect(fixture.putCount).toBe(0);
  expect(sqlite.prepare('SELECT count(*) AS n FROM repository_bindings').get()!.n).toBe(0);
});

test('a repository visibility webhook fences an in-flight marker write even before a binding exists', async () => {
  const { env, verify, invoke, fixture, sqlite } = await repositoryEnvironment();
  const intent = await verify();
  fixture.duringPut = async () => { expect((await webhookRoute(await webhook(env, crypto.randomUUID(), 1, '', 'repository', { action: 'publicized', repository: { id: 21 } }), env))!.status).toBe(202); };
  expect(await (await invoke('/api/sync/bind', { ...intent, confirm: true })).json()).toEqual({ error: 'AUTHORISATION_CHANGED' });
  expect(sqlite.prepare('SELECT count(*) AS n FROM repository_bindings').get()!.n).toBe(0);
  expect(sqlite.prepare('SELECT count(*) AS n FROM binding_intents').get()!.n).toBe(0);
});

test('a repository change during first inspection is remembered before any intent exists', async () => {
  const { env, invoke, upstream, choice, sqlite } = await repositoryEnvironment();
  const normal = upstream.getMockImplementation()!;
  upstream.mockImplementation(async (url: string, init: RequestInit) => {
    if (url.includes('/git/trees/')) await webhookRoute(await webhook(env, crypto.randomUUID(), 1, '', 'repository', { action: 'publicized', repository: { id: 21 } }), env);
    return normal(url, init);
  });
  expect(await (await invoke('/api/sync/inspect', choice)).json()).toEqual({ error: 'AUTHORISATION_CHANGED' });
  expect(sqlite.prepare('SELECT count(*) AS n FROM binding_intents').get()!.n).toBe(0);
});


async function uploadValue() {
  const result = await validateSyncBatch({ product: 'Lingfern', formatVersion: 1, profileId: 'local-guest', deviceId: 'device-a', batchId: 'fixed-batch', events: [{ id: 'saved-1', deviceId: 'device-a', counter: 1, occurredAt: '2026-09-30T00:00:00.000Z', type: 'saved_item', payload: { memoryId: 'sense-词', saved: true, reviewEnabled: false } }] });
  return { batch: result.batch, hash: result.hash };
}
async function boundEnvironment() {
  const result = await repositoryEnvironment();
  expect((await result.invoke('/api/sync/bind', { ...await result.verify(), confirm: true })).status).toBe(200);
  const scope = { accountId: 1, profileId: 'local-guest', bindingVersion: result.sqlite.prepare('SELECT binding_version FROM repository_bindings').get()!.binding_version as string };
  const invoke = (path: string, body?: unknown, override?: Record<string, string>) => result.invoke(path, path === '/api/sync/batches' && body && typeof body === 'object' ? { scope, ...body } : body, override);
  return { ...result, invoke, scope };
}

test('fixed batch uploads confirm remote canonical content and duplicate retries never rewrite', async () => {
  const { invoke, fixture, scope } = await boundEnvironment(), value = await uploadValue();
  const first = await invoke('/api/sync/batches', value);
  expect(first.status).toBe(200);
  expect(first.headers.get('Cache-Control')).toContain('no-store');
  expect(await first.json()).toEqual({ scope: scope, batchId: 'fixed-batch', hash: value.hash, previouslyWritten: false });
  const retry = await invoke('/api/sync/batches', value);
  expect(await retry.json()).toEqual({ scope, batchId: 'fixed-batch', hash: value.hash, previouslyWritten: true });
  expect(fixture.batchWrites).toBe(1);
  const different = await validateSyncBatch({ ...value.batch, events: value.batch.events.map(event => ({ ...event, occurredAt: '2026-01-01T00:00:00.000Z' })) });
  const conflict = await invoke('/api/sync/batches', { batch: different.batch, hash: different.hash });
  expect(conflict.status).toBe(409);
  expect(await conflict.json()).toEqual({ error: 'SYNC_BATCH_CONFLICT' });
  expect(fixture.batchWrites).toBe(1);
});

test('lost batch acknowledgement retries the original path and recovers the existing payload', async () => {
  const { invoke, fixture } = await boundEnvironment(), value = await uploadValue();
  fixture.batchLostAck = true;
  expect((await invoke('/api/sync/batches', value)).status).toBe(503);
  fixture.batchLostAck = false;
  expect(await (await invoke('/api/sync/batches', value)).json()).toMatchObject({ previouslyWritten: true, hash: value.hash });
  expect(fixture.batchWrites).toBe(1);
});

test('upload trust boundaries reject wrong CSRF, arbitrary destinations, bad hashes and another profile', async () => {
  const { invoke, fixture } = await boundEnvironment(), value = await uploadValue();
  expect((await invoke('/api/sync/batches', value, { 'X-CSRF-Token': 'wrong' })).status).toBe(403);
  expect((await invoke('/api/sync/batches', { ...value, owner: 'other', path: '../file' })).status).toBe(400);
  expect((await invoke('/api/sync/batches', { ...value, hash: 'a'.repeat(64) })).status).toBe(400);
  const other = await validateSyncBatch({ ...value.batch, profileId: 'other-profile' });
  expect((await invoke('/api/sync/batches', { batch: other.batch, hash: other.hash })).status).toBe(409);
  fixture.repository.private = false;
  expect((await invoke('/api/sync/batches', value)).status).toBe(409);
  expect(fixture.batchWrites).toBe(0);
});

test('repository webhook arriving during upload verification prevents the write', async () => {
  const { invoke, fixture, upstream, env } = await boundEnvironment(), value = await uploadValue();
  const normal = upstream.getMockImplementation()!;
  upstream.mockImplementation(async (url, init) => {
    const response = await normal(url, init);
    if (url.includes('/git/trees/')) await webhookRoute(await webhook(env, crypto.randomUUID(), 1, '', 'repository', { action: 'publicized', repository: { id: 21 } }), env);
    return response;
  });
  expect((await invoke('/api/sync/batches', value)).status).toBe(409);
  expect(fixture.batchWrites).toBe(0);
});

test('disconnecting or replacing a binding during a write fences its late acknowledgement', async () => {
  const { invoke, fixture, sqlite } = await boundEnvironment(), value = await uploadValue();
  fixture.duringPut = async () => { sqlite.prepare("UPDATE repository_bindings SET binding_version='new-generation'").run(); };
  const response = await invoke('/api/sync/batches', value);
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'AUTHORISATION_CHANGED' });
  expect(fixture.batchWrites).toBe(1); // The provider may already have accepted bytes; no false local acknowledgement.
});

test('bounded branch-conflict retries and provider timing leave fixed batches pending', async () => {
  const { invoke, fixture } = await boundEnvironment(), value = await uploadValue();
  fixture.conflicts = 3;
  expect((await invoke('/api/sync/batches', value)).status).toBe(200);
  expect(fixture.conflicts).toBe(0); expect(fixture.batchWrites).toBe(1);
  const next = await validateSyncBatch({ ...value.batch, batchId: 'next' });
  fixture.retryAfter = '60';
  expect((await invoke('/api/sync/batches', { batch: next.batch, hash: next.hash })).status).toBe(429);
  expect(fixture.batchWrites).toBe(1);
});

test('exhausted branch conflicts stop after three retries with no invented confirmation', async () => {
  const { invoke, fixture } = await boundEnvironment();
  fixture.conflicts = 10;
  const response = await invoke('/api/sync/batches', await uploadValue());
  expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: 'SYNC_PENDING' });
  expect(fixture.conflicts).toBe(6); expect(fixture.batchWrites).toBe(0);
});

test('capacity and private-field validation stop uploads without changing repository contents', async () => {
  const { invoke, fixture } = await boundEnvironment(), value = await uploadValue();
  expect((await invoke('/api/sync/batches', { ...value, batch: { ...value.batch, answers: ['private'] } })).status).toBe(400);
  fixture.extraFiles = Array.from({ length: 5000 }, (_, i) => ({ path: `records/device-${i}/batch.json`, mode: '100644', type: 'blob', sha: 'c'.repeat(40), size: 1 }));
  expect((await invoke('/api/sync/batches', value)).status).toBe(413);
  expect(fixture.batchWrites).toBe(0);
});


async function seedDownload(fixture: Awaited<ReturnType<typeof repositoryEnvironment>>['fixture'], count: number) {
  for (let i = 0; i < count; i++) {
    const { batch } = await uploadValue();
    batch.batchId = `batch-${String(i).padStart(2, '0')}`;
    const content = new TextEncoder().encode(JSON.stringify(batch));
    fixture.batches.set(`records/${batch.deviceId}/${batch.batchId}.json`, { content: btoa(Array.from(content, b => String.fromCharCode(b)).join('')), sha: (i + 100).toString(16).padStart(40, '0') });
  }
}

test('download pages stay on a fixed commit after the branch advances, with encrypted cursor replay', async () => {
  const { invoke, fixture, upstream } = await boundEnvironment(); await seedDownload(fixture, 12);
  const first = await invoke('/api/sync/changes?profileId=local-guest');
  expect(first.status).toBe(200); expect(first.headers.get('Cache-Control')).toContain('no-store');
  const page = syncChangesSchema.parse(await first.json());
  expect(page.files).toHaveLength(10); expect(page.batches).toHaveLength(10); expect(page.total).toBe(12); expect(page.nextCursor).toBeDefined();
  expect(page.cursor).not.toContain('local-guest');
  expect(page.scope).toMatchObject({ accountId: 1, profileId: 'local-guest' });
  expect(page.scope?.bindingVersion).toHaveLength(43);
  fixture.head = 'e'.repeat(40); await seedDownload(fixture, 13);
  const next = syncChangesSchema.parse(await (await invoke(`/api/sync/changes?profileId=local-guest&cursor=${page.nextCursor}`)).json());
  expect(next.commit).toBe(page.commit); expect(next.total).toBe(12); expect(next.batches).toHaveLength(2); expect(next.nextCursor).toBeUndefined();
  expect(upstream.mock.calls.some(([url]) => new URL(url).pathname.endsWith('/commits/' + page.commit))).toBe(true);
  const retry = syncChangesSchema.parse(await (await invoke(`/api/sync/changes?profileId=local-guest&cursor=${page.nextCursor}`)).json());
  expect(retry.batches).toEqual(next.batches);
  expect(retry.cursor).toBe(page.nextCursor);
  expect(next.cursor).toBe(page.nextCursor);
  const fresh = syncChangesSchema.parse(await (await invoke('/api/sync/changes?profileId=local-guest&metadata=1')).json());
  expect(fresh.commit).toBe(fixture.head); expect(fresh.total).toBe(13);
});

test('metadata listing and known immutable blobs avoid refetching local batches', async () => {
  const { invoke, fixture, upstream } = await boundEnvironment(); await seedDownload(fixture, 3);
  const metadata = syncChangesSchema.parse(await (await invoke('/api/sync/changes?profileId=local-guest&metadata=1')).json());
  expect(metadata.files).toHaveLength(3); expect(metadata.batches).toEqual([]);
  const count = upstream.mock.calls.filter(([url]) => url.includes('/git/blobs/') && !url.endsWith('d'.repeat(40))).length;
  const known = metadata.files.map(({ deviceId, batchId, blobSha }) => ({ deviceId, batchId, blobSha }));
  const page = syncChangesSchema.parse(await (await invoke(`/api/sync/changes?profileId=local-guest&cursor=${metadata.cursor}&known=${encodeURIComponent(JSON.stringify(known))}`)).json());
  expect(page.batches).toEqual([]);
  expect(page.cursor).toBe(metadata.cursor);
  expect(page.scope).toEqual(metadata.scope);
  expect(upstream.mock.calls.filter(([url]) => url.includes('/git/blobs/') && !url.endsWith('d'.repeat(40)))).toHaveLength(count);
});

test('cursor tampering, cross-profile query and a changed binding fail without reading a batch', async () => {
  const { invoke, fixture, sqlite } = await boundEnvironment(); await seedDownload(fixture, 1);
  const page = syncChangesSchema.parse(await (await invoke('/api/sync/changes?profileId=local-guest&metadata=1')).json());
  const changed = (page.cursor[0] === 'A' ? 'B' : 'A') + page.cursor.slice(1);
  expect((await invoke(`/api/sync/changes?profileId=local-guest&cursor=${changed}`)).status).toBe(400);
  expect((await invoke(`/api/sync/changes?profileId=other&cursor=${page.cursor}`)).status).toBe(409);
  expect((await invoke('/api/sync/changes?profileId=local-guest&commit=arbitrary')).status).toBe(400);
  sqlite.prepare("UPDATE repository_bindings SET binding_version='new-version'").run();
  expect((await invoke(`/api/sync/changes?profileId=local-guest&cursor=${page.cursor}`)).status).toBe(400);
});

test('invalid remote ownership, truncated trees and late revocation refuse the complete page', async () => {
  const { invoke, fixture, upstream, env } = await boundEnvironment(); await seedDownload(fixture, 1);
  const item = fixture.batches.values().next().value!;
  const decoded = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(item.content), c => c.charCodeAt(0))));
  decoded.profileId = 'other'; const bytes = new TextEncoder().encode(JSON.stringify(decoded)); item.content = btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
  expect((await invoke('/api/sync/changes?profileId=local-guest')).status).toBe(409);
  fixture.truncated = true;
  expect((await invoke('/api/sync/changes?profileId=local-guest')).status).toBe(413);
  fixture.truncated = false; await seedDownload(fixture, 1);
  const normal = upstream.getMockImplementation()!;
  upstream.mockImplementation(async (url, init) => { const response = await normal(url, init); if (url.includes('/git/blobs/') && !url.endsWith('d'.repeat(40))) await webhookRoute(await webhook(env, crypto.randomUUID(), 1, '', 'repository', { action: 'publicized', repository: { id: 21 } }), env); return response; });
  const revoked = await invoke('/api/sync/changes?profileId=local-guest');
  expect(revoked.status).toBe(409); expect(await revoked.json()).toEqual({ error: 'AUTHORISATION_CHANGED' });
});

async function rewrittenCursor(token: string, secret: string, update: Record<string, unknown>) {
  const bytes = Uint8Array.from(atob(token.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', Uint8Array.from(atob(secret), c => c.charCodeAt(0)), 'AES-GCM', false, ['encrypt', 'decrypt']);
  const additionalData = new TextEncoder().encode('lingfern-sync-cursor-v1');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12), additionalData }, key, bytes.slice(12));
  const changed = { ...JSON.parse(new TextDecoder().decode(plain)), ...update };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData }, key, new TextEncoder().encode(JSON.stringify(changed))));
  return btoa(Array.from([...iv, ...encrypted], c => String.fromCharCode(c)).join('')).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

test('validly encrypted expired cursors are rejected independently of tamper detection', async () => {
  const { invoke, env } = await boundEnvironment();
  const page = syncChangesSchema.parse(await (await invoke('/api/sync/changes?profileId=local-guest&metadata=1')).json());
  const expired = await rewrittenCursor(page.cursor, env.TOKEN_ENCRYPTION_KEY!, { expiresAt: 1 });
  expect((await invoke(`/api/sync/changes?profileId=local-guest&cursor=${expired}`)).status).toBe(400);
});

test('another verified account cannot use the original account cursor, even with its own binding', async () => {
  const { invoke, env, sqlite } = await boundEnvironment();
  const page = syncChangesSchema.parse(await (await invoke('/api/sync/changes?profileId=local-guest&metadata=1')).json());
  await tokenAccount(env, sqlite, 2, false);
  const cookie = randomSecret(), csrf = randomSecret();
  sqlite.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(await digest(cookie), 2, csrf, 9999999999, 9999999999);
  sqlite.prepare("INSERT INTO repository_states(id,version) VALUES(99,'other')").run();
  sqlite.prepare("INSERT INTO repository_bindings(account_id,profile_id,repository_id,installation_id,owner_login,repository_name,branch,updated_at,binding_version) VALUES(2,'local-guest',99,31,'user2','other','main',1,?)").run(randomSecret());
  const response = await invoke(`/api/sync/changes?profileId=local-guest&cursor=${page.cursor}`, undefined, { Cookie: `lingfern_local_session=${cookie}`, 'X-CSRF-Token': csrf });
  expect(response.status).toBe(400); expect(await response.json()).toEqual({ error: 'SYNC_CURSOR_INVALID' });
});

test('large decoded blobs respect the two-MiB page budget and at most two parallel reads', async () => {
  const { invoke, fixture, upstream } = await boundEnvironment(); await seedDownload(fixture, 9);
  for (const item of fixture.batches.values()) {
    const raw = atob(item.content); item.content = btoa(' '.repeat(256000 - raw.length) + raw);
  }
  let active = 0, maximum = 0;
  const normal = upstream.getMockImplementation()!;
  upstream.mockImplementation(async (url, init) => {
    if (!url.includes('/git/blobs/') || url.endsWith('d'.repeat(40))) return normal(url, init);
    active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    try { return await normal(url, init); } finally { active--; }
  });
  const page = syncChangesSchema.parse(await (await invoke('/api/sync/changes?profileId=local-guest')).json());
  expect(page.batches).toHaveLength(8); expect(page.files.reduce((sum, file) => sum + file.bytes, 0)).toBeLessThanOrEqual(2 * 1024 * 1024);
  expect(maximum).toBe(2); expect(page.nextCursor).toBeDefined();
});


test('upload scope rejects old bindings, foreign accounts and profile mismatches before provider writes', async () => {
  const { invoke, fixture, sqlite, scope, env, headers } = await boundEnvironment(), value = await uploadValue();
  const summary = await (await authRoute(request('/api/session', { headers }), env))!.json() as { bindings: { bindingVersion: string }[] };
  expect(summary.bindings[0].bindingVersion).toBe(scope.bindingVersion);
  for (const wrong of [{ ...scope, accountId: 2 }, { ...scope, profileId: 'another' }, { ...scope, bindingVersion: 'x'.repeat(43) }]) {
    const response = await invoke('/api/sync/batches', { ...value, scope: wrong });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'AUTHORISATION_CHANGED' });
  }
  expect((await invoke('/api/sync/batches', { ...value, scope: undefined })).status).toBe(400);
  sqlite.prepare('UPDATE repository_bindings SET binding_version=?').run('y'.repeat(43));
  expect((await invoke('/api/sync/batches', value)).status).toBe(409);
  expect(fixture.batchWrites).toBe(0);
});


test('sync availability is explicit, fails closed at transport, and never grants identity or binding', async () => {
  const { env, sqlite, invoke, upstream, verify, headers } = await repositoryEnvironment();
  for (const flag of [undefined, 'false', 'TRUE', '1', 'true']) {
    env.SYNC_ENABLED = flag;
    const session = sessionSummarySchema.parse(await (await authRoute(request('/api/session', { headers }), env))!.json());
    expect(session.syncAvailable).toBe(flag === 'true');
    expect(session.bindings).toEqual([]);
    const before = upstream.mock.calls.length;
    const response = await invoke('/api/sync/changes?profileId=local-guest');
    expect(response.status).toBe(flag === 'true' ? 409 : 503);
    if (flag !== 'true') {
      expect(await response.json()).toEqual({ error: 'SYNC_UNAVAILABLE' });
      expect((await invoke('/api/sync/batches', {})).status).toBe(503);
      expect(upstream.mock.calls.length).toBe(before);
    }
  }
  env.SYNC_ENABLED = 'true'; delete env.GITHUB_WEBHOOK_SECRET;
  expect(sessionSummarySchema.parse(await (await authRoute(request('/api/session', { headers }), env))!.json()).syncAvailable).toBe(false);
  expect((await invoke('/api/sync/changes?profileId=local-guest')).status).toBe(503);
  env.GITHUB_WEBHOOK_SECRET = 'synthetic';
  const intent = await verify();
  const bound = await (await invoke('/api/sync/bind', { ...intent, confirm: true })).json() as { syncAvailable: boolean; binding: unknown };
  const binding = repositoryBindingSchema.parse(bound.binding);
  expect(bound.syncAvailable).toBe(true);
  expect(binding.bindingVersion).toMatch(/^[\w-]{43}$/);
  expect(binding.bindingVersion).toBe(sqlite.prepare('SELECT binding_version FROM repository_bindings').get()!.binding_version);
  env.SYNC_ENABLED = 'false';
  expect((await invoke('/api/sync/changes?profileId=local-guest')).status).toBe(503);
  expect((await invoke('/api/sync/batches', {}, { 'X-CSRF-Token': 'wrong' })).status).toBe(403);
  expect((await invoke('/api/sync/disconnect', { profileId: 'local-guest', confirm: true })).status).toBe(200);
  env.SYNC_ENABLED = 'true'; sqlite.exec('UPDATE accounts SET revoked=1');
  expect((await invoke('/api/sync/changes?profileId=local-guest')).status).toBe(401);
  expect(sessionSummarySchema.parse(await (await authRoute(request('/api/session', { headers }), env))!.json()).syncAvailable).toBe(false);
});
