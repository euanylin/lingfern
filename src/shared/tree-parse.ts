// A small Penn Treebank II style chart parser for the syntax-tree tool.
// Tags and bracket conventions follow the PTB II bracketing guidelines
// (https://languagelog.ldc.upenn.edu/myl/PennTreebank1995.pdf): flat right-branching
// base NPs, SBAR for relative and subordinate clauses, modifiers under the lowest VP,
// and final punctuation inside S. It is a bounded teaching aid, not a statistical parser.
import { contentHeadIndex, headIndex, isFiniteVerbPhrase, isNominalList, selectsFiniteClause, takesRecipientClause, type RawNode } from './tree-forms';
import { fallbackAdjectives, fallbackAdverbs, fallbackNouns, fallbackVerbs, fallbackVerbReadings, objectInfinitiveVerbs } from './tree-lexicon';
import { isTraceLabel, subscript, withIndex } from './tree-movement';
import { lemmaCandidates, type PosLookup } from './wordnet-pos';
import { auxiliaryKey } from './tree-auxiliary';
import { calendarDateHead, calendarMonth } from './tree-dates';

export type Tag = 'CC' | 'CD' | 'DT' | 'EX' | 'IN' | 'JJ' | 'JJR' | 'JJS' | 'MD' | 'NN' | 'NNS' | 'NNP' | 'NNPS'
  | 'PDT' | 'POS' | 'PRP' | 'PRP$' | 'RB' | 'RBR' | 'RBS' | 'RP' | 'TO' | 'UH' | 'VB' | 'VBD' | 'VBG' | 'VBN'
  | 'VBP' | 'VBZ' | 'WDT' | 'WP' | 'WP$' | 'WRB' | '.' | ',' | ':' | 'PUNCT';

const maxWords = 200;
const titleAbbreviation = /^(?:mr|mrs|ms|dr|prof|sr|jr)\.$/iu;
const writtenAbbreviation = (word: string) => titleAbbreviation.test(word) || /^(?:(?:inc|ltd|co|corp)\.|(?:[a-z]\.){2,})$/iu.test(word);

// Multiword units are merged before tagging, so one token can stand for a fixed phrase. Readable
// labels matter more here than showing every space as a separate leaf.
const compoundPrepositions = [
  'as a result of', 'with regard to', 'in addition to', 'in exchange for', 'in favor of', 'in favour of',
  'in response to', 'in terms of', 'in place of', 'in case of', 'on behalf of', 'regardless of', 'according to',
  'by the time', 'for lack of', 'in the course of', 'as of', 'up to', 'more than', 'less than', 'fewer than',
  'because of', 'instead of', 'in spite of', 'in front of', 'on top of', 'apart from', 'aside from', 'due to',
  'owing to', 'thanks to', 'compared with', 'compared to', 'contrary to', 'prior to', 'close to', 'next to',
  'ahead of', 'out of', 'in between', 'as for', 'rather than', 'such as', 'as well as',
  'as soon as', 'as long as', 'as far as', 'as if', 'as though', 'even though', 'even if', 'so that', 'in case',
  'provided that', 'providing that', 'in order that', 'now that', 'in order to', 'if only', 'so as to',
  'about to', 'going to', 'supposed to', 'due to be', 'set to',
];
const compoundDeterminers = ['a lot of', 'lots of', 'plenty of', 'a great deal of', 'a large number of', 'a couple of', 'a few', 'a little', 'not only', 'a bit of'];
const compoundPronouns = ['each other', 'one another'];
// A measure noun follows a number: "twenty per cent", "five percent".
const compoundMeasures = ['per cent', 'percent'];
const compoundModals = ['had better'];
const compoundAdverbs = ['no longer', 'no sooner', 'at least', 'at most', 'kind of', 'sort of', 'once again', 'one after another', 'one by one',
  'by far', 'than ever', 'than usual', 'than expected', 'for example', 'for instance', 'in fact', 'in general', 'in particular', 'for one thing',
  'above all', 'by the way', 'by contrast', 'in contrast', 'even so', 'in that case', 'after all', 'as a result', 'in addition', 'what is more',
  'that is to say', 'in other words', 'or rather', 'or so', 'if you like', 'or something', 'and things like that', 'on the one hand', 'on the other hand',
  'as far as I know', 'as previously mentioned', 'if you ask me', 'mind you', 'you know', 'I mean', 'as it were'];
const compoundVerbs = ["let's", 'let us'];
const compoundConjunctions = ['but also'];
const compoundPhrases = [...compoundPrepositions, ...compoundDeterminers, ...compoundPronouns, ...compoundMeasures, ...compoundModals, ...compoundAdverbs, ...compoundVerbs, ...compoundConjunctions]
  .sort((left, right) => right.length - left.length);
const fixedPhrases = new Set(compoundPhrases);

const closed: [Tag, string[]][] = [
  ['DT', [...'the a an this that these those some any no every each another either neither such all'.split(' '), ...compoundDeterminers]],
  ['PDT', 'both half'.split(' ')],
  ['PRP$', 'my your his her its our their'.split(' ')],
  ['PRP', [...'i you he she it we they me him her us them mine yours hers ours theirs myself yourself himself herself itself ourselves yourselves themselves'.split(' '), ...compoundPronouns]],
  ['NN', 'something anything nothing everything someone anyone everyone somebody anybody nobody none'.split(' ')],
  ['CC', [...'and or but nor yet so'.split(' '), ...compoundConjunctions]],
  ['MD', [...'will would can could may might shall should must'.split(' '), ...compoundModals]],
  ['TO', 'to'.split(' ')],

  ['WDT', 'which what whatever whichever'.split(' ')],
  ['WP', 'who whom whoever whomever'.split(' ')],
  ['WP$', 'whose'.split(' ')],
  ['WRB', 'where when why how whenever wherever'.split(' ')],
  ['RP', 'up down out off away back apart along'.split(' ')],
  ['UH', 'oh ah hey yes no'.split(' ')],
  ['POS', ["'"]],
  // Degree adverbs are a closed grammatical class, so they belong here rather than in the generated
  // lexicon: "very happy", "quite late", "almost there". Quantifiers such as "more" and "less" stay
  // out because they also head a quantity phrase ("more books").
  ['RB', [..."n't not so too also just always never often here now then well yesterday today tomorrow tonight once twice upstairs downstairs home abroad ago yet neither nor very quite rather extremely fairly absolutely completely really almost".split(' '), ...compoundAdverbs]],
  ['VB', compoundVerbs],
  ['NN', compoundMeasures],
  ['IN', [...'of in on at for with from by about over under into onto after before between without within through during against among around across as than because although though while if unless since until whether like near behind below above toward towards upon per via despite unlike whereas whilst once whenever wherever throughout past beneath underneath alongside beyond besides outside inside opposite amid amidst atop unto plus minus'.split(' '), ...compoundPrepositions]],
];
const nouns = fallbackNouns;
const irregularPast = 'sat said saw went came became ate ran gave took made knew thought found told felt left kept began brought wrote spoke heard bought stood lost paid met led understood slept drank sold sent built fell broke wore won hit cut put set read got did had was were flew threw caught sang rang drove rode rose grew drew forgot held spent taught'.split(' ');
const verbs = fallbackVerbs;
const adverbs = fallbackAdverbs;
const numberWords = new Set('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion'.split(' '));
// Plurals that carry no -s, plus the -f/-fe and vowel-alternation families: "men", "children",
// "people", "criteria", "leaves". Their number decides NNS and subject agreement.
const irregularPlurals = new Set(('men women children people feet teeth mice geese oxen criteria phenomena data media analyses theses crises indices matrices vertices fungi cacti alumni radii sheep deer fish series species aircraft means crossroads offspring salmon trout leaves wolves knives wives lives halves shelves thieves loaves calves scarves selves elves'.split(' ')));
const postpositiveAdjectives = new Set(['present', 'available', 'possible', 'necessary', 'concerned', 'involved', 'responsible', 'alive', 'alone', 'afraid', 'asleep', 'awake', 'nearby']);
const adjectives = fallbackAdjectives;

const auxiliaries: Record<string, Tag> = { is: 'VBZ', am: 'VBP', are: 'VBP', was: 'VBD', were: 'VBD', has: 'VBZ', have: 'VBP', had: 'VBD', does: 'VBZ', do: 'VBP', did: 'VBD', be: 'VB', been: 'VBN', being: 'VBG' };

const beWords = new Set(['be', 'am', 'is', 'are', 'was', 'were', 'been', 'being', "'s"]);
const haveWords = new Set(['have', 'has', 'had', "'s", "'d"]);
const modalWords = new Set(['will', 'would', 'can', 'could', 'may', 'might', 'shall', 'should', 'must']);
const determinerWords = new Set('the a an this that these those some any no every each another either neither such all both half my your his her its our their'.split(' '));
const deicticAdverbs = new Set('tomorrow today yesterday tonight now then here later soon again already still always never often sometimes usually recently lately abroad'.split(' '));
const timeNouns = new Set('day days week weeks month months year years morning afternoon evening night nights hour minute moment weekend spring summer autumn winter'.split(' '));
const timeModifiers = new Set(['last', 'next', 'every', 'each', 'all', 'this']);
const modifierAdverbs = new Set(['very', 'so', 'too', 'quite', 'rather', 'extremely', 'fairly', 'absolutely', 'completely', 'really', 'almost', 'more', 'less', 'most', 'least', 'as', 'how', 'enough', 'still', 'just', 'even', 'only', 'hardly', 'nearly', 'pretty', 'somewhat', 'slightly', 'highly', 'deeply', 'totally', 'entirely', 'unusually', 'surprisingly', 'remarkably']);
const perceptionVerbs = new Set(['see', 'saw', 'seen', 'hear', 'heard', 'watch', 'watched', 'notice', 'noticed', 'feel', 'felt', 'find', 'found', 'catch', 'caught', 'keep', 'kept', 'leave', 'left', 'observe', 'observed']);
const doWords = new Set(['do', 'does', 'did']);
// A past participle has -ed/-en or an irregular form; other be-complements are adjectives.
const participle = /(?:ed|en)$/u;
const sameFormVerbs = new Set('come become run set put cut hit read let cost shut split spread burst cast fit quit rid shed hurt bet bid broadcast'.split(' '));
const irregularParticiples = new Set('given taken written spoken broken chosen driven eaten fallen forgotten gotten hidden known seen shown thrown worn begun drunk sung swum done gone been made said found told held kept left lost paid met led sent built spent brought bought caught taught thought felt heard understood stood sat slept sold got put cut hit set read won run come become'.split(' '));
const noPluralVerb = /(?:ss|us|is|ous|as)$/u;

// A plural is a listed irregular, a hyphenated compound whose first part is plural
// ("mothers-in-law"), or a regular -s form that is not a singular ending in -s.
const isPlural = (key: string) => irregularPlurals.has(key)
  || (/[^su]s$/u.test(key) && !noPluralVerb.test(key))
  || /^[a-z]{3,}s-/u.test(key);
const nounNumber = (key: string) => isPlural(key) ? 'NNS' : 'NN';

type Candidate = { tag: Tag; cost: number };

const cheapest = (list: Candidate[]) => list.reduce<Candidate | undefined>((best, item) => !best || item.cost < best.cost ? item : best, undefined);

// The lemma exists as a verb, so an inflected surface form is a verb form too.
function verbishKey(key: string, parts: readonly (readonly [string, number])[]) {
  // The dictionary answers when it has a verb sense; the built-in list covers a missing dictionary.
  if (parts.some(([part]) => part === 'verb') || irregularPast.includes(key) || verbs.has(key)) return true;
  if (parts.length) return false;
  return [key, ...lemmaCandidates(key, undefined, 'verb')].some(lemma => fallbackVerbReadings.has(lemma));
}

