// Local gold-tree evaluation. Reference text and detailed results stay outside public assets.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const fingerprint = value => createHash('sha256').update(value).digest('hex');
const codeFiles = ['src/shared/tree.ts', 'src/shared/tree-parse.ts', 'src/shared/tree-forms.ts', 'src/shared/tree-auxiliary.ts', 'src/shared/tree-dates.ts', 'src/shared/tree-movement.ts', 'src/shared/wordnet-pos.ts', 'src/shared/tree-lexicon.ts', 'scripts/tree-benchmark.mjs'];
const dictionaryFiles = [...'abcdefghijklmnopqrstuvwxyz0'].map(letter => `public/dictionary/oewn-2025/pos-${letter}.json`).concat('public/dictionary/oewn-2025/forms.json');
const hashes = paths => Object.fromEntries(paths.map(path => [path, fingerprint(readFileSync(path))]));

export function parseConllu(text) {
  const sentences = [];
  const ids = new Set();
  for (const block of text.trim().split(/\r?\n\s*\r?\n/u)) {
    const id = /^# sent_id = (.+)$/mu.exec(block)?.[1];
    const source = /^# text = (.+)$/mu.exec(block)?.[1];
    assert(id && source && !ids.has(id), 'Missing or duplicate sentence metadata');
    ids.add(id);
    const tokens = block.split(/\r?\n/u).filter(line => line && !line.startsWith('#')).flatMap(line => {
      const fields = line.split('\t');
      assert.equal(fields.length, 10, 'Expected ten CoNLL-U columns');
      if (/^\d+[-.]\d+$/u.test(fields[0])) return [];
      assert(/^\d+$/u.test(fields[0]) && /^\d+$/u.test(fields[6]), 'Invalid word or head index');
      return [{ id: Number(fields[0]), word: fields[1], pos: fields[3], tag: fields[4], head: Number(fields[6]), relation: fields[7] }];
    });
    assert(tokens.length > 0 && tokens.filter(token => token.head === 0).length === 1, 'Expected one gold root');
    for (const [index, token] of tokens.entries()) {
      assert(token.id === index + 1 && token.head <= tokens.length && token.head !== token.id, 'Invalid gold tree index');
      const seen = new Set([token.id]);
      let head = token.head;
      while (head) {
        assert(!seen.has(head), 'Cyclic gold tree');
        seen.add(head);
        head = tokens[head - 1].head;
      }
    }
    sentences.push({ id, text: source, tokens });
  }
  return sentences;
}

export function dependencyTokens(diagram) {
  const ordered = [...diagram.nodes].sort((left, right) => left.order - right.order);
  const positions = new Map(ordered.map((node, index) => [node.id, index + 1]));
  const heads = new Map(ordered.flatMap(node => node.children.map(child => [child, positions.get(node.id)])));
  return ordered.map(node => ({ word: node.label, head: heads.get(node.id) ?? 0, relation: node.id === diagram.root ? 'root' : node.role }));
}

export function compareDependencies(gold, predicted) {
  // NFKC is the product's declared input normalization; no words, case or punctuation are dropped.
  const aligned = gold.length === predicted.length && gold.every((token, index) => token.word.normalize('NFKC') === predicted[index].word.normalize('NFKC'));
  let correctHeads = 0, correctLabels = 0, correctLexicalLabels = 0;
  if (aligned) for (const [index, token] of gold.entries()) {
    if (token.head !== predicted[index].head) continue;
    correctHeads++;
    if (token.relation !== predicted[index].relation) continue;
    correctLabels++;
    if (token.pos !== 'PUNCT') correctLexicalLabels++;
  }
  return { aligned, exact: aligned && correctLabels === gold.length, correctHeads, correctLabels, correctLexicalLabels };
}

// Exact one-sided 95% binomial upper bound, computed in log space, not a rounded success rate.
export function errorUpperBound(errors, total, alpha = .05) {
  assert(Number.isInteger(total) && total > 0 && Number.isInteger(errors) && errors >= 0 && errors <= total);
  assert(alpha > 0 && alpha < 1);
  if (errors === total) return 1;
  if (errors === 0) return -Math.expm1(Math.log(alpha) / total);
  const cdf = probability => {
    const p = Math.log(probability), q = Math.log1p(-probability);
    let term = total * q, sum = term;
    for (let index = 1; index <= errors; index++) {
      term += Math.log(total - index + 1) - Math.log(index) + p - q;
      const maximum = Math.max(sum, term);
      sum = maximum + Math.log(Math.exp(sum - maximum) + Math.exp(term - maximum));
    }
    return Math.exp(sum);
  };
  let low = errors / total, high = 1;
  for (let iteration = 0; iteration < 60; iteration++) {
    const middle = (low + high) / 2;
    if (cdf(middle) > alpha) low = middle;
    else high = middle;
  }
  return high;
}

