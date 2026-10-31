import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildManifest, verifyPublicBuild, publishVerified, capturePublicEntry, redactCommandOutput } from '../scripts/deploy-verified.mjs';
import { ciDeploymentConfig } from '../scripts/release-config.mjs';
import { prerenderPath, publicPages, renderPageHtml } from '../src/shared/seo.ts';

const old = '11111111-1111-4111-8111-111111111111', next = '22222222-2222-4222-8222-222222222222';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const htmlTemplate = '<!doctype html><head><!--seo:start--><title>Lingfern</title><!--seo:end--></head><body>exact HTML</body>';
const pageTemplates = Object.fromEntries(Object.keys(publicPages).map(path => [path, renderPageHtml(htmlTemplate.replace('exact HTML', `exact public content ${path}`), path)]));
const contents = { 'index.html': Buffer.from(htmlTemplate), 'sw.js': Buffer.alloc(120142, 7), 'source-packs/listening.zip': Buffer.from('exact ZIP'), ...Object.fromEntries(Object.entries(pageTemplates).map(([path, html]) => [prerenderPath(path).slice(1), Buffer.from(html)])) };
const files = Object.entries(contents).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: hash(bytes) }));
const verify = (input, options) => verifyPublicBuild(input, { htmlTemplate, pageTemplates, ...options });

test('retained successful and failed command diagnostics never print the bearer token', () => {
  const token = 'synthetic+token.with$metacharacters';
  assert.deepEqual(redactCommandOutput({ stdout: `result ${token}`, stderr: `CF-Ray=synthetic; ${token} ${token}` }, token), { stdout: 'result [REDACTED]', stderr: 'CF-Ray=synthetic; [REDACTED] [REDACTED]' });
  assert.deepEqual(redactCommandOutput(Error('command timed out'), token), { stdout: '', stderr: '' });
  assert.throws(() => redactCommandOutput({}, ''));
});

function fetchFixture({ version = next, change = () => undefined } = {}) {
  const requests = [];
  const fetcher = async (url, options) => {
    requests.push({ url, options });
    assert.equal(new URL(url).origin, 'https://lingfern.com');
    assert.equal(options.method, 'GET'); assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error');
    assert(!options.headers.Authorization && !options.headers.Cookie);
    const pathname = new URL(url).pathname;
    if (pathname === '/api/unknown' || pathname.includes('release-missing') || pathname === '/_headers' || pathname === '/sitemap') return new Response('not found', { status: 404 });
    const file = pathname === '/' ? 'index.html' : pathname.slice(1);
    const body = contents[file] ?? Buffer.from(renderPageHtml(pageTemplates[pathname] ?? htmlTemplate, pathname));
    const response = change(pathname, body);
    return response ?? new Response(body, { headers: { 'x-lingfern-version': version, 'cache-control': 'no-store', 'content-security-policy': "frame-ancestors 'none'", 'cf-ray': 'synthetic-TPE' } });
  };
  return { fetcher, requests };
}

