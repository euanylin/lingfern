import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { drawTree, treeForms, type TreeDiagram } from '../src/shared/tree';
import { isTraceLabel, withoutIndex } from '../src/shared/tree-movement';
import { resolvePos, type WordNetPos } from '../src/shared/wordnet-pos';

// Every probe sentence is drawn in all nine presentations and checked for structural integrity and
// full word coverage. This is a shape and coverage audit, not a claim that each attachment is the
// best linguistic analysis.
const letters = [...'abcdefghijklmnopqrstuvwxyz0'];
const buckets = new Map(letters.map(letter => [letter, JSON.parse(readFileSync(`public/dictionary/oewn-2025/pos-${letter}.json`, 'utf8')) as Record<string, number>]));
const formList = JSON.parse(readFileSync('public/dictionary/oewn-2025/forms.json', 'utf8')) as Record<string, string[]>;
const parts: WordNetPos[] = ['noun', 'verb', 'adjective', 'adverb'];
const lookup = (word: string) => {
  const counts = resolvePos(word, buckets, formList);
  const ordered = parts.filter(part => counts[part] > 0).map(part => [part, counts[part]] as const);
  return ordered.length ? ordered : undefined;
};

const features = new Set(['past', 'pres', 'fut', 'inf', 'modal', '∅']);
const norm = (value: string) => value.toLocaleLowerCase('en').replace(/[^a-z0-9]/gu, '');

function audit(diagram: TreeDiagram, sentence: string, form: string): string[] {
  const defects: string[] = [];
  const byId = new Map(diagram.nodes.map(node => [node.id, node]));
  const parents = new Map<string, number>();
  for (const node of diagram.nodes) for (const id of node.children) parents.set(id, (parents.get(id) ?? 0) + 1);
  const roots = diagram.nodes.filter(node => !parents.has(node.id));
  if (roots.length !== 1) defects.push(`${roots.length} roots`);
  for (const [id, count] of parents) if (count > 1 || !byId.has(id)) defects.push('shared or dangling child');
  for (const node of diagram.nodes) {
    if (node.children.length !== 1) continue;
    const child = byId.get(node.children[0]);
    // A node over one child of its own category is a projection with nothing to project.
    if (diagram.kind !== 'dependency' && child && child.label === node.label && !/^[,.;:!?]$/u.test(node.label)) defects.push(`unary repeat ${node.label}`);
  }
  const words: string[] = [];
  const walk = (id: string, parent?: string) => {
    const node = byId.get(id);
    if (!node) return;
    if (!node.children.length) {
      // A movement trace is not a word of the sentence, and an index is notation on the word.
      if (parent === 'T' && features.has(node.label)) return;
      if (/^(?:T\[(?:past|pres|inf|modal)\]|C\[∅\])$/u.test(node.label)) return;
      if (isTraceLabel(node.label)) return;
      words.push(withoutIndex(node.label).split('|')[0]);
      return;
    }
    node.children.forEach(child => walk(child, node.label));
  };
  roots.forEach(root => walk(root.id));
  // Every presentation must retain the exact lexical frontier, not merely contain word fragments
  // somewhere in head labels. Dependencies order all overt nodes by their token positions.
  const surface = diagram.kind === 'dependency'
    ? [...diagram.nodes].sort((a, b) => a.order! - b.order!).map(node => node.label)
    : words;
  if (!surface.length) defects.push('no words');
  const spoken = surface.filter(word => !/^[,.;:!?]$/u.test(word)).join(' ');
  if (norm(spoken) !== norm(sentence)) defects.push(`${form} order differs: ${spoken}`);
  return defects;
}

it('draws and accounts for every probe in every presentation', async () => {
  const mods = await Promise.all([
    import('./fixtures/tree-inflection-cases'), import('./fixtures/tree-clause-np-cases'),
    import('./fixtures/tree-quantity-cases'), import('./fixtures/tree-pp-tense-modal-cases'),
    import('./fixtures/tree-passive-neg-q-cases'), import('./fixtures/tree-complement-nounclause-cases'),
    import('./fixtures/tree-relative-nonfinite-adverbial-cases'), import('./fixtures/tree-cond-comp-coord-inv-disc-cases'),
  ]);
  const all = mods.flatMap(mod => Object.values(mod).flat() as { id: number; sentence: string }[]);
  const failures: string[] = [];
  for (const item of all) {
    for (const form of treeForms) {
      let defects: string[];
      try {
        defects = audit(drawTree(item.sentence, form, lookup), item.sentence, form);
      } catch {
        defects = ['threw'];
      }
      for (const defect of defects) failures.push(`${item.id} ${form}: ${defect}`);
    }
  }
  expect(all.length).toBe(1820);
  expect(failures, failures.slice(0, 20).join('\n')).toEqual([]);
}, 600_000);
