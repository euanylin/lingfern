import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const origin = 'http://127.0.0.1:8787';
const home = await fetch(origin);
assert.equal(home.status, 200);
assert.match(home.headers.get('content-type'), /text\/html/);
assert.match(home.headers.get('content-security-policy'), /frame-ancestors 'none'/);
const html = await home.text();
for (const pathname of ['/introduction', '/start', '/today', '/progress', '/library', '/library/dictionary', '/library/saved', '/library/ipa', '/library/grammar', '/library/history', '/settings', '/settings/about', '/learn/test-id']) {
  const response = await fetch(origin + pathname, { headers: { Accept: 'text/html' } });
  assert.equal(response.status, 200, pathname);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.equal(await response.text(), html);
}
const serviceWorker = await fetch(origin + '/sw.js');
assert.equal(serviceWorker.status, 200);
assert.match(serviceWorker.headers.get('content-type'), /javascript/);
assert.match(serviceWorker.headers.get('cache-control'), /no-store/);
const manifest = await fetch(origin + '/manifest.webmanifest');
assert.equal(manifest.status, 200);
for (const pack of JSON.parse(await readFile('content/resource-packs.json', 'utf8')).packs) {
  const response = await fetch(origin + pack.path);
  assert.equal(response.status, 200, pack.path);
  assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), pack.sha256);
}
const appManifest = await manifest.json();
assert.equal(appManifest.start_url, '/');
assert.deepEqual(appManifest.icons.filter(icon => icon.type === 'image/png').map(icon => icon.sizes), ['192x192', '512x512']);
for (const icon of appManifest.icons) {
  const response = await fetch(origin + icon.src);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^image\//);
}
const asset = html.match(/src="([^"]+\.js)"/)[1];
const js = await fetch(origin + asset);
assert.equal(js.status, 200);
assert.match(js.headers.get('cache-control'), /immutable/);
assert.equal(js.headers.get('x-content-type-options'), 'nosniff');
for (const pathname of ['/tasks', '/tests', '/settings/ai', '/introduction/missing', '/introductions']) {
  const response = await fetch(origin + pathname, { headers: { Accept: 'text/html' } });
  assert.equal(response.status, 404, pathname);
}
for (const pathname of ['/api', '/api/unknown', '/oauth/missing']) {
  const response = await fetch(origin + pathname);
  assert.equal(response.status, 404, pathname);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.deepEqual(await response.json(), { error: 'NOT_AVAILABLE' });
}
for (const pathname of ['/mcp', '/.well-known/oauth-protected-resource/mcp']) {
  const response = await fetch(origin + pathname);
  assert.equal(response.status, 503, pathname);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.deepEqual(await response.json(), { error: 'MCP_NOT_CONFIGURED' });
}
for (const pathname of ['/api/session', '/api/auth/start', '/api/auth/callback', '/api/auth/setup', '/api/sync/repositories', '/api/sync/changes']) {
  const response = await fetch(origin + pathname);
  assert.equal(response.status, 503, pathname);
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  assert.deepEqual(await response.json(), { error: 'AUTH_NOT_CONFIGURED' });
}
for (const pathname of ['/api/sync/inspect', '/api/sync/bind', '/api/sync/disconnect', '/api/sync/batches']) {
  assert.equal((await fetch(origin + pathname)).status, 405);
  const response = await fetch(origin + pathname, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 503);
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  assert.deepEqual(await response.json(), { error: 'AUTH_NOT_CONFIGURED' });
}
const wrongMethod = await fetch(origin + '/api/auth/logout');
assert.equal(wrongMethod.status, 405);
assert.equal((await fetch(origin + '/api/auth/disconnect')).status, 405);
const webhook = await fetch(origin + '/api/auth/webhook', { method: 'POST' });
assert.equal(webhook.status, 503);
assert.match(webhook.headers.get('cache-control'), /private, no-store/);
assert.deepEqual(await webhook.json(), { error: 'WEBHOOK_NOT_CONFIGURED' });
for (const path of ['/api/ai/shares', '/api/ai/connections']) {
  const response = await fetch(origin + path);
  assert.equal(response.status, 503, path);
  assert.deepEqual(await response.json(), { error: 'SHARING_NOT_CONFIGURED' });
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
}
const crossOriginAuth = await fetch(origin + '/api/auth/start', { headers: { Origin: 'https://foreign.example' } });
assert.equal(crossOriginAuth.status, 403);
for (const pathname of ['/missing.js', '/content/missing.zip', '/audio/missing.mp3', '/library/missing', '/settings/missing']) {
  const response = await fetch(origin + pathname);
  assert.equal(response.status, 404, pathname);
  assert.notEqual(await response.text(), html);
}
const dictionary = await fetch(origin + '/dictionary/oewn-2025/b.json');
assert.equal(dictionary.status, 200);
assert.match(dictionary.headers.get('cache-control'), /immutable/);
assert.match(dictionary.headers.get('content-type'), /application\/json/);
assert.ok((await dictionary.json()).book.length > 1);
const missingDictionary = await fetch(origin + '/dictionary/oewn-2025/missing.json');
assert.equal(missingDictionary.status, 404);
const ipa = await fetch(origin + '/ipa/entries.json');
assert.equal(ipa.status, 200);
const chart = await ipa.json();
assert.equal(chart.entries.length, 41);
const isolated = await fetch(origin + chart.entries[0].soundAudio);
assert.equal(isolated.status, 200);
assert.match(isolated.headers.get('content-type'), /audio\/mpeg/);
const fullIpa = await fetch(origin + '/ipa/full-sounds.json');
assert.equal(fullIpa.status, 200);
assert.deepEqual(await fullIpa.json(), JSON.parse(await readFile('public/ipa/full-sounds.json', 'utf8')));
for (const sound of JSON.parse(await readFile('content/ipa-phoneme-sources.json', 'utf8'))) {
  const response = await fetch(origin + sound.path);
  assert.equal(response.status, 200, sound.path);
  assert.match(response.headers.get('content-type'), /audio\/mpeg/);
  assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), sound.sha256);
}
const grammar = await fetch(origin + '/grammar/entries.json');
assert.equal(grammar.status, 200);
assert.deepEqual(await grammar.json(), JSON.parse(await readFile('public/grammar/entries.json', 'utf8')));
for (const audio of JSON.parse(await readFile('content/audio-sources.json', 'utf8'))) {
  const response = await fetch(origin + audio.path);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /audio\/mpeg/);
  assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), audio.sha256);
  const partial = await fetch(origin + audio.path, { headers: { Range: 'bytes=0-99' } });
  const bytes = Buffer.from(await partial.arrayBuffer());
  if (partial.status === 206) {
    assert.equal(bytes.byteLength, 100);
    assert.match(partial.headers.get('content-range'), /^bytes 0-99\/\d+$/);
  } else {
    // RFC 9110 §14.2 allows full responses; they do not prove range support (I-010).
    assert.equal(partial.status, 200);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), audio.sha256);
    console.log(`RANGE NOT SUPPORTED LOCALLY: ${audio.path}; verified complete 200 response.`);
  }
}
for (const fixture of JSON.parse(await readFile('tests/fixtures/audio-sources.json', 'utf8'))) {
  const response = await fetch(origin + fixture.path);
  assert.equal(response.status, 404, `Fictional fixture must not be published: ${fixture.path}`);
}
console.log('PASS: real local Worker + Static Assets, statuses, no fallback, static/Worker headers; fictional recordings are absent. No production deployment.');
