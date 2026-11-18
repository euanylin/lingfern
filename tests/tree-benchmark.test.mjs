import assert from 'node:assert/strict';
import test from 'node:test';
import { compareDependencies, dependencyTokens, errorUpperBound, parseConllu } from '../scripts/tree-benchmark.mjs';

const source = '# sent_id = fixture-1\n# text = She left.\n1\tShe\tshe\tPRON\tPRP\t_\t2\tnsubj\t_\t_\n2\tleft\tleave\tVERB\tVBD\t_\t0\troot\t_\t_\n3\t.\t.\tPUNCT\t.\t_\t2\tpunct\t_\t_';

test('reads one rooted gold tree and rejects corrupt or duplicate annotations', () => {
  assert.equal(parseConllu(source)[0].tokens.length, 3);
  assert.throws(() => parseConllu(source + '\n\n' + source));
  assert.throws(() => parseConllu(source.replace('\t0\troot', '\t1\troot')));
  assert.throws(() => parseConllu(source.replace('\t2\tnsubj', '\t8\tnsubj')));
});

test('counts wrong heads, labels, missing words and punctuation as whole-tree errors', () => {
  const gold = parseConllu(source)[0].tokens;
  assert.equal(compareDependencies(gold, gold).exact, true);
  assert.equal(compareDependencies(gold, gold.slice(0, 2)).exact, false);
  for (const change of [{ head: 0 }, { relation: 'obj' }, { word: 'They' }]) {
    const predicted = gold.map(token => ({ ...token }));
    Object.assign(predicted[0], change);
    assert.equal(compareDependencies(gold, predicted).exact, false);
  }
  const punctuation = gold.map(token => ({ ...token }));
  punctuation[2].head = 1;
  assert.equal(compareDependencies(gold, punctuation).exact, false);
  assert.equal(compareDependencies(gold, []).correctLabels, 0);
});

test('reads graph heads rather than assuming display order equals parent order', () => {
  assert.deepEqual(dependencyTokens({ root: 'v', nodes: [{ id: 'v', label: 'left', order: 2, children: ['s'] }, { id: 's', label: 'She', order: 1, children: [], role: 'nsubj' }] }), [{ word: 'She', head: 2, relation: 'nsubj' }, { word: 'left', head: 0, relation: 'root' }]);
});

test('does not call a small zero-error sample proof of below-one-percent error', () => {
  assert(errorUpperBound(0, 100) > .01);
  assert(errorUpperBound(0, 300) < .01);
  assert.equal(errorUpperBound(100, 100), 1);
  // For one failure in two trials the CDF is 1-p², giving sqrt(.95).
  assert(Math.abs(errorUpperBound(1, 2) - Math.sqrt(.95)) < 1e-12);
  assert(errorUpperBound(1, 300) > errorUpperBound(0, 300));
});
