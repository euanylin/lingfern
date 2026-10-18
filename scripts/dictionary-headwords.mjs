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
if (process.argv.includes('--check')) {
  if (await readFile(output, 'utf8').catch(() => '') !== content) throw new Error('Dictionary suggestions are stale; run npm run dictionary:index');
  console.log(`Verified ${terms.size} local dictionary suggestions`);
} else {
  await writeFile(output, content);
  console.log(`Wrote ${terms.size} local dictionary suggestions`);
}
