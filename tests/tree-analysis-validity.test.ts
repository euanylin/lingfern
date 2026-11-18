import { expect, it } from 'vitest';
import { drawTree, treeText, type TreeDiagram } from '../src/shared/tree';
import { isTraceLabel } from '../src/shared/tree-movement';

function leaves(tree: TreeDiagram) {
  const nodes = new Map(tree.nodes.map(node => [node.id, node]));
  const walk = (id: string): string[] => {
    const node = nodes.get(id)!;
    return node.children.length ? node.children.flatMap(walk) : [node.label];
  };
  return walk(tree.root);
}

it.each([['"', '"'], ['“', '”']])('keeps enclosing %s quotes as punctuation around a sentence', (open, close) => {
  const tree = drawTree(`${open}we left.${close}`, 'dependency');
  expect(tree.nodes.map(node => node.label)).toEqual([open, 'we', 'left', '.', close]);
  expect(tree.nodes.find(node => node.id === tree.root)?.label).toBe('left');
  expect(tree.nodes[0].role).toBe('punct');
  expect(tree.nodes.at(-1)?.role).toBe('punct');
});

it('keeps lexical terminals and binary Merge in bare phrase structure', () => {
  const tree = drawTree('(S (NP (DT the) (NN cat)) (VP (VBD sat)))', 'bare');
  expect(leaves(tree)).toEqual(['the', 'cat', 'T[past]', 'sat']);
  expect(tree.nodes.every(node => node.children.length <= 2)).toBe(true);
});

it('does not invent an elementary TAG tree kind from ordinary phrase recursion', () => {
  const tree = drawTree('(S (NP (NP (DT the) (NN cat)) (PP (IN on) (NP (DT the) (NN mat)))) (VP (VBD sat)))', 'tag');
  expect(tree.nodes[0].label).toBe('S');
  expect(treeText(tree)).not.toMatch(/[αβ]/u);
});

it('marks a failed CCG application unresolved instead of inventing a category', () => {
  const tree = drawTree('(S (NP (PRP she)) (NP (NNS cats)))', 'ccg');
  // Two noun phrases cannot form a sentence by function application.
  expect(tree.nodes.find(node => node.id === tree.root)?.label).toBe('?');
  expect(leaves(tree)).toHaveLength(2);
  const question = drawTree('what did you see', 'ccg');
  expect(question.nodes[0].label).toBe('S');
  expect(question.nodes.some(node => node.label === '?')).toBe(false);
  expect(question.nodes.some(node => isTraceLabel(node.label))).toBe(false);
});

it('derives a double-object verb with both arguments in their surface order', () => {
  const tree = drawTree('(S (NP (PRP she)) (VP (VBD gave) (NP (PRP him)) (NP (NNS books))))', 'ccg');
  expect(tree.nodes[0].label).toBe('S');
  expect(tree.nodes.some(node => node.label === '?')).toBe(false);
  expect(leaves(tree).map(label => label.split('|')[0])).toEqual(['she', 'gave', 'him', 'books']);
});

it('heads a coordination on the first conjunct and attaches cc to the second', () => {
  const tree = drawTree('(NP (NN cats) (CC and) (NN dogs))', 'dependency');
  const cats = tree.nodes.find(node => node.label === 'cats')!;
  const dogs = tree.nodes.find(node => node.label === 'dogs')!;
  const and = tree.nodes.find(node => node.label === 'and')!;
  expect(tree.root).toBe(cats.id);
  expect(dogs.role).toBe('conj');
  expect(dogs.children).toContain(and.id);
});

it('uses UD relations without adding constituency traces as dependency words', () => {
  const tree = drawTree('(S (NP (PRP she)) (VP (VBD saw) (NP (NP (DT the) (NN book)) (SBAR (WHNP (WDT which₁)) (S (NP (PRP I)) (VP (VBD read) t₁))))))', 'dependency');
  expect(tree.nodes.some(node => isTraceLabel(node.label))).toBe(false);
  expect(tree.nodes.find(node => node.label === 'read')?.role).toBe('acl:relcl');
  expect(tree.nodes.find(node => node.label === 'which')?.role).toBe('obj');
});

