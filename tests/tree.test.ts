import { readFileSync } from 'node:fs';
import { resolvePos, type WordNetPos } from '../src/shared/wordnet-pos';

// The installed Open English WordNet buckets, read the way the page reads them. The grammar and
// view assertions below describe the product, so they run with the real dictionary rather than the
// offline fallback; the fallback has its own test in tests/tree-lexicon.test.ts.
const letters = [...'abcdefghijklmnopqrstuvwxyz0'];
const buckets = new Map(letters.map(letter => [letter, JSON.parse(readFileSync(`public/dictionary/oewn-2025/pos-${letter}.json`, 'utf8')) as Record<string, number>]));
const formList = JSON.parse(readFileSync('public/dictionary/oewn-2025/forms.json', 'utf8')) as Record<string, string[]>;
const parts: WordNetPos[] = ['noun', 'verb', 'adjective', 'adverb'];
const lookup = (word: string) => {
  const counts = resolvePos(word, buckets, formList);
  const ordered = parts.filter(part => counts[part] > 0).map(part => [part, counts[part]] as const);
  return ordered.length ? ordered : undefined;
};

import { unzipSync, zipSync } from 'fflate';
import { beforeEach, expect, it, vi } from 'vitest';
import { exportBackup, importBackup, inspectBackup } from '../src/data/backup';
import { db } from '../src/data/db';
import { findSavedTree, lookupHistoryUrl, readLookupHistory, recordLookup, recordTree, removeLookup } from '../src/data/lookupHistory';
import { pendingSyncBatch, receiveSyncBatch } from '../src/data/sync';
import { isTraceLabel, withoutIndex } from '../src/shared/tree-movement';
import { canonicalJson, validateSyncBatch } from '../src/shared/sync';
import { addChild, addSibling, blankTree, canDropNode, drawTree, layoutTree, moveNode, removeNode, renameNode, reorderTo, reparentNode, exampleSentence, exampleTree, treeForms, sentenceFileName, treeDiagramSchema, treeFileName, treePdf, treeSvg, treeText, type TreeDiagram } from '../src/shared/tree';
import { headIndex } from '../src/shared/tree-forms';

it('selects phrase heads by category and position and skips punctuation on fallback', () => {
  const head = (label: string, ...labels: string[]) => labels[headIndex({ label, children: labels.map(label => ({ label, children: [] })) })];
  expect(head('NP', 'DT', 'NNP', 'NN', 'PP')).toBe('NN');
  expect(head('VP', 'MD', 'VB', 'NP')).toBe('MD');
  expect(head('WHNP', 'WDT', 'NN')).toBe('NN');
  expect(head('PP', 'ADVP', 'IN', 'NP')).toBe('IN');
  expect(head('X', 'ADJP', '.')).toBe('ADJP');
});
import Dexie from 'dexie';

beforeEach(async () => { vi.restoreAllMocks(); await Promise.all(db.tables.map(table => table.clear())); });

function shape(diagram: TreeDiagram) {
  const byId = new Map(diagram.nodes.map(node => [node.id, node]));
  const walk = (id: string): string => {
    const node = byId.get(id)!;
    return node.children.length ? `(${node.label} ${node.children.map(walk).join(' ')})` : node.label;
  };
  return walk(diagram.root);
}

it('draws bracketed syntax trees, ordinary trees, outlines and quoted labels', () => {
  expect(shape(drawTree('(S (NP (DT the) (NN cat)) (VP sat))'))).toBe('(S (NP (DT the) (NN cat)) (VP sat))');
  expect(shape(drawTree('[Company [Engineering [Frontend] [Backend]] [Design]]', 'constituency', lookup))).toBe('(Company (Engineering Frontend Backend) Design)');
  expect(shape(drawTree('公司\n  工程\n    前端\n    后端\n  设计', 'constituency', lookup))).toBe('(公司 (工程 前端 后端) 设计)');
  expect(shape(drawTree('("New York" ("Front end"))'))).toBe('(New York Front end)');
  const quoted = drawTree('("New York" ("Front end"))');
  expect(treeText(quoted)).toBe('["New York" "Front end"]');
  expect(shape(drawTree(treeText(quoted)))).toBe(shape(quoted));
  const outline = drawTree('公司\n  工程\n    前端\n    后端\n  设计', 'constituency', lookup);
  expect(treeText(outline)).toBe('[公司 [工程 前端 后端] 设计]');
  expect(shape(drawTree(treeText(outline)))).toBe(shape(outline));
  expect(treeText(blankTree())).toBe('S');
  expect(() => drawTree('(S')).toThrow('TREE_PARSE');
  expect(() => drawTree('', 'constituency', lookup)).toThrow('TREE_PARSE');
  expect(() => drawTree('a\u0000b', 'constituency', lookup)).toThrow('TREE_PARSE');
  let deep = 'leaf';
  for (let count = 0; count < 81; count++) deep = `(n ${deep})`;
  // Deeply nested input is accepted until the recursion safety bound.
  expect(shape(drawTree(deep, 'constituency', lookup)).startsWith('(n ')).toBe(true);
  let tooDeep = 'leaf';
  for (let count = 0; count < 1001; count++) tooDeep = `(n ${tooDeep})`;
  expect(() => drawTree(tooDeep, 'constituency', lookup)).toThrow('TREE_TOO_BIG');
});

it('draws a bounded constituency tree for a short English sentence', () => {
  expect(shape(drawTree('the cat sat', 'constituency', lookup))).toBe('(S (NP (DT the) (NN cat)) (VP (VBD sat)))');
  expect(shape(drawTree('the cat sat on the mat', 'constituency', lookup))).toBe('(S (NP (DT the) (NN cat)) (VP (VBD sat) (PP (IN on) (NP (DT the) (NN mat)))))');
  expect(shape(drawTree('the small cat sat', 'constituency', lookup))).toBe('(S (NP (DT the) (JJ small) (NN cat)) (VP (VBD sat)))');
  expect(shape(drawTree('she is reading a book', 'constituency', lookup))).toBe('(S (NP (PRP she)) (VP (VBZ is) (VP (VBG reading) (NP (DT a) (NN book)))))');
  expect(shape(drawTree('birds fly', 'constituency', lookup))).toBe('(S (NP (NNS birds)) (VP (VB fly)))');
  expect(shape(drawTree('she is very happy', 'constituency', lookup))).toBe('(S (NP (PRP she)) (VP (VBZ is) (ADJP (RB very) (ADJP (JJ happy)))))');
  expect(shape(drawTree('the student read the book in the library and the teacher wrote a letter to the parent before the class', 'constituency', lookup))).toContain('(S (S (NP (DT the) (NN student))');
  expect(() => drawTree('the', 'constituency', lookup)).toThrow('TREE_PARSE');
  expect(() => drawTree(Array.from({ length: 201 }, () => 'cat').join(' '))).toThrow('TREE_PARSE');
});

