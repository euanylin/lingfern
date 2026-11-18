import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { drawTree } from '../src/shared/tree';
import { lemmaCandidates, loadWordNetPos, resolvePos, type WordNetPos } from '../src/shared/wordnet-pos';
import { fallbackAdjectives, fallbackAdverbs, fallbackNouns, fallbackVerbs, finiteClauseVerbs, objectInfinitiveVerbs } from '../src/shared/tree-lexicon';
import { parseTaggedSentence } from '../src/shared/tree-parse';
import type { RawNode } from '../src/shared/tree-forms';
import { auxiliaryKey } from '../src/shared/tree-auxiliary';

// These files are generated from the installed Open English WordNet buckets by `npm run dictionary:index`.
const letters = [...'abcdefghijklmnopqrstuvwxyz0'];
const buckets = new Map(letters.map(letter => [letter, JSON.parse(readFileSync(`public/dictionary/oewn-2025/pos-${letter}.json`, 'utf8')) as Record<string, number>]));
const forms = JSON.parse(readFileSync('public/dictionary/oewn-2025/forms.json', 'utf8')) as Record<string, string[]>;
const parts: WordNetPos[] = ['noun', 'verb', 'adjective', 'adverb'];
const lookup = (word: string) => {
  const counts = resolvePos(word, buckets, forms);
  const ordered = parts.filter(part => counts[part] > 0).map(part => [part, counts[part]] as const);
  return ordered.length ? ordered : undefined;
};

const shape = (diagram: ReturnType<typeof drawTree>) => {
  const byId = new Map(diagram.nodes.map(node => [node.id, node]));
  const walk = (id: string): string => { const node = byId.get(id)!; return node.children.length ? `(${node.label} ${node.children.map(walk).join(' ')})` : node.label; };
  return walk(diagram.root);
};

it('keeps the matrix predicate outside a long subject relative', () => {
  const sentence = 'The researcher who had spent several years studying the birds that live near the river explained that the changes which the team had recorded during the winter were important because the local people who had watched the water rise after the heavy rain needed clear information before they could decide whether they should move their animals to the fields that were farther from the village and the school where the children met every morning.';
  const tree = drawTree(sentence, 'dependency', lookup);
  expect(tree.nodes.find(node => node.id === tree.root)?.label).toBe('explained');
  expect(tree.nodes.find(node => node.label === 'researcher')?.role).toBe('nsubj');
  expect(tree.nodes.find(node => node.label === 'important')?.role).toBe('ccomp');
});

it('uses the closing comma to separate a fronted subordinate clause from its matrix clause', () => {
  const sentence = 'Although the teacher who had prepared the lesson explained the difficult problem before the students opened their books, the students who were sitting near the window asked several questions because they wanted to understand the answer and the teacher gave them more examples after the lesson had ended.';
  const tree = drawTree(sentence, 'dependency', lookup);
  expect(tree.nodes.find(node => node.id === tree.root)?.label).toBe('asked');
  expect(tree.nodes.find(node => node.label === 'explained')?.role).toBe('advcl');
  expect(tree.nodes.find(node => node.label === 'opened')?.role).toBe('advcl');
});

it('retains finite predicates across a punctuated 151-word clause coordination', () => {
  const clauses = [
    ['the teacher read the old book in the quiet library', 'read'],
    ['the student wrote a short letter to her friend', 'wrote'],
    ['the children played in the garden near the school', 'played'],
    ['the parents waited at the station for the train', 'waited'],
    ['the doctor worked at the hospital during the night', 'worked'],
    ['the farmer walked to the village after the storm', 'walked'],
    ['the artist painted a picture of the river', 'painted'],
    ['the musician sang a song for the audience', 'sang'],
    ['the driver stopped the bus near the old bridge', 'stopped'],
    ['the manager opened the office before the meeting', 'opened'],
    ['the visitor bought a map of the city', 'bought'],
    ['the librarian found the book on the shelf', 'found'],
    ['the scientist recorded the results of the experiment', 'recorded'],
    ['the gardener planted the flowers beside the wall', 'planted'],
    ['the cook prepared the meal for the guests', 'prepared'],
    ['the sailor watched the birds above the sea', 'watched'],
  ];
  const sentence = `${clauses.map(([clause]) => clause).join(', and ')}.`;
  const tree = drawTree(sentence, 'dependency', lookup);
  expect(tree.nodes.find(node => node.id === tree.root)?.label).toBe('read');
  expect(tree.nodes.filter(node => node.role === 'conj').map(node => node.label)).toEqual(clauses.slice(1).map(([, predicate]) => predicate));
}, 15_000);