it('distinguishes possessors, indirect objects and passive auxiliaries', () => {
  const possessive = drawTree('(S (NP (PRP$ my) (NN cat)) (VP (VBD slept)))', 'dependency');
  expect(possessive.nodes.find(node => node.label === 'my')?.role).toBe('nmod:poss');
  const passive = drawTree('(S (NP (PRP she)) (VP (VBZ has) (VP (VBN been) (VP (VBN given) (NP (NN books))))))', 'dependency');
  expect(passive.nodes.find(node => node.label === 'she')?.role).toBe('nsubj:pass');
  expect(passive.nodes.find(node => node.label === 'been')?.role).toBe('aux:pass');
  const double = drawTree('(S (NP (PRP she)) (VP (VBD gave) (NP (PRP him)) (NP (NN books))))', 'dependency');
  expect(double.nodes.find(node => node.label === 'him')?.role).toBe('iobj');
  expect(double.nodes.find(node => node.label === 'books')?.role).toBe('obj');
});

it.each(['not', 'quickly'])('recognizes a passive with intervening %s', adverb => {
  const tree = drawTree(`(S (NP (DT the) (NN cake)) (VP (VBD was) (RB ${adverb}) (VP (VBN eaten) (PP (IN by) (NP (PRP her))))))`, 'dependency');
  expect(tree.nodes.find(node => node.label === 'cake')?.role).toBe('nsubj:pass');
  expect(tree.nodes.find(node => node.label === 'was')?.role).toBe('aux:pass');
  expect(tree.nodes.find(node => node.label === 'her')?.role).toBe('obl:agent');
  expect(tree.nodes.find(node => node.label === adverb)?.role).toBe('advmod');
  const generated = drawTree(`the cake was ${adverb} eaten by her`, 'dependency');
  expect(generated.nodes.find(node => node.label === 'cake')?.role).toBe('nsubj:pass');
  expect(generated.nodes.find(node => node.label === 'was')?.role).toBe('aux:pass');
  const active = drawTree(`(S (NP (PRP she)) (VP (VBD was) (RB ${adverb}) (VP (VBG reading) (NP (NNS books)))))`, 'dependency');
  expect(active.nodes.find(node => node.label === 'she')?.role).toBe('nsubj');
  expect(active.nodes.find(node => node.label === 'was')?.role).toBe('aux');
});

it('uses an adverbial extraction gap rather than an invented object', () => {
  for (const sentence of ['why did she leave', 'when did she arrive', 'where do you live']) {
    const diagram = drawTree(sentence);
    const gap = diagram.nodes.find(node => isTraceLabel(node.label))!;
    expect(gap, sentence).toBeDefined();
    expect(diagram.nodes.find(node => node.children.includes(gap.id))?.label, sentence).toBe('ADVP');
    const dependency = drawTree(sentence, 'dependency');
    const word = sentence.split(' ')[0];
    expect(dependency.nodes.find(node => node.label === word)?.role).toBe('advmod');
  }
});

it('distinguishes prepositional to from infinitival T in X-bar', () => {
  const tree = drawTree('(PP (TO to) (NP (NN school)))', 'xbar');
  expect(tree.nodes.find(node => node.label === 'P')?.children).toHaveLength(1);
  expect(tree.nodes.some(node => node.label === 'T')).toBe(false);
});

it('heads a copular prepositional predicate on its nominal', () => {
  const tree = drawTree('(S (NP (PRP she)) (VP (VBZ is) (PP (IN in) (NP (NN shape)))))', 'dependency');
  expect(tree.nodes.find(node => node.id === tree.root)?.label).toBe('shape');
  expect(tree.nodes.find(node => node.label === 'is')?.role).toBe('cop');
  expect(tree.nodes.find(node => node.label === 'in')?.role).toBe('case');
});

it('prints standard phrase and function labels instead of chart helpers', () => {
  expect(treeText(drawTree('we met every day'))).toContain('NP-TMP');
  const tree = drawTree('the book for him to read is here');
  expect(tree.nodes.some(node => node.label === 'INF' || node.label === 'TMP')).toBe(false);
  expect(tree.nodes.some(node => node.label === 'SBAR')).toBe(true);
});