it('allows large trees, wide nodes and long labels', () => {
  // A flat tree with 300 children and a 200-character label both exceed the old caps.
  const wide = `[S ${Array.from({ length: 300 }, (_, index) => `[X${index}]`).join(' ')}]`;
  const wideTree = drawTree(wide, 'constituency', lookup);
  expect(wideTree.nodes.length).toBe(301);
  expect(layoutTree(wideTree).nodes).toHaveLength(301);
  const longLabel = 'L'.repeat(200);
  const longTree = drawTree(`[S ["${longLabel}"]]`, 'constituency', lookup);
  expect(longTree.nodes.some(node => node.label === longLabel)).toBe(true);
  const wideChildren = Array.from({ length: 200 }, (_, index) => ({ id: `n${index + 2}`, label: 'X', children: [] as string[] }));
  const wideSchema = treeDiagramSchema.parse({ root: 'n1', nodes: [{ id: 'n1', label: 'S', children: wideChildren.map(node => node.id) }, ...wideChildren] });
  expect(shape(wideSchema)).toContain('(S X X');
  // A two-thousand-node tree is accepted and every node is placed.
  const rows = Array.from({ length: 2000 }, (_, index) => `${index + 1} w${index + 1} ${index === 0 ? 0 : 1} ${index === 0 ? 'root' : 'dep'}`).join('\n');
  const dependency = drawTree(rows, 'constituency', lookup);
  expect(dependency.nodes).toHaveLength(2000);
  expect(layoutTree(dependency).nodes).toHaveLength(2000);
  // Adding a child past the depth bound still reports the size limit rather than hanging.
  let chain = blankTree();
  for (let count = 1; count <= 1000; count++) chain = addChild(chain, chain.nodes.at(-1)!.id, 'X');
  expect(chain.nodes).toHaveLength(1001);
  expect(() => addChild(chain, chain.nodes.at(-1)!.id, 'X')).toThrow('TREE_TOO_BIG');
});

it('follows Penn Treebank II bracketings for postmodifiers, relatives, clauses and coordination', () => {
  expect(shape(drawTree('the tall student from Boston read the old book', 'constituency', lookup))).toBe('(S (NP (NP (DT the) (JJ tall) (NN student)) (PP (IN from) (NP (NNP Boston)))) (VP (VBD read) (NP (DT the) (JJ old) (NN book))))');
  expect(shape(drawTree('the man who caught the ball is my uncle', 'constituency', lookup))).toContain('(SBAR (WHNP (WP who₁)) (S t₁ (VP (VBD caught) (NP (DT the) (NN ball)))))');
  expect(shape(drawTree('he said that the world is flat', 'constituency', lookup))).toContain('(VP (VBD said) (SBAR (IN that) (S (NP (DT the) (NN world)) (VP (VBZ is) (ADJP (JJ flat))))))');
  expect(shape(drawTree('the children played and the parents talked', 'constituency', lookup))).toBe('(S (S (NP (DT the) (NNS children)) (VP (VBD played))) (CC and) (S (NP (DT the) (NNS parents)) (VP (VBD talked))))');
  expect(shape(drawTree("John's book is on the table", 'constituency', lookup))).toContain("(NP (NP (NN John) (POS 's)) (NN book))");
  expect(shape(drawTree('there is a book on the table', 'constituency', lookup))).toContain('(NP (EX there))');
  expect(shape(drawTree('we will meet at the station tomorrow', 'constituency', lookup))).toContain('(VP (MD will) (VP (VB meet)');
  expect(shape(drawTree('she has finished her homework', 'constituency', lookup))).toContain('(VP (VBZ has) (VP (VBN finished)');
  expect(shape(drawTree('she quickly opened the heavy wooden door', 'constituency', lookup))).toContain('(ADVP (RB quickly))');
});

