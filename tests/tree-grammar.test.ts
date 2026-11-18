import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { drawTree, treeForms, type TreeDiagram } from '../src/shared/tree';
import { grammarCases } from './fixtures/tree-grammar-cases';
import { resolvePos, type WordNetPos } from '../src/shared/wordnet-pos';

// The installed Open English WordNet buckets, read the way the page reads them.
const letters = [...'abcdefghijklmnopqrstuvwxyz0'];
const buckets = new Map(letters.map(letter => [letter, JSON.parse(readFileSync(`public/dictionary/oewn-2025/pos-${letter}.json`, 'utf8')) as Record<string, number>]));
const forms = JSON.parse(readFileSync('public/dictionary/oewn-2025/forms.json', 'utf8')) as Record<string, string[]>;
const parts: WordNetPos[] = ['noun', 'verb', 'adjective', 'adverb'];
const lookup = (word: string) => {
  const counts = resolvePos(word, buckets, forms);
  const ordered = parts.filter(part => counts[part] > 0).map(part => [part, counts[part]] as const);
  return ordered.length ? ordered : undefined;
};

function shape(diagram: TreeDiagram) {
  const byId = new Map(diagram.nodes.map(node => [node.id, node]));
  const walk = (id: string): string => {
    const node = byId.get(id)!;
    return node.children.length ? `(${node.label} ${node.children.map(walk).join(' ')})` : node.label;
  };
  return walk(diagram.root);
}

const draw = (sentence: string) => shape(drawTree(sentence, 'constituency', lookup));

// The checklist names far more structures than one corpus can hold. This table covers every
// family in it: each sentence must draw in all nine presentations, and the fragments below pin the
// analyses that were reviewed as correct. Structures still analysed wrongly are listed in Issues.md.
it('draws one representative sentence for every structure family in the checklist', () => {
  const failures: string[] = [];
  for (const { id, sentence } of grammarCases) {
    try {
      drawTree(sentence, 'constituency', lookup);
      for (const form of treeForms) drawTree(sentence, form, lookup);
    } catch { failures.push(`${id} ${sentence}`); }
  }
  expect(failures, failures.join('\n')).toEqual([]);
});

