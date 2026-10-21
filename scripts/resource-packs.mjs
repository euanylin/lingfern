import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { zipSync } from 'fflate';

const publicRoot = process.env.LINGFERN_RESOURCE_PUBLIC_ROOT ?? 'public';
const catalogueRoot = process.env.LINGFERN_RESOURCE_CATALOGUE_ROOT ?? 'content';
const catalogue = JSON.parse(await readFile(join(catalogueRoot, 'offline-resources.json'), 'utf8'));
const output = join(publicRoot, 'packs');
const cataloguePath = join(catalogueRoot, 'resource-packs.json');
const previousContent = await readFile(cataloguePath, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
const previous = previousContent ? JSON.parse(previousContent).packs : [];
await mkdir(output, { recursive: true });
const packs = [];
for (const group of catalogue.groups) {
  const manifest = { format: 'lingfern-public-resources', version: 1, groupId: group.id, groupVersion: group.version, files: group.files };
  // Preserve published 08:00 ZIP wall-time fields in every timezone.
  const mtime = new Date(1980, 0, 1, 8);
  const entries = { 'manifest.json': [new TextEncoder().encode(JSON.stringify(manifest)), { mtime }] };
  for (const file of group.files) entries[file.path.slice(1)] = [await readFile(join(publicRoot, file.path)), { mtime }];
  const zip = zipSync(entries, { level: 6 });
  if (zip.length > 20 * 1024 * 1024) throw new Error(`Package exceeds 20 MiB: ${group.id}`);
  const pathname = join(output, `${group.id}-${group.version}.zip`);
  const sha256 = createHash('sha256').update(zip).digest('hex');
  packs.push({ id: group.id, version: group.version, path: `/packs/${group.id}-${group.version}.zip`, bytes: zip.length, sha256 });
  if (process.argv.includes('--check')) {
    const existing = await readFile(pathname).catch(() => null);
    if (!existing || !Buffer.from(zip).equals(existing)) throw new Error(`Resource package is stale: ${pathname}`);
  } else await writeFile(pathname, zip);
  console.log(`${group.id}: ${zip.length} bytes, SHA-256 ${sha256}`);
}
const content = JSON.stringify({ version: 1, packs }, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (await readFile(cataloguePath, 'utf8').catch(() => '') !== content) throw new Error('Resource package catalogue is stale');
} else {
  const obsolete = [];
  for (const pack of previous.filter(old => !packs.some(current => current.path === old.path))) {
    if (!/^\/packs\/[a-z0-9-]+\.zip$/.test(pack.path)) throw new Error('Invalid previous resource package path');
    const file = join(publicRoot, pack.path);
    const bytes = await readFile(file).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (!bytes) continue;
    if (createHash('sha256').update(bytes).digest('hex') !== pack.sha256) throw new Error(`Previous resource package changed: ${pack.path}`);
    obsolete.push({ file, name: pack.path.slice('/packs/'.length) });
  }
  for (const { file } of obsolete) await unlink(file);
  await writeFile(cataloguePath + '.tmp', content);
  await rename(cataloguePath + '.tmp', cataloguePath);
}
