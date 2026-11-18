// Pure tree-to-tree presentations. The layout and the edit operations stay in tree.ts.
import { isTraceLabel, labelIndex, withIndex, subscript, withoutIndex } from './tree-movement';
import { auxiliaryKey } from './tree-auxiliary';
import { calendarDateHead } from './tree-dates';
import { finiteClauseVerbs } from './tree-lexicon';
import { lemmaCandidates } from './wordnet-pos';

export type RawNode = { label: string; children: RawNode[] };
export type TreeForm = 'constituency' | 'dependency' | 'xbar' | 'bare' | 'tag' | 'cst' | 'ast' | 'ccg' | 'feature';

export const isFiniteVerbPhrase = (node: RawNode) =>
  node.label === 'VP' && node.children.some(child => ['VBD', 'VBP', 'VBZ', 'MD'].includes(child.label));

export const selectsFiniteClause = (word: string) =>
  [word, ...lemmaCandidates(word, undefined, 'verb')].some(lemma => finiteClauseVerbs.has(lemma));

// These verbs can take an addressee NP before a finite content clause.
const recipientClauseVerbs = new Set(['advise', 'alert', 'ask', 'assure', 'convince', 'inform', 'notify', 'promise', 'remind', 'show', 'teach', 'tell', 'told', 'taught', 'warn']);
export const takesRecipientClause = (word: string) =>
  [word, ...lemmaCandidates(word, undefined, 'verb')].some(lemma => recipientClauseVerbs.has(lemma));

const isLeaf = (node: RawNode) => node.children.length === 0;
const tags = new Set(['CC', 'CD', 'DT', 'EX', 'IN', 'JJ', 'JJR', 'JJS', 'MD', 'NN', 'NNS', 'NNP', 'NNPS', 'PDT', 'POS',
  'PRP', 'PRP$', 'RB', 'RBR', 'RBS', 'RP', 'TO', 'UH', 'VB', 'VBD', 'VBG', 'VBN', 'VBP', 'VBZ', 'WDT', 'WP', 'WP$', 'WRB']);