it('reads parts of speech from the installed WordNet index, including inflections', () => {
  expect(lookup('cat')).toEqual([['noun', 9], ['verb', 2]]);
  expect(lookup('students')).toEqual([['noun', 2]]);
  expect(lemmaCandidates('students', forms)).toContain('student');
  expect(lookup('sat')).toEqual([['noun', 1], ['verb', 10]]);
  expect(lemmaCandidates('sat', forms)).toEqual(['sit']);
  expect((lookup('better') ?? []).find(([part]) => part === 'adjective')?.[1]).toBe(15);
  expect(lemmaCandidates('walked', forms)).toContain('walk');
  expect(lookup('zzzzunknown')).toBeUndefined();
});

it('prefers the dictionary reading when a word has noun and verb senses', () => {
  expect(shape(drawTree('the old book is on the table', 'constituency', lookup))).toContain('(NP (DT the) (JJ old) (NN book))');
  expect(shape(drawTree('the cat sat', 'constituency', lookup))).toBe('(S (NP (DT the) (NN cat)) (VP (VBD sat)))');
});

it('draws postmodified NPs and relative clauses with the dictionary lexicon', () => {
  expect(shape(drawTree('the tall student from Boston read the old book in the quiet library', 'constituency', lookup))).toBe('(S (NP (NP (DT the) (JJ tall) (NN student)) (PP (IN from) (NP (NNP Boston)))) (VP (VBD read) (NP (DT the) (JJ old) (NN book)) (PP (IN in) (NP (DT the) (JJ quiet) (NN library)))))');
  expect(shape(drawTree('the man who caught the ball is my uncle', 'constituency', lookup))).toContain('(SBAR (WHNP (WP who₁)) (S t₁ (VP (VBD caught) (NP (DT the) (NN ball)))))');
});

it('loads the lemma letter buckets an irregular form needs', async () => {
  const real = globalThis.fetch;
  const requested: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requested.push(url);
    const bucketName = /pos-([a-z0])\.json$/u.exec(url);
    if (bucketName) {
      // "go" is a verb with ten verb senses and no noun senses.
      const payload = bucketName[1] === 'g' ? { go: 10 << 4 } : {};
      return new Response(JSON.stringify(payload), { status: 200 });
    }
    if (url.endsWith('forms.json')) return new Response(JSON.stringify({ went: ['go'] }), { status: 200 });
    return new Response('missing', { status: 404 });
  }) as typeof fetch;
  try {
    const lookupIrregular = await loadWordNetPos(['went']);
    expect(lookupIrregular?.('went')).toEqual([['verb', 10]]);
    expect(requested.some(url => url.endsWith('pos-w.json'))).toBe(true);
    expect(requested.some(url => url.endsWith('pos-g.json'))).toBe(true);
  } finally { globalThis.fetch = real; }
});

