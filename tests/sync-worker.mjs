import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createHash, webcrypto } from 'node:crypto';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { createServer as createHttpServer } from 'node:http';

// Real browser/client -> isolated HTTP workerd/D1 -> synthetic GitHub fixture.
// Explicit server configuration enables this isolated synthetic candidate only.
const root = process.cwd(), directory = await mkdtemp(path.join(tmpdir(), 'lingfern-sync-test-'));
const origin = 'http://127.0.0.1:8787', address = 'http://127.0.0.1:8791', browserOrigin = 'http://127.0.0.1:5191';
const state = path.join(directory, 'state'), entry = path.join(directory, 'worker.ts'), configPath = path.join(directory, 'wrangler.json');
const cookie = 's'.repeat(43), cookie2 = 'u'.repeat(43), csrf = 'c'.repeat(43), logical = 'integration-shared';
const hash = value => createHash('sha256').update(value).digest('base64url');
const cli = ['wrangler', '--config', configPath];
await writeFile(entry, `import worker from ${JSON.stringify(path.join(root, 'worker/index.ts'))};import {installProvider,fixtureControl} from ${JSON.stringify(path.join(root, 'tests/fixtures/sync-provider.ts'))};export default {async fetch(request,env,ctx){const url=new URL(request.url);if(url.pathname==='/__fixture')return fixtureControl(request,env);installProvider(env);url.port='8787';const headers=new Headers(request.headers);if(headers.get('Origin')==='${browserOrigin}')headers.set('Origin','${origin}');return worker.fetch(new Request(url,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body}),env,ctx)}};`);
await writeFile(configPath, JSON.stringify({ name: 'lingfern-sync-test', main: entry, compatibility_date: '2026-09-27', compatibility_flags: ['nodejs_compat'], d1_databases: [{ binding: 'AUTH_DB', database_name: 'sync-test', database_id: '00000000-0000-0000-0000-000000000002', migrations_dir: path.join(root, 'worker/migrations') }], vars: { SYNC_ENABLED: 'true', LOCAL_AUTH: 'true', GITHUB_CLIENT_ID: 'synthetic-app', GITHUB_CLIENT_SECRET: 'synthetic-secret', TOKEN_ENCRYPTION_KEY: btoa('k'.repeat(32)), GITHUB_APP_SLUG: 'synthetic', GITHUB_WEBHOOK_SECRET: 'synthetic-webhook' } }));
function sql(command) { execFileSync('npx', [...cli, 'd1', 'execute', 'sync-test', '--local', '--persist-to', state, '--command', command], { stdio: 'pipe' }); }
execFileSync('npx', [...cli, 'd1', 'migrations', 'apply', 'sync-test', '--local', '--persist-to', state], { stdio: 'pipe' });
const time = Math.floor(Date.now() / 1000), key = await webcrypto.subtle.importKey('raw', new TextEncoder().encode('k'.repeat(32)), 'AES-GCM', false, ['encrypt']);
for (const [id, credential] of [[1, cookie], [2, cookie2]]) {
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const encrypted = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(`github:${id}`) }, key, new TextEncoder().encode(JSON.stringify({ access_token: `synthetic-access-${id}`, token_type: 'bearer', obtainedAt: time, expires_in: 28800 })));
  const sealed = JSON.stringify({ iv: Buffer.from(iv).toString('base64'), data: Buffer.from(encrypted).toString('base64') });
  sql(`INSERT INTO accounts(id,login,encrypted_tokens,updated_at) VALUES(${id},'synthetic${id === 1 ? '' : '2'}','${sealed}',${time});INSERT INTO sessions(hash,account_id,csrf,expires_at,absolute_expires_at) VALUES('${hash(credential)}',${id},'${csrf}',${time + 86400},${time + 86400});`);
}
const server = spawn('npx', [...cli, 'dev', '--local', '--ip', '127.0.0.1', '--port', '8791', '--persist-to', state], { stdio: 'ignore', detached: true });
let vite, browser, secondOrigin, secondRequests = 0;
const evidence = { scope: 'Synthetic GitHub, isolated local workerd/D1, two learning profiles within one isolated Chrome context/database; no real provider/two-device/website availability acceptance', availability: 'Real server SYNC_ENABLED=true with synthetic App/credentials in isolated config; no response flag rewriting. Default preview/production config remains disabled.', operations: [] };
try { const prior = JSON.parse(await readFile('private/verification/sync-worker-integration.json', 'utf8')); evidence.previousRuns = [...(prior.previousRuns ?? []), { status: prior.status, failure: prior.failure, diagnostic: prior.diagnostic }]; } catch { /* First local run. */ }
async function request(route, body) { return fetch(address + route, { method: body ? 'POST' : 'GET', headers: { Cookie: `lingfern_local_session=${cookie}`, Origin: origin, 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
async function control(mode) { const response = await request('/__fixture?mode=' + mode); assert.equal(response.status, 200); return response.json(); }
try {
  for (let i = 0; i < 120; i++) { try { if ((await request('/__fixture?mode=stats')).status === 200) break; } catch { /* Isolated child startup. */ } await new Promise(resolve => setTimeout(resolve, 250)); }
  const original = await (await request('/api/session')).json();
  if (original.error) evidence.diagnostic = { ...await control('diagnostic'), ...await control('native-redirect') };
  assert.equal(original.syncAvailable, true, JSON.stringify({ original, diagnostic: evidence.diagnostic })); assert.equal(original.account.id, 1);
  const choice = { installationId: 31, repositoryId: 21, name: 'lingfern-data', profileId: logical };
  const inspected = await request('/api/sync/inspect', choice); assert.equal(inspected.status, 200);
  const intent = (await inspected.json()).intent;
  const bound = await request('/api/sync/bind', { intent, confirm: true }); assert.equal(bound.status, 200); assert.equal((await bound.json()).syncAvailable, true);
  const summary = await (await request('/api/session')).json(); assert.equal(summary.syncAvailable, true);
  const scope = { accountId: 1, profileId: logical, bindingVersion: summary.bindings[0].bindingVersion };
  secondOrigin = createHttpServer((_request, response) => { secondRequests++; response.end('forbidden synthetic second origin'); });
  await new Promise(resolve => secondOrigin.listen(8792, '127.0.0.1', resolve));
  assert.equal((await control('native-manual')).status, 302);
  const beforeRedirect = await control('redirect');
  assert.equal((await request('/api/session')).status, 503);
  assert.equal((await request('/api/sync/repositories')).status, 503);
  const afterRedirect = await control('clear-redirect');
  assert.equal(afterRedirect.calls - beforeRedirect.calls, 2); assert.equal(secondRequests, 0);
  evidence.operations.push('Actual native workerd manual fetch returns local302; auth/Octokit reject redirected fixture responses; no second-origin request or credentials forwarded');
  vite = await createServer({ server: { host: '127.0.0.1', port: 5191, strictPort: true, hmr: false, ws: false } }); await vite.listen();
  browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true });
  const context = await browser.newContext(); await context.addCookies([{ name: 'lingfern_local_session', value: cookie, url: browserOrigin }]);
  const page = await context.newPage(), sent = [];
  await page.route(browserOrigin + '/', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Synthetic sync integration</title>' }));
  await page.route('**/api/**', async route => {
    try {
    const r = route.request(), url = new URL(r.url());
    const response = await fetch(address + url.pathname + url.search, { method: r.method(), headers: r.headers(), ...(r.postData() ? { body: r.postData() } : {}) });
    if (url.pathname === '/api/sync/batches') sent.push(r.postDataJSON().batch.batchId);
    const headers = Object.fromEntries(response.headers); delete headers['content-encoding']; delete headers['content-length'];
    await route.fulfill({ status: response.status, headers, body: Buffer.from(await response.arrayBuffer()) });
    } catch (error) { evidence.bridgeFailure = String(error); await route.abort('failed'); }
  });
  await page.goto(browserOrigin + '/');
  await page.evaluate(async ({ scope, summary }) => {
    const { db } = await import('/src/data/db.ts'); const { allowSyncUpload } = await import('/src/data/syncClient.ts');
    const { appendSyncEvent } = await import('/src/data/sync.ts');
    globalThis.integration = { scope, consents: {}, db };
    for (const id of ['local-a', 'local-b']) {
      await db.table('profiles').put({ id, name: 'Synthetic local profile', createdAt: new Date().toISOString() });
      await db.table('syncClocks').put({ profileId: id, logicalProfileId: scope.profileId, deviceId: crypto.randomUUID(), counter: 0 });
      await db.table('settings').bulkPut([{ key: 'activeProfile', value: id }, { key: `profile:${id}:syncAccount`, value: JSON.stringify({ accountId: 1, profileId: scope.profileId }) }]);
      globalThis.integration.consents[id] = await allowSyncUpload(id, scope, summary);
    }
    await db.table('settings').put({ key: 'activeProfile', value: 'local-a' });
    await appendSyncEvent('local-a', { type: 'completion', payload: { recordId: 'synthetic-record', sessionId: 'synthetic-session', questionId: 'synthetic-question', rootId: 'synthetic-root', goalId: 'synthetic-goal', skill: 'reading', level: 'A1', mode: 'practice', contentHash: 'a'.repeat(64), correct: true, assistance: { hintLevel: 0, dictionaryUsed: false, audioCompleted: false, playbackRequests: 0 } } });
  }, { scope, summary });
  async function client(action, profile = 'local-a') {
    return page.evaluate(async ({ action, profile }) => {
      const { db, scope, consents } = globalThis.integration; const client = await import('/src/data/syncClient.ts');
      await db.table('settings').put({ key: 'activeProfile', value: profile });
      try { return { value: action === 'upload' ? await client.uploadSyncBatch(profile, consents[profile]) : await client.downloadSyncPage(profile, scope) }; } catch (error) { return { error: error.message }; }
    }, { action, profile });
  }
  async function drain(profile) {
    for (let i = 0; i < 5; i++) { const result = await client('upload', profile); assert.equal(result.error, undefined, JSON.stringify(result)); if (result.value === 'idle') return; assert.equal(result.value, 'uploaded'); }
    assert.fail('bounded synthetic upload queue did not drain');
  }
  await control('lost'); assert.ok((await client('upload')).error); assert.equal((await control('stats')).writes, 1);
  const retried = await client('upload'); assert.equal(retried.value, 'uploaded', JSON.stringify(retried)); assert.equal(sent.length, 2); assert.equal(new Set(sent).size, 1); assert.equal((await control('stats')).writes, 1);
  evidence.operations.push('Provider writes then loses ack; retry identical batchID acknowledges existing blob without second write');
  assert.ok((await client('download', 'local-b')).value);
  await page.evaluate(async () => { const { deleteLearningRecord } = await import('/src/data/deletion.ts'); await deleteLearningRecord('local-b', 'synthetic-record'); });
  await drain('local-b'); assert.ok((await client('download')).value); assert.ok((await client('download', 'local-b')).value); await drain('local-a');
  const projected = await page.evaluate(async () => { const { readSyncEvents } = await import('/src/data/sync.ts'); const { projectSyncEvents } = await import('/src/shared/sync.ts'); return Promise.all(['local-a', 'local-b'].map(async id => { const p = projectSyncEvents(await readSyncEvents(id)); return { completions: p.completions.length, deleted: [...p.deletedRecords] }; })); });
  assert.deepEqual(projected, [{ completions: 0, deleted: ['synthetic-record'] }, { completions: 0, deleted: ['synthetic-record'] }]); evidence.operations.push('Second local profile downloads completion and uploads real deletion event; both projections retain tombstone after repeated downloads');
  await page.evaluate(async () => { const { appendSyncEvent } = await import('/src/data/sync.ts'); await appendSyncEvent('local-a', { type: 'saved_item', payload: { memoryId: 'synthetic-sense', saved: true, reviewEnabled: false } }); });
  const beforeSwitch = sent.length;
  await context.addCookies([{ name: 'lingfern_local_session', value: cookie2, url: browserOrigin }]);
  assert.equal((await client('upload')).error, 'SYNC_SCOPE_CHANGED'); assert.equal(sent.length, beforeSwitch); evidence.operations.push('Actual second-account session rejected against first-account pending batch/consent/binding before batch dispatch');
  await context.addCookies([{ name: 'lingfern_local_session', value: cookie, url: browserOrigin }]);
  await control('revoke-on-put'); assert.ok((await client('upload')).error);
  const receiptCount = await page.evaluate(() => globalThis.integration.db.table('syncUploads').where('profileId').equals('local-a').count()); assert.equal(receiptCount, 2);
  assert.equal((await client('upload')).error, 'SYNC_SCOPE_CHANGED'); await control('restore'); assert.equal((await client('upload')).value, 'uploaded'); evidence.operations.push('Revocation after provider write denies acknowledgment and later dispatch; restored synthetic account retries same pending batch without overwrite');
  await control('conflict'); assert.ok((await client('download')).value);
  const conflicts = await page.evaluate(() => globalThis.integration.db.table('syncConflicts').where('profileId').equals('local-a').count()); assert.equal(conflicts, 1); evidence.operations.push('Changed same-path remote batch with new blob SHA is quarantined; no incoming conflicting completion projected');
  const after = await page.evaluate(async () => { const { readSyncEvents } = await import('/src/data/sync.ts'); const { projectSyncEvents } = await import('/src/shared/sync.ts'); const events = await readSyncEvents('local-a'); return { completions: projectSyncEvents(events).completions.length, originalCorrect: events.find(event => event.type === 'completion').payload.correct }; }); assert.deepEqual(after, { completions: 0, originalCorrect: true });
  await control('redirect'); const disconnected = await request('/api/auth/disconnect', { confirm: true });
  assert.equal(disconnected.status, 200); assert.deepEqual(await disconnected.json(), { disconnected: true, providerRevoked: false });
  assert.equal((await (await request('/api/session')).json()).account, null); assert.equal(secondRequests, 0);
  evidence.operations.push('Actual workerd grant DELETE redirect reports providerRevoked false, still revokes local identity/session, and sends0requests to second origin');
  evidence.status = 'passed'; evidence.requests = sent.length; evidence.provider = await control('stats');
} catch (error) { evidence.status = 'failed'; evidence.failure = String(error); throw error; }
finally {
  await mkdir('private/verification', { recursive: true }); await writeFile('private/verification/sync-worker-integration.json', JSON.stringify(evidence, null, 2) + '\n');
  await browser?.close(); await vite?.close(); if (secondOrigin) await new Promise(resolve => secondOrigin.close(resolve)); try { process.kill(-server.pid, 'SIGTERM'); } catch { /* Child already ended. */ } await rm(directory, { recursive: true, force: true });
}
console.log('Isolated sync client/Worker/D1/synthetic-provider integration passed.');
