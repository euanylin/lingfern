import assert from 'node:assert/strict';
import { readFile, writeFile, rename, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

assert(process.argv.slice(2).every(arg => arg === '--check'), 'Unsupported daily quote runtime option');
const sourceBytes = await readFile('content/daily-quotes.json');
const catalogue = JSON.parse(sourceBytes);
assert.equal(catalogue.source.url, 'https://en.wikiquote.org/');
assert(catalogue.quotes.length > 1);
assert.equal(new Set(catalogue.quotes.map(quote => quote.id)).size, catalogue.quotes.length);
const full = JSON.stringify(catalogue) + '\n';
assert(Buffer.byteLength(full) < 4 * 1024 * 1024, 'Complete quote evidence exceeds unchanged SW precache limit');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const runtime = { version: catalogue.version, source: catalogue.source,
  fullCatalogue: { path: '/daily-quotes/catalogue.json', sha256: sha(full), sourceSha256: sha(sourceBytes) },
  quotes: catalogue.quotes.map(({ id, text, pageTitle, locator, url, rightsEvidence }) => {
    assert(id && text && pageTitle && locator && /^https:\/\/en\.wikiquote\.org\/w\/index\.php\?oldid=\d+(?:#.*)?$/.test(url));
    assert(rightsEvidence && typeof rightsEvidence === 'object');
    return { id, text, pageTitle, locator, url, rightsEvidence: {
      ...('kind' in rightsEvidence ? { kind: rightsEvidence.kind } : {}),
      ...('rightsUrl' in rightsEvidence ? { rightsUrl: rightsEvidence.rightsUrl } : {}),
    } };
  }),
};
const exclusions = JSON.parse(await readFile('content/daily-quote-exclusions.json', 'utf8'));
const rules = JSON.parse(await readFile('content/quote-language-rules.json', 'utf8'));
const archaic = new RegExp(`\\b(?:${rules.archaicForms.join('|')})\\b`, 'i');
const normalize = text => text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en');
assert.equal(new Set(runtime.quotes.map(quote => normalize(quote.text))).size, runtime.quotes.length, 'Indexed selection requires unique normalized quotation text');
const chunks = [];
const index = runtime.quotes.map((quote, position) => {
  const chunk = String(Math.floor(position / 64)).padStart(3, '0');
  (chunks[Number(chunk)] ??= []).push(quote);
  return { id: quote.id.slice(-16), pageTitle: quote.pageTitle, chunk, eligible: !archaic.test(quote.text) && !exclusions.some(exclusion => quote.id === exclusion.id || normalize(quote.text) === normalize(exclusion.text)) };
});
// Keep full IDs in quote chunks; verify compact selection keys are collision-free.
assert(catalogue.quotes.every(quote => /^wikiquote-[a-f0-9]{64}$/.test(quote.id)), 'Unexpected quote ID format');
assert.equal(new Set(index.map(quote => quote.id)).size, index.length, 'Quote selection key collision');
const chunkRoot = 'content/daily-quote-chunks';
if (!process.argv.includes('--check')) await mkdir(chunkRoot, { recursive: true });
const outputs = chunks.map((quotes, position) => [`${chunkRoot}/${String(position).padStart(3, '0')}.json`, JSON.stringify(quotes) + '\n']);
outputs.push(['content/daily-quote-index.json', JSON.stringify(index) + '\n']);
if (process.argv.includes('--check')) assert.deepEqual((await readdir(chunkRoot)).sort(), chunks.map((_, position) => `${String(position).padStart(3, '0')}.json`), 'Unexpected quote chunk files');
// Preserve full source/rights evidence offline; initially load the selected display chunk.
// Keep full evidence byte-verifiable; include display fields only in eager JavaScript.
for (const [path, content] of [...outputs, ['content/daily-quotes-runtime.json', JSON.stringify(runtime, null, 2) + '\n'], ['public/daily-quotes/catalogue.json', full]]) {
  if (process.argv.includes('--check')) assert(await readFile(path, 'utf8') === content, `${path} is stale; run npm run quotes:runtime`);
  else { await writeFile(path + '.tmp', content); await rename(path + '.tmp', path); }
}
console.log(`Verified ${runtime.quotes.length} display records and complete unchanged quote/source/rights evidence`);
