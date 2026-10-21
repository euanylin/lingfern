import { createHash } from 'node:crypto';
import { open, mkdir, readdir, readFile, copyFile, lstat, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const excluded = new Set(['backup', '__pycache__', 'output', '.playwright-cli', '.git', 'node_modules', 'dist', '.wrangler', 'private', 'coverage', 'test-results', 'playwright-report', '.DS_Store', '.npmrc', '.netrc', '.ssh', '.aws']);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const omit = name => excluded.has(name) || /^(\.env|\.dev\.vars)(\.|$)/.test(name) || /\.(pem|key|p12|pfx|log|tsbuildinfo)$/.test(name);
const safePath = name => typeof name === 'string' && name.length > 0 && !path.isAbsolute(name) && name.split(/[\\/]/).every(part => part && part !== '.' && part !== '..');

async function chain(backupRoot, name) {
  const snapshots = [];
  const seen = new Set();
  while (name) {
    if (!/^\d{4}-\d{2}-\d{2}T[\d-]+\.\d{3}Z$/.test(name) || seen.has(name)) throw new Error(`Invalid backup chain: ${name}`);
    seen.add(name);
    const manifest = JSON.parse(await readFile(path.join(backupRoot, name, 'manifest.json'), 'utf8'));
    if (!Array.isArray(manifest.files) || ![undefined, 'full', 'incremental'].includes(manifest.kind) || (manifest.kind === 'incremental' && (typeof manifest.parent !== 'string' || !Array.isArray(manifest.deleted)))) throw new Error(`Invalid manifest: ${name}`);
    snapshots.unshift({ name, manifest });
    name = manifest.kind === 'incremental' ? manifest.parent : undefined;
  }
  if (snapshots[0]?.manifest.kind === 'incremental') throw new Error('Missing full backup baseline');
  const state = new Map();
  for (const { name: snapshot, manifest } of snapshots) {
    if (manifest.kind !== 'incremental') state.clear();
    for (const name of manifest.deleted ?? []) { if (!safePath(name)) throw new Error(`Unsafe backup path: ${name}`); state.delete(name); }
    for (const file of manifest.files) {
      if (!safePath(file.path) || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error(`Unsafe backup file: ${file.path}`);
      if (!file.path.split(path.sep).some(omit)) state.set(file.path, { ...file, snapshot });
    }
  }
  return { snapshots, state };
}

async function backupUnlocked(root) {
  const backupRoot = path.join(root, 'backup');
  await mkdir(backupRoot, { recursive: true });
  const candidates = (await readdir(backupRoot, { withFileTypes: true })).filter(entry => entry.isDirectory() && /^\d{4}-/.test(entry.name)).map(entry => entry.name).sort().reverse();
  let previous;
  for (const name of candidates) {
    try { await readFile(path.join(backupRoot, name, 'manifest.json')); previous = name; break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (candidates.length && !previous) throw new Error('No complete backup baseline');
  const prior = previous ? (await chain(backupRoot, previous)).state : new Map();
  const current = new Map();
  async function scan(relative = '') {
    for (const entry of (await readdir(path.join(root, relative))).sort()) {
      if (omit(entry)) continue;
      const name = path.join(relative, entry);
      const stat = await lstat(path.join(root, name));
      if (stat.isSymbolicLink()) throw new Error(`Refusing symlink: ${name}`);
      if (stat.isDirectory()) await scan(name);
      else if (stat.isFile()) current.set(name, { path: name, sha256: hash(await readFile(path.join(root, name))), bytes: stat.size });
      else throw new Error(`Unsupported file: ${name}`);
    }
  }
  await scan();
  const files = [...current.values()].filter(file => prior.get(file.path)?.sha256 !== file.sha256);
  const deleted = [...prior.keys()].filter(name => !current.has(name));
  if (previous && !files.length && !deleted.length) return path.join(backupRoot, previous);
  const createdAt = new Date().toISOString();
  const destination = path.join(backupRoot, createdAt.replaceAll(':', '-'));
  await mkdir(destination); // Keep snapshots immutable.
  for (const file of files) {
    const source = path.join(root, file.path);
    const target = path.join(destination, 'project', file.path);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target);
    if (hash(await readFile(target)) !== file.sha256 || hash(await readFile(source)) !== file.sha256) throw new Error(`File changed during backup: ${file.path}`);
  }
  // Write manifests last so interrupted backups cannot appear complete.
  await writeFile(path.join(destination, 'manifest.json'), JSON.stringify({ createdAt, kind: previous ? 'incremental' : 'full', ...(previous && { parent: previous }), scope: 'Changed project files; excludes secrets, private/, git history, generated dist/, caches and nested backups. Not browser or production data.', files, deleted }, null, 2) + '\n');
  return destination;
}

export async function restore(root, snapshot, target) {
  const { snapshots } = await chain(path.join(root, 'backup'), snapshot);
  await mkdir(target); // Require a new empty restore directory.
  for (const { name, manifest } of snapshots) {
    for (const removed of manifest.deleted ?? []) await rm(path.join(target, removed), { force: true });
    for (const file of manifest.files) {
      if (file.path.split(path.sep).some(omit)) continue;
      const source = path.join(root, 'backup', name, 'project', file.path);
      const targetFile = path.join(target, file.path);
      if (hash(await readFile(source)) !== file.sha256) throw new Error(`Corrupt backup: ${name}/${file.path}`);
      await mkdir(path.dirname(targetFile), { recursive: true });
      await copyFile(source, targetFile);
      if (hash(await readFile(targetFile)) !== file.sha256) throw new Error(`Restore failed: ${file.path}`);
    }
  }
  return target;
}

/** Verify a standalone baseline before explicitly consolidating the old chain. */
async function compactUnlocked(root) {
  const backupRoot = path.join(root, 'backup');
  const old = (await readdir(backupRoot, { withFileTypes: true })).filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T[\d-]+\.\d{3}Z$/.test(entry.name)).map(entry => entry.name).sort();
  let latest;
  for (const name of [...old].reverse()) {
    try { await readFile(path.join(backupRoot, name, 'manifest.json')); latest = name; break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!latest) throw new Error('No backup to compact');
  const { state } = await chain(backupRoot, latest);
  const createdAt = new Date().toISOString();
  const destination = path.join(backupRoot, createdAt.replaceAll(':', '-'));
  await mkdir(destination);
  const files = [];
  for (const file of state.values()) {
    const source = path.join(backupRoot, file.snapshot, 'project', file.path);
    if (!(await lstat(source)).isFile() || hash(await readFile(source)) !== file.sha256) throw new Error(`Corrupt backup: ${file.snapshot}/${file.path}`);
    const target = path.join(destination, 'project', file.path);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target);
    if (hash(await readFile(target)) !== file.sha256) throw new Error(`Compaction failed: ${file.path}`);
    files.push({ path: file.path, sha256: file.sha256, bytes: file.bytes });
  }
  await writeFile(path.join(destination, 'manifest.json'), JSON.stringify({ createdAt, kind: 'full', scope: 'Verified consolidated project baseline; excludes secrets, private data, generated output and caches.', files, deleted: [] }, null, 2) + '\n');
  const verified = await chain(backupRoot, path.basename(destination));
  if (verified.snapshots.length !== 1 || verified.state.size !== files.length) throw new Error('Invalid consolidated baseline');
  // Remove only captured old directories during explicit consolidation.
  for (const name of old) await rm(path.join(backupRoot, name), { recursive: true });
  return destination;
}

// shortcut: one serial project lock; verify ownership before removing any stale lock.
async function locked(root, operation) {
  const folder = path.join(root, 'backup');
  await mkdir(folder, { recursive: true });
  const lock = path.join(folder, '.lock');
  const handle = await open(lock, 'wx');
  try { return await operation(root); }
  finally { await handle.close(); await rm(lock); }
}
export const backup = root => locked(root, backupUnlocked);
export const compact = root => locked(root, compactUnlocked);

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
  console.log(process.argv[2] === '--compact' ? await compact(root) : process.argv[2] === '--restore' ? await restore(root, process.argv[3], path.resolve(process.argv[4])) : await backup(root));
}
