import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { drawConlluDependency, drawModelCcg, drawModelConstituency, drawTree, isWrittenTreeInput, sentenceFileName, treeFileName, treeForms, treeText } from '../src/shared/tree';
import { isTraceLabel } from '../src/shared/tree-movement';
import { lemmaCandidates, lemmaReadings, resolvePos, type PosLookup, type WordNetPos } from '../src/shared/wordnet-pos';

const buckets = new Map([...'abcdefghijklmnopqrstuvwxyz0'].map(letter => [letter, JSON.parse(readFileSync(`public/dictionary/oewn-2025/pos-${letter}.json`, 'utf8')) as Record<string, number>]));
const forms = JSON.parse(readFileSync('public/dictionary/oewn-2025/forms.json', 'utf8')) as Record<string, string[]>;
const parts: WordNetPos[] = ['noun', 'verb', 'adjective', 'adverb'];
const lookup: PosLookup = word => {
  const counts = resolvePos(word, buckets, forms);
  const readings = parts.filter(part => counts[part] > 0).map(part => [part, counts[part]] as const);
  return readings.length ? readings : undefined;
};

it('validates model dependency rows with the same rooted-tree rules as manual input', () => {
  const input = '# text = She left.\n1\tShe\tshe\tPRON\t_\t_\t2\tnsubj\t_\t_\n2\tleft\tleave\tVERB\t_\t_\t0\troot\t_\t_\n3\t.\t.\tPUNCT\t_\t_\t2\tpunct\t_\t_';
  const manual = '1 She 2 nsubj\n2 left 0 root\n3 . 2 punct';
  expect(isWrittenTreeInput(manual)).toBe(true);
  expect(drawConlluDependency(input)).toEqual(drawTree(manual));
  expect(() => drawConlluDependency(input + '\n\n' + input)).toThrow('TREE_PARSE');
  expect(() => drawConlluDependency(input.replace('\t2\tnsubj', '\t99\tnsubj'))).toThrow('TREE_PARSE');
});

it('checks the complete dependency model surface using original multiword forms', () => {
  const input = [
    '1-2\tmustn’t\t_\t_\t_\t_\t_\t_\t_\t_',
    '1\tmust\tmust\tAUX\tMD\t_\t3\taux\t_\t_',
    '2\tnot\tnot\tPART\tRB\t_\t3\tadvmod\t_\t_',
    '3\tgo\tgo\tVERB\tVB\t_\t0\troot\t_\t_',
  ].join('\n');
  expect(drawConlluDependency(input, "mustn't go").nodes.map(node => node.label)).toEqual(['must', 'not', 'go']);
  expect(() => drawConlluDependency(input, 'must not go')).toThrow('TREE_PARSE');
  expect(() => drawConlluDependency(input.replace('1-2', '1-4'), "mustn't go")).toThrow('TREE_PARSE');
});

it.each([
  ['dependency', (source: string) => drawConlluDependency('1\tApart\tapart\tADV\tRB\t_\t0\troot\t_\t_', source)],
  ['constituency', (source: string) => drawModelConstituency(source, '(S1 (ADVP (RB Apart)))')],
  ['CCG', (source: string) => drawModelCcg(source, '(<L N POS POS Apart N>)')],
] as const)('rejects removed input word boundaries in %s model output', (_, parse) => {
  expect(() => parse('Apart')).not.toThrow();
  expect(() => parse('A part')).toThrow('TREE_PARSE');
});

