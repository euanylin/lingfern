import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const dictionary = new URL('public/dictionary/oewn-2025/', root);
const letters = [...`abcdefghijklmnopqrstuvwxyz0`];
const bucketBytes = await Promise.all(letters.map(letter => readFile(new URL(`${letter}.json`, dictionary))));
const buckets = bucketBytes.map(bytes => JSON.parse(bytes.toString('utf8')));
const forms = JSON.parse(await readFile(new URL('forms.json', dictionary), 'utf8'));
const course = JSON.parse(await readFile(new URL('content/dictionary-course.json', root), 'utf8'));
const review = JSON.parse(await readFile(new URL('content/dictionary-sense-review.json', root), 'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');
if (review.version !== 1 || review.reviewer !== 'Codex/AI' || review.courseSha256 !== sha(await readFile(new URL('content/dictionary-course.json', root)))) throw new Error('Course sense review is stale');
if (new Set(review.records.map(record => record.term)).size !== review.records.length) throw new Error('Duplicate course sense review');
for (const record of review.records) {
  const entry = course.entries.find(entry => entry.term === record.term);
  if (!entry || record.entrySha256 !== sha(JSON.stringify(entry)) || record.senseId !== entry.senseId) throw new Error(`Course sense review changed: ${record.term}`);
  if (!entry.senseId) { if (record.decision !== 'withheld-mapping') throw new Error(`Invalid mapping decision: ${record.term}`); continue; }
  const lemma = /^([^%]{1,80})%[1-5]:[0-9]{2}:[0-9]{2}:[^:]*:[^:]*$/.exec(entry.senseId)?.[1].replaceAll('_', ' ');
  const index = letters.indexOf(lemma?.[0]);
  const sense = buckets[index]?.[lemma]?.find(sense => sense.id === entry.senseId);
  if (!sense || record.decision !== 'mapped' || record.senseSha256 !== sha(JSON.stringify(sense)) || record.bucketSha256 !== sha(bucketBytes[index])) throw new Error(`Dictionary sense changed: ${record.term}`);
}
if (course.entries.some(entry => entry.senseId && !review.records.some(record => record.term === entry.term && record.decision === 'mapped'))) throw new Error('Unreviewed course sense mapping');
const valid = term => term.length <= 80 && /^[\p{L}\p{N}][\p{L}\p{N} .'-]*$/u.test(term);
const terms = new Set([...buckets.flatMap(bucket => Object.keys(bucket)), ...Object.keys(forms), ...course.entries.map(entry => entry.term.normalize('NFKC').toLocaleLowerCase('en-US').trim())].filter(valid));
const content = JSON.stringify([...terms].sort()) + '\n';
const output = new URL('headwords.json', dictionary);

// A compact POS index per headword lets the syntax-tree parser read the installed dictionary
// instead of guessing. Each four-bit field holds a capped sense count: noun, verb, adjective, adverb.
// Sense counts are a rough lexical-frequency proxy, so "book" prefers its noun reading over its verb.
const posBuckets = letters.map((letter, index) => {
  const entries = Object.entries(buckets[index]).map(([term, senses]) => {
    const counts = { noun: 0, verb: 0, adjective: 0, adverb: 0 };
    for (const sense of senses) if (sense.pos in counts) counts[sense.pos] += 1;
    const value = Math.min(15, counts.noun) | (Math.min(15, counts.verb) << 4) | (Math.min(15, counts.adjective) << 8) | (Math.min(15, counts.adverb) << 12);
    return [term, value];
  }).sort(([left], [right]) => left.localeCompare(right, 'en'));
  return JSON.stringify(Object.fromEntries(entries)) + '\n';
});
const posOutput = letters.map(letter => new URL(`pos-${letter}.json`, dictionary));
const check = process.argv.includes('--check');
if (check) {
  if (await readFile(output, 'utf8').catch(() => '') !== content) throw new Error('Dictionary suggestions are stale; run npm run dictionary:index');
  for (const [index, file] of posOutput.entries()) {
    if (await readFile(file, 'utf8').catch(() => '') !== posBuckets[index]) throw new Error(`Dictionary POS index is stale: ${letters[index]}; run npm run dictionary:index`);
  }
  console.log(`Verified ${terms.size} local dictionary suggestions and ${letters.length} POS buckets`);
} else {
  await writeFile(output, content);
  for (const [index, file] of posOutput.entries()) await writeFile(file, posBuckets[index]);
  console.log(`Wrote ${terms.size} local dictionary suggestions and ${letters.length} POS buckets`);
}