test('build manifest seals every file including listening ZIPs, excludes headers control and rejects symlinks', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'lingfern-deployment-'));
  try {
    for (const [name, bytes] of Object.entries(contents)) { await mkdir(path.dirname(path.join(dir, name)), { recursive: true }); await writeFile(path.join(dir, name), bytes); }
    await writeFile(path.join(dir, '_headers'), 'controls');
    const result = await buildManifest(dir);
    assert.deepEqual(new Map(result.map(f => [f.path, f])), new Map(files.map(f => [f.path, f])));
    await symlink(path.join(dir, 'index.html'), path.join(dir, 'alias.html'));
    await assert.rejects(buildManifest(dir), /ASSET_SYMLINK/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('pinned and ordinary full checks read exact bytes without credentials or writes', async () => {
  for (const pin of [true, false]) {
    const fixture = fetchFixture();
    const result = await verify(files, { version: next, pin, fetcher: fixture.fetcher });
    assert.equal(result.files, files.length); assert.equal(result.pages, 13); assert.equal(result.missingPaths, 5);
    assert(fixture.requests.some(({ url }) => url === 'https://lingfern.com/sitemap'));
    for (const { options } of fixture.requests) assert.equal(options.headers['Cloudflare-Workers-Version-Overrides'], pin ? `lingfern="${next}"` : undefined);
  }
});

test('page proofs require the sealed HTML template and reject changed metadata', async () => {
  const fixture = fetchFixture();
  await assert.rejects(verify(files, { htmlTemplate: 'different source', version: next, fetcher: fixture.fetcher }), /HTML_TEMPLATE_MISMATCH/);
  assert.equal(fixture.requests.length, 0);
  const changed = fetchFixture({ change: (pathname, body) => pathname === '/library/ipa' ? new Response(body.toString().replace('IPA pronunciation chart', 'Wrong title'), { headers: { 'x-lingfern-version': next, 'content-security-policy': "frame-ancestors 'none'" } }) : undefined });
  await assert.rejects(verify(files, { version: next, fetcher: changed.fetcher }));
});

test('recovery checkpoint preserves a real-sized SW over64KiB and rejects an unhealthy old version', async () => {
  const captured = await capturePublicEntry(fetchFixture().fetcher);
  assert.equal(captured[1].bytes, 120142); assert.equal(captured[1].sha256, hash(contents['sw.js']));
  await assert.rejects(capturePublicEntry(async () => new Response(null, { status: 500 })), /PUBLIC_STATUS/);
});

test('header failures release unread bodies without replacing the verification error', async () => {
  for (const [pathname, status, headers, error] of [
    ['/today', 200, {}, /content-security-policy/],
    ['/sw.js', 200, {}, /cache-control/],
    ['/today', 500, {}, /PUBLIC_STATUS/],
  ]) {
    let cancelled = 0;
    const fixture = fetchFixture({ change: path => path === pathname ? new Response(new ReadableStream({ cancel() { cancelled++; throw Error('CANCEL_FAILED'); } }), { status, headers }) : undefined });
    await assert.rejects(capturePublicEntry(fixture.fetcher), error);
    assert.equal(cancelled, 1);
  }
});

test('unsealed public content fails before any publication request', async () => {
  const fixture = fetchFixture();
  await assert.rejects(verify(files, { pageTemplates: { ...pageTemplates, '/library/ipa': pageTemplates['/library/ipa'] + 'changed body' }, version: next, fetcher: fixture.fetcher }), /PUBLIC_TEMPLATE_MISMATCH/);
  await assert.rejects(verify(files, { pageTemplates: {}, version: next, fetcher: fixture.fetcher }), /PUBLIC_TEMPLATE_MISMATCH/);
  assert.equal(fixture.requests.length, 0);
});

test('waits only for bounded version propagation; status failures never retry', async () => {
  const fixture = fetchFixture(); let waiting = 0, calls = 0;
  const fetcher = (url, options) => ++calls <= 2 ? Promise.resolve(new Response(contents['index.html'], { headers: { 'x-lingfern-version': old } })) : fixture.fetcher(url, options);
  await verify(files, { version: next, pin: true, fetcher, pause: async () => { waiting++; } });
  assert.equal(waiting, 2);
  let failures = 0;
  await assert.rejects(verify(files, { version: next, fetcher: async () => { failures++; return new Response(null, { status: 500 }); }, pause: async () => assert.fail('No status retry') }), /PUBLIC_STATUS/);
  assert.equal(failures, 1);
});

test('a ZIP500 fails immediately with ray evidence; no retry or HTML fallback can pass', async () => {
  const reported = [];
  const fixture = fetchFixture({ change: pathname => pathname.endsWith('.zip') ? new Response(null, { status: 500, headers: { 'cf-ray': 'synthetic-failure-TPE' } }) : undefined });
  await assert.rejects(verify(files, { version: next, pin: true, fetcher: fixture.fetcher, report: row => reported.push(row) }), /PUBLIC_STATUS.*500/);
  assert.equal(fixture.requests.filter(r => r.url.endsWith('/source-packs/listening.zip')).length, 1);
  assert(reported.some(r => r.failed && r.cfRay === 'synthetic-failure-TPE'));
  const fallback = fetchFixture({ change: pathname => pathname.endsWith('.zip') ? new Response(Buffer.alloc(contents['source-packs/listening.zip'].length)) : undefined });
  await assert.rejects(verify(files, { version: next, fetcher: fallback.fetcher }));
});

test('a lost resource stream records partial bytes and fails without retry', async () => {
  const reports = []; let chunks = 0;
  const fixture = fetchFixture({ change: pathname => pathname.endsWith('.zip') ? new Response(new ReadableStream({ pull(controller) { if (chunks++ === 0) controller.enqueue(new Uint8Array([1, 2])); else controller.error(Error('STREAM_LOST')); } })) : undefined });
  await assert.rejects(verify(files, { version: next, fetcher: fixture.fetcher, report: row => reports.push(row) }), /STREAM_LOST/);
  assert(reports.some(row => row.failed && row.receivedBytes === 2));
  assert.equal(fixture.requests.filter(r => r.url.endsWith('/source-packs/listening.zip')).length, 1);
});

test('ignored overrides with identical HTML, unsafe manifests, redirects and truncated resources fail closed', async () => {
  await assert.rejects(verify(files, { version: next, pin: true, fetcher: fetchFixture({ version: old }).fetcher, pause: async () => {} }), /WRONG_WORKER_VERSION/);
  for (const bad of [[...files, files[0]], files.map((f, i) => i ? f : { ...f, path: '../outside' }), files.map((f, i) => i ? f : { ...f, path: 'api/auth/start' }), files.map((f, i) => i ? f : { ...f, path: 'assets/line\n::error' }), files.map((f, i) => i ? f : { ...f, bytes: Infinity })]) {
    const fixture = fetchFixture(); await assert.rejects(verify(bad, { version: next, fetcher: fixture.fetcher })); assert.equal(fixture.requests.length, 0);
  }
  for (const response of [() => new Response(null, { status: 307, headers: { location: 'https://foreign.example/' } }), () => new Response('short')]) {
    const fixture = fetchFixture({ change: pathname => pathname.endsWith('.zip') ? response() : undefined });
    await assert.rejects(verify(files, { version: next, fetcher: fixture.fetcher }));
  }
});

function publicationFixture() {
  let state = { id: randomUUID(), versions: [{ version_id: old, percentage: 100 }] };
  const calls = [], events = [];
  const deps = {
    readDeployment: async () => structuredClone(state),
    captureCurrent: async () => { calls.push('capture'); return ['old entry', 'old SW']; },
    upload: async () => { calls.push('upload'); return next; },
    deploy: async (versions, message) => { calls.push(versions.map(v => `${v.version_id}@${v.percentage}`).join(',')); state = { id: randomUUID(), versions: structuredClone(versions), annotations: { 'workers/message': message } }; },
    verify: async (version, pin) => { assert.equal(version, next); calls.push(pin ? 'verify candidate' : 'verify ordinary'); },
    verifyRecovery: async proof => { assert.deepEqual(proof, ['old entry', 'old SW']); calls.push('verify recovery'); },
    record: async event => { events.push(event); },
  };
  return { deps, calls, events, state: () => state, replace: value => { state = value; } };
}

test('publication uploads without traffic, validates0% before100%, then validates ordinary traffic', async () => {
  const f = publicationFixture(); assert.equal(await publishVerified(f.deps), next);
  assert.deepEqual(f.calls, ['capture', 'upload', `${old}@100,${next}@0`, 'verify candidate', `${next}@100`, 'verify ordinary']);
  assert.equal(f.events.at(-1).phase, 'accepted');
});

test('candidate or ordinary verification failure restores old code and verifies original entry/SW', async () => {
  for (const failPinned of [true, false]) {
    const f = publicationFixture(); f.deps.verify = async (_version, pin) => { if (pin === failPinned) throw Error('ZIP500'); };
    await assert.rejects(publishVerified(f.deps), /ZIP500/);
    assert.deepEqual(f.state().versions, [{ version_id: old, percentage: 100 }]);
    assert.equal(f.calls.at(-1), 'verify recovery');
    assert(!f.events.some(event => event.phase === 'accepted'));
    if (failPinned) assert(!f.calls.includes(`${next}@100`));
  }
});

test('metadata failure or concurrent publication cannot be mistaken for empty or overwritten', async () => {
  const offline = publicationFixture(); offline.deps.readDeployment = async () => { throw Error('METADATA_OFFLINE'); };
  await assert.rejects(publishVerified(offline.deps), /METADATA_OFFLINE/); assert.deepEqual(offline.calls, []);
  const concurrent = publicationFixture(); const upload = concurrent.deps.upload;
  concurrent.deps.upload = async () => { concurrent.replace({ id: randomUUID(), versions: [{ version_id: next, percentage: 100 }] }); return upload(); };
  await assert.rejects(publishVerified(concurrent.deps), /CONCURRENT_DEPLOYMENT/); assert.equal(concurrent.calls.length, 2);
  const during = publicationFixture();
  during.deps.verify = async () => { during.replace({ ...during.state(), id: randomUUID(), annotations: { 'workers/message': 'another operator' } }); };
  await assert.rejects(publishVerified(during.deps), /CONCURRENT_DEPLOYMENT_MANUAL_RECOVERY_REQUIRED/);
  assert.equal(during.calls.filter(c => c.includes('@')).length, 1);
});

test('ambiguous command failure recovers only its own marked deployment; logging cannot prevent recovery', async t => {
  const f = publicationFixture(); const deploy = f.deps.deploy; let first = true;
  f.deps.deploy = async (...args) => { await deploy(...args); if (first) { first = false; throw Error('COMMAND_RESULT_LOST'); } };
  f.deps.record = async event => { if (event.phase === 'recover') throw Error('DISK_FULL'); };
  t.mock.method(console, 'error', () => {});
  await assert.rejects(publishVerified(f.deps), /COMMAND_RESULT_LOST/);
  assert.deepEqual(f.state().versions, [{ version_id: old, percentage: 100 }]); assert.equal(f.calls.at(-1), 'verify recovery');
});

test('failed recovery stays failed and never records acceptance', async () => {
  const f = publicationFixture(); f.deps.verify = async () => { throw Error('ZIP500'); }; f.deps.verifyRecovery = async () => { throw Error('OLD_VERSION_UNAVAILABLE'); };
  await assert.rejects(publishVerified(f.deps), /OLD_VERSION_UNAVAILABLE/);
  assert(!f.events.some(e => ['accepted', 'recovered'].includes(e.phase)));
});

test('CLI rejects ordinary/local/fork execution before reading config or credentials', () => {
  const child = spawnSync(process.execPath, ['scripts/deploy-verified.mjs', '/nonexistent-config.json'], { env: { ...process.env, GITHUB_REPOSITORY: 'foreign/repo', GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'workflow_dispatch', CLOUDFLARE_API_TOKEN: 'synthetic-secret-must-not-leak' } });
  assert.notEqual(child.status, 0); assert.match(child.stderr.toString(), /PROTECTED_MANUAL_MAIN_ONLY/); assert(!child.stderr.includes('synthetic-secret-must-not-leak'));
});

test('CLI accepts the exact CI-transformed config before credentials, and rejects a changed config', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'lingfern-ci-config-'));
  try {
    const root = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
    const config = ciDeploymentConfig(root, process.cwd());
    assert(path.isAbsolute(config.d1_databases[0].migrations_dir));
    const configPath = path.join(dir, 'deployment.json');
    const env = { ...process.env, GITHUB_REPOSITORY: 'euanylin/lingfern', GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_SHA: 'a'.repeat(40), GITHUB_RUN_ID: '99', CLOUDFLARE_ACCOUNT_ID: root.account_id, CLOUDFLARE_API_TOKEN: '' };
    for (const changed of [false, true]) {
      await writeFile(configPath, JSON.stringify(changed ? { ...config, assets: { ...config.assets, directory: '/unreviewed' } } : config));
      const child = spawnSync(process.execPath, ['scripts/deploy-verified.mjs', configPath], { env });
      assert.notEqual(child.status, 0);
      assert.match(child.stderr.toString(), changed ? /CI_CONFIG_MISMATCH/ : /CLOUDFLARE_CREDENTIALS_REQUIRED/);
    }
  } finally { await rm(dir, { recursive: true }); }
});