it('labels X-bar terminals with lexical categories, not Penn Treebank tags', () => {
  const tree = shape(drawTree('the tall student read the old book', 'xbar', lookup));
  expect(tree).toContain("(N' (A tall) (N student))");
  expect(tree).toContain('(Det the)');
  expect(tree).toContain('(V read)');
  expect(tree).toMatch(/^\(TP /);
  expect(shape(drawTree('she is reading a book', 'xbar', lookup))).toContain("(T' (T is₁) (VP (V' (V t₁) (VP (V' (V reading)");
  expect(shape(drawTree("John's book is on the table", 'xbar', lookup))).toContain("(DP (NP (N' (N John))) (D' (D 's)))");
});

it('keeps CCG categories, TAG tree kinds and feature values in their own notations', () => {
  const ccg = shape(drawTree('the tall student read the old book', 'ccg', lookup));
  expect(ccg).toContain('(N tall|N/N student|N)');
  expect(ccg).toContain('(NP the|NP/N (N tall|N/N student|N))');
  expect(ccg).toContain('(S\\NP read|(S\\NP)/NP');
  expect(shape(drawTree('the man who caught the ball is my uncle', 'ccg', lookup))).toContain('who|(NP\\NP)/(S\\NP)');
  const feature = shape(drawTree('the tall student read the old book', 'feature', lookup));
  expect(feature).toContain('the|Det');
  expect(feature).toContain('tall|A');
  expect(feature).toContain('student|N');
  expect(feature).toContain('read|V');
  // Feature values are parts of speech, not CCG categories.
  expect(feature).not.toContain('NP/N');
  const tag = shape(drawTree('the cat sat', 'tag', lookup));
  expect(tag).toContain('(NP (DT the) (NN cat))');
});

it('scales an oversized PDF page while keeping one page', () => {
  const wide = drawTree(`[S ${Array.from({ length: 400 }, (_, index) => `[X${index}]`).join(' ')}]`);
  const layout = layoutTree(wide);
  expect(layout.width).toBeGreaterThan(14400);
  const text = new TextDecoder().decode(treePdf(layout, layout.nodes.map(() => null)));
  const box = /\/MediaBox \[0 0 (\d+) (\d+)\]/.exec(text)!;
  expect(Number(box[1])).toBeLessThanOrEqual(14400);
  expect(Number(box[2])).toBeLessThanOrEqual(14400);
  expect(text).toContain(' cm\n');
});

it('edits a tree by hand and lays the result out without overlapping nodes', () => {
  let diagram = addChild(blankTree(), 'n1', 'NP');
  diagram = addSibling(diagram, 'n2', 'VP');
  diagram = renameNode(diagram, 'n2', 'Noun');
  diagram = moveNode(diagram, 'n3', -1);
  expect(shape(diagram)).toBe('(S VP Noun)');
  diagram = removeNode(diagram, 'n3');
  expect(shape(diagram)).toBe('(S Noun)');
  const syntax = drawTree('(S (NP (DT the) (NN cat)) (VP (VBD sat)))');
  const layout = layoutTree(syntax);
  for (const left of layout.nodes) for (const right of layout.nodes) if (left.id !== right.id) {
    const separated = left.x + left.width <= right.x + 0.01 || right.x + right.width <= left.x + 0.01 || left.y + left.height <= right.y + 0.01 || right.y + right.height <= left.y + 0.01;
    expect(separated, `${left.label} overlaps ${right.label}`).toBe(true);
  }
  const centered = drawTree('(S (A one) (B two))');
  const placed = new Map(layoutTree(centered).nodes.map(node => [node.id, node]));
  for (const node of centered.nodes) if (node.children.length) {
    const parent = placed.get(node.id)!;
    const children = node.children.map(id => placed.get(id)!);
    const middle = (children[0].x + children[0].width / 2 + children.at(-1)!.x + children.at(-1)!.width / 2) / 2;
    expect(Math.abs(parent.x + parent.width / 2 - middle)).toBeLessThan(0.6);
  }
  const svg = treeSvg(layout, { line: '#D6D3CA' });
  expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  expect(svg).toContain('fill="#000"');
  expect(svg).toContain('the');
  expect(svg).not.toContain('<rect');
  expect(treeSvg(layoutTree(drawTree('("a<b&c")')), { line: 'rgb(7, 8, 9)' })).toContain('a&lt;b&amp;c');
  expect(() => treeDiagramSchema.parse({ root: 'n1', nodes: [{ id: 'n1', label: 'S', children: ['n1'] }] })).toThrow();
});

it('reorders a dragged sibling and reparents onto another node', () => {
  const diagram = drawTree('(S (NP (Det the) (N cat)) (VP sat))');
  const id = (label: string) => diagram.nodes.find(node => node.label === label)!.id;
  expect(canDropNode(diagram, id('S'), id('VP'))).toBe(false);
  expect(canDropNode(diagram, id('the'), id('Det'))).toBe(false);
  expect(canDropNode(diagram, id('NP'), id('cat'))).toBe(false);
  expect(canDropNode(diagram, id('NP'), id('VP'))).toBe(true);
  const reordered = reorderTo(diagram, id('NP'), id('VP'));
  expect(reordered.nodes.find(node => node.label === 'S')!.children).toEqual([id('VP'), id('NP')]);
  const moved = reparentNode(diagram, id('the'), id('VP'));
  expect(moved.nodes.find(node => node.label === 'Det')!.children).toEqual([]);
  expect(moved.nodes.find(node => node.label === 'VP')!.children).toEqual([id('sat'), id('the')]);
});

it('draws tree branches as vectors and keeps non-Latin labels as text', () => {
  const layout = layoutTree(drawTree('(S NP)'));
  const edge = layout.edges[0];
  const pdf = treePdf(layout, layout.nodes.map(() => null));
  const text = new TextDecoder().decode(pdf);
  expect(text.startsWith('%PDF-1.4\n')).toBe(true);
  expect(text.endsWith('%%EOF')).toBe(true);
  expect(text).toContain(`/MediaBox [0 0 ${layout.width} ${layout.height}]`);
  expect(text).toContain(`${edge.x1} ${Math.round((layout.height - edge.y1) * 100) / 100} m`);
  expect(text).toContain('(S) Tj');
  expect(text).toContain('(NP) Tj');
  expect(text).toContain('0 0 0 RG');
  expect(text).not.toContain('/DCTDecode');
  const chinese = layoutTree(drawTree('(中 文)'));
  const bitmap = { width: 1, height: 1, cssWidth: 8, cssHeight: 8, rgb: new Uint8Array([0, 0, 0]) };
  const painted = treePdf(chinese, chinese.nodes.map(() => bitmap));
  const paintedText = new TextDecoder().decode(painted).toLowerCase();
  expect(paintedText).toContain('/flatedecode');
  expect(paintedText).toContain('feff4e2d');
  expect(paintedText).not.toContain('/dctdecode');
});

it('lays out a tidy tree with variable widths, heights and centered parents', () => {
  const diagram = drawTree('[S [NP [Det the] [Adj tall] [N student]] [VP [V read] [NP [Det a] [Adj long] [N book]] [PP [P in] [NP [Det the] [N library]]]]]', 'constituency', lookup);
  const layout = layoutTree(diagram);
  for (const left of layout.nodes) for (const right of layout.nodes) if (left.id !== right.id) {
    const separated = left.x + left.width <= right.x + 0.01 || right.x + right.width <= left.x + 0.01 || left.y + left.height <= right.y + 0.01 || right.y + right.height <= left.y + 0.01;
    expect(separated, `${left.label} overlaps ${right.label}`).toBe(true);
  }
  for (const node of diagram.nodes) if (node.children.length) {
    const parent = layout.nodes.find(item => item.id === node.id)!;
    const children = node.children.map(id => layout.nodes.find(item => item.id === id)!);
    const middle = (Math.min(...children.map(child => child.x)) + Math.max(...children.map(child => child.x + child.width))) / 2;
    expect(Math.abs(parent.x + parent.width / 2 - middle)).toBeLessThan(0.6);
  }
  const matrix = layoutTree(drawTree('["NP|CASE nom|NUM sg" N]', 'constituency', lookup));
  expect(matrix.nodes[0].height).toBe(70);
  expect(matrix.nodes[1].y - matrix.nodes[0].y).toBe(70 + 28);
  const sibling = layoutTree(drawTree('[A [B [C]] [D [E]]]', 'constituency', lookup)).nodes;
  const b = sibling.find(node => node.label === 'B')!, d = sibling.find(node => node.label === 'D')!;
  expect(b.y).toBe(d.y);
  expect(b.x + b.width).toBeLessThan(d.x);
});

it('assigns one dependency arc level per distinct span and marks arrow ends', () => {
  const layout = layoutTree(drawTree('1 the 2 det\n2 cat 3 nsubj\n3 sat 4 obl\n4 here 0 root', 'constituency', lookup));
  const byRole = new Map(layout.edges.map(edge => [edge.label, edge]));
  expect(byRole.get('det')!.level).toBe(1);
  expect(byRole.get('nsubj')!.level).toBe(1);
  expect(byRole.get('obl')!.level).toBe(1);
  expect(layout.edges.every(edge => edge.arrow && edge.y1 === edge.y2)).toBe(true);
  const wide = layoutTree(drawTree('1 A 4 dep\n2 B 3 dep\n3 C 0 root\n4 D 2 dep', 'constituency', lookup));
  expect(new Set(wide.edges.map(edge => edge.level))).toEqual(new Set([1, 2, 3]));
  expect(Math.max(...wide.edges.map(edge => edge.bend ?? 0))).toBeGreaterThan(Math.min(...wide.edges.map(edge => edge.bend ?? 0)));
  const svg = treeSvg(layout, { line: '#D6D3CA' });
  expect(svg).toContain('stroke-width="1.5"');
  expect(svg).toContain('fill="#000" stroke="none"');
  const pdf = new TextDecoder().decode(treePdf(layout, layout.nodes.map(() => null)));
  expect(pdf).toContain(' c\n');
  expect(pdf).toContain('h\nf');
});

it('saves a tree in lookup history, syncs it apart from ordinary lookups, and restores backup format 8', async () => {
  await db.table('profiles').put({ id: 'p', name: 'Local', createdAt: '2026-11-14T00:00:00.000Z' });
  await recordLookup('p', 'dictionary', 'apple');
  await recordTree('p', 'The cat', drawTree('the cat sat', 'constituency', lookup));
  const first = (await pendingSyncBatch('p'))!;
  expect(first.batch.formatVersion).toBe(1);
  expect(first.batch.events.some(event => event.type === 'lookup' && event.payload.kind === 'tree')).toBe(false);
  await db.table('syncBatches').update(['p', first.deviceId, first.batchId], { state: 'confirmed' });
  const second = (await pendingSyncBatch('p'))!;
  expect(second.batch.formatVersion).toBe(3);
  expect(second.batch.events.map(event => event.type === 'lookup' && event.payload.kind)).toEqual(['tree']);
  await expect(validateSyncBatch({ ...second.batch, formatVersion: 1 })).rejects.toThrow('Tree lookups require batch format 3');
  const other = new Dexie(`tree-sync-${crypto.randomUUID()}`);
  other.version(1).stores({ settings: 'key', syncEvents: '[profileId+id], profileId, [profileId+type]', syncClocks: 'profileId', syncBatches: '[profileId+deviceId+batchId], profileId, [profileId+state]', syncConflicts: '[profileId+hash], profileId' });
  try {
    await receiveSyncBatch('p', first.batch, first.hash, other);
    await receiveSyncBatch('p', second.batch, second.hash, other);
    expect(shape((await findSavedTree('p', 'the cat', other))!.diagram!)).toBe('(S (NP (DT the) (NN cat)) (VP (VBD sat)))');
    expect(canonicalJson((await readLookupHistory('p', other))[0])).toBe(canonicalJson((await readLookupHistory('p'))[0]));
  } finally { await other.delete(); }
  const saved = (await readLookupHistory('p')).find(row => row.kind === 'tree')!;
  expect(lookupHistoryUrl(saved)).toBe('/library/trees?q=The%20cat');
  await recordTree('p', 'THE CAT', drawTree('(N kitten)'));
  expect(shape((await findSavedTree('p', 'The cat'))!.diagram!)).toBe('(N kitten)');
  const files = unzipSync(await exportBackup('p'));
  const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
  expect(manifest.version).toBe(8);
  const restored = await importBackup(await inspectBackup(zipSync(files)));
  expect(shape((await findSavedTree(restored, 'The cat'))!.diagram!)).toBe('(N kitten)');
  for (const version of [6, 7]) {
    manifest.version = version;
    files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest));
    await expect(inspectBackup(zipSync(files))).rejects.toThrow('BACKUP_REFERENCE');
  }
  await db.table('settings').put({ key: 'activeProfile', value: 'p' });
  await removeLookup('p', (await readLookupHistory('p')).find(row => row.kind === 'tree')!.id);
  expect(await findSavedTree('p', 'The cat')).toBeUndefined();
});

