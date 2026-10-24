import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { expect, test } from 'vitest';
import { digest, revokeAccount } from '../worker/auth';
import { webhookRoute } from '../worker/webhook';
import { mcpFetch } from '../worker/mcp';
import { cleanupShares, listSharedContexts, readSharedContext, sharingRoute, type SharingEnv } from '../worker/sharing';

async function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  for (const file of readdirSync('worker/migrations').filter(file => file.endsWith('.sql')).sort()) sqlite.exec(readFileSync(`worker/migrations/${file}`, 'utf8'));
  const primary: string[] = [];
  let beforeQuery: ((sql: string) => void) | undefined;
  const database = {
    withSession(value: string) { primary.push(value); return database; },
    prepare(sql: string) {
      let values: (string | number)[] = [];
      const query = { bind(...parameters: (string | number)[]) { values = parameters; return query; }, async first() { beforeQuery?.(sql); return sqlite.prepare(sql).get(...values) ?? null; }, async run() { beforeQuery?.(sql); return sqlite.prepare(sql).run(...values); }, async all() { beforeQuery?.(sql); return { results: sqlite.prepare(sql).all(...values) }; } };
      return query;
    },
    async batch(queries: { run(): Promise<unknown> }[]) { sqlite.exec('BEGIN'); try { const result = []; for (const query of queries) result.push(await query.run()); sqlite.exec('COMMIT'); return result; } catch (error) { sqlite.exec('ROLLBACK'); throw error; } },
  };
  const time = Math.floor(Date.now() / 1000), connectionId = crypto.randomUUID(), cookie = 's'.repeat(43), csrf = 'c'.repeat(43);
  sqlite.prepare('INSERT INTO accounts(id,login,encrypted_tokens,updated_at) VALUES(1,?,?,?)').run('synthetic-learner', 'unused-encrypted-token', time);
  sqlite.prepare('INSERT INTO sessions(hash,account_id,csrf,expires_at,absolute_expires_at) VALUES(?,1,?,?,?)').run(await digest(cookie), csrf, time + 86400, time + 86400);
  sqlite.prepare('INSERT INTO mcp_connections(id,account_id,client_id,name,created_at,expires_at,contexts_read,materials_read) VALUES(?,1,?,?,?,?,1,0)').run(connectionId, 'synthetic-client', 'Synthetic approved client', time, time + 86400);
  const env: SharingEnv = { AUTH_DB: database as unknown as D1Database, LOCAL_AUTH: 'true', GITHUB_CLIENT_ID: 'synthetic-app', GITHUB_CLIENT_SECRET: 'synthetic-secret', TOKEN_ENCRYPTION_KEY: btoa('k'.repeat(32)), SHARE_ENCRYPTION_KEY: btoa('h'.repeat(32)) };
  const value = { profileId: 'local-guest', connectionId, title: 'Synthetic context', text: 'Synthetic private response', confirm: true };
  const request = (path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) => new Request(`http://127.0.0.1:8787${path}`, { method, headers: { Cookie: `lingfern_local_session=${cookie}`, Origin: 'http://127.0.0.1:8787', 'X-CSRF-Token': csrf, 'Content-Type': 'application/json', ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const create = (body: unknown = value) => sharingRoute(request('/api/ai/shares', 'POST', body), env).then(response => response!);
  return { env, sqlite, value, request, create, primary, intercept: (callback?: typeof beforeQuery) => { beforeQuery = callback; } };
}

test('shares are encrypted, explicitly approved, scoped, expiring and absent from metadata responses', async () => {
  const f = await fixture();
  const created = await f.create(); expect(created.status).toBe(201);
  expect(created.headers.get('Cache-Control')).toBe('private, no-store');
  const summary = await created.json() as { id: string; createdAt: number; expiresAt: number };
  expect(summary.expiresAt - summary.createdAt).toBe(86400);
  const row = f.sqlite.prepare('SELECT * FROM shared_contexts').get()!;
  expect(row.encrypted_context).not.toContain(f.value.text);
  const listed = await (await sharingRoute(f.request('/api/ai/shares'), f.env))!.text();
  expect(listed).toContain(summary.id); expect(listed).not.toContain('encrypted_context'); expect(listed).not.toContain(f.value.text);
  expect(await readSharedContext(f.env, 1, 'synthetic-client', f.value.connectionId, summary.id)).toMatchObject({ text: f.value.text, profileId: 'local-guest' });
  await expect(readSharedContext(f.env, 2, 'synthetic-client', f.value.connectionId, summary.id)).rejects.toThrow('SHARE_NOT_FOUND');
  await expect(readSharedContext(f.env, 1, 'other-client', f.value.connectionId, summary.id)).rejects.toThrow('SHARE_NOT_FOUND');
  f.sqlite.exec('UPDATE mcp_connections SET contexts_read=0');
  const managed = await (await sharingRoute(f.request('/api/ai/connections'), f.env))!.json();
  expect(managed).toMatchObject({ connections: [{ id: f.value.connectionId, contextsRead: 0, materialsRead: 0 }] });
  await expect(readSharedContext(f.env, 1, 'synthetic-client', f.value.connectionId, summary.id)).rejects.toThrow('SHARE_NOT_FOUND');
  f.sqlite.exec('UPDATE mcp_connections SET contexts_read=1');
  f.sqlite.exec('UPDATE shared_contexts SET expires_at=0');
  await expect(readSharedContext(f.env, 1, 'synthetic-client', f.value.connectionId, summary.id)).rejects.toThrow('SHARE_NOT_FOUND');
  await cleanupShares(f.env); expect(f.sqlite.prepare('SELECT count(*) AS n FROM shared_contexts').get()!.n).toBe(0);
  expect(f.primary.every(value => value === 'first-primary')).toBe(true);
});

test('client snapshot pagination returns only authorized summaries and validates bounded inputs', async () => {
  const f = await fixture();
  for (let i = 0; i < 3; i++) expect((await f.create()).status).toBe(201);
  const first = await listSharedContexts(f.env, 1, 'synthetic-client', f.value.connectionId, { count: 2 });
  expect(first.contexts).toHaveLength(2); expect(first.cursor).toBe(first.contexts[1].id);
  expect(JSON.stringify(first)).not.toContain(f.value.text);
  expect(Object.keys(first.contexts[0]).sort()).toEqual(['createdAt', 'expiresAt', 'id', 'profileId', 'title']);
  f.sqlite.prepare('DELETE FROM shared_contexts WHERE id=?').run(first.contexts[0].id);
  const last = await listSharedContexts(f.env, 1, 'synthetic-client', f.value.connectionId, { count: 2, cursor: first.cursor });
  expect(last.contexts).toHaveLength(1); expect(last.cursor).toBeUndefined();
  expect(first.contexts.map(value => value.id)).not.toContain(last.contexts[0].id);
  expect((await listSharedContexts(f.env, 2, 'synthetic-client', f.value.connectionId)).contexts).toEqual([]);
  expect((await listSharedContexts(f.env, 1, 'foreign-client', f.value.connectionId)).contexts).toEqual([]);
  for (const input of [{ count: 21 }, { count: 0 }, { cursor: 'invalid' }, { accountId: 1 }]) await expect(listSharedContexts(f.env, 1, 'synthetic-client', f.value.connectionId, input)).rejects.toThrow();
  f.sqlite.exec('UPDATE mcp_connections SET contexts_read=0');
  expect((await listSharedContexts(f.env, 1, 'synthetic-client', f.value.connectionId)).contexts).toEqual([]);
  f.sqlite.exec('UPDATE mcp_connections SET contexts_read=1,revoked=1');
  expect((await listSharedContexts(f.env, 1, 'synthetic-client', f.value.connectionId)).contexts).toEqual([]);
  f.sqlite.exec('UPDATE mcp_connections SET revoked=0,expires_at=0');
  expect((await listSharedContexts(f.env, 1, 'synthetic-client', f.value.connectionId)).contexts).toEqual([]);
  f.sqlite.exec('UPDATE mcp_connections SET expires_at=2147483647; UPDATE accounts SET revoked=1');
  expect((await listSharedContexts(f.env, 1, 'synthetic-client', f.value.connectionId)).contexts).toEqual([]);
  f.sqlite.exec('UPDATE accounts SET revoked=0; UPDATE shared_contexts SET expires_at=0');
  expect((await listSharedContexts(f.env, 1, 'synthetic-client', f.value.connectionId)).contexts).toEqual([]);
  expect(f.primary.every(value => value === 'first-primary')).toBe(true);
});

test('official stateless SDK serves initialization and six read-only tools with per-request authorization', async () => {
  const f = await fixture(), summary = await (await f.create()).json() as { id: string };
  f.sqlite.exec('UPDATE mcp_connections SET materials_read=1');
  const auth = { token: 'synthetic-verified-token', clientId: 'synthetic-client', scopes: ['mcp:read', 'contexts:read', 'materials:read'], expiresAt: Math.floor(Date.now() / 1000) + 3600, resource: new URL('http://127.0.0.1:8787/mcp'), extra: { accountId: 1, connectionId: f.value.connectionId } };
  const catalogue = [{ id: 'synthetic-teaching', title: 'Public reading', goal: 'Find information', goalId: 'find', level: 'A1' as const, skill: 'reading' as const, reviewStatus: 'draft' as const }];
  const call = async (method: string, params: unknown = {}, identity = auth) => {
    const response = await mcpFetch(new Request('http://127.0.0.1:8787/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }), f.env, identity, catalogue);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const raw = await response.text();
    const body = JSON.parse(raw.startsWith('event:') ? raw.split('\n').find(line => line.startsWith('data: '))!.slice(6) : raw);
    return { status: response.status, body };
  };
  expect((await call('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'Synthetic protocol client', version: '1' } })).body.result.serverInfo.name).toBe('Lingfern');
  const tools = (await call('tools/list')).body.result.tools;
  expect(tools.map((tool: { name: string }) => tool.name).sort()).toEqual(['fetch', 'get_practice_template', 'list_shared_contexts', 'read_shared_context', 'search', 'search_materials']);
  expect(tools.every((tool: { annotations: { readOnlyHint: boolean } }) => tool.annotations.readOnlyHint)).toBe(true);
  const found = (await call('tools/call', { name: 'search', arguments: { query: 'synthetic context' } })).body.result;
  expect(found.structuredContent.results).toEqual([{ id: summary.id, title: f.value.title, url: 'http://127.0.0.1:8787/settings#mcp' }]);
  expect(JSON.parse(found.content[0].text)).toEqual(found.structuredContent);
  expect(found.content[0].text).not.toContain(f.value.text);
  const fetched = (await call('tools/call', { name: 'fetch', arguments: { id: summary.id } })).body.result;
  expect(fetched.structuredContent).toMatchObject({ id: summary.id, title: f.value.title, text: f.value.text });
  expect(JSON.parse(fetched.content[0].text)).toEqual(fetched.structuredContent);
  expect((await call('tools/call', { name: 'search', arguments: { query: 'absent title' } })).body.result.structuredContent.results).toEqual([]);
  for (const name of ['search', 'fetch']) {
    const args = name === 'search' ? { query: '' } : { id: summary.id };
    expect((await call('tools/call', { name, arguments: args }, { ...auth, scopes: ['mcp:read'] })).body.result.isError).toBe(true);
    expect((await call('tools/call', { name, arguments: { ...args, accountId: 2 } })).body.result.isError).toBe(true);
  }
  const read = (await call('tools/call', { name: 'read_shared_context', arguments: { id: summary.id } })).body.result;
  expect(JSON.parse(read.content[0].text).text).toBe(f.value.text);
  const list = (await call('tools/call', { name: 'list_shared_contexts', arguments: {} })).body.result;
  expect(list.content[0].text).not.toContain(f.value.text);
  expect(JSON.parse(list.content[0].text).contexts).toHaveLength(1);
  const search = (await call('tools/call', { name: 'search_materials', arguments: { keywords: 'reading', level: 'A1' } })).body.result;
  expect(JSON.parse(search.content[0].text).materials).toEqual(catalogue);
  const template = (await call('tools/call', { name: 'get_practice_template', arguments: { goalId: 'find', level: 'A1' } })).body.result;
  expect(JSON.parse(template.content[0].text)).toEqual({ available: false, reason: 'NO_REVIEWED_TEMPLATE' });
  expect((await call('tools/call', { name: 'read_shared_context', arguments: { id: summary.id, accountId: 1 } })).body.result.isError).toBe(true);
  expect((await call('tools/call', { name: 'read_shared_context', arguments: { id: summary.id } }, { ...auth, scopes: ['mcp:read'] })).body.result.isError).toBe(true);
  for (const identity of [{ ...auth, clientId: 'foreign-client' }, { ...auth, expiresAt: 0 }, { ...auth, resource: new URL('https://other.example/mcp') }, { ...auth, extra: { ...auth.extra, accountId: 2 } }, { ...auth, scopes: [] }]) expect((await call('tools/list', {}, identity)).status).toBe(401);
  f.sqlite.exec('UPDATE mcp_connections SET revoked=1');
  expect((await call('tools/list')).status).toBe(401);
});

test('rejects missing confirmation, arbitrary clients/accounts, malformed/oversized bodies, Origin and CSRF failures', async () => {
  const f = await fixture();
  expect((await f.create({ ...f.value, confirm: false })).status).toBe(400);
  expect((await f.create({ ...f.value, accountId: 2 })).status).toBe(400);
  expect((await f.create({ ...f.value, connectionId: crypto.randomUUID() })).status).toBe(409);
  expect((await f.create({ ...f.value, text: '汉'.repeat(12000) })).status).toBe(400);
  expect((await f.create({ ...f.value, text: 'x'.repeat(70000) })).status).toBe(413);
  expect((await sharingRoute(f.request('/api/ai/shares', 'POST', f.value, { 'X-CSRF-Token': 'wrong' }), f.env))!.status).toBe(403);
  expect((await sharingRoute(f.request('/api/ai/shares', 'POST', f.value, { Origin: 'https://evil.test' }), f.env))!.status).toBe(403);
  expect((await sharingRoute(f.request('/api/ai/shares', 'POST', f.value, { Cookie: '' }), f.env))!.status).toBe(401);
  expect((await sharingRoute(f.request('/api/ai/shares', 'PUT'), f.env))!.status).toBe(405);
  expect((await sharingRoute(f.request('/api/ai/shares'), { ...f.env, SHARE_ENCRYPTION_KEY: undefined }))!.status).toBe(503);
  expect(f.sqlite.prepare('SELECT count(*) AS n FROM shared_contexts').get()!.n).toBe(0);
});

test.each(['search', 'list_shared_contexts', 'fetch', 'read_shared_context'])('MCP %s cannot cross connections belonging to the same client', async name => {
  const f = await fixture(), summary = await (await f.create()).json() as { id: string };
  const otherConnection = crypto.randomUUID(), time = Math.floor(Date.now() / 1000);
  f.sqlite.prepare('INSERT INTO mcp_connections(id,account_id,client_id,name,created_at,expires_at,contexts_read,materials_read) VALUES(?,1,?,?,?,?,1,0)').run(otherConnection, 'synthetic-client', 'Another approval of the same client', time, time + 86400);
  const call = async (connectionId: string) => {
    const auth = { token: 'synthetic-verified-token', clientId: 'synthetic-client', scopes: ['mcp:read', 'contexts:read'], expiresAt: time + 3600, resource: new URL('http://127.0.0.1:8787/mcp'), extra: { accountId: 1, connectionId } };
    const args = name === 'search' ? { query: '' } : name === 'list_shared_contexts' ? {} : { id: summary.id };
    const response = await mcpFetch(new Request('http://127.0.0.1:8787/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) }), f.env, auth, []);
    expect(response.status).toBe(200);
    const raw = await response.text();
    return JSON.parse(raw.startsWith('event:') ? raw.split('\n').find(line => line.startsWith('data: '))!.slice(6) : raw).result;
  };
  const authorized = await call(f.value.connectionId);
  expect(JSON.stringify(authorized)).toContain(summary.id);
  const unrelated = await call(otherConnection);
  if (name === 'search') expect(unrelated.structuredContent.results).toEqual([]);
  else if (name === 'list_shared_contexts') expect(unrelated.structuredContent.contexts).toEqual([]);
  else expect(unrelated).toMatchObject({ isError: true, content: [{ type: 'text', text: 'SHARE_NOT_FOUND' }] });
  expect(JSON.stringify(unrelated)).not.toContain(f.value.text);
});

test('atomic insertion enforces the twenty-share capacity and rejects revocation during encryption', async () => {
  const f = await fixture();
  const responses = await Promise.all(Array.from({ length: 21 }, () => f.create()));
  expect(responses.filter(response => response.status === 201)).toHaveLength(20);
  expect(responses.filter(response => response.status === 409)).toHaveLength(1);
  expect(f.sqlite.prepare('SELECT count(*) AS n FROM shared_contexts').get()!.n).toBe(20);
  f.sqlite.exec('DELETE FROM shared_contexts');
  f.intercept(sql => { if (sql.startsWith('INSERT INTO shared_contexts')) f.sqlite.exec('UPDATE mcp_connections SET revoked=1'); });
  expect((await f.create()).status).toBe(409);
  expect(f.sqlite.prepare('SELECT count(*) AS n FROM shared_contexts').get()!.n).toBe(0);
});

test('revocation and authenticated deletion block subsequent reads and physically remove shared text', async () => {
  const f = await fixture(), summary = await (await f.create()).json() as { id: string };
  const denied = await sharingRoute(f.request(`/api/ai/shares/${summary.id}`, 'DELETE', undefined, { 'X-CSRF-Token': 'wrong' }), f.env);
  expect(denied!.status).toBe(403);
  const time = Math.floor(Date.now() / 1000), otherCookie = 'r'.repeat(43);
  f.sqlite.prepare('INSERT INTO accounts(id,login,encrypted_tokens,updated_at) VALUES(2,?,?,?)').run('other-synthetic-learner', 'unused-token', time);
  f.sqlite.prepare('INSERT INTO sessions(hash,account_id,csrf,expires_at,absolute_expires_at) VALUES(?,2,?,?,?)').run(await digest(otherCookie), 'c'.repeat(43), time + 86400, time + 86400);
  expect((await sharingRoute(f.request(`/api/ai/shares/${summary.id}`, 'DELETE', undefined, { Cookie: `lingfern_local_session=${otherCookie}` }), f.env))!.status).toBe(404);
  expect(f.sqlite.prepare('SELECT count(*) AS n FROM shared_contexts').get()!.n).toBe(1);

  f.intercept(sql => { if (sql.startsWith('SELECT s.id FROM shared_contexts')) f.sqlite.exec('UPDATE mcp_connections SET revoked=1'); });
  await expect(readSharedContext(f.env, 1, 'synthetic-client', f.value.connectionId, summary.id)).rejects.toThrow('SHARE_NOT_FOUND');
  f.intercept();
  expect((await sharingRoute(f.request(`/api/ai/shares/${summary.id}`, 'DELETE'), f.env))!.status).toBe(200);
  expect(f.sqlite.prepare('SELECT count(*) AS n FROM shared_contexts').get()!.n).toBe(0);
  f.sqlite.exec('UPDATE mcp_connections SET revoked=0');
  expect((await f.create()).status).toBe(201);
  await revokeAccount(f.env.AUTH_DB!, 1);
  expect(f.sqlite.prepare('SELECT count(*) AS n FROM shared_contexts').get()!.n).toBe(0);
  expect(f.sqlite.prepare('SELECT revoked FROM mcp_connections').get()!.revoked).toBe(1);
});

test('ciphertext cannot be transplanted to another snapshot and sharing rate limits fail explicitly', async () => {
  const f = await fixture(), a = await (await f.create()).json() as { id: string }, b = await (await f.create()).json() as { id: string };
  f.sqlite.prepare('UPDATE shared_contexts SET encrypted_context=(SELECT encrypted_context FROM shared_contexts WHERE id=?) WHERE id=?').run(a.id, b.id);
  await expect(readSharedContext(f.env, 1, 'synthetic-client', f.value.connectionId, b.id)).rejects.toThrow();
  f.sqlite.exec("UPDATE auth_limits SET count=30 WHERE key LIKE 'sharing:%'");
  const limited = (await sharingRoute(f.request('/api/ai/shares'), f.env))!;
  expect(limited.status).toBe(429); expect(limited.headers.get('Retry-After')).toBe('60');
  expect(await limited.text()).not.toContain(f.value.text);
});


test('signed identity revocation removes temporary text and cannot revive old client approvals', async () => {
  const f = await fixture();
  expect((await f.create()).status).toBe(201);
  f.env.GITHUB_WEBHOOK_SECRET = 'synthetic-webhook-secret';
  const body = JSON.stringify({ action: 'revoked', sender: { id: 1 } }), delivery = crypto.randomUUID();
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(f.env.GITHUB_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))), byte => byte.toString(16).padStart(2, '0')).join('');
  const request = () => new Request('http://127.0.0.1:8787/api/auth/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': `sha256=${signature}`, 'X-GitHub-Delivery': delivery, 'X-GitHub-Event': 'github_app_authorization' }, body });
  expect((await webhookRoute(request(), f.env))!.status).toBe(202);
  expect(f.sqlite.prepare('SELECT count(*) AS n FROM shared_contexts').get()!.n).toBe(0);
  expect(f.sqlite.prepare('SELECT revoked FROM mcp_connections').get()!.revoked).toBe(1);
  expect((await webhookRoute(request(), f.env))!.status).toBe(202);
  f.sqlite.exec('UPDATE accounts SET revoked=0');
  expect(f.sqlite.prepare('SELECT revoked FROM mcp_connections').get()!.revoked).toBe(1);
});


test('common legacy Streamable HTTP protocol revisions retain tool discovery and text fallback', async () => {
  const f = await fixture();
  const auth = {token:'synthetic-verified-token',clientId:'synthetic-client',scopes:['mcp:read','contexts:read'],expiresAt:Math.floor(Date.now()/1000)+3600,resource:new URL('http://127.0.0.1:8787/mcp'),extra:{accountId:1,connectionId:f.value.connectionId}};
  for (const version of ['2024-11-05','2025-03-26','2025-06-18','2025-11-25']) {
    const call = async (method:string, params:unknown = {}) => {
      const response = await mcpFetch(new Request('http://127.0.0.1:8787/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':version},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}),f.env,auth,[]);
      expect(response.status).toBe(200); const raw = await response.text(); return JSON.parse(raw.startsWith('event:') ? raw.split('\n').find(line=>line.startsWith('data: '))!.slice(6) : raw) as {result:{protocolVersion?:string;tools?:{name:string}[]}};
    };
    const initialized = await call('initialize',{protocolVersion:version,capabilities:{},clientInfo:{name:'Synthetic compatibility profile',version:'1'}});
    expect(initialized.result.protocolVersion).toBe(version);
    expect((await call('tools/list')).result.tools?.map(t=>t.name)).toContain('fetch');
  }
});


test('modern per-request clients discover and list tools without a legacy initialization session', async () => {
  const f = await fixture();
  const auth = {token:'synthetic-verified-token',clientId:'synthetic-client',scopes:['mcp:read','contexts:read'],expiresAt:Math.floor(Date.now()/1000)+3600,resource:new URL('http://127.0.0.1:8787/mcp'),extra:{accountId:1,connectionId:f.value.connectionId}};
  const meta = {'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientCapabilities':{},'io.modelcontextprotocol/clientInfo':{name:'Synthetic modern client',version:'1'}};
  const call = async (method:string) => {
    const response = await mcpFetch(new Request('http://127.0.0.1:8787/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2026-07-28','Mcp-Method':method},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params:{_meta:meta}})}),f.env,auth,[]);
    const body = await response.json() as {result:{supportedVersions?:string[];tools?:{name:string}[]}}; expect(response.status, JSON.stringify(body)).toBe(200); return body;
  };
  expect((await call('server/discover')).result.supportedVersions).toContain('2026-07-28');
  expect((await call('tools/list')).result.tools?.map((t:{name:string})=>t.name)).toContain('fetch');
});
