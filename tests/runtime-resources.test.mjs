import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runtimeResources } from '../scripts/runtime-resources.mjs';
import { sha } from '../scripts/topic-packs.mjs';

test('runtime catalogue preserves complete inputs and rejects stale or changed assets without writes', async () => {
 const root = await mkdtemp(join(tmpdir(), 'lingfern-resources-'));
 const publicRoot = join(root, 'public'), catalogueRoot = join(root, 'content');
 await mkdir(publicRoot); await mkdir(catalogueRoot);
 try {
  const bytes = Buffer.from('exact immutable bytes'), file = { path: '/test.zip', bytes: bytes.length, sha256: sha(bytes) };
  await writeFile(join(publicRoot, 'test.zip'), bytes);
  const offline = { version: 'fixed', groups: [{ id: 'reading', files: [file], bytes: bytes.length }] };
  const sources = { version: 1, packs: [{ ...file, id: 'reading-test', expandedBytes: 100, audioSeconds: 0 }] };
  const downloads = { version: 1, packs: [] };
  for (const [name, value] of Object.entries({ 'offline-resources.json': offline, 'source-packs.json': sources, 'resource-packs.json': downloads })) await writeFile(join(catalogueRoot, name), JSON.stringify(value));
  const options = { publicRoot, catalogueRoot };
  await assert.rejects(runtimeResources({ ...options, check: true }), /RESOURCE_CATALOGUE_STALE/);
  await assert.rejects(stat(join(publicRoot, 'resources')), { code: 'ENOENT' });
  const generated = await runtimeResources(options), frozen = await readFile(generated.path);
  assert.deepEqual(generated.catalogue, { version: 1, offline, sources, downloads });
  assert.equal(generated.assets, 1); assert.equal(generated.publicFiles, 2);
  assert.equal((await runtimeResources({ ...options, check: true })).sha256, generated.sha256);
  await writeFile(join(publicRoot, 'test.zip'), 'changed');
  await assert.rejects(runtimeResources(options), /RESOURCE_ASSET_CHANGED/);
  assert.deepEqual(await readFile(generated.path), frozen);
  await writeFile(join(publicRoot, 'test.zip'), bytes);
  sources.packs[0].path = '/../outside';
  await writeFile(join(catalogueRoot, 'source-packs.json'), JSON.stringify(sources));
  await assert.rejects(runtimeResources(options), /RESOURCE_ASSET_METADATA/);
  assert.deepEqual(await readFile(generated.path), frozen);
 } finally { await rm(root, { recursive: true, force: true }); }
});