it('keeps the reviewed clause, phrase and morphology frames', () => {
  const expected: [string, string][] = [
    // 67-70: intransitive, transitive, ditransitive.
    ['the baby slept', '(S (NP (DT the) (NN baby)) (VP (VBD slept)))'],
    ['the teacher gave the students a test', '(S (NP (DT the) (NN teacher)) (VP (VBD gave) (NP (DT the) (NNS students)) (NP (DT a) (NN test))))'],
    // 71-73: linking verb plus adjective, nominal and locative.
    ['he is happy', '(S (NP (PRP he)) (VP (VBZ is) (ADJP (JJ happy))))'],
    ['she became a doctor', '(S (NP (PRP she)) (VP (VBD became) (NP (DT a) (NN doctor))))'],
    ['they elected him president', '(S (NP (PRP they)) (VP (VBD elected) (NP (PRP him)) (NP (NN president))))'],
    // 78: obligatory locative.
    ['he put the book on the table', '(VP (VBD put) (NP (DT the) (NN book)) (PP (IN on) (NP (DT the) (NN table))))'],
    // 107-115: existential, raised and ambient frames.
    ['there is a book on the table', '(S (NP (EX there)) (VP (VBZ is) (NP (DT a) (NN book)) (PP (IN on) (NP (DT the) (NN table)))))'],
    ['there appears to be a problem', '(S (NP (EX there)) (VP (VBZ appears)'],
    ['it is raining', '(S (NP (PRP it)) (VP (VBZ is) (VP (VBG raining))))'],
    // 88 and 97-101: imperative and wh-exclamative.
    ['open the window', '(S (VP (VB open) (NP (DT the) (NN window))))'],
    ['be quiet', '(S (VP (VB be) (ADJP (JJ quiet))))'],
    ['what a beautiful day', '(S (EXC (WDT what) (NP (DT a) (JJ beautiful) (NN day))))'],
    ['how kind she is', '(S (EXC (WRB how) (ADJP (JJ kind))) (S (NP (PRP she)) (VP (VBZ is))))'],
    // 139-178: determiners, premodifiers, both genitives, partitives, postpositive adjectives.
    ['the tall student read the old book', '(S (NP (DT the) (JJ tall) (NN student)) (VP (VBD read) (NP (DT the) (JJ old) (NN book))))'],
    ["the student's book is new", "(S (NP (NP (DT the) (NN student) (POS 's)) (NN book)) (VP (VBZ is) (ADJP (JJ new))))"],
    ["the students' books are new", "(S (NP (NP (DT the) (NNS students) (POS ')) (NNS books)) (VP (VBP are) (ADJP (JJ new))))"],
    ['a friend of mine arrived', '(PP (IN of) (NP (PRP mine)))'],
    ['I met something strange', '(NP (NP (NN something)) (ADJP (JJ strange)))'],
    // 201-204: plural-only and collective agreement.
    ['the news is important', '(S (NP (DT the) (NNS news)) (VP (VBZ is) (ADJP (JJ important))))'],
    ['the police are coming', '(S (NP (DT the) (NN police)) (VP (VBP are) (VP (VBG coming))))'],
    // 231-272: quantity and partitives.
    ['two students came', '(S (NP (CD two) (NNS students)) (VP (VBD came)))'],
    ['a few students came', '(NP (DT a few) (NNS students))'],
    ['most of the students passed', '(NP (QP (RB most)) (PP (IN of) (NP (DT the) (NNS students))))'],
    ['half of the cake was eaten', '(NP (QP (PDT half₁)) (PP (IN of)'],
    // 355 and 374: reciprocal pronoun, parenthetical preposition.
    ['they like each other', '(NP (PRP each other))'],
    ['John as well as Mary came', '(PP (IN as well as) (NP (NNP Mary)))'],
    // 412-468: adjective order, intensifiers, adverbs, postpositive adjective.
    ['she bought a big red ball', '(NP (DT a) (JJ big) (JJ red) (NN ball))'],
    ['she is very happy', '(ADJP (RB very) (ADJP (JJ happy)))'],
    ['she always arrives late', '(VP (ADVP (RB always))'],
    // A postpositive adjective is drawn as a flat nominal modifier, as many treebanks do.
    ['the people present were angry', '(NP (DT the) (NNS people) (JJ present))'],
    // 500-582: prepositional phrases.
    ['we met at five', '(PP (IN at) (NP (CD five)))'],
    ['despite the rain, we walked', '(ADJX (PP (IN despite) (NP (DT the) (NN rain))) (, ,))'],
    ['according to the rules, we must stop', '(IN according to)'],
    ['she travelled by train', '(PP (IN by)'],
    ['she enjoys sports such as tennis', '(IN such as)'],
    ['after finishing the work, she left', '(PP (IN after) (VP (VBG finishing)'],
    // 624-664: tense, aspect and future time.
    ['she reads books', '(S (NP (PRP she)) (VP (VBZ reads) (NP (NNS books))))'],
    ['she is reading a book', '(VP (VBZ is) (VP (VBG reading) (NP (DT a) (NN book))))'],
    ['she has finished the work', '(VP (VBZ has) (VP (VBN finished) (NP (DT the) (NN work))))'],
    ['she has been working all day', '(VP (VBN been) (VP (VBG working) (NP-TMP (DT all) (NN day))))'],
    ['she will come tomorrow', '(VP (MD will) (VP (VB come) (ADVP (RB tomorrow))))'],
    ['she is going to visit us', '(VP (IN going to) (VP (VB visit) (NP (PRP us))))'],
    ['she is about to leave', '(VP (IN about to) (VP (VB leave)))'],
    ['when she arrives, we will start', '(ADJX (SBAR (WHADVP (WRB when))'],
    ['she left two hours ago', '(ADVP (RB ago))'],
    // 700-735: modality.
    ['she can swim', '(S (NP (PRP she)) (VP (MD can) (VP (VB swim))))'],
    ['she should have called', '(VP (MD should) (VP (VB have) (VP (VBN called)))'],
    ['she need not come', '(S (NP (PRP she)) (VP (MD need) (VP (ADVP (RB not)) (VB come))))'],
    ['she is likely to win', '(ADJP (JJ likely) (VP (TO to)'],
    ['it is likely that she will win', '(SBAR (IN that) (S (NP (PRP she)) (VP (MD will)'],
    // 776-818: passive, causative and perception.
    ['the letter was written by John', '(PP (IN by) (NP (NN John)))'],
    ['the students were given a test', '(VP (VBN given) t₁ (NP (DT a) (NN test)))'],
    ['she was seen leaving', '(VP (VBN seen) t₁ (VP (VBG leaving)))'],
    // Causative "have" keeps its object and its participial complement inside one verb phrase.
    ['she had her car repaired', '(VP (VBD had) (NP (NP (PRP$ her) (NN car)) (ADJP (VBN repaired)))'],
    // 845-902: negation.
    ['she does not like coffee', '(S (NP (PRP she)) (VP (VBZ does) (VP (ADVP (RB not)) (VB like) (NP (NN coffee)))))'],
    ['do not go', '(VP (VBP do) (VP (ADVP (RB not)) (VB go)))'],
    ['nobody came', '(NP (NN nobody))'],
    // A negated quantifier opens the clause with its own adverb phrase.
    ['not all students passed', '(S (ADVP (RB not)) (NP (DT all) (NNS students)) (VP (VBD passed)))'],
    // 913-960: questions and question tags.
    ['is she happy', '(S (SQ (VBZ is) (NP (PRP she)) (ADJP (JJ happy))))'],
    ['did she go', '(S (SQ (VBD did) (NP (PRP she)) (VP (VB go))))'],
    ['who wrote this letter', '(S (SBARQ (WHNP (WP who₁)) (S t₁ (VP (VBD wrote) (NP (DT this) (NN letter))))))'],
    ['what did you see', '(S (SBARQ (WHNP (WDT what₁)) (SQ (VBD did) (NP (PRP you)) (VP (VB see) t₁))))'],
    ['how old is she', '(S (SBARQ (WHADVP (WRB how₁) (ADJP (JJ old))) (SQ (VBZ is) (NP (PRP she)) (ADJP t₁))))'],
    ['with whom did she speak', '(S (SBARQ (PP (IN with) (WHNP (WP whom₁)))'],
    ["she is happy, isn't she", '(TG (, ,) (TGC (VBZ is) (TGC (RB n'],
    // 1001-1149: complementation.
    ['she wants to go', '(S (NP (PRP she)) (VP (VBZ wants) (VP (TO to) (VP (VB go)))))'],
    ['she enjoys reading', '(S (NP (PRP she)) (VP (VBZ enjoys) (VP (VBG reading))))'],
    ['she insisted on paying', '(VP (VBD insisted) (PP (IN on)'],
    ['they regarded him as a hero', '(PP (IN as) (NP (DT a) (NN hero)))'],
    ['she turned water into ice', '(PP (IN into) (NP (NN ice)))'],
    ['she translated the book from French into English', '(PP (IN from) (NP (NN French)))'],
    // 1154-1197: noun clauses.
    ['she said that she was tired', '(SBAR (IN that) (S (NP (PRP she)) (VP (VBD was)'],
    ['whether she comes is unclear', '(S (SBAR (IN whether) (S (NP (PRP she)) (VP (VBZ comes))))'],
    ['I wonder whether she will come', '(SBAR (IN whether) (S (NP (PRP she)) (VP (MD will) (VP (VB come))))'],
    ['she told me that she was late', '(VP (VBD told) (NP (PRP me)) (SBAR (IN that)'],
    ['I asked her whether she was ready', '(VP (VBD asked) (NP (PRP her)) (SBAR (IN whether)'],
    ['I suggested that she leave', '(SBAR (IN that) (S (NP (PRP she)) (VP (VBP leave))))'],
    // 1234-1274: relative clauses.
    ['the man who came is my uncle', '(SBAR (WHNP (WP who₁)) (S t₁ (VP (VBD came))))'],
    // An object relative ends in the empty category the moved object left behind.
    ['the book that I read is good', '(SBAR (IN that) (S (NP (PRP I)) (VP (VBD read))))'],
    ['the book I read is good', '(NP (NP (DT the) (NN book₁)) (SBAR (NP (PRP I)) (VP (VBD read) t₁))'],
    ['the man whose car was stolen called the police', '(WHNP (WP$ whose₁) (NOM (NN car)))'],
    ['the house where I live is old', '(WHADVP (WRB where₁))'],
    ['the house in which I live is old', '(WHPP (IN in) (WHNP (WDT which₁)))'],
    ['the man sitting by the window is my father', '(NP (NP (DT the) (NN man)) (VP (VBG sitting) (PP (IN by)'],
    ['whoever comes is welcome', '(SBAR (WHNP (WP whoever)) (S (VP (VBZ comes))))'],
    // 1307-1383: non-finite clauses.
    ['her job is teaching', '(VP (VBG teaching))'],
    ['it is hard to learn Chinese', '(ADJP (JJ hard) (VP (TO to) (VP (VB learn)'],
    ['exhausted, she sat down', '(ADJX (ADJP (VBN exhausted)) (, ,))'],
    ['with the work finished, she left', '(PP (IN with)'],
    ['arriving home, she went to bed', '(ADJX (VP (VBG arriving) (ADVP (RB home))) (, ,))'],
    ['she left early in order to catch the train', '(IN in order to)'],
    ['I do not know what to do', '(SBAR (WHNP (WDT what)) (VP (TO to)'],
    ['I asked how to do it', '(SBAR (WHADVP (WRB how₁)) (VP (TO to) (VP (VB do) (NP (PRP it))) (ADVP t₁)))'],
    ['she seems to have left', '(VP (TO to) (VP (VB have) (VP (VBN left)))'],
    // 1384-1453: adverbial clauses.
    ['when she arrived, we left', '(ADJX (SBAR (WHADVP (WRB when))'],
    ['because she was tired, she left', '(SBAR (IN because)'],
    ['although she was tired, she stayed', '(SBAR (IN although)'],
    ['unless you hurry, you will miss it', '(SBAR (IN unless)'],
    ['she left early so that she could catch the train', '(SBAR (IN so that) (S (NP (PRP she)) (VP (MD could)'],
    ['she was so tired that she fell asleep', '(RB so)'],
    ['as long as you agree, we can proceed', '(SBAR (IN as long as)'],
    ['whenever she comes, she brings gifts', '(SBAR (IN whenever)'],
    // 1454-1530: conditionals and wishes.
    ['if it rains, we will stay', '(SBAR (IN if)'],
    ['if it had rained, we would have stayed', '(VBN rained)'],
    ['if I were you, I would go', '(VBD were)'],
    ['had I known, I would have told you', '(SBAR (VBD had)'],
    ['should it rain, we will stay', '(SBAR (MD should)'],
    ['provided that you agree, we will proceed', '(IN provided that)'],
    // A complementizer-less clause complement is an SBAR with no written marker.
    ['I wish I knew the answer', '(VP (VBP wish) (S (NP (PRP I)) (VP (VBD knew)'],
    ['I wish she would come', '(VP (VBP wish) (S (NP (PRP she)) (VP (MD would) (VP (VB come))))'],
    // 1531-1592: comparison.
    // The comparative adjective keeps its -er tag once it is not forced by the closed list.
    ['she is taller than me', '(ADJP (JJR taller) (PP (IN than) (NP (PRP me))))'],
    ['she is as tall as her brother', '(ADJP (JJ tall) (PP (IN as) (NP (PRP$ her) (NN brother))))'],
    ['this is the best book of the year', '(JJS best) (NN book)'],
    ['she bought the same book as me', '(PP (IN as) (NP (PRP me)))'],
    // 1609-1688: coordination and ellipsis.
    ['she sang and danced', '(CC and)'],
    ['either she or I was wrong', '(CC or)'],
    ['neither she nor I was there', '(CC nor)'],
    ['not only she but also I was wrong', '(CC but also)'],
    ['she has finished, and so have I', '(CC and)'],
    // 1689-1751: inversion and focus.
    ['never have I seen such a thing', '(SQ (VBP have) (NP (PRP I))'],
    ['no sooner had I left than it rained', '(SBAR (IN than) (S (NP (PRP it)) (VP (VBD rained))))'],
    ['only by working hard can you succeed', '(SQ (MD can)'],
    ['it was John who broke the window', '(NP (NNP John))'],
    ['as for me, I disagree', '(IN as for)'],
    ['regarding the plan, I agree', '(PP (VBG regarding) (NP (DT the) (NN plan)))'],
    // Defects previously recorded in Issues.md, each with its corrected analysis.
    ['how many students came', '(S (SBARQ (WHNP (WRB how₁) (NOM (JJ many) (NNS students))) (S t₁ (VP (VBD came)))))'],
    ['not until midnight did she leave', '(S (PP (RB not) (PP (IN until) (NP (NN midnight)))) (SQ (VBD did) (NP (PRP she)) (VP (VB leave))))'],
    ['she had better go', '(S (NP (PRP she)) (VP (MD had better) (VP (VB go))))'],
    ['she is busy working', '(ADJP (JJ busy) (VP (VBG working)))'],
    ['she spent two hours working', '(VP (VBD spent) (NP (CD two) (NNS hours)) (VP (VBG working)))'],
    ['she went shopping', '(S (NP (PRP she)) (VP (VBD went) (VP (VBG shopping))))'],
    ['having finished the work, she left', '(S (ADJX (VP (VBG having) (VP (VBN finished) (NP (DT the) (NN work)))) (, ,))'],
    ['she spoke as if she knew the answer', '(SBAR (IN as if) (S (NP (PRP she)) (VP (VBD knew) (NP (DT the) (NN answer))))'],
    ['he likes tea, whereas she prefers coffee', '(S (S (NP (PRP he)) (VP (VBZ likes) (NP (NN tea))) (, ,)) (SBAR (IN whereas)'],
    ['it is time we left', '(S (NP (PRP it)) (VP (VBZ is) (NP (NN time)) (SBAR (NP (PRP we)) (VP (VBD left))))'],
    ['I would rather you came tomorrow', '(VP (MD would) (VP (RB rather) (S (NP (PRP you)) (VP (VBD came)'],
    ['she has more books than I need', '(NP (QP (JJR more)) (NNS books)) (SBAR (IN than) (S (NP (PRP I)) (VP (VBD need))))'],
    ['the more you read, the more you learn', '(S (S (CMP (DT the) (QP (JJ more))) (S (NP (PRP you)) (VP (VBD read)) (, ,))) (S (CMP (DT the) (QP (JJ more))) (S (NP (PRP you)) (VP (VBP learn))))'],
    ['the weather is getting better and better', '(JJR better)'],
    // The five parse defects recorded in Issues.md, each now drawn from general rules.
    ['try as she might she failed', '(S (SBAR (VP (VB try)) (SBAR (IN as) (S (NP (PRP she)) (VP (MD might))))) (S (NP (PRP she)) (VP (VBD failed))))'],
    ['much as she tried she failed', '(S (SBAR (ADVP (RB much)) (SBAR (IN as) (S (NP (PRP she)) (VP (VBD tried))))) (S (NP (PRP she)) (VP (VBD failed))))'],
    ['such a lovely day', '(S (NP (DT such) (DT a) (JJ lovely) (NN day)))'],
    ['never have I seen such a thing', '(VP (VBN seen) (NP (DT such) (DT a) (NN thing)))'],
    ['she made it clear that she was unhappy', '(VP (VBD made) (NP (PRP it)) (ADJP (JJ clear)) (SBAR (IN that) (S (NP (PRP she)) (VP (VBD was) (ADJP (JJ unhappy)))))'],
    ['the heartbreaking news', '(NP (DT the) (JJ heartbreaking) (NNS news))'],
    ['it is twenty per cent taller than before', '(QP (CD twenty) (NN per cent))'],
    // The two defects that remained after the previous pass, plus the copula splits they exposed.
    ['he was made to work', '(VP (VBD was) (VP (VBN made) t₁ (VP (TO to) (VP (VB work))))'],
    ['the students, many of whom were tired, left', '(VP (VBD were) (ADJP (JJ tired)))'],
    ['the students who were tired left', '(S (NP (NP (DT the) (NNS students)) (SBAR (WHNP (WP who₁)) (S t₁ (VP (VBD were) (ADJP (JJ tired)))))) (VP (VBD left))'],
    ['they were very tired', '(ADJP (RB very) (ADJP (JJ tired)))'],
    ['it is essential that she be informed', '(VP (VB be) (VP (VBN informed) t₁))'],
    ['it is raining', '(VP (VBZ is) (VP (VBG raining))'],
    ['the children were singing and dancing', '(VP (VBD were) (VP (VBG singing)))'],
    ['the police are coming', '(VP (VBP are) (VP (VBG coming))'],
    ['the letter was written by my father', '(VP (VBD was) (VP (VBN written) t₁ (PP (IN by)'],
    ['she was seen leaving', '(VP (VBD was) (VP (VBN seen) t₁ (VP (VBG leaving)))'],
    // A two-comma appositive keeps both commas with the subject nominal.
    // Both commas stay on the subject nominal and the relative has its own clause.
    ['my brother, who lives in Paris, is a doctor', '(NP (NP (NP (NP (PRP$ my) (NN brother)) (, ,)) (SBAR (WHNP (WP who₁)) (S t₁ (VP (VBZ lives)'],
    ['she is as tall as her brother', '(ADJP (RB as) (ADJP (JJ tall) (PP (IN as) (NP (PRP$ her) (NN brother)))))'],
    ['she is not as tall as her brother', '(ADJP (RB not) (ADJP (RB as) (ADJP (JJ tall) (PP (IN as) (NP (PRP$ her) (NN brother))))))'],
    // A perception verb keeps its gerund complement.
    ['she saw him crossing the road', '(VP (VBD saw) (NP (PRP him)) (VP (VBG crossing) (NP (DT the) (NN road)))'],
    // An object relative ends in the empty category the moved object left behind.
    ['the book which I read is good', '(SBAR (WHNP (WDT which₁)) (S (NP (PRP I)) (VP (VBD read) t₁)))'],
    // PP attachment defaults to the verb phrase, and to the nominal only before the verb.
    ['they met the students in the library', '(VP (VBD met) (NP (DT the) (NNS students)) (PP (IN in) (NP (DT the) (NN library))))'],
    ['the book on the desk belongs to me', '(NP (NP (DT the) (NN book)) (PP (IN on) (NP (DT the) (NN desk))))'],
    // 1756-1760: discourse markers.
    ['oh, I see', '(ADJX (UH oh) (, ,))'],
    ['yes, it is true', '(ADJX (UH yes) (, ,))'],
  ];
  const wrong: string[] = [];
  for (const [sentence, fragment] of expected) {
    const tree = draw(sentence);
    if (!tree.includes(fragment)) wrong.push(`${sentence}\n  expected ${fragment}\n  got      ${tree}`);
  }
  expect(wrong, wrong.join('\n\n')).toEqual([]);
});
