import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { unzipSync } from 'fflate';
import assert from 'node:assert/strict';
const catalogue = JSON.parse(await readFile('content/source-packs.json', 'utf8'));
const packs = catalogue.packs;
let audio = 0;
const decode = bytes => new Promise((resolve, reject) => {
  const child = execFile('ffmpeg', ['-v', 'error', '-nostdin', '-i', 'pipe:0', '-f', 'null', '-'], { maxBuffer: 64 * 1024 }, (error, _stdout, stderr) => error || stderr ? reject(error ?? new Error(stderr)) : resolve());
  child.stdin.on('error', reject); child.stdin.end(bytes);
});
for (const pack of packs) {
  const response = await fetch('http://127.0.0.1:8787' + pack.path);
  assert.equal(response.status, 200, pack.id);
  assert(!response.headers.get('content-type')?.includes('text/html'));
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(bytes.length, pack.bytes, pack.id);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), pack.sha256, pack.id);
  if ('skill' in pack && pack.skill === 'listening') {
    const clips = Object.entries(unzipSync(bytes)).filter(([name]) => name.endsWith('.mp3'));
    for (let index = 0; index < clips.length; index += 4) await Promise.all(clips.slice(index, index + 4).map(([, data]) => decode(data)));
    audio += clips.length;
  }
}
assert.equal((await fetch('http://127.0.0.1:8787/source-packs/missing.zip')).status, 404);
console.log(`PASS: all ${packs.length} source ZIPs served with exact sizes/hashes; all ${audio} audio files fully decoded; missing ZIP is 404. Decode success is not transcript/editorial approval.`);
