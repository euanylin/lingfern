import assert from 'node:assert/strict';
import { appendFile, readFile, writeFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const browser = names => names.split(' ').map(name => `tests/browser/${name}.spec.ts`);
const controls = browser('desktop-layout nav-display picker modal-surfaces learning-layout reference');
const targets = {
  'style.css': controls,
  'MaterialWorkspace.css': browser('learning-layout reader-ui material-workspace question-sheet-keyboard'),
  'Welcome.tsx': browser('onboarding'), 'Welcome.css': browser('onboarding'),
  'About.tsx': browser('about'), 'aboutCopy.ts': browser('about'), 'GutenbergLicence.tsx': browser('about reference'),
  'Fern.tsx': browser('fern'), 'NavIcon.tsx': browser('nav-display'),
  'PlaybackIcon.tsx': browser('listening'),
  'SettingsPicker.tsx': browser('picker theme-metadata practice-options'),
  'touchFeedback.ts': browser('touch-feedback nav-display'),
  'cardInteraction.ts': browser('touch-feedback task-detail-motion'),
  'scrollbarVisibility.ts': browser('scrollbars'),
  'modal.ts': browser('modal-surfaces question-sheet-keyboard'),
  'useTaskDialog.ts': browser('modal-surfaces task-detail practice-options task-detail-motion'),
  'IpaChart.css': browser('ipa-tables ipa-view-switch'),
};
export const uiTargets = Object.fromEntries(Object.entries(targets).map(([name, tests]) => ['src/app/' + name, tests]));
uiTargets['public/ui-tokens.css'] = controls;
const unitTargets = ['tests/locales.test.ts', 'tests/localeLoading.test.ts', 'tests/fern.test.ts', 'tests/settingsPickerPosition.test.ts'];
const document = name => /\.md$/.test(name) || ['LICENSE', 'NOTICE', 'LICENSES/CC-BY-4.0.txt'].includes(name);
const full = () => ({ kind: 'full', browser: [], units: [] });

export async function classifyChanges(files, read = async () => { throw Error('Missing version snapshots'); }) {
  if (!Array.isArray(files) || files.length >= 300) return full();
  const selected = new Set(), versions = [];
  for (const file of files) {
    if (!file || typeof file.filename !== 'string' || !['added', 'modified', 'removed', 'renamed'].includes(file.status)) return full();
    if (document(file.filename) && (!file.previous_filename || document(file.previous_filename))) continue;
    if (file.status !== 'modified' && file.status !== 'added') return full();
    const name = file.filename;
    if (['package.json', 'package-lock.json'].includes(name) && file.status === 'modified') { versions.push(name); continue; }
    if (uiTargets[name]) { uiTargets[name].forEach(test => selected.add(test)); continue; }
    if (/^src\/locales\/[\w/-]+\.json$/.test(name)) { browser('locales').forEach(test => selected.add(test)); continue; }
    if (Object.values(uiTargets).some(tests => tests.includes(name)) || name === 'tests/browser/locales.spec.ts') { selected.add(name); continue; }
    if (unitTargets.includes(name)) continue;
    return full();
  }
  for (const name of versions) {
    const snapshots = await Promise.all(['base', 'head'].map(async ref => JSON.parse(await read(name, ref))));
    for (const value of snapshots) {
      delete value.version;
      if (name === 'package-lock.json') delete value.packages?.['']?.version;
    }
    if (JSON.stringify(snapshots[0]) !== JSON.stringify(snapshots[1])) return full();
  }
  if (!selected.size && !versions.length && files.every(file => document(file.filename))) return { kind: 'docs', browser: [], units: [] };
  return { kind: 'ui', browser: [...new Set([...browser('desktop-layout'), ...selected])].sort(), units: unitTargets };
}

const shaPattern = /^[a-f0-9]{40}$/;
export function successfulMain(run, repository) {
  return Number.isSafeInteger(run.id) && run.id > 0 && run.repository?.full_name === repository && shaPattern.test(run.head_sha) && run.head_branch === 'main' && run.path?.split('@')[0] === '.github/workflows/checks.yml' && run.name === 'Checks' && ['push', 'workflow_dispatch'].includes(run.event) && run.status === 'completed' && run.conclusion === 'success';
}

export function verifiedBaseline(runs, repository, base) {
  const matching = runs.filter(run => run.head_sha === base && run.head_branch === 'main');
  if (!matching.length || matching.some(run => run.status !== 'completed')) return false;
  for (const run of matching) assert(Number.isFinite(Date.parse(run.updated_at)), 'Missing baseline timestamp');
  matching.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  return successfulMain(matching[0], repository);
}

export async function compareScope(get, repository, base, head) {
  assert(shaPattern.test(base) && shaPattern.test(head));
  const comparison = await get(`/repos/${repository}/compare/${base}...${head}?per_page=1`);
  assert(['ahead', 'identical'].includes(comparison.status) && comparison.merge_base_commit?.sha === base, 'Unverified ancestry');
  const read = async (name, ref) => {
    const result = await get(`/repos/${repository}/contents/${name}?ref=${ref === 'base' ? base : head}`);
    assert(result.encoding === 'base64' && result.size < 2 * 1024 * 1024);
    return Buffer.from(result.content, 'base64').toString('utf8');
  };
  return classifyChanges(comparison.files, read);
}

export async function selectScope(get, repository, head) {
  const { workflow_runs: runs } = await get(`/repos/${repository}/actions/workflows/checks.yml/runs?branch=main&per_page=100`);
  assert(Array.isArray(runs));
  const baseline = runs.find(run => run.head_sha !== head && run.head_branch === 'main');
  assert(baseline && verifiedBaseline(runs, repository, baseline.head_sha), 'No verified main baseline');
  return { ...await compareScope(get, repository, baseline.head_sha, head), base: baseline.head_sha };
}

export function githubGet(repository, token) {
  assert(/^[\w.-]+\/[\w.-]+$/.test(repository));
  return async pathname => {
    assert(token && pathname.startsWith(`/repos/${repository}/`) && !pathname.includes('..' + '/'));
    const response = await fetch('https://api.github.com' + pathname, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, redirect: 'error', signal: AbortSignal.timeout(15000) });
    assert(response.ok, `Verification metadata unavailable (${response.status})`);
    return response.json();
  };
}