// The packed WordNet counts saturate at 15, so a form such as "played" (noun 15, verb 15) used to
// be read as a noun. These cases pin the inflection and context rules that decide the tag instead.
it('reads verbs by inflection and context rather than a saturated sense count', () => {
  const cst = (sentence: string) => shape(drawTree(sentence, 'constituency', lookup));
  expect(cst('the children played and the parents talked')).toBe('(S (S (NP (DT the) (NNS children)) (VP (VBD played))) (CC and) (S (NP (DT the) (NNS parents)) (VP (VBD talked))))');
  expect(cst('the children played')).toBe('(S (NP (DT the) (NNS children)) (VP (VBD played)))');
  expect(cst('the tall student read the old book')).toBe('(S (NP (DT the) (JJ tall) (NN student)) (VP (VBD read) (NP (DT the) (JJ old) (NN book))))');
  // A determiner rules out a verb; a determiner between two nouns marks its adjective.
  expect(cst('the woman in the red coat is my aunt')).toContain('(PP (IN in) (NP (DT the) (JJ red) (NN coat)))');
  // An auxiliary fixes the form of the verb after it.
  expect(cst('she is reading a book')).toContain('(VP (VBZ is) (VP (VBG reading) (NP (DT a) (NN book))))');
  expect(cst('she has finished her homework')).toContain('(VP (VBN finished)');
  expect(cst('the students were given a test')).toContain('(VP (VBN given) t₁ (NP (DT a) (NN test)))');
  // A passive is the standard VP reading, with the agent in a by-phrase.
  expect(cst('the letter was written by my father')).toContain('(VP (VBN written) t₁ (PP (IN by) (NP (PRP$ my) (NN father)))');
  // Do-support leaves the verb bare even with the subject in between.
  expect(cst('did you see the film')).toBe('(S (SQ (VBD did) (NP (PRP you)) (VP (VB see) (NP (DT the) (NN film)))))');
  expect(cst('she does not like coffee')).toBe('(S (NP (PRP she)) (VP (VBZ does) (VP (ADVP (RB not)) (VB like) (NP (NN coffee)))))');
  expect(cst('he did not go to school')).toContain('(VP (ADVP (RB not)) (VB go)');
  // Do-support makes the verb bare even with the subject between them.
  expect(cst('do you understand the question')).toContain('(VP (VB understand) (NP (DT the) (NN question)))');
  // A modal heads its phrase instead of becoming a noun.
  expect(cst('the teacher will give the students a test')).toContain('(VP (MD will) (VP (VB give) (NP (DT the) (NNS students)) (NP (DT a) (NN test))))');
  // A number is a cardinal, and a time expression is its own phrase.
  expect(cst('the two cats sleep')).toContain('(NP (DT the) (CD two) (NNS cats))');
  expect(cst('the small boy ate three apples')).toContain('(NP (CD three) (NNS apples))');
  expect(cst('he bought a new car last week')).toContain('(VP (VBD bought) (NP (DT a) (JJ new) (NN car)) (NP-TMP (JJ last) (NN week)))');
  expect(cst('we will meet at the station tomorrow')).toContain('(ADVP (RB tomorrow))');
  expect(cst('she studies english every day')).toContain('(NP-TMP (DT every) (NN day))');
  // A progressive after be is a verb phrase; a degree adverb makes the participle an adjective.
  // Coordinated verb phrases; the finite auxiliary sits inside the first conjunct.
  expect(cst('the children were singing and dancing')).toContain('(VP (VP (VBD were) (VP (VBG singing))) (CC and) (VP (VBG dancing)))');
  expect(cst('they were very tired')).toBe('(S (NP (PRP they)) (VP (VBD were) (ADJP (RB very) (ADJP (JJ tired)))))');
  // A relative determiner projects WHNP, so the clause reads as a relative clause.
  expect(cst('the city which I visited was beautiful')).toContain('(SBAR (WHNP (WDT which₁)) (S (NP (PRP I)) (VP (VBD visited) t₁))))');
  // A complementizer never turns into a preposition with an object.
  expect(cst('the book that I read is old')).toContain('(SBAR (IN that) (S (NP (PRP I)) (VP (VBD read)))))');
  // A possessive relative pronoun introduces its own phrase.
  expect(cst('the man whose car was stolen called the police')).toContain('(WHNP (WP$ whose₁) (NOM (NN car)))');
  // A participle projects a verb phrase rather than taking a bare object.
  expect(cst('she has been working all day')).toContain('(VP (VBN been) (VP (VBG working) (NP-TMP (DT all) (NN day))))');
  expect(cst('we are going to visit the museum')).toContain('(VP (IN going to) (VP (VB visit)');
});