it('draws dependency arcs, edge roles and stacked feature labels', () => {
  const text = '1 the 2 det\n2 cat 3 nsubj\n3 sat 0 root';
  const projective = drawTree(text, 'constituency', lookup);
  expect(projective.kind).toBe('dependency');
  expect(treeText(projective)).toBe(text);
  const placed = layoutTree(projective);
  expect(new Set(placed.nodes.map(node => node.y)).size).toBe(1);
  expect(placed.nodes.map(node => node.label)).toEqual(['the', 'cat', 'sat']);
  expect(placed.edges.map(edge => edge.label).sort()).toEqual(['det', 'nsubj']);
  expect(placed.edges.every(edge => edge.bend && edge.bend > 0)).toBe(true);
  expect(treeSvg(placed, { line: '#000' })).toContain(' Q ');
  const pdf = new TextDecoder().decode(treePdf(placed, placed.nodes.map(() => null)));
  expect(pdf).toContain(' c\n');
  expect(pdf).toContain('(nsubj) Tj');
  const cat = projective.nodes.find(node => node.label === 'cat')!;
  const moved = moveNode(projective, cat.id, -1);
  expect(moved.nodes.find(node => node.label === 'cat')!.order).toBe(1);
  expect(moved.nodes.find(node => node.label === 'the')!.order).toBe(2);
  const missingAndTiedOrder = {
    ...projective,
    nodes: projective.nodes.map(node => ({ ...node, order: node.id === cat.id ? undefined : 0 })),
  };
  expect(layoutTree(missingAndTiedOrder).nodes.map(node => node.label)).toEqual(['the', 'cat', 'sat']);
  expect(layoutTree(moveNode(missingAndTiedOrder, cat.id, -1)).nodes.map(node => node.label)).toEqual(['cat', 'the', 'sat']);
  const added = addChild(projective, projective.root, 'there');
  expect(added.nodes.at(-1)).toMatchObject({ label: 'there', role: 'dep' });
  expect(added.kind).toBe('dependency');
  const spaced = drawTree('1 New_York 2 nsubj\n2 sat 0 root', 'constituency', lookup);
  expect(spaced.nodes.find(node => node.order === 1)!.label).toBe('New York');
  expect(treeText(spaced)).toBe('1 New_York 2 nsubj\n2 sat 0 root');
  const crossed = drawTree('1 A 3 dep\n2 B 4 dep\n3 C 0 root\n4 D 1 dep', 'constituency', lookup);
  const arcs = layoutTree(crossed).edges.map(edge => [edge.x1, edge.x2].sort((left, right) => left - right));
  expect(arcs.some((left, index) => arcs.some((right, other) => other > index && left[0] < right[0] && right[0] < left[1] && left[1] < right[1]))).toBe(true);
  expect(() => drawTree('1 a 2 dep\n2 b 1 dep', 'constituency', lookup)).toThrow('TREE_PARSE');
  const phrase = drawTree('[sat [cat@nsubj]]', 'constituency', lookup);
  expect(phrase.kind).toBeUndefined();
  expect(phrase.nodes.find(node => node.label === 'cat')!.role).toBe('nsubj');
  const phraseLayout = layoutTree(phrase);
  expect(phraseLayout.edges[0]).toMatchObject({ label: 'nsubj' });
  expect(phraseLayout.edges[0].bend).toBeUndefined();
  expect(treeText(phrase)).toBe('[sat cat@nsubj]');
  expect(treeText(drawTree('[VP [V\' [V saw] [NP@obj Mary]]]', 'constituency', lookup))).toContain("V'");
  expect(drawTree('["(S\\NP)/NP" sleeps]').nodes[0].label).toBe('(S\\NP)/NP');
  const matrix = layoutTree(drawTree('["NP|CASE nom|NUM sg" N]', 'constituency', lookup));
  expect(matrix.nodes[0].height).toBe(70);
  expect(treeSvg(matrix, { line: '#000' })).toContain('<tspan');
  expect(new TextDecoder().decode(treePdf(matrix, matrix.nodes.map(() => null)))).toContain('(CASE nom) Tj');
  const legacy = treeDiagramSchema.parse({ root: 'n1', nodes: [{ id: 'n1', label: 'S', children: ['n2'] }, { id: 'n2', label: 'NP', children: [] }] });
  expect(legacy.kind).toBeUndefined();
  expect(layoutTree(legacy).edges[0].bend).toBeUndefined();
  expect(treeText(legacy)).toBe('[S NP]');
  expect(drawTree('公司\n  工程', 'constituency', lookup).kind).toBeUndefined();
});