it.each([['offline', undefined], ['dictionary', lookup]] as const)('labels basic subjects and nominal modifiers accurately (%s)', (_, pos) => {
  const cases = [
    ['There are two reasons.', 'are', [['There', 'are', 'expl'], ['reasons', 'are', 'nsubj']]],
    ['Are there any questions?', 'Are', [['there', 'Are', 'expl'], ['questions', 'Are', 'nsubj']]],
    ['There will be problems.', 'be', [['There', 'be', 'expl'], ['will', 'be', 'aux'], ['problems', 'be', 'nsubj']]],
    ['There has been a change.', 'been', [['There', 'been', 'expl'], ['has', 'been', 'aux'], ['change', 'been', 'nsubj']]],
    ['She is there.', 'there', [['is', 'there', 'cop'], ['She', 'there', 'nsubj']]],
    ['Was the letter written yesterday?', 'written', [['Was', 'written', 'aux:pass'], ['letter', 'written', 'nsubj:pass']]],
    ['Has the letter been written?', 'written', [['Has', 'written', 'aux'], ['been', 'written', 'aux:pass'], ['letter', 'written', 'nsubj:pass']]],
    ['Is the letter arriving?', 'arriving', [['Is', 'arriving', 'aux'], ['letter', 'arriving', 'nsubj']]],
    ['To leave now would be rude.', 'rude', [['leave', 'rude', 'csubj'], ['To', 'leave', 'mark']]],
    ['That she left surprised me.', 'surprised', [['left', 'surprised', 'csubj'], ['That', 'left', 'mark']]],
    ['Because she left, I called.', 'called', [['left', 'called', 'advcl']]],
    ['The book I bought is new.', 'new', [['bought', 'book', 'acl:relcl'], ['I', 'bought', 'nsubj']]],
    ['I bought the book you recommended.', 'bought', [['book', 'bought', 'obj'], ['recommended', 'book', 'acl:relcl'], ['you', 'recommended', 'nsubj']]],
    ['She has bought the book you recommended.', 'bought', [['recommended', 'book', 'acl:relcl'], ['has', 'bought', 'aux']]],
    ['I met the girl who won.', 'met', [['girl', 'met', 'obj'], ['won', 'girl', 'acl:relcl'], ['who', 'won', 'nsubj']]],
    ['I saw the man who won.', 'saw', [['won', 'man', 'acl:relcl'], ['who', 'won', 'nsubj']]],
    ['I found the book he lost.', 'found', [['lost', 'book', 'acl:relcl'], ['he', 'lost', 'nsubj']]],
    ['The house you live in is old.', 'old', [['live', 'house', 'acl:relcl'], ['in', 'live', 'obl']]],
    ['The woman who I spoke to arrived.', 'arrived', [['spoke', 'woman', 'acl:relcl'], ['who', 'spoke', 'obl'], ['to', 'who', 'case']]],
    ['This is the person who we heard of.', 'person', [['heard', 'person', 'acl:relcl'], ['who', 'heard', 'obl'], ['of', 'who', 'case']]],
    ['I told him she left.', 'told', [['him', 'told', 'iobj'], ['left', 'told', 'ccomp'], ['she', 'left', 'nsubj']]],
    ['I informed him she left.', 'informed', [['him', 'informed', 'iobj'], ['left', 'informed', 'ccomp'], ['she', 'left', 'nsubj']]],
    ['I told my friends he had left.', 'told', [['friends', 'told', 'iobj'], ['left', 'told', 'ccomp']]],
    ['I know she left.', 'know', [['left', 'know', 'ccomp'], ['she', 'left', 'nsubj']]],
    ['The man wearing a hat smiled.', 'smiled', [['wearing', 'man', 'acl'], ['hat', 'wearing', 'obj']]],
    ['The claim that she left surprised me.', 'surprised', [['left', 'claim', 'acl']]],
    ['He became a teacher.', 'became', [['teacher', 'became', 'xcomp']]],
    ['I want to use the key.', 'want', [['use', 'want', 'xcomp'], ['to', 'use', 'mark'], ['key', 'use', 'obj']]],
    ['I might just sell the car and get you to drive me around all winter.', 'sell', [['and', 'get', 'cc'], ['get', 'sell', 'conj'], ['you', 'get', 'obj'], ['drive', 'get', 'xcomp']]],
    ['She will call and ask him to leave.', 'call', [['and', 'ask', 'cc'], ['ask', 'call', 'conj'], ['him', 'ask', 'obj'], ['leave', 'ask', 'xcomp']]],
    ['They got him to leave.', 'got', [['him', 'got', 'obj'], ['leave', 'got', 'xcomp']]],
    ['She bought a ticket to travel.', 'bought', [['travel', 'bought', 'advcl']]],
    ['We went to school.', 'went', [['school', 'went', 'obl'], ['to', 'school', 'case']]],
    ['It was close. To the east, a bird sang.', 'close', [['sang', 'close', 'parataxis'], ['east', 'sang', 'obl']]],
    ['We saw a lot. Of course we left.', 'saw', [['lot', 'saw', 'obj'], ['left', 'saw', 'parataxis']]],
  ] as const;
  for (const [sentence, root, edges] of cases) {
    const tree = drawTree(sentence, 'dependency', pos);
    expect(tree.nodes.find(node => node.id === tree.root)?.label, sentence).toBe(root);
    for (const [word, head, role] of edges) {
      const dependent = tree.nodes.find(node => node.label === word);
      expect(dependent?.role, `${sentence} ${word}`).toBe(role);
      expect(tree.nodes.find(node => node.label === head)?.children, `${sentence} ${word}`).toContain(dependent?.id);
    }
  }
  expect(treeText(drawTree('That she left surprised me.', 'constituency', pos))).toContain('[VBD surprised]');
  expect(treeText(drawTree('He became a teacher.', 'constituency', pos))).toContain('[VBD became]');
  expect(treeText(drawTree('I bought the book you recommended.', 'constituency', pos))).toContain('[NN book₁]] [SBAR [NP [PRP you]] [VP [VBD recommended] t₁]');
  expect(treeText(drawTree('She bought a lot of books.', 'constituency', pos))).toContain('[DT "a lot of"]');
  expect(treeText(drawTree('The house you live in is old.', 'constituency', pos))).toContain('[VP [VBP live] [PP [IN in] t₁]]');
});

