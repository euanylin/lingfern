import assert from 'node:assert/strict';
import { test } from 'node:test';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { classifyChanges, uiTargets, selectScope, compareScope, canScope } from '../scripts/ci-scope.mjs';

const changed = (...names) => names.map(filename => ({ filename, status: 'modified' }));
const base = 'a'.repeat(40), head = 'b'.repeat(40), repository = 'euanylin/lingfern';
const baseline = { id: 10, repository: { full_name: repository }, head_sha: base, head_branch: 'main', path: '.github/workflows/checks.yml', name: 'Checks', event: 'push', status: 'completed', conclusion: 'success', updated_at: '2026-10-26T00:00:00Z' };

test('same-repository pull requests may be scoped; forks, manual runs and reruns may not', () => {
  assert(canScope(repository, 'push', '1'));
  assert(canScope(repository, 'pull_request', '1', repository, 'main'));
  for (const args of [[repository, 'pull_request', '1', 'foreign/fork', 'main'], [repository, 'pull_request', '1', repository, 'other'], [repository, 'pull_request', '1'], [repository, 'workflow_dispatch', '1'], [repository, 'push', '2'], ['foreign/fork', 'push', '1']]) assert(!canScope(...args));
});

test('documents need no application checks; UI selects real callers and regression tests', async () => {
  assert.deepEqual(await classifyChanges(changed('README.md', 'AGENTS.md', 'docs/user-guide.md')), { kind: 'docs', browser: [], units: [] });
  const plan = await classifyChanges(changed('src/app/modal.ts', 'AGENT_WORKFLOW.md'));
  assert.equal(plan.kind, 'ui');
  assert(plan.browser.includes('tests/browser/modal-surfaces.spec.ts') && plan.browser.includes('tests/browser/desktop-layout.spec.ts'));
  for (const name of [...plan.browser, ...plan.units, ...Object.values(uiTargets).flat()]) await access(name);
  const translated = await classifyChanges(changed('src/locales/ar/ui.json', 'tests/locales.test.ts'));
  assert.equal(translated.kind, 'ui'); assert(translated.browser.includes('tests/browser/locales.spec.ts'));
});

test('safety, storage, shared contracts, resources, build and unknown paths retain full checks', async () => {
  for (const name of ['src/data/db.ts', 'src/data/sync.ts', 'src/shared/contracts.ts', 'src/sw.ts', 'worker/auth.ts', 'worker/migrations/new.sql', '.github/workflows/checks.yml', 'scripts/ci-scope.mjs', 'src/app/App.tsx', 'src/app/ProfileBackup.tsx', 'src/app/MaterialWorkspace.tsx', 'src/app/GithubIdentity.tsx', 'src/locales/index.ts', 'public/source-packs/a.zip', 'content/corpus/a.json', 'vite.config.ts', 'playwright.config.ts', 'wrangler.jsonc', '.nvmrc', 'new-feature.ts']) {
    assert.equal((await classifyChanges(changed('src/app/modal.ts', name))).kind, 'full', name);
  }
  assert.equal((await classifyChanges(Array.from({ length: 300 }, () => changed('README.md')[0]))).kind, 'full');
  assert.equal((await classifyChanges(undefined)).kind, 'full');
  assert.equal((await classifyChanges([{ filename: 'README.md', status: 'unknown' }])).kind, 'full');
});

test('renaming/deleting executable code cannot be disguised as documentation or safe UI', async () => {
  for (const file of [{ filename: 'README.md', previous_filename: 'worker/auth.ts', status: 'renamed' }, { filename: 'src/app/modal.ts', status: 'removed' }, { filename: 'src/app/About.tsx', previous_filename: 'worker/auth.ts', status: 'renamed' }]) assert.equal((await classifyChanges([file])).kind, 'full');
});

test('version-only release metadata stays scoped; scripts/dependency/lock changes do not', async () => {
  const old = { version: '0.1.147', scripts: { test: 'unchanged' }, packages: { '': { version: '0.1.147' }, dependency: { version: '1.0.0' } } };
  let next = structuredClone(old);next.version = '0.1.148';next.packages[''].version = '0.1.148';
  const read = async (name, ref) => JSON.stringify(ref === 'base' ? old : name === 'package-lock.json' ? next : { ...next, packages: old.packages });
  assert.equal((await classifyChanges(changed('src/app/modal.ts', 'package.json', 'package-lock.json'), read)).kind, 'ui');
  next.scripts.test = 'skip everything';
  assert.equal((await classifyChanges(changed('package.json'), read)).kind, 'full');
  next = structuredClone(old);next.packages.dependency.version = '2.0.0';
  assert.equal((await classifyChanges(changed('package-lock.json'), read)).kind, 'full');
  await assert.rejects(classifyChanges(changed('package.json'), async () => '{'), SyntaxError);
});

test('scope uses the entire change since verified main, never just the last UI commit', async () => {
  let files = changed('src/app/modal.ts', 'src/data/db.ts');
  const get = async path => path.includes('/compare/') ? { status: 'ahead', merge_base_commit: { sha: base }, files } : { workflow_runs: [{ ...baseline, head_branch: 'codex/unverified' }, baseline] };
  assert.equal((await selectScope(get, repository, head)).kind, 'full');
  files = changed('src/app/modal.ts');
  assert.equal((await selectScope(get, repository, head)).kind, 'ui');
  await assert.rejects(selectScope(async () => ({ workflow_runs: [] }), repository, head), /No verified main baseline/);
  for (const change of [{ conclusion: 'failure' }, { status: 'in_progress', conclusion: null }]) await assert.rejects(selectScope(async () => ({ workflow_runs: [{ ...baseline, ...change }, baseline] }), repository, head), /No verified main baseline/);
  await assert.rejects(selectScope(async () => ({ workflow_runs: [baseline, { ...baseline, id: 5, conclusion: 'failure', updated_at: '2026-10-26T00:00:01Z' }] }), repository, head), /No verified main baseline/);
  await assert.rejects(compareScope(async () => ({ status: 'diverged', merge_base_commit: { sha: base }, files }), repository, base, head), /Unverified ancestry/);
});

test('forks/manual runs/reruns/missing API evidence safely select full verification', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lingfern-ci-scope-'));
  try {
    for (const [repo, event, attempt] of [['other/repo', 'push', '1'], [repository, 'pull_request', '1'], [repository, 'workflow_dispatch', '1'], [repository, 'push', '2'], [repository, 'push', '1']]) {
      const output = join(folder, 'output');
      const child = spawnSync(process.execPath, ['scripts/ci-scope.mjs', '--select'], { env: { ...process.env, RUNNER_TEMP: folder, GITHUB_OUTPUT: output, GITHUB_REPOSITORY: repo, GITHUB_SHA: head, GITHUB_EVENT_NAME: event, GITHUB_RUN_ATTEMPT: attempt, GITHUB_TOKEN: '' }, timeout: 5000 });
      assert.equal(child.status, 0, child.stderr.toString());
      assert.equal(JSON.parse(await readFile(join(folder, 'lingfern-ci-plan.json'), 'utf8')).kind, 'full');
    }
  } finally { await rm(folder, { recursive: true }); }
});
