import assert from 'node:assert/strict';
import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const verificationSteps = ['Run npm ci', 'Run npm run lint', 'Run npm test', 'Run npm run release:files -- /tmp/lingfern-source-export', 'Run npm run build', 'Inspect public build', 'Run npm run deploy:check', 'Run npx playwright install --with-deps chromium', 'Run npm run test:sync', 'Run npm run test:mcp', 'Run npm run test:e2e', 'Run npm run test:offline', 'Run npm run test:update', 'Check local Worker routes and assets'];

function checksSource(run, repository, sha) {
  return Number.isSafeInteger(run.id) && run.id > 0 && run.repository?.full_name === repository && run.head_sha === sha && run.path?.split('@')[0] === '.github/workflows/checks.yml' && run.name === 'Checks' && ['push', 'workflow_dispatch'].includes(run.event);
}

export function successfulChecks(run, repository, sha) {
  return checksSource(run, repository, sha) && run.status === 'completed' && run.conclusion === 'success';
}

export function fullChecksJob(job, run) {
  return job.name === 'checks' && job.run_id === run.id && job.head_sha === run.head_sha && job.run_attempt === run.run_attempt && job.status === 'completed' && job.conclusion === 'success' && Array.isArray(job.steps) && job.steps.every(step => step.status === 'completed' && step.conclusion === 'success') && verificationSteps.every(name => job.steps.some(step => step.name === name));
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
  for (const run of runs) {
    const { jobs, total_count: count } = await get(`/repos/${repository}/actions/runs/${run.id}/jobs?per_page=100`);
    assert(Array.isArray(jobs) && count === jobs.length);
    // A reused success is not itself evidence that the full suite ran.
    if (jobs.length === 1 && fullChecksJob(jobs[0], run)) return { full: run.id, main: main?.id };
  }
  return {};
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const [mode] = process.argv.slice(2);
  assert(process.argv.length === 3 && ['--reuse', '--require-main'].includes(mode));
  const { GITHUB_REPOSITORY: repository, GITHUB_SHA: sha, GITHUB_TOKEN: token, GITHUB_OUTPUT: output, GITHUB_RUN_ID: runId, GITHUB_EVENT_NAME: event, GITHUB_RUN_ATTEMPT: attempt } = process.env;
  assert(/^[a-f0-9]{40}$/.test(sha ?? '') && /^\d+$/.test(runId ?? '') && output);
  const get = async path => {
    assert(token && (path.startsWith(`/repos/${repository}/actions/`) || path === `/repos/${repository}/git/ref/heads/main`));
    const response = await fetch(`https://api.github.com${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, redirect: 'error', signal: AbortSignal.timeout(15000) });
    assert(response.ok, `Verification metadata unavailable (${response.status})`);
    return response.json();
  };
  let proof = {};
  if (mode === '--require-main') {
    assert(repository === 'euanylin/lingfern' && event === 'workflow_dispatch');
    assert.equal((await get(`/repos/${repository}/git/ref/heads/main`)).object.sha, sha, 'Deploy only the current protected main');
    proof = await findVerification(get, repository, sha, Number(runId));
    assert(proof.full && proof.main, 'This exact source needs successful full Checks and protected-main Checks before deployment');
  } else if (repository === 'euanylin/lingfern' && event === 'push' && attempt === '1') {
    try { proof = await findVerification(get, repository, sha, Number(runId)); }
    catch { console.warn('Verification evidence unavailable; running the full checks.'); }
  }
  await appendFile(output, `run_id=${proof.full ?? ''}\nmain_run_id=${proof.main ?? ''}\n`);
  console.log(JSON.stringify({ source: sha, fullChecksRun: proof.full ?? null, mainChecksRun: proof.main ?? null, fullChecksRequired: !proof.full }));
}
