import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { successfulChecks, fullChecksJob, findVerification, verificationSteps, fullSteps, uiSteps, scopedChecksJob } from '../scripts/ci-verification.mjs';

const repository = 'euanylin/lingfern', sha = 'a'.repeat(40);
const run = { id: 1, repository: { full_name: repository }, head_sha: sha, head_branch: 'codex/repair', path: '.github/workflows/checks.yml', name: 'Checks', event: 'push', status: 'completed', conclusion: 'success', run_attempt: 1, updated_at: '2026-10-24T00:00:01Z' };
const job = { name: 'checks', run_id: 1, head_sha: sha, run_attempt: 1, status: 'completed', conclusion: 'success', steps: verificationSteps.map(name => ({ name, status: 'completed', conclusion: 'success' })) };

test('verification accepts only the exact repository, commit and successful push/manual workflow', () => {
  assert(successfulChecks(run, repository, sha));
  assert(successfulChecks({ ...run, event: 'workflow_dispatch' }, repository, sha));
  for (const change of [{ id: 0 }, { repository: { full_name: 'other/repo' } }, { head_sha: 'b'.repeat(40) }, { path: '.github/workflows/deploy.yml' }, { name: 'Other' }, { event: 'pull_request' }, { status: 'in_progress' }, { conclusion: 'failure' }]) assert(!successfulChecks({ ...run, ...change }, repository, sha));
});

test('later unsuccessful checks invalidate old success until fresh full checks pass', async () => {
  const failed = { ...run, id: 3, conclusion: 'failure', updated_at: '2026-10-24T00:00:02Z' };
  let refresh = false;
  const get = async path => path.includes('?head_sha=') ? { workflow_runs: [failed, refresh ? { ...run, updated_at: '2026-10-24T00:00:03Z' } : run] } : { total_count: 1, jobs: [job] };
  assert.deepEqual(await findVerification(get, repository, sha, 99), {});
  refresh = true;
  assert.deepEqual(await findVerification(get, repository, sha, 99), { verified: 1, scope: 'full', main: undefined });
  for (const conclusion of ['cancelled', 'timed_out', 'action_required']) {
    failed.conclusion = conclusion; refresh = false;
    assert.deepEqual(await findVerification(get, repository, sha, 99), {});
  }
});

test('another unfinished verification blocks reuse and manual full verification remains valid', async () => {
  const pending = { ...run, id: 2, status: 'in_progress', conclusion: null };
  const get = async path => path.includes('?head_sha=') ? { workflow_runs: [pending, { ...run, event: 'workflow_dispatch', head_branch: 'main' }] } : { total_count: 1, jobs: [job] };
  assert.deepEqual(await findVerification(get, repository, sha, 99), {});
  assert.deepEqual(await findVerification(get, repository, sha, 2), { verified: 1, scope: 'full', main: 1 });
});

test('main job evidence is read once per verification and refreshed by the next invocation', async () => {
  const main = { ...run, head_branch: 'main' }, requests = [];
  let failed = false;
  const get = async path => {
    requests.push(path);
    if (path.includes('?head_sha=')) return { workflow_runs: [main] };
    assert.equal(path, `/repos/${repository}/actions/runs/${main.id}/jobs?per_page=100`);
    return { total_count: 1, jobs: [failed ? { ...job, conclusion: 'failure' } : job] };
  };
  assert.deepEqual(await findVerification(get, repository, sha, 99), { verified: 1, scope: 'full', main: 1 });
  assert.equal(requests.filter(path => path.includes('/jobs?')).length, 1);
  failed = true;
  assert.deepEqual(await findVerification(get, repository, sha, 99), {});
  assert.equal(requests.filter(path => path.includes('/jobs?')).length, 2);
});

test('full proof rejects skipped, missing, failed, foreign and incomplete stages', () => {
  assert(fullChecksJob(job, run));
  for (const change of [{ name: 'deploy' }, { run_id: 2 }, { head_sha: 'b'.repeat(40) }, { run_attempt: 2 }, { conclusion: 'failure' }, { steps: job.steps.slice(1) }, { steps: job.steps.map((step, index) => index ? step : { ...step, conclusion: 'skipped' }) }, { steps: [...job.steps, { name: 'extra', status: 'in_progress', conclusion: null }] }]) assert(!fullChecksJob({ ...job, ...change }, run));
});

