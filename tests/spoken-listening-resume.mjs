import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const file = 'private/corpus/spoken/listening-clips/index.json';
const baseline = await readFile(file, 'utf8');
const before = JSON.parse(baseline);
assert.equal(before.complete, true);
const child = spawn(process.execPath, ['scripts/spoken-listening-clips.mjs'], { stdio: ['ignore', 'pipe', 'pipe'] });
let stderr = '';
child.stderr.on('data', chunk => { stderr += chunk; });
const terminal = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code)); });
let checkpoints = 0;
for await (const line of createInterface({ input: child.stdout })) {
  const report = JSON.parse(line);
  if (!report.complete) {
    assert.equal(await readFile(file, 'utf8'), baseline, 'Resume must retain the last complete bank throughout progress');
    checkpoints++;
  }
}
assert.equal(await terminal, 0, stderr);
const after = JSON.parse(await readFile(file, 'utf8'));
assert(checkpoints > 0 && after.complete);
assert.equal(after.roots, before.roots); assert.equal(after.clips, before.clips);
assert.deepEqual(after.records, before.records);
console.log(`PASS: ${checkpoints} resume checkpoints retained the complete bank; ${after.clips} indexed clips reused with unchanged source/hash/timing records.`);
