import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { backup, restore, compact } from '../scripts/backup.mjs';

test('incremental backup saves only changed files and restores the chain', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'lingfern-backup-'));
  const target = `${root}-restored`;
  try {
    await mkdir(path.join(root, 'src'));
    await mkdir(path.join(root, 'src/__pycache__'));
    await writeFile(path.join(root, 'src/__pycache__/generated.pyc'), 'generated Python cache');
    await mkdir(path.join(root, 'dist'));
    await mkdir(path.join(root, 'private'));
    await mkdir(path.join(root, 'output'));
    await writeFile(path.join(root, 'output/screenshot.png'), 'generated');
    await writeFile(path.join(root, 'src/app.ts'), 'original');
    await writeFile(path.join(root, 'src/removed.ts'), 'old');
    await writeFile(path.join(root, 'dist/bundle.js'), 'generated');
    await writeFile(path.join(root, '.env.local'), 'secret');
    await writeFile(path.join(root, 'private/data.json'), 'private');
    const first = await backup(root);
    const baseline = JSON.parse(await readFile(path.join(first, 'manifest.json'), 'utf8'));
    assert.equal(baseline.kind, 'full');
    assert.deepEqual(baseline.files.map(file => file.path), ['src/app.ts', 'src/removed.ts']);

    await writeFile(path.join(root, 'src/app.ts'), 'changed');
    await writeFile(path.join(root, 'src/new.ts'), 'new');
    await rm(path.join(root, 'src/removed.ts'));
    const second = await backup(root);
    const delta = JSON.parse(await readFile(path.join(second, 'manifest.json'), 'utf8'));
    assert.equal(delta.kind, 'incremental');
    assert.equal(delta.parent, path.basename(first));
    assert.deepEqual(delta.files.map(file => file.path), ['src/app.ts', 'src/new.ts']);
    assert.deepEqual(delta.deleted, ['src/removed.ts']);
    assert.deepEqual(await readdir(path.join(second, 'project/src')), ['app.ts', 'new.ts']);

    await mkdir(path.join(root, 'backup/2099-01-01T00-00-00.000Z'));
    const third = await backup(root);
    const unchanged = JSON.parse(await readFile(path.join(third, 'manifest.json'), 'utf8'));
    assert.equal(third, second);
    assert.deepEqual(unchanged.files, delta.files);

    await restore(root, path.basename(second), target);
    assert.equal(await readFile(path.join(target, 'src/app.ts'), 'utf8'), 'changed');
    await rm(target, { recursive: true });
    await rm(path.join(root, 'backup/2099-01-01T00-00-00.000Z'), { recursive: true });
    const saved = await readFile(path.join(second, 'project/src/app.ts'));
    await writeFile(path.join(second, 'project/src/app.ts'), 'corrupt');
    await assert.rejects(compact(root), /Corrupt backup/);
    assert.equal(await readFile(path.join(first, 'project/src/app.ts'), 'utf8'), 'original');
    await writeFile(path.join(second, 'project/src/app.ts'), saved);
    const consolidated = await compact(root);
    assert.deepEqual((await readdir(path.join(root, 'backup'))).filter(name => /^\d{4}-/.test(name)), [path.basename(consolidated)]);
    await restore(root, path.basename(consolidated), target);
    assert.equal(await readFile(path.join(target, 'src/app.ts'), 'utf8'), 'changed');
    assert.equal(await readFile(path.join(target, 'src/new.ts'), 'utf8'), 'new');
    assert.deepEqual(await readdir(path.join(target, 'src')), ['app.ts', 'new.ts']);
    await assert.rejects(readFile(path.join(target, 'src/__pycache__/generated.pyc')));
    await assert.rejects(readFile(path.join(target, 'dist/bundle.js')));
    await assert.rejects(readFile(path.join(target, '.env.local')));
    await assert.rejects(readFile(path.join(target, 'private/data.json')));
  } finally { await rm(root, { recursive: true, force: true }); await rm(target, { recursive: true, force: true }); }
});