function strata(sentence) {
  const count = sentence.tokens.length;
  const length = count <= 5 ? '1-5' : count <= 10 ? '6-10' : count <= 20 ? '11-20' : count <= 40 ? '21-40' : count <= 80 ? '41-80' : count <= 200 ? '81-200' : '201+';
  const relations = new Set(sentence.tokens.map(token => token.relation));
  const structures = ['all'];
  for (const relation of ['conj', 'ccomp', 'xcomp', 'advcl', 'acl:relcl', 'nsubj:pass', 'iobj']) if (relations.has(relation)) structures.push(relation);
  if (sentence.tokens.some(token => token.tag === 'MD')) structures.push('modal');
  if (sentence.text.endsWith('?')) structures.push('question');
  return { length, structures, genre: sentence.id.split('-')[0] };
}

export async function benchmark(input, output) {
  assert(input && output, 'Usage: node scripts/tree-benchmark.mjs <gold.conllu> <new-private-report.json>');
  // No corpus text or detailed errors may be emitted into application assets or fixtures.
  assert(resolve(output).startsWith(resolve('private/verification') + '/'), 'Use private/verification for benchmark output');
  assert(!existsSync(output), 'A benchmark report must be written to a new path');
  const code = hashes(codeFiles), dictionary = hashes(dictionaryFiles);
  const source = readFileSync(input, 'utf8');
  const sentences = parseConllu(source);
  const { createServer } = await import('vite');
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  const results = [];
  const originalFetch = globalThis.fetch;
  try {
    const { drawTree } = await server.ssrLoadModule('/src/shared/tree.ts');
    const { loadWordNetPos } = await server.ssrLoadModule('/src/shared/wordnet-pos.ts');
    // Exercise the page's actual conditional bucket/inflection loading, not an oracle lexicon.
    globalThis.fetch = async url => {
      assert(typeof url === 'string' && /^\/dictionary\/oewn-2025\/(?:pos-[a-z0]\.json|forms\.json)$/u.test(url), 'Unexpected benchmark request');
      return new Response(readFileSync(`public${url}`), { headers: { 'Content-Type': 'application/json' } });
    };
    for (const sentence of sentences) {
      const start = performance.now();
      let predicted = [], failure;
      try {
        const lookup = await loadWordNetPos(sentence.text.split(/\s+/u));
        predicted = dependencyTokens(drawTree(sentence.text, 'dependency', lookup));
      }
      catch (error) { failure = error instanceof Error ? error.message : 'UNKNOWN'; }
      results.push({ id: sentence.id, text: sentence.text, gold: sentence.tokens, predicted, ...compareDependencies(sentence.tokens, predicted), ...strata(sentence), ...(failure ? { failure } : {}), milliseconds: performance.now() - start });
      if (results.length % 100 === 0) console.log(`Evaluated ${results.length}/${sentences.length}`);
    }
  } finally { globalThis.fetch = originalFetch; await server.close(); }
  const summarize = rows => {
    const errors = rows.filter(row => !row.exact).length;
    return { sentences: rows.length, errors, treeErrorRate: errors / rows.length, oneSided95Upper: errorUpperBound(errors, rows.length), parseFailures: rows.filter(row => row.failure).length, tokenMismatches: rows.filter(row => !row.failure && !row.aligned).length, labeledAttachment: rows.reduce((sum, row) => sum + row.correctLabels, 0) / rows.reduce((sum, row) => sum + row.gold.length, 0) };
  };
  const summary = summarize(results);
  const by = key => Object.fromEntries([...new Set(results.flatMap(row => row[key]))].sort().map(value => [value, summarize(results.filter(row => Array.isArray(row[key]) ? row[key].includes(value) : row[key] === value))]));
  assert.deepEqual(hashes(codeFiles), code, 'Parser or evaluator source changed during the benchmark');
  assert.deepEqual(hashes(dictionaryFiles), dictionary, 'Dictionary data changed during the benchmark');
  const report = { date: new Date().toISOString(), scope: 'UD basic dependencies; whole-tree exact match, including punctuation; all input sentences counted', runtime: process.version, source: { path: input, sha256: fingerprint(source) }, code, dictionary, summary, belowOnePercent: summary.treeErrorRate < .01 && summary.oneSided95Upper < .01, byLength: by('length'), byStructure: by('structures'), byGenre: by('genre'), results };
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output, ...summary, belowOnePercent: report.belowOnePercent }, null, 2));
  return report;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await benchmark(process.argv[2], process.argv[3]);
