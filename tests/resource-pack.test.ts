import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { unzipSync, zipSync } from 'fflate';
import { offlineGroups } from '../src/data/offline';
import { inspectResourcePack } from '../src/data/resourcePack';
import { unpackZip } from '../src/data/zip';

it('accepts every current official resource ZIP only after verifying its catalogue hashes', async () => {
  for (const group of offlineGroups) {
    const bytes = await readFile(`public/packs/${group.id}-${group.version}.zip`);
    const pack = await inspectResourcePack(bytes);
    expect(pack.id).toBe(group.id);
    expect(Object.keys(pack.files)).toHaveLength(group.files.length + 1);
  }
});

it('rejects changed bytes, foreign manifests, traversal, scripts and symlinks', async () => {
  const group = offlineGroups.find(item => item.id === 'grammar')!;
  const bytes = await readFile(`public/packs/${group.id}-${group.version}.zip`);
  const files = unzipSync(bytes);
  const first = group.files[0].path.slice(1);
  files[first][0] ^= 1;
  await expect(inspectResourcePack(zipSync(files))).rejects.toThrow('PACKAGE_INTEGRITY');
  const foreign = unzipSync(bytes);
  const manifest = JSON.parse(new TextDecoder().decode(foreign['manifest.json']));
  manifest.groupId = 'dictionary';
  foreign['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest));
  await expect(inspectResourcePack(zipSync(foreign))).rejects.toThrow('PACKAGE_INTEGRITY');
  const options = { maxCompressed: 20 * 1024 * 1024, maxExpanded: 40 * 1024 * 1024, maxFiles: 2000, allowName: (name: string) => name !== 'run.js', error: 'PACKAGE' };
  expect(() => unpackZip(zipSync({ ...unzipSync(bytes), '../escape.json': new Uint8Array([1]) }), options)).toThrow('PACKAGE_ZIP');
  expect(() => unpackZip(zipSync({ ...unzipSync(bytes), 'run.js': new Uint8Array([1]) }), options)).toThrow('PACKAGE_ZIP');
  const link = new Uint8Array(bytes);
  const view = new DataView(link.buffer);
  const central = link.findIndex((_, i) => i + 46 < link.length && view.getUint32(i, true) === 0x02014b50);
  view.setUint32(central + 38, 0xa0000000, true);
  expect(() => unpackZip(link, options)).toThrow('PACKAGE_ZIP');
});

it('keeps every reading shard exactly once in independently bounded ZIP groups', async () => {
  const { readdir } = await import('node:fs/promises');
  const groups = offlineGroups.filter(group => group.id === 'corpus' || group.id === 'corpus-open-reading');
  const paths = groups.flatMap(group => group.files.map(file => file.path)).sort();
  expect(paths).toEqual((await readdir('public/corpus')).filter(name => /\.(json|mp3|md|txt)$/.test(name)).map(name => `/corpus/${name}`).sort());
  expect(new Set(paths).size).toBe(paths.length);
  for (const group of groups) expect(group.bytes).toBeLessThan(40 * 1024 * 1024);
});
