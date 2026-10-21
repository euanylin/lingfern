import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const root = process.cwd();
const publicRoot = process.env.LINGFERN_RESOURCE_PUBLIC_ROOT ?? 'public';
const catalogueRoot = process.env.LINGFERN_RESOURCE_CATALOGUE_ROOT ?? 'content';
const output = resolve(root, catalogueRoot, 'offline-resources.json');
const folders = [
  ['dictionary', 'public/dictionary/oewn-2025'],
  ['ipa', 'public/ipa'],
  ['grammar', 'public/grammar'],
  ['corpus', 'public/corpus'],
  ['audio-beginner', 'public/audio/a1-sentences'],
  ...['a1', 'a2', 'b1', 'b2', 'c1', 'c2'].map(level => [`audio-${level}`, `public/audio/${level === 'a1' ? 'a1-words' : `${level}-speech`}`]),
];
const groups = [];
for (const [id, folder] of folders) {
  const files = [];
  async function visit(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && /\.(json|mp3|md|txt)$/.test(entry.name)) {
        const bytes = await readFile(path);
        files.push({ path: '/' + relative(resolve(root, publicRoot), path).split('\\').join('/'), bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') });
      }
    }
  }
  await visit(resolve(root, publicRoot, folder.slice('public/'.length)));
  files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  // Keep source families independently installable within ZIP expansion limits.
  const parts = id === 'corpus' ? [
    [id, files.filter(file => !/^\/corpus\/open-reading(?:-\d+)?\.json$/.test(file.path))],
    ['corpus-open-reading', files.filter(file => /^\/corpus\/open-reading(?:-\d+)?\.json$/.test(file.path))],
  ] : [[id, files]];
  for (const [partId, partFiles] of parts) {
    if (!partFiles.length) continue;
    groups.push({ id: partId, version: createHash('sha256').update(JSON.stringify(partFiles)).digest('hex').slice(0, 16), bytes: partFiles.reduce((sum, file) => sum + file.bytes, 0), files: partFiles });
  }
}
const version = createHash('sha256').update(JSON.stringify(groups.map(({ id, version }) => [id, version]))).digest('hex').slice(0, 16);
const content = JSON.stringify({ version, groups }, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (await readFile(output, 'utf8').catch(() => '') !== content) throw new Error('Offline resource manifest is stale; run npm run offline:manifest');
  console.log(`Verified ${groups.length} packages, ${groups.reduce((sum, group) => sum + group.files.length, 0)} public resources (${groups.reduce((sum, group) => sum + group.bytes, 0)} bytes)`);
} else {
  await writeFile(output, content);
  console.log(`Wrote ${groups.length} packages; version ${version}`);
}