it('uses the selected tree form for the blank root and the generated diagram', () => {
  expect(blankTree().nodes[0]?.label).toBe('S');
  expect(blankTree('dependency')).toMatchObject({ kind: 'dependency', form: 'dependency' });
  expect(blankTree('dependency').nodes[0]?.label).toBe('ROOT');
  expect(blankTree('xbar').nodes[0]?.label).toBe('TP');
  expect(blankTree('tag').nodes[0]?.label).toBe('S');
  expect(blankTree('ccg').nodes[0]?.label).toBe('S');
  expect(blankTree('feature').nodes[0]?.label).toBe('S|HEAD ?');
  const dependency = drawTree('the cat sat', 'dependency', lookup);
  expect(dependency.nodes.find(node => node.id === dependency.root)?.label).toBe('sat');
  expect(dependency.nodes.find(node => node.label === 'the')?.role).toBe('det');
  expect(dependency.nodes.find(node => node.label === 'cat')?.role).toBe('nsubj');
  expect(new Set(layoutTree(dependency).nodes.map(node => node.y)).size).toBe(1);
  expect(shape(drawTree('the cat sat', 'xbar', lookup))).toBe("(TP (NP (Det the) (N' (N cat))) (T' (T past) (VP (V' (V sat)))))");
  expect(shape(drawTree('the cat sat', 'xbar', lookup))).not.toMatch(/\b(?:JJ|NN|NNS|VBD|VBZ|DT|IN|RB|MD)\b/);
  expect(shape(drawTree('the cat sat', 'bare', lookup))).toBe('(T[past] (cat the cat) (T[past] T[past] sat))');
  expect(shape(drawTree('the cat sat', 'tag', lookup)).startsWith('(S ')).toBe(true);
  expect(shape(drawTree('the man who caught the ball is my uncle', 'tag', lookup)).startsWith('(S ')).toBe(true);
  expect(shape(drawTree('the cat sat', 'ast', lookup))).toBe('(S (NP the cat) (VP sat))');
  expect(shape(drawTree('the cat sat', 'ccg', lookup))).toBe('(S (NP the|NP/N cat|N) sat|S\\NP)');
  expect(layoutTree(drawTree('the cat sat', 'feature', lookup)).nodes.find(node => node.label.startsWith('S|'))?.height).toBeGreaterThan(44);
});

function relations(diagram: TreeDiagram) {
  const byId = new Map(diagram.nodes.map(node => [node.id, node]));
  const roles = new Map<string, string>();
  const walk = (id: string) => {
    const node = byId.get(id)!;
    // Look relations up by the word itself; a movement index is notation, not part of the word.
    if (node.role) roles.set(withoutIndex(node.label), node.role);
    node.children.forEach(walk);
  };
  walk(diagram.root);
  return { root: withoutIndex(byId.get(diagram.root)!.label), roles };
}

it('heads dependency trees on content words and names every relation', () => {
  const progressive = relations(drawTree('she is reading a book', 'dependency', lookup));
  expect(progressive.root).toBe('reading');
  expect(progressive.roles.get('is')).toBe('aux');
  expect(progressive.roles.get('she')).toBe('nsubj');
  expect(progressive.roles.get('book')).toBe('obj');
  const future = relations(drawTree('we will meet at the station tomorrow', 'dependency', lookup));
  expect(future.root).toBe('meet');
  expect(future.roles.get('will')).toBe('aux');
  expect(future.roles.get('station')).toBe('obl');
  expect(future.roles.get('at')).toBe('case');
  expect(future.roles.get('tomorrow')).toBe('advmod');
  const relative = relations(drawTree('the man who caught the ball is my uncle', 'dependency', lookup));
  expect(relative.root).toBe('uncle');
  expect(relative.roles.get('is')).toBe('cop');
  expect(relative.roles.get('caught')).toBe('acl:relcl');
  expect(relative.roles.get('who')).toBe('nsubj');
  // A word that opens a nominal after a verb is a preposition, not an adverb: "founded in 1999".
  expect(shape(drawTree('the city was founded in 1999'))).toContain('(PP (IN in) (NP (CD 1999)))');
  // A participle whose adjective senses are a minority is the passive it looks like.
  const founded = relations(drawTree('the city was founded', 'dependency'));
  expect(founded.roles.get('city')).toBe('nsubj:pass');
  expect(founded.roles.get('founded')).toBeFalsy();
  // Basic dependencies contain overt words, with the filler attached directly to its predicate.
  const movedTree = drawTree('the book which I read is old', 'dependency');
  expect(movedTree.nodes.some(node => isTraceLabel(node.label))).toBe(false);
  const filler = movedTree.nodes.find(node => node.label === 'which')!;
  const predicate = movedTree.nodes.find(node => node.label === 'read')!;
  expect(filler.role).toBe('obj');
  expect(predicate.children).toContain(filler.id);
  // A word ending in "-er" is a noun unless a comparison licenses the comparative reading.
  expect(shape(drawTree('the letter was written by my father', 'constituency', lookup))).toContain('(NP (DT the) (NN letter');
  expect(shape(drawTree('the water is cold', 'constituency', lookup))).toContain('(NN water)');
  expect(shape(drawTree('she is taller than me', 'constituency', lookup))).toContain('(JJR taller)');
  expect(shape(drawTree('she is much happier now', 'constituency', lookup))).toContain('(JJR happier)');
  // A passive clause names its subject and its agent, and a temporal phrase has its own subtype.
  const passive = relations(drawTree('the letter was written by my father', 'dependency', lookup));
  expect(passive.roles.get('letter')).toBe('nsubj:pass');
  expect(passive.roles.get('father')).toBe('obl:agent');
  expect(passive.roles.get('written')).toBeFalsy();
  const temporal = relations(drawTree('she has been working all day', 'dependency', lookup));
  expect(temporal.roles.get('day')).toBe('obl:unmarked');
  const year = relations(drawTree('the city was opened in 1999', 'dependency', lookup));
  expect(year.roles.get('1999')).toBe('obl');
  // A copular predicate keeps a plain subject: "were tired" is not a passive.
  const copular = relations(drawTree('they were very tired', 'dependency', lookup));
  expect(copular.roles.get('they')).toBe('nsubj');
  const complement = relations(drawTree('he said that the world is flat', 'dependency', lookup));
  expect(complement.root).toBe('said');
  expect(complement.roles.get('flat')).toBe('ccomp');
  expect(complement.roles.get('that')).toBe('mark');
  const coordinated = relations(drawTree('the children played and the parents talked', 'dependency', lookup));
  expect(coordinated.root).toBe('played');
  expect(coordinated.roles.get('talked')).toBe('conj');
  expect(coordinated.roles.get('and')).toBe('cc');
  const existential = relations(drawTree('there is a book on the table', 'dependency', lookup));
  expect(existential.root).toBe('is');
  expect(existential.roles.get('there')).toBe('expl');
  expect(existential.roles.get('book')).toBe('nsubj');
  const quantifier = relations(drawTree('the two cats sleep', 'dependency', lookup));
  expect(quantifier.root).toBe('sleep');
  expect(quantifier.roles.get('two')).toBe('nummod');
  const compound = relations(drawTree('she quickly opened the heavy wooden door', 'dependency', lookup));
  // "wooden" is an adjective, so it modifies the noun rather than forming a compound.
  expect(compound.roles.get('wooden')).toBe('amod');
  expect(compound.roles.get('quickly')).toBe('advmod');
  expect(relations(drawTree('the cat sat.', 'dependency', lookup)).roles.get('.')).toBe('punct');
  expect(relations(drawTree("John's book is on the table", 'dependency', lookup)).roles.get("'s")).toBe('case');
});

