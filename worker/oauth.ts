import OAuthProvider, { AuthorizationError, OAuthError, getOAuthApi, type OAuthHelpers, type OAuthProviderOptions, type OAuthResourceContext } from '@cloudflare/workers-oauth-provider';
import { z } from 'zod';
import { ApiError, boundedBody, digest, privateJson, readSession, requireSession } from './auth';
import { mcpFetch } from './mcp';
import { shareIdSchema } from '../src/shared/sharing';
import { sharingLimit, type SharingEnv } from './sharing';
import { publicTeachingCatalogue } from './catalogue';

export type OAuthEnv = SharingEnv & { OAUTH_KV?: KVNamespace; OAUTH_PROVIDER?: OAuthHelpers };
const scopes = ['mcp:read', 'contexts:read', 'materials:read', 'offline_access'];
const site = (env: OAuthEnv) => env.LOCAL_AUTH === 'true' ? 'http://127.0.0.1:8787' : 'https://lingfern.com';
const escape = (value: string) => value.replace(/[&<>"']/g, character => `&#${character.charCodeAt(0)};`);
const labels = {
  'zh-Hans': { title: '授权助手', allow: '允许', deny: '拒绝', client: '客户端', destination: '返回地址', identity: '账号', warning: '客户端名称由其自行提供。仅在你主动发起连接时继续。', contexts: '读取你明确分享给此客户端的内容', materials: '检索公开学习资料', refresh: '保持连接（最长 30 天）', local: '授权将返回本机应用。', limitation: '撤销后将停止后续读取，但无法收回助手已经取得的副本。', login: '登录 GitHub 后继续' },
  'zh-Hant': { title: '授權助手', allow: '允許', deny: '拒絕', client: '用戶端', destination: '返回位址', identity: '帳號', warning: '用戶端名稱由其自行提供。僅在你主動發起連線時繼續。', contexts: '讀取你明確分享給此用戶端的內容', materials: '檢索公開學習資料', refresh: '保持連線（最長 30 天）', local: '授權將返回本機應用程式。', limitation: '撤銷後將停止後續讀取，但無法收回助手已經取得的副本。', login: '登入 GitHub 後繼續' },
  en: { title: 'Authorize an assistant', allow: 'Allow', deny: 'Deny', client: 'Client', destination: 'Return address', identity: 'Account', warning: 'The client supplies its own name. Continue only if you started this connection.', contexts: 'Read contexts you explicitly share with this client', materials: 'Search public learning materials', refresh: 'Keep connected (up to 30 days)', local: 'Authorization returns to an app on this computer.', limitation: 'Revocation stops later reads; it cannot recall copies already received by the assistant.', login: 'Sign in with GitHub to continue' },
};
function language(request: Request) {
  const value = request.headers.get('Accept-Language') ?? '';
  return /^(zh-(?:TW|HK|Hant))/i.test(value) ? 'zh-Hant' : /^zh/i.test(value) ? 'zh-Hans' : 'en';
}
function html(request: Request, content: string, headers = new Headers(), redirectUri?: string) {
  headers.set('Content-Type', 'text/html; charset=utf-8'); headers.set('Cache-Control', 'private, no-store');
  // Browsers apply form-action to the redirect after consent as well as the form target.
  headers.set('Content-Security-Policy', `default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'${redirectUri ? ` ${(new URL(redirectUri).origin === 'null' ? new URL(redirectUri).protocol : new URL(redirectUri).origin)}` : ''}; base-uri 'none'; frame-ancestors 'none'`);
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(`<!doctype html><html lang="${language(request)}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/oauth-consent.css"><title>Lingfern</title><main><span class="logo" role="img" aria-label="Lingfern"></span>${content}</main></html>`, { headers });
}
const cookieName = (env: OAuthEnv) => env.LOCAL_AUTH === 'true' ? 'lingfern_local_mcp_return' : '__Host-lingfern-mcp-return';
const returnCookie = (env: OAuthEnv, value: string, maxAge: number) => `${cookieName(env)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${env.LOCAL_AUTH === 'true' ? '' : '; Secure'}`;
async function consent(request: Request, env: OAuthEnv) {
  const oauth = env.OAUTH_PROVIDER!, db = env.AUTH_DB!.withSession('first-primary'), url = new URL(request.url), time = Math.floor(Date.now() / 1000);
  if (request.method === 'GET') {
    let validatedRequest = request;
    if (url.pathname === '/oauth/resume') {
      const credential = request.headers.get('Cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(`${cookieName(env)}=`))?.slice(cookieName(env).length + 1) ?? '';
      if (!/^[a-f0-9]{64}$/.test(credential)) throw new ApiError('MCP_LOGIN_EXPIRED', 400);
      await requireSession(request, env);
      const pending = await db.prepare('DELETE FROM mcp_login_requests WHERE hash=? AND expires_at>? RETURNING authorize_url').bind(await digest(credential), time).first<{ authorize_url: string }>();
      if (!pending) throw new ApiError('MCP_LOGIN_EXPIRED', 400);
      validatedRequest = new Request(pending.authorize_url, { headers: request.headers });
    }
    // Clients that omit scopes get an explicit, short-lived read consent, never persistent access.
    const authorizationUrl = new URL(validatedRequest.url);
    if (!authorizationUrl.searchParams.get('scope')?.trim()) {
      authorizationUrl.searchParams.set('scope', 'mcp:read contexts:read');
      validatedRequest = new Request(authorizationUrl, { headers: validatedRequest.headers });
    }
    const auth = await oauth.parseAuthRequest(validatedRequest);
    if (!auth.scope.includes('mcp:read') || auth.scope.some(scope => !scopes.includes(scope))) throw new ApiError('MCP_SCOPE', 400);
    const details = await oauth.describeConsent(auth), session = await readSession(request, { ...env, AUTH_DB: db as unknown as D1Database });
    const t = labels[language(request)];
    if (!session) {
      if (request.url.length > 8192) throw new ApiError('MCP_REQUEST_SIZE', 413);
      const credential = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
      await db.prepare('DELETE FROM mcp_login_requests WHERE expires_at<=?').bind(time).run();
      await db.prepare('INSERT INTO mcp_login_requests(hash,authorize_url,expires_at) VALUES(?,?,?)').bind(await digest(credential), request.url, time + 600).run();
      const headers = new Headers({ 'Set-Cookie': returnCookie(env, credential, 600) });
      return html(request, `<h1>${t.title}</h1><p>${t.client}: ${escape(details.clientName)}</p><p>${t.warning}</p><a href="/api/auth/start?return=%2Foauth%2Fresume">${t.login}</a>`, headers);
    }
    await sharingLimit(db, session.id);
    const transaction = await oauth.beginConsent(auth);
    transaction.headers.append('Set-Cookie', returnCookie(env, '', 0));
    const options = auth.scope.filter(scope => scope !== 'mcp:read').map(scope => `<label><input type="checkbox" name="scope" value="${scope}" checked> ${scope === 'contexts:read' ? t.contexts : scope === 'materials:read' ? t.materials : t.refresh}</label>`).join('');
    return html(request, `<h1>${t.title}</h1><p>${t.identity}: ${escape(session.login)}</p><p>${t.client}: <strong>${escape(details.clientName)}</strong></p><p>${t.destination}: ${escape(details.redirectHost)}</p><p>${t.warning}</p>${details.redirectIsLoopback ? `<p>${t.local}</p>` : ''}<form method="post" action="/oauth/authorize"><input type="hidden" name="handle" value="${escape(transaction.handle)}"><input type="hidden" name="csrf" value="${escape(session.csrf)}">${options}<p>${t.limitation}</p><button name="decision" value="approve">${t.allow}</button> <button name="decision" value="deny">${t.deny}</button></form>`, transaction.headers, auth.redirectUri);
  }
  if (request.method !== 'POST' || url.pathname !== '/oauth/authorize') return privateJson({ error: 'METHOD' }, 405);
  if (request.headers.get('Origin') !== site(env)) throw new ApiError('ORIGIN', 403);
  if (!request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded')) throw new ApiError('CONTENT_TYPE', 415);
  const bytes = await boundedBody(request.body, 8192);
  let form: URLSearchParams;
  try { form = new URLSearchParams(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw new ApiError('FORM', 400); }
  if (['handle', 'csrf', 'decision'].some(key => form.getAll(key).length !== 1) || [...form.keys()].some(key => !['handle', 'csrf', 'decision', 'scope'].includes(key))) throw new ApiError('FORM', 400);
  const headers = new Headers(request.headers); headers.set('X-CSRF-Token', form.get('csrf')!);
  const session = await requireSession(new Request(request.url, { headers }), { ...env, AUTH_DB: db as unknown as D1Database }, true);
  await sharingLimit(db, session.id);
  if (form.get('decision') === 'deny') {
    const denied = await oauth.denyConsent(request, form.get('handle')!);
    return new Response(null, { status: 302, headers: denied.headers });
  }
  if (form.get('decision') !== 'approve') throw new ApiError('FORM', 400);
  const scope = ['mcp:read', ...form.getAll('scope')];
  if (new Set(scope).size !== scope.length || scope.some(value => !scopes.includes(value))) throw new ApiError('MCP_SCOPE', 400);
  const approved = await oauth.approveConsent(request, form.get('handle')!, { scope });
  const client = await oauth.lookupClient(approved.request.clientId);
  if (!client) throw new ApiError('MCP_CLIENT', 400);
  const id = crypto.randomUUID();
  const inserted = await db.prepare('INSERT INTO mcp_connections(id,account_id,client_id,name,created_at,expires_at,contexts_read,materials_read) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM sessions JOIN accounts ON accounts.id=sessions.account_id WHERE sessions.hash=? AND accounts.id=? AND accounts.revoked=0 AND sessions.expires_at>? AND sessions.absolute_expires_at>?) AND (SELECT count(*) FROM mcp_connections WHERE account_id=? AND revoked=0 AND expires_at>?)<100 RETURNING id').bind(id, session.id, approved.request.clientId, (client.clientName ?? client.clientId).slice(0, 120), time, time + (scope.includes('offline_access') ? 30 * 86400 : 3600), Number(scope.includes('contexts:read')), Number(scope.includes('materials:read')), session.hash, session.id, time, time, session.id, time).first();
  if (!inserted) throw new ApiError('MCP_APPROVAL_CHANGED_OR_FULL', 409);
  try {
    const result = await oauth.completeAuthorization({ request: approved.request, userId: String(session.id), metadata: { connectionId: id }, scope, props: { accountId: session.id, connectionId: id }, revokeExistingGrants: false });
    approved.headers.set('Location', result.redirectTo);
    return new Response(null, { status: 302, headers: approved.headers });
  } catch (error) { await db.prepare('UPDATE mcp_connections SET revoked=1 WHERE id=?').bind(id).run(); throw error; }
}

export async function oauthRoute(request: Request, env: OAuthEnv, ctx: ExecutionContext): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (!(url.pathname === '/mcp' || url.pathname.startsWith('/oauth/') || url.pathname.startsWith('/.well-known/') || /^\/api\/ai\/connections\/[^/]+$/.test(url.pathname))) return;
  if (url.origin !== site(env)) return privateJson({ error: 'ORIGIN' }, 403);
  if (request.url.length > 8192) return privateJson({ error: 'MCP_REQUEST_SIZE' }, 413);
  if (!['/mcp', '/oauth/authorize', '/oauth/resume', '/oauth/token', '/oauth/register', '/.well-known/oauth-authorization-server', '/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp'].includes(url.pathname) && !/^\/api\/ai\/connections\/[^/]+$/.test(url.pathname)) return privateJson({ error: 'NOT_AVAILABLE' }, 404);
  if (!env.OAUTH_KV || !env.AUTH_DB || !env.SHARE_ENCRYPTION_KEY || !env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.TOKEN_ENCRYPTION_KEY) return privateJson({ error: 'MCP_NOT_CONFIGURED' }, 503);
  const options: OAuthProviderOptions<OAuthEnv> = {
    apiRoute: `${site(env)}/mcp`, authorizeEndpoint: `${site(env)}/oauth/authorize`, tokenEndpoint: `${site(env)}/oauth/token`, clientRegistrationEndpoint: `${site(env)}/oauth/register`,
    resourceMetadata: { resource: `${site(env)}/mcp`, authorization_servers: [site(env)] }, requiredScopes: ['mcp:read'], scopesSupported: scopes,
    accessTokenTTL: 3600, refreshTokenTTL: 30 * 86400, clientRegistrationTTL: 30 * 86400, clientIdMetadataDocumentEnabled: true, allowPrivateUseRedirectUris: true,
    async tokenExchangeCallback(value) {
      const props = z.object({ accountId: z.number().int().positive(), connectionId: shareIdSchema }).strict().parse(value.props);
      const live = await env.AUTH_DB!.withSession('first-primary').prepare('SELECT c.id FROM mcp_connections c JOIN accounts a ON a.id=c.account_id WHERE c.id=? AND c.account_id=? AND c.client_id=? AND c.revoked=0 AND c.expires_at>? AND a.revoked=0').bind(props.connectionId, props.accountId, value.clientId, Math.floor(Date.now() / 1000)).first();
      if (!live || value.userId !== String(props.accountId)) throw new OAuthError('invalid_grant', { description: 'Authorization has been revoked or expired.' });
      return { refreshTokenTTL: value.scope.includes('offline_access') ? 30 * 86400 : 0 };
    },
    apiHandler: { async fetch(request, env, context) {
      const verified = context as OAuthResourceContext<{ accountId: number; connectionId: string }>;
      if (!verified.auth.clientId || verified.auth.userId !== String(verified.props.accountId)) return privateJson({ error: 'MCP_UNAUTHORIZED' }, 401);
      const origin = request.headers.get('Origin');
      if (origin === 'null') return privateJson({ error: 'ORIGIN' }, 403);
      if (origin && origin !== site(env)) {
        const client = await env.OAUTH_PROVIDER!.lookupClient(verified.auth.clientId);
        if (!client?.redirectUris.some(uri => new URL(uri).origin === origin)) return privateJson({ error: 'ORIGIN' }, 403);
      }
      return mcpFetch(request, env, { token: verified.auth.token, clientId: verified.auth.clientId, scopes: verified.auth.scope, expiresAt: verified.auth.expiresAt, resource: new URL(verified.auth.audience), extra: verified.props }, publicTeachingCatalogue);
    } },
    defaultHandler: { async fetch(request, env) {
      if (['/oauth/authorize', '/oauth/resume'].includes(new URL(request.url).pathname)) return consent(request, env);
      return privateJson({ error: 'NOT_AVAILABLE' }, 404);
    } },
  };
  const provider = new OAuthProvider<OAuthEnv>(options);
  try {
    if (request.method === 'POST' && ['/oauth/register', '/oauth/token'].includes(url.pathname) || request.method === 'GET' && ['/oauth/authorize', '/oauth/resume'].includes(url.pathname)) {
      const time = Math.floor(Date.now() / 1000), db = env.AUTH_DB.withSession('first-primary');
      const key = `mcp-auth:${await digest(request.headers.get('CF-Connecting-IP') ?? 'local')}:${Math.floor(time / 60)}`;
      await db.prepare('DELETE FROM auth_limits WHERE expires_at<=?').bind(time).run();
      const value = await db.prepare('INSERT INTO auth_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key, time + 120).first<{ count: number }>();
      if (!value || value.count > 10) return new Response(JSON.stringify({ error: 'MCP_AUTH_RATE_LIMITED' }), { status: 429, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'Retry-After': '60' } });
    }
    if (/^\/api\/ai\/connections\//.test(url.pathname)) {
      if (request.method !== 'DELETE') return privateJson({ error: 'METHOD' }, 405);
      const session = await requireSession(request, env, true), id = shareIdSchema.parse(url.pathname.slice('/api/ai/connections/'.length)), db = env.AUTH_DB.withSession('first-primary');
      await sharingLimit(db, session.id);
      const connection = await db.prepare('UPDATE mcp_connections SET revoked=1 WHERE id=? AND account_id=? RETURNING id').bind(id, session.id).first();
      if (!connection) return privateJson({ error: 'MCP_CONNECTION_NOT_FOUND' }, 404);
      await db.prepare('DELETE FROM shared_contexts WHERE connection_id=? AND account_id=?').bind(id, session.id).run();
      const oauth = getOAuthApi(options, env);
      let cursor: string | undefined;
      do {
        const grants = await oauth.listUserGrants(String(session.id), { limit: 100, cursor });
        for (const grant of grants.items) if (grant.metadata?.connectionId === id) await oauth.revokeGrant(grant.id, String(session.id));
        cursor = grants.cursor;
      } while (cursor);
      return privateJson({ revoked: true });
    }
    let boundedRequest = request;
    if (request.method === 'POST' && url.pathname !== '/mcp') {
      const body = await boundedBody(request.body, 65536);
      boundedRequest = new Request(request.url, { method: request.method, headers: request.headers, body });
    }
    const response = await provider.fetch(boundedRequest, env, ctx);
    const headers = new Headers(response.headers); headers.set('Cache-Control', 'private, no-store'); headers.set('X-Content-Type-Options', 'nosniff');
    // Native form posts need their same-origin Origin; external clients still receive no referrer.
    headers.set('Referrer-Policy', headers.get('Content-Type')?.startsWith('text/html') ? 'same-origin' : 'no-referrer');
    // Discovery asks for useful read access; catalogue-only grants still need only the protocol baseline.
    const readScopes = 'mcp:read contexts:read';
    if (url.pathname === '/mcp' && response.status === 401) {
      const challenge = headers.get('WWW-Authenticate');
      if (challenge) headers.set('WWW-Authenticate', challenge.includes('scope=') ? challenge.replace(/scope="[^"]*"/, `scope="${readScopes}"`) : `${challenge}, scope="${readScopes}"`);
    }
    if (request.method === 'GET' && ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp'].includes(url.pathname) && response.status === 200) {
      return new Response(JSON.stringify({ ...await response.json() as Record<string, unknown>, scopes_supported: readScopes.split(' ') }), { status: 200, headers });
    }
    return new Response(response.body, { status: response.status, headers });
  } catch (error) {
    if (error instanceof Error && error.message === 'BODY_SIZE') return privateJson({ error: 'MCP_REQUEST_SIZE' }, 413);
    if (error instanceof AuthorizationError && error.redirectTo) return new Response(null, { status: 302, headers: { Location: error.redirectTo, 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
    return privateJson({ error: error instanceof ApiError ? error.message : 'MCP_AUTHORIZATION_FAILED' }, error instanceof ApiError ? error.status : error instanceof AuthorizationError || error instanceof z.ZodError ? 400 : 503);
  }
}
