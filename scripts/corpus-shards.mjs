import { readFile, readdir, writeFile, unlink } from 'node:fs/promises';

/** Keep public inputs within existing per-file limits. */
export function corpusShards(corpus, maxBytes = 20 * 1024 * 1024) {
  const shards = [];
  let records = [];
  const encode = records => JSON.stringify({ ...corpus, records, failures: shards.length ? [] : corpus.failures ?? [] }) + '\n';
  for (const record of corpus.records) {
    const next = [...records, record];
    if (next.length > 100 || Buffer.byteLength(encode(next)) > maxBytes) {
      if (!records.length) throw Error('CORPUS_SOURCE_TOO_LARGE');
      shards.push(encode(records)); records = [record];
      if (Buffer.byteLength(encode(records)) > maxBytes) throw Error('CORPUS_SOURCE_TOO_LARGE');
    } else records = next;
  }
  if (!records.length && !shards.length) throw Error('MISSING_CORPUS');
  if (records.length) shards.push(encode(records));
  return shards;
}
export async function writeCorpusShards(family, corpus, directory = 'public/corpus') {
  if (!['gutenberg', 'voa', 'additional', 'open-reading'].includes(family)) throw Error('INVALID_CORPUS_FAMILY');
  const outputs = corpusShards(corpus).map((bytes, index) => ({ name: `${family}${index ? '-' + (index + 1) : ''}.json`, bytes }));
  const old = (await readdir(directory)).filter(name => new RegExp(`^${family}(?:-[1-9]\\d*)?\\.json$`).test(name));
  const stale = old.filter(name => !outputs.some(output => output.name === name));
  for (const name of stale) {
    const previous = JSON.parse(await readFile(`${directory}/${name}`, 'utf8'));
    if (previous.version !== 1 || !Array.isArray(previous.records)) throw Error('CORPUS_STALE_OUTPUT');
  }
  for (const output of outputs) await writeFile(`${directory}/${output.name}`, output.bytes);
  for (const name of stale) await unlink(`${directory}/${name}`);
  return outputs;
}
