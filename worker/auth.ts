import { z } from 'zod';

export interface AuthEnv {
  AUTH_DB?: D1Database;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  TOKEN_ENCRYPTION_KEY?: string;
  LOCAL_AUTH?: string;
  SYNC_ENABLED?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  GITHUB_APP_SLUG?: string;
}
// Missing or malformed configuration never enables remote exchange.
export const syncEnabled = (env: AuthEnv) => env.SYNC_ENABLED === 'true' && Boolean(env.AUTH_DB && env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.TOKEN_ENCRYPTION_KEY && env.GITHUB_WEBHOOK_SECRET);
export type WebSession = { hash: string; csrf: string; id: number; login: string };
export class ApiError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" };
export const privateJson = (body: unknown, status = 200) => Response.json(body, { status, headers });
const bytes = (value: string) => new TextEncoder().encode(value);
const base64 = (value: Uint8Array) => btoa(String.fromCharCode(...value));
const fromBase64 = (value: string) => Uint8Array.from(atob(value), character => character.charCodeAt(0));
export const randomSecret = () => base64(crypto.getRandomValues(new Uint8Array(32))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
export const digest = async (value: string | Uint8Array<ArrayBuffer>) => base64(new Uint8Array(await crypto.subtle.digest('SHA-256', typeof value === 'string' ? bytes(value) : value))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
export async function sealTokens(value: unknown, secret: string, accountId: number) {
  const keyBytes = fromBase64(secret);
  if (keyBytes.length !== 32) throw new Error('KEY');
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: bytes(`github:${accountId}`) }, key, bytes(JSON.stringify(value)));
  return JSON.stringify({ iv: base64(iv), data: base64(new Uint8Array(encrypted)) });
}
function cookie(request: Request, name: string) {
  const values = (request.headers.get('Cookie') ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith(`${name}=`));
  return values.length === 1 ? values[0].slice(name.length + 1) : '';
}
function origin(request: Request, env: AuthEnv) {
  const actual = new URL(request.url).origin;
  if (actual === 'https://lingfern.com') return actual;
  if (env.LOCAL_AUTH === 'true' && actual === 'http://127.0.0.1:8787') return actual;
  throw new Error('ORIGIN');
}
export async function readSession(request: Request, env: AuthEnv): Promise<WebSession | null> {
  const site = origin(request, env), credential = cookie(request, names(site.startsWith('http:')).session);
  const now = Math.floor(Date.now() / 1000);
  return /^[\w-]{43}$/.test(credential) && env.AUTH_DB ? env.AUTH_DB.prepare('SELECT sessions.hash,sessions.csrf,accounts.id,accounts.login FROM sessions JOIN accounts ON accounts.id=sessions.account_id WHERE sessions.hash=? AND sessions.expires_at>? AND sessions.absolute_expires_at>? AND accounts.revoked=0').bind(await digest(credential), now, now).first<WebSession>() : null;
}
export async function requireSession(request: Request, env: AuthEnv, write = false) {
  let site: string;
  try { site = origin(request, env); } catch { throw new ApiError('ORIGIN', 403); }
  const actual = request.headers.get('Origin');
  const validOrigin = actual === site || (env.LOCAL_AUTH === 'true' && site.startsWith('http:') && actual === 'http://127.0.0.1:5173');
  if ((actual && !validOrigin) || (write && !validOrigin)) throw new ApiError('ORIGIN', 403);
  if (!env.AUTH_DB || !env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.TOKEN_ENCRYPTION_KEY) throw new ApiError('AUTH_NOT_CONFIGURED', 503);
  const session = await readSession(request, env);
  if (!session) throw new ApiError('UNAUTHENTICATED', 401);
  if (write && request.headers.get('X-CSRF-Token') !== session.csrf) throw new ApiError('CSRF', 403);
  return session;
}
function names(local: boolean) { return { session: local ? 'lingfern_local_session' : '__Host-lingfern_session', browser: local ? 'lingfern_local_auth' : '__Host-lingfern_auth' }; }
function setCookie(name: string, value: string, seconds: number, local: boolean) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${local ? '' : '; Secure'}`;
}
function redirect(path: string, cookies: string[]) {
  const result = new Headers({ ...headers, Location: path });
  for (const value of cookies) result.append('Set-Cookie', value);
  return new Response(null, { status: 303, headers: result });
}
export const tokenSchema = z.object({ access_token: z.string().min(1).max(4096), token_type: z.literal('bearer'), expires_in: z.number().int().positive().optional(), refresh_token: z.string().min(1).max(4096).optional(), refresh_token_expires_in: z.number().int().positive().optional() });
const userSchema = z.object({ id: z.number().int().positive(), login: z.string().regex(/^[a-zA-Z0-9-]{1,39}$/) });
export async function githubJson(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(15_000) });
  if (response.status >= 300 && response.status < 400) { await response.body?.cancel(); throw new GithubError(response.status); }
  if (!response.ok) throw new GithubError(response.status);
  return JSON.parse(new TextDecoder().decode(await boundedBody(response.body, 65536)));
}
export async function boundedBody(body: ReadableStream<Uint8Array> | null, limit: number) {
  const reader = body?.getReader();
  if (!reader) throw new Error('BODY');
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) { const next = await reader.read(); if (next.done) break; length += next.value.byteLength; if (length > limit) { await reader.cancel(); throw new Error('BODY_SIZE'); } chunks.push(next.value); }
  const combined = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length; }
  return combined;
}

export class GithubError extends Error {
  constructor(public status: number) { super('GITHUB'); }
}
export async function openTokens(value: string, secret: string, accountId: number) {
  const sealed = z.object({ iv: z.string().max(32), data: z.string().max(32768) }).strict().parse(JSON.parse(value));
  const key = await crypto.subtle.importKey('raw', fromBase64(secret), 'AES-GCM', false, ['decrypt']);
  const result = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(sealed.iv), additionalData: bytes(`github:${accountId}`) }, key, fromBase64(sealed.data));
  return tokenSchema.extend({ obtainedAt: z.number().int().nonnegative() }).parse(JSON.parse(new TextDecoder().decode(result)));
}
export async function revokeAccount(db: D1Database, accountId: number, encrypted?: string, lease: string | null = null) {
  const guard = encrypted === undefined ? '' : ' AND encrypted_tokens=? AND refresh_lease IS ?';
  const parameters = encrypted === undefined ? [accountId] : [accountId, encrypted, lease];
  await db.batch([
    db.prepare(`DELETE FROM shared_contexts WHERE account_id=? AND EXISTS(SELECT 1 FROM accounts WHERE id=?${guard})`).bind(accountId, ...parameters),
    db.prepare(`UPDATE mcp_connections SET revoked=1 WHERE account_id=? AND EXISTS(SELECT 1 FROM accounts WHERE id=?${guard})`).bind(accountId, ...parameters),
    db.prepare(`DELETE FROM binding_intents WHERE account_id=? AND EXISTS(SELECT 1 FROM accounts WHERE id=?${guard})`).bind(accountId, ...parameters),
    db.prepare(`UPDATE repository_bindings SET disabled=1 WHERE account_id=? AND EXISTS(SELECT 1 FROM accounts WHERE id=?${guard})`).bind(accountId, ...parameters),
    db.prepare(`DELETE FROM sessions WHERE account_id=? AND EXISTS(SELECT 1 FROM accounts WHERE id=?${guard})`).bind(accountId, ...parameters),
    db.prepare(`UPDATE accounts SET revoked=1,encrypted_tokens='',refresh_lease=NULL,refresh_until=0 WHERE id=?${guard}`).bind(...parameters),
  ]);
}
export async function githubToken(env: AuthEnv, accountId: number): Promise<string> {
  if (!env.AUTH_DB || !env.TOKEN_ENCRYPTION_KEY || !env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) throw new Error('AUTH_NOT_CONFIGURED');
  const db = env.AUTH_DB;
  for (let attempt = 0; attempt < 150; attempt++) {
    const now = Math.floor(Date.now() / 1000);
    const account = await db.prepare('SELECT encrypted_tokens,revoked,refresh_lease,refresh_until FROM accounts WHERE id=?').bind(accountId).first<{ encrypted_tokens: string; revoked: number; refresh_lease: string | null; refresh_until: number }>();
    if (!account || account.revoked) throw new Error('REAUTHORISE');
    if (account.refresh_lease) {
      if (account.refresh_until <= now) {
        // A lost refresh response may already have consumed the old token. Never reuse it.
        await revokeAccount(db, accountId, account.encrypted_tokens, account.refresh_lease);
        throw new Error('REAUTHORISE');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      continue;
    }
    const tokens = await openTokens(account.encrypted_tokens, env.TOKEN_ENCRYPTION_KEY, accountId);
    if (!tokens.expires_in || tokens.obtainedAt + tokens.expires_in > now + 60) return tokens.access_token;
    if (!tokens.refresh_token || !tokens.refresh_token_expires_in || tokens.obtainedAt + tokens.refresh_token_expires_in <= now) {
      await revokeAccount(db, accountId, account.encrypted_tokens);
      throw new Error('REAUTHORISE');
    }
    const lease = randomSecret();
    const acquired = await db.prepare('UPDATE accounts SET refresh_lease=?,refresh_until=? WHERE id=? AND revoked=0 AND refresh_lease IS NULL AND encrypted_tokens=? RETURNING id').bind(lease, now + 30, accountId, account.encrypted_tokens).first();
    if (!acquired) continue;
    try {
      const refreshed = tokenSchema.required({ expires_in: true, refresh_token: true, refresh_token_expires_in: true }).parse(await githubJson('https://github.com/login/oauth/access_token', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: tokens.refresh_token }) }));
      const encrypted = await sealTokens({ ...refreshed, obtainedAt: Math.floor(Date.now() / 1000) }, env.TOKEN_ENCRYPTION_KEY, accountId);
      const saved = await db.prepare('UPDATE accounts SET encrypted_tokens=?,refresh_lease=NULL,refresh_until=0,updated_at=? WHERE id=? AND revoked=0 AND refresh_lease=? AND encrypted_tokens=? RETURNING id').bind(encrypted, now, accountId, lease, account.encrypted_tokens).first();
      if (saved) return refreshed.access_token;
      // A concurrent login/revocation changed the generation; discard this refresh result.
    } catch {
      await revokeAccount(db, accountId, account.encrypted_tokens, lease);
      throw new Error('REAUTHORISE');
    }
  }
  throw new Error('REFRESH_PENDING');
}
export async function githubCredential(env: AuthEnv, accountId: number) {
  const access = await githubToken(env, accountId);
  const current = await env.AUTH_DB!.prepare('SELECT encrypted_tokens FROM accounts WHERE id=? AND revoked=0').bind(accountId).first<{ encrypted_tokens: string }>();
  if (!current || (await openTokens(current.encrypted_tokens, env.TOKEN_ENCRYPTION_KEY!, accountId)).access_token !== access) throw new Error('AUTH_CHANGED');
  return { access, encrypted: current.encrypted_tokens };
}
export async function authRoute(request: Request, env: AuthEnv): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (!['/api/auth/start', '/api/auth/callback', '/api/session', '/api/auth/logout', '/api/auth/disconnect'].includes(url.pathname)) return;
  const expectedMethod = ['/api/auth/logout', '/api/auth/disconnect'].includes(url.pathname) ? 'POST' : 'GET';
  if (request.method !== expectedMethod) return privateJson({ error: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const site = origin(request, env); const local = site.startsWith('http:'); const name = names(local);
    const browserOrigin = request.headers.get('Origin');
    const validOrigin = browserOrigin === site || (local && browserOrigin === 'http://127.0.0.1:5173');
    if (browserOrigin && !validOrigin) return privateJson({ error: 'ORIGIN' }, 403);
    if (!env.AUTH_DB || !env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.TOKEN_ENCRYPTION_KEY) return privateJson({ error: 'AUTH_NOT_CONFIGURED' }, 503);
    const db = env.AUTH_DB; const now = Math.floor(Date.now() / 1000);
    if (url.pathname === '/api/auth/start') {
      if (request.headers.get('Sec-Fetch-Site') === 'cross-site') return privateJson({ error: 'ORIGIN' }, 403);
      const returnPath = url.searchParams.get('return') ?? '/settings';
      if (!['/settings', '/today', '/oauth/resume'].includes(returnPath)) return privateJson({ error: 'RETURN_PATH' }, 400);
      const limitKey = await digest(`${request.headers.get('CF-Connecting-IP') ?? 'local'}:${Math.floor(now / 60)}`);
      await db.prepare('DELETE FROM auth_limits WHERE expires_at < ?').bind(now).run();
      const limit = await db.prepare('INSERT INTO auth_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(limitKey, now + 120).first<{ count: number }>();
      if (!limit || limit.count > 10) return new Response(JSON.stringify({ error: 'RATE_LIMITED' }), { status: 429, headers: { ...headers, 'Content-Type': 'application/json', 'Retry-After': '60' } });
      const state = randomSecret(), browser = randomSecret(), verifier = randomSecret();
      await db.prepare('DELETE FROM auth_states WHERE expires_at < ?').bind(now).run();
      await db.prepare('INSERT INTO auth_states(hash,browser_hash,verifier,return_path,expires_at) VALUES(?,?,?,?,?)').bind(await digest(state), await digest(browser), verifier, returnPath, now + 600).run();
      const target = new URL('https://github.com/login/oauth/authorize');
      target.search = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: `${site}/api/auth/callback`, state, code_challenge: await digest(verifier), code_challenge_method: 'S256' }).toString();
      return redirect(target.href, [setCookie(name.browser, browser, 600, local)]);
    }
    if (url.pathname === '/api/auth/callback') {
      const state = url.searchParams.getAll('state'), code = url.searchParams.getAll('code');
      const browser = cookie(request, name.browser);
      if (state.length !== 1 || !/^[\w-]{43}$/.test(state[0]) || !/^[\w-]{43}$/.test(browser)) return privateJson({ error: 'AUTH_STATE' }, 400);
      // DELETE RETURNING atomically consumes the state before exchanging a code.
      const record = await db.prepare('DELETE FROM auth_states WHERE hash=? AND browser_hash=? AND expires_at>? RETURNING verifier,return_path').bind(await digest(state[0]), await digest(browser), now).first<{ verifier: string; return_path: string }>();
      if (!record) return privateJson({ error: 'AUTH_STATE' }, 400);
      if (url.searchParams.has('error')) return redirect('/settings?auth=cancelled', [setCookie(name.browser, '', 0, local)]);
      if (code.length !== 1 || !/^[a-zA-Z0-9_-]{1,200}$/.test(code[0])) return privateJson({ error: 'AUTH_CODE' }, 400);
      const tokens = tokenSchema.parse(await githubJson('https://github.com/login/oauth/access_token', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code: code[0], code_verifier: record.verifier, redirect_uri: `${site}/api/auth/callback` }) }));
      const user = userSchema.parse(await githubJson('https://api.github.com/user', { headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Lingfern' } }));
      const credential = randomSecret(), csrf = randomSecret();
      const encrypted = await sealTokens({ ...tokens, obtainedAt: now }, env.TOKEN_ENCRYPTION_KEY, user.id);
      await db.batch([
        db.prepare('INSERT INTO accounts(id,login,encrypted_tokens,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET login=excluded.login,encrypted_tokens=excluded.encrypted_tokens,updated_at=excluded.updated_at,revoked=0,refresh_lease=NULL,refresh_until=0').bind(user.id, user.login, encrypted, now),
        db.prepare('INSERT INTO sessions(hash,account_id,csrf,expires_at,absolute_expires_at) VALUES(?,?,?,?,?)').bind(await digest(credential), user.id, csrf, now + 7 * 86400, now + 30 * 86400),
      ]);
      return redirect(record.return_path, [setCookie(name.browser, '', 0, local), setCookie(name.session, credential, 30 * 86400, local)]);
    }
    const session = await readSession(request, env);
    if (url.pathname === '/api/session') {
      if (!session) return privateJson({ account: null, syncAvailable: false });
      let checkedTokens: string | undefined;
      try {
        const { access, encrypted } = await githubCredential(env, session.id);
        checkedTokens = encrypted;
        const actual = userSchema.parse(await githubJson('https://api.github.com/user', { headers: { Authorization: `Bearer ${access}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Lingfern' } }));
        if (actual.id !== session.id) throw new GithubError(401);
      } catch (error) {
        if (error instanceof GithubError && error.status === 401 && checkedTokens) await revokeAccount(db, session.id, checkedTokens);
        if ((error instanceof GithubError && error.status === 401) || (error instanceof Error && error.message === 'REAUTHORISE')) return privateJson({ account: null, syncAvailable: false });
        throw error;
      }
      // Provider verification yields to logout, expiry and credential rotation. Renew only
      // the verified generation, then fence again after the binding read below.
      const verifiedAt = Math.floor(Date.now() / 1000);
      const renewed = await db.prepare('UPDATE sessions SET expires_at=MIN(?,absolute_expires_at) WHERE hash=? AND account_id=? AND csrf=? AND expires_at>? AND absolute_expires_at>? AND EXISTS(SELECT 1 FROM accounts WHERE id=? AND revoked=0 AND encrypted_tokens=?) RETURNING hash').bind(verifiedAt + 7 * 86400, session.hash, session.id, session.csrf, verifiedAt, verifiedAt, session.id, checkedTokens).first();
      if (!renewed) return privateJson({ account: null, syncAvailable: false });
      const bindings = await db.prepare('SELECT repository_name AS name,owner_login AS owner,profile_id AS profileId,disabled,binding_version AS bindingVersion FROM repository_bindings WHERE account_id=? LIMIT 100').bind(session.id).all<{ name: string; owner: string; profileId: string; disabled: number; bindingVersion: string }>();
      const finalAt = Math.floor(Date.now() / 1000);
      const current = await db.prepare('SELECT accounts.login FROM sessions JOIN accounts ON accounts.id=sessions.account_id WHERE sessions.hash=? AND sessions.account_id=? AND sessions.csrf=? AND sessions.expires_at>? AND sessions.absolute_expires_at>? AND accounts.revoked=0 AND accounts.encrypted_tokens=?').bind(session.hash, session.id, session.csrf, finalAt, finalAt, checkedTokens).first<{ login: string }>();
      if (!current) return privateJson({ account: null, syncAvailable: false });
      return privateJson({ account: { id: session.id, login: current.login }, csrfToken: session.csrf, syncAvailable: syncEnabled(env), bindings: bindings.results.map(binding => ({ name: binding.name, owner: binding.owner, profileId: binding.profileId, disabled: Boolean(binding.disabled), ...(/^[\w-]{43}$/.test(binding.bindingVersion) ? { bindingVersion: binding.bindingVersion } : {}) })) });
    }
    if (!session) return privateJson({ error: 'UNAUTHENTICATED' }, 401);
    if (!validOrigin || request.headers.get('X-CSRF-Token') !== session.csrf) return privateJson({ error: 'CSRF' }, 403);
    if (url.pathname === '/api/auth/disconnect') {
      if (!request.headers.get('Content-Type')?.startsWith('application/json')) return privateJson({ error: 'CONTENT_TYPE' }, 415);
      try { z.object({ confirm: z.literal(true) }).strict().parse(JSON.parse(new TextDecoder().decode(await boundedBody(request.body, 1024)))); }
      catch { return privateJson({ error: 'CONFIRMATION_REQUIRED' }, 400); }
      let providerRevoked = false;
      try {
        const access = await githubToken(env, session.id);
        const response = await fetch(`https://api.github.com/applications/${encodeURIComponent(env.GITHUB_CLIENT_ID)}/grant`, { method: 'DELETE', redirect: 'manual', signal: AbortSignal.timeout(15_000), headers: { Authorization: `Basic ${btoa(`${env.GITHUB_CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`)}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Lingfern' }, body: JSON.stringify({ access_token: access }) });
        if (response.status >= 300 && response.status < 400) { await response.body?.cancel(); throw new GithubError(response.status); }
        providerRevoked = response.status === 204;
        await response.body?.cancel();
      } catch { /* Local revocation must still work when GitHub is unavailable. */ }
      await revokeAccount(db, session.id);
      const response = privateJson({ disconnected: true, providerRevoked });
      response.headers.set('Set-Cookie', setCookie(name.session, '', 0, local));
      return response;
    }
    await db.prepare('DELETE FROM sessions WHERE hash=?').bind(session.hash).run();
    return new Response(null, { status: 204, headers: { ...headers, 'Set-Cookie': setCookie(name.session, '', 0, local) } });
  } catch { return privateJson({ error: 'AUTH_UNAVAILABLE' }, 503); }
}