it.each([['offline', undefined], ['dictionary', lookup]] as const)('indexes the subject of an inverted passive (%s)', (_, pos) => {
  for (const sentence of ['Was the letter written yesterday?', 'Has the letter been written?']) {
    const tree = drawTree(sentence, 'constituency', pos);
    const gap = tree.nodes.find(node => isTraceLabel(node.label));
    expect(gap?.label, sentence).toBe('t₁');
    const predicate = tree.nodes.find(node => node.children.includes(gap!.id));
    expect(predicate?.label, sentence).toBe('VP');
    expect(tree.nodes.some(node => node.label === 'letter₁'), sentence).toBe(true);
    for (const form of treeForms) {
      expect(treeFileName(drawTree(sentence, form, pos)), `${sentence} ${form}`).toBe(sentenceFileName(sentence.slice(0, -1)));
    }
  }
});

it.each([['offline', undefined], ['dictionary', lookup]] as const)('derives paired comparative correlatives (%s)', (_, pos) => {
  for (const sentence of ['the more you read, the more you learn', 'the less she eats, the thinner she gets', 'the harder you work, the better you become']) {
    const ccg = drawTree(sentence, 'ccg', pos);
    expect(ccg.nodes[0].label, sentence).toBe('S');
    expect(ccg.nodes.some(node => node.label === '?'), sentence).toBe(false);
    expect(treeText(ccg)).toContain('Corr');
    for (const form of treeForms) expect(treeFileName(drawTree(sentence, form, pos)), `${sentence} ${form}`).toBe(sentenceFileName(sentence.replace(/[,.;:!?]/gu, '')));
  }
  for (const input of ['(S (CMP (DT the) (QP (JJ more))) (S (NP (PRP you)) (VP (VBP read))))', '(S (S (CMP (DT the) (QP (JJ more))) (S (NP (PRP you)) (VP (VBP read)))) (NP (DT the) (NN cat)))']) expect(drawTree(input, 'ccg').nodes[0].label).toBe('?');
  expect(treeText(drawTree('the number of students is rising', 'ccg', pos))).not.toContain('Corr');
});

it.each([['offline', undefined], ['dictionary', lookup]] as const)('keeps prepositional passive gaps and lexical CCG valency (%s)', (_, pos) => {
  for (const sentence of ['the bed was slept in', 'the bed has been slept in', 'the child was looked after', 'the children were looked after by Mary', 'the chair was sat on', 'the problem was talked about']) {
    const phrase = drawTree(sentence, 'constituency', pos);
    const gap = phrase.nodes.find(node => isTraceLabel(node.label))!;
    expect(gap, sentence).toBeDefined();
    const pp = phrase.nodes.find(node => node.children.includes(gap.id))!;
    expect(pp.label, sentence).toBe('PP');
    const preposition = phrase.nodes.find(node => node.id === pp.children[0])!;
    expect(preposition.label, sentence).toBe('IN');
    expect(treeText(drawTree(sentence, 'ccg', pos)), sentence).toContain('(S\\NP)/(PP/NP)');
    expect(drawTree(sentence, 'ccg', pos).nodes.some(node => node.label === '?'), sentence).toBe(false);
    const dependency = drawTree(sentence, 'dependency', pos);
    expect(dependency.nodes.find(node => node.label === phrase.nodes.find(node => node.id === preposition.children[0])!.label)?.role, sentence).toBe('case');
    expect(dependency.nodes.some(node => isTraceLabel(node.label)), sentence).toBe(false);
    for (const form of treeForms) expect(treeFileName(drawTree(sentence, form, pos)), `${sentence} ${form}`).toBe(sentenceFileName(sentence.replace(/[,.;:!?]/gu, '')));
  }
});

it('keeps particles and ordinary temporal adverbs out of stranded-preposition frames', () => {
  for (const sentence of ['the work was handed in', 'the meeting was called off']) {
    const tree = drawTree(sentence, 'constituency', lookup);
    const gap = tree.nodes.find(node => isTraceLabel(node.label))!;
    expect(gap, sentence).toBeDefined();
    expect(tree.nodes.find(node => node.children.includes(gap.id))?.label, sentence).toBe('VP');
    expect(treeText(tree), sentence).toContain('[PRT [RP');
    expect(drawTree(sentence, 'ccg', lookup).nodes.some(node => node.label === '?'), sentence).toBe(false);
  }
  for (const sentence of ['she has finished after', 'she slept in', 'she looks after the child']) {
    expect(drawTree(sentence, 'constituency', lookup).nodes.some(node => isTraceLabel(node.label)), sentence).toBe(false);
  }
});

it('resolves regular degree morphology without borrowing noun or verb readings', () => {
  for (const [word, base] of [['thinner', 'thin'], ['happier', 'happy'], ['largest', 'large'], ['biggest', 'big']]) {
    expect(lemmaReadings(word)).toContainEqual({ candidate: base, allowed: ['adjective', 'adverb'] });
  }
  expect(lemmaReadings('teacher').some(reading => reading.candidate === 'teach' && reading.allowed?.includes('verb'))).toBe(false);
  expect(lemmaCandidates('thinner', undefined, 'verb')).not.toContain('thin');
  expect(lemmaCandidates('handed', undefined, 'verb')).toContain('hand');
  expect(resolvePos('thinner', new Map([['t', { thin: (5 << 8) | (7 << 4) | 3 }]]))).toEqual({ adjective: 5, adverb: 0, verb: 0, noun: 0 });
});