// The offline fallback lexicon is generated from the installed dictionary, so it must be current and
// it must keep the readings the tagger needs when no dictionary lookup is available.
it('keeps the generated fallback lexicon current and sufficient', () => {
  const checked = spawnSync(process.execPath, ['scripts/tree-lexicon.mjs', '--check'], { encoding: 'utf8' });
  expect(checked.status, `${checked.stdout}${checked.stderr}`).toBe(0);
  for (const word of ['letter', 'city', 'water', 'book', 'window']) expect(fallbackNouns.has(word), word).toBe(true);
  // A word whose verb entry is richer stays a verb: "finger" is in the verb list, not the noun one.
  expect(fallbackVerbs.has('finger')).toBe(true);
  for (const word of ['learn', 'write', 'speak', 'leave', 'carry']) expect(fallbackVerbs.has(word), word).toBe(true);
  for (const word of ['happy', 'tall', 'likely', 'hard']) expect(fallbackAdjectives.has(word), word).toBe(true);
  // Content adverbs come from the dictionary; grammatical ones ("very", "never", "soon") are
  // closed-class entries in the tagger, so they are not expected here.
  for (const word of ['quickly', 'really', 'often', 'hardly']) expect(fallbackAdverbs.has(word), word).toBe(true);
  // A noun must not become an adverb just because it has one adverb sense: "in what way".
  expect(fallbackAdverbs.has('way')).toBe(false);
});

it('tags a plain sentence without a dictionary lookup', () => {
  const tags = (sentence: string) => {
    const out: string[] = [];
    const walk = (node: RawNode) => {
      if (node.children.length === 1 && node.children[0].children.length === 0) out.push(`${node.label}:${node.children[0].label}`);
      node.children.forEach(walk);
    };
    walk(parseTaggedSentence(sentence));
    return out.join(' ');
  };
  // No lookup at all: the generated lexicon and the morphology rules must still read the sentence.
  expect(tags('the tall student read the old book')).toBe('DT:the JJ:tall NN:student VBD:read DT:the JJ:old NN:book');
  expect(tags('she is very happy')).toContain('JJ:happy');
  expect(tags('the letter was written by my father')).toContain('VBN:written');
  // Closed-class adverbs and degree words still work with no lexicon lookup at all.
  expect(tags('she never arrived')).toContain('RB:never');
  expect(tags('she is very happy')).toContain('RB:very');
});

it.each([
  ["We've finished.", 'finished', "'ve", 'aux'],
  ["I'm working.", 'working', "'m", 'aux'],
  ["They're waiting.", 'waiting', "'re", 'aux'],
  ["She'll leave.", 'leave', "'ll", 'aux'],
  ["She's happy.", 'happy', "'s", 'cop'],
  ["He can't swim.", 'swim', 'ca', 'aux'],
  ["He won't leave.", 'leave', 'wo', 'aux'],
  ['He cannot swim.', 'swim', 'can', 'aux'],
  ["We didn't go.", 'go', 'did', 'aux'],
])('keeps the predicate and auxiliary in %s', (sentence, predicate, auxiliary, role) => {
  const tree = drawTree(sentence, 'dependency', lookup);
  expect(tree.nodes.find(node => node.id === tree.root)?.label).toBe(predicate);
  expect(tree.nodes.find(node => node.label === auxiliary)?.role).toBe(role);
  expect(tree.nodes.at(-1)?.label).toBe('.');
  const withoutStop = drawTree(sentence.slice(0, -1), 'dependency', lookup);
  expect(tree.nodes.slice(0, -1).map(node => node.label)).toEqual(withoutStop.nodes.map(node => node.label));
});

it('keeps possessive clitics distinct from unambiguous auxiliary contractions', () => {
  const tree = drawTree("They've read John's book.", 'dependency', lookup);
  expect(tree.nodes.find(node => node.id === tree.root)?.label).toBe('read');
  expect(tree.nodes.find(node => node.label === "'ve")?.role).toBe('aux');
  expect(tree.nodes.find(node => node.label === "'s")?.role).toBe('case');
  expect(tree.nodes.find(node => node.label === 'John')?.role).toBe('nmod:poss');
});

