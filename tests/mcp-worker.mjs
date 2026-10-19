import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { chromium } from '@playwright/test';

const directory = await mkdtemp(path.join(tmpdir(), 'lingfern-mcp-test-'));
const origin = 'http://127.0.0.1:8787', address = 'http://127.0.0.1:8789';
const configPath = path.join(directory, 'wrangler.json'), entry = path.join(directory, 'worker.ts'), state = path.join(directory, 'state');
const root = process.cwd(), cookie = 's'.repeat(43), csrf = 'c'.repeat(43);
const instance = randomUUID();
let callbackOrigin, callbackUrl;
const callbacks = [];
const callbackServer = createServer((request, response) => {
  const url = new URL(request.url, callbackOrigin);
  if (request.method !== 'GET' || url.pathname !== '/callback') { response.writeHead(404).end(); return; }
  callbacks.push({ url, referer: request.headers.referer });
  response.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end('Synthetic callback');
});
const hash = value => createHash('sha256').update(value).digest('base64url');
// Test-only bridge preserves the fixed local production-like resource identifier on an isolated port.
await writeFile(entry, `import worker from ${JSON.stringify(path.join(root, 'worker/index.ts'))}; export default {fetch(request,env,ctx){const url=new URL(request.url);if(url.pathname==='/__mcp_test_instance')return new Response('${instance}');url.port='8787';const headers=new Headers(request.headers);if(headers.get('Origin')==='${address}')headers.set('Origin','${origin}');return worker.fetch(new Request(url,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body}),env,ctx)}};`);
await writeFile(configPath, JSON.stringify({ name: 'lingfern-mcp-test', main: entry, compatibility_date: '2026-09-27', compatibility_flags: ['nodejs_compat'], kv_namespaces: [{ binding: 'OAUTH_KV', id: '0'.repeat(32) }], d1_databases: [{ binding: 'AUTH_DB', database_name: 'mcp-test', database_id: '00000000-0000-0000-0000-000000000001', migrations_dir: path.join(root, 'worker/migrations') }], assets: { directory: path.join(root, 'dist'), binding: 'ASSETS', run_worker_first: true }, vars: { LOCAL_AUTH: 'true', GITHUB_CLIENT_ID: 'synthetic-app', GITHUB_CLIENT_SECRET: 'synthetic-secret', TOKEN_ENCRYPTION_KEY: btoa('k'.repeat(32)), SHARE_ENCRYPTION_KEY: btoa('h'.repeat(32)) } }));
const cli = ['wrangler', '--config', configPath];
function sql(command) { execFileSync('npx', [...cli, 'd1', 'execute', 'mcp-test', '--local', '--persist-to', state, '--command', command], { stdio: 'pipe' }); }
execFileSync('npx', [...cli, 'd1', 'migrations', 'apply', 'mcp-test', '--local', '--persist-to', state], { stdio: 'pipe' });
const time = Math.floor(Date.now() / 1000);
sql(`INSERT INTO accounts(id,login,encrypted_tokens,updated_at) VALUES(1,'synthetic-learner','unused',${time}); INSERT INTO sessions(hash,account_id,csrf,expires_at,absolute_expires_at) VALUES('${hash(cookie)}',1,'${csrf}',${time + 86400},${time + 86400});`);
const server = spawn('npx', [...cli, 'dev', '--local', '--ip', '127.0.0.1', '--port', '8789', '--persist-to', state], { stdio: 'ignore', detached: true });
const jar = new Map([['lingfern_local_session', cookie]]);
async function request(route, options = {}, cookies = jar) {
  const headers = new Headers(options.headers);
  if (cookies.size) headers.set('Cookie', [...cookies].map(([name, value]) => `${name}=${value}`).join('; '));
  const response = await fetch(address + route, { ...options, headers, redirect: 'manual' });
  for (const value of response.headers.getSetCookie()) { const [name, content] = value.split(';')[0].split('='); if (/Max-Age=0(?:;|$)/i.test(value)) cookies.delete(name); else cookies.set(name, content); }
  return response;
}
const post = (body, headers = {}) => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams(body) });
async function json(response, expected) { assert.equal(response.status, expected); return response.json(); }
async function submitConsent(page, decision) {
  const callbackCount = callbacks.length;
  const cookies = new Map((await page.context().cookies(address)).map(value => [value.name, value.value]));
  const [response] = await Promise.all([
    page.waitForResponse(response => response.url() === `${address}/oauth/authorize` && response.request().method() === 'POST'),
    page.locator(`button[value=${decision}]`).click(),
  ]);
  assert.equal(response.request().headers().origin, address, 'the native consent form must retain its same-origin Origin');
  assert.equal(response.status(), 302);
  assert.equal(response.headers()['referrer-policy'], 'no-referrer');
  await page.waitForURL(`${callbackUrl}?*`);
  await page.waitForLoadState('domcontentloaded');
  assert.equal(callbacks.length, callbackCount + 1, 'one actual callback must arrive without a navigation retry');
  assert.equal(callbacks.at(-1).referer, undefined, 'authorization details must not reach the client as a referrer');
  return { redirect: callbacks.at(-1).url, form: new URLSearchParams(response.request().postData()), cookies };
}
try {
  await new Promise((resolve, reject) => { callbackServer.once('error', reject); callbackServer.listen(0, '127.0.0.1', resolve); });
  callbackOrigin = `http://127.0.0.1:${callbackServer.address().port}`; callbackUrl = `${callbackOrigin}/callback`;
  assert.notEqual(callbackOrigin, address);
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    assert.equal(server.exitCode, null, 'this isolated Worker exited before becoming ready');
    try { if (await (await request('/__mcp_test_instance')).text() === instance) { ready = true; break; } } catch { /* Waiting for this live child to listen. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, 'isolated Worker did not start');
  const metadata = await json(await request('/.well-known/oauth-authorization-server'), 200);
  assert.equal(metadata.issuer, origin); assert.equal(metadata.revocation_endpoint, `${origin}/oauth/token`);
  const protectedResource = await json(await request('/.well-known/oauth-protected-resource/mcp'), 200);
  assert.equal(protectedResource.resource, `${origin}/mcp`);
  const missing = await request('/mcp'); assert.equal(missing.status, 401); assert.ok(missing.headers.get('WWW-Authenticate')?.includes('resource_metadata'));
  const registered = await json(await request('/oauth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: 'Synthetic <client>', redirect_uris: [callbackUrl, 'https://client.example/callback'], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' }) }), 201);
  const verifier = 'v'.repeat(43), query = new URLSearchParams({ response_type: 'code', client_id: registered.client_id, redirect_uri: callbackUrl, resource: `${origin}/mcp`, scope: 'mcp:read contexts:read materials:read offline_access', state: 'synthetic-state', code_challenge: hash(verifier), code_challenge_method: 'S256' });
  const httpsQuery = new URLSearchParams(query); httpsQuery.set('redirect_uri', 'https://client.example/callback');
  const httpsPage = await request(`/oauth/authorize?${httpsQuery}`);
  assert.equal(httpsPage.status, 200); assert.equal(httpsPage.headers.get('Content-Security-Policy').match(/form-action ([^;]+)/)[1], "'self' https://client.example");
  const httpsHandle = (await httpsPage.text()).match(/name="handle" value="([^"]+)"/)[1];
  const httpsDenied = await request('/oauth/authorize', post({ handle: httpsHandle, csrf, decision: 'deny' }, { Origin: origin }));
  assert.equal(httpsDenied.status, 302); assert.equal(new URL(httpsDenied.headers.get('Location')).origin, 'https://client.example');
  assert.equal(new URL(httpsDenied.headers.get('Location')).searchParams.get('error'), 'access_denied');
  assert.equal(httpsDenied.headers.get('Referrer-Policy'), 'no-referrer');
  const icon = await request('/icon.svg');
  assert.equal(icon.status, 200); assert.equal(await icon.text(), await readFile('public/icon.svg', 'utf8'));
  const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true });
  try {
    await mkdir('output/playwright', { recursive: true });
    for (const [locale, width, height, colorScheme, heading] of [['zh-CN', 375, 812, 'light', '授权助手'], ['en-US', 1440, 900, 'dark', 'Authorize an assistant'], ['zh-TW', 320, 640, 'dark', '授權助手']]) {
      const context = await browser.newContext({ locale, viewport: { width, height }, colorScheme });
      await context.addCookies([{ name: 'lingfern_local_session', value: cookie, url: address }]);
      const page = await context.newPage(); const document = await page.goto(`${address}/oauth/authorize?${query}`);
      assert.equal(document.headers()['referrer-policy'], 'same-origin');
      assert.equal(document.headers()['content-security-policy'].match(/form-action ([^;]+)/)[1], `'self' ${callbackOrigin}`);
      await page.getByRole('heading', { name: heading }).waitFor();
      assert.ok(await page.getByRole('img', { name: 'Lingfern', exact: true }).evaluate(el => getComputedStyle(el).maskImage.includes('/icon.svg')));
      assert.ok(await page.evaluate(async () => { const image = new Image(); image.src = '/icon.svg'; await image.decode(); return image.naturalWidth > 0 && image.naturalWidth === image.naturalHeight; }));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.ok(await page.locator('button[value=approve]').isVisible());
      await page.screenshot({ path: `output/playwright/oauth-consent-${width}-${locale}-${colorScheme}.png`, fullPage: true });
      if (locale === 'en-US') {
        await page.route('https://foreign.example/**', route => route.abort());
        const blocked = await page.evaluate(() => new Promise(resolve => {
          const timeout = setTimeout(() => resolve(null), 5000);
          document.addEventListener('securitypolicyviolation', event => { clearTimeout(timeout); resolve({ directive: event.effectiveDirective, uri: event.blockedURI }); }, { once: true });
          const form = document.querySelector('form');
          form.action = 'https://foreign.example/callback'; form.requestSubmit(document.querySelector('button[value=deny]'));
        }));
        assert.ok(blocked, 'the unregistered form destination must trigger a CSP violation');
        assert.equal(blocked.directive, 'form-action'); assert.equal(new URL(blocked.uri).origin, 'https://foreign.example');
        await page.reload();
      }
      const denied = await submitConsent(page, 'deny');
      assert.equal(denied.redirect.searchParams.get('error'), 'access_denied');
      await context.close();
    }
  } finally { await browser.close(); }
  sql('DELETE FROM auth_limits');
  const page = await request(`/oauth/authorize?${query}`, { headers: { 'Accept-Language': 'zh-CN' } });
  assert.equal(page.status, 200); const html = await page.text();
  assert.ok(html.includes('授权助手')); assert.ok(html.includes('Synthetic &#60;client&#62;')); assert.ok(!html.includes('Synthetic <client>'));
  assert.ok(page.headers.get('Content-Security-Policy').includes("frame-ancestors 'none'"));
  const handle = html.match(/name="handle" value="([^"]+)"/)[1];
  const approval = { handle, csrf, decision: 'approve', scope: 'contexts:read' };
  assert.equal((await request('/oauth/authorize', post({ ...approval, csrf: 'wrong' }, { Origin: origin }))).status, 403);
  assert.equal((await request('/oauth/authorize', post(approval, { Origin: 'https://evil.example' }))).status, 403);
  for (const headers of [{}, { Origin: 'null' }]) assert.equal((await request('/oauth/authorize', post(approval, headers))).status, 403);
  assert.equal((await request('/oauth/authorize', post(approval, { Origin: origin }), new Map([['lingfern_local_session', cookie]]))).status, 400);
  const consentBrowser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true });
  let approved;
  try {
    const context = await consentBrowser.newContext();
    await context.addCookies([{ name: 'lingfern_local_session', value: cookie, url: address }]);
    const consentPage = await context.newPage();
    await consentPage.goto(`${address}/oauth/authorize?${query}`);
    approved = await submitConsent(consentPage, 'approve');
  } finally { await consentBrowser.close(); }
  const { redirect } = approved; assert.equal(redirect.origin, callbackOrigin); assert.equal(redirect.searchParams.get('state'), 'synthetic-state'); assert.equal(redirect.searchParams.get('iss'), origin);
  assert.equal((await request('/oauth/authorize', post(approved.form, { Origin: origin }), approved.cookies)).status, 400);
  const tokenRequest = { grant_type: 'authorization_code', client_id: registered.client_id, code: redirect.searchParams.get('code'), code_verifier: verifier, redirect_uri: callbackUrl, resource: `${origin}/mcp` };
  const tokenResponse = await request('/oauth/token', post(tokenRequest));
  assert.equal(tokenResponse.headers.get('Referrer-Policy'), 'no-referrer');
  const token = await json(tokenResponse, 200);
  assert.ok(token.access_token && token.refresh_token);
  const connection = (await json(await request('/api/ai/connections'), 200)).connections[0];
  const shared = await json(await request('/api/ai/shares', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'X-CSRF-Token': csrf }, body: JSON.stringify({ profileId: 'local-guest', connectionId: connection.id, title: 'Synthetic context', text: 'Synthetic private text', confirm: true }) }), 201);
  const rpc = async (method, params = {}, access = token.access_token, browserOrigin) => {
    const response = await request('/mcp', { method: 'POST', headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25', ...(browserOrigin ? { Origin: browserOrigin } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }, new Map());
    const raw = await response.text();
    return { response, body: JSON.parse(raw.startsWith('event:') ? raw.split('\n').find(line => line.startsWith('data: ')).slice(6) : raw) };
  };
  const initialized = await rpc('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'Synthetic client', version: '1' } }); assert.equal(initialized.response.status, 200, JSON.stringify(initialized.body)); assert.equal(initialized.body.result.serverInfo.name, 'Lingfern');
  const listed = await rpc('tools/list'); assert.equal(listed.body.result.tools.length, 4);
  assert.equal((await rpc('tools/list', {}, token.access_token, 'https://client.example')).response.status, 200);
  assert.equal((await rpc('tools/list', {}, token.access_token, callbackOrigin)).response.status, 200);
  assert.equal((await rpc('tools/list', {}, token.access_token, 'https://foreign.example')).response.status, 403);
  const read = await rpc('tools/call', { name: 'read_shared_context', arguments: { id: shared.id } }); assert.equal(JSON.parse(read.body.result.content[0].text).text, 'Synthetic private text');
  const removed = await rpc('tools/call', { name: 'search_materials', arguments: { keywords: 'meeting', level: 'A1' } });
  assert.deepEqual(JSON.parse(removed.body.result.content[0].text).materials, []);
  const search = await rpc('tools/call', { name: 'search_materials', arguments: { keywords: 'Sherlock', level: 'B2' } });
  const materials = JSON.parse(search.body.result.content[0].text).materials;
  assert.equal(materials.length, 1);
  assert.equal(materials[0].id, 'gutenberg-1661');
  assert.equal(materials[0].reviewStatus, 'draft');
  assert.deepEqual(Object.keys(materials[0]).sort(), ['goal', 'goalId', 'id', 'level', 'reviewStatus', 'skill', 'title']);
  assert.ok(!JSON.stringify(materials).includes('answer'));
  const template = await rpc('tools/call', { name: 'get_practice_template', arguments: { goalId: 'find-meeting-place', level: 'A1' } });
  assert.deepEqual(JSON.parse(template.body.result.content[0].text), { available: false, reason: 'NO_REVIEWED_TEMPLATE' });
  for (const method of ['GET', 'DELETE']) assert.equal((await request('/mcp', { method, headers: { Authorization: `Bearer ${token.access_token}`, 'MCP-Protocol-Version': '2025-11-25' } }, new Map())).status, 405);
  const refreshed = await json(await request('/oauth/token', post({ grant_type: 'refresh_token', refresh_token: token.refresh_token, client_id: registered.client_id, resource: `${origin}/mcp` })), 200);
  assert.ok(refreshed.access_token);
  const revoked = await request(`/api/ai/connections/${connection.id}`, { method: 'DELETE', headers: { Origin: origin, 'X-CSRF-Token': csrf } }); assert.equal(revoked.status, 200);
  assert.equal((await rpc('tools/list', {}, refreshed.access_token)).response.status, 401);
  assert.equal((await request('/oauth/token', post({ grant_type: 'refresh_token', refresh_token: refreshed.refresh_token, client_id: registered.client_id, resource: `${origin}/mcp` }))).status, 400);
  assert.equal((await json(await request('/api/ai/shares'), 200)).shares.length, 0);
  // Code reuse may revoke the issued grant; check it after the valid-token flow.
  assert.equal((await request('/oauth/token', post(tokenRequest))).status, 400);
  sql('DELETE FROM auth_limits');
  const pendingJar = new Map();
  const loginPage = await request(`/oauth/authorize?${query}`, {}, pendingJar);
  assert.equal(loginPage.status, 200); assert.ok((await loginPage.text()).includes('/api/auth/start?return=%2Foauth%2Fresume'));
  assert.equal((await request('/oauth/resume', {}, pendingJar)).status, 401);
  pendingJar.set('lingfern_local_session', cookie);
  const resumed = await request('/oauth/resume', {}, pendingJar); assert.equal(resumed.status, 200);
  assert.equal((await request('/oauth/resume', {}, pendingJar)).status, 400);
  const resumedHandle = (await resumed.text()).match(/name="handle" value="([^"]+)"/)[1];
  const denied = await request('/oauth/authorize', post({ handle: resumedHandle, csrf, decision: 'deny' }, { Origin: origin }), pendingJar);
  assert.equal(denied.status, 302); assert.equal(new URL(denied.headers.get('Location')).searchParams.get('error'), 'access_denied');
  const invalidQuery = new URLSearchParams(query); invalidQuery.set('redirect_uri', 'https://evil.example/callback');
  const invalidCallback = await request(`/oauth/authorize?${invalidQuery}`); assert.equal(invalidCallback.status, 400); assert.ok(!invalidCallback.headers.has('Location'));
  const plainQuery = new URLSearchParams(query); plainQuery.set('code_challenge_method', 'plain');
  assert.notEqual((await request(`/oauth/authorize?${plainQuery}`)).status, 200);
  const wrongResource = new URLSearchParams(query); wrongResource.set('resource', 'https://other.example/mcp');
  assert.notEqual((await request(`/oauth/authorize?${wrongResource}`)).status, 200);
  sql('DELETE FROM auth_limits');
  const shortQuery = new URLSearchParams(query); shortQuery.set('scope', 'mcp:read contexts:read');
  const shortPage = await request(`/oauth/authorize?${shortQuery}`), shortHtml = await shortPage.text();
  const shortHandle = shortHtml.match(/name="handle" value="([^"]+)"/)[1];
  const shortApproval = await request('/oauth/authorize', post({ handle: shortHandle, csrf, decision: 'approve', scope: 'contexts:read' }, { Origin: origin }));
  assert.equal(shortApproval.status, 302);
  const shortCode = new URL(shortApproval.headers.get('Location')).searchParams.get('code');
  const shortToken = await json(await request('/oauth/token', post({ ...tokenRequest, code: shortCode })), 200);
  assert.ok(!shortToken.refresh_token, 'declining persistent access must not issue a refresh token');
  const shortConnection = (await json(await request('/api/ai/connections'), 200)).connections[0];
  assert.equal(shortConnection.expiresAt - shortConnection.createdAt, 3600);
  assert.equal((await rpc('tools/call', { name: 'search_materials', arguments: { keywords: 'meeting' } }, shortToken.access_token)).body.result.isError, true);
  sql('DELETE FROM auth_limits');
  for (let count = 0; count < 10; count++) assert.notEqual((await request('/oauth/authorize')).status, 429);
  const limited = await request('/oauth/authorize'); assert.equal(limited.status, 429); assert.equal(limited.headers.get('Retry-After'), '60');
  sql('DELETE FROM auth_limits');
  assert.equal((await request('/oauth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(65537) })).status, 413);
  assert.equal(callbacks.length, 4);
  console.log('PASS: actual isolated Worker/Provider/KV/D1 consent, PKCE code exchange, SDK tools, refresh, ownership and immediate business/library revocation. Synthetic identity only; no GitHub or external client acceptance.');
} finally {
  callbackServer.closeAllConnections();
  await new Promise(resolve => callbackServer.close(resolve));
  try { process.kill(-server.pid, 'SIGTERM'); } catch { /* Child already exited. */ }
  if (server.exitCode === null) await new Promise(resolve => server.once('exit', resolve));
  await rm(directory, { recursive: true, force: true });
}