export function canScope(repository, event, attempt, headRepository, baseRef) {
  return repository === 'euanylin/lingfern' && attempt === '1' && (event === 'push' || event === 'pull_request' && headRepository === repository && baseRef === 'main');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const [mode] = process.argv.slice(2), file = resolve(process.env.RUNNER_TEMP ?? '/tmp', 'lingfern-ci-plan.json');
  assert(process.argv.length === 3 && ['--select', '--assert', '--run-ui'].includes(mode));
  if (mode === '--select') {
    let plan = { ...full(), base: '0'.repeat(40) };
    const { GITHUB_REPOSITORY: repository, GITHUB_SHA: head, GITHUB_TOKEN: token, GITHUB_EVENT_NAME: event, GITHUB_RUN_ATTEMPT: attempt } = process.env;
    assert(shaPattern.test(head));
    if (canScope(repository, event, attempt, process.env.CI_HEAD_REPOSITORY, process.env.GITHUB_BASE_REF)) {
      try { plan = await selectScope(githubGet(repository, token), repository, head); }
      catch { console.warn('Scope evidence unavailable; running full checks.'); }
    }
    await writeFile(file, JSON.stringify({ ...plan, head }));
    await appendFile(process.env.GITHUB_OUTPUT, `kind=${plan.kind}\nbase=${plan.base}\n`);
    console.log(JSON.stringify({ ...plan, head }));
  } else {
    const plan = JSON.parse(await readFile(file, 'utf8'));
    assert(plan.head === process.env.GITHUB_SHA && shaPattern.test(plan.base) && ['docs', 'ui', 'full'].includes(plan.kind));
    if (mode === '--run-ui') {
      assert(plan.kind === 'ui' && plan.browser.length && plan.units.length);
      for (const name of [...plan.browser, ...plan.units]) { assert(/^tests\/[\w/.-]+\.(spec\.ts|test\.ts)$/.test(name)); await access(name); }
      for (const args of [['vitest', 'run', ...plan.units], ['playwright', 'test', ...plan.browser]]) {
        const result = spawnSync('npm', ['exec', '--', ...args], { stdio: 'inherit' });
        assert.equal(result.status, 0, 'Scoped regression failed');
      }
    }
  }
}