it('normalizes negative auxiliary stems only in a contracted negation', () => {
  expect(auxiliaryKey('CA')).toBe('ca');
  expect(auxiliaryKey('ca', true)).toBe('can');
  expect(auxiliaryKey('wo', true)).toBe('will');
  expect(auxiliaryKey("'m")).toBe('am');
  expect(auxiliaryKey("'s")).toBe("'s");
  expect(auxiliaryKey('constructor')).toBe('constructor');
  expect(auxiliaryKey('__proto__', true)).toBe('__proto__');
});

it('does not replace a grammatical preposition with a rare dictionary adjective', () => {
  expect(shape(drawTree('the sheikh in the chair has left', 'constituency', lookup))).toContain('(PP (IN in)');
  expect(shape(drawTree('the past is important', 'constituency', lookup))).toContain('(NN past)');
});

it('heads a fronted adjunct on its content rather than its comma', () => {
  const tree = drawTree('In London, we worked.', 'dependency', lookup);
  const london = tree.nodes.find(node => node.label === 'London')!;
  const comma = tree.nodes.find(node => node.label === ',')!;
  expect(london.role).toBe('obl');
  expect(london.children).toContain(comma.id);
  expect(tree.nodes.find(node => node.id === tree.root)?.label).toBe('worked');
});

it('uses installed verb evidence for infinitival to without converting nominal destinations', () => {
  expect(shape(drawTree('we want to reinvigorate the process', 'constituency', lookup))).toContain('(TO to)');
  expect(shape(drawTree('we went to school', 'constituency', lookup))).toContain('(PP (IN to)');
});

it('recognizes typographic apostrophes without changing the displayed spelling', () => {
  const tree = drawTree('We’ve finished.', 'dependency', lookup);
  expect(tree.nodes.find(node => node.id === tree.root)?.label).toBe('finished');
  expect(tree.nodes.find(node => node.label === '’ve')?.role).toBe('aux');
  const negative = drawTree('He can’t swim.', 'dependency', lookup);
  expect(negative.nodes.find(node => node.id === negative.root)?.label).toBe('swim');
  expect(negative.nodes.some(node => node.label === 'n’t')).toBe(true);
});


it('reuses pinned WordNet finite-clause frames and irregular forms', () => {
  const source = JSON.parse(readFileSync('content/tree-clause-frames.json', 'utf8'));
  expect(Object.keys(source.verbs)).toHaveLength(490);
  for (const word of Object.keys(source.verbs)) expect(finiteClauseVerbs.has(word), word).toBe(true);
  for (const word of ['think', 'thought', 'say', 'said', 'believe']) expect(finiteClauseVerbs.has(word), word).toBe(true);
  expect(lemmaCandidates('believed').some(word => finiteClauseVerbs.has(word))).toBe(true);
  for (const word of ['run', 'eat', 'sleep']) expect(finiteClauseVerbs.has(word), word).toBe(false);
  expect(shape(drawTree('I think he is right', 'constituency', lookup))).toContain('(VP (VBP think) (S (NP (PRP he))');
  expect(shape(drawTree('she said she was tired', 'constituency', lookup))).toContain('(VP (VBD said) (S (NP (PRP she))');
  expect(shape(drawTree('I want to leave', 'constituency', lookup))).toContain('(VP (VBP want) (VP (TO to)');
});

it('retains source-derived object plus infinitive frames and keeps other verbs out', () => {
  const source = JSON.parse(readFileSync('content/tree-clause-frames.json', 'utf8'));
  expect(source.objectInfinitiveFrame).toBe('vtaa-to-inf');
  for (const word of Object.keys(source.objectInfinitives)) expect(objectInfinitiveVerbs.has(word), word).toBe(true);
  for (const word of ['get', 'got', 'ask', 'want']) expect(objectInfinitiveVerbs.has(word), word).toBe(true);
  for (const word of ['buy', 'bought', 'try']) expect(objectInfinitiveVerbs.has(word), word).toBe(false);
  expect(shape(drawTree('She will call and ask him to leave.', 'constituency', lookup)))
    .toContain('(VP (VB ask) (NP (PRP him)) (VP (TO to)');
});
