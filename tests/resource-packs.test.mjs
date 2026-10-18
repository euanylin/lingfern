import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

test('resource updates delete verified superseded outputs and preserve failed updates', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lingfern-pack-update-'));
  const script = resolve('scripts/resource-packs.mjs');
  const run = (...args) => promisify(execFile)(process.execPath, [script, ...args], { cwd: root, env: { ...process.env, LINGFERN_RESOURCE_PUBLIC_ROOT: join(root, 'public'), LINGFERN_RESOURCE_CATALOGUE_ROOT: join(root, 'content') } });
  const catalogue = version => JSON.stringify({ groups: [{ id: 'corpus', version, files: [{ path: '/corpus/text.txt' }] }] });
  try {
    await mkdir(join(root, 'content'));
    await mkdir(join(root, 'public/corpus'), { recursive: true });
    await writeFile(join(root, 'public/corpus/text.txt'), 'Original source.');
    await writeFile(join(root, 'content/offline-resources.json'), catalogue('1111111111111111'));
    await run();
    const oldName = 'corpus-1111111111111111.zip';
    const oldBytes = await readFile(join(root, 'public/packs', oldName));
    await writeFile(join(root, 'public/packs/unrelated.zip'), 'Do not move unknown files.');
    await writeFile(join(root, 'public/corpus/text.txt'), 'Expanded source.');
    await writeFile(join(root, 'content/offline-resources.json'), catalogue('2222222222222222'));
    await assert.rejects(run('--check'));
    assert.deepEqual(await readFile(join(root, 'public/packs', oldName)), oldBytes);
    await assert.rejects(readdir(join(root, 'private/resource-pack-archive')));
    await run();
    assert.deepEqual((await readdir(join(root, 'public/packs'))).sort(), ['corpus-2222222222222222.zip', 'unrelated.zip']);
    await assert.rejects(readFile(join(root, 'public/packs', oldName)), /ENOENT/);
    await run('--check'); await run();
    const currentCatalogue = await readFile(join(root, 'content/resource-packs.json'));
    await writeFile(join(root, 'public/packs/corpus-2222222222222222.zip'), 'Unexpected corruption.');
    await writeFile(join(root, 'content/offline-resources.json'), catalogue('3333333333333333'));
    await assert.rejects(run(), /Previous resource package changed/);
    assert.deepEqual(await readFile(join(root, 'content/resource-packs.json')), currentCatalogue);
    await rm(join(root, 'public/corpus/text.txt'));
    await assert.rejects(run(), /ENOENT/);
    assert.deepEqual(await readFile(join(root, 'content/resource-packs.json')), currentCatalogue);
  } finally { await rm(root, { recursive: true, force: true }); }
});