test('reused main success needs an independent full run for the identical source', async () => {
  const main = { ...run, id: 2, head_branch: 'main' }, reused = { ...job, run_id: 2, steps: [{ name: 'Reuse verification for the identical source', status: 'completed', conclusion: 'success' }, ...job.steps.map(step => ({ ...step, conclusion: 'skipped' }))] };
  const get = async path => path.includes('?head_sha=') ? { workflow_runs: [main, run] } : { total_count: 1, jobs: [path.includes('/runs/2/') ? reused : job] };
  assert.deepEqual(await findVerification(get, repository, sha, 99), { verified: 1, scope: 'full', main: 2 });
  reused.steps[0].conclusion = 'skipped';
  assert.deepEqual(await findVerification(get, repository, sha, 99), { verified: 1, scope: 'full', main: undefined });
  reused.steps[0].conclusion = 'success';
  assert.deepEqual(await findVerification(get, repository, sha, 1), {});
  assert.deepEqual(await findVerification(async () => ({ workflow_runs: [{ ...run, head_sha: 'b'.repeat(40) }] }), repository, sha, 99), {});
  await assert.rejects(findVerification(async () => { throw Error('API unavailable'); }, repository, sha, 99));
});

test('automatic Checks cover main pushes and main pull requests without skipping the required job', async () => {
  const checks = await readFile(new URL('../.github/workflows/checks.yml', import.meta.url), 'utf8');
  const triggers = checks.match(/^on:\n([\s\S]*?)(?=^\S)/m)?.[1].trimEnd();
  assert.equal(triggers, '  workflow_dispatch:\n  push:\n    branches: [main]\n  pull_request:\n    branches: [main]');
  const permissions = checks.match(/^permissions:\n([\s\S]*?)(?=^\S)/m)?.[1].trimEnd();
  assert.equal(permissions, '  contents: read\n  actions: read');
  assert(!/^    (?:if|permissions):/m.test(checks));
  assert(checks.includes('group: checks-${{ github.ref }}'));
  assert(checks.includes("cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}"));
  assert(checks.includes('persist-credentials: false'));
  assert(!checks.includes('pull_request_target:') && !checks.includes('secrets.'));
});

test('workflow stages agree with the verification contract and deployment gate precedes upload', async () => {
  const checks = await readFile(new URL('../.github/workflows/checks.yml', import.meta.url), 'utf8');
  const blocks = checks.split(/\n      - /).slice(1);
  for (const name of [...new Set([...fullSteps, ...uiSteps])]) {
    const block = blocks.find(value => value.startsWith(`name: ${name}\n`) || value.startsWith(`run: ${name.slice(4)}\n`) && name.startsWith('Run '));
    assert(block, name);
    assert(block.includes("if: steps.verification.outputs.run_id == '' && steps.scope.outputs.kind"), name);
    assert(!block.includes('continue-on-error'), name);
  }
  const deploy = await readFile(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  const gate = deploy.indexOf('node scripts/ci-verification.mjs --require-main');
  assert(gate >= 0 && gate < deploy.indexOf('node scripts/deploy-verified.mjs'));
  assert(deploy.includes('environment: production') && deploy.includes("github.ref == 'refs/heads/main'"));
  assert(gate < deploy.indexOf('- run: npm ci'));
  assert(checks.includes("cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}"));
  assert(!checks.includes('paths-ignore:') && !checks.includes('pull_request_target:'));
  assert(checks.includes('run: node tests/sw-update.mjs') && !checks.includes('run: npm run test:update'));
  const deployBlocks = deploy.split(/\n      - /).slice(1);
  for (const name of ['Run npm ci', 'Check public source', 'Run npm run build', 'Deploy the checked source and assets']) {
    const block = deployBlocks.find(value => value.startsWith(`name: ${name}\n`) || name.startsWith('Run ') && value.startsWith(`run: ${name.slice(4)}\n`));
    assert(block?.includes("if: steps.verification.outputs.scope != 'docs'"), name);
  }
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts.deploy, 'node scripts/deploy-verified.mjs /tmp/lingfern-ci-deployment.json');
});

test('forks, pull requests and unavailable credentials fall back to full checks; foreign deployment is denied', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'lingfern-ci-proof-'));
  try {
    for (const [index, repo, event, mode, accepted] of [[0, 'other/repo', 'push', '--reuse', true], [1, repository, 'pull_request', '--reuse', true], [2, repository, 'push', '--reuse', true], [3, 'other/repo', 'workflow_dispatch', '--require-main', false], [4, repository, 'push', '--reuse', true]]) {
      const output = join(temp, String(index));
      const child = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/ci-verification.mjs', import.meta.url)), mode], { env: { ...process.env, GITHUB_REPOSITORY: repo, GITHUB_EVENT_NAME: event, GITHUB_SHA: sha, GITHUB_RUN_ID: '99', GITHUB_RUN_ATTEMPT: index === 4 ? '2' : '1', GITHUB_OUTPUT: output, GITHUB_TOKEN: '' }, timeout: 5000 });
      assert.equal(child.status === 0, accepted);
      if (accepted) assert.equal(await readFile(output, 'utf8'), 'run_id=\nmain_run_id=\nscope=full\n');
      if (index === 4) assert.equal(child.stderr.toString(), '');
    }
  } finally { await rm(temp, { recursive: true }); }
});