// Inflection is stronger evidence than a sense count: the packed WordNet counts saturate at 15, so
// "played" (noun 15, verb 15) must still read as a past-tense verb. Morphology and the surrounding
// words decide the tags; the sense data only ranks the remaining noun/adjective/adverb readings.
function contentTags(word: string, index: number, previous: string | undefined, previousTag: Tag | undefined, next: string | undefined, nextTag: Tag | undefined, nextNominal: boolean, before: string | undefined, parts: readonly (readonly [string, number])[], number: boolean, beforeIsVerb = false): Candidate[] {
  previous = previous === undefined ? undefined : auxiliaryKey(previous);
  before = before === undefined ? undefined : auxiliaryKey(before, previous === "n't");
  const key = word.toLocaleLowerCase('en');
  const capital = index > 0 && /^\p{Lu}/u.test(word);
  const total = parts.reduce((sum, [, count]) => sum + count, 0) || 1;
  const has = (part: string) => parts.some(([name]) => name === part);
  const out: Candidate[] = [];
  const add = (tag: Tag, cost: number) => out.push({ tag, cost });
  const clamped = (count: number) => Math.min(2.2, Math.max(0.15, -Math.log(Math.min(0.92, Math.max(0.02, count / total)))));
  const verbWord = verbishKey(key, parts);
  // The installed dictionary decides; the built-in lists add the few readings it misses and are
  // the whole source when the dictionary is unavailable.
  const nounish = has('noun') || nouns.has(key);
  const adjish = has('adjective') || adjectives.has(key);
  const advish = has('adverb') || adverbs.has(key);
  const share = (part: string) => (parts.find(([name]) => name === part)?.[1] ?? 0) / total;
  // A form is still its verb, but a noun-dominant word should not lose to an equally spelled verb.
  const verbPenalty = share('noun') > share('verb') ? 0.2 : 0;
  const afterDeterminer = previousTag !== undefined && ['DT', 'PDT', 'PRP$', 'CD', 'POS'].includes(previousTag)
    || previous !== undefined && determinerWords.has(previous.toLowerCase());
  const afterAdjective = previousTag === 'JJ' || previousTag === 'JJR' || previousTag === 'JJS';
  // A modal, an infinitival "to" or an intervening "not" fixes the following verb's form.
  const afterModal = previous !== undefined && modalWords.has(previous.toLowerCase());
  const negated = previous !== undefined && /^(?:not|n't)$/u.test(previous.toLowerCase());
  const afterAuxiliary = afterModal || (previous !== undefined && previous.toLowerCase() === 'to' && previousTag === 'TO')
    || (negated && before !== undefined && modalWords.has(before.toLowerCase()))
    || (negated && before !== undefined && before.toLowerCase() === 'to');
  const afterBe = previous !== undefined && beWords.has(previous.toLowerCase());
  const afterHave = previous !== undefined && (haveWords.has(previous.toLowerCase()) || previous.toLowerCase() === 'having');
  const afterVerb = previousTag !== undefined && ['VB', 'VBZ', 'VBD', 'VBP', 'VBG', 'VBN'].includes(previousTag);
  const afterHelper = previous !== undefined && (beWords.has(previous.toLowerCase()) || haveWords.has(previous.toLowerCase()) || doWords.has(previous.toLowerCase()) || modalWords.has(previous.toLowerCase()));
  const afterLexicalVerb = afterVerb && !afterHelper;

  if (number || /^[+-]?(?:\d+(?:[.,]\d+)?|\d{1,3}(?:,\d{3})+(?:\.\d+)?)$/u.test(word)) add('CD', 0.05);
  if (deicticAdverbs.has(key)) add('RB', 0.12);
  if (!parts.length) {
    if (nounish) add(nounNumber(key), 0.7);
    if (adjish) add('JJ', 0.7);
    if (advish) add('RB', 0.6);
    if (verbWord) add(irregularPast.includes(key) || /ed$/.test(key) ? 'VBD' : /[^su]s$/.test(key) ? 'VBZ' : 'VB', 0.7);
  }

  // A newly retained minority verb reading must not erase the unknown-word noun alternatives.
  if (!parts.length && verbWord && !nounish && !adjish && !advish && !verbs.has(key) && !irregularPast.includes(key)) out.push(...guessTag(word, index, previous, next));

  // Inflection first, so a verb form is not mistaken for a noun or adjective.
  if (verbWord && (prefixedIrregularPast(key) || (key.length > 4 && /ed$/.test(key)))) { add('VBD', 0.2 + verbPenalty); add('VBN', 0.24 + verbPenalty); }
  else if (verbWord && /ing$/.test(key)) add('VBG', 0.2 + verbPenalty);
  else if (verbWord && /[^su]s$/.test(key) && !noPluralVerb.test(key)) { add('VBZ', (has('noun') ? 0.55 : 0.25) + verbPenalty); }
  // An irregular participle that is not also an irregular past ("written", "made", "given") is a
  // participle, so it must not slip into a base-form reading.
  const participleOnly = irregularParticiples.has(key) && !irregularPast.includes(key) && !sameFormVerbs.has(key);
  if (participleOnly) add('VBN', 0.15);
  // A fixed cheap base form is a shortcut, so it must not outrank an adjective reading that is at
  // least as strong: "made it clear" is an adjective, while "made it work" is a verb.
  const adjectiveAtLeastVerb = share('adjective') >= share('verb') && share('adjective') > 0;
  if (verbWord && !adjectiveAtLeastVerb && !/ed$|ing$|s$/u.test(key) && !prefixedIrregularPast(key) && !participleOnly) { add(irregularPast.includes(key) ? 'VBD' : 'VB', 0.3 + verbPenalty); add('VBP', 0.45 + verbPenalty); }

  for (const [part, count] of parts) {
    const cost = clamped(count);
    if (part === 'noun') {
      // A surface -ed form with a verb reading is not a nominal modifier.
      const verbal = has('verb') && (/(?:ed|en)$/u.test(key) || irregularPast.includes(key)) ? 1.2 : 0;
      const nounCost = cost + verbal;
      if (isPlural(key)) add('NNS', nounCost);
      else add(capital ? 'NNP' : 'NN', nounCost);
      if (capital) add('NN', cost + 0.6);
    } else if (part === 'verb') {
      // The inflection forms above already cover the surface verb; keep a base form as well.
      if (!/ed$|ing$|s$/u.test(key) && !participleOnly) add('VB', cost + 0.2);
    } else if (part === 'adjective') {
      if (/est$/.test(key) || ['best', 'worst', 'most', 'least'].includes(key)) add('JJS', cost);
      else if (/er$/.test(key) || ['better', 'worse', 'further', 'farther', 'more', 'less', 'elder'].includes(key)) add('JJR', cost);
      else add('JJ', cost);
      // A participle with an adjective reading is that adjective: "very interesting", "tired".
      // After be the progressive reading leads, so the adjective reading is not added there.
      if (/ing$|ed$/.test(key) && !afterBe) add('JJ', 0.35);
    } else if (part === 'adverb') add('RB', cost);
  }

  // Context: an auxiliary fixes the following form, a determiner rules a verb out.
  // "is reading" and "was given" are verb forms, while "is very tired" ends in an adjective.
  const verbalComplement = next?.toLocaleLowerCase('en') === 'by' || next?.toLowerCase() === 'in' && [key, ...lemmaCandidates(key, undefined, 'verb')].some(lemma => inParticles.has(lemma));
  const comparativeShape = /(?:er|est)$/u.test(key) && !/(?:ss|us|is)er$/u.test(key);
  const participleShape = participle.test(key) || irregularParticiples.has(key);
  // Only a participial shape can follow "be" as a passive; any other verb-sense noun cannot.
  const passiveForm = participleShape || (/ing$/u.test(key) && verbWord);
  // After "be" the passive participle and the adjective compete: "was seen" is passive, while
  // "were tired" and "was interested" are adjectives. A "by" phrase settles it for the passive,
  // an infinitive settles it against the adjective ("was made to work"), and otherwise the word's
  // own dictionary entry decides, with the adjective reading cheaper than the participle.
  if (afterBe && passiveForm) {
    const infinitiveFollows = next !== undefined && next.toLocaleLowerCase('en') === 'to';
    // A past participle with a real adjective entry is the copula's complement: "were tired".
    // A progressive form is the verb: "is raining", "were singing".
    // The adjective reading leads only when it is a clear part of the word's entry. A participle
    // whose adjective senses are a minority is the passive it looks like: "the city was founded".
    const adjectiveLeaning = !/ing$/u.test(key) && share('adjective') > 0.3;
    const participleTag = /ing$/u.test(key) ? 'VBG' : 'VBN';
    // A bare "be" is the subjunctive or infinitive, so what follows is its passive participle:
    // "that she be informed", "to be given". The adjective reading does not lead there.
    const bareBe = previous !== undefined && previous.toLocaleLowerCase('en') === 'be';
    const participleCost = verbalComplement ? 0.08 : infinitiveFollows ? 0.05 : bareBe ? 0.1 : adjectiveLeaning ? 1.2 : 0.1;
    add(participleTag, participleCost);
    if (bareBe) for (const item of out) if (item.tag === 'JJ') item.cost += 0.7;
    // The same word may already carry a cheaper participle reading from its -ed inflection; that
    // reading must also give way when the adjective entry is the better analysis.
    if (adjectiveLeaning && !verbalComplement && !infinitiveFollows && !bareBe) {
      for (const item of out) if (item.tag === 'VBN' || item.tag === 'VBD') item.cost += 1.0;
    }
  }
  if (afterBe) {
    // A progressive form is the verb of its clause: "is raining", "were singing". Its nominal and
    // adjective readings are demoted there, while a past participle keeps the cheap adjective one.
    const progressiveVerb = /ing$/.test(key) && verbWord;
    if (progressiveVerb) {
      add('VBG', 0.08);
      for (const item of out) if (/^NN/.test(item.tag) || item.tag === 'JJ') item.cost += 0.8;
    }
    if (adjish && !verbalComplement && !comparativeShape && !progressiveVerb) add('JJ', 0.14);
    if (nounish) add('NN', 0.4);
    // A word with no participial shape is not a participle here: "is book" is not a passive. A
    // progressive "-ing" form is participial in shape, so it is exempt.
    const participialShape = participleShape || /ing$/u.test(key);
    for (const item of out) if (/^VB/.test(item.tag) && !participialShape) item.cost += 4;
  }
  // Have always takes a past participle, whether or not the word list knows the verb.
  if (afterHave && (/ed$|en$/u.test(key) || verbWord)) add('VBN', 0.1);
  if (afterAuxiliary) {
    add('VB', 0.12);
    for (const item of out) if (/^NN|^JJ/.test(item.tag)) item.cost += 0.8;
  }
  // "made it clear": after a verb and its object a bare verb is a causative complement, so an
  // ordinary verb cannot start one. The adjective or nominal reading is what follows instead.
  const accusativeObject = previous !== undefined && previousTag === 'PRP'
    && ['me', 'him', 'her', 'us', 'them', 'it'].includes(previous.toLowerCase());
  if (beforeIsVerb && accusativeObject && before !== undefined && !bareComplementVerbs.includes(before.toLowerCase())) {
    for (const item of out) if (item.tag === 'VB' || item.tag === 'VBP') item.cost += 0.8;
  }
  // A causative or perception verb plus its object takes a bare verb: "helped him finish".
  // The object is a noun or an accusative pronoun, so "have I seen" is not causative "have".
  const objectPronoun = previousTag === 'PRP'
    ? previous !== undefined && ['me', 'him', 'her', 'us', 'them', 'it'].includes(previous.toLowerCase())
    : previousTag !== undefined && ['NN', 'NNS', 'NNP', 'NNPS'].includes(previousTag);
  // The bare complement needs a verb reading that leads its other readings: "made it work" is
  // causative, while "made it clear" takes an adjective because "clear" is equally a verb.
  const verbalLeads = share('verb') > share('adjective') && share('verb') >= share('noun');
  if (before !== undefined && bareComplementVerbs.includes(before.toLowerCase()) && objectPronoun && verbalLeads) {
    if (verbWord) { add('VB', 0.12); for (const item of out) if (/^NN|^JJ/.test(item.tag)) item.cost += 1.0; }
  }
  // After a perception verb's object the next verb is a participle: "saw him crossing".
  const perceptionBefore = before !== undefined && perceptionVerbs.has(before.toLowerCase());
  if (perceptionBefore && previousTag !== undefined && ['NP', 'PRP'].includes(previousTag) && /ing$/.test(key)) {
    add('VBG', 0.1);
    for (const item of out) if (item.tag === 'VBP' || item.tag === 'VBD' || item.tag === 'VBZ' || item.tag === 'VB') item.cost += 1.2;
  }
  // Do-support always leaves the verb bare, even when the subject sits between them:
  // "did you see", "he does not go".
  const doSupport = (previous !== undefined && doWords.has(previous.toLowerCase())) || (before !== undefined && doWords.has(before.toLowerCase()));
  if (doSupport) { for (const item of out) if (/^VB/.test(item.tag)) item.cost += 0.7; out.push({ tag: 'VB', cost: 0.08 }); }
  // A wh-pronoun opens its clause, so the next word is that clause's verb: "who lives in Paris".
  if (previousTag !== undefined && ['WP', 'WDT'].includes(previousTag) && verbWord) {
    if (/ed$/.test(key) || irregularPast.includes(key)) add('VBD', 0.12);
    else if (/[^su]s$/.test(key) && !noPluralVerb.test(key)) add('VBZ', 0.12);
    for (const item of out) if (/^NN/.test(item.tag)) item.cost += 1.2;
  }
  // A pronoun subject is followed by its predicate, so the finite verb of that inflection leads.
  // Only a nominative pronoun is a subject; an object pronoun ("him") is not.
  const nominative = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they', 'there']);
  // "made it clear": after a verb, an accusative pronoun is that verb's object, not a subject.
  const accusative = new Set(['me', 'him', 'her', 'us', 'them', 'it']);
  const verbBefore = beforeIsVerb;
  const pronounSubject = previous !== undefined
    && (previousTag === 'EX'
      || (previousTag === 'PRP' && nominative.has(previous.toLowerCase()) && !(verbBefore && accusative.has(previous.toLowerCase()))));
  // Do-support already fixed a bare form, so the finite-present preference must not override it:
  // "did you see" keeps VB, while "which I live" takes VBP.
  if (pronounSubject && verbWord && !doSupport) {
    for (const item of out) if (/^NN/.test(item.tag)) item.cost += 0.8;
    // "have I seen": a form that is only a participle stays the participle of a raised auxiliary.
    if (!participleOnly) for (const item of out) if (item.tag === 'VBN' || item.tag === 'VBG') item.cost += 0.7;
    if (/ed$/.test(key) || irregularPast.includes(key)) add('VBD', 0.14);
    else if (participleOnly) { /* no finite base form exists for this word */ }
    else if (/[^su]s$/.test(key) && !noPluralVerb.test(key)) add('VBZ', 0.14);
    else {
      // A nominal subject takes a finite present form, so a bare base reading is demoted:
      // "which I live" is VBP, not the base form VB.
      for (const item of out) if (item.tag === 'VB') item.cost += 0.2;
      add('VBP', 0.22); add('VB', 0.5);
    }
  }
  // A noun after a noun forms a compound ("the bus stop"), unless the word is already a finite
  // verb form ("the boys ran") or an adjective keeps its own reading ("the national team").
  const finiteShape = irregularPast.includes(key) || prefixedIrregularPast(key) || /ed$/.test(key);
  const nounLeads = share('noun') > share('verb');
  if (previousTag !== undefined && ['NN', 'NNS', 'NNP', 'NNPS'].includes(previousTag) && nounish && nounLeads && !adjish && !finiteShape) add(nounNumber(key), 0.12);
  const adjectiveDominant = share('adjective') >= 0.5;
  if (previousTag !== undefined && ['NN', 'NNS', 'NNP', 'NNPS'].includes(previousTag) && adjish && (adjectiveDominant || postpositiveAdjectives.has(key))) add('JJ', 0.15);
  // A participle is licensed by be/have, so without one the plain past reading leads: "called".
  const verbalBefore = previousTag !== undefined && ['VB', 'VBD', 'VBZ', 'VBP', 'MD', 'TO'].includes(previousTag);
  if (verbalBefore && !afterHave && !afterBe && out.some(item => item.tag === 'VBD')) {
    for (const item of out) if (item.tag === 'VBN') item.cost += 0.6;
  }
  if (previousTag === 'IN' && nounish) add(nounNumber(key), 0.12);
  if (previousTag === 'IN' && verbWord && /ing$/.test(key)) { add('VBG', 0.1); for (const item of out) if (/^NN/.test(item.tag)) item.cost += 0.8; }
  if (afterDeterminer) {
    // A word between a determiner and a noun is that noun's modifier: "the red coat".
    const beforeNoun = nextNominal || (nextTag !== undefined && ['NN', 'NNS', 'NNP', 'NNPS', 'JJ', 'CD'].includes(nextTag));
    if (adjish) add('JJ', nounish ? (beforeNoun ? 0.1 : 0.24) : 0.2);
    if (nounish) add(nounNumber(key), beforeNoun && adjish ? 0.4 : 0.18);
  }
  if (afterAdjective && nounish) {
    // A finite verb form after an adjective ends the clause, not a nominal: "were tired left".
    // An ordinary noun keeps the nominal reading: "the tired students".
    const finiteShapeAfterAdjective = irregularPast.includes(key) || prefixedIrregularPast(key) || /ed$/.test(key);
    const nextNominalAgain = nextNominal;
    if (adjish && nextNominalAgain) { add('JJ', 0.1); add(nounNumber(key), 0.5); }
    else if (!finiteShapeAfterAdjective) add(nounNumber(key), 0.18);
  }
  if (previousTag === 'RB' && adjish) add('JJ', 0.45);
  const degreeBefore = previous !== undefined && degreeWords.includes(previous.toLocaleLowerCase('en'));
  if (degreeBefore && participleShape) { add('JJ', 0.4); for (const item of out) if (/^VB/.test(item.tag)) item.cost += 0.8; }
  if (previous !== undefined && /^(?:just|already|never|often|always|still)$/u.test(previous.toLocaleLowerCase('en')) && participleShape) {
    add('VBN', 0.12);
    if (before !== undefined && /^(?:have|has|had)$/u.test(before.toLocaleLowerCase('en'))) for (const item of out) if (/^VB/.test(item.tag)) item.cost += 1.2;
  }
  // After a lexical verb an adverb is the natural modifier and a bare adjective is not. A word that
  // opens a nominal is a preposition there instead: "founded in 1999" is not "founded, in".
  const opensNominal = nextNominal || (next !== undefined && /^\d/u.test(next));
  if (afterLexicalVerb && advish && !opensNominal) add('RB', 0.1);
  if (afterLexicalVerb && adjish && !advish) for (const item of out) if (item.tag === 'JJ') item.cost += 0.6;
  // A determiner cannot introduce a verb, and a finite verb cannot follow another one.
  if (afterDeterminer) for (const item of out) if (/^VB/u.test(item.tag)) item.cost += 1.2;
  // After a predicate adjective the clause can still continue with its own finite verb
  // ("were tired left"), so only a non-finite shape is demoted there.
  const finiteAfterAdjective = irregularPast.includes(key) || prefixedIrregularPast(key) || /ed$/.test(key);
  if (afterAdjective && !finiteAfterAdjective) for (const item of out) if (/^VB/u.test(item.tag)) item.cost += 1.2;
  const finiteBefore = previousTag !== undefined && ['VB', 'VBD', 'VBZ', 'VBP'].includes(previousTag);
  if (finiteBefore && !afterHave) for (const item of out) if (item.tag === 'VBD' || item.tag === 'VBZ') item.cost += 0.9;
  // A finite lexical verb takes an object or a marked clause, never a bare verb phrase
  // ("*runs fast"), but an auxiliary or do-support does introduce one.
  if (afterLexicalVerb) for (const item of out) if (item.tag === 'VB' || item.tag === 'VBP') item.cost += 1.0;
  // With both readings, a modifier after a verb is an adverb.
  if (afterLexicalVerb && advish && adjish) for (const item of out) if (item.tag === 'JJ') item.cost += 0.5;
  // Only a degree or focusing adverb modifies the adjective ("very tall", "quite old"). A word
  // whose rare adverb reading is not one of these does not become an adverb just by position.
  if (afterAdjective && modifierAdverbs.has(key)) for (const item of out) if (item.tag === 'RB') item.cost = 0.3;
  if (previousTag === 'DT' && adjish && !nounish) for (const item of out) if (item.tag === 'JJ') item.cost = 0.2;
  // A time word after a noun belongs to its own phrase ("the station tomorrow"), not to that nominal.
  const afterNoun = previousTag !== undefined && ['NN', 'NNS', 'NNP', 'NNPS'].includes(previousTag);
  if (afterNoun && deicticAdverbs.has(key)) for (const item of out) if (item.tag === 'NN' || item.tag === 'NNS') item.cost += 1.2;
  if (afterNoun && timeModifiers.has(key)) for (const item of out) if (item.tag === 'JJ') item.cost += 1.5;
  if (capital) add('NNP', has('noun') ? 0.45 : 0.7);
  // Minority readings need verbal context; otherwise a noun list must remain a noun list.
  const minorityVerb = !parts.length && verbWord && !irregularPast.includes(key) && ![key, ...lemmaCandidates(key, undefined, 'verb')].some(lemma => verbs.has(lemma));
  if (minorityVerb && !pronounSubject && !afterAuxiliary && !afterBe && !afterHave && !doSupport) {
    for (const item of out) if (/^VB/u.test(item.tag)) item.cost += 2.2;
  }
  return out;
}

const ambiguousFunctionWords = new Set(['her', 'please', 'near', 'close', 'so', 'that', 'as', 'since', 'while', 'before', 'after', 'until', 'when', 'where', 'why', 'how', 'what', 'which', 'who', 'whose', 'if', 'whether', 'for', 'to', 'like', 'than', 'but', 'yet', 'still', 'even', 'only', 'just', 'not', 'no', 'all', 'both', 'either', 'neither', 'some', 'any', 'many', 'much', 'more', 'most', 'few', 'little', 'half', 'one', 'this', 'these', 'those', 'such', 'another', 'other']);

// These lexical frames distinguish stranded prepositions from separable particles.
const strandedFrames: Record<string, readonly string[]> = { after: ['look'], in: ['sleep', 'slept'] };
const inParticles = new Set(['hand', 'turn']);
function selectsStranded(word: string, preposition: string) {
  return Object.hasOwn(strandedFrames, preposition) && [word, ...lemmaCandidates(word, undefined, 'verb')].some(lemma => strandedFrames[preposition].includes(lemma));
}

// Closed-class words, numbers and auxiliaries win outright; the rest are ranked by contentTags.
function tagCandidates(word: string, index: number, next: string | undefined, nextTag: Tag | undefined, previous: string | undefined, previousTag: Tag | undefined, before: string | undefined, after?: string, pos?: PosLookup): Candidate[] {
  const key = auxiliaryKey(word, next !== undefined && auxiliaryKey(next) === "n't");
  if (titleAbbreviation.test(word)) return [{ tag: 'NNP', cost: 0.05 }];
  const out: Candidate[] = [];
  for (const [tag, words] of closed) if (words.includes(key)) out.push({ tag, cost: 0.05 });
  if (previous && selectsStranded(previous.toLowerCase(), key)) return [{ tag: 'IN', cost: 0.02 }];
  if (key === 'in' && previous && [previous.toLowerCase(), ...lemmaCandidates(previous, undefined, 'verb')].some(lemma => inParticles.has(lemma))) return [{ tag: 'RP', cost: 0.02 }];
  if (previousTag === 'DT' && /^[A-Z]{2,}$/u.test(word) && out.some(choice => choice.tag === 'PRP')) out.push({ tag: 'NNP', cost: 0.4 });
  // "there" is an expletive only before a form of be; elsewhere it is a place adverb.
  if (key === 'there') {
    // "there" is an expletive pronoun before a form of be, including "there to be"; elsewhere it is
    // the place adverb. Both readings stay available so an unusual clause can still use either.
    const raises = ['appear', 'appears', 'appeared', 'seem', 'seems', 'seemed', 'happen', 'happens', 'happened', 'remain', 'remains', 'remained', 'tend', 'tends', 'tended'];
    const be = next !== undefined && (beWords.has(next.toLowerCase()) || raises.includes(next.toLowerCase()));
    const helper = next?.toLowerCase() ?? '';
    const beAfterHelper = after !== undefined && beWords.has(after.toLowerCase())
      && (helper === 'to' || haveWords.has(helper) || modalWords.has(helper));
    return be || beAfterHelper ? [{ tag: 'EX', cost: 0.02 }, { tag: 'RB', cost: 4 }] : [{ tag: 'RB', cost: 0.08 }, { tag: 'EX', cost: 4 }];
  }
  // A temporal subordinator at the end of the sentence is its own adverb: "she has finished before".
  if (['before', 'after', 'since', 'until', 'throughout'].includes(key) && next === undefined) {
    return [{ tag: 'RB', cost: 0.08 }, { tag: 'IN', cost: 1.2 }];
  }
  // "as tall as": the first "as" is a degree word in front of the adjective it measures.
  if (key === 'as' && next !== undefined && adjectives.has(next.toLowerCase())) return [{ tag: 'RB', cost: 0.06 }];
  // An interrogative or relative pronoun is never a plain noun.
  if (['who', 'whom', 'whose', 'which'].includes(key)) return out;
  // "that" introduces a clause before a subject, and is a determiner before a nominal.
  if (key === 'that') {
    // "that" introduces a clause unless a nominal follows it. A following pronoun is a subject,
    // not a nominal: "the book that I read" is a complementizer, "that book" is a determiner.
    const nextKey = next?.toLocaleLowerCase('en') ?? '';
    const pronounNext = /^(?:i|you|he|she|it|we|they|me|him|her|us|them)$/u.test(nextKey);
    const nominal = next !== undefined && !pronounNext && (nouns.has(nextKey) || adjectives.has(nextKey));
    if (!nominal) out.push({ tag: 'IN', cost: 0.04 });
    return out;
  }
  // "to" is a preposition before an object and an infinitival marker before a verb.
  if (key === 'to') {
    const nextKey = next?.toLocaleLowerCase('en') ?? '';
    // A gerund never follows an infinitive marker, so "to" before "-ing" is a preposition.
    if (next !== undefined && /ing$/u.test(nextKey)) return [{ tag: 'IN', cost: 0.05 }];
    // A "to" with nothing to introduce is the preposition, stranded: "who I spoke to".
    if (next === undefined || /^[.,;:!?]$/u.test(next)) return [{ tag: 'IN', cost: 0.06 }, { tag: 'TO', cost: 2 }];
    // A verb sense inherited from an inflected form does not license "to arrived".
    if (!fallbackVerbReadings.has(nextKey) && (irregularPast.includes(nextKey) || irregularParticiples.has(nextKey)
      || nextKey.length > 4 && /ed$/u.test(nextKey))) return [{ tag: 'IN', cost: 0.06 }];
    const pronoun = /^(?:me|you|him|her|us|them|it|this|that|these|those|myself|yourself|himself|herself|itself|ourselves|themselves)$/u;
    const readings = next === undefined ? [] : pos?.(next) ?? [];
    const verbSenses = readings.find(([part]) => part === 'verb')?.[1] ?? 0;
    const nounSenses = readings.find(([part]) => part === 'noun')?.[1] ?? 0;
    if (determinerWords.has(nextKey) || pronoun.test(nextKey)) return [{ tag: 'IN', cost: 0.06 }];
    if (verbs.has(nextKey) || verbSenses > nounSenses) return [{ tag: 'TO', cost: 0.06 }];
    // Keep a verbal reading available when the following phrase requires it: "to use the key".
    const objectFollows = after !== undefined && (determinerWords.has(after.toLowerCase()) || pronoun.test(after.toLowerCase()));
    return objectFollows && (verbSenses > 0 || fallbackVerbReadings.has(nextKey))
      ? [{ tag: 'IN', cost: 0.06 }, { tag: 'TO', cost: 0.9 }]
      : [{ tag: 'IN', cost: 0.06 }];
  }
  // Bare "need" and "dare" are modals only before a negator or a subject: "need not come".
  if (key === 'need' || key === 'dare') {
    const nextKey = next?.toLocaleLowerCase('en') ?? '';
    if (nextKey === 'not' || nextKey === "n't") return [{ tag: 'MD', cost: 0.06 }];
  }
  // A contracted "'s" after a subject is the verb, and "'re"/"'ve"/"'ll"/"'d" likewise.
  // After a nominal the clitic is possessive unless a predicate follows it: "a week's worth" is
  // a possessor, while "she's ready" and "John's here" are the verb.
  if (key === "'s") {
    if (previousTag === 'PRP' || /^(?:that|this|there|here|who|what)$/iu.test(previous ?? '')) return [{ tag: 'VBZ', cost: 0.04 }];
    const predicateFollows = next !== undefined
      && /^(?:here|there|now|back|ready|done|gone|not|n't|so|too|very|all|still|already|just|going|being|been|had|got|a|an|the)$/u.test(next.toLocaleLowerCase('en'));
    const nominalBefore = previousTag !== undefined && ['NN', 'NNS', 'NNP', 'NNPS', 'PRP'].includes(previousTag);
    const possessive = nominalBefore && !predicateFollows;
    return possessive ? [{ tag: 'POS', cost: 0.04 }, { tag: 'VBZ', cost: 2.6 }]
      : [{ tag: 'POS', cost: 0.08 }, { tag: 'VBZ', cost: 0.12 }];
  }
  if (key === "'re") return [{ tag: 'VBP', cost: 0.06 }];
  if (key === "'ve") return [{ tag: 'VBP', cost: 0.06 }];
  if (key === "'ll") return [{ tag: 'MD', cost: 0.06 }];
  if (key === "'d") return [{ tag: 'MD', cost: 0.06 }, { tag: 'VBD', cost: 0.2 }];
  // A form of be, have or do is a closed-class auxiliary with one fixed tag: "is", "has".
  if (Object.hasOwn(auxiliaries, key)) {
    const previousKey = auxiliaryKey(previous ?? '');
    const beforeKey = auxiliaryKey(before ?? '', previousKey === "n't");
    const bare = (key === 'do' || key === 'have') && (previousTag === 'TO' || modalWords.has(previousKey) || doWords.has(previousKey) || doWords.has(beforeKey) || ['not', "n't"].includes(previousKey) && modalWords.has(beforeKey));
    return [{ tag: bare ? 'VB' : auxiliaries[key], cost: 0.04 }];
  }
  // "like", "round" and "back" are both prepositions and content words, so their closed-class
  // reading must not hide the verb or noun one.
  const lexicalReadings = pos?.(word);
  if (previous?.toLowerCase() === 'the' && nextTag === 'PRP' && /er$/u.test(key) && (lexicalReadings?.some(([part]) => part === 'adjective' || part === 'adverb') || lemmaCandidates(key).some(lemma => fallbackAdjectives.has(lemma) || fallbackAdverbs.has(lemma)))) {
    out.push({ tag: 'JJR', cost: 0.05 }, { tag: 'RBR', cost: 0.1 });
    return out;
  }
  // An irregular degree form keeps its degree reading and its sister adverb reading: "is better"
  // is an adjective phrase, "walked further" an adverb phrase.
  const degreeForm = ['better', 'worse', 'further', 'farther', 'best', 'worst', 'least'].includes(key);
  if (degreeForm) {
    const superlative = ['best', 'worst', 'least'].includes(key);
    const lexical = previous !== undefined && !beWords.has(previous.toLowerCase());
    const adverb = lexical && previousTag !== undefined && ['VB', 'VBD', 'VBZ', 'VBP', 'VBG', 'VBN'].includes(previousTag);
    const adjectiveTag = superlative ? 'JJS' : 'JJR';
    const adverbTag = superlative ? 'RBS' : 'RBR';
    out.push({ tag: adverb ? adverbTag : adjectiveTag, cost: 0.05 });
    out.push({ tag: adverb ? adjectiveTag : adverbTag, cost: 0.3 });
    return out;
  }
  const strict = (!ambiguousFunctionWords.has(key) && out.some(item => item.cost <= 0.06 && ['DT', 'PDT', 'PRP$', 'PRP', 'CC', 'MD', 'EX', 'WDT', 'WP', 'WP$', 'WRB', 'POS', 'UH'].includes(item.tag)));
  const ambiguous = nouns.has(key) || (lexicalReadings?.some(([part]) => part === 'noun' || part === 'verb') ?? false);
  if (strict || (!ambiguous && out.some(item => item.cost <= 0.06))) return out;
  const numeric = numberWords.has(key);
  const lexical = pos?.(word) ?? [];
  const nextNominal = next !== undefined && (nouns.has(next.toLowerCase()) || (pos?.(next)?.some(([part]) => part === 'noun') ?? false));
  out.push(...contentTags(word, index, previous, previousTag, next, nextTag, nextNominal, before, lexical, numeric, before !== undefined && (pos?.(before) ?? []).some(([part]) => part === 'verb')));
  if (!out.length) out.push(...guessTag(word, index, previous, next));
  // Capitalised tokens are proper nouns unless a closed-class word already matched.
  if (index > 0 && /^\p{Lu}/u.test(word) && !out.some(item => item.cost <= 0.1)) out.unshift({ tag: 'NNP', cost: 0.7 });
  return out;
}

// Two cheap passes: the first guesses each word alone, the second reads those guesses as context.
function tagHints(words: string[], pos?: PosLookup) {
  const first = words.map((word, index) => cheapest(tagCandidates(word, index, words[index + 1], undefined, words[index - 1], undefined, words[index - 2], words[index + 2], pos))?.tag);
  return words.map((word, index) => cheapest(tagCandidates(word, index, words[index + 1], first[index + 1], words[index - 1], first[index - 1], words[index - 2], words[index + 2], pos))?.tag);
}

const verbPrefixes = ['re', 'un', 'dis', 'mis', 'out', 'over', 'under', 'fore', 'counter', 'cross'];

// "rewrote" and "misunderstood" are irregular pasts of a prefixed base verb.
function prefixedIrregularPast(key: string) {
  for (const prefix of verbPrefixes) {
    if (!key.startsWith(prefix) || key.length <= prefix.length + 2) continue;
    if (irregularPast.includes(key.slice(prefix.length))) return true;
  }
  return false;
}

function guessTag(word: string, index: number, previous?: string, next?: string): { tag: Tag; cost: number }[] {
  const key = word.toLocaleLowerCase('en');
  const out: { tag: Tag; cost: number }[] = [];
  if (key === "n't") return [{ tag: 'RB', cost: 0.05 }];
  if (/(tion|sion|ment|ness|ity|ence|ance|ism|ship|hood|dom)$/.test(key)) out.push({ tag: 'NN', cost: 0.6 });
  if (/(ous|ful|less|able|ible|ive|ical|ic|ish|ary|ant|ent|al)$/.test(key)) out.push({ tag: 'JJ', cost: 0.6 });
  // The same endings also form nouns ("extent", "student"), which the offline lists must allow.
  if (/(?:ant|ent|age|ory|acy|ee|eer|ist|logy)$/.test(key)) out.push({ tag: 'NN', cost: 0.9 });
  if (/ly$/.test(key) && !/^(only|family|reply|supply|apply|assembly|italy)$/.test(key)) out.push({ tag: 'RB', cost: 0.6 });
  if (/ing$/.test(key) && !/^(thing|morning|evening|building|meeting|feeling|ceiling)$/.test(key)) out.push({ tag: 'VBG', cost: 0.6 });
  if (/ed$/.test(key)) out.push({ tag: 'VBD', cost: 1.0 }, { tag: 'VBN', cost: 1.2 });
  if (/(ize|ise|ify|ate)$/.test(key)) out.push({ tag: 'VB', cost: 1.0 });
  // A suffix alone does not make a word comparative: "letter", "water" and "member" are nouns. The
  // comparative reading needs a degree word in front ("more", "much") or a comparison after it.
  const compared = previous !== undefined && /^(?:more|much|less|even|still|far|a bit|a lot|slightly|very)$/u.test(previous.toLocaleLowerCase('en'))
    || next !== undefined && /^(?:than|of)$/u.test(next.toLocaleLowerCase('en'));
  if (/est$/.test(key) && compared) out.push({ tag: 'JJS', cost: 1.0 });
  if (/er$/.test(key)) {
    if (compared) out.push({ tag: 'JJR', cost: 0.7 });
    out.push({ tag: 'NN', cost: compared ? 1.6 : 1.0 }, { tag: 'JJR', cost: compared ? 1.6 : 2.2 });
  }
  // A plural is a noun unless the previous word makes a subject-verb reading likely.
  if (isPlural(key)) out.push({ tag: 'NNS', cost: 1.0 });
  if (index > 0 && /^\p{Lu}/u.test(word)) out.push({ tag: 'NNP', cost: 1.2 });
  if (!out.length) out.push({ tag: 'NN', cost: 1.6 }, { tag: 'JJ', cost: 1.9 }, { tag: 'VB', cost: 2.1 });
  return out;
}

function rightmostPreterminal(node: RawNode): RawNode {
  let current = node;
  while (current.children.length) {
    const last = current.children[current.children.length - 1];
    if (!last.children.length) return current;
    current = last;
  }
  return current;
}

// A fixed phrase such as "as soon as" or "a lot of" is one unit, so the drawing shows one node.
function mergePhrases(tokens: string[]) {
  const merged: string[] = [];
  for (let index = 0; index < tokens.length;) {
    const rest = tokens.slice(index, index + 5).map(token => token.toLowerCase());
    let length = 0;
    for (const phrase of compoundPhrases) {
      const parts = phrase.split(' ');
      if (parts.every((part, offset) => part === (offset === parts.length - 1 ? rest[offset]?.replace(/[.,;:!?]+$/u, '') : rest[offset]))) {
        length = parts.length;
        break;
      }
    }
    if (!length) { merged.push(tokens[index]); index += 1; continue; }
    const joined = tokens.slice(index, index + length).join(' ');
    const trailing = /[.,;:!?]+$/u.exec(joined);
    merged.push(trailing ? joined.slice(0, -trailing[0].length) : joined);
    if (trailing) merged.push(trailing[0]);
    index += length;
  }
  return merged;
}

function tokenize(input: string) {
  const separated = input.split(/\s+/u).flatMap(token => /^[:;=8][-^']?[()]$/u.test(token) ? [token]
    : token.replace(/[()"“”‘]/gu, ' $& ').replace(/’(?=[\s.,;:!?)]|$)/gu, ' ’ ').split(/\s+/u));
  const raw = mergePhrases(separated.filter(Boolean));
  const splitClitic = (token: string): string[] => {
    if (fixedPhrases.has(token.toLocaleLowerCase('en'))) return [token];
    // A plural possessive keeps its apostrophe as the genitive marker: "the students' books".
    if (/[^'’]['’]$/u.test(token)) return [token.slice(0, -1), token.slice(-1)];
    if (/^cannot$/iu.test(token)) return [token.slice(0, 3), token.slice(3)];
    const negative = /^(.+?)(n['’]t)$/i.exec(token);
    if (negative) return [negative[1], negative[2]];
    const contracted = /^(.+?)(['’](?:s|re|ve|ll|d|m))$/i.exec(token);
    return contracted ? [contracted[1], contracted[2]] : [token];
  };
  return raw.flatMap((token, index) => {
    if (/^[.!?]+$/u.test(token)) return [token];
    const abbreviationStop = /^(.+\.)([.,;:!?]+)$/u.exec(token);
    if (abbreviationStop && writtenAbbreviation(abbreviationStop[1])) return [abbreviationStop[1], abbreviationStop[2]];
    const boundary = raw[index + 1] === undefined || /^[)"”’]$/u.test(raw[index + 1]);
    if (!boundary && writtenAbbreviation(token)) return [token];
    if (token.endsWith('.') && calendarMonth(token) >= 0 && /^\d/u.test(raw[index + 1] ?? '')) return [token];
    // Strip a token's final punctuation before splitting its contraction, not instead of it.
    const punctuation = /^([\p{L}\p{N}'’.-]+?)([.,;:!?]+)$/u.exec(token)
      ?? /^([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)([.,;:!?]+)$/u.exec(token);
    return punctuation ? [...splitClitic(punctuation[1]), punctuation[2]] : splitClitic(token);
  });
}

// The only verbs that take a bare verb complement: causative and perception verbs. This is a
// closed grammatical class, not a list of examples — every other verb takes "to" or "-ing".
const bareComplementVerbs = ['let', 'lets', 'let us', "let's", 'lets us', 'make', 'makes', 'made', 'help', 'helps', 'helped', 'have', 'has', 'had', 'get', 'gets', 'got', 'watch', 'watches', 'watched', 'hear', 'hears', 'heard', 'see', 'sees', 'saw', 'seen', 'feel', 'feels', 'felt', 'notice', 'notices', 'noticed', 'observe', 'observes', 'observed'];

// Prepositions that can stand without an object. Subordinators such as "that" and "because" cannot.
const strandablePrepositions = ['of', 'in', 'on', 'at', 'for', 'with', 'from', 'by', 'about', 'over', 'under', 'into', 'onto', 'through', 'during', 'against', 'among', 'around', 'across', 'behind', 'below', 'above', 'toward', 'towards', 'upon', 'via', 'per', 'despite', 'throughout', 'past', 'beneath', 'underneath', 'alongside', 'beyond', 'besides', 'outside', 'inside', 'opposite', 'amid', 'amidst', 'atop', 'plus', 'minus', 'to', 'off', 'near', 'like', 'without', 'within', 'between', 'after', 'before', 'since', 'until'];
const approximators = ['about', 'around', 'approximately', 'roughly', 'nearly', 'almost', 'over', 'under', 'up to', 'some', 'at least', 'at most', 'more than', 'less than', 'fewer than'];
const quantifierWords = [...['a few', 'a little', 'a lot of', 'lots of', 'plenty of', 'a couple of', 'a great deal of', 'a large number of', 'a bit of'],'all', 'both', 'each', 'either', 'neither', 'some', 'any', 'no', 'none', 'many', 'much', 'more', 'most', 'less', 'few', 'fewer', 'little', 'several', 'enough', 'half', 'rest', 'one', 'part', 'lot', 'lots', 'plenty', 'number', 'amount', 'majority', 'minority', 'couple'];
const auxiliaryVerbs = ['be', 'am', 'is', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could', 'may', 'might', 'shall', 'should', 'must', "'s", "'d"];
const semiModals = ['about to', 'going to', 'supposed to', 'due to be', 'set to', 'able to', 'unable to', 'bound to', 'meant to', 'free to', 'likely to'];
const degreeWords = ['very', 'so', 'too', 'quite', 'rather', 'extremely', 'fairly', 'absolutely', 'completely', 'really', 'almost'];
const operatorWords = ['do', 'does', 'did', 'have', 'has', 'had', 'am', 'is', 'are', 'was', 'were', 'will', 'would', 'can', 'could', 'may', 'might', 'shall', 'should', 'must', "'s", "'d"];

type Rule = { parent: string; left: string; right: string; weight: number; chain?: 'left' | 'right'; leftWords?: string[]; rightWords?: string[]; headWords?: string[]; rightHeadWords?: string[]; leftStarts?: string[]; rightStarts?: string[]; leftHas?: string[]; leftLacks?: string[]; leftNoStart?: string[]; rightNoFronted?: boolean; needsObject?: boolean; rightNotNominative?: boolean; needsPronounObject?: boolean };
type Unary = { parent: string; child: string; weight: number; childWords?: string[]; strandable?: boolean };
type Cell = { cost: number; node: RawNode };

const rules: Rule[] = [
  { parent: 'S', left: 'NP', right: 'VP', weight: 1.3 },
  { parent: 'SEQ', left: 'S', right: ':', weight: 0.2 },
  { parent: 'SEQ', left: 'S', right: '.', weight: 0.2 },
  { parent: 'S', left: 'SEQ', right: 'S', weight: 0.5 },
  ...['S', 'NP', 'VP'].flatMap(label => [
    { parent: label, left: label, right: 'PRN', weight: 0.4, chain: 'left' as const },
    { parent: label, left: 'PRN', right: label, weight: 0.4, chain: 'right' as const },
  ]),
  { parent: 'VP', left: 'VP', right: 'QUOTE', weight: 0.7, chain: 'left' },
  // A fronted adverb or subordinate clause precedes the subject.
  { parent: 'S', left: 'ADVP', right: 'S', weight: 0.5, chain: 'right' },

  // Final punctuation stays inside S, as in PTB II.
  { parent: 'S', left: 'S', right: '.', weight: 1.0, chain: 'left' },
  { parent: 'S', left: 'S', right: ',', weight: 0.3, chain: 'left' },
  { parent: 'S', left: 'ADVP', right: ',', weight: 0.3 },
  { parent: 'S', left: 'SBAR', right: ',', weight: 0.4 },
  // Only a marked subordinate clause opens a sentence; a bare subject and predicate is not one.
  { parent: 'S', left: 'SBAR', right: 'S', weight: 0.5, leftNoStart: ['NP', 'PRP', 'NN', 'NNS', 'NNP', 'NNPS'] },
  // A fronted adjunct with its comma: "In the morning, we left", "Fortunately, it stopped".
  { parent: 'ADJX', left: 'PP', right: ',', weight: 0.3 },
  { parent: 'ADJX', left: 'SBAR', right: ',', weight: 0.3 },
  { parent: 'ADJX', left: 'ADVP', right: ',', weight: 0.3 },
  { parent: 'ADJX', left: 'ADJP', right: ',', weight: 0.4 },
  { parent: 'ADJX', left: 'VP', right: ',', weight: 0.5 },
  { parent: 'ADJX', left: 'RB', right: ',', weight: 0.5 },
  { parent: 'ADJX', left: 'UH', right: ',', weight: 0.2 },
  { parent: 'ADJX', left: 'RB', right: 'PP', weight: 0.6, leftWords: ['only', 'just', 'even'] },
  { parent: 'S', left: 'ADJX', right: 'S', weight: 0.4 },
  // A fronted prepositional phrase introduces a clause with or without a written comma:
  // "because of the rain we stayed", "in terms of money it is cheap".
  { parent: 'S', left: 'PP', right: 'S', weight: 1.0, leftStarts: ['IN'] },
  { parent: 'S', left: 'PP', right: 'SQ', weight: 1.1, leftStarts: ['IN'] },
  { parent: 'PP', left: 'RB', right: 'PP', weight: 0.3, leftWords: ['not'], rightHeadWords: ['until', 'till'] },
  { parent: 'S', left: 'PP', right: 'SQ', weight: 0.3, leftStarts: ['RB'] },
  { parent: 'S', left: 'SBAR', right: 'VP', weight: 0.9, leftStarts: ['WDT', 'WP', 'WRB'] },
  { parent: 'S', left: 'SBAR', right: 'VP', weight: 0.9, leftStarts: ['IN'], leftWords: ['that', 'whether', 'if'] },
  { parent: 'S', left: 'VP', right: 'VP', weight: 1.3, leftStarts: ['TO', 'VBG'] },
  // An infinitival subject with its own "for": "for him to leave was rude".
  { parent: 'S', left: 'INF', right: 'VP', weight: 0.6 },
  { parent: 'S', left: 'ADJX', right: 'SQ', weight: 0.6 },
  { parent: 'S', left: 'ADJX', right: 'CMP', weight: 0.5 },
  { parent: 'S', left: 'S', right: 'SBAR', weight: 1.8, rightHeadWords: ['whereas', 'while', 'though', 'although', 'yet', 'but', 'and', 'or', 'so', 'for', 'nor', 'because', 'since', 'as', 'if', 'unless', 'when', 'once', 'after', 'before', 'which', 'who'] },
  // The correlative comparative joins two fronted clauses: "the more you read, the more you learn".
  // Only a clause that already carries a fronted comparative can pair with another clause.
  { parent: 'S', left: 'S', right: 'S', weight: 1.1, leftHas: ['CMP'] },
  // "the more you read, the more you learn": each half is a fronted comparative plus its clause.
  { parent: 'S', left: 'CMP', right: 'S', weight: 0.4 },
  { parent: 'CMP', left: 'DT', right: 'QP', weight: 0.5, leftWords: ['the'], rightHeadWords: ['more', 'less', 'fewer'] },
  // A question tag closes the clause: "she is happy, isn't she".
  { parent: 'S', left: 'S', right: 'TG', weight: 0.6 },
  // An imperative with a question tag: "open the door, will you".
  { parent: 'S', left: 'VP', right: 'TG', weight: 0.5 },
  // An interjection opens the clause: "excuse me, could you help".
  { parent: 'S', left: 'VP', right: 'SQ', weight: 0.5, leftWords: ['excuse', 'pardon'] },
  { parent: 'S', left: 'VP', right: 'S', weight: 0.5, leftWords: ['excuse', 'pardon'] },
  { parent: 'TG', left: ',', right: 'TGC', weight: 0.1 },
  { parent: 'TGC', left: 'RB', right: 'NP', weight: 0.9 },
  { parent: 'TGC', left: 'MD', right: 'NP', weight: 0.5 },
  { parent: 'TGC', left: 'VBZ', right: 'NP', weight: 0.5 },
  { parent: 'TGC', left: 'VBD', right: 'NP', weight: 0.5 },
  { parent: 'TGC', left: 'VBP', right: 'NP', weight: 0.5 },
  { parent: 'TGC', left: 'MD', right: 'TGC', weight: 0.4 },
  { parent: 'TGC', left: 'VBZ', right: 'TGC', weight: 0.4 },
  { parent: 'TGC', left: 'VBD', right: 'TGC', weight: 0.4 },
  { parent: 'TGC', left: 'VBP', right: 'TGC', weight: 0.4 },
  // Exclamatives: "what a beautiful day", "how kind she is".
  { parent: 'EXC', left: 'WDT', right: 'NP', weight: 0.5 },
  { parent: 'EXC', left: 'WRB', right: 'ADJP', weight: 0.9, rightStarts: ['JJ', 'JJR', 'JJS'] },
  { parent: 'EXC', left: 'WRB', right: 'ADVP', weight: 0.5 },
  { parent: 'S', left: 'EXC', right: 'S', weight: 1.8 },
  // Correlative coordination: "either she or I", "not only she but also I".
  { parent: 'NP', left: 'DT', right: 'NP', weight: 2.0, leftWords: ['both', 'either', 'neither', 'all', 'not only'] },

  { parent: 'NP', left: 'NP', right: 'SBAR', weight: 1.1 },
  // A pronoun cannot head a modified nominal ("I seen such a thing" is not a phrase).
  // An infinitival postmodifier belongs to the nominal it modifies: "the book for him to read".
  { parent: 'NP', left: 'NP', right: 'INF', weight: 0.5 },
  { parent: 'NP', left: 'NP', right: 'VP', weight: 1.2, rightStarts: ['VBN', 'VBG'], leftStarts: ['DT', 'PDT', 'PRP$', 'CD', 'NN', 'NNS', 'NNP', 'NNPS', 'JJ', 'JJR', 'JJS', 'NOM'] },
  { parent: 'NP', left: 'NP', right: 'ADJP', weight: 2.4 },
  // An approximator or degree preposition before a quantity: "about twenty", "over half".
  { parent: 'QP', left: 'CD', right: 'NN', weight: 0.5, rightWords: compoundMeasures },
  { parent: 'QP', left: 'QP', right: 'NN', weight: 0.5, rightWords: compoundMeasures },
  { parent: 'ADJP', left: 'QP', right: 'ADJP', weight: 0.6, chain: 'left' },
  // A trailing approximation follows the quantity it modifies: "twenty or so students".
  { parent: 'QP', left: 'QP', right: 'RB', weight: 0.35, rightWords: ['or so'] },
  { parent: 'QP', left: 'IN', right: 'QP', weight: 0.3, leftWords: approximators },
  { parent: 'QP', left: 'RB', right: 'QP', weight: 0.4, leftWords: approximators },
  // "so good a day", "too big a house": a degree adjective phrase before the indefinite nominal.
  { parent: 'NP', left: 'ADJP', right: 'NP', weight: 1.0, leftStarts: ['RB'] },
  { parent: 'NP', left: 'QP', right: 'PP', weight: 0.6 },
  { parent: 'NP', left: 'CD', right: 'PP', weight: 0.5 },
  { parent: 'NP', left: 'QP', right: 'NOM', weight: 0.6 },
  { parent: 'NP', left: 'ADJP', right: 'NOM', weight: 0.8 },

  { parent: 'ADJP', left: 'ADJP', right: 'PP', weight: 0.7, chain: 'left' },
  { parent: 'ADJP', left: 'IN', right: 'ADJP', weight: 0.7, leftWords: ['than', 'so'] },
  { parent: 'ADJP', left: 'RB', right: 'ADJP', weight: 0.35, leftWords: ['as'] },
  { parent: 'ADJP', left: 'ADJP', right: 'VP', weight: 0.7, rightStarts: ['TO'], leftWords: ['such'] },
  // An adjective takes an infinitival complement, or a gerund after "busy".
  { parent: 'ADJP', left: 'JJ', right: 'VP', weight: 0.8, rightStarts: ['TO'] },
  { parent: 'ADJP', left: 'JJ', right: 'VP', weight: 0.4, rightStarts: ['VBG'], leftWords: ['busy'] },
  // A lexical verb plus a participle: "spent two hours working".
  { parent: 'VP', left: 'VP', right: 'VP', weight: 0.7, chain: 'left', rightStarts: ['VBG'] },
  { parent: 'ADJP', left: 'RBR', right: 'ADJP', weight: 0.7 },
  { parent: 'ADVP', left: 'RB', right: 'NP', weight: 0.9, leftWords: ['only', 'even', 'just', 'right', 'straight', 'exactly', 'precisely'] },
  // A rate expression: "twice a week", "once a day", "three times a month".
  { parent: 'ADVP', left: 'RB', right: 'NP', weight: 0.5, leftWords: ['twice', 'once', 'again'] },
  { parent: 'ADVP', left: 'NNS', right: 'NP', weight: 0.5, leftWords: ['times'] },
  { parent: 'NP', left: 'CD', right: 'NNS', weight: 0.5, leftWords: ['three', 'four', 'five', 'six', 'ten', 'two'], rightWords: ['times'] },
  // A comparative correlative: "the more you read, the more you learn".
  { parent: 'CMP', left: 'DT', right: 'ADJP', weight: 0.6, leftWords: ['the'], rightStarts: ['JJR', 'RBR', 'JJS', 'RBS'] },
  { parent: 'CMP', left: 'DT', right: 'S', weight: 0.9, leftWords: ['the'], leftHas: ['QP', 'ADJP'] },

  // An infinitive with its own subject: "for him to leave".
  { parent: 'INF', left: 'IN', right: 'INF', weight: 0.4 },
  // "for him to leave": the subject of an infinitive needs its own "for".
  { parent: 'INF', left: 'IN', right: 'INF', weight: 0.4, leftWords: ['for'] },
  { parent: 'INF', left: 'NP', right: 'VP', weight: 0.5, rightStarts: ['TO'] },
  { parent: 'VP', left: 'INF', right: 'VP', weight: 1.2, leftWords: ['for'] },
  { parent: 'S', left: 'RB', right: 'SQ', weight: 0.7, leftWords: ['so', 'neither', 'nor'] },
  { parent: 'S', left: 'DT', right: 'SQ', weight: 0.6, leftWords: ['such', 'not only'] },
  { parent: 'S', left: 'RB', right: 'VP', weight: 1.2 },
  { parent: 'S', left: 'RB', right: 'MD', weight: 2.0 },
  { parent: 'S', left: 'UH', right: 'S', weight: 1.2 },
  { parent: 'VP', left: 'MD', right: 'RB', weight: 0.8 },
  // A semi-modal phrase introduces a bare verb: "about to leave", "supposed to come".
  { parent: 'VP', left: 'IN', right: 'VP', weight: 0.5, leftWords: semiModals },
  { parent: 'VP', left: 'RB', right: 'S', weight: 0.6, leftWords: ['rather'] },
  { parent: 'VP', left: 'PP', right: 'VP', weight: 1.3, leftWords: ['for'] },
  { parent: 'PP', left: 'IN', right: 'WHNP', weight: 0.8 },
  { parent: 'PP', left: 'IN', right: 'S', weight: 1.2, leftWords: ['as', 'than', 'before', 'after', 'until', 'since', 'when', 'while', 'if', 'whether', 'because', 'although', 'though'] },
  { parent: 'PP', left: 'IN', right: 'VP', weight: 0.8, leftWords: ['after', 'before', 'without', 'upon', 'on', 'in', 'by', 'for', 'as', 'than', 'despite', 'in order to', 'so as to', 'since', 'of', 'against', 'about'] },
  { parent: 'PP', left: 'IN', right: 'VP', weight: 0.8, leftWords: ['to'], rightStarts: ['VBG'] },
  { parent: 'PP', left: 'PP', right: 'VP', weight: 0.9, chain: 'left', leftWords: ['with', 'without'] },
  { parent: 'PP', left: 'IN', right: 'NP', weight: 1.2 },
  { parent: 'PP', left: 'VBG', right: 'NP', weight: 0.4, leftWords: ['regarding', 'concerning', 'including', 'considering', 'according'] },
  // A clause with its own subject and no complementizer: "the book I read".
  { parent: 'SBAR', left: 'NP', right: 'VP', weight: 3.4 },
  { parent: 'SBAR', left: 'WHNP', right: 'VP', weight: 0.8, rightStarts: ['TO'] },
  { parent: 'SBAR', left: 'WHADVP', right: 'VP', weight: 0.9, rightStarts: ['TO'] },
  { parent: 'SBAR', left: 'VBD', right: 'S', weight: 1.4, leftWords: ['had', 'were'] },
  { parent: 'SBAR', left: 'MD', right: 'S', weight: 1.4, leftWords: ['should', 'were'] },

  // "no sooner had I left than it rained": a comparison word introduces the clause it compares.
  { parent: 'SBAR', left: 'IN', right: 'S', weight: 0.25, leftWords: ['than', 'as'] },
  { parent: 'SBAR', left: 'IN', right: 'S', weight: 1.0, rightStarts: ['DT', 'PRP', 'EX', 'WDT', 'WP', 'WRB', 'CD', 'NN', 'NNS', 'NNP', 'PRP$', 'JJ', 'PDT'], leftWords: ['that', 'if', 'whether', 'because', 'although', 'though', 'while', 'since', 'unless', 'until', 'so', 'than', 'as', 'before', 'after', 'once', 'whereas', 'whenever', 'wherever', 'when', 'till', 'if only', 'so that', 'in order that', 'provided that', 'providing that', 'now that', 'as long as', 'as soon as', 'as if', 'as though', 'even if', 'even though', 'only if', 'in case', 'in the event that', 'on condition that'] },
  { parent: 'SBAR', left: 'WHNP', right: 'S', weight: 1.9, rightNoFronted: true },
  { parent: 'SBAR', left: 'WHADVP', right: 'S', weight: 1.8 },
  { parent: 'SBAR', left: 'WHPP', right: 'S', weight: 0.6 },
  // A fronted predicate before "as"/"though" is concessive: "try as she might", "much as she tried".
  { parent: 'SBAR', left: 'VP', right: 'SBAR', weight: 0.5, rightStarts: ['IN'], rightHeadWords: ['as', 'though'] },
  { parent: 'SBAR', left: 'ADVP', right: 'SBAR', weight: 0.2, rightStarts: ['IN'], rightHeadWords: ['as', 'though'] },
  { parent: 'SBAR', left: 'SBAR', right: ',', weight: 0.3 },
  // A bare participle after a subordinator: "unless warned, she stays". A preposition such as
  // "on" is not a subordinator, so "insisted on paying" stays a preposition phrase.
  { parent: 'SBAR', left: 'IN', right: 'ADJP', weight: 0.5, leftWords: ['if', 'unless', 'when', 'while', 'once', 'though', 'although', 'whether', 'because', 'since', 'as', 'whenever', 'until', 'before', 'after'] },

  // A pied-piped wh-phrase: the preposition travels with the wh-word ("with whom", "to what extent").
  { parent: 'WHPP', left: 'IN', right: 'WHNP', weight: 0.6 },
  { parent: 'WHPP', left: 'TO', right: 'WHNP', weight: 0.6 },
  { parent: 'WHNP', left: 'WDT', right: 'NOM', weight: 0.7 },
  // "how many students", "how much water".
  // Only a quantity word makes a wh-nominal: "how many students", "how much water".
  { parent: 'WHNP', left: 'WRB', right: 'NOM', weight: 0.5, rightHeadWords: ['many', 'much', 'few', 'little'] },
  { parent: 'WHNP', left: 'WRB', right: 'NP', weight: 0.7, rightHeadWords: ['many', 'much', 'few', 'little'] },
  // "how old", "how long": a degree word plus the property it asks about.
  { parent: 'WHADVP', left: 'WRB', right: 'ADJP', weight: 0.5 },
  { parent: 'WHADVP', left: 'WRB', right: 'ADVP', weight: 0.5, leftWords: ['how'] },

  { parent: 'WHNP', left: 'WDT', right: 'NP', weight: 0.8 },
  { parent: 'WHNP', left: 'WP$', right: 'NOM', weight: 0.4 },

  // Base NPs are flat and right-branching; postmodifiers attach outside the base NP.
  { parent: 'NP', left: 'DT', right: 'NOM', weight: 1.2 },
  { parent: 'NP', left: 'DT', right: 'NP', weight: 1.4, chain: 'left', leftWords: ['such', 'quite', 'half', 'both', 'all'] },
  // A fused superlative head: "the best", "the cheapest".
  { parent: 'NP', left: 'DT', right: 'ADJP', weight: 0.8, rightHeadWords: ['best', 'worst', 'cheapest', 'oldest', 'youngest', 'richest', 'tallest'] },
  { parent: 'NP', left: 'PDT', right: 'NOM', weight: 0.7 },
  { parent: 'NP', left: 'PRP$', right: 'NOM', weight: 0.8 },
  { parent: 'NP', left: 'CD', right: 'NOM', weight: 0.7 },
  // A degree-modified adjective is a whole adjective phrase inside the nominal: "a very tall student".
  { parent: 'NOM', left: 'ADJP', right: 'NOM', weight: 0.9, chain: 'right' },
  { parent: 'NOM', left: 'JJ', right: 'NOM', weight: 1.0, chain: 'right' },
  { parent: 'NOM', left: 'JJR', right: 'NOM', weight: 0.6, chain: 'right' },
  { parent: 'NOM', left: 'JJS', right: 'NOM', weight: 0.6, chain: 'right' },
  // A cardinal stays inside the nominal: (NP (DT the) (CD two) (NNS cats)).
  { parent: 'NOM', left: 'CD', right: 'NOM', weight: 0.8, chain: 'right' },
  { parent: 'NOM', left: 'NN', right: 'NOM', weight: 1.2, chain: 'right' },
  { parent: 'NOM', left: 'NNP', right: 'NOM', weight: 1.2, chain: 'right' },
  { parent: 'NOM', left: 'NNPS', right: 'NOM', weight: 1.2, chain: 'right' },
  // "many students", "much water": a quantity word plus the nominal it measures.
  { parent: 'NOM', left: 'QP', right: 'NOM', weight: 0.8, chain: 'right' },
  { parent: 'NOM', left: 'NNS', right: 'NOM', weight: 0.4, chain: 'right' },
  { parent: 'NOM', left: 'VBG', right: 'NOM', weight: 1.6, chain: 'right' },
  { parent: 'NP', left: 'NP', right: 'PP', weight: 1.1 },
  { parent: 'NP', left: 'NP', right: 'SBAR', weight: 0.9, leftStarts: ['DT', 'PDT', 'PRP$', 'CD', 'NN', 'NNS', 'NNP', 'NNPS', 'JJ', 'JJR', 'JJS', 'NOM'] },
  // PTB II keeps the genitive clitic inside the possessor NP, not in a separate POSP.
  { parent: 'NP', left: 'NP', right: 'POS', weight: 0.9, chain: 'left' },
  // A measure nominal takes a genitive modifier as its own specifier, and the measure word may
  // itself be an adjective or a noun: "a week's worth of food".
  { parent: 'NP', left: 'NP', right: 'NOM', weight: 0.5, leftHas: ['POS'] },
  { parent: 'NP', left: 'NP', right: 'ADJP', weight: 0.5, leftHas: ['POS'] },
  // A comma after a nominal is a clause boundary, so it only attaches when a tag or relative follows.
  { parent: 'NP', left: 'NP', right: ',', weight: 2.6 },
  // A two-comma appositive keeps both commas with the nominal: "my brother, who lives in Paris,".
  { parent: 'NPA', left: 'NP', right: ',', weight: 0.3 },
  { parent: 'NPB', left: 'NPA', right: 'SBAR', weight: 0.3, chain: 'left' },
  { parent: 'NP', left: 'NPB', right: ',', weight: 0.3, chain: 'left' },

  { parent: 'VP', left: 'MD', right: 'VP', weight: 0.4 },
  { parent: 'VP', left: 'TO', right: 'VP', weight: 0.4 },
  { parent: 'VP', left: 'ADVP', right: 'VP', weight: 0.7, chain: 'right' },
  { parent: 'VP', left: 'VP', right: 'PP', weight: 0.8, chain: 'left' },
  { parent: 'VP', left: 'VP', right: 'ADVP', weight: 0.9, chain: 'left' },
  { parent: 'VP', left: 'VP', right: 'SBAR', weight: 0.45, chain: 'left' },
  // A resultative or extraposed adjective complement: "she made it clear", "leave it open". A
  // pronoun object cannot carry the adjective inside its own phrase, so the adjective is the
  // complement; a full nominal keeps the adjective inside the nominal ("met something strange").
  { parent: 'VP', left: 'VP', right: 'ADJP', weight: 0.6, chain: 'left', needsPronounObject: true },
  { parent: 'VP', left: 'VP', right: 'PRT', weight: 0.8, chain: 'left' },
  // An auxiliary heads the verb phrase it introduces: "is reading", "has finished", "did go".
  { parent: 'VP', left: 'VB', right: 'VP', weight: 0.8, leftWords: auxiliaryVerbs },
  { parent: 'VP', left: 'VBZ', right: 'VP', weight: 0.5, leftWords: auxiliaryVerbs },
  { parent: 'VP', left: 'VBD', right: 'VP', weight: 0.5, leftWords: auxiliaryVerbs },
  { parent: 'VP', left: 'VBP', right: 'VP', weight: 0.5, leftWords: auxiliaryVerbs },
  // A verb followed by an infinitival verb phrase: "she wants to go", "she seems to know".
  // Control and raising differ in meaning, not in the shape of the drawing.
  { parent: 'VP', left: 'VB', right: 'VP', weight: 0.35, rightStarts: ['TO'] },
  { parent: 'VP', left: 'VBZ', right: 'VP', weight: 0.35, rightStarts: ['TO'] },
  { parent: 'VP', left: 'VBD', right: 'VP', weight: 0.35, rightStarts: ['TO'] },
  { parent: 'VP', left: 'VBP', right: 'VP', weight: 0.35, rightStarts: ['TO'] },
  // A verb followed by a gerund: "she went shopping", "she kept talking".
  { parent: 'VP', left: 'VB', right: 'VP', weight: 0.45, rightStarts: ['VBG'] },
  { parent: 'VP', left: 'VBZ', right: 'VP', weight: 0.45, rightStarts: ['VBG'] },
  { parent: 'VP', left: 'VBD', right: 'VP', weight: 0.45, rightStarts: ['VBG'] },
  { parent: 'VP', left: 'VBP', right: 'VP', weight: 0.45, rightStarts: ['VBG'] },
  // A bare verb complement is the causative and perception pattern. This is one of the few
  // genuinely closed grammatical classes: "let/make/help/see/hear/watch/feel + object + V".
  { parent: 'VP', left: 'VB', right: 'VP', weight: 0.8, leftWords: bareComplementVerbs },
  { parent: 'VP', left: 'VBZ', right: 'VP', weight: 0.9, leftWords: bareComplementVerbs },
  { parent: 'VP', left: 'VBD', right: 'VP', weight: 0.9, leftWords: bareComplementVerbs },
  { parent: 'VP', left: 'VBP', right: 'VP', weight: 0.9, leftWords: bareComplementVerbs },
  { parent: 'VP', left: 'VBN', right: 'VP', weight: 0.6, rightStarts: ['TO', 'VBG'] },
  { parent: 'VP', left: 'VBG', right: 'VP', weight: 0.6, rightStarts: ['TO'] },
  { parent: 'VP', left: 'VBG', right: 'VP', weight: 0.3, headWords: ['having'] },
  { parent: 'VP', left: 'VBZ', right: 'ADJP', weight: 1.0 },
  { parent: 'VP', left: 'VBD', right: 'ADJP', weight: 0.7 },
  { parent: 'VP', left: 'VBZ', right: 'PRT', weight: 0.3 },

  { parent: 'ADJP', left: 'RB', right: 'ADJP', weight: 1.0 },
  { parent: 'ADVP', left: 'RB', right: 'ADVP', weight: 0.4 },
  // An adverb coordinated with another adverb: "quickly and quietly".
  { parent: 'ADVP', left: 'ADVP', right: 'CC', weight: 0.4, chain: 'left' },
  { parent: 'ADVP', left: 'ADVP', right: 'ADVP', weight: 0.6 },
  { parent: 'ADVP', left: 'CC', right: 'ADVP', weight: 0.5 },
  // A coordinated comparatives nominal: "the best and the cheapest".
  { parent: 'NP', left: 'NP', right: 'CC', weight: 0.5, chain: 'left' },
  // "by far the best student": a degree adverb before a definite superlative nominal.
  { parent: 'NP', left: 'ADVP', right: 'NP', weight: 0.4, leftWords: ['by far', 'much', 'far', 'even', 'still', 'quite'] },
  // "away went the train", "here comes the bus": a directional word fronts the clause.
  { parent: 'S', left: 'ADVP', right: 'VP', weight: 0.6, leftStarts: ['RB'] },
  { parent: 'S', left: 'PRT', right: 'VP', weight: 0.5 },
  // "he too": a bare additive adverb closes a remnant.
  { parent: 'S', left: 'NP', right: 'ADVP', weight: 0.6 },

  // "try as she might": a bare verb followed by a concessive clause.
  { parent: 'S', left: 'VB', right: 'SBAR', weight: 0.5 },

  { parent: 'PP', left: 'TO', right: 'NP', weight: 1.0 },
  { parent: 'PP', left: 'IN', right: 'PP', weight: 0.4 },
  { parent: 'PP', left: 'IN', right: 'ADVP', weight: 0.4, leftWords: ['since', 'until', 'till', 'by', 'from', 'before', 'after'] },
  // A stranded preposition has no object: "the bed was slept in", "who did she speak with".
  // A negation before a nominal: "not a book but a pen".
  { parent: 'NP', left: 'ADVP', right: 'NP', weight: 0.6, leftWords: ['not', 'only', 'even', 'just'] },
  // An echo question keeps its wh-phrase in place: "she saw what".
  { parent: 'VP', left: 'VP', right: 'WHNP', weight: 2.0, chain: 'left' },
  // "who did what": the second wh-phrase is the object nominal.
  // "or not" closes a question.
  { parent: 'ADVP', left: 'CC', right: 'RB', weight: 0.5, leftWords: ['or', 'and'], rightWords: ['not'] },
  { parent: 'SQ', left: 'SQ', right: 'ADVP', weight: 0.6, chain: 'left' },
  // The subject and predicate that follow a fronted operator: "is (she happy)",
  // "(isn't) (she happy)". Priced above a declarative so a statement never becomes a question.
  { parent: 'SQ', left: 'NP', right: 'VP', weight: 2.6 },
  { parent: 'SQ', left: 'NP', right: 'ADJP', weight: 2.9 },
  { parent: 'SQ', left: 'NP', right: 'PP', weight: 3.0 },
  // A negation before the subject: "isn't she happy".
  { parent: 'SQ', left: 'RB', right: 'SQ', weight: 0.5, leftWords: ["n't", 'not'] },
  // A fragment built from a preposition phrase: "not until midnight", "what about the plan".
  { parent: 'S', left: 'NP', right: 'PP', weight: 1.2, leftStarts: ['WP', 'WDT', 'NN', 'NNS'] },
  { parent: 'S', left: 'WHADVP', right: 'PP', weight: 0.9 },
  { parent: 'S', left: 'CC', right: 'S', weight: 1.0 },


  { parent: 'PRT', left: 'RP', right: 'NP', weight: 0.6 },
  // A temporal expression is its own phrase: (TMP (JJ last) (NN week)), (TMP (DT every) (NN day)).
  { parent: 'TMP', left: 'JJ', right: 'NN', weight: 0.2, leftWords: [...timeModifiers] },
  { parent: 'TMP', left: 'JJ', right: 'NNS', weight: 0.2, leftWords: [...timeModifiers] },
  { parent: 'TMP', left: 'DT', right: 'NN', weight: 0.2, leftWords: [...timeModifiers], rightWords: [...timeNouns] },
  { parent: 'TMP', left: 'DT', right: 'NNS', weight: 0.2, leftWords: [...timeModifiers], rightWords: [...timeNouns] },
  { parent: 'VP', left: 'VP', right: 'TMP', weight: 0.5, chain: 'left' },
  // A double-object frame needs exactly one existing object, without an intervening clause.
  // A participle takes its object inside its own phrase: "having finished the work".
  { parent: 'VP', left: 'VP', right: 'NP', weight: 0.7, chain: 'left', leftStarts: ['VBN', 'VBG'], leftLacks: ['NP', 'SBAR', 'PP'] },
  { parent: 'VP', left: 'VP', right: 'NP', weight: 1.4, chain: 'left', needsObject: true, rightNotNominative: true, rightStarts: ['DT', 'PRP$', 'PRP', 'PDT', 'CD', 'NN', 'NNS', 'NNP', 'NNPS'] },

  // Questions: a fronted auxiliary heads SQ, and a wh-phrase makes it SBARQ. A declarative S
  // wraps either, so the drawn root stays S for every sentence.
  { parent: 'SQ', left: 'MD', right: 'SQ', weight: 1.0, chain: 'right' },
  { parent: 'SQ', left: 'VBD', right: 'SQ', weight: 1.2, chain: 'right', leftWords: operatorWords },
  { parent: 'SQ', left: 'VBZ', right: 'SQ', weight: 1.2, chain: 'right', leftWords: operatorWords },
  { parent: 'SQ', left: 'VBP', right: 'SQ', weight: 1.2, chain: 'right', leftWords: operatorWords },
  { parent: 'SBARQ', left: 'WHNP', right: 'SQ', weight: 0.4 },
  { parent: 'SBARQ', left: 'WHNP', right: 'S', weight: 0.3 },
  { parent: 'SBARQ', left: 'WHADVP', right: 'SQ', weight: 0.5 },
  { parent: 'SBARQ', left: 'WHPP', right: 'SQ', weight: 0.7 },
  { parent: 'SBARQ', left: 'PP', right: 'SQ', weight: 0.3, leftHas: ['WHNP'] },
  // A fronted operator and its subject; the rest of the predicate follows.
  { parent: 'SQ', left: 'VBZ', right: 'NP', weight: 0.7, leftWords: operatorWords },
  { parent: 'SQ', left: 'VBD', right: 'NP', weight: 0.7, leftWords: operatorWords },
  { parent: 'SQ', left: 'VBP', right: 'NP', weight: 0.7, leftWords: operatorWords },
  { parent: 'SQ', left: 'MD', right: 'NP', weight: 0.6 },
  { parent: 'SQ', left: 'SQ', right: 'ADJP', weight: 0.5, chain: 'left', leftLacks: ['VP', 'ADJP'] },
  { parent: 'SQ', left: 'SQ', right: 'NP', weight: 0.6, chain: 'left', leftLacks: ['VP', 'ADJP'], headWords: ['is', 'am', 'are', 'was', 'were', 'be', 'become', 'became', 'seem', 'seems', 'look', 'looks', 'feel', 'feels', 'get', 'gets', 'stay', 'remain', 'have', 'has', 'had'] },
  { parent: 'SQ', left: 'SQ', right: 'PP', weight: 0.6, chain: 'left', leftLacks: ['VP', 'ADJP'] },
  { parent: 'SQ', left: 'SQ', right: 'VP', weight: 0.6, chain: 'left', leftLacks: ['VP', 'ADJP', 'PP'] },
  // An imperative that needs a clause around it.
  // The hortative "let" opens an imperative clause; its contracted forms behave the same.
  { parent: 'S', left: 'VB', right: 'VP', weight: 0.9, leftWords: ['let', 'let us', "let's"] },
  { parent: 'S', left: 'RB', right: 'RB', weight: 2.4 },
];

const verbTags: Tag[] = ['VBD', 'VBP', 'VBZ', 'VB', 'VBN', 'VBG'];

const auxiliaryWords = /^(be|am|is|are|was|were|been|being|have|has|had|do|does|did|will|would|can|could|may|might|shall|should|must)$/i;

// These words introduce a clause, so "that I read" must not become a preposition with an object.
const complementizers = new Set(['that', 'if', 'whether', 'because', 'although', 'though', 'unless', 'whereas', 'whilst']);

// The "[adjunct] , clause" shape, which ends a matrix clause rather than a relative.
function isFrontedClause(node: RawNode): boolean {
  return node.children.length === 2 && ['ADJX', 'S'].includes(node.children[0].label) && ['S', 'SQ', 'SBARQ'].includes(node.children[1].label);
}

// The last word a phrase contains, mirroring leftmostWord for the right edge.
function rightmostWord(node: RawNode): string {
  let current = node;
  while (current.children.length) current = current.children[current.children.length - 1];
  return auxiliaryKey(current.label);
}

// The word a phrase starts with, which is how a verb's own frame is recognised.
function leftmostWord(node: RawNode): string {
  let current = node;
  while (current.children.length) current = current.children[0];
  return auxiliaryKey(current.label);
}

// The tag of the leftmost preterminal, which is how a phrase begins.
function leftmostTag(node: RawNode): string {
  let current = node;
  while (current.children.length) {
    const child = current.children[0];
    if (!child.children.length) return current.label;
    current = child;
  }
  return current.label;
}

function singleWord(node: RawNode | undefined) {
  return node && node.children.length === 1 ? node.children[0].label : undefined;
}

function prepositionPenalty(rule: Rule, left: RawNode) {
  if (rule.parent !== 'PP' || rule.left !== 'IN' || left.children.length !== 1) return 0;
  return complementizers.has(left.children[0].label.toLocaleLowerCase('en')) ? 2.5 : 0;
}

// A finite clause needs a tensed predicate, excluding infinitives and inversion.
function finiteClause(node: RawNode): boolean {
  return node.label === 'S' && node.children.some(isFiniteVerbPhrase);
}

function objectInfinitive(verb: string, clause: RawNode): boolean {
  const [object, predicate] = clause.children;
  if (clause.children.length !== 2 || object?.label !== 'NP' || object.children.length !== 1
    || object.children[0].label !== 'PRP' || predicate?.label !== 'VP' || leftmostTag(predicate) !== 'TO') return false;
  const pronoun = leftmostWord(object);
  // A nominal before “to” can itself license a modifying infinitive, as in “plans to leave”.
  return /^(?:me|you|him|her|us|them)$/u.test(pronoun)
    && [verb, ...lemmaCandidates(verb, undefined, 'verb')].some(lemma => objectInfinitiveVerbs.has(lemma));
}

function relativeAttachmentPenalty(left: RawNode, right: RawNode) {
  let head = left.children[contentHeadIndex(left)];
  while (head?.label === 'VP' && head === left.children.at(-1)) {
    left = head;
    head = left.children[contentHeadIndex(left)];
  }
  const object = left.children.at(-1);
  if (object?.label !== 'NP' || !/^NN(?:S|P|PS)?$/u.test(rightmostPreterminal(object).label)) return 0;
  const verb = auxiliaryKey(headWord(left).label);
  if (takesRecipientClause(verb)) return 0;
  const marker = right.children[0]?.label;
  const predicate = right.children[1];
  const relative = marker === 'WHNP' || marker === 'WHPP'
    || marker === 'NP' && !beWords.has(verb) && predicate && isFiniteVerbPhrase(predicate) && extractionSite(predicate);
  // A lexical subject plus a clause can follow an addressee as well as a relative antecedent.
  return relative ? 0.8 : 0;
}

// Transitive and intransitive verb frames are generated from one tag list.
const verbRules: Rule[] = verbTags.flatMap(tag => {
  return [
    { parent: 'VP', left: tag, right: 'NP', weight: 1.2, rightNotNominative: true },
    { parent: 'VP', left: tag, right: 'INF', weight: 1.2 },
    { parent: 'VP', left: tag, right: 'PP', weight: 0.9 },
    { parent: 'VP', left: tag, right: 'SBAR', weight: 0.7 },
    { parent: 'VP', left: tag, right: 'S', weight: 0.7 },
    { parent: 'VP', left: tag, right: 'QUOTE', weight: 0.7 },
    // A lexical verb rarely takes an adjective phrase ("*working very happy"); be does that.
    { parent: 'VP', left: tag, right: 'ADJP', weight: 1.0 },
    { parent: 'VP', left: tag, right: 'PRT', weight: 0.7 },
    { parent: 'VP', left: tag, right: 'ADVP', weight: 0.8 },
  ];
});

const allRules = [...rules, ...verbRules];
const coordinationCost: Record<string, number> = { S: 0.45, VP: 0.6, NP: 0.9, ADJP: 0.6, PP: 0.6 };

const unary: Unary[] = [
  { parent: 'NP', child: 'NN', weight: 1.0 }, { parent: 'NP', child: 'NNS', weight: 1.0 },
  { parent: 'NP', child: 'NNP', weight: 1.0 }, { parent: 'NP', child: 'NNPS', weight: 1.0 },
  { parent: 'NP', child: 'PRP', weight: 1.0 }, { parent: 'NP', child: 'EX', weight: 0.8 },
  // A demonstrative is a determiner by tag but a pronoun when it stands alone.
  { parent: 'NP', child: 'DT', weight: 1.6, childWords: ['this', 'that', 'these', 'those'] },
  { parent: 'NP', child: 'CD', weight: 0.5 },
  { parent: 'NP', child: 'NOM', weight: 1.0 },
  { parent: 'NOM', child: 'NN', weight: 1.0 }, { parent: 'NOM', child: 'NNS', weight: 1.0 },
  // "the rich": an adjective can head a nominal, but only when no noun reading fits.
  { parent: 'NOM', child: 'JJ', weight: 2.0 },
  { parent: 'NOM', child: 'NNP', weight: 1.0 }, { parent: 'NOM', child: 'NNPS', weight: 1.0 },
  { parent: 'VP', child: 'VBD', weight: 0.35 }, { parent: 'VP', child: 'VBZ', weight: 0.35 },
  { parent: 'VP', child: 'VBP', weight: 0.35 }, { parent: 'VP', child: 'VB', weight: 0.35 },
  { parent: 'VP', child: 'VBG', weight: 0.4 }, { parent: 'VP', child: 'VBN', weight: 0.4 },
  // A modal can carry the whole predicate when what follows is understood: "than I need".
  { parent: 'VP', child: 'MD', weight: 1.4, strandable: true },
  { parent: 'ADJP', child: 'JJ', weight: 0.4 }, { parent: 'ADJP', child: 'JJR', weight: 0.6 },
  { parent: 'ADJP', child: 'JJS', weight: 0.6 }, { parent: 'ADJP', child: 'VBN', weight: 0.4 },
  { parent: 'ADJP', child: 'VBG', weight: 1.2 },
  { parent: 'ADVP', child: 'RB', weight: 0.4 }, { parent: 'ADVP', child: 'RBR', weight: 0.6 },
  { parent: 'ADVP', child: 'RBS', weight: 0.6 },
  { parent: 'WHNP', child: 'WP', weight: 0.9 }, { parent: 'WHNP', child: 'WDT', weight: 0.7 },
  { parent: 'WHADVP', child: 'WRB', weight: 0.9 },
  { parent: 'PRT', child: 'RP', weight: 0.4 },
  // A subjectless clause is the relative-clause reading; it must stay costlier than a real S.
  { parent: 'S', child: 'VP', weight: 1.6 },
  { parent: 'S', child: 'SQ', weight: 1.4 },
  { parent: 'S', child: 'NP', weight: 3.2 },
  // A stranded preposition has no object: "the bed was slept in", "who did she speak with".
  { parent: 'PP', child: 'IN', weight: 1.6, childWords: strandablePrepositions },
  // "who did what": the second wh-phrase is the object nominal.
  { parent: 'NP', child: 'WHNP', weight: 2.2 },
  // A fragment of a preposition phrase: "not until midnight".
  { parent: 'S', child: 'PP', weight: 1.4 },
  { parent: 'S', child: 'EXC', weight: 0.7 },
  { parent: 'S', child: 'CMP', weight: 0.8 },
  // A quantifier is a kind of one-word phrase: "most of the students", "more books".
  { parent: 'QP', child: 'JJS', weight: 0.4, childWords: quantifierWords },
  { parent: 'QP', child: 'JJR', weight: 0.4, childWords: quantifierWords },
  { parent: 'QP', child: 'JJ', weight: 0.45, childWords: quantifierWords },
  { parent: 'QP', child: 'RBR', weight: 0.4, childWords: quantifierWords },
  { parent: 'QP', child: 'RB', weight: 0.45, childWords: quantifierWords },
  { parent: 'QP', child: 'NN', weight: 1.0, childWords: quantifierWords },
  { parent: 'QP', child: 'DT', weight: 0.9, childWords: quantifierWords },
  { parent: 'QP', child: 'PDT', weight: 0.9, childWords: quantifierWords },
  { parent: 'QP', child: 'CD', weight: 1.2 },

  // A demonstrative or quantifier can stand alone as a nominal.
  { parent: 'NP', child: 'QP', weight: 2.2 },
  { parent: 'S', child: 'SBARQ', weight: 0.6 },
];

function combine(parent: string, rule: Rule, left: RawNode, right: RawNode): RawNode {
  if (parent === 'S' && rule.left === 'SEQ') return { label: 'S', children: [...left.children, right] };
  if (parent === 'VP' && rule.right === 'INF') return { label: 'VP', children: [left, ...right.children] };
  if (rule.chain === 'right' && right.label === parent) return { label: parent, children: [left, ...right.children] };
  if (rule.chain === 'left' && left.label === parent) return { label: parent, children: [...left.children, right] };
  return { label: parent, children: [left, right] };
}

// A bounded CKY chart. Costs are negative log probabilities, so the derivation with the least
// total cost wins; every rule and tag therefore has to earn its place in the structure.
export function parseTaggedSentence(input: string, pos?: PosLookup): RawNode {
  input = input.trim();
  const words = tokenize(input);
  if (!words.length || words.length > maxWords) throw new Error('TREE_PARSE');
  const pairs = new Map<number, number>();
  const stack: { word: string; index: number }[] = [];
  const closing: Record<string, string> = { '(': ')', '“': '”', '‘': '’', '"': '"' };
  words.forEach((word, index) => {
    if (stack.length && closing[stack.at(-1)!.word] === word) {
      pairs.set(stack.pop()!.index, index);
    } else if (Object.hasOwn(closing, word)) stack.push({ word, index });
    else if (word === ')' || word === '”') throw new Error('TREE_PARSE');
  });
  if (stack.length) throw new Error('TREE_PARSE');
  const delimiters = new Set([...pairs].flat());
  const closingDelimiters = new Set(pairs.values());
  const chart: Map<string, Cell>[][] = Array.from({ length: words.length }, () => Array.from({ length: words.length + 1 }, () => new Map<string, Cell>()));
  const put = (start: number, end: number, label: string, cell: Cell) => {
    const span = chart[start][end], prior = span.get(label);
    if (prior && cell.cost >= prior.cost) return false;
    span.set(label, cell);
    return true;
  };
  const putDate = (start: number, end: number) => {
    const span = words.slice(start, end);
    if (calendarDateHead(span) === undefined) return;
    const children = span.map(word => ({
      label: word === ',' ? ',' : /^\d+(?:st|nd|rd|th)$/iu.test(word) ? 'JJ' : /^\d/u.test(word) ? 'CD' : 'NNP',
      children: [{ label: word, children: [] }],
    }));
    for (const label of ['TMP', 'NP']) put(start, end, label, { cost: 0.2, node: { label: label === 'TMP' ? 'NP-TMP' : 'NP', children } });
  };
  const close = (start: number, end: number) => {
    let changed = false;
    for (const rule of unary) {
      const source = chart[start][end].get(rule.child);
      if (!source) continue;
      if (rule.childWords && !(source.node.children.length === 1 && rule.childWords.includes(source.node.children[0].label.toLocaleLowerCase('en')))) continue;
      // An auxiliary is a helper, not a one-word predicate: "did" alone never forms a VP, but
      // "to do" and "can do" are verb phrases.
      if (rule.parent === 'VP' && source.node.children.length === 1 && auxiliaryWords.test(auxiliaryKey(source.node.children[0].label))) {
        const before = start > 0 ? words[start - 1].toLocaleLowerCase('en') : '';
        const licensed = rule.strandable || /^(?:to|will|would|can|could|may|might|shall|should|must|not|n't)$/u.test(before)
          || end === words.length || /^[.!?]+$/u.test(words[end] ?? '') || closingDelimiters.has(end);
        if (!licensed) continue;
      }
      const cell = { cost: source.cost + rule.weight, node: { label: rule.parent, children: [source.node] } };
      if (put(start, end, rule.parent, cell)) changed = true;
    }
    return changed;
  };
  const hints = tagHints(words, pos);

  words.forEach((word, index) => {
    if (delimiters.has(index)) return;
    const terminal = /^[.!?]+$/u.test(word);
    const punctuation = terminal || /^[,;:]$/u.test(word);
    if (!punctuation) for (const choice of tagCandidates(word, index, words[index + 1], hints[index + 1], words[index - 1], hints[index - 1], words[index - 2], words[index + 2], pos)) put(index, index + 1, choice.tag, { cost: choice.cost, node: { label: choice.tag, children: [{ label: word, children: [] }] } });
    else {
      const tag = terminal ? '.' : word === ';' ? ':' : word;
      put(index, index + 1, tag, { cost: 0.05, node: { label: tag, children: [{ label: word, children: [] }] } });
    }
    putDate(index, index + 1);
    while (close(index, index + 1)) { /* unary closure */ }
  });

  for (let length = 2; length <= words.length; length++) for (let start = 0; start + length <= words.length; start++) {
    const end = start + length;
    if (length <= 4) putDate(start, end);
    if (pairs.get(start) === end - 1) {
      for (const [label, cell] of chart[start + 1][end - 1]) {
        if (!['S', 'NP', 'VP', 'ADJP', 'ADVP', 'PP', 'NOM'].includes(label) || (words[start] === '(' && label === 'NOM')) continue;
        const parenthesis = words[start] === '(';
        const children = [
          { label: parenthesis ? '-LRB-' : '``', children: [{ label: words[start], children: [] }] },
          cell.node,
          { label: parenthesis ? '-RRB-' : "''", children: [{ label: words[end - 1], children: [] }] },
        ];
        const wrapped = { cost: cell.cost + 0.1, node: { label, children } };
        if (!parenthesis || label === 'S') put(start, end, label, wrapped);
        put(start, end, parenthesis ? 'PRN' : label === 'S' ? 'QUOTE' : label, { ...wrapped, node: { label: parenthesis ? 'PRN' : label === 'S' ? 'QUOTE' : label, children } });
      }
    }
    for (let split = start + 1; split < end; split++) {
      for (const rule of allRules) {
        const left = chart[start][split].get(rule.left), right = chart[split][end].get(rule.right);
        if (!left || !right) continue;
        // Reuse dictionary clause frames rather than allowing every verb to absorb a sentence.
        if (rule.parent === 'VP' && verbTags.some(tag => tag === rule.left) && rule.right === 'S' && (!selectsFiniteClause(leftmostWord(left.node)) || !finiteClause(right.node))) continue;
        if (rule.parent === 'VP' && rule.right === 'INF' && !objectInfinitive(leftmostWord(left.node), right.node)) continue;
        // A selected object infinitive is part of the VP, including in a bare coordinated VP.
        if (rule.parent === 'S' && rule.left === 'VB' && rule.right === 'SBAR'
          && objectInfinitive(leftmostWord(left.node), right.node)) continue;
        // A bare participle after a noun is a postmodifier, not a new prenominal adjective.
        if (rule.parent === 'NOM' && ['NN', 'NNS'].includes(rule.left) && leftmostTag(right.node) === 'VBN') continue;
        // Conditional inversion retains an overt subject: "had she left", not "were sitting".
        if (rule.parent === 'SBAR' && rule.left === 'VBD' && rule.right === 'S' && right.node.children[0]?.label !== 'NP') continue;
        // A second object needs a first one, and an auxiliary never takes two.
        if (rule.needsObject && (left.node.children.filter(child => child.label === 'NP').length !== 1 || left.node.children.some(child => child.label === 'SBAR') || auxiliaryWords.test(auxiliaryKey(singleWord(left.node.children[0]) ?? '')))) continue;
        // Complementizer clauses only form around words that actually introduce a clause.
        if (rule.leftWords && !rule.leftWords.includes(leftmostWord(left.node))) continue;
        if (rule.rightWords && !rule.rightWords.includes(rightmostWord(right.node))) continue;
        if (rule.headWords && !rule.headWords.includes(leftmostWord(left.node))) continue;
        if (rule.rightHeadWords && !rule.rightHeadWords.includes(leftmostWord(right.node))) continue;
        if (rule.leftStarts && !rule.leftStarts.includes(leftmostTag(left.node))) continue;
        if (rule.leftNoStart && rule.leftNoStart.includes(leftmostTag(left.node))) continue;
        if (rule.leftHas && !left.node.children.some(child => rule.leftHas!.includes(child.label))) continue;
        // A subject-auxiliary clause that already has a predicate takes no second one.
        if (rule.leftLacks && left.node.children.some(child => rule.leftLacks!.includes(child.label))) continue;
        if (rule.needsPronounObject) {
          const object = left.node.children.find(child => child.label === 'NP');
          if (!object || !(object.children.length === 1 && object.children[0].label === 'PRP')) continue;
        }
        // A wh-determiner takes a noun phrase, never a standalone personal pronoun.
        if (rule.parent === 'WHNP' && rule.left === 'WDT' && rule.right === 'NP' && right.node.children.length === 1 && right.node.children[0].label === 'PRP') continue;
        // A nominative pronoun is a subject, so it can never be the object of a transitive verb.
        let nominativePenalty = 0;
        if (rule.rightNotNominative) {
          const word = singleWord(right.node.children.length === 1 && right.node.children[0].label === 'PRP' ? right.node.children[0] : undefined);
          if (word !== undefined && ['i', 'he', 'she', 'we', 'they'].includes(word.toLocaleLowerCase('en'))) {
            if (!rule.needsObject) continue;
            // Keep a noisy-input fallback while preferring a new clause with this subject.
            nominativePenalty = 2;
          }
        }
        // A relative clause ends at its verb phrase; a following ", main clause" is not part of it.
        if (rule.rightNoFronted && isFrontedClause(right.node)) continue;
        if (rule.rightStarts && !rule.rightStarts.includes(leftmostTag(right.node))) continue;
        const relativePenalty = rule.parent === 'VP' && rule.left === 'VP' && rule.right === 'SBAR' ? relativeAttachmentPenalty(left.node, right.node) : 0;
        put(start, end, rule.parent, { cost: left.cost + right.cost + rule.weight + prepositionPenalty(rule, left.node) + relativePenalty + nominativePenalty, node: combine(rule.parent, rule, left.node, right.node) });
      }
    }
    while (close(start, end)) { /* unary closure */ }
    // A possessor NP ending in the genitive clitic takes the following nominal:
    // (NP (NP John (POS 's)) (NN book)). No other NP NOM sequence is a possessive.
    if (end - start >= 3) for (let middle = start + 1; middle < end; middle++) {
      const left = chart[start][middle].get('NP'), right = chart[middle][end].get('NOM');
      if (!left || !right || rightmostPreterminal(left.node).label !== 'POS') continue;
      put(start, end, 'NP', { cost: left.cost + right.cost + 0.9, node: { label: 'NP', children: [left.node, right.node] } });
    }
    // Coordination keeps the conjuncts and the conjunction as siblings, as in PTB. A clausal
    // coordination is the ordinary reading, so it costs less than a nominal one.
    if (end - start >= 3) for (let middle = start + 1; middle < end - 1; middle++) {
      if (chart[middle][middle + 1].has(',')) {
        const left = chart[start][middle].get('NP'), right = chart[middle + 1][end].get('NP');
        const description = words[end - 1] === ',' ? chart[middle + 1][end - 1].get('NP') : undefined;
        if (left && description && ['DT', 'PRP$'].includes(leftmostTag(description.node))) {
          const comma = () => ({ label: ',', children: [{ label: ',', children: [] }] });
          put(start, end, 'NP', { cost: left.cost + description.cost + 0.6, node: {
            label: 'NP', children: [left.node, comma(), description.node, comma()],
          } });
          while (close(start, end)) { /* close the completed apposition */ }
        }
        if (left && right && !['PRP', 'WP', 'WDT', 'WRB'].includes(leftmostTag(left.node))
          && !['PRP', 'WP', 'WDT', 'WRB'].includes(leftmostTag(right.node))) {
          put(start, end, 'NP', { cost: left.cost + right.cost + 0.9, node: {
            label: 'NP', children: [
              ...(isNominalList(left.node) ? left.node.children : [left.node]),
              { label: ',', children: [{ label: ',', children: [] }] },
              ...(isNominalList(right.node) ? right.node.children : [right.node]),
            ],
          } });
          while (close(start, end)) { /* close the completed nominal list */ }
        }
      }
      if (!chart[middle][middle + 1].has('CC')) continue;
      for (const label of ['S', 'VP', 'NP', 'ADJP', 'PP']) {
        const left = chart[start][middle].get(label), right = chart[middle + 1][end].get(label), conjunction = chart[middle][middle + 1].get('CC');
        if (!left || !right || !conjunction) continue;
        put(start, end, label, { cost: left.cost + right.cost + conjunction.cost + coordinationCost[label], node: { label, children: [left.node, conjunction.node, right.node] } });
      }
    }
  }
  let best = chart[0][words.length].get('S');
  // Prefer an explicit closing comma to swallowing the matrix subject into a fronted adjunct.
  for (let comma = 1; comma < words.length - 1; comma++) {
    if (words[comma] !== ',') continue;
    const adjunct = chart[0][comma].get('SBAR'), matrix = chart[comma + 1][words.length].get('S');
    const clause = adjunct?.node.children.find(child => child.label === 'S');
    if (adjunct?.node.children[0]?.label !== 'IN' || !clause?.children.some(child => child.label === 'VP') || !matrix) continue;
    best = { cost: adjunct.cost + matrix.cost, node: { label: 'S', children: [adjunct.node, { label: ',', children: [{ label: ',', children: [] }] }, matrix.node] } };
    break;
  }
  {
    const stop = chart[words.length - 1][words.length].get('.')
      ?? (words.at(-1) === ':' ? chart[words.length - 1][words.length].get(':') : undefined);
    const end = stop ? words.length - 1 : words.length;
    const wh = stop?.node.children[0].label.includes('?') ? chart[0][end].get('WHADVP') : undefined;
    const interjection = chart[0][end].get('UH'), adverbial = chart[0][end].get('ADVP');
    const heading = words.at(-1) === ':' ? chart[0][end].get('NP') : undefined;
    const clause = words.at(-1) === ':' ? chart[0][end].get('S') : undefined;
    const subjectPredicate = clause?.node.children.some(child => child.label === 'NP') && clause.node.children.some(child => child.label === 'VP');
    if (!best && stop && clause && (!heading || subjectPredicate)) best = {
      cost: clause.cost + stop.cost, node: { label: 'S', children: [...clause.node.children, stop.node] },
    };
    const word = adverbial && rightmostPreterminal(adverbial.node).children[0]?.label;
    const key = word?.toLocaleLowerCase('en');
    const knownAdverb = key && (adverbs.has(key) || pos?.(key)?.some(([part]) => part === 'adverb')
      || closed.some(([tag, items]) => tag === 'RB' && items.includes(key)) || word === key && /ly$/u.test(key));
    const fragment = wh ?? interjection ?? (knownAdverb ? adverbial : undefined) ?? heading;
    if ((!best || wh) && fragment) best = { cost: fragment.cost, node: { label: 'FRAG', children: [fragment.node, ...(stop ? [stop.node] : [])] } };
  }
  if (!best) {
    throw new Error('TREE_PARSE');
  }
  return indexMovement(normalize(best.node));
}

// Base nominals are folded into the NP so prenominal material is flat, as in PTB II.
// Place traces after building the clause that contains them.
const whLabels = new Set(['WHNP', 'WHADVP', 'WHPP', 'WDT', 'WP', 'WP$', 'WRB']);
const complementLabels = new Set(['NP', 'PP', 'SBAR', 'S', 'ADJP', 'PRP']);

function firstWord(node: RawNode | undefined): RawNode | undefined {
  if (!node) return undefined;
  if (!node.children.length) return node;
  for (const child of node.children) {
    const found = firstWord(child);
    if (found) return found;
  }
  return undefined;
}

function headWord(node: RawNode): RawNode {
  while (node.children.length) node = node.children[headIndex(node)];
  return node;
}

function verbPhraseOf(clause: RawNode): RawNode | undefined {
  if (clause.label === 'VP') return clause;
  return clause.children.find(child => child.label === 'VP');
}

function hasComplement(vp: RawNode) {
  // An existing trace already marks the gap, so the clause is not missing a complement.
  return vp.children.some(child => complementLabels.has(child.label) || child.label === 'VP' || isTraceLabel(child.label));
}

// Follow auxiliary projections before locating an object or a stranded preposition.
function extractionSite(vp: RawNode): RawNode | undefined {
  const nested = vp.children.find(child => child.label === 'VP');
  if (nested) return vp.children.some(child => ['NP', 'PP', 'SBAR', 'S'].includes(child.label)) ? undefined : extractionSite(nested);
  const stranded = vp.children.find(child => child.label === 'PP' && child.children.length === 1 && ['IN', 'TO'].includes(child.children[0].label));
  if (stranded) return stranded;
  const complement = vp.children.find(child => child.label === 'SBAR' && child.children[0]?.label === 'IN' && firstWord(child.children[0])?.label.toLocaleLowerCase('en') === 'that');
  const clause = complement?.children.find(child => child.label === 'S') ?? vp.children.find(child => child.label === 'S' && finiteClause(child));
  const embedded = clause && verbPhraseOf(clause);
  if (clause && embedded && !vp.children.some(child => child !== clause && ['NP', 'PP', 'S', 'ADJP'].includes(child.label))) {
    // A zero-complementizer subject gap belongs inside the embedded clause.
    if (!complement && !clause.children.some(child => ['NP', 'PRP', 'EX'].includes(child.label))) return clause;
    return extractionSite(embedded);
  }
  return !hasComplement(vp) ? vp : undefined;
}

function isAdverbialWh(node: RawNode): boolean {
  return node.label === 'WHADVP' && (node.children.length === 1 || firstWord(node)?.label.toLocaleLowerCase('en') === 'how' && node.children.some(child => ['ADJP', 'ADVP'].includes(child.label)));
}

// A fronted predicative adjective leaves an AP slot after the copula, not an adverbial slot.
function copularGapSite(clause: RawNode, vp: RawNode | undefined): RawNode | undefined {
  const site = vp ? extractionSite(vp) : clause;
  if (!site?.children.some(child => /^VB/u.test(child.label) && beWords.has(auxiliaryKey(firstWord(child)?.label ?? '')))) return;
  if (site.label === 'VP') return !hasComplement(site) ? site : undefined;
  if (site.label === 'SQ' && site.children.filter(child => child.label === 'NP').length === 1 && !site.children.some(child => ['VP', 'ADJP', 'PP'].includes(child.label))) return site;
}

// A trace is the empty node the moved constituent left behind; it is filled in by the index pass.
function trace(): RawNode {
  return { label: 't', children: [] };
}

// Index the wh-nominal inside a fronted phrase, never its preposition or complementizer.
function fillerOf(node: RawNode | undefined): RawNode | undefined {
  if (!node) return undefined;
  // A pied-piped prepositional phrase moves with its wh-noun, so the noun carries the index.
  const whNoun = node.label === 'WHPP' || node.label === 'PP' ? node.children.find(child => child.label === 'WHNP') : undefined;
  const word = firstWord(whNoun ?? node);
  return word && word.label.toLocaleLowerCase('en') !== 'that' && word.label.toLocaleLowerCase('en') !== 'whoever'
    ? word
    : undefined;
}

/**
 * Adds movement traces and coindexes each with its antecedent. The pass runs after the tree is
 * complete because a trace's position depends on the clause shape: an object relative puts it at
 * the end of the verb phrase, a passive puts it in the object slot of the participle, and a
 * subject gap puts it at the left edge of the clause.
 */
function indexMovement(root: RawNode): RawNode {
  const pairs: { trace: RawNode; filler?: RawNode }[] = [];
  // Nested clauses and nominals own their extraction gaps.
  const lowerHasTrace = (node: RawNode): boolean => node.children.some(child => isTraceLabel(child.label) || pairs.some(pair => pair.trace === child) || !['NP', 'SBAR', 'S', 'SQ', 'SBARQ'].includes(child.label) && lowerHasTrace(child));
  const walk = (node: RawNode, insideNominal: boolean, previous?: RawNode): RawNode => {
    const children: RawNode[] = [];
    node.children.forEach((child, index) => children.push(walk(child, node.label === 'NP' || (insideNominal && node.label === 'SBAR'), node.label === 'NP' && children.length ? { label: 'NP', children: [...children] } : children[index - 1])));
    const copy: RawNode = { label: node.label, children };
    // Overt wh complements and nominal relatives share the extraction pass.
    if (copy.label === 'SBAR') {
      const [subject, predicate] = children;
      const demonstrative = subject?.children[0];
      if (insideNominal && previous?.label === 'NP' && children.length === 2 && predicate && isFiniteVerbPhrase(predicate)
        && subject?.label === 'NP' && subject.children.length === 1 && demonstrative?.label === 'DT'
        && firstWord(demonstrative)?.label.toLocaleLowerCase('en') === 'that') {
        // The lone postnominal “that” is the relativizer, not an overt clause subject.
        children[0] = { label: 'WHNP', children: [{ ...demonstrative, label: 'WDT' }] };
        children[1] = { label: 'S', children: [predicate] };
      }
      const clause = children.find(child => ['S', 'VP'].includes(child.label));
      const vp = clause ? verbPhraseOf(clause) : undefined;
      const wh = children.find(child => whLabels.has(child.label) || child.label === 'PP' && child.children.some(part => part.label === 'WHNP'));
      const word = wh ? firstWord(wh) : undefined;
      const thatRelative = word !== undefined && word.label.toLocaleLowerCase('en') === 'that';
      // The preceding nominal supplies its grammatical head, excluding postmodifiers.
      const headOfNominal = previous ? headWord(previous) : undefined;
      const filler = thatRelative ? word : fillerOf(wh) ?? (wh ? undefined : headOfNominal);
      if (clause && vp) {
        // A zero relative puts the subject beside the verb phrase instead of inside an S node.
        const clauseIsPhrase = clause.label === 'VP';
        const hasSubject = clauseIsPhrase
          ? children.some(child => child !== clause && ['NP', 'PRP', 'EX'].includes(child.label))
          : clause.children.some(child => ['NP', 'PRP', 'EX'].includes(child.label));
        // A fronted wh-subject leaves a subject gap, not an object gap.
        const subjectless = clause.label === 'S' && !hasSubject;
        // A "that" clause is ambiguous between complement and relative, so it carries no gap; a
        // wh-relative and a zero relative have an overt or zero operator and therefore do.
        const thatClause = children[0]?.label === 'IN' && (firstWord(children[0])?.label ?? '').toLocaleLowerCase('en') === 'that';
        const operatorMarked = !thatClause && (wh !== undefined || !children.some(child => child.label === 'IN'));
        // A reflexive subject marks an appositive ("she herself arrived"), not a relative clause.
        const subjectNode = clauseIsPhrase ? children.find(child => child !== clause && ['NP', 'PRP'].includes(child.label)) : clause.children.find(child => ['NP', 'PRP'].includes(child.label));
        const reflexive = /^(?:my|your|him|her|it|our|them)sel(?:f|ves)$/u.test((firstWord(subjectNode)?.label ?? '').toLocaleLowerCase('en'));
        const site = extractionSite(vp);
        const objectGap = (insideNominal || wh?.label === 'WHNP') && operatorMarked && (!wh || wh.label === 'WHNP') && hasSubject && !reflexive && site !== undefined && !lowerHasTrace(site);
        // Relative adjuncts keep an adverbial or prepositional gap, never an object gap.
        // A bare temporal when may introduce an adjunct rather than a moved interrogative.
        const adverbialGap = wh && (wh.label === 'WHPP' || isAdverbialWh(wh) && (insideNominal || word?.label.toLocaleLowerCase('en') !== 'when')) && !lowerHasTrace(vp);
        const adjectiveSite = wh?.label === 'WHADVP' && (wh.children.some(child => child.label === 'ADJP') || ['how', 'where', 'when'].includes(firstWord(wh)?.label.toLocaleLowerCase('en') ?? '')) ? copularGapSite(clause, vp) : undefined;
        if (objectGap || adverbialGap || adjectiveSite) {
          const gap = trace();
          if (objectGap) {
            if (site!.label === 'S') site!.children.unshift(gap);
            else site!.children.push(gap);
          }
          else if (adjectiveSite) adjectiveSite.children.push({ label: ['where', 'when'].includes(firstWord(wh)?.label.toLocaleLowerCase('en') ?? '') ? 'PP' : 'ADJP', children: [gap] });
          else vp.children.push({ label: wh?.label === 'WHADVP' ? 'ADVP' : 'PP', children: [gap] });
          pairs.push({ trace: gap, filler });
        } else if (subjectless && filler && (wh?.label === 'WHNP' || !insideNominal && previous !== undefined && ['NP', 'PRP'].includes(previous.label))) {
          // Relative and cleft wh-subjects originate at the left edge of the clause.
          const gap = trace();
          clause.children.unshift(gap);
          pairs.push({ trace: gap, filler });
        }
      }
    }
    if (copy.label === 'SBARQ') {
      const wh = children.find(child => whLabels.has(child.label) || child.label === 'PP' && child.children.some(part => part.label === 'WHNP'));
      const clause = children.find(child => ['SQ', 'S'].includes(child.label));
      const vp = clause ? verbPhraseOf(clause) : undefined;
      const filler = fillerOf(wh);
      if (wh && clause && filler) {
        const subjectless = !clause.children.some(child => ['NP', 'PRP', 'EX'].includes(child.label));
        const adjectiveSite = wh.label === 'WHADVP' && (wh.children.some(child => child.label === 'ADJP') || ['how', 'where', 'when'].includes(firstWord(wh)?.label.toLocaleLowerCase('en') ?? '')) ? copularGapSite(clause, vp) : undefined;
        if (adjectiveSite && !lowerHasTrace(adjectiveSite)) {
          const gap = trace();
          adjectiveSite.children.push({ label: ['where', 'when'].includes(firstWord(wh)?.label.toLocaleLowerCase('en') ?? '') ? 'PP' : 'ADJP', children: [gap] });
          pairs.push({ trace: gap, filler });
        } else if (wh.label === 'WHNP' && subjectless) {
          const gap = trace();
          clause.children.unshift(gap);
          pairs.push({ trace: gap, filler });
        } else if (vp) {
          const candidate = wh.label === 'WHNP' ? extractionSite(vp) : undefined;
          const site = candidate && !lowerHasTrace(candidate) ? candidate : undefined;
          const adjunct = isAdverbialWh(wh) && !lowerHasTrace(vp);
          const prepositional = (wh.label === 'WHPP' || wh.label === 'PP') && !lowerHasTrace(vp);
          if (site || adjunct || prepositional) {
            const gap = trace();
            if (site) {
              if (site.label === 'S') site.children.unshift(gap);
              else site.children.push(gap);
            }
            else vp.children.push({ label: adjunct ? 'ADVP' : 'PP', children: [gap] });
            pairs.push({ trace: gap, filler });
          }
        }
      }
    }
    // The parser's verbal VBN projection supplies passive evidence even without an overt agent.
    if (copy.label === 'S' || copy.label === 'SQ') {
      const subject = children.find(child => ['NP', 'PRP'].includes(child.label));
      let vp = copy.label === 'SQ' ? copy : children.find(child => child.label === 'VP');
      let passive: RawNode | undefined;
      while (vp) {
        const inner = vp.children.find(child => child.label === 'VP');
        if (inner?.children.some(child => child.label === 'VBN') && vp.children.some(child => /^VB/u.test(child.label) && beWords.has(auxiliaryKey(firstWord(child)?.label ?? '')))) passive = inner;
        vp = inner;
      }
      if (subject && passive && !lowerHasTrace(passive)) {
        const gap = trace();
        const site = extractionSite(passive);
        // A prepositional passive leaves its gap after the stranded preposition.
        if (site?.label === 'PP') site.children.push(gap);
        else {
          const object = passive.children.findIndex(child => complementLabels.has(child.label) || child.label === 'VP');
          if (object < 0) passive.children.push(gap);
          else passive.children.splice(object, 0, gap);
        }
        pairs.push({ trace: gap, filler: headWord(subject) });
      }
    }
    return copy;
  };
  const result = walk(root, false);
  const indices = new Map<RawNode, number>();
  let next = 0;
  for (const pair of pairs) {
    let index = pair.filler ? indices.get(pair.filler) : undefined;
    if (index === undefined) index = ++next;
    pair.trace.label = `t${subscript(index)}`;
    if (pair.filler) { indices.set(pair.filler, index); pair.filler.label = withIndex(pair.filler.label, index); }
  }
  return result;
}

function normalize(node: RawNode): RawNode {
  const children = node.children.map(normalize);
  if (node.label === 'QUOTE') return { label: 'S', children };
  // Chart-only helpers must not leak into the PTB-labelled drawing.
  if (node.label === 'TMP') return { label: 'NP-TMP', children };
  if (node.label === 'INF') return { label: children[0]?.label === 'IN' ? 'SBAR' : 'S', children };
  if (node.label === 'S' && children[0]?.label === 'SBAR' && children[1]?.label === 'VP'
    && ['that', 'whether'].includes(leftmostWord(children[0]))) {
    // An adjacent verb inside the subject clause can bias the tagger toward VBN.
    const predicate = children[1].children[0];
    if (predicate?.label === 'VBN' && /ed$/u.test(leftmostWord(predicate))) predicate.label = 'VBD';
  }
  // The appositive chain uses helper labels while charting; the drawing shows plain NPs.
  if (node.label === 'NPA' || node.label === 'NPB') return { label: 'NP', children };
  if (node.label === 'NP') {
    const flat = children.flatMap(child => child.label === 'NOM' ? child.children : [child]);
    // A determiner over an already determined nominal stays one flat phrase, as in PTB II:
    // "such a lovely day" and "both the boys" have no nominal inside a nominal.
    const stacked = flat.length === 2 && ['DT', 'PDT', 'PRP$', 'CD'].includes(flat[0].label) && flat[1].label === 'NP'
      && ['DT', 'PDT', 'PRP$', 'CD'].includes(flat[1].children[0]?.label ?? '');
    return { label: 'NP', children: stacked ? [flat[0], ...flat[1].children] : flat };
  }
  if (node.label === 'SBARQ') {
    const wh = children.find(child => child.label === 'WHNP');
    const inverted = children.find(child => child.label === 'SQ');
    const passive = inverted?.children.find(child => child.label === 'NP' && child.children.length === 1 && child.children[0].label === 'NN' && irregularParticiples.has(firstWord(child)?.label.toLocaleLowerCase('en') ?? ''));
    if (wh && passive && inverted!.children.filter(child => child.label === 'NP').length === 1 && inverted!.children.some(child => /^VB/u.test(child.label) && beWords.has(auxiliaryKey(firstWord(child)?.label ?? ''))) && inverted!.children.some(child => child.label === 'PP' && firstWord(child)?.label.toLocaleLowerCase('en') === 'by')) {
      passive.label = 'VP';
      passive.children[0].label = 'VBN';
      const position = inverted!.children.indexOf(passive);
      passive.children.push(...inverted!.children.slice(position + 1));
      inverted!.label = 'S';
      inverted!.children = [{ label: 'VP', children: inverted!.children.slice(0, position + 1) }];
    }
    const clause = children.find(child => child.label === 'S');
    const nominal = clause?.children.find(child => child.label === 'NP');
    if (wh?.children.length === 1 && wh.children[0].label === 'WDT' && firstWord(wh)?.label.toLocaleLowerCase('en') === 'which' && nominal && ['NN', 'NNS'].includes(nominal.children[0]?.label ?? '')) {
      wh.children.push(nominal);
      clause!.children = clause!.children.filter(child => child !== nominal);
    }
  }
  if (node.label === 'VP' || node.label === 'SQ') {
    const perfect = children.some(child => /^VB/u.test(child.label) && haveWords.has(auxiliaryKey(firstWord(child)?.label ?? '')));
    const be = children.some(child => /^VB/u.test(child.label) && beWords.has(auxiliaryKey(firstWord(child)?.label ?? '')));
    for (const child of children) {
      if (child.label === 'ADJP' && child.children[0]?.label === 'VBN' && (perfect || be)) child.label = 'VP';
      if (be && child.label === 'VP') {
        const predicate = child.children.find(part => part.label === 'VBN');
        const word = firstWord(predicate)?.label.toLocaleLowerCase('en') ?? '';
        // An agent modifies the passive predicate, not the stranded preposition.
        for (const part of [...child.children]) {
          if (part.label !== 'PP' || !selectsStranded(word, firstWord(part)?.label.toLocaleLowerCase('en') ?? '')) continue;
          const agent = part.children.find(item => item.label === 'PP' && firstWord(item)?.label.toLocaleLowerCase('en') === 'by');
          if (agent) { part.children = part.children.filter(item => item !== agent); child.children.splice(child.children.indexOf(part) + 1, 0, agent); }
        }
      }
      if (node.label === 'SQ' && perfect && child.label === 'VP') {
        let predicate = child;
        while (predicate.children.length && !/^VB/u.test(predicate.label)) predicate = predicate.children[headIndex(predicate)];
        const word = firstWord(predicate)?.label.toLocaleLowerCase('en') ?? '';
        const participial = participle.test(word) || irregularParticiples.has(word) || Object.hasOwn(auxiliaries, word) && auxiliaries[word] === 'VBD' && haveWords.has(word);
        if (predicate.label === 'VBD' && participial) predicate.label = 'VBN';
      }
    }
  }
  if (node.label === 'NOM') return { label: 'NOM', children: children.flatMap(child => child.label === 'NOM' ? child.children : [child]) };
  return { label: node.label, children };
}