it('draws questions and ditransitive frames without inventing clause types', () => {
  // A fronted auxiliary heads SQ, and the declarative S wraps it so the root stays S.
  expect(shape(drawTree('did you see the film', 'constituency', lookup))).toBe('(S (SQ (VBD did) (NP (PRP you)) (VP (VB see) (NP (DT the) (NN film)))))');
  // A subject question does not invert, so the clause follows the wh-subject directly.
  expect(shape(drawTree('who wrote this letter', 'constituency', lookup))).toContain('(SBARQ (WHNP (WP who₁)) (S t₁ (VP (VBD wrote)');
  // An auxiliary alone is never a one-word clause.
  expect(shape(drawTree('what did you see', 'constituency', lookup))).not.toContain('(S (VP (VBD did)))');
  // Both objects stay under one VP, and a copula still takes only one predicate.
  expect(shape(drawTree('the teacher gave the students a book', 'constituency', lookup))).toContain('(VP (VBD gave) (NP (DT the) (NNS students)) (NP (DT a) (NN book)))');
  expect(shape(drawTree('she is reading a book', 'constituency', lookup))).toBe('(S (NP (PRP she)) (VP (VBZ is) (VP (VBG reading) (NP (DT a) (NN book)))))');
  const question = relations(drawTree('what did you see', 'dependency', lookup));
  expect(question.root).toBe('see');
  expect(question.roles.get('what')).toBe('obj');
  expect(question.roles.get('did')).toBe('aux');
  expect(relations(drawTree('who wrote this letter', 'dependency', lookup)).roles.get('who')).toBe('nsubj');
  // A complementizer introduces a clause; it never becomes a preposition with an object.
  expect(shape(drawTree('the book that I read is old', 'constituency', lookup))).toContain('(SBAR (IN that) (S (NP (PRP I)) (VP (VBD read)))))');
  expect(relations(drawTree('the book that I read is old', 'dependency', lookup)).roles.get('read')).toBe('acl');
});