test('scoped proof reclassifies all changes against an independently successful main', async () => {
  const base = 'b'.repeat(40), baseline = { ...run, id: 10, head_branch: 'main', head_sha: base };
  const scoped = kind => ({ ...job, steps: ['Select verification scope', `Verify ${kind} scope from ${base}`, ...(kind === 'ui' ? uiSteps : kind === 'full' ? fullSteps : [])].map(name => ({ name, status: 'completed', conclusion: 'success' })) });
  let files = [{ filename: 'README.md', status: 'modified' }], main = baseline;
  const get = async path => path.includes('compare/') ? { status: 'ahead', merge_base_commit: { sha: base }, files } : { workflow_runs: [main] };
  assert.equal(await scopedChecksJob(scoped('docs'), run, get, repository), 'docs');
  files = [{ filename: 'src/app/modal.ts', status: 'modified' }];
  assert.equal(await scopedChecksJob(scoped('ui'), run, get, repository), 'ui');
  await assert.rejects(scopedChecksJob(scoped('docs'), run, get, repository), /complete source change/);
  files.push({ filename: 'src/data/db.ts', status: 'modified' });
  await assert.rejects(scopedChecksJob(scoped('ui'), run, get, repository), /complete source change/);
  assert.equal(await scopedChecksJob(scoped('full'), run, () => { throw Error('Full checks need no scope API'); }, repository), 'full');
  main = { ...baseline, head_branch: 'codex/fake' };
  await assert.rejects(scopedChecksJob(scoped('docs'), run, get, repository), /verified main baseline/);
});

test('missing, skipped or failed required scoped stages cannot become verified proof', async () => {
  const fullJob = { ...job, steps: ['Select verification scope', `Verify full scope from ${'0'.repeat(40)}`, ...fullSteps].map(name => ({ name, status: 'completed', conclusion: 'success' })) };
  assert.equal(await scopedChecksJob(fullJob, run), 'full');
  for (const conclusion of ['skipped', 'failure', 'cancelled']) {
    for (let index = 0; index < fullJob.steps.length; index++) {
      const steps = fullJob.steps.map((step, i) => i === index ? { ...step, conclusion } : step);
      assert.equal(await scopedChecksJob({ ...fullJob, steps }, run), undefined);
    }
  }
  assert.equal(await scopedChecksJob({ ...fullJob, steps: fullJob.steps.slice(1) }, run), undefined);
  assert.equal(await scopedChecksJob({ ...fullJob, steps: [...fullJob.steps, fullJob.steps[1]] }, run), undefined);
});

test('a real scoped branch proof and exact-source main reuse satisfy the deployment gate', async () => {
  const base = 'b'.repeat(40), baseline = { ...run, id: 10, head_sha: base, head_branch: 'main' };
  const main = { ...run, id: 2, head_branch: 'main' };
  const scoped = { ...job, steps: ['Select verification scope', `Verify ui scope from ${base}`, ...uiSteps].map(name => ({ name, status: 'completed', conclusion: 'success' })) };
  const reused = { ...job, run_id: main.id, steps: [{ name: 'Reuse verification for the identical source', status: 'completed', conclusion: 'success' }] };
  const get = async path => {
    if (path.includes('/compare/')) return { status: 'ahead', merge_base_commit: { sha: base }, files: [{ filename: 'src/app/modal.ts', status: 'modified' }] };
    if (path.includes('head_sha=' + base)) return { workflow_runs: [baseline] };
    if (path.includes('?head_sha=')) return { workflow_runs: [main, run] };
    return { total_count: 1, jobs: [path.includes('/runs/2/') ? reused : scoped] };
  };
  assert.deepEqual(await findVerification(get, repository, sha, 99), { verified: 1, scope: 'ui', main: 2 });
  scoped.steps.find(step => step.name === 'Run safety guards').conclusion = 'skipped';
  assert.deepEqual(await findVerification(get, repository, sha, 99), {});
});
