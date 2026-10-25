import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkReleaseConfig } from './release-config.mjs';

const origin = 'https://lingfern.com';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const pages = ['introduction', 'start', 'today', 'progress', 'library', 'library/dictionary', 'library/saved', 'library/ipa', 'library/grammar', 'library/history', 'settings', 'settings/about', 'learn/release-probe'];

export function redactCommandOutput(output, token) {
  assert(typeof token === 'string' && token.length > 0);
  return { stdout: (output.stdout ?? '').replaceAll(token, '[REDACTED]'), stderr: (output.stderr ?? '').replaceAll(token, '[REDACTED]') };
}

function validFile(file) {
  assert(file && typeof file.path === 'string' && !/[\u0000-\u001f\u007f\\?#%]/.test(file.path));
  assert(file.path.split('/').every(part => part && part !== '.' && part !== '..'));
  assert(!/^(api|oauth|mcp|\.well-known)(\/|$)/.test(file.path));
  assert(Number.isSafeInteger(file.bytes) && file.bytes >= 0 && file.bytes <= 20 * 1024 * 1024);
  assert(/^[a-f0-9]{64}$/.test(file.sha256));
}

export async function buildManifest(directory) {
  const files = [];
  async function visit(relative) {
    for (const entry of (await readdir(path.join(directory, relative), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      assert(!entry.isSymbolicLink(), 'ASSET_SYMLINK');
      if (entry.isDirectory()) await visit(name);
      else {
        assert(entry.isFile(), 'ASSET_NOT_FILE');
        if (name === '_headers') continue;
        const bytes = await readFile(path.join(directory, name));
        const file = { path: name, bytes: bytes.length, sha256: digest(bytes) };
        validFile(file); files.push(file);
      }
    }
  }
  await visit('');
  assert(files.some(file => file.path === 'index.html') && files.some(file => file.path === 'sw.js'));
  return files;
}

async function publicGet(pathname, { version, pin, fetcher, expected, status = 200, html = false, signal, report }) {
  const headers = { Accept: html ? 'text/html' : '*/*' };
  if (pin) headers['Cloudflare-Workers-Version-Overrides'] = `lingfern="${version}"`;
  const row = { path: pathname, version, pin, receivedBytes: 0 };
  const started = performance.now();
  try {
    const response = await fetcher(origin + pathname, { method: 'GET', headers, credentials: 'omit', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]) });
    Object.assign(row, { status: response.status, cfRay: response.headers.get('cf-ray'), cache: response.headers.get('cf-cache-status') });
    if (response.status !== status) { await response.body?.cancel(); assert.fail(`PUBLIC_STATUS ${pathname}: ${response.status}`); }
    if (html && version && response.headers.get('x-lingfern-version') !== version) {
      await response.body?.cancel();
      throw Object.assign(Error('WRONG_WORKER_VERSION'), { code: 'WRONG_WORKER_VERSION' });
    }
    if (html) assert(response.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"));
    if (pathname === '/sw.js') assert(response.headers.get('cache-control')?.includes('no-store'));
    const hash = createHash('sha256'); let length = 0;
    for await (const chunk of response.body ?? []) {
      length += chunk.length;
      row.receivedBytes = length;
      assert(length <= (expected?.bytes ?? (status === 200 ? 20 * 1024 * 1024 : 65536)), 'PUBLIC_RESPONSE_TOO_LARGE');
      hash.update(chunk);
    }
    Object.assign(row, { bytes: length, sha256: hash.digest('hex') });
    if (expected) { assert.equal(length, expected.bytes, pathname); assert.equal(row.sha256, expected.sha256, pathname); }
    row.elapsedMs = performance.now() - started;
    report(row); return row;
  } catch (error) {
    report({ ...row, elapsedMs: performance.now() - started, expected, failed: true, error: error.message });
    throw error;
  }
}

export async function verifyPublicBuild(files, { version, pin = false, fetcher = fetch, report = () => {}, pause = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  assert(uuid.test(version));
  assert(Array.isArray(files) && files.length > 0);
  files.forEach(validFile);
  assert.equal(new Set(files.map(file => file.path)).size, files.length, 'DUPLICATE_ASSET');
  const index = files.find(file => file.path === 'index.html'); assert(index);
  assert(files.some(file => file.path === 'sw.js'));
  const options = { version, pin, fetcher, report, signal: AbortSignal.timeout(15 * 60000) };
  // The header proves the override reached the candidate even when its HTML is unchanged.
  for (let attempt = 0; ; attempt++) {
    try { await publicGet('/today', { ...options, expected: index, html: true }); break; }
    catch (error) {
      if (error.code !== 'WRONG_WORKER_VERSION' || attempt === 9) throw error;
      await pause(1000);
    }
  }
  for (const page of pages) await publicGet('/' + page, { ...options, expected: index, html: true });
  for (const pathname of ['/api/unknown', '/assets/release-missing.js', '/resources/release-missing.zip', '/_headers']) await publicGet(pathname, { ...options, status: 404 });
  let cursor = 0, stopped = false;
  async function worker() {
    try {
      while (!stopped && cursor < files.length) {
        const file = files[cursor++];
        const pathname = file.path === 'index.html' ? '/' : '/' + file.path.split('/').map(encodeURIComponent).join('/');
        await publicGet(pathname, { ...options, expected: file });
      }
    } catch (error) { stopped = true; throw error; }
  }
  const results = await Promise.allSettled([worker(), worker()]);
  const failed = results.find(result => result.status === 'rejected');
  if (failed) throw failed.reason;
  return { version, pin, files: files.length, pages: pages.length, missingPaths: 4 };
}

export async function capturePublicEntry(fetcher = fetch) {
  const result = [];
  for (const pathname of ['/today', '/sw.js']) result.push(await publicGet(pathname, { fetcher, pin: false, html: pathname === '/today', signal: AbortSignal.timeout(60000), report: () => {} }));
  return result;
}

function sameVersions(actual, expected) {
  const sort = values => values.map(({ version_id, percentage }) => [version_id, percentage]).sort((a, b) => a[0].localeCompare(b[0]));
  return JSON.stringify(sort(actual)) === JSON.stringify(sort(expected));
}

export async function publishVerified({ readDeployment, upload, deploy, verify, captureCurrent, verifyRecovery, record }) {
  const before = await readDeployment();
  assert(uuid.test(before.id) && before.versions.length === 1 && before.versions[0].percentage === 100, 'REQUIRE_SINGLE_ACTIVE_VERSION');
  const old = before.versions[0].version_id; assert(uuid.test(old));
  const marker = `Lingfern verified deployment ${randomUUID()}`;
  const recovery = await captureCurrent();
  await record({ phase: 'before-upload', before: { id: before.id, versions: before.versions }, recovery, marker });
  const next = await upload(); assert(uuid.test(next) && next !== old, 'INVALID_UPLOADED_VERSION');
  const staged = [{ version_id: old, percentage: 100 }, { version_id: next, percentage: 0 }];
  const promoted = [{ version_id: next, percentage: 100 }];
  const current = await readDeployment();
  assert.equal(current.id, before.id, 'CONCURRENT_DEPLOYMENT');
  try {
    await record({ phase: 'stage', old, next });
    await deploy(staged, marker + ':stage');
    const stagedState = await readDeployment();
    assert(sameVersions(stagedState.versions, staged) && stagedState.annotations?.['workers/message'] === marker + ':stage', 'STAGE_NOT_OBSERVED');
    const candidateProof = await verify(next, true);
    await record({ phase: 'candidate-verified', old, next, proof: candidateProof });
    assert.equal((await readDeployment()).id, stagedState.id, 'CONCURRENT_DEPLOYMENT');
    await record({ phase: 'promote', old, next });
    await deploy(promoted, marker + ':promote');
    const promotedState = await readDeployment();
    assert(sameVersions(promotedState.versions, promoted) && promotedState.annotations?.['workers/message'] === marker + ':promote', 'PROMOTION_NOT_OBSERVED');
    const ordinaryProof = await verify(next, false);
    assert.equal((await readDeployment()).id, promotedState.id, 'CONCURRENT_DEPLOYMENT');
    await record({ phase: 'accepted', old, next, proof: ordinaryProof });
    return next;
  } catch (error) {
    // Never overwrite another operator's deployment when recovering our failed attempt.
    const actual = await readDeployment();
    if ([marker + ':stage', marker + ':promote'].includes(actual.annotations?.['workers/message']) && (sameVersions(actual.versions, staged) || sameVersions(actual.versions, promoted))) {
      try { await record({ phase: 'recover', old, next, error: error.message }); }
      catch { console.error('RECOVERY_JOURNAL_WRITE_FAILED'); }
      await deploy(before.versions, marker + ':recover');
      assert(sameVersions((await readDeployment()).versions, before.versions), 'RECOVERY_NOT_OBSERVED');
      await verifyRecovery(recovery);
      await record({ phase: 'recovered', old, next });
    } else assert(actual.id === before.id, 'CONCURRENT_DEPLOYMENT_MANUAL_RECOVERY_REQUIRED');
    throw error;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  assert(process.argv.length === 3, 'Provide the reviewed CI deployment config');
  assert(process.env.GITHUB_REPOSITORY === 'euanylin/lingfern' && process.env.GITHUB_REF === 'refs/heads/main' && process.env.GITHUB_EVENT_NAME === 'workflow_dispatch', 'PROTECTED_MANUAL_MAIN_ONLY');
  assert(/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA ?? '') && /^\d+$/.test(process.env.GITHUB_RUN_ID ?? ''), 'CI_SOURCE_REQUIRED');
  const configPath = path.resolve(process.argv[2]);
  const config = JSON.parse(await readFile(configPath, 'utf8')); checkReleaseConfig(config);
  assert(/^[a-f0-9]{32}$/.test(config.account_id) && process.env.CLOUDFLARE_ACCOUNT_ID === config.account_id);
  const token = process.env.CLOUDFLARE_API_TOKEN; assert(token && !/[\r\n]/.test(token));
  const files = await buildManifest(config.assets.directory);
  await writeFile('/tmp/lingfern-deployment-assets.json', JSON.stringify(files), { flag: 'wx' });
  await writeFile('/tmp/lingfern-version-output.ndjson', '', { flag: 'wx' });
  const events = [];
  const record = async event => { const value = { at: new Date().toISOString(), source: process.env.GITHUB_SHA, ...event }; console.log(JSON.stringify(value)); events.push(value); await writeFile('/tmp/lingfern-deployment-journal.json', JSON.stringify(events, null, 2)); };
  await record({ phase: 'sealed-assets', files: files.length, manifestSha256: digest(JSON.stringify(files)) });
  const run = async args => {
    try {
      const output = await promisify(execFile)(process.execPath, ['node_modules/wrangler/bin/wrangler.js', ...args], { timeout: 5 * 60000, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, WRANGLER_LOG: 'log', WRANGLER_LOG_SANITIZE: 'true', WRANGLER_WRITE_LOGS: 'false', WRANGLER_SEND_METRICS: 'false', WRANGLER_OUTPUT_FILE_PATH: '/tmp/lingfern-version-output.ndjson' } });
      const { stdout, stderr } = redactCommandOutput(output, token);
      process.stdout.write(stdout); process.stderr.write(stderr);
    } catch (error) {
      const { stdout, stderr } = redactCommandOutput(error, token);
      process.stdout.write(stdout); process.stderr.write(stderr);
      throw Error('WRANGLER_COMMAND_FAILED; inspect deployment journal and authoritative state before retrying');
    }
  };
  const readDeployment = async () => {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.account_id}/workers/scripts/lingfern/deployments`, { headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!response.ok) await record({ phase: 'metadata-error', status: response.status, cfRay: response.headers.get('cf-ray') });
    assert(response.ok, `DEPLOYMENT_METADATA_HTTP_${response.status}`);
    const value = await response.json(); assert(value.success && value.result?.deployments?.length, 'DEPLOYMENT_METADATA_INVALID');
    return value.result.deployments[0];
  };
  const captureCurrent = () => capturePublicEntry();
  await publishVerified({ readDeployment, record, captureCurrent,
    upload: async () => {
      await run(['versions', 'upload', '--env=', '--config', configPath, '--name', 'lingfern', '--strict', '--tag', process.env.GITHUB_SHA]);
      const outputs = (await readFile('/tmp/lingfern-version-output.ndjson', 'utf8')).trim().split('\n').map(line => JSON.parse(line)).filter(row => row.type === 'version-upload');
      assert(outputs.length === 1 && outputs[0].version === 1 && outputs[0].worker_name === 'lingfern');
      return outputs[0].version_id;
    },
    deploy: (versions, message) => run(['versions', 'deploy', ...versions.map(value => `${value.version_id}@${value.percentage}`), '--env=', '--config', configPath, '--name', 'lingfern', '--message', message, '--yes']),
    verify: (version, pin) => verifyPublicBuild(files, { version, pin, report: row => { if (row.failed) console.error(JSON.stringify(row)); } }),
    verifyRecovery: async expected => {
      const actual = await captureCurrent();
      assert.deepEqual(actual.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })), expected.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })), 'RECOVERY_ENTRY_OR_SW_CHANGED');
    },
  });
}