it('keeps X-bar projections well formed for coordination, expletives and infinitives', () => {
  const xbar = (sentence: string) => shape(drawTree(sentence, 'xbar', lookup));
  // A question is one CP: the fronted auxiliary sits in C and no second C' is nested.
  expect(xbar('did you see the film')).toMatch(/^\(CP \(C' \(C did₁\) \(TP /);
  expect(xbar('did you see the film')).not.toContain("(C' (C ∅) (C'");
  expect(xbar('who wrote this letter')).toMatch(/^\(CP \(WhP /);
  // Final punctuation stays inside the clause, as in the constituency tree.
  expect(xbar('the cat sat.')).toContain("(T' (T past) (VP (V' (V sat)))) (. .))");
  // Coordination projects a conjunction phrase, not a TP over TP and CC.
  expect(xbar('the children played and the parents talked')).toMatch(/^\(ConjP \(TP /);
  expect(xbar('the children played and the parents talked')).toContain("(Conj' (Conj and) (TP ");
  // An expletive subject is a determiner in Spec-TP.
  expect(xbar('there is a book on the table')).toContain('(TP (D there) (T\' ');
  // The infinitival marker heads T rather than sitting inside V'.
  expect(xbar('she wants to read a book')).toContain("(T' (T to) (VP (V' (V read)");
  expect(xbar('she wants to read a book')).not.toContain('(V\' (T to)');
  // A small-clause complement keeps its subject and predicate: the clause body is not empty.
  expect(xbar('she told him to leave tomorrow')).toContain("(T' (T to) (VP (V' (V leave)");
  expect(xbar('she told him to leave tomorrow')).not.toContain("(C' (C ∅)))");
  // A pied-piped wh-prepositional phrase is the specifier of its clause.
  expect(xbar('the man with whom I spoke left')).toContain('(PP (P\' (P with)');
  expect(xbar('the question about what happened is open')).toContain('(PP (P\' (P about)');
  // A stacked auxiliary stays in the tense layer after another auxiliary raises to C.
  expect(xbar('can she have left')).toContain('(VP (V\' (V have) (VP (V\' (V left)))');
  expect(xbar('how long has she been waiting')).toContain('(V\' (V been)');
  // A negator between the subject and the verb stays inside the tense layer.
  expect(xbar('should she not leave')).toContain("(T' (T t₁) (AdvP (Adv' (Adv not))) (VP (V' (V leave)))");
  // A sentence adverb that precedes the auxiliary adjoins above the tense layer.
  expect(xbar('she certainly does not agree')).toContain('(TP (NP (N\' (N she))) (AdvP (Adv\' (Adv certainly))) (T\' (T does)');
  // Pre-head words keep their surface order; only the leftmost determiner is a specifier.
  expect(xbar('the first three tall students arrived')).toContain("(N' (A first) (N' (Num three) (N' (A tall) (N students)))");
  expect(xbar('a week or so passed')).not.toContain('ConjP');
  // An infinitival body never raises an inner auxiliary past its own "to".
  expect(xbar('she believed him to be honest')).toContain("(T' (T to) (VP (V' (V be)");
  // A coordination keeps the material in front of its first conjunct.
  expect(xbar('she did not sing or dance')).toContain('(AdvP');
  // An infinitival postmodifier stays with the nominal it modifies.
  expect(xbar('the book for him to read is here')).toContain("(NP (NP (Det the) (N' (N book))) (CP (C' (C for)");
  // A participle under an adjective phrase is an adjective.
  expect(xbar('they were very tired')).toContain("(A' (A tired))");
  // No bar level may dominate a whole phrase of the same projection.
  for (const sentence of ['we will meet at the station tomorrow', 'she reads books quickly']) expect(xbar(sentence)).not.toMatch(/V' \(VP /);
});

it('keeps derived phrase trees separate from elementary TAG tree kinds', () => {
  expect(shape(drawTree('she is reading a book', 'tag', lookup)).startsWith('(S ')).toBe(true);
  expect(shape(drawTree('we will meet at the station tomorrow', 'tag', lookup)).startsWith('(S ')).toBe(true);
  expect(shape(drawTree('the man who caught the ball is my uncle', 'tag', lookup)).startsWith('(S ')).toBe(true);
  expect(shape(drawTree('the book on the table is old', 'tag', lookup)).startsWith('(S ')).toBe(true);
  expect(shape(drawTree('the children played and the parents talked', 'tag', lookup)).startsWith('(S ')).toBe(true);
});

it('keeps bare-phrase order and abstracts only surface detail for AST', () => {
  expect(shape(drawTree('the children played and the parents talked', 'bare', lookup))).toBe('(and (T[past] (children the children) (T[past] T[past] played)) (and and (T[past] (parents the parents) (T[past] T[past] talked))))');
  // The auxiliary is the syntactic head of the clause, so bare structure labels it, not the participle.
  expect(shape(drawTree('she is reading a book', 'bare', lookup))).toBe('(is she (is is₁ (t t₁ (reading reading (book a book)))))');
  expect(shape(drawTree('there is a book on the table', 'bare', lookup))).toBe('(is there (is is₁ (t (t t₁ (book a book)) (on on (table the table)))))');
  // AST keeps every word but drops punctuation and the part-of-speech layer.
  expect(shape(drawTree('the cat sat.', 'ast', lookup))).toBe('(S (NP the cat) (VP sat))');
  expect(shape(drawTree('she is reading a book', 'ast', lookup))).toBe('(S (NP she) (VP is (VP reading (NP a book))))');
  // A concrete syntax tree keeps every token and tag.
  expect(shape(drawTree('the cat sat.', 'cst', lookup))).toBe('(S (NP (DT the) (NN cat)) (VP (VBD sat)) (. .))');
});

it('uses the syntactic head in feature structures so a projection names its own head', () => {
  const feature = (sentence: string) => shape(drawTree(sentence, 'feature', lookup));
  expect(feature('she is reading a book')).toContain('(S|HEAD is (NP|HEAD she');
  expect(feature('she is reading a book')).toContain('(VP|HEAD is is|V (VP|HEAD reading');
  expect(feature('there is a book on the table')).toContain('(S|HEAD is');
  expect(feature('the man who caught the ball is my uncle')).toContain('(S|HEAD is');
});

it('combines CCG categories only through real applications', () => {
  const ccg = (sentence: string) => shape(drawTree(sentence, 'ccg', lookup));
  expect(ccg('the cat sat')).toBe('(S (NP the|NP/N cat|N) sat|S\\NP)');
  expect(ccg('she is reading a book')).toContain('is|(S\\NP)/(S\\NP)');
  expect(ccg('she is reading a book')).toContain('reading|(S\\NP)/NP');
  // A coordinator is (X\X)/X, not a bare part-of-speech tag.
  expect(ccg('the children played and the parents talked')).toContain('and|(X\\X)/X');
  // A pre-verbal adverb is a forward modifier; a post-verbal one is a backward modifier.
  expect(ccg('she quickly opened the heavy wooden door')).toContain('quickly|(S\\NP)/(S\\NP)');
  expect(ccg('she reads books quickly')).toContain('quickly|(S\\NP)\\(S\\NP)');
  // A preposition takes its object and inherits the use of its phrase.
  expect(ccg('the cat sat on the mat')).toContain('on|((S\\NP)\\(S\\NP))/NP');
  expect(ccg('the book on the table is old')).toContain('on|(NP\\NP)/NP');
  // A predicative adjective is a verb phrase, not a nominal modifier.
  expect(ccg('she is very happy')).toContain('happy|S\\NP');
  expect(ccg('she is very happy')).toContain('very|(S\\NP)/(S\\NP)');
  // The genitive clitic behaves like a determiner.
  expect(ccg("John's book is on the table")).toContain("'s|(NP/N)\\NP");
});

it('names a saved or exported diagram after its own sentence', () => {
  // Words keep their surface order and are joined by hyphens; final punctuation is dropped.
  expect(treeFileName(drawTree('the cat sat on the mat.', 'constituency', lookup))).toBe('the-cat-sat-on-the-mat');
  expect(treeFileName(drawTree('the man who caught the ball is my uncle', 'constituency', lookup))).toBe('the-man-who-caught-the-ball-is-my-uncle');
  // Every presentation keeps the same words, including ones whose leaves carry a category.
  for (const form of ['xbar', 'tag', 'cst', 'ast', 'ccg', 'feature', 'dependency'] as const) {
    expect(treeFileName(drawTree('the cat sat on the mat', form)), form).toBe('the-cat-sat-on-the-mat');
  }
  // An X-bar tense feature and an empty complementizer are not sentence words.
  expect(treeFileName(drawTree('the man who caught the ball is my uncle', 'xbar', lookup))).toBe('the-man-who-caught-the-ball-is-my-uncle');
  // Bare phrase structure retains the lexical frontier in surface order.
  expect(treeFileName(drawTree('the cat sat on the mat', 'bare', lookup))).toBe('the-cat-sat-on-the-mat');
  expect(sentenceFileName('the cat sat on the mat')).toBe('the-cat-sat-on-the-mat');
  // The typed sentence covers the same case with its real order.
  expect(sentenceFileName('The cat sat on the mat.')).toBe('The-cat-sat-on-the-mat');
  expect(sentenceFileName('(S (NP the))')).toBeUndefined();
  expect(sentenceFileName('S\n  NP')).toBeUndefined();
  expect(sentenceFileName('   ')).toBeUndefined();
  expect(sentenceFileName('cat')).toBeUndefined();
  expect(sentenceFileName('the two cats sleep')).toBe('the-two-cats-sleep');
  // Written brackets and outlines use the labels that were typed.
  expect(treeFileName(drawTree('(S (NP (DT the) (NN cat)) (VP (VBD sat)))'))).toBe('the-cat-sat');
  expect(treeFileName(drawTree('[Company [Engineering [Frontend] [Backend]] [Design]]', 'constituency', lookup))).toBe('Frontend-Backend-Design');
  // A clitic is its own token in the drawing, so it rejoins the word it belongs to.
  expect(treeFileName(drawTree("John's book is on the table", 'ccg', lookup))).toBe("John's-book-is-on-the-table");
  expect(treeFileName(drawTree("John's book is on the table", 'constituency', lookup))).toBe("John's-book-is-on-the-table");
  expect(sentenceFileName("John's book is on the table")).toBe("John's-book-is-on-the-table");
  expect(treeFileName(drawTree("we don't read books", 'constituency', lookup))).toBe("we-don't-read-books");
  // A dependency row with a spaced word becomes two hyphenated parts.
  expect(treeFileName(drawTree('1 New_York 2 nsubj\n2 sat 0 root', 'constituency', lookup))).toBe('New-York-sat');
  // A blank or wordless board keeps the neutral fallback.
  expect(treeFileName(blankTree())).toBe('syntax-tree');
  expect(treeFileName(blankTree('dependency'))).toBe('syntax-tree');
  // The name is capped well inside the 80-character limit the dialog allows.
  const long = treeFileName(drawTree('the students read the old book in the quiet library and the teachers wrote a long letter to the new parents', 'constituency', lookup));
  expect(long.length).toBeLessThanOrEqual(80);
  expect(long.startsWith('the-students-read-the-old-book')).toBe(true);
  expect(long.endsWith('-')).toBe(false);
});

it('draws pied-piped wh-phrases and demonstrative objects', () => {
  // A preposition travels with its wh-phrase, so the question frame takes a WHPP.
  expect(shape(drawTree('To what extent do you agree with the opinion', 'constituency', lookup))).toBe('(S (SBARQ (PP (IN To) (WHNP (WDT what₁) (NOM (NN extent)))) (SQ (VBP do) (NP (PRP you)) (VP (VB agree) (PP (IN with) (NP (DT the) (NN opinion))) (PP t₁)))))');
  expect(shape(drawTree('with whom did you speak', 'constituency', lookup))).toBe('(S (SBARQ (PP (IN with) (WHNP (WP whom₁))) (SQ (VBD did) (NP (PRP you)) (VP (VB speak) (PP t₁)))))');
  expect(shape(drawTree('in what way does it matter', 'constituency', lookup))).toContain('(SBARQ (PP (IN in) (WHNP (WDT what₁) (NOM (NN way)))) (SQ ');
  // A relative clause can pied-pipe too: (SBAR (WHPP ...) (S ...)).
  // A pied-piped relative leaves an adverbial trace coindexed with the wh-noun.
  const relativeCity = shape(drawTree('the city in which I live is old', 'constituency', lookup));
  expect(relativeCity).toContain('(WHNP (WDT which');
  expect(relativeCity).toContain('(VP (VBP live) (PP t');
  // A demonstrative is a determiner by tag but a pronoun when it stands alone as a nominal.
  expect(shape(drawTree('what do you think about this', 'constituency', lookup))).toContain('(PP (IN about) (NP (DT this)))');
  expect(shape(drawTree('the book on that is old', 'constituency', lookup))).toContain('(NP (DT that))');
  // A personal wh-pronoun is never the head of a nominal: "with whom she works" keeps its subject.
  // A pied-piped relative leaves an adverbial trace coindexed with the wh-noun.
  const piedRelative = shape(drawTree('the man with whom she works is kind', 'constituency', lookup));
  expect(piedRelative).toContain('(WHPP (IN with) (WHNP (WP whom');
  expect(piedRelative).toContain('(VP (VBZ works) (PP t');
  // Every presentation accepts each script.
  for (const form of ['xbar', 'bare', 'tag', 'cst', 'ast', 'ccg', 'feature', 'dependency'] as const) {
    expect(() => drawTree('To what extent do you agree with the opinion', form), form).not.toThrow();
    expect(() => drawTree('the city in which I live is old', form), form).not.toThrow();
  }
});

it('keeps a pied-piped wh-phrase coherent in the phrase views', () => {
  const xbar = shape(drawTree('To what extent do you agree with the opinion', 'xbar', lookup));
  // The fronted constituent is a PP whose head is the preposition, and the clause is one CP.
  expect(xbar).toMatch(/^\(CP .*\(PP \(P' \(P To\) \(WhP /);
  expect(xbar).toContain("(WhP (Wh' (Wh what₁) (N' (N extent))))");
  expect(xbar).not.toContain('NOM');
  // The raised auxiliary occupies C and leaves its coindexed T position.
  expect(xbar).toContain("(C' (C do₂) (TP ");
  const feature = shape(drawTree('To what extent do you agree with the opinion', 'feature', lookup));
  expect(feature).toContain('To|P');
  expect(feature).not.toContain('To|T');
  const ccg = shape(drawTree('with whom did you speak', 'ccg', lookup));
  expect(ccg).toContain('with|(S/(S/PP))/NP');
  expect(ccg).toContain('whom|NP');
  const relative = shape(drawTree('the man with whom she works is kind', 'ccg', lookup));
  expect(relative).toContain('with|((NP\\NP)/(S/PP))/NP');
  // A relative pronoun keeps the modifier category when it is the subject of its own clause.
  expect(shape(drawTree('the man who caught the ball is my uncle', 'ccg', lookup))).toContain('who|(NP\\NP)/(S\\NP)');
  const dependency = relations(drawTree('To what extent do you agree with the opinion', 'dependency', lookup));
  expect(dependency.root).toBe('agree');
  expect(dependency.roles.get('extent')).toBe('obl');
  expect(dependency.roles.get('To')).toBe('case');
  expect(dependency.roles.get('what')).toBe('det');
  const pied = relations(drawTree('the city in which I live is old', 'dependency', lookup));
  const piedRole = (prefix: string) => [...pied.roles].find(([label]) => label.startsWith(prefix))?.[1];
  expect(piedRole('which')).toBe('obl');
  expect(piedRole('in')).toBe('case');
  expect(pied.roles.get('live')).toBe('acl:relcl');
});


it('opens on a capitalized example with a subject relative and a copular predicate', () => {
  expect(exampleSentence).toBe('The man who caught the ball is my uncle');
  const expected = '(S (NP (NP (DT The) (NN man)) (SBAR (WHNP (WP who₁)) (S t₁ (VP (VBD caught) (NP (DT the) (NN ball)))))) (VP (VBZ is) (NP (PRP$ my) (NN uncle))))';
  expect(shape(exampleTree())).toBe(expected);
  expect(shape(drawTree(exampleSentence, 'constituency', lookup))).toBe(expected);
  for (const form of treeForms) expect(exampleTree(form)).toEqual(drawTree(exampleSentence, form, lookup));
  const dependency = exampleTree('dependency');
  const byWord = new Map(dependency.nodes.map(node => [node.label, node]));
  expect(dependency.nodes.find(node => node.id === dependency.root)?.label).toBe('uncle');
  for (const [word, head, role] of [
    ['The', 'man', 'det'], ['man', 'uncle', 'nsubj'], ['who', 'caught', 'nsubj'],
    ['caught', 'man', 'acl:relcl'], ['the', 'ball', 'det'], ['ball', 'caught', 'obj'],
    ['is', 'uncle', 'cop'], ['my', 'uncle', 'nmod:poss'],
  ]) {
    expect(byWord.get(word)?.role, word).toBe(role);
    expect(byWord.get(head)?.children, word).toContain(byWord.get(word)?.id);
  }
});
