import { readdir, readFile, lstat, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';

// Export only reviewed source/build inputs; local originals and evidence are never upload inputs.
const roots = ['src', 'worker', 'scripts', 'tests', 'public', 'content', 'docs', '.github'];
const files = ['LICENSE', 'NOTICE', 'LICENSING.md', 'BRAND.md', 'LICENSES/CC-BY-4.0.txt', 'backup/README.md', '.gitignore', '.nvmrc', 'AGENTS.md', 'AGENT_WORKFLOW.md', 'DEVELOPMENT_GOAL.md', 'DEVELOPMENT_HANDOFF.md', 'IMPLEMENTATION_STATUS.md', 'Issues.md', 'Product_Plan.md', 'Interface_Design.md', 'README.md', 'Dependency_Notices.md', 'community-content.md', 'design-qa.md', 'UI_Consistency_Audit.md', 'package.json', 'package-lock.json', 'tsconfig.json', 'eslint.config.mjs', 'index.html', 'vite.config.ts', 'playwright.config.ts', 'playwright.offline.config.ts', 'worker-configuration.d.ts', 'wrangler.jsonc'];
export function allowed(name) {
  if (name === 'backup/README.md' || name === 'docs/history/README.md') return true;
  if ((name === 'logo' || name.startsWith('logo/')) || name === 'public/logo' || name.startsWith('public/logo/')) return false;
  const parts = name.split('/');
  return !path.isAbsolute(name) && !name.includes('\\') && parts.every(part => part && !['.', '..', 'Signature', 'raw', 'private', 'backup', 'node_modules', 'dist', 'output', 'test-results', 'playwright-report', '.git', '.wrangler', '__pycache__', '.DS_Store'].includes(part) && !/^(\.env|\.dev\.vars)(\.|$)/.test(part) && !/\.(pem|key|p12|pfx|log|tsbuildinfo|m4a|rds|csv|har|zip\.bak)$/i.test(part)) && (files.includes(name) || roots.includes(parts[0])) && !name.startsWith('docs/history/');
}
export async function inventory(base) {
  const entries = [];
  async function visit(name) {
    if (!allowed(name)) return;
    const info = await lstat(path.join(base, name));
    assert(!info.isSymbolicLink(), `Refusing symlink: ${name}`);
    if (info.isDirectory()) for (const child of (await readdir(path.join(base, name))).sort()) await visit(`${name}/${child}`);
    else {
      assert(info.isFile(), `Refusing nonfile: ${name}`);
      const bytes = await readFile(path.join(base, name));
      // Do not print matching content. Synthetic tokens in tests are allowed; real credential signatures are not.
      assert(!/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{60,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sk-proj-[A-Za-z0-9_-]{30,})/.test(bytes.toString('utf8')), `Credential signature: ${name}`);
      entries.push({ path: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
  }
  for (const name of [...files, ...roots]) await visit(name);
  return entries.sort((a,b) => a.path.localeCompare(b.path));
}
if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const target = process.argv[2];
  if (target === '--check') {
    const entries = await inventory(process.cwd());
    console.log(`Checked ${entries.length} public source files without copying them`);
    process.exit(0);
  }
  assert(target && path.isAbsolute(target), 'Provide a new absolute local export directory');
  const entries = await inventory(process.cwd());
  await mkdir(target); // Never overwrite an export or source directory.
  for (const entry of entries) { const to=path.join(target,entry.path); await mkdir(path.dirname(to),{recursive:true}); await copyFile(entry.path,to); assert.equal(createHash('sha256').update(await readFile(to)).digest('hex'),entry.sha256); }
  await writeFile(path.join(target,'release-files.json'),JSON.stringify({version:1,scope:'Source/build/portable tests only. Raw sources/private evidence excluded; run the separate source-evidence suite in its retained local environment. No upload or deployment.',files:entries},null,2)+'\n');
  console.log(`Verified ${entries.length} source files in ${target}`);
}