it('keeps V-to-T and T-to-C chains distinct from nominal extraction', () => {
  for (const [sentence, auxiliary, traces] of [
    ['she is happy', 'is', 1], ['is she happy', 'is', 2],
    ['has she read the book', 'has', 2], ['did you read the book', 'did', 1],
  ] as const) {
    const tree = drawTree(sentence, 'xbar');
    const byId = new Map(tree.nodes.map(node => [node.id, node]));
    const head = tree.nodes.find(node => node.label.startsWith(auxiliary) && !node.children.length)!;
    expect(head.label, sentence).toBe(`${auxiliary}₁`);
    const gaps = tree.nodes.filter(node => isTraceLabel(node.label));
    expect(gaps, sentence).toHaveLength(traces);
    for (const gap of gaps) expect(['V', 'T'], sentence).toContain(tree.nodes.find(node => node.children.includes(gap.id))?.label);
    expect(tree.nodes.some(node => node.label.includes('\0')), sentence).toBe(false);
    expect([...byId.values()].filter(node => !node.children.length && node.label === auxiliary), sentence).toHaveLength(0);
  }
  const modal = drawTree('she will read a book', 'xbar');
  expect(modal.nodes.some(node => isTraceLabel(node.label))).toBe(false);
  const relative = drawTree('The man who caught the ball is my uncle', 'xbar');
  expect(relative.nodes.some(node => node.label === 'who₁')).toBe(true);
  expect(relative.nodes.some(node => node.label === 'is₂')).toBe(true);
  expect(relative.nodes.filter(node => isTraceLabel(node.label)).map(node => node.label).sort()).toEqual(['t₁', 't₂']);
});

it('projects the same functional heads in bare structure without copying movement indices onto labels', () => {
  for (const sentence of ['The man who caught the ball is my uncle', 'is she happy', 'what did you see', 'the children played and the parents talked']) {
    const tree = drawTree(sentence, 'bare');
    expect(tree.nodes.every(node => node.children.length === 0 || node.children.length === 2), sentence).toBe(true);
    expect(tree.nodes.filter(node => /[₀-₉]/u.test(node.label)).every(node => node.children.length === 0), sentence).toBe(true);
    expect(tree.nodes.some(node => node.label.includes('\0')), sentence).toBe(false);
  }
  const relative = drawTree('The man who caught the ball is my uncle', 'bare');
  expect(leaves(relative)).toContain('T[past]');
  expect(leaves(relative)).toContain('C[∅]');
  expect(leaves(relative)).toContain('is₂');
});

it('derives subject/object questions and relatives with licensed CCG extraction categories', () => {
  for (const sentence of [
    'The man who caught the ball is my uncle', 'the book which I read is old',
    'what did you see', 'who wrote the letter', 'did you read the book',
    'I know what she bought', 'who do you think wrote the letter',
    'what do you think John bought', 'who did you talk to', 'to whom did you speak',
    'the city in which I live is old', 'the letter was written by Mary',
    'she is happy', 'she will read a book', 'she is reading a book', 'John has left',
    'The man who caught the ball is my uncle.', 'where did he put the book', 'when did she arrive', 'the city where I live is old',
  ]) {
    const tree = drawTree(sentence, 'ccg');
    expect(tree.nodes[0].label, sentence).toBe('S');
    expect(tree.nodes.some(node => node.label === '?'), sentence).toBe(false);
    expect(tree.nodes.some(node => isTraceLabel(node.label)), sentence).toBe(false);
  }
  const subject = treeText(drawTree('who do you think wrote the letter', 'ccg'));
  expect(subject).toContain('think|((S\\NP)/NP)/(S\\NP)');
  const object = treeText(drawTree('the book which I read is old', 'ccg'));
  expect(object).toContain('which|(NP\\NP)/(S/NP)');
  expect(object).toContain('S/(S\\NP)');
  const invalid = drawTree('(S (DT the) (VBZ sleeps) (NN cat))', 'ccg');
  expect(invalid.nodes[0].label).toBe('?');
});

it('keeps only one CP for a pied-piped wh question', () => {
  const tree = drawTree('To what extent do you agree with the opinion', 'xbar');
  expect(tree.nodes.filter(node => node.label === 'CP')).toHaveLength(1);
  expect(tree.nodes.some(node => node.label === 'do₂')).toBe(true);
  expect(tree.nodes.some(node => node.label === 'what₁')).toBe(true);
});


