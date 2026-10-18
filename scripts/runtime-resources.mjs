import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const assetLimit = 25 * 1024 * 1024;
export async function runtimeResources({ publicRoot = 'public', catalogueRoot = 'content', check = false } = {}) {
 const load = async name => JSON.parse(await readFile(join(catalogueRoot, name), 'utf8'));
 const catalogue = { version: 1, offline: await load('offline-resources.json'), sources: await load('source-packs.json'), downloads: await load('resource-packs.json') };
 if (!Array.isArray(catalogue.offline.groups) || catalogue.sources.version !== 1 || !Array.isArray(catalogue.sources.packs) || catalogue.downloads.version !== 1 || !Array.isArray(catalogue.downloads.packs)) throw Error('RESOURCE_CATALOGUE_FORMAT');
 const files = [...catalogue.offline.groups.flatMap(group => group.files), ...catalogue.sources.packs, ...catalogue.downloads.packs];
 const seen = new Map();
 for (const file of files) {
  if (!file || typeof file.path !== 'string' || !/^\/[a-zA-Z0-9/_.,-]+$/.test(file.path) || file.path.split('/').some(part => part === '..' || part === '.') || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || file.bytes > assetLimit || !/^[a-f0-9]{64}$/.test(file.sha256)) throw Error('RESOURCE_ASSET_METADATA');
  const previous = seen.get(file.path);
  if (previous) {
   if (previous.bytes !== file.bytes || previous.sha256 !== file.sha256) throw Error('RESOURCE_ASSET_CONFLICT');
   continue;
  }
  const bytes = await readFile(join(publicRoot, file.path.slice(1)));
  if (bytes.length !== file.bytes || sha(bytes) !== file.sha256) throw Error('RESOURCE_ASSET_CHANGED: ' + file.path);
  seen.set(file.path, file);
 }
 const text = JSON.stringify(catalogue, null, 2) + '\n';
 if (Buffer.byteLength(text) > 2 * 1024 * 1024) throw Error('RESOURCE_CATALOGUE_LIMIT');
 let count = 0;
 const walk = async path => {
  for (const entry of await readdir(path, { withFileTypes: true })) {
   const pathname = join(path, entry.name);
   if (entry.isDirectory()) await walk(pathname);
   else if (entry.isFile()) {
    count++;
    if ((await stat(pathname)).size > assetLimit) throw Error('RESOURCE_STATIC_ASSET_LIMIT: ' + pathname);
   } else throw Error('RESOURCE_STATIC_ASSET_TYPE: ' + pathname);
  }
 };
 await walk(publicRoot);
 const output = join(publicRoot, 'resources/catalogue.json');
 const previous = await readFile(output, 'utf8').catch(error => { if (error.code === 'ENOENT') return undefined; throw error; });
 if (count + (previous === undefined ? 1 : 0) > 20000) throw Error('RESOURCE_STATIC_ASSET_COUNT');
 if (check) {
  if (previous !== text) throw Error('RESOURCE_CATALOGUE_STALE');
 } else {
  await mkdir(join(publicRoot, 'resources'), { recursive: true });
  await writeFile(output, text);
 }
 return { catalogue, path: output, bytes: Buffer.byteLength(text), sha256: sha(text), assets: seen.size, publicFiles: count + (previous === undefined ? 1 : 0) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
 const result = await runtimeResources({ publicRoot: process.env.LINGFERN_RESOURCE_PUBLIC_ROOT ?? 'public', catalogueRoot: process.env.LINGFERN_RESOURCE_CATALOGUE_ROOT ?? 'content', check: process.argv.includes('--check') });
 delete result.catalogue;
 console.log(JSON.stringify(result));
}
