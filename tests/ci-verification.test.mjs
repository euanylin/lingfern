import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { successfulChecks, fullChecksJob, findVerification, verificationSteps } from '../scripts/ci-verification.mjs';

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
  assert.deepEqual(await findVerification(get, repository, sha, 99), { full: 1, main: undefined });
  for (const conclusion of ['cancelled', 'timed_out', 'action_required']) {
    failed.conclusion = conclusion; refresh = false;
    assert.deepEqual(await findVerification(get, repository, sha, 99), {});
  }
});

test('another unfinished verification blocks reuse and manual full verification remains valid', async () => {
  const pending = { ...run, id: 2, status: 'in_progress', conclusion: null };
  const get = async path => path.includes('?head_sha=') ? { workflow_runs: [pending, { ...run, event: 'workflow_dispatch', head_branch: 'main' }] } : { total_count: 1, jobs: [job] };
  assert.deepEqual(await findVerification(get, repository, sha, 99), {});
  assert.deepEqual(await findVerification(get, repository, sha, 2), { full: 1, main: 1 });
});

test('full proof rejects skipped, missing, failed, foreign and incomplete stages', () => {
  assert(fullChecksJob(job, run));
  for (const change of [{ name: 'deploy' }, { run_id: 2 }, { head_sha: 'b'.repeat(40) }, { run_attempt: 2 }, { conclusion: 'failure' }, { steps: job.steps.slice(1) }, { steps: job.steps.map((step, index) => index ? step : { ...step, conclusion: 'skipped' }) }, { steps: [...job.steps, { name: 'extra', status: 'in_progress', conclusion: null }] }]) assert(!fullChecksJob({ ...job, ...change }, run));
});

test('reused main success needs an independent full run for the identical source', async () => {
  const main = { ...run, id: 2, head_branch: 'main' }, reused = { ...job, run_id: 2, steps: job.steps.map(step => ({ ...step, conclusion: 'skipped' })) };
  const get = async path => path.includes('?head_sha=') ? { workflow_runs: [main, run] } : { total_count: 1, jobs: [path.includes('/runs/2/') ? reused : job] };
  assert.deepEqual(await findVerification(get, repository, sha, 99), { full: 1, main: 2 });
  assert.deepEqual(await findVerification(get, repository, sha, 1), {});
  assert.deepEqual(await findVerification(async () => ({ workflow_runs: [{ ...run, head_sha: 'b'.repeat(40) }] }), repository, sha, 99), {});
  await assert.rejects(findVerification(async () => { throw Error('API unavailable'); }, repository, sha, 99));
});

test('workflow stages agree with the verification contract and deployment gate precedes upload', async () => {
  const checks = await readFile(new URL('../.github/workflows/checks.yml', import.meta.url), 'utf8');
  const blocks = checks.split(/\n      - /).slice(1);
  for (const name of verificationSteps) {
    const block = blocks.find(value => value.startsWith(`name: ${name}\n`) || value.startsWith(`run: ${name.slice(4)}\n`) && name.startsWith('Run '));
    assert(block, name);
    assert(block.includes("if: steps.verification.outputs.run_id == ''"), name);
  }
  const deploy = await readFile(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  const gate = deploy.indexOf('node scripts/ci-verification.mjs --require-main');
  assert(gate >= 0 && gate < deploy.indexOf('npx wrangler deploy'));
  assert(deploy.includes('environment: production') && deploy.includes("github.ref == 'refs/heads/main'"));
});

test('forks, pull requests and unavailable credentials fall back to full checks; foreign deployment is denied', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'lingfern-ci-proof-'));
  try {
    for (const [index, repo, event, mode, accepted] of [[0, 'other/repo', 'push', '--reuse', true], [1, repository, 'pull_request', '--reuse', true], [2, repository, 'push', '--reuse', true], [3, 'other/repo', 'workflow_dispatch', '--require-main', false], [4, repository, 'push', '--reuse', true]]) {
      const output = join(temp, String(index));
      const child = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/ci-verification.mjs', import.meta.url)), mode], { env: { ...process.env, GITHUB_REPOSITORY: repo, GITHUB_EVENT_NAME: event, GITHUB_SHA: sha, GITHUB_RUN_ID: '99', GITHUB_RUN_ATTEMPT: index === 4 ? '2' : '1', GITHUB_OUTPUT: output, GITHUB_TOKEN: '' }, timeout: 5000 });
      assert.equal(child.status === 0, accepted);
      if (accepted) assert.equal(await readFile(output, 'utf8'), 'run_id=\nmain_run_id=\n');
      if (index === 4) assert.equal(child.stderr.toString(), '');
    }
  } finally { await rm(temp, { recursive: true }); }
});
