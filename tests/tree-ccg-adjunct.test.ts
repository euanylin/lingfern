import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { drawTree, sentenceFileName, treeFileName, treeForms, treeText } from '../src/shared/tree';
import { isTraceLabel } from '../src/shared/tree-movement';
import { resolvePos, type PosLookup, type WordNetPos } from '../src/shared/wordnet-pos';

const buckets = new Map([...'abcdefghijklmnopqrstuvwxyz0'].map(letter => [letter, JSON.parse(readFileSync(`public/dictionary/oewn-2025/pos-${letter}.json`, 'utf8')) as Record<string, number>]));
const forms = JSON.parse(readFileSync('public/dictionary/oewn-2025/forms.json', 'utf8')) as Record<string, string[]>;
const parts: WordNetPos[] = ['noun', 'verb', 'adjective', 'adverb'];
const lookup: PosLookup = word => {
  const counts = resolvePos(word, buckets, forms);
  const readings = parts.filter(part => counts[part] > 0).map(part => [part, counts[part]] as const);
  return readings.length ? readings : undefined;
};
const sentences = [
  'why did she leave', 'Why did she leave?', 'how did he solve the problem',
  'how quickly did she leave', 'how fast did he run', 'I asked why she left',
  'I know how he solved the problem', 'I asked how quickly she left',
  'the reason why she left is clear', 'why has she left',
  'why do you think John left', 'how long has she been waiting',
];

it.each([['offline', undefined], ['dictionary', lookup]] as const)('derives adjunct wh clauses without inventing object valency (%s)', (_, pos) => {
  for (const sentence of sentences) {
    const ccg = drawTree(sentence, 'ccg', pos);
    expect(ccg.nodes[0].label, sentence).toBe('S');
    expect(ccg.nodes.some(node => node.label === '?'), sentence).toBe(false);
    expect(ccg.nodes.some(node => isTraceLabel(node.label)), sentence).toBe(false);
    const phrase = drawTree(sentence, 'constituency', pos);
    const gap = phrase.nodes.find(node => isTraceLabel(node.label))!;
    expect(gap, sentence).toBeDefined();
    expect(phrase.nodes.find(node => node.children.includes(gap.id))?.label, sentence).toBe('ADVP');
    for (const form of treeForms) expect(treeFileName(drawTree(sentence, form, pos)), `${sentence} ${form}`).toBe(sentenceFileName(sentence));
  }
});

it('uses a sentence operator for reason/manner and a degree functor for modified adjuncts', () => {
  expect(treeText(drawTree('why did she leave', 'ccg'))).toContain('why|S/S');
  expect(treeText(drawTree('why did she leave', 'ccg'))).toContain('leave|S\\NP');
  expect(treeText(drawTree('how did he solve the problem', 'ccg'))).toContain('solve|(S\\NP)/NP');
  expect(treeText(drawTree('the reason why she left is clear', 'ccg'))).toContain('why|(NP\\NP)/S');
  expect(treeText(drawTree('how fast did he run', 'ccg'))).toContain('how|(S/S)/(S\\NP)');
  expect(treeText(drawTree('how quickly did she leave', 'ccg'))).toContain('how|(S/S)/((S\\NP)\\(S\\NP))');
});

it('keeps the degree modifier inside the fronted phrase and attaches its content head to the predicate', () => {
  for (const sentence of ['how quickly did she leave', 'I asked how quickly she left']) {
    const phrase = drawTree(sentence);
    const wh = phrase.nodes.find(node => node.label === 'WHADVP')!;
    expect(wh.children.map(id => phrase.nodes.find(node => node.id === id)?.label)).toEqual(['WRB', 'ADVP']);
    const dependency = drawTree(sentence, 'dependency');
    const how = dependency.nodes.find(node => node.label === 'how')!;
    const quickly = dependency.nodes.find(node => node.label === 'quickly')!;
    expect(how.role).toBe('advmod');
    expect(quickly.children).toContain(how.id);
    const predicate = dependency.nodes.find(node => node.label === (sentence.startsWith('I') ? 'left' : 'leave'))!;
    expect(predicate.children).toContain(quickly.id);
  }
});

it('retains failure propagation when a sentence argument is missing', () => {
  for (const input of ['(SBARQ (WHADVP (WRB why₁)) (S (NP (PRP she)) (NP (NNS cats)) (ADVP t₁)))', '(S (DT the) (VBZ sleeps) (NN cat))']) {
    expect(drawTree(input, 'ccg').nodes[0].label).toBe('?');
  }
});


it('keeps a perfect auxiliary governing a participle across the inverted subject', () => {
  for (const [sentence, word] of [
    ['why has she left', 'left'], ['why has the teacher left', 'left'],
    ['why has she not left', 'left'], ['why has she had breakfast', 'had'],
  ]) {
    const phrase = drawTree(sentence, 'constituency', lookup);
    expect(treeText(phrase), sentence).toContain(`[VBN ${word}]`);
    const ccg = drawTree(sentence, 'ccg', lookup);
    expect(ccg.nodes[0].label, sentence).toBe('S');
    expect(ccg.nodes.some(node => node.label === '?'), sentence).toBe(false);
  }
  expect(treeText(drawTree('I had him read the letter', 'constituency', lookup))).toContain('[VBD had]');
  expect(treeText(drawTree('she left', 'constituency', lookup))).toContain('[VBD left]');
});