const isTag = (label: string) => tags.has(label);
const isPreterminal = (node: RawNode) => node.children.length === 1 && node.children[0].children.length === 0 && isTag(node.label);
const isPunctuation = (label: string) => /^[.,;:!?()"“”‘’]$/.test(label) || ['``', "''", '-LRB-', '-RRB-'].includes(label);
const phrases = new Set(['NP', 'VP', 'PP', 'AP', 'ADJP', 'ADVP', 'S', 'SBAR', 'TP', 'CP', 'PRT', 'WHNP', 'WHADVP', 'WhP', 'ConjP']);

function dateHead(node: RawNode) {
  if (!['NP', 'NP-TMP'].includes(node.label) || !node.children.every(child => child.children.length === 1 && isLeaf(child.children[0]))) return;
  return calendarDateHead(node.children.map(child => child.children[0].label));
}

export function isNominalList(node: RawNode) {
  return node.label === 'NP' && node.children.length >= 3 && node.children.length % 2 === 1
    && node.children.every((child, index) => child.label === (index % 2 ? ',' : 'NP'));
}

function isNominalApposition(node: RawNode) {
  return node.label === 'NP' && node.children.length === 4
    && node.children.every((child, index) => child.label === (index % 2 ? ',' : 'NP'));
}
const isPhrase = (label: string) => phrases.has(label);
const wordOf = (node: RawNode) => isPreterminal(node) ? node.children[0] : node;

// Identify heads by grammatical category and position. Penn Treebank II supplies the label
// meanings; the preferences below describe which English element projects each phrase here.
type Projection = readonly [edge: 'first' | 'last', ...preferred: RegExp[]];
const nominal: Projection = ['last', /^NN(?:P?S?)$|^(?:NX|NOM)$/u, /^(?:NP|PRP\$?|WHNP)$/u, /^(?:JJ[RS]?|ADJP|CD|QP)$/u, /^(?:DT|WDT|POS)$/u];
const clause: Projection = ['first', /^VP$/u, /^(?:S|SQ|SINV)$/u, /^(?:ADJP|NP|FRAG)$/u];
const question: Projection = ['first', /^(?:MD|VB[DGNPZ]?)$/u, /^VP$/u, /^(?:SQ|S|SINV)$/u];
const modifier: Projection = ['last', /^(?:RB[RS]?|WRB|ADVP)$/u, /^(?:JJ[RS]?|ADJP)$/u];
const prepositional: Projection = ['first', /^(?:IN|TO|RP)$/u, /^(?:PP|NP)$/u];
const projections: Record<string, Projection> = {
  NP: nominal, NOM: nominal, NX: nominal,
  S: clause, SINV: question, SQ: question,
  SBAR: ['first', /^(?:S|SQ|SINV|FRAG)$/u],
  SBARQ: ['first', /^(?:S|SQ|SINV)$/u],
  VP: ['first', /^(?:MD|TO|VB[DGNPZ]?)$/u, /^VP$/u, /^(?:JJ|NNP?)$/u],
  PP: prepositional, WHPP: prepositional,
  ADJP: ['last', /^JJ[RS]?$/u, /^(?:ADJP|VB[GN]|NNP?S?)$/u],
  ADVP: modifier, WHADVP: modifier,
  WHNP: ['last', /^NNP?S?$/u, /^(?:WP\$?|WDT|NP)$/u],
  PRT: ['last', /^RP$/u],
  QP: ['last', /^CD$/u, /^(?:QP|NNP?S?|JJ)$/u],
  FRAG: ['first', /^(?:VP|NP|PP|ADJP|ADVP|WHADVP|UH)$/u],
  PRN: ['first', /^(?:S|NP|VP|PP|ADJP|ADVP)$/u],
};

export function headIndex(node: RawNode) {
  if (!node.children.length) return -1;
  const date = dateHead(node);
  if (date !== undefined) return date;
  if (isNominalList(node) || isNominalApposition(node)) return 0;
  const [edge, ...preferred] = Object.hasOwn(projections, node.label) ? projections[node.label] : ['last'] as const;
  for (const category of preferred) {
    const matches = (child: RawNode) => category.test(child.label);
    const index = edge === 'first' ? node.children.findIndex(matches) : node.children.findLastIndex(matches);
    if (index >= 0) return index;
  }
  const content = (child: RawNode) => !isPunctuation(child.label);
  const fallback = edge === 'first' ? node.children.findIndex(content) : node.children.findLastIndex(content);
  return fallback >= 0 ? fallback : edge === 'first' ? 0 : node.children.length - 1;
}

const verbal = new Set(['VB', 'VBD', 'VBG', 'VBN', 'VBP', 'VBZ', 'MD']);
const beForms = new Set(['be', 'am', 'is', 'are', 'was', 'were', 'been', 'being']);
const haveDoForms = new Set(['have', 'has', 'had', 'do', 'does', 'did']);
const verbTargets = new Set(['VP']);
const predicateTargets = new Set(['VP', 'ADJP', 'NP', 'PP', 'ADVP']);
const wordKey = auxiliaryKey;

// An auxiliary, modal or infinitival marker does not head its phrase: the predicate it introduces
// does. Dependency conversion and CCG ordering use this content head; phrase projections keep
// their syntactic head.
export function contentHeadIndex(node: RawNode): number {
  const head = headIndex(node);
  const child = node.children[head];
  if (!child || !isPreterminal(child)) return head;
  const word = wordKey(child.children[0].label);
  const targets = child.label === 'MD' || child.label === 'TO' || haveDoForms.has(word) ? verbTargets
    : beForms.has(word) || word === "'s" ? predicateTargets : undefined;
  if (!targets) return head;
  for (let index = head + 1; index < node.children.length; index++) if (targets.has(node.children[index].label)) return index;
  return head;
}

function lexicalHead(node: RawNode): string {
  if (isPreterminal(node)) return node.children[0].label;
  if (!node.children.length) return node.label;
  return lexicalHead(node.children[headIndex(node)]);
}

const specifiers = new Set(['DT', 'PDT', 'PRP$', 'CD', 'WDT']);

// X-bar trees label terminals with lexical categories, not Penn Treebank part-of-speech tags.
const xbarTerminals: Record<string, string> = {
  DT: 'Det', PDT: 'Det', PRP$: 'Det', POS: 'D',
  JJ: 'A', JJR: 'A', JJS: 'A',
  NN: 'N', NNS: 'N', NNP: 'N', NNPS: 'N', PRP: 'N',
  VB: 'V', VBD: 'V', VBG: 'V', VBN: 'V', VBP: 'V', VBZ: 'V',
  MD: 'T', IN: 'P', TO: 'T', RP: 'Prt', CC: 'Conj', CD: 'Num',
  RB: 'Adv', RBR: 'Adv', RBS: 'Adv', WRB: 'Adv', EX: 'D',
  WDT: 'Wh', WP: 'Wh', WP$: 'Wh', UH: 'Int',
};

// PTB phrase labels that X-bar renames.
const xbarPhrases: Record<string, string> = { ADJP: 'AP', ADVP: 'AdvP', NOM: "N'" };

const xbarTerminal = (label: string) => Object.hasOwn(xbarTerminals, label) ? xbarTerminals[label] : label;

// A coordination projects a conjunction phrase rather than piling the conjuncts under one X.
function coordinationIndex(node: RawNode) {
  if (node.children.length < 3) return -1;
  const index = node.children.findIndex(child => child.label === 'CC');
  return index > 0 && index < node.children.length - 1 ? index : -1;
}

function conjunctionPhrase(node: RawNode, index: number): RawNode {
  const conjunction = node.children[index], second = node.children[index + 1];
  // Material before the first conjunct belongs to that conjunct, so nothing is dropped and the
  // surface order survives: "not sing or dance" keeps its "not".
  const leading = node.children.slice(0, index - 1);
  const first = leading.length
    ? { label: node.label, children: [...leading, node.children[index - 1]] }
    : node.children[index - 1];
  const rest = node.children.slice(index + 2);
  return {
    label: 'ConjP',
    children: [
      asXbar(first),
      { label: "Conj'", children: [{ label: 'Conj', children: [wordOf(conjunction)] }, asXbar(second)] },
      ...rest.map(asXbar),
    ],
  };
}

// NP stays flat for prenominal material and nests postmodifiers, matching PTB II bracketings.
function baseNP(node: RawNode): RawNode {
  const children = node.children.map(child => isTraceLabel(child.label) && ['VP', 'PP'].includes(node.label) ? { label: 'NP', children: [child] } : asXbar(child));
  const head = headIndex(node);
  if (head < 0) return { label: 'NP', children };
  // A genitive clitic projects a determiner phrase over the possessor: DP -> NP D'.
  const marker = node.children.findIndex(child => child.label === 'POS');
  if (marker > 0) {
    return {
      label: 'DP',
      children: [
        baseNP({ label: 'NP', children: node.children.slice(0, marker) }),
        { label: "D'", children: [children[marker]] },
      ],
    };
  }
  const headLabel = node.children[head].label;
  if (headLabel === 'NP' || headLabel === 'S' || headLabel === 'SBAR') return { label: 'NP', children };
  // Pre-head material keeps its surface order: "the first three tall students" must not become
  // "the three first". Only a determiner in the leftmost slot is a specifier; every other pre-head
  // word adjoins to N' in the order it appears. A determiner that is not leftmost ("quite a day")
  // stays inside N' so the word order survives.
  const leftmost = node.children[0];
  const hasLeftmostSpecifier = head > 0 && (specifiers.has(leftmost.label) || leftmost.label === 'NP');
  const premodifierIndexes = node.children.map((_, index) => index < head ? index : -1)
    .filter(index => index >= 0 && !(hasLeftmostSpecifier && index === 0));
  const postmodifiers = children.slice(head + 1);
  let bar = children[head];
  for (const post of postmodifiers) bar = { label: "N'", children: [bar, post] };
  for (const pre of premodifierIndexes.reverse().map(index => children[index])) bar = { label: "N'", children: [pre, bar] };
  if (bar.label !== "N'") bar = { label: "N'", children: [bar] };
  return { label: 'NP', children: [...(hasLeftmostSpecifier ? [children[0]] : []), bar] };
}

// XP -> (specifier) X'; X' -> head (complements), with adjuncts adjoined at phrase level.
function phraseToBar(node: RawNode, category: string, phrase: string, complements: Set<string>): RawNode {
  // A single child of the same kind adds no projection, so reuse it.
  if (node.children.length === 1 && (node.children[0].label === phrase || node.children[0].label === node.label)) return asXbar(node.children[0]);
  const head = headIndex(node);
  const children = node.children.map(child => isTraceLabel(child.label) && ['VP', 'PP'].includes(node.label) ? { label: 'NP', children: [child] } : asXbar(child));
  if (head < 0) return { label: phrase, children };
  if (category === 'P' && isPreterminal(node.children[head])) children[head] = { label: 'P', children: node.children[head].children };
  const headChild = node.children[head];
  // A phrase that recurses on its own category is an adjunction, so it keeps both phrase layers.
  if (headChild.label === phrase || headChild.label === node.label) {
    if (node.label === 'ADJP' && isPhrase(headChild.label)) {
      // ADJP -> (RB very) (ADJP (JJ happy)): a degree word is the specifier of the adjective phrase.
      return { label: 'AP', children: [...children.slice(0, head), ...children[head].children, ...children.slice(head + 1)] };
    }
    return { label: phrase, children };
  }
  const after = children.slice(head + 1).filter(child => complements.has(child.label) || !isTag(child.label) || child.label === 'RP');
  const before = children.slice(0, head);
  let bar = children[head];
  for (const child of after) bar = { label: `${category}'`, children: [bar, child] };
  if (bar.label !== `${category}'`) bar = { label: `${category}'`, children: [bar] };
  // A pre-head adverb is not a specifier of V: it adjoins to the verb phrase.
  if (category === 'V' && before.length) return { label: phrase, children: [...before, { label: phrase, children: [bar] }] };
  return { label: phrase, children: [...before, bar] };
}

function removeVerb(node: RawNode): { verb?: RawNode; rest?: RawNode } {
  for (let index = 0; index < node.children.length; index++) {
    const child = node.children[index];
    if (verbal.has(child.label)) return { verb: child, rest: without(node, index) };
    if (['VP', 'MD', 'TO', ''].includes(child.label)) {
      const inner = removeVerb(child);
      if (!inner.verb) continue;
      const children = [...node.children];
      if (inner.rest) children[index] = inner.rest;
      else children.splice(index, 1);
      const rest = children.length ? { label: node.label, children } : undefined;
      const collapsed = rest && rest.children.length === 1 && rest.children[0].label === node.label ? rest.children[0] : rest;
      return { verb: inner.verb, rest: collapsed };
    }
  }
  return {};
}

function without(node: RawNode, index: number): RawNode | undefined {
  const children = node.children.filter((_, position) => position !== index);
  return children.length ? { label: node.label, children } : undefined;
}

const auxiliaryWord = /^(be|am|is|are|was|were|been|being|have|has|had|do|does|did|will|would|can|could|may|might|shall|should|must)$/i;

function leftmostVerb(node: RawNode): RawNode | undefined {
  for (const child of node.children) {
    if (verbal.has(child.label)) return child;
    if (['VP', 'TO'].includes(child.label)) {
      const found = leftmostVerb(child);
      if (found) return found;
    }
  }
  return undefined;
}

// T carries the finite auxiliary when one is present, otherwise the tense feature.
function tenseOf(verb: RawNode | undefined) {
  if (!verb) return 'T';
  if (verb.label === 'VBD') return 'past';
  if (verb.label === 'VBZ' || verb.label === 'VBP') return 'pres';
  if (verb.label === 'MD') return 'modal';
  return 'inf';
}

const raisesToT = (verb: RawNode, phrase: RawNode) => verb.label === 'MD'
  || (isPreterminal(verb) && (auxiliaryWord.test(wordKey(verb.children[0].label)) || ["'s", "'d"].includes(wordKey(verb.children[0].label))) && phrase.children.some(child => child.label === 'VP'))
  || (isPreterminal(verb) && (beForms.has(wordKey(verb.children[0].label)) || verb.children[0].label === "'s") && phrase.children.some(child => predicateTargets.has(child.label)));

// A declarative clause becomes TP; an auxiliary raises to T, as in X-bar analyses.
function clauseToTp(node: RawNode, keepAuxiliary = false): RawNode {
  const vpIndex = node.children.findIndex(child => child.label === 'VP');
  if (vpIndex < 0) {
    const mapped = node.children.map(child => isTraceLabel(child.label) ? { label: 'NP', children: [child] } : asXbar(child));
    // A one-child clause that is already a tense phrase stays that phrase; TP over TP is a
    // projection with nothing to project.
    if (mapped.length === 1 && ['TP', 'CP'].includes(mapped[0].label)) return mapped[0];
    return { label: 'TP', children: mapped };
  }
  // A clause that is only a verb phrase adds no projection: an infinitival verb phrase already
  // carries its own tense layer, so "what to do" keeps "to do" in that order.
  if (node.children.length === 1) return asXbar(node.children[0]);
  const mapped = node.children.map(child => isTraceLabel(child.label) ? { label: 'NP', children: [child] } : asXbar(child));
  const vp = node.children[vpIndex];
  // An infinitival body already projects its own tense layer: "him to be honest" must not raise
  // the inner "be", which would reorder the phrase as "him be to honest".
  if (vp.children[0]?.label === 'TO') {
    const subjectAt = node.children.slice(0, vpIndex).findIndex(child => child.label === 'NP');
    const offset = subjectAt >= 0 ? subjectAt : -1;
    const lead = mapped.filter((_, index) => index < vpIndex && (offset < 0 || index < offset));
    const trailing = mapped.filter((_, index) => index > vpIndex);
    return { label: 'TP', children: [...lead, ...(offset >= 0 ? [mapped[offset]] : []), asXbar(vp), ...trailing] };
  }
  const verb = leftmostVerb(vp);
  let rest: RawNode | undefined = vp;
  let tChildren: RawNode[];
  // Adverbs that stand before the finite auxiliary belong outside the tense layer: they modify
  // the clause, so "she certainly does not agree" must not become "she does certainly not agree".
  const hoisted: RawNode[] = [];
  if (!keepAuxiliary && verb && raisesToT(verb, vp)) {
    const lower = (current: RawNode): RawNode => current === verb ? { label: 'VB', children: [{ label: '\0head', children: [] }] } : { label: current.label, children: current.children.map(lower) };
    rest = verb.label === 'MD' || ['do', 'does', 'did'].includes(wordKey(firstWord(verb))) ? removeVerb(vp).rest : lower(vp);
    tChildren = [wordOf(verb)];
    // Peel exactly the sentence adverbs that stood before the raised auxiliary, so a "not" that
    // followed it stays inside the tense layer: "she certainly does not agree".
    const leading = vp.children.findIndex(child => verbal.has(child.label) || child.label === 'MD');
    let hoistCount = 0;
    if (leading > 0) while (hoistCount < leading && ['ADVP', 'PP'].includes(vp.children[hoistCount].label)) hoistCount++;
    for (let index = 0; index < hoistCount; index++) {
      if (!rest || rest.label !== 'VP' || !rest.children.length) break;
      if (!['ADVP', 'PP'].includes(rest.children[0].label)) break;
      hoisted.push(asXbar(rest.children[0]));
      rest = rest.children.length > 1 ? { label: 'VP', children: rest.children.slice(1) } : undefined;
    }
  } else tChildren = [{ label: tenseOf(verb), children: [] }];
  const subjectIndex = node.children.slice(0, vpIndex).findIndex(child => child.label === 'NP');
  const subjectOffset = subjectIndex >= 0 ? subjectIndex : -1;
  // Material between the subject and the verb phrase is not a fronted constituent; it sits inside
  // the tense layer, so "should she not leave" orders as she + not + leave.
  const between = subjectOffset >= 0 ? mapped.filter((_, index) => index > subjectOffset && index < vpIndex) : [];
  const before = mapped.filter((_, index) => index < vpIndex && (subjectOffset < 0 ? true : index < subjectOffset));
  const after = mapped.filter((_, index) => index > vpIndex);
  const tBar: RawNode = { label: "T'", children: [{ label: 'T', children: tChildren }, ...between, ...(rest ? [asXbar(rest)] : [])] };
  return { label: 'TP', children: [...before, ...(subjectOffset >= 0 ? [mapped[subjectOffset]] : []), ...hoisted, tBar, ...after] };
}

// A subordinate clause becomes CP; its body keeps the same TP analysis as a root clause.
function clauseToCp(node: RawNode): RawNode {
  const complementizer = node.children.find(child => child.label === 'IN');
  const wh = node.children.find(child => ['WHNP', 'WHADVP', 'WHPP', 'WDT', 'WP', 'WP$'].includes(child.label));
  // Everything that is neither the complementizer nor the wh-phrase, in surface order.
  const rest = node.children.filter(child => child !== complementizer && child !== wh);
  // The body is the clause itself when the phrase has one; otherwise it is a small clause made of
  // what is left, so a subject plus a predicate is never dropped ("him to leave", "much as ...").
  const clauseIndex = rest.findIndex(child => ['S', 'SBAR', 'SQ', 'SBARQ'].includes(child.label));
  const body: RawNode = clauseIndex >= 0 ? rest[clauseIndex] : { label: 'S', children: rest };
  const leading = clauseIndex >= 0 ? rest.slice(0, clauseIndex) : [];
  const trailing = clauseIndex >= 0 ? rest.slice(clauseIndex + 1) : [];
  const cHead: RawNode[] = complementizer ? [wordOf(complementizer)] : [{ label: '∅', children: [] }];
  const cBar: RawNode = {
    label: "C'",
    children: [{ label: 'C', children: cHead }, asXbar(body), ...trailing.map(asXbar)],
  };
  return { label: 'CP', children: [...leading.map(asXbar), ...(wh ? [asXbar(wh)] : []), cBar] };
}

// A question becomes CP: the fronted auxiliary sits in C, and the rest is the same TP analysis.
function questionToCp(node: RawNode): RawNode {
  const wh = node.children.find(child => ['WHNP', 'WHADVP', 'WHPP', 'WDT'].includes(child.label) || child.label === 'PP' && child.children.some(item => item.label === 'WHNP'));
  // The rest of the question is one clause; a fronted auxiliary raises out of its left edge.
  const remainder = node.children.filter(child => child !== wh);
  let body: RawNode = remainder.length === 1 && ['S', 'SQ', 'SBARQ'].includes(remainder[0].label)
    ? remainder[0]
    : { label: 'S', children: remainder };
  while (body.label === 'S' && body.children.length === 1 && ['S', 'SQ'].includes(body.children[0].label)) body = body.children[0];
  const aux = body.children.find(child => ['MD', 'VBD', 'VBZ', 'VBP', 'VB'].includes(child.label));
  let clause = clauseToTp({ label: 'S', children: body.children.filter(child => child !== aux) }, aux !== undefined);
  const subjectAt = body.children.findIndex(child => child.label === 'NP');
  const tail = body.children.slice(subjectAt + 1).filter(child => child !== aux);
  if (aux && subjectAt >= 0 && tail.some(child => predicateTargets.has(child.label)) && (beForms.has(wordKey(firstWord(aux))) || haveDoForms.has(wordKey(firstWord(aux))) && body.children.some(child => child.label === 'VP') && !['do', 'does', 'did'].includes(wordKey(firstWord(aux))))) {
    clause = clauseToTp({ label: 'S', children: [
      ...body.children.slice(0, subjectAt).filter(child => child !== aux), body.children[subjectAt],
      { label: 'VP', children: [aux, ...tail.filter(child => !isPunctuation(child.label))] },
      ...tail.filter(child => isPunctuation(child.label)),
    ] });
  }
  // A fronted auxiliary leaves a T position; V-origin auxiliaries also keep their lower head.
  if (aux) {
    const t = clause.children.find(child => child.label === "T'")?.children[0];
    if (t && t.label === 'T') t.children = [{ label: '\0head', children: [] }];
  }
  const cBar: RawNode = { label: "C'", children: [{ label: 'C', children: aux ? [wordOf(aux)] : [{ label: '∅', children: [] }] }, clause] };
  return { label: 'CP', children: [...(wh ? [asXbar(wh)] : []), cBar] };
}

function asXbar(node: RawNode): RawNode {
  if (isPreterminal(node)) return { label: xbarTerminal(node.label), children: node.children };
  if (isLeaf(node)) return node;
  if (node.children.length === 1 && isTraceLabel(node.children[0].label)) return { label: Object.hasOwn(xbarPhrases, node.label) ? xbarPhrases[node.label] : node.label, children: node.children };
  if (node.label === 'NP' && node.children.length === 1 && node.children[0].label === 'EX') return asXbar(node.children[0]);
  const coordination = coordinationIndex(node);
  if (coordination >= 0) return conjunctionPhrase(node, coordination);
  switch (node.label) {
    // A statement that wraps a question keeps the question's CP analysis.
    case 'S':
      if (node.children.length === 1 && ['SQ', 'SBARQ'].includes(node.children[0].label)) return asXbar(node.children[0]);
      return clauseToTp(node);
    case 'SQ': case 'SBARQ': return questionToCp(node);
    case 'SBAR': return clauseToCp(node);
    case 'NP': case 'NP-TMP': return baseNP(node);
    case 'VP': {
      // The infinitival marker heads a tense phrase, not a preposition phrase inside V'.
      if (node.children[0]?.label === 'TO' && node.children[1]?.label === 'VP') {
        const rest = node.children.slice(1);
        const body = rest.length === 1 ? rest[0] : { label: 'VP', children: rest };
        return { label: "T'", children: [{ label: 'T', children: [wordOf(node.children[0])] }, asXbar(body)] };
      }
      return phraseToBar(node, 'V', 'VP', new Set(['NP', 'PP', 'SBAR', 'S', 'ADJP', 'PRT', 'VP']));
    }
    case 'PP': return phraseToBar(node, 'P', 'PP', new Set(['NP', 'PP', 'S', 'WHNP', 'WHPP', 'SBAR']));
    case 'ADJP': {
      // A participle under an adjective phrase is an adjectival passive, so it is an A, not a V.
      const adjective = node.children.length === 1 && (node.children[0].label === 'VBN' || node.children[0].label === 'VBG');
      return phraseToBar(adjective ? { label: 'ADJP', children: node.children.map(child => ({ label: 'JJ', children: child.children })) } : node, 'A', 'AP', new Set(['PP', 'SBAR', 'S']));
    }
    case 'ADVP': return phraseToBar(node, 'Adv', 'AdvP', new Set(['PP', 'S']));
    case 'WHNP': return phraseToBar(node, 'Wh', 'WhP', new Set(['NP', 'PP']));
    // A pied-piped wh-phrase keeps its preposition as head: PP -> P' -> P + wh-phrase.
    case 'WHPP': {
      const preposition = node.children.find(child => child.label === 'IN' || child.label === 'TO');
      const rest = node.children.filter(child => child !== preposition);
      return { label: 'PP', children: [{ label: "P'", children: [...(preposition ? [{ label: 'P', children: [wordOf(preposition)] }] : []), ...rest.map(asXbar)] }] };
    }
    default: return { label: Object.hasOwn(xbarPhrases, node.label) ? xbarPhrases[node.label] : node.label, children: node.children.map(asXbar) };
  }
}

// Resolve only the head positions introduced by this conversion, keeping existing chains intact.
function xbarMovement(input: RawNode): RawNode {
  const root = structuredClone(input);
  let index = 0;
  const scan = (node: RawNode) => { index = Math.max(index, labelIndex(node.label) ?? 0); node.children.forEach(scan); };
  scan(root);
  const pair = (head: RawNode | undefined, gap: RawNode | undefined) => {
    if (!head || !gap || gap.label !== '\0head') return;
    const coindex = labelIndex(head.label) ?? ++index;
    if (coindex > 99) throw new Error('TREE_PARSE');
    head.label = withIndex(head.label, coindex);
    gap.label = `t${subscript(coindex)}`;
  };
  const findGap = (node: RawNode): RawNode | undefined => {
    if (['TP', 'CP'].includes(node.label)) return;
    if (node.label === '\0head') return node;
    for (const child of node.children) { const found = findGap(child); if (found) return found; }
  };
  const walk = (node: RawNode) => {
    node.children.forEach(walk);
    if (node.label === 'TP') {
      const bar = node.children.find(child => child.label === "T'");
      const head = bar?.children.find(child => child.label === 'T')?.children[0];
      const vp = bar?.children.find(child => child.label === 'VP');
      if (head && head.label !== '\0head' && vp) pair(head, findGap(vp));
    }
    if (node.label === 'CP') {
      const bar = node.children.find(child => child.label === "C'");
      const head = bar?.children.find(child => child.label === 'C')?.children[0];
      const tp = bar?.children.find(child => child.label === 'TP');
      const gap = tp?.children.find(child => child.label === "T'")?.children.find(child => child.label === 'T')?.children[0];
      pair(head, gap);
      const vp = tp?.children.find(child => child.label === "T'")?.children.find(child => child.label === 'VP');
      if (head && vp) pair(head, findGap(vp));
    }
  };
  walk(root);
  return root;
}

// Bare Merge keeps the same functional heads as X-bar, without bar-level labels or unary shells.
const bareHeads: Record<string, string[]> = {
  TP: ["T'", 'T'], "T'": ['T'], CP: ["C'", 'C'], "C'": ['C'],
  VP: ["V'", 'V', 'VP'], "V'": ['V', "V'"], NP: ["N'", 'N', 'NP'], "N'": ['N', "N'"],
  PP: ["P'", 'P'], "P'": ['P', "P'"], AP: ["A'", 'A'], "A'": ['A', "A'"],
  AdvP: ["Adv'", 'Adv'], "Adv'": ['Adv', "Adv'"], WhP: ["Wh'", 'Wh'], "Wh'": ['Wh', "Wh'"],
  ConjP: ["Conj'", 'Conj'], "Conj'": ['Conj'], DP: ["D'", 'D'], "D'": ['D'],
};
function asBare(node: RawNode): RawNode {
  if (isLeaf(node)) return node;
  if (node.label === 'T' && node.children.length === 1 && ['past', 'pres', 'inf', 'modal'].includes(node.children[0].label)) return { label: `T[${node.children[0].label}]`, children: [] };
  if (node.label === 'C' && node.children.length === 1 && node.children[0].label === '∅') return { label: 'C[∅]', children: [] };
  const preferred = Object.hasOwn(bareHeads, node.label) ? bareHeads[node.label] : [];
  const head = preferred.map(label => node.children.findIndex(child => child.label === label)).find(index => index >= 0) ?? headIndex(node);
  const parts = node.children.map(asBare);
  let projection = parts[head];
  // Projection labels carry the head's identity, not another occurrence of its movement index.
  for (const part of parts.slice(head + 1)) projection = { label: withoutIndex(projection.label), children: [projection, part] };
  for (const part of parts.slice(0, head).reverse()) projection = { label: withoutIndex(projection.label), children: [part, projection] };
  return projection;
}

// A derived phrase tree does not identify TAG elementary trees or their foot nodes.
// Without an elementary grammar, inferring α/β from repeated phrase labels is unsound.

// Abstract syntax keeps the words but drops the concrete layer: punctuation and the part-of-speech
// nodes disappear, so each leaf is the word itself. Unary category chains then collapse.
const concreteNoise = new Set(['.', ',', ':', ';', '!', '?', '``', "''", '-LRB-', '-RRB-']);
function asAst(node: RawNode): RawNode {
  if (isPreterminal(node)) return node.children[0];
  if (isLeaf(node)) return node;
  const mapped = node.children.map(asAst);
  const kept = node.children.flatMap((child, index) => concreteNoise.has(child.label) ? [] : [mapped[index]]);
  let current: RawNode = { label: node.label, children: kept.length ? kept : mapped };
  while (current.children.length === 1 && current.children[0].children.length && phrases.has(current.label) && phrases.has(current.children[0].label)) current = current.children[0];
  return current;
}

// A combinatory categorial derivation needs honest types: a parent shows only the category that
// forward (X/Y + Y) or backward (Y + X\Y) application produces, and children combine only when
// their types fit. Categories are parsed so parentheses and nesting are printed correctly.
type Category = { kind: 'atom'; name: string } | { kind: 'apply'; result: Category; argument: Category; direction: '/' | '\\' };

const atom = (name: string): Category => ({ kind: 'atom', name });
// Only the coordinator's category uses variables; every other atom must match itself.
const typeVariables = new Set(['X', 'Y']);

function parseCategory(text: string): Category | undefined {
  let index = 0;
  function skip() { while (/\s/u.test(text[index] ?? '')) index++; }
  function part(): Category | undefined {
    skip();
    if (text[index] === '(') {
      index++;
      const inner = expression();
      skip();
      if (!inner || text[index] !== ')') return undefined;
      index++;
      return inner;
    }
    const match = /^[A-Za-z0-9$_.]+/u.exec(text.slice(index));
    if (!match) return undefined;
    index += match[0].length;
    return atom(match[0]);
  }
  function expression(): Category | undefined {
    let left = part();
    if (!left) return undefined;
    skip();
    while (text[index] === '/' || text[index] === '\\') {
      const direction = text[index++] as '/' | '\\';
      const right = part();
      if (!right) return undefined;
      left = { kind: 'apply', result: left, argument: right, direction };
      skip();
    }
    return left;
  }
  const parsed = expression();
  skip();
  return parsed && index === text.length ? parsed : undefined;
}

function printCategory(category: Category): string {
  if (category.kind === 'atom') return category.name;
  const left = category.result.kind === 'apply' ? `(${printCategory(category.result)})` : printCategory(category.result);
  const right = category.argument.kind === 'apply' ? `(${printCategory(category.argument)})` : printCategory(category.argument);
  return `${left}${category.direction}${right}`;
}

function substitute(category: Category, name: string, value: Category): Category {
  if (category.kind === 'atom') return category.name === name ? value : category;
  return { kind: 'apply', result: substitute(category.result, name, value), argument: substitute(category.argument, name, value), direction: category.direction };
}

function substituteAll(category: Category, bindings: Map<string, Category>): Category {
  let current = category;
  for (const [name, value] of bindings) current = substitute(current, name, value);
  return current;
}

// A concrete atom matches itself; X and Y are variables, as in the coordinator's (X\X)/X.
function unify(pattern: Category, value: Category, bindings: Map<string, Category>): boolean {
  if (pattern.kind === 'atom') {
    if (!typeVariables.has(pattern.name)) return value.kind === 'atom' && value.name === pattern.name;
    const bound = bindings.get(pattern.name);
    if (bound) return printCategory(bound) === printCategory(value);
    bindings.set(pattern.name, value);
    return true;
  }
  if (value.kind !== 'apply' || value.direction !== pattern.direction) return false;
  return unify(pattern.result, value.result, bindings) && unify(pattern.argument, value.argument, bindings);
}

function applyCategory(left: Category, right: Category): Category | undefined {
  if (left.kind === 'apply' && left.direction === '/') {
    const bindings = new Map<string, Category>();
    if (unify(left.argument, right, bindings)) return substituteAll(left.result, bindings);
  }
  if (right.kind === 'apply' && right.direction === '\\') {
    const bindings = new Map<string, Category>();
    if (unify(right.argument, left, bindings)) return substituteAll(right.result, bindings);
  }
  return undefined;
}

// Harmonic forward composition preserves an unsatisfied argument: X/Y + Y/Z -> X/Z.
function composeCategory(left: Category, right: Category): Category | undefined {
  if (left.kind !== 'apply' || left.direction !== '/' || right.kind !== 'apply' || right.direction !== '/') return;
  const bindings = new Map<string, Category>();
  if (!unify(left.argument, right.result, bindings)) return;
  return { kind: 'apply', result: substituteAll(left.result, bindings), argument: substituteAll(right.argument, bindings), direction: '/' };
}

const category = (text: string) => parseCategory(text) ?? atom(text);

const determiners = new Set(['DT', 'PDT', 'PRP$', 'CD']);
const prenominal = new Set(['JJ', 'JJR', 'JJS', 'NN', 'NNS', 'NNP', 'NNPS', 'VBG', 'VBN']);

// A lexical category depends on the tag and on the slot it occupies: a determiner turns the
// following noun into NP, a pre-verbal adverb is a forward verb-phrase modifier, and an
// adposition inherits the use of its phrase (PP-object or modifier).
function tagCategory(tag: string, parent: RawNode, before: boolean, use: string | undefined, index?: number): Category {
  if (isPunctuation(tag)) return category(['``', '-LRB-', '(', '“'].includes(tag) || before ? 'X/X' : 'X\\X');
  // A noun is nominal (N) once prenominal material precedes it; otherwise it is a whole NP.
  const hasPremodifier = parent.children.some((child, position) => position < (index ?? 0) && (determiners.has(child.label) || prenominal.has(child.label) || child.label === 'NP'));
  switch (tag) {
    case 'DT': case 'PDT': case 'PRP$': case 'CD': return category('NP/N');
    case 'POS': return category('(NP/N)\\NP');
    case 'JJ': case 'JJR': case 'JJS': return category(parent.label === 'ADJP' && use !== 'NP' ? 'S\\NP' : 'N/N');
    case 'NN': case 'NNS': case 'NNP': case 'NNPS': return category(hasPremodifier || parent.label === 'NOM' ? 'N' : 'NP');
    case 'PRP': case 'EX': return category('NP');
    case 'CC': return category('(X\\X)/X');
    case 'WP': case 'WDT':
      // A wh-phrase inside a pied-piped PP is a plain NP ("with whom", "to what extent").
      if (parent.label === 'WHNP' && use === 'WHPP') return category(parent.children.length > 1 && tag === 'WDT' ? 'NP/N' : 'NP');
      // A pied-piped wh-phrase is the object of its preposition, so it is a plain NP there too.
      // A pied-piped wh-phrase is the object of its preposition. A PP modifying a noun is
      // (NP\NP)/NP, so the wh-object is still a plain NP inside it.
      if (parent.label === 'PP') return category('NP');
      // Standing alone it is the relative pronoun, a nominal modifier: (NP\NP)/(S\NP).
      return category('(NP\\NP)/(S\\NP)');
    case 'WRB': return category('(S\\NP)\\(S\\NP)');
    case 'MD': return category('(S\\NP)/(S\\NP)');
    case 'TO': return category(parent.label === 'WHPP' ? '((S\\NP)\\(S\\NP))/NP' : '(S\\NP)/(S\\NP)');
    case 'RB': case 'RBR': case 'RBS':
      if (parent.label === 'ADJP') return category(use === 'NP' ? '(N/N)/(N/N)' : '(S\\NP)/(S\\NP)');
      return category(before ? '(S\\NP)/(S\\NP)' : '(S\\NP)\\(S\\NP)');
    case 'RP': return category('(S\\NP)\\(S\\NP)');
    case 'IN':
      // A pied-piped preposition takes the wh-phrase to form a verb-phrase modifier.
      // Pied-piped into a question or adjunct the preposition modifies a predicate; pied-piped
      // into a relative it modifies the noun.
      if (parent.label === 'WHPP') return category(use === 'NP' ? '(NP\\NP)/NP' : '((S\\NP)\\(S\\NP))/NP');
      if (parent.label === 'SBAR') return category('S/S');
      if (parent.label === 'PP' && use !== undefined && ['NP', 'WHNP'].includes(use)) return category('(NP\\NP)/NP');
      if (use === 'NP') return category('(NP\\NP)/NP');
      if (use === 'VP') return category('((S\\NP)\\(S\\NP))/NP');
      return category('PP/NP');
    case 'VB': case 'VBD': case 'VBG': case 'VBN': case 'VBP': case 'VBZ':
      return index === undefined ? category('S\\NP') : verbCategory(parent, index);
    default: return parseCategory(tag) ?? atom(tag);
  }
}

const leafCategory = (parent: RawNode, index: number, head: number, use: string | undefined) =>
  tagCategory(parent.children[index].label, parent, index < head, use, index);

// A verb takes the first complement it is followed by; an auxiliary or modal takes the predicate.
function verbCategory(parent: RawNode, index: number, result = category('S\\NP'), subjectClause?: RawNode, passivePreposition?: RawNode): Category {
  for (const child of parent.children.slice(index + 1).reverse()) {
    const argument = child === subjectClause ? category('S\\NP') : child === passivePreposition ? category('PP/NP') : child.label === 'PP' && child.children.some(part => isTraceLabel(part.label)) ? category('PP') : child.label === 'NP' || isTraceLabel(child.label) ? category('NP')
      : ['ADJP', 'VP'].includes(child.label) ? category('S\\NP')
      : ['S', 'SBAR'].includes(child.label) ? category('S') : undefined;
    if (argument) result = { kind: 'apply', result, argument, direction: '/' };
  }
  return result;
}

function phraseCategory(node: RawNode, use: string | undefined, before: boolean): Category {
  switch (node.label) {
    case 'NP': case 'NOM': case 'PRP': return category('NP');
    // A question is still a clause in CCG.
    case 'S': case 'SQ': case 'SBARQ': return category('S');
    case 'WHPP': return category('(S\\NP)\\(S\\NP)');
    case 'VP': return category('S\\NP');
    case 'PP': return category(use === 'NP' ? 'NP\\NP' : use === 'VP' ? '(S\\NP)\\(S\\NP)' : 'PP');
    case 'ADJP': return category(use === 'NP' ? 'N/N' : 'S\\NP');
    case 'ADVP': return category(before ? '(S\\NP)/(S\\NP)' : '(S\\NP)\\(S\\NP)');
    case 'SBAR': return category(node.children.some(child => ['WHNP', 'WHADVP', 'WDT'].includes(child.label)) || use === 'NP' ? 'NP\\NP' : 'S');
    case 'WHNP': return category('(NP\\NP)/(S\\NP)');
    default: return atom(node.label);
  }
}

type Derived = { node: RawNode; category?: Category };
const isCcgTerminal = (node: RawNode) => isPreterminal(node) || node.children.length === 1 && isLeaf(node.children[0]) && (/[/\\]/u.test(node.label) || node.label === 'Deg' || isPunctuation(node.label));

// An unresolved application retains its children, never a fabricated parent category.
function deriveCcg(node: RawNode, use?: string, before = false): Derived {
  if (isCcgTerminal(node)) {
    const lexical = tagCategory(node.label, node, true, use);
    return { node: { label: clamp(`${node.children[0].label}|${printCategory(lexical)}`), children: [] }, category: lexical };
  }
  if (isLeaf(node)) {
    const parsed = parseCategory(node.label) ?? atom(node.label);
    return { node, category: parsed };
  }
  const head = contentHeadIndex(node);
  // A projection keeps the use its parent chose; other phrases start their own.
  // A relative clause keeps its nominal use so a pied-piped phrase inside it stays nominal.
  const inherited = node.label === 'SBAR' && use === 'NP'
    ? 'NP'
    : ['PP', 'ADJP', 'WHPP', 'WHNP'].includes(node.label) ? use : node.label;
  const items: Derived[] = node.children.map((child, index) => {
    // A wh-phrase inside a pied-piped preposition is an object, not a clause modifier.
    const childUse = (node.label === 'WHPP' || node.label === 'PP') && child.label === 'WHNP' ? 'WHPP' : inherited;
    if (!isCcgTerminal(child)) return deriveCcg(child, childUse, index < head);
    const lexical = leafCategory(node, index, head, inherited);
    return { node: { label: clamp(`${child.children[0].label}|${printCategory(lexical)}`), children: [] }, category: lexical };
  });
  if (items.length === 1) {
    // An adverb phrase is syncretic with its adverb, so the adverb inherits the phrase's position.
    if (node.label === 'ADVP' && isPreterminal(node.children[0])) {
      const lexical = phraseCategory(node, use, before);
      return { node: { label: clamp(`${node.children[0].children[0].label}|${printCategory(lexical)}`), children: [] }, category: lexical };
    }
    return items[0];
  }
  const working = [...items];
  while (working.length > 1) {
    let merged = false;
    for (const composition of [false, true]) {
      for (let index = 0; index + 1 < working.length; index++) {
        const left = working[index].category, right = working[index + 1].category;
        let result = left && right ? composition ? composeCategory(left, right) : applyCategory(left, right) : undefined;
        let leftNode = working[index].node;
        if (composition && !result && left?.kind === 'atom' && left.name === 'NP' && right) {
          const raised = category('S/(S\\NP)');
          result = composeCategory(raised, right);
          if (result) leftNode = { label: printCategory(raised), children: [leftNode] };
        }
        if (!result) continue;
        working.splice(index, 2, { node: { label: printCategory(result), children: [leftNode, working[index + 1].node] }, category: result });
        merged = true;
        break;
      }
      if (merged) break;
    }
    if (merged) continue;
    const left = working.shift()!, right = working.shift()!;
    working.unshift({ node: { label: '?', children: [left.node, right.node] } });
  }
  return working[0];
}

// CCG represents extraction through categories, not constituency movement traces.
function withoutMovement(node: RawNode): RawNode | undefined {
  if (isTraceLabel(node.label) || /^∅(?:@[^@\s]+)?$/u.test(node.label)) return;
  if (isLeaf(node)) return { label: withoutIndex(node.label), children: [] };
  const children = node.children.flatMap(child => {
    const overt = withoutMovement(child);
    return overt ? [overt] : [];
  });
  return children.length ? { label: node.label, children } : undefined;
}

// Read licensed wh gaps before removing empty categories from the lexical frontier.
function ccgExtraction(input: RawNode): RawNode {
  const root = structuredClone(input);
  const gapParent = (node: RawNode, index: number): RawNode | undefined => {
    if (node.children.some(child => isTraceLabel(child.label) && labelIndex(child.label) === index)) return node;
    for (const child of node.children) { const found = gapParent(child, index); if (found) return found; }
  };
  const selector = (part: RawNode, target: RawNode): RawNode | undefined => {
    if (part.label === 'VP' && part.children.includes(target)) return part;
    for (const child of part.children) { const found = selector(child, target); if (found) return found; }
  };
  const walk = (node: RawNode, parent?: RawNode) => {
    node.children.forEach(child => walk(child, node));
    if (node.label === 'VP' && parent?.label === 'VP' && parent.children.some(child => verbal.has(child.label) && beForms.has(wordKey(firstWord(child))))) {
      const predicate = node.children.findIndex(child => child.label === 'VBN');
      const stranded = node.children.find(child => child.label === 'PP' && child.children.some(part => isTraceLabel(part.label)));
      const preposition = stranded?.children.find(child => ['IN', 'TO'].includes(child.label));
      if (predicate >= 0 && preposition) {
        // CCGbank passes the passive PP's missing NP to the participle as PP/NP.
        node.children[predicate].label = printCategory(verbCategory(node, predicate, category('S\\NP'), undefined, stranded));
        preposition.label = 'PP/NP';
      }
    }
    if (node.label === 'S') {
      const clauses = node.children.filter(child => !isPunctuation(child.label));
      const markers = clauses.map(clause => clause.label === 'S' && clause.children.length === 2 && clause.children[1].label === 'S' ? clause.children[0] : undefined);
      const degrees = markers.map(marker => marker?.label === 'CMP' && marker.children.length === 2 && marker.children[0].label === 'DT' && wordKey(firstWord(marker)) === 'the' && marker.children[1].children.length === 1 ? marker.children[1].children[0] : undefined);
      // Paired constructional types keep either half from deriving a sentence on its own.
      if (clauses.length === 2 && degrees.every(degree => degree && isPreterminal(degree) && (['JJR', 'RBR'].includes(degree.label) || ['more', 'less', 'fewer'].includes(wordKey(firstWord(degree)))))) {
        markers.forEach((marker, index) => { marker!.children[0].label = index === 0 ? '((S/Corr)/S)/Deg' : '(Corr/S)/Deg'; degrees[index]!.label = 'Deg'; });
      }
    }
    if (['SBAR', 'SBARQ'].includes(node.label)) {
      const wh = node.children.find(child => child.label === 'WHNP' || child.label === 'WHPP' || child.label === 'WHADVP' || child.label === 'PP' && child.children.some(item => item.label === 'WHNP'));
      const pied = wh !== undefined && ['PP', 'WHPP'].includes(wh.label);
      const nominal = pied ? wh.children.find(child => child.label === 'WHNP') : wh;
      const index = nominal && labelIndex(firstWord(nominal));
      const gap = index === undefined ? undefined : gapParent(node, index);
      // Locative/temporal wh adverbs bind a PP argument in the CCG representation.
      if (wh?.label === 'WHADVP' && ['where', 'when'].includes(withoutIndex(firstWord(wh)).toLocaleLowerCase('en')) && gap?.label === 'ADVP') gap.label = 'PP';
      const relative = node.label === 'SBAR' && parent !== undefined && ['NP', 'NOM'].includes(parent.label);
      // An extracted adjunct can scope over a complete clause without adding verb valency.
      if (wh?.label === 'WHADVP' && gap?.label === 'ADVP') {
        const adverb = wh.children.find(child => child.label === 'WRB');
        if (adverb) {
          let operator = category(relative ? '(NP\\NP)/S' : 'S/S');
          for (const modifier of wh.children.filter(child => child !== adverb).reverse()) {
            const overt = withoutMovement(modifier);
            const argument = overt && deriveCcg(overt, 'WHADVP', false).category;
            if (argument) operator = { kind: 'apply', result: operator, argument, direction: '/' };
          }
          adverb.label = printCategory(operator);
        }
      }
      if (wh?.label === 'WHADVP' && gap?.label === 'ADJP') {
        const degree = wh.children.find(child => child.label === 'WRB');
        if (degree) degree.label = wh.children.some(child => child.label === 'ADJP') ? '(S/(S/(S\\NP)))/(S\\NP)' : 'S/(S/(S\\NP))';
        const predicate = selector(node, gap);
        const head = predicate?.children.findIndex(child => verbal.has(child.label)) ?? -1;
        if (predicate && head >= 0) predicate.children[head].label = printCategory(verbCategory(predicate, head));
      }
      if (wh?.label === 'WHADVP' && gap?.label === 'PP') {
        const adverb = wh.children.find(child => child.label === 'WRB');
        if (adverb) adverb.label = `${relative ? '(NP\\NP)' : 'S'}/(S/PP)`;
      }
      // A matrix/embedded interrogative yields S; a nominal relative modifies NP.
      if (wh && gap && ['S', 'SQ', 'VP', 'PP'].includes(gap.label)) {
        const directClause = node.children.find(child => ['S', 'SQ', 'VP'].includes(child.label));
        const longSubject = gap.label === 'S' && gap !== directClause;
        const object = gap.label === 'VP' || gap.label === 'PP' || longSubject;
        let operator = category(`${relative ? '(NP\\NP)' : 'S'}/${pied ? '(S/PP)' : object ? '(S/NP)' : '(S\\NP)'}`);
        const lexical = wh.children.find(child => (pied ? ['IN', 'TO'] : ['WP', 'WDT']).includes(child.label));
        if (lexical) {
          for (const nominal of wh.children.filter(child => child !== lexical).reverse()) {
            const overt = withoutMovement(nominal);
            const argument = overt && deriveCcg(overt, pied ? 'WHPP' : undefined).category;
            if (argument) operator = { kind: 'apply', result: operator, argument, direction: '/' };
          }
          lexical.label = printCategory(operator);
        }
        if (longSubject) {
          const bridge = selector(node, gap);
          const predicate = bridge?.children.findIndex(child => verbal.has(child.label) && child.label !== 'MD') ?? -1;
          // CCGbank's subject-extraction lexical category changes argument order, not English composition rules.
          if (bridge && predicate >= 0) bridge.children[predicate].label = printCategory(verbCategory(bridge, predicate, category('(S\\NP)/NP'), gap));
        } else if (gap.label === 'PP') {
          const bridge = selector(node, gap);
          const predicate = bridge?.children.findIndex(child => verbal.has(child.label) && child.label !== 'MD') ?? -1;
          if (bridge && predicate >= 0) bridge.children[predicate].label = printCategory(verbCategory(bridge, predicate));
          const preposition = gap.children.find(child => ['IN', 'TO'].includes(child.label));
          if (preposition) preposition.label = 'PP/NP';
        } else if (object) {
          const predicate = gap.children.findIndex(child => verbal.has(child.label) && child.label !== 'MD');
          if (predicate >= 0) gap.children[predicate].label = printCategory(verbCategory(gap, predicate));
        }
      }
    }
    if (node.label === 'SQ' && node.children.some(child => child.label === 'NP')) {
      const auxiliary = node.children.find(child => verbal.has(child.label) && auxiliaryWord.test(wordKey(firstWord(child))));
      if (auxiliary) {
        const wh = parent?.label === 'SBARQ' ? parent.children.find(child => ['WHNP', 'WHPP', 'PP', 'WHADVP'].includes(child.label)) : undefined;
        const pied = wh !== undefined && ['PP', 'WHPP'].includes(wh.label);
        const nominal = pied ? wh.children.find(child => child.label === 'WHNP') : wh;
        const index = nominal && labelIndex(firstWord(nominal));
        const gap = index === undefined ? undefined : gapParent(node, index);
        const locative = wh?.label === 'WHADVP' && ['where', 'when'].includes(withoutIndex(firstWord(wh)).toLocaleLowerCase('en')) && gap?.label === 'ADVP';
        const object = gap !== undefined && gap !== node && ['VP', 'S', 'PP'].includes(gap.label);
        auxiliary.label = locative ? '(S/PP)/(S/PP)' : gap?.label === 'ADJP' ? '(S/(S\\NP))/NP' : wh?.label === 'WHADVP' && gap?.label === 'PP' ? '(S/PP)/NP' : object ? pied ? '(S/PP)/(S/PP)' : '(S/NP)/(S/NP)' : 'S/S';
      }
    }
  };
  walk(root);
  return root;
}

function asCcg(node: RawNode) {
  const overt = withoutMovement(ccgExtraction(node));
  if (!overt) throw new Error('TREE_PARSE');
  const derived = deriveCcg(overt);
  const expected = phraseCategory(overt, undefined, false);
  // A locally valid application can still fail to derive the input's root category.
  return derived.category && printCategory(derived.category) !== printCategory(expected)
    ? { label: '?', children: [derived.node] }
    : derived.node;
}

// A feature structure shows attribute-value pairs: category above, then HEAD with the lexical
// head; terminals show the word above its category (a part of speech, not a CCG type).
function asFeature(node: RawNode, category = isPreterminal(node) ? xbarTerminal(node.label) : ''): RawNode {
  if (isPreterminal(node)) return { label: clamp(`${node.children[0].label}|${category}`), children: [] };
  if (isLeaf(node)) return node;
  // Punctuation carries no feature bundle.
  if (isPunctuation(node.label)) return { label: node.label, children: node.children.map(child => asFeature(child)) };
  const terminal = (child: RawNode) => node.label === 'ADJP' && (child.label === 'VBN' || child.label === 'VBG') ? 'A'
    : node.label === 'WHPP' && (child.label === 'IN' || child.label === 'TO') ? 'P'
    : xbarTerminal(child.label);
  return { label: clamp(`${node.label}|HEAD ${withoutIndex(lexicalHead(node))}`), children: node.children.map(child => asFeature(child, isPreterminal(child) ? terminal(child) : undefined)) };
}

function clamp(value: string) {
  const chars = Array.from(value);
  return chars.length > 200 ? `${chars.slice(0, 199).join('')}…` : value;
}

export function presentTree(node: RawNode, form: TreeForm): RawNode {
  if (form === 'xbar') return xbarMovement(asXbar(node));
  if (form === 'bare') return asBare(xbarMovement(asXbar(node)));
  if (form === 'tag') return node;
  if (form === 'cst') return node;
  if (form === 'ast') return asAst(node);
  if (form === 'ccg') return asCcg(node);
  if (form === 'feature') return asFeature(node);
  return node;
}

export type DependencyRow = { word: string; head: number; role: string };

function firstWord(node: RawNode): string {
  let current = node;
  while (current.children.length) current = current.children[0];
  return wordKey(current.label);
}

const clausalComplements = new Set(['that', 'if', 'whether']);
const isExpletive = (node: RawNode) => node.children.length === 1 && node.children[0].label === 'EX';

function isContentClause(clause: RawNode, selected: boolean) {
  if (clause.label === 'S') return clause.children.some(isFiniteVerbPhrase);
  if (clause.label !== 'SBAR') return false;
  const marker = clause.children[0]?.label;
  return clausalComplements.has(firstWord(clause)) || selected
    && (['WHNP', 'WHPP', 'WHADVP'].includes(marker) || marker === 'NP' && clause.children.some(isFiniteVerbPhrase));
}

// A passive predicate is a form of "be" followed by a past participle. The subject of such a
// clause is a `nsubj:pass` and its "by" phrase is an `obl:agent`.
function passivePredicate(node: RawNode): boolean {
  if (node.label !== 'VP' && node.label !== 'SQ') return false;
  const items: { tag: string; word: string }[] = [];
  const collect = (current: RawNode) => {
    for (const child of current.children) {
      if (isPreterminal(child) && !/^(?:RB|RBR|RBS)$/u.test(child.label)) items.push({ tag: child.label, word: wordKey(child.children[0].label) });
      else if (child.label === 'VP') collect(child);
    }
  };
  collect(node);
  return items.some((item, index) => beForms.has(item.word) && items[index + 1]?.tag === 'VBN');
}

function clausalSubject(node: RawNode) {
  if (node.label !== 'S') return undefined;
  const [subject, predicate, ...rest] = node.children;
  if (!subject || predicate?.label !== 'VP' || rest.some(child => !isPunctuation(child.label))) return undefined;
  // Use the matrix VP's finite head to keep malformed fragments and coordinated VPs out.
  if (!['VBD', 'VBP', 'VBZ', 'MD'].includes(predicate.children[headIndex(predicate)]?.label)) return undefined;
  const start = subject.children[0]?.label;
  if (subject.label === 'VP' && ['TO', 'VBG'].includes(start)) return subject;
  if ((subject.label === 'SBAR' || subject.label === 'S')
    && (['that', 'whether', 'for'].includes(firstWord(subject)) || ['WHNP', 'WHADVP', 'WHPP', 'TO'].includes(start))) return subject;
  return undefined;
}

function dependencyRole(parent: RawNode, child: RawNode, head: number, existentialBe: boolean): string {
  const label = child.label;
  const parentLabel = parent.label;
  const headLabel = parent.children[head]?.label;
  const coordinated = parent.children.some(item => item.label === 'CC');
  // An empty category carries its role in its own label, so a moved object is still an object.
  const empty = /^∅@([^@\s]+)$/u.exec(label);
  if (empty) return empty[1];
  if (label === '∅') return parentLabel === 'VP' ? 'obj' : 'dep';
  // A movement trace stands for the argument the moved constituent filled at its base position.
  if (isTraceLabel(label)) return parentLabel === 'VP' ? 'obj' : parentLabel === 'PP' ? 'pobj' : 'nsubj';
  if (label === 'CC') return 'cc';
  // A coordinated conjunct inherits the role its own kind would take, but is marked as such.
  if (coordinated && child === parent.children[coordinationIndex(parent) + 1]) return 'conj';
  if (isNominalList(parent) && child.label === 'NP' && child !== parent.children[0]) return 'conj';
  if (isNominalApposition(parent) && child === parent.children[2]) return 'appos';
  if (label === 'ADJX') {
    const adjunct = child.children[headIndex(child)]?.label;
    return adjunct === 'PP' ? 'obl' : adjunct === 'UH' ? 'discourse'
      : ['SBAR', 'S', 'VP', 'ADJP'].includes(adjunct) ? 'advcl' : 'advmod';
  }
  if (label === 'NP-TMP') return parentLabel === 'NP' || parentLabel === 'NP-TMP' ? 'nmod:unmarked' : 'obl:unmarked';
  if (label === 'WHPP') return parentLabel === 'NP' ? 'nmod' : 'obl';
  if (isPunctuation(label)) return 'punct';
  if (dateHead(parent) !== undefined) return 'nmod:unmarked';
  if (label === 'PRN') {
    const content = child.children.find(item => !isPunctuation(item.label));
    return content?.label === 'ADVP' ? 'advmod' : parentLabel === 'NP' && content?.label === 'NP' ? 'appos' : 'parataxis';
  }
  if (label === 'POS') return 'case';
  if (label === 'RP') return 'compound:prt';
  if (label === 'EX') return 'expl';
  if (label === 'CD') return 'nummod';
  if (label === 'PRP$') return 'nmod:poss';
  if (label === 'DT' || label === 'PDT') return 'det';
  // A relative pronoun under SBAR is the clause's subject unless the clause already has one,
  // in which case it is the object that the relative clause is about ("the city which I visited").
  if (label === 'WDT' || label === 'WP') {
    if (parentLabel !== 'SBAR') return 'det';
    const clause = parent.children.find(item => item.label === 'S' || item.label === 'VP');
    const hasSubject = clause ? clause.children.some(item => item.label === 'NP' || item.label === 'PRP') : false;
    return hasSubject ? 'obj' : 'nsubj';
  }
  if (/^JJ/u.test(label)) return 'amod';
  if (/^RB/u.test(label) || label === 'WRB') return 'advmod';
  if (label === 'MD') return 'aux';
  if (label === 'TO') return parentLabel === 'PP' || parentLabel === 'WHPP' ? 'case' : 'mark';
  if (/^VB/u.test(label)) {
    const word = isPreterminal(child) ? wordKey(child.children[0].label) : '';
    // A form of "be" with a nominal or adjectival predicate is a copula, not an auxiliary verb.
    if ((beForms.has(word) || word === "'s") && ['ADJP', 'NP', 'PP', 'ADVP'].includes(headLabel)) return 'cop';
    return beForms.has(word) && passivePredicate(parent) ? 'aux:pass' : 'aux';
  }
  if (label === 'IN') return parentLabel === 'PP' || parentLabel === 'WHPP' ? 'case' : 'mark';
  if (label === 'NP' || label === 'PRP') {
    // An NP that is nothing but the expletive "there" is not a subject.
    if (isExpletive(child)) return 'expl';
    if (existentialBe) return 'nsubj';
    if (['S', 'SBAR', 'SQ', 'SINV', 'SBARQ'].includes(parentLabel)) {
      const predicate = parentLabel === 'SQ' ? parent : parent.children.find(item => item.label === 'VP');
      return predicate && passivePredicate(predicate) ? 'nsubj:pass' : 'nsubj';
    }
    if (parentLabel === 'VP') {
      const objects = parent.children.filter(item => item.label === 'NP');
      const verb = wordKey(lexicalHead(parent));
      if (objects.length === 1 && /^(?:becom(?:e|es|ing)|became|remain(?:s|ed|ing)?)$/u.test(verb)) return 'xcomp';
      if (objects.length === 1 && takesRecipientClause(verb) && parent.children.some(part => isContentClause(part, true))) return 'iobj';
      return objects.length > 1 && child === objects[0] ? 'iobj' : 'obj';
    }
    if (child.children.some(item => item.label === 'POS')) return 'nmod:poss';
    return 'nmod';
  }
  if ((label === 'NN' || label === 'NNS' || label === 'NNP' || label === 'NNPS') && parentLabel === 'NP') return 'compound';
  if (label === 'PP') {
    if (parentLabel === 'NP') return 'nmod';
    const preposition = firstWord(child).toLocaleLowerCase('en');
    // The "by" phrase of a passive is its agent. The passive predicate may be this phrase's own
    // verb phrase ("was written by …") or the matrix one when a participle heads a nested phrase.
    const predicate = parent.children.find(item => item.label === 'VP');
    const participialHead = parent.children.some(item => ['VBN', 'VBD'].includes(item.label) && item.label === 'VBN');
    if (preposition === 'by' && ((predicate && passivePredicate(predicate)) || participialHead)) return 'obl:agent';
    return 'obl';
  }
  if (child === clausalSubject(parent)) {
    return parent.children.some(passivePredicate) ? 'csubj:pass' : 'csubj';
  }
  if (label === 'SBAR') {
    if (parentLabel === 'NP') {
      const hasOperator = child.children.some(item => ['WHNP', 'WHADVP', 'WHPP'].includes(item.label));
      const antecedent = labelIndex(lexicalHead(parent));
      const predicate = child.children.find(item => item.label === 'VP');
      const hasGap = (item: RawNode): boolean => item.children.some(part =>
        (isTraceLabel(part.label) && labelIndex(part.label) === antecedent) || (['VP', 'PP'].includes(part.label) && hasGap(part)));
      return hasOperator || (antecedent !== undefined && predicate && hasGap(predicate)) ? 'acl:relcl' : 'acl';
    }
    if (parentLabel === 'VP') {
      const verb = withoutIndex(lexicalHead(parent)).toLocaleLowerCase('en');
      return isContentClause(child, selectsFiniteClause(verb) || takesRecipientClause(verb)) ? 'ccomp' : 'advcl';
    }
    return 'advcl';
  }
  if (label === 'S') return parentLabel === 'VP' || parentLabel === 'SBAR' ? 'ccomp'
    : parentLabel === 'S' && parent.children.some(item => item.label === ':' || item.label === '.') ? 'parataxis' : 'advcl';
  if (label === 'VP') return parentLabel === 'NP' ? 'acl' : 'xcomp';
  if (label === 'ADJP') return parentLabel === 'NP' ? 'amod' : 'xcomp';
  if (label === 'ADVP') return 'advmod';
  if (label === 'WHNP' || label === 'WHADVP') {
    // A wh-phrase is the subject when the question or relative clause has no other one,
    // and the object otherwise ("what did you see", "the city which I visited").
    const clause = parent.children.find(item => ['SQ', 'S', 'SBARQ', 'VP'].includes(item.label));
    const hasSubject = clause ? clause.children.some(item => item.label === 'NP' || item.label === 'PRP') : false;
    if (label === 'WHADVP') return 'advmod';
    const predicate = clause?.children.find(item => item.label === 'VP');
    return hasSubject ? 'obj' : predicate && passivePredicate(predicate) ? 'nsubj:pass' : 'nsubj';
  }
  if (label === 'PRT') return 'compound:prt';
  return 'dep';
}

// Dependency heads are content words. A preposition is a case marker on the nominal it governs,
// so a PP is headed by its object, and an auxiliary or copula hangs off the predicate it helps.
function dependencyHeadIndex(node: RawNode): number {
  const coordination = coordinationIndex(node);
  if (coordination >= 0) return coordination - 1;
  // A clause is headed by its predicate: the verb is the head, not the subject or the marker.
  if (node.label === 'SBAR' || node.label === 'S' || node.label === 'SQ' || node.label === 'SBARQ') {
    const subject = clausalSubject(node);
    const clause = node.children.findIndex(child => child !== subject && (child.label === 'S' || child.label === 'VP'));
    if (clause >= 0) return clause;
  }
  if (node.label === 'SQ') {
    let subject = false;
    const predicate = node.children.findIndex(child => {
      if (child.label === 'NP') { if (!subject) { subject = true; return false; } return true; }
      return ['ADJP', 'PP', 'ADVP'].includes(child.label);
    });
    if (predicate >= 0) return predicate;
  }
  if (node.label === 'PP' || node.label === 'WHPP') {
    const object = node.children.findIndex(child => child.label === 'NP' || child.label === 'PRP' || child.label === 'WHNP');
    if (object >= 0) return object;
  }
  if (node.label === 'WHADVP') {
    const predicate = node.children.findIndex(child => ['ADJP', 'ADVP'].includes(child.label));
    if (predicate >= 0) return predicate;
  }
  if (node.label === 'WHNP') {
    const nominal = node.children.findIndex(child => child.label === 'NOM' || child.label === 'NP');
    if (nominal >= 0) return nominal;
  }
  return contentHeadIndex(node);
}

// Post-order collection keeps words in surface order while linking each dependent to its head.
export function phraseDependencies(node: RawNode): DependencyRow[] {
  const rows: DependencyRow[] = [];
  const fillers = new Map<number, number>();
  const indexedWords = new Map<number, number>();
  const gaps: { index: number; head: number; role: string; caseRow?: number }[] = [];
  const walk = (current: RawNode, existential = false): number => {
    if (isTraceLabel(current.label) || /^∅(?:@[^@\s]+)?$/u.test(current.label)) return -1;
    if (isPreterminal(current)) {
      rows.push({ word: withoutIndex(current.children[0].label), head: -1, role: 'root' });
      const index = labelIndex(current.children[0].label);
      if (index !== undefined) indexedWords.set(index, rows.length - 1);
      return rows.length - 1;
    }
    if (!current.children.length) {
      const empty = /^(.*)@([^@\s]+)$/u.exec(current.label);
      rows.push({ word: withoutIndex(empty?.[1] ?? current.label), head: -1, role: empty?.[2] ?? 'root' });
      return rows.length - 1;
    }
    const there = existential || (['S', 'SQ'].includes(current.label) && current.children.some(isExpletive));
    const be = there && ['VP', 'SQ'].includes(current.label) && !current.children.some(child => child.label === 'VP')
      ? current.children.findIndex(child => verbal.has(child.label) && (beForms.has(firstWord(child)) || firstWord(child) === "'s")) : -1;
    const head = be >= 0 ? be : dependencyHeadIndex(current);
    const heads = current.children.map(child => walk(child, there && child.label === 'VP'));
    const headRow = heads[Math.max(0, head)] >= 0 ? heads[Math.max(0, head)] : heads.find(row => row >= 0) ?? -1;
    if (headRow < 0) return -1;
    if (current.label === 'WHNP' || current.label === 'WHADVP') {
      const index = labelIndex(firstWord(current));
      if (index !== undefined) fillers.set(index, headRow);
    }
    current.children.forEach((child, position) => {
      const typedGap = ['PP', 'ADVP', 'ADJP'].includes(child.label) && child.children.find(part => isTraceLabel(part.label));
      if (['VP', 'SQ'].includes(current.label) && typedGap) {
        const index = labelIndex(typedGap.label)!;
        const copula = current.children.some(part => /^VB/u.test(part.label) && (beForms.has(wordKey(firstWord(part))) || firstWord(part) === "'s"));
        const predicate = copula && (child.label === 'ADJP' || child.label === 'PP' && child.children.every(part => isTraceLabel(part.label)));
        gaps.push({ index, head: headRow, role: predicate ? 'predicate' : child.label === 'ADJP' ? 'xcomp' : child.label === 'PP' ? 'obl' : 'advmod', caseRow: child.label === 'PP' && heads[position] >= 0 ? heads[position] : undefined });
      }
      const index = labelIndex(child.label);
      if (index === undefined || !isTraceLabel(child.label)) return;
      if (current.label === 'VP') gaps.push({ index, head: headRow, role: 'obj' });
      if (['S', 'SQ'].includes(current.label)) {
        const predicate = current.label === 'SQ' ? current : current.children.find(part => part.label === 'VP');
        gaps.push({ index, head: headRow, role: predicate && passivePredicate(predicate) ? 'nsubj:pass' : 'nsubj' });
      }
    });
    heads.forEach((row, index) => {
      if (row < 0 || row === headRow) return;
      if (rows[row].head < 0) {
        // UD attaches a coordinator to the following conjunct, not the first conjunct.
        rows[row].head = current.children[index].label === 'CC' && heads[index + 1] >= 0 ? heads[index + 1] : headRow;
        rows[row].role = dependencyRole(current, current.children[index], head, be >= 0);
      }
    });
    return headRow;
  };
  walk(node);
  // A fronted wh-nominal depends on the predicate at its gap, including embedded clauses.
  for (const gap of gaps) {
    const passiveSubject = indexedWords.get(gap.index);
    if (gap.caseRow !== undefined && passiveSubject !== undefined && rows[passiveSubject].role === 'nsubj:pass') {
      rows[gap.caseRow].head = passiveSubject; rows[gap.caseRow].role = 'case';
    }
    const row = fillers.get(gap.index);
    if (row !== undefined && row !== gap.head) {
      if (gap.role === 'predicate') {
        const originalHead = rows[gap.head].head, originalRole = rows[gap.head].role;
        for (const dependent of rows) if (dependent !== rows[row] && dependent.head === gap.head) dependent.head = row;
        rows[row].head = originalHead; rows[row].role = originalRole;
        rows[gap.head].head = row; rows[gap.head].role = 'cop';
        continue;
      }
      rows[row].head = gap.head; rows[row].role = gap.role;
      if (gap.caseRow !== undefined && gap.caseRow !== row) { rows[gap.caseRow].head = row; rows[gap.caseRow].role = 'case'; }
    }
  }
  return rows;
}

export function rowsToDependency(rows: DependencyRow[]) {
  const root = rows.findIndex(row => row.head < 0);
  // A stray orphan joins the root as an ordinary dependent, so only one row stays the root.
  return rows.map((row, index) => ({ ...row, head: index === root ? -1 : row.head < 0 ? root : row.head, role: index === root ? row.role : row.role === 'root' ? 'dep' : row.role }));
}
