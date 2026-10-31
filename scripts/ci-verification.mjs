import assert from 'node:assert/strict';
import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compareScope, githubGet, verifiedBaseline } from './ci-scope.mjs';

export const verificationSteps = ['Run npm ci', 'Run npm run lint', 'Run npm test', 'Run npm run release:files -- /tmp/lingfern-source-export', 'Run npm run build', 'Inspect public build', 'Run npm run deploy:check', 'Run npx playwright install --with-deps chromium', 'Run npm run test:sync', 'Run npm run test:mcp', 'Run npm run test:e2e', 'Run npm run test:offline', 'Run npm run test:update', 'Check local Worker routes and assets'];
export const buildSteps = ['Run npm ci', 'Run npm run lint', 'Check public source', 'Run npm run build', 'Inspect public build', 'Run npm run deploy:check', 'Run npx playwright install --with-deps chromium', 'Check local Worker routes and assets'];
export const fullSteps = [...buildSteps, 'Run npm test', 'Run npm run test:sync', 'Run npm run test:mcp', 'Run npm run test:e2e', 'Run npm run test:offline', 'Service Worker update safety'];
export const uiSteps = [...buildSteps, 'Run safety guards', 'Run scoped UI checks'];

function checksSource(run, repository, sha) {
  return Number.isSafeInteger(run.id) && run.id > 0 && run.repository?.full_name === repository && run.head_sha === sha && run.path?.split('@')[0] === '.github/workflows/checks.yml' && run.name === 'Checks' && ['push', 'workflow_dispatch'].includes(run.event);
}

export function successfulChecks(run, repository, sha) {
  return checksSource(run, repository, sha) && run.status === 'completed' && run.conclusion === 'success';
}

function completedJob(job, run, allowSkipped = false) {
  return job?.name === 'checks' && job.run_id === run.id && job.head_sha === run.head_sha && job.run_attempt === run.run_attempt && job.status === 'completed' && job.conclusion === 'success' && Array.isArray(job.steps) && job.steps.every(step => step.status === 'completed' && (step.conclusion === 'success' || allowSkipped && step.conclusion === 'skipped'));
}

export function fullChecksJob(job, run) {
  return completedJob(job, run) && verificationSteps.every(name => job.steps.some(step => step.name === name));
}

export async function scopedChecksJob(job, run, get, repository) {
  if (!completedJob(job, run, true)) return;
  const markers = job.steps.map(step => /^Verify (docs|ui|full) scope from ([a-f0-9]{40})$/.exec(step.name)).filter(Boolean);
  if (markers.length !== 1) return;
  const [, scope, base] = markers[0];
  const required = ['Select verification scope', markers[0][0], ...(scope === 'full' ? fullSteps : scope === 'ui' ? uiSteps : [])];
  if (!required.every(name => job.steps.some(step => step.name === name && step.conclusion === 'success'))) return;
  if (scope !== 'full') {
    const { workflow_runs: runs } = await get(`/repos/${repository}/actions/runs?head_sha=${base}&per_page=100`);
    assert(Array.isArray(runs) && verifiedBaseline(runs, repository, base), 'Scoped checks need a verified main baseline');
    const expected = await compareScope(get, repository, base, run.head_sha);
    assert.equal(expected.kind, scope, 'Scope does not cover the complete source change');
  }
  return scope;
}

export async function findVerification(get, repository, sha, currentRun) {
  const result = await get(`/repos/${repository}/actions/runs?head_sha=${sha}&per_page=100`);
  assert(Array.isArray(result.workflow_runs));
  const matching = result.workflow_runs.filter(run => run.id !== currentRun && checksSource(run, repository, sha));
  if (matching.some(run => run.status !== 'completed')) return {};
  const updated = run => { const time = Date.parse(run.updated_at); assert(Number.isFinite(time), 'Verification timestamp missing'); return time; };
  // A cached success must not hide later unsuccessful verification.
  const failedAt = Math.max(0, ...matching.filter(run => run.conclusion !== 'success').map(updated));
  const runs = matching.filter(run => successfulChecks(run, repository, sha) && updated(run) > failedAt);
  const main = runs.find(run => run.head_branch === 'main');
  let checkedMain, mainResult;
  if (main) {
    mainResult = await get(`/repos/${repository}/actions/runs/${main.id}/jobs?per_page=100`);
    const { jobs, total_count: count } = mainResult;
    assert(Array.isArray(jobs) && count === jobs.length);
    const job = jobs[0];
    if (jobs.length === 1 && (fullChecksJob(job, main) || completedJob(job, main, true) && job.steps.some(step => step.name === 'Reuse verification for the identical source' && step.conclusion === 'success'))) checkedMain = main.id;
  }
  for (const run of runs) {
    const { jobs, total_count: count } = run === main ? mainResult : await get(`/repos/${repository}/actions/runs/${run.id}/jobs?per_page=100`);
    assert(Array.isArray(jobs) && count === jobs.length);
    // Reused or wholly skipped stages are never independent verification.
    if (jobs.length === 1) {
      const scope = fullChecksJob(jobs[0], run) ? 'full' : await scopedChecksJob(jobs[0], run, get, repository);
      if (scope) return { verified: run.id, scope, main: checkedMain };
    }
  }
  return {};
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const [mode] = process.argv.slice(2);
  assert(process.argv.length === 3 && ['--reuse', '--require-main'].includes(mode));
  const { GITHUB_REPOSITORY: repository, GITHUB_SHA: sha, GITHUB_TOKEN: token, GITHUB_OUTPUT: output, GITHUB_RUN_ID: runId, GITHUB_EVENT_NAME: event, GITHUB_RUN_ATTEMPT: attempt } = process.env;
  assert(/^[a-f0-9]{40}$/.test(sha ?? '') && /^\d+$/.test(runId ?? '') && output);
  const get = githubGet(repository, token);
  let proof = {};
  if (mode === '--require-main') {
    assert(repository === 'euanylin/lingfern' && event === 'workflow_dispatch');
    assert.equal((await get(`/repos/${repository}/git/ref/heads/main`)).object.sha, sha, 'Deploy only the current protected main');
    proof = await findVerification(get, repository, sha, Number(runId));
    assert(proof.verified && proof.main, 'This exact source needs successful scope-appropriate Checks and protected-main Checks before deployment');
  } else if (repository === 'euanylin/lingfern' && event === 'push' && attempt === '1') {
    try { proof = await findVerification(get, repository, sha, Number(runId)); }
    catch { console.warn('Verification evidence unavailable; selecting fresh checks.'); }
  }
  await appendFile(output, `run_id=${proof.verified ?? ''}\nmain_run_id=${proof.main ?? ''}\nscope=${proof.scope ?? 'full'}\n`);
  console.log(JSON.stringify({ source: sha, verifiedChecksRun: proof.verified ?? null, checksScope: proof.scope ?? null, mainChecksRun: proof.main ?? null, freshChecksRequired: !proof.verified }));
}