it('keeps predicative wh gaps and dependency heads consistent across all presentations', () => {
  for (const sentence of ['how old is she', 'how happy is she', 'she asked how old he was']) {
    const phrase = drawTree(sentence);
    const gap = phrase.nodes.find(node => isTraceLabel(node.label))!;
    expect(phrase.nodes.find(node => node.children.includes(gap.id))?.label, sentence).toBe('ADJP');
    const dependency = drawTree(sentence, 'dependency');
    const word = sentence.includes('happy') ? 'happy' : 'old';
    const predicate = dependency.nodes.find(node => node.label === word)!;
    const copula = dependency.nodes.find(node => ['is', 'was'].includes(node.label))!;
    const subject = dependency.nodes.find(node => node.label === (sentence.startsWith('she asked') ? 'he' : 'she') && node.role === 'nsubj')!;
    expect(copula.role, sentence).toBe('cop');
    expect(predicate.children, sentence).toContain(copula.id);
    expect(predicate.children, sentence).toContain(subject.id);
    expect(dependency.nodes.find(node => node.label === 'how')?.role, sentence).toBe('advmod');
    if (sentence.startsWith('she asked')) expect(predicate.role).toBe('ccomp');
    else expect(dependency.root).toBe(predicate.id);
    const ccg = drawTree(sentence, 'ccg');
    expect(ccg.nodes[0].label, sentence).toBe('S');
    expect(ccg.nodes.some(node => node.label === '?'), sentence).toBe(false);
    for (const form of ['xbar', 'bare', 'tag', 'cst', 'ast', 'feature'] as const) {
      const tree = drawTree(sentence, form);
      expect(tree.nodes.some(node => node.label.includes('how₁')), `${sentence} ${form}`).toBe(true);
      expect(tree.nodes.some(node => isTraceLabel(node.label)), `${sentence} ${form}`).toBe(true);
    }
  }
});

it('retains minor verb readings offline without erasing noun alternatives', () => {
  expect(treeText(drawTree('the city where I live is old'))).toContain('[VBP live]');
  expect(treeText(drawTree('the parents talked'))).toContain('[NNS parents]');
  expect(treeText(drawTree('the parents talked'))).toContain('[VBD talked]');
  const complement = drawTree('I know where she lives', 'dependency');
  expect(complement.nodes.find(node => node.label === 'lives')?.role).toBe('ccomp');
  const adjunct = drawTree('I left when she arrived', 'dependency');
  expect(adjunct.nodes.find(node => node.label === 'arrived')?.role).toBe('advcl');
});


it('keeps single-word copular predicates and their subject roles in all views', () => {
  for (const [sentence, predicateWord, subjectWord] of [
    ['how is she', 'how', 'she'], ['where is she', 'where', 'she'], ['when is the party', 'when', 'party'],
  ]) {
    const dependency = drawTree(sentence, 'dependency');
    const predicate = dependency.nodes.find(node => node.label === predicateWord)!;
    expect(dependency.root, sentence).toBe(predicate.id);
    expect(dependency.nodes.find(node => node.label === subjectWord)?.role, sentence).toBe('nsubj');
    expect(dependency.nodes.find(node => node.label === 'is')?.role, sentence).toBe('cop');
    const ccg = drawTree(sentence, 'ccg');
    expect(ccg.nodes[0].label, sentence).toBe('S');
    expect(ccg.nodes.some(node => node.label === '?'), sentence).toBe(false);
    for (const form of ['constituency', 'xbar', 'bare', 'tag', 'cst', 'ast', 'feature'] as const) {
      const tree = drawTree(sentence, form);
      expect(tree.nodes.filter(node => !node.children.length && /^is(?:[₀-₉]+)?(?:\|.*)?$/u.test(node.label)), `${sentence} ${form}`).toHaveLength(1);
    }
  }
});


it('requires a comparative before introducing a comparative-correlative clause', () => {
  const sentence = 'the number of students is rising';
  const tree = drawTree(sentence);
  expect(tree.nodes.some(node => node.label === 'CMP')).toBe(false);
  const dependency = drawTree(sentence, 'dependency');
  expect(dependency.nodes.find(node => node.id === dependency.root)?.label).toBe('rising');
  expect(dependency.nodes.find(node => node.label === 'number')?.role).toBe('nsubj');
  const comparative = drawTree('the more you read, the more you learn');
  expect(treeText(comparative)).toContain('[DT the] [QP');
});
