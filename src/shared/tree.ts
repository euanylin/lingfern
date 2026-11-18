import { movementStrokes, separateMovementStrokes } from './tree-movement-strokes';
import { deflateSync } from 'fflate';
import { z } from 'zod';
import { tidyTreeLayout, type TidyInput } from './tidy-tree';
import { parseTaggedSentence } from './tree-parse';
import { auxiliaryKey } from './tree-auxiliary';
import type { PosLookup } from './wordnet-pos';
import { isTraceLabel, labelIndex, movementPairs, nextIndex, normalizeMovementLabel, normalizeTreeInput, withIndex, withoutIndex } from './tree-movement';
import { presentTree, phraseDependencies, rowsToDependency, type RawNode, type TreeForm } from './tree-forms';
export type { TreeForm } from './tree-forms';

// Structural bounds exist only to keep memory and recursion predictable; they sit far above any
// real syntax tree (a large treebank sentence has well under 100 nodes).
const maxNodes = 5000;
const maxChildren = maxNodes;
const maxDepth = 1000;
const maxLabel = 200;
const maxRole = 80;
const nodeHeight = 44;
const gapX = 16;
const gapY = 28;
const pad = 20;
const labelSchema = z.string().trim().min(1).max(maxLabel).regex(/^[^\p{C}]+$/u);
const roleSchema = z.string().trim().min(1).max(maxRole).regex(/^[^\p{C}]+$/u);
const nodeIdSchema = z.string().regex(/^[a-z0-9]{1,10}$/);
const nodeSchema = z.object({
  id: nodeIdSchema,
  label: labelSchema,
  children: z.array(nodeIdSchema).max(maxChildren),
  role: roleSchema.optional(),
  order: z.number().int().min(0).max(999999).optional(),
}).strict();

export const treeDiagramSchema = z.object({
  nodes: z.array(nodeSchema).min(1).max(maxNodes),
  root: nodeIdSchema,
  kind: z.enum(['phrase', 'dependency']).optional(),
  form: z.enum(['constituency', 'dependency', 'xbar', 'bare', 'tag', 'cst', 'ast', 'ccg', 'feature']).optional(),
}).strict().superRefine((diagram, ctx) => {
  const byId = new Map<string, z.infer<typeof nodeSchema>>();
  for (const node of diagram.nodes) {
    if (byId.has(node.id)) { ctx.addIssue({ code: 'custom', message: 'Duplicate tree node' }); return; }
    byId.set(node.id, node);
  }
  if (!byId.has(diagram.root)) { ctx.addIssue({ code: 'custom', message: 'Missing tree root' }); return; }
  const parent = new Set<string>();
  for (const node of diagram.nodes) {
    const seen = new Set<string>();
    for (const child of node.children) {
      if (!byId.has(child) || seen.has(child) || parent.has(child) || child === diagram.root) { ctx.addIssue({ code: 'custom', message: 'Invalid tree link' }); return; }
      seen.add(child);
      parent.add(child);
    }
  }
  const reached = new Set<string>();
  const walk = (id: string, depth: number): boolean => {
    if (depth > maxDepth) { ctx.addIssue({ code: 'custom', message: 'Tree too deep' }); return false; }
    if (reached.has(id)) { ctx.addIssue({ code: 'custom', message: 'Cyclic tree' }); return false; }
    reached.add(id);
    return byId.get(id)!.children.every(child => walk(child, depth + 1));
  };
  if (!walk(diagram.root, 0) || reached.size !== diagram.nodes.length) ctx.addIssue({ code: 'custom', message: 'Disconnected tree' });
});
export type TreeDiagram = z.infer<typeof treeDiagramSchema>;
export const treeForms = ['constituency', 'dependency', 'xbar', 'bare', 'tag', 'cst', 'ast', 'ccg', 'feature'] as const;
export const treeFormRoot: Record<TreeForm, string> = {
  constituency: 'S',
  dependency: 'ROOT',
  xbar: 'TP',
  bare: 'v',
  tag: 'S',
  cst: 'S',
  ast: 'S',
  ccg: 'S',
  feature: 'S|HEAD ?',
};
function carry(diagram: Pick<TreeDiagram, 'kind' | 'form'>) {
  return { ...(diagram.kind ? { kind: diagram.kind } : {}), ...(diagram.form ? { form: diagram.form } : {}) };
}
type Raw = RawNode;
type TreePoint = { x: number; y: number };
export type TreeLayout = {
  width: number;
  height: number;
  nodes: { id: string; label: string; x: number; y: number; width: number; height: number }[];
  edges: { x1: number; y1: number; x2: number; y2: number; label?: string; bend?: number; level?: number; arrow?: boolean; movement?: boolean; headHalfWidth?: number; rail?: number; points?: TreePoint[]; strokes?: TreePoint[][] }[];
};

const round = (value: number) => Math.round(value * 100) / 100;

export function treeEdgeLabelPoint(edge: TreeLayout['edges'][number]): TreePoint {
  return {
    x: round((edge.x1 + edge.x2) / 2),
    y: round(edge.bend ? Math.min(edge.y1, edge.y2) - edge.bend * .72 : (edge.y1 + edge.y2) / 2),
  };
}

export function labelLines(label: string) {
  const lines = label.split('|').map(line => line.trim()).filter(Boolean);
  return lines.length > 1 ? lines : [label];
}

// Advance widths for `600 16px system-ui` in whole pixels (U+0020 through U+007E), measured once
// so server and client compute identical layout; other characters use the CJK-ish width below.
const textWidths = [4, 6, 9, 11, 11, 16, 12, 5, 7, 7, 8, 11, 5, 8, 5, 5, 11, 8, 10, 11, 11, 11, 11, 10, 11, 11, 5, 5, 11, 11, 11, 9, 15, 12, 11, 12, 12, 10, 10, 12, 12, 5, 9, 11, 10, 14, 12, 13, 11, 13, 11, 11, 11, 12, 11, 16, 12, 11, 11, 7, 5, 7, 11, 10, 8, 9, 10, 9, 10, 10, 7, 10, 10, 10, 5, 5, 10, 5, 15, 10, 10, 10, 10, 7, 9, 7, 10, 9, 13, 9, 9, 9, 7, 5, 7, 11];

export function estimateLabelWidth(label: string) {
  let widest = 0;
  for (const line of label.split('|')) {
    let width = 0;
    for (const char of line.trim()) {
      const code = char.codePointAt(0) ?? 0;
      width += code >= 32 && code <= 126 ? textWidths[code - 32] : 16;
    }
    widest = Math.max(widest, width);
  }
  return Math.max(nodeHeight, widest + 32);
}

export function blankTree(form: TreeForm = 'constituency'): TreeDiagram {
  const label = treeFormRoot[form];
  return treeDiagramSchema.parse({
    root: 'n1',
    form,
    ...(form === 'dependency' ? { kind: 'dependency' as const } : {}),
    nodes: [{ id: 'n1', label, children: [], ...(form === 'dependency' ? { order: 0 } : {}) }],
  });
}

export function isClearedTree(diagram: TreeDiagram, source: string, form: TreeForm) {
  return !source.trim() && diagram.nodes.length === 1 && diagram.nodes[0].label === treeFormRoot[form];
}

// The page opens on one short worked example instead of an empty root label, so a visitor sees what
// a drawing looks like. It carries a subject, a relative clause and a copular predicate, which every
// presentation can show and which makes the nine types visibly different from each other. It parses
// from the built-in word lists, so the drawing is identical on the server and after hydration.
export const exampleSentence = 'The man who caught the ball is my uncle';

export function exampleTree(form: TreeForm = 'constituency'): TreeDiagram {
  try { return drawTree(exampleSentence, form); } catch { return blankTree(form); }
}

function clone(diagram: TreeDiagram): TreeDiagram {
  return {
    root: diagram.root,
    ...carry(diagram),
    nodes: diagram.nodes.map(node => ({
      id: node.id,
      label: node.label,
      children: [...node.children],
      ...(node.role ? { role: node.role } : {}),
      ...(node.order !== undefined ? { order: node.order } : {}),
    })),
  };
}

function freshId(nodes: { id: string }[]) {
  const used = new Set(nodes.map(node => node.id));
  for (let index = 1; index <= maxNodes; index++) if (!used.has(`n${index}`)) return `n${index}`;
  throw new Error('TREE_TOO_BIG');
}

// Depth of every node, computed without recursion so very deep trees stay safe.
function depths(diagram: TreeDiagram) {
  const byId = new Map(diagram.nodes.map(node => [node.id, node]));
  const result = new Map<string, number>();
  const stack: [string, number][] = [[diagram.root, 0]];
  while (stack.length) {
    const [id, depth] = stack.pop()!;
    if (result.has(id) || depth > maxDepth) continue;
    result.set(id, depth);
    for (const child of byId.get(id)?.children ?? []) stack.push([child, depth + 1]);
  }
  return result;
}

function subtreeHeight(diagram: TreeDiagram, id: string) {
  const byId = new Map(diagram.nodes.map(node => [node.id, node]));
  let height = 0;
  const stack: [string, number][] = [[id, 0]];
  const seen = new Set<string>();
  while (stack.length) {
    const [current, depth] = stack.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    height = Math.max(height, depth);
    for (const child of byId.get(current)?.children ?? []) stack.push([child, depth + 1]);
  }
  return height;
}

export function labelAllowed(label: string) {
  const next = normalizeMovementLabel(label);
  return Boolean(next) && next.length <= maxLabel && !/\p{C}/u.test(next);
}

/**
 * Coindexes two nodes as a movement pair: the moved constituent and the trace it left behind. The
 * shared index is what the drawing uses to place the movement arrow, so a learner can mark a
 * movement by hand exactly the way the automatic analysis does it.
 */
export function linkMovement(diagram: TreeDiagram, firstId: string, secondId: string) {
  if (firstId === secondId) throw new Error('TREE_MOVE_SELF');
  const first = diagram.nodes.find(node => node.id === firstId);
  const second = diagram.nodes.find(node => node.id === secondId);
  if (!first || !second) throw new Error('TREE_MOVE_MISSING');
  const index = nextIndex(diagram.nodes.map(node => node.label));
  return treeDiagramSchema.parse({
    ...carry(diagram),
    root: diagram.root,
    nodes: diagram.nodes.map(node => node.id === firstId || node.id === secondId ? { ...node, label: withIndex(node.label, index) } : node),
  });
}

/** Removes a movement index from a node and from whatever it was coindexed with. */
export function unlinkMovement(diagram: TreeDiagram, id: string) {
  const node = diagram.nodes.find(item => item.id === id);
  if (!node) throw new Error('TREE_MOVE_MISSING');
  const index = labelIndex(node.label);
  if (index === undefined) return diagram;
  return treeDiagramSchema.parse({
    ...carry(diagram),
    root: diagram.root,
    nodes: diagram.nodes.map(item => labelIndex(item.label) === index ? { ...item, label: withoutIndex(item.label) } : item),
  });
}

export function renameNode(diagram: TreeDiagram, id: string, label: string) {
  const next = normalizeMovementLabel(label);
  return treeDiagramSchema.parse({ ...carry(diagram), root: diagram.root, nodes: diagram.nodes.map(node => node.id === id ? { ...node, label: next } : node) });
}

export function addChild(diagram: TreeDiagram, parentId: string, label = 'X') {
  const next = clone(diagram);
  const parent = next.nodes.find(node => node.id === parentId);
  if (!parent || next.nodes.length >= maxNodes || parent.children.length >= maxChildren) throw new Error('TREE_TOO_BIG');
  if ((depths(diagram).get(parentId) ?? 0) + 1 > maxDepth) throw new Error('TREE_TOO_BIG');
  const id = freshId(next.nodes);
  parent.children.push(id);
  const order = diagram.kind === 'dependency' ? Math.max(0, ...next.nodes.map(node => node.order ?? 0)) + 1 : undefined;
  next.nodes.push({ id, label, children: [], ...(order !== undefined ? { order, role: 'dep' } : {}) });
  return treeDiagramSchema.parse(next);
}

export function addSibling(diagram: TreeDiagram, id: string, label = 'X') {
  const next = clone(diagram);
  const parent = next.nodes.find(node => node.children.includes(id));
  if (!parent || next.nodes.length >= maxNodes || parent.children.length >= maxChildren) throw new Error('TREE_TOO_BIG');
  if ((depths(diagram).get(parent.id) ?? 0) + 1 > maxDepth) throw new Error('TREE_TOO_BIG');
  const sibling = freshId(next.nodes);
  parent.children.splice(parent.children.indexOf(id) + 1, 0, sibling);
  const order = diagram.kind === 'dependency' ? Math.max(0, ...next.nodes.map(node => node.order ?? 0)) + 1 : undefined;
  next.nodes.push({ id: sibling, label, children: [], ...(order !== undefined ? { order, role: 'dep' } : {}) });
  return treeDiagramSchema.parse(next);
}

export function removeNode(diagram: TreeDiagram, id: string) {
  if (id === diagram.root) return diagram;
  const byId = new Map(diagram.nodes.map(node => [node.id, node]));
  const drop = new Set<string>();
  const walk = (current: string) => { drop.add(current); for (const child of byId.get(current)?.children ?? []) walk(child); };
  walk(id);
  return treeDiagramSchema.parse({
    ...carry(diagram),
    root: diagram.root,
    nodes: diagram.nodes.filter(node => !drop.has(node.id)).map(node => ({ ...node, children: node.children.filter(child => !drop.has(child)) })),
  });
}

export function moveNode(diagram: TreeDiagram, id: string, direction: -1 | 1) {
  if (diagram.kind === 'dependency') return moveDependency(diagram, id, direction);
  const next = clone(diagram);
  const parent = next.nodes.find(node => node.children.includes(id));
  if (!parent) return diagram;
  const index = parent.children.indexOf(id), target = index + direction;
  if (target < 0 || target >= parent.children.length) return diagram;
  [parent.children[index], parent.children[target]] = [parent.children[target], parent.children[index]];
  return treeDiagramSchema.parse(next);
}

export function orderedDependencyNodes(diagram: TreeDiagram) {
  return [...diagram.nodes].sort((left, right) => (left.order ?? 0) - (right.order ?? 0) || left.id.localeCompare(right.id));
}

function moveDependency(diagram: TreeDiagram, id: string, direction: -1 | 1) {
  const ordered = orderedDependencyNodes(diagram);
  const index = ordered.findIndex(node => node.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ordered.length) return diagram;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  const positions = new Map(ordered.map((node, index) => [node.id, index + 1]));
  return treeDiagramSchema.parse({ ...diagram, nodes: diagram.nodes.map(node => ({ ...node, order: positions.get(node.id) })) });
}

function containsNode(diagram: TreeDiagram, id: string, target: string) {
  const byId = new Map(diagram.nodes.map(node => [node.id, node]));
  const stack = [id];
  const seen = new Set<string>();
  while (stack.length) {
    const current = stack.pop()!;
    if (current === target) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(byId.get(current)?.children ?? []));
  }
  return false;
}

// Drop rules follow hierplane: a sibling drop reorders, any other drop reparents.
// A node cannot land on itself, its parent, or its own descendant.
export function canDropNode(diagram: TreeDiagram, fromId: string, toId: string) {
  if (!fromId || !toId || fromId === toId || fromId === diagram.root || containsNode(diagram, fromId, toId)) return false;
  const parent = diagram.nodes.find(node => node.children.includes(fromId));
  if (!parent || parent.id === toId) return false;
  if (parent.children.includes(toId)) return true;
  const target = diagram.nodes.find(node => node.id === toId);
  if (!target || target.children.length >= maxChildren) return false;
  // Reparenting must not push the moved subtree past the depth bound.
  return (depths(diagram).get(toId) ?? 0) + 1 + subtreeHeight(diagram, fromId) <= maxDepth;
}

export function reorderTo(diagram: TreeDiagram, id: string, targetId: string) {
  if (!canDropNode(diagram, id, targetId)) return diagram;
  const next = clone(diagram);
  const parent = next.nodes.find(node => node.children.includes(id));
  if (!parent?.children.includes(targetId)) return diagram;
  const from = parent.children.indexOf(id), to = parent.children.indexOf(targetId);
  const [moved] = parent.children.splice(from, 1);
  parent.children.splice(to, 0, moved);
  return treeDiagramSchema.parse(next);
}

export function reparentNode(diagram: TreeDiagram, id: string, nextParentId: string) {
  if (!canDropNode(diagram, id, nextParentId)) return diagram;
  const next = clone(diagram);
  const current = next.nodes.find(node => node.children.includes(id));
  const target = next.nodes.find(node => node.id === nextParentId);
  if (!current || !target || current.children.includes(nextParentId)) return diagram;
  current.children = current.children.filter(child => child !== id);
  target.children.push(id);
  return treeDiagramSchema.parse(next);
}

function writeLabel(label: string, role?: string) {
  const text = role ? `${label}@${role}` : label;
  return /[\s()[\]"]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function treeText(diagram: TreeDiagram) {
  if (diagram.kind === 'dependency') return dependencyText(diagram);
  const byId = new Map(diagram.nodes.map(node => [node.id, node]));
  const write = (id: string): string => {
    const node = byId.get(id)!;
    const label = writeLabel(node.label, node.role);
    return node.children.length ? `[${label} ${node.children.map(write).join(' ')}]` : label;
  };
  return write(diagram.root);
}

function dependencyText(diagram: TreeDiagram) {
  const ordered = orderedDependencyNodes(diagram);
  const index = new Map(ordered.map((node, position) => [node.id, position + 1]));
  const heads = new Map(diagram.nodes.flatMap(node => node.children.map(child => [child, index.get(node.id)] as const)));
  return ordered.map(node => {
    const head = heads.get(node.id) ?? 0;
    const word = node.label.includes(' ') ? node.label.replaceAll(' ', '_') : node.label;
    return `${index.get(node.id)} ${word} ${head} ${node.role ?? (head ? 'dep' : 'root')}`;
  }).join('\n');
}

export function parentId(diagram: TreeDiagram, id: string) {
  return diagram.nodes.find(node => node.children.includes(id))?.id;
}

// A view can draw a feature where a word would be: T carries a tense feature (`past`) when no
// auxiliary raised, and an empty complementizer is `∅`. Neither belongs to the sentence.
const tenseFeatures = new Set(['past', 'pres', 'inf', 'modal']);
const isFeature = (label: string, parent: string | undefined) => label === '∅' || /^(?:T\[(?:past|pres|inf|modal)\]|C\[∅\])$/u.test(label) || (parent === 'T' && tenseFeatures.has(label));

// Words in surface order: a phrase tree reads its leaves, a dependency tree its ordered words.
function surfaceWords(diagram: TreeDiagram) {
  if (diagram.kind === 'dependency') return orderedDependencyNodes(diagram).map(node => node.label);
  const byId = new Map(diagram.nodes.map(node => [node.id, node]));
  const words: string[] = [];
  const walk = (id: string, parent?: string) => {
    const node = byId.get(id);
    if (!node) return;
    // A movement trace is not a word of the sentence, and a moved constituent's index is notation.
    if (!node.children.length) {
      if (isFeature(node.label, parent) || isTraceLabel(node.label)) return;
      words.push(withoutIndex(node.label));
      return;
    }
    for (const child of node.children) walk(child, node.label);
  };
  walk(diagram.root);
  return words;
}

const punctuationOnly = /^[^\p{L}\p{N}]+$/u;

// Words become a hyphenated file stem, dropping characters a filename cannot hold. A clitic such
// as `'s` or `n't` is its own token in a drawing, so it rejoins the word it belongs to.
function fileNameStem(words: readonly string[], limit: number) {
  const cleaned = words
    .flatMap(word => word.split(/\s+/u))
    .map(word => word.replace(/[<>:"/\\|?*\p{C}]/gu, '').replace(/^[.-]+|[.-]+$/gu, ''))
    .filter(word => word && !punctuationOnly.test(word));
  const kept: string[] = [];
  for (const word of cleaned) {
    const clitic = /^(?:n't|['’])/u.test(word);
    if (clitic && kept.length) {
      const joined = [...kept.slice(0, -1), kept.at(-1)! + word];
      if (joined.join('-').length > limit) break;
      kept[kept.length - 1] += word;
      continue;
    }
    if (kept.length && [...kept, word].join('-').length > limit) break;
    kept.push(word);
  }
  return kept;
}

// A saved or exported diagram is named after its own sentence: every word in surface order, joined
// by hyphens. Presented views carry a category after a bar (`the|Det`), so only the word is kept.
export function treeFileName(diagram: TreeDiagram, fallback = 'syntax-tree', limit = 80) {
  const words = surfaceWords(diagram).map(word => word.split('|')[0]!);
  const kept = fileNameStem(words, limit);
  return kept.length > 1 ? kept.join('-') : fallback;
}

// The sentence that was typed, when the field holds words rather than brackets or an outline.
export function sentenceFileName(text: string, limit = 80) {
  const trimmed = text.trim();
  if (!trimmed || isWrittenTreeInput(trimmed)) return;
  const kept = fileNameStem(trimmed.split(/\s+/u), limit);
  return kept.length > 1 ? kept.join('-') : undefined;
}

// Try near-endpoint paths before using the reserved bottom rail.
function shortenMovement(edge: TreeLayout['edges'][number], nodes: TreeLayout['nodes'], movements: TreeLayout['edges'], branches: TreeLayout['edges']) {
  const { x1, y1, x2, y2 } = edge;
  const drop = 18;
  const bottom = Math.max(y1, y2) + drop;
  if (bottom + gapY > edge.rail!) return;
  const left = Math.min(x1, x2) - nodeHeight, right = Math.max(x1, x2) + nodeHeight;
  const lastLocalRail = Math.min(bottom + nodeHeight + gapY + drop, edge.rail! - gapY);
  const clearance = 4;
  const nearby = nodes.filter(node => node.y <= lastLocalRail + clearance && node.y + node.height >= Math.min(y1, y2)
    && node.x <= right && node.x + node.width >= left);
  const otherSegments = movements.filter(other => other !== edge).flatMap(other =>
    other.points!.slice(1).map((point, index) => [other.points![index], point] as const));
  const overlaps = (a: number, b: number, c: number, d: number) =>
    Math.max(Math.min(a, b), Math.min(c, d)) < Math.min(Math.max(a, b), Math.max(c, d));
  const start = { x: x1, y: y1 }, end = { x: x2, y: y2 };
  const routeClear = (points: NonNullable<typeof edge.points>) => points.slice(1).every((to, index) => {
    const from = points[index];
    const vertical = from.x === to.x;
    if (!vertical && branches.some(branch => {
      if (from.y < branch.y1 || from.y > branch.y2) return false;
      const x = branch.x1 + (branch.x2 - branch.x1) * (from.y - branch.y1) / (branch.y2 - branch.y1);
      return Math.min(from.x, to.x) <= x && x <= Math.max(from.x, to.x);
    })) return false;
    return !nearby.some(box => vertical
      ? from.x > box.x && from.x < box.x + box.width && overlaps(from.y, to.y, box.y, box.y + box.height)
      : from.y > box.y - clearance && from.y < box.y + box.height + clearance && overlaps(from.x, to.x, box.x, box.x + box.width))
      && !otherSegments.some(([a, b]) => vertical
        ? a.x === b.x && a.x === from.x && overlaps(from.y, to.y, a.y, b.y)
        : a.y === b.y && a.y === from.y && overlaps(from.x, to.x, a.x, b.x));
  });

  if (x1 !== x2) {
    for (let y = bottom; y <= lastLocalRail; y += drop) {
      const path = [start, { x: x1, y }, { x: x2, y }, end];
      if (routeClear(path)) {
        edge.rail = y;
        edge.points = path;
        return;
      }
    }
  }
  if (y1 === y2 || Math.abs(x1 - x2) > 4 * nodeHeight) return;
  const from = { x: x1, y: y1 + drop }, to = { x: x2, y: y2 + drop };
  const corridors = [...new Set(nearby.flatMap(box => [round(box.x - 6), round(box.x + box.width + 6)]))]
    .filter(x => x >= Math.max(pad / 2, left) && x <= right && x !== x1 && x !== x2)
    .sort((a, b) => (Math.abs(a - x1) + Math.abs(a - x2)) - (Math.abs(b - x1) + Math.abs(b - x2)) || a - b);
  for (const x of corridors) {
    const path = [start, from, { x, y: from.y }, { x, y: to.y }, to, end];
    if (routeClear(path)) {
      edge.rail = bottom;
      edge.points = path;
      return;
    }
  }
}

export function layoutTree(diagram: TreeDiagram, measure: (label: string) => number = estimateLabelWidth): TreeLayout {
  if (diagram.kind === 'dependency') return layoutDependency(diagram, measure);
  const pairs = movementPairs(diagram.nodes, diagram.root);
  const byId = new Map(diagram.nodes.map(node => [node.id, node]));
  const build = (id: string): TidyInput => {
    const node = byId.get(id)!;
    const lines = labelLines(node.label);
    return {
      id,
      width: Math.max(nodeHeight, ...lines.map(measure)),
      height: lines.length === 1 ? nodeHeight : lines.length * 18 + 16,
      children: node.children.map(build),
    };
  };
  // Each movement has two legs; reserve room for separate 4px turns around a shared obstacle.
  const { placed, bounds } = tidyTreeLayout(build(diagram.root), gapX, Math.max(gapY, pairs.length * 8 + 12));
  const dx = pad - bounds.left, dy = pad - bounds.top;
  const nodes: TreeLayout['nodes'] = diagram.nodes.map(node => {
    const at = placed.get(node.id)!;
    const lines = labelLines(node.label);
    return {
      id: node.id,
      label: node.label,
      x: round(at.x + dx),
      y: round(at.y + dy),
      width: Math.max(nodeHeight, ...lines.map(measure)),
      height: lines.length === 1 ? nodeHeight : lines.length * 18 + 16,
    };
  });
  const byLayout = new Map(nodes.map(node => [node.id, node]));
  const edges: TreeLayout['edges'] = diagram.nodes.flatMap(node => node.children.map(childId => {
    const parent = byLayout.get(node.id)!, child = byLayout.get(childId)!, linked = byId.get(childId)!;
    return { x1: round(parent.x + parent.width / 2), y1: round(parent.y + parent.height), x2: round(child.x + child.width / 2), y2: round(child.y), ...(linked.role ? { label: linked.role } : {}) };
  }));
  const movements: TreeLayout['edges'] = [];
  const byAntecedent = new Map<string, TreeLayout['edges']>();
  for (const pair of pairs) {
    const trace = byLayout.get(pair.trace), filler = byLayout.get(pair.antecedent);
    if (!trace || !filler) continue;
    const start = { x: round(trace.x + trace.width / 2), y: round(trace.y + trace.height) };
    const end = { x: round(filler.x + filler.width / 2), y: round(filler.y + filler.height) };
    const edge = { x1: start.x, y1: start.y, x2: end.x, y2: end.y, movement: true };
    movements.push(edge);
    const incoming = byAntecedent.get(pair.antecedent) ?? [];
    incoming.push(edge);
    byAntecedent.set(pair.antecedent, incoming);
  }
  for (const [id, incoming] of byAntecedent) {
    const box = byLayout.get(id)!;
    const center = incoming[0].x2;
    const avoidCenter = incoming.length % 2 === 1 && byId.get(id)!.children.some(childId => {
      const child = byLayout.get(childId)!;
      return round(child.x + child.width / 2) === center;
    });
    if (incoming.length === 1 && !avoidCenter) continue;
    // Separate arrowheads along a shared bottom edge and leave vertical branches visible.
    const halfSlots = (incoming.length - 1) / 2;
    const step = Math.min(12, (box.width / 2 - 6) / (halfSlots + (avoidCenter ? 1 : 0)));
    incoming.sort((a, b) => a.x1 - b.x1 || a.y1 - b.y1);
    incoming.forEach((edge, index) => {
      const slot = index - halfSlots;
      const offset = avoidCenter && slot >= 0 ? slot + 1 : slot;
      edge.x2 = round(center + offset * step);
      if (step < 11) edge.headHalfWidth = round(step * 0.4);
    });
  }
  // Short spans take inner rails; overlapping spans use separate rails below the whole tree.
  movements.sort((a, b) => Math.abs(a.x2 - a.x1) - Math.abs(b.x2 - b.x1) || Math.min(a.x1, a.x2) - Math.min(b.x1, b.x2));
  const rails: { left: number; right: number }[][] = [];
  const turns = new Map<string, number>();
  const descend = (x: number, y: number, avoidColumn?: number) => {
    const points = [{ x, y }];
    if (x === avoidColumn) {
      y = round(y + 10);
      points.push({ x, y });
      x = round(x + 6);
      points.push({ x, y });
    }
    // Descend through whitespace, stepping around the nearest box before continuing downward.
    for (;;) {
      const block = nodes.filter(node => x > round(node.x - 6) && x < round(node.x + node.width + 6) && node.y >= y && node.y + node.height > y)
        .sort((a, b) => a.y - b.y || a.x - b.x)[0];
      if (!block) return points;
      const turn = turns.get(block.id) ?? 0;
      turns.set(block.id, turn + 1);
      y = round(block.y - 6 - turn * 4);
      points.push({ x, y });
      const left = round(block.x - 6), right = round(block.x + block.width + 6);
      x = right === avoidColumn || (left !== avoidColumn && x - left <= right - x) ? left : right;
      points.push({ x, y });
    }
  };
  for (const edge of movements) {
    const start = descend(edge.x1, edge.y1);
    const end = descend(edge.x2, edge.y2, start.at(-1)!.x);
    const left = Math.min(start.at(-1)!.x, end.at(-1)!.x), right = Math.max(start.at(-1)!.x, end.at(-1)!.x);
    let lane = rails.findIndex(spans => spans.every(span => right + 12 < span.left || left > span.right + 12));
    if (lane < 0) { lane = rails.length; rails.push([]); }
    rails[lane].push({ left, right });
    edge.rail = round(bounds.bottom + dy + (lane + 1) * 18);
    edge.points = [...start, { x: start.at(-1)!.x, y: edge.rail }, { x: end.at(-1)!.x, y: edge.rail }, ...end.reverse()];
  }
  for (const edge of movements) shortenMovement(edge, nodes, movements, edges);
  const bottom = Math.max(bounds.bottom + dy, ...movements.map(edge => edge.rail!));
  separateMovementStrokes(movements, edges);
  edges.push(...movements);
  return { width: Math.ceil(bounds.right + dx + pad), height: Math.ceil(bottom + pad), nodes, edges };
}

// Dependency arcs follow displaCy: one level per distinct span, so longer arcs sit higher.
function layoutDependency(diagram: TreeDiagram, measure: (label: string) => number): TreeLayout {
  const ordered = orderedDependencyNodes(diagram);
  const index = new Map(ordered.map((node, position) => [node.id, position]));
  const widths = ordered.map(node => Math.max(nodeHeight, measure(node.label)));
  const centers: number[] = [];
  let cursor = pad;
  ordered.forEach((_, position) => { centers.push(cursor + widths[position] / 2); cursor += widths[position] + gapX; });
  const arcs = diagram.nodes.flatMap(node => node.children.map(childId => ({
    head: index.get(node.id) ?? 0,
    dependent: index.get(childId) ?? 0,
    role: diagram.nodes.find(item => item.id === childId)?.role,
  })));
  const spans = [...new Set(arcs.map(arc => Math.abs(arc.dependent - arc.head)))].sort((left, right) => left - right);
  const step = 20, base = 12;
  const top = Math.max(nodeHeight, pad + (spans.length + 1) * step);
  const nodes = ordered.map((node, position) => ({ id: node.id, label: node.label, x: round(centers[position] - widths[position] / 2), y: top, width: widths[position], height: nodeHeight }));
  const edges = arcs.map(arc => {
    const level = spans.indexOf(Math.abs(arc.dependent - arc.head)) + 1;
    return {
      x1: round(centers[arc.head]), y1: top,
      x2: round(centers[arc.dependent]), y2: top,
      bend: base + level * step,
      level,
      arrow: true,
      ...(arc.role ? { label: arc.role } : {}),
    };
  });
  return { width: Math.ceil(cursor - gapX + pad), height: top + nodeHeight + pad, nodes, edges };
}

function escapeXml(text: string) {
  return text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

function concatBytes(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

// Helvetica-Bold advances for U+0020 through U+007E, in thousandths of an em.
const helveticaBold = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];

export type TreePdfLabel = { width: number; height: number; cssWidth: number; cssHeight: number; rgb: Uint8Array } | null;

function pdfHex(value: string) {
  const bytes = [0xfe, 0xff];
  for (const char of value) {
    const code = char.codePointAt(0)!;
    const encoded = code > 0xffff ? [0xd800 + ((code - 0x10000) >> 10), 0xdc00 + ((code - 0x10000) & 0x3ff)] : [code];
    for (const unit of encoded) bytes.push(unit >> 8, unit & 0xff);
  }
  return `<${bytes.map(byte => byte.toString(16).padStart(2, '0')).join('')}>`;
}

function pdfLiteral(value: string) {
  return `(${value.replace(/[\\()]/g, char => `\\${char}`)})`;
}

// A one-page vector drawing. Printable ASCII labels are real text; other labels are supplied as RGB bitmaps.
export function treePdf(layout: TreeLayout, labels: TreePdfLabel[], edgeLabels: TreePdfLabel[] = []) {
  if (labels.length !== layout.nodes.length || layout.width < 1 || layout.height < 1) throw new Error('TREE_EXPORT');
  const fontSize = 16;
  // PDF pages cap at 200 inches (14400 points); larger trees are drawn in a scaled coordinate system.
  const scale = Math.min(1, 14400 / Math.max(layout.width, layout.height));
  const pageWidth = Math.ceil(layout.width * scale);
  const pageHeight = Math.ceil(layout.height * scale);
  const flip = layout.height;
  const images: { name: string; label: Exclude<TreePdfLabel, null> }[] = [];
  const drawing = [`q`, ...(scale < 1 ? [`${round(scale)} 0 0 ${round(scale)} 0 0 cm`] : []), `1 1 1 rg`, `0 0 ${layout.width} ${layout.height} re`, `f`, `0 0 0 RG`, `1.5 w`, `1 J`];
  for (const edge of layout.edges) {
    const y1 = round(flip - edge.y1), y2 = round(flip - edge.y2);
    if (edge.movement) {
      for (const stroke of movementStrokes(edge)) {
        drawing.push(...stroke.map((point, index) => `${point.x} ${round(flip - point.y)} ${index ? 'l' : 'm'}`), `S`);
      }
      continue;
    }
    if (!edge.bend) { drawing.push(`${edge.x1} ${y1} m`, `${edge.x2} ${y2} l`, `S`); continue; }
    const cx = (edge.x1 + edge.x2) / 2, cy = Math.min(edge.y1, edge.y2) - edge.bend, py = round(flip - cy);
    const c1x = round(edge.x1 + (cx - edge.x1) * 2 / 3), c1y = round(y1 + (py - y1) * 2 / 3);
    const c2x = round(edge.x2 + (cx - edge.x2) * 2 / 3), c2y = round(y2 + (py - y2) * 2 / 3);
    drawing.push(`${edge.x1} ${y1} m`, `${c1x} ${c1y} ${c2x} ${c2y} ${edge.x2} ${y2} c`, `S`);
  }
  drawing.push(`Q`);
  const printable = (value: string) => [...value].every(char => { const code = char.charCodeAt(0); return code >= 32 && code <= 126; });
  layout.edges.forEach(edge => {
    if (!edge.arrow && !edge.movement) return;
    const [tip, left, right] = treeArrowPoints(edge);
    drawing.push('0 0 0 rg', `${tip.x} ${round(flip - tip.y)} m`, `${left.x} ${round(flip - left.y)} l`,
      `${right.x} ${round(flip - right.y)} l`, 'h', 'f', '0 0 0 RG');
  });
  layout.edges.forEach((edge, index) => {
    if (!edge.label) return;
    const image = edgeLabels[index];
    const { x, y } = treeEdgeLabelPoint(edge);
    if (image) {
      if (image.width < 1 || image.height < 1 || image.cssWidth < 1 || image.cssHeight < 1 || image.rgb.length !== image.width * image.height * 3) throw new Error('TREE_EXPORT');
      const name = `Im${images.length}`;
      images.push({ name, label: image });
      const left = round(x - image.cssWidth / 2);
      const bottom = round(flip - y - image.cssHeight / 2);
      drawing.push(`/Span << /ActualText ${pdfHex(edge.label)} >> BDC`, `q`, `${image.cssWidth} 0 0 ${image.cssHeight} ${left} ${bottom} cm`, `/${name} Do`, `Q`, `EMC`);
    } else if (printable(edge.label)) {
      const size = 12;
      const width = [...edge.label].reduce((sum, char) => sum + helveticaBold[char.charCodeAt(0) - 32], 0) * size / 1000;
      const left = round(x - width / 2);
      const baseline = round(flip - (y + size * 0.25));
      drawing.push(`BT`, `/F1 ${size} Tf`, `0 0 0 rg`, `1 0 0 1 ${left} ${baseline} Tm`, `${pdfLiteral(edge.label)} Tj`, `ET`);
    }
  });
  layout.nodes.forEach((node, index) => {
    const image = labels[index];
    const lines = labelLines(node.label);
    const ascii = lines.every(printable);
    if (image) {
      if (image.width < 1 || image.height < 1 || image.cssWidth < 1 || image.cssHeight < 1 || image.rgb.length !== image.width * image.height * 3) throw new Error('TREE_EXPORT');
      const name = `Im${images.length}`;
      images.push({ name, label: image });
      const left = round(node.x + (node.width - image.cssWidth) / 2);
      const bottom = round(flip - (node.y + (node.height - image.cssHeight) / 2) - image.cssHeight);
      drawing.push(`/Span << /ActualText ${pdfHex(node.label)} >> BDC`, `q`, `${image.cssWidth} 0 0 ${image.cssHeight} ${left} ${bottom} cm`, `/${name} Do`, `Q`, `EMC`);
    } else if (ascii && lines.length === 1 && node.label) {
      const width = [...node.label].reduce((sum, char) => sum + helveticaBold[char.charCodeAt(0) - 32], 0) * fontSize / 1000;
      const left = round(node.x + (node.width - width) / 2);
      const baseline = round(flip - (node.y + node.height / 2 + fontSize * 0.25));
      drawing.push(`BT`, `/F1 ${fontSize} Tf`, `0 0 0 rg`, `1 0 0 1 ${left} ${baseline} Tm`, `${pdfLiteral(node.label)} Tj`, `ET`);
    } else if (ascii) {
      const lineHeight = 18;
      const block = lines.length * lineHeight;
      lines.forEach((line, lineIndex) => {
        const width = [...line].reduce((sum, char) => sum + helveticaBold[char.charCodeAt(0) - 32], 0) * fontSize / 1000;
        const left = round(node.x + (node.width - width) / 2);
        const center = node.y + (node.height - block) / 2 + lineIndex * lineHeight + lineHeight / 2;
        const baseline = round(flip - (center + fontSize * 0.25));
        drawing.push(`BT`, `/F1 ${fontSize} Tf`, `0 0 0 rg`, `1 0 0 1 ${left} ${baseline} Tm`, `${pdfLiteral(line)} Tj`, `ET`);
      });
    } else throw new Error('TREE_EXPORT');
  });
  drawing.push(`Q`);
  const encoded = new TextEncoder();
  const content = encoded.encode(`${drawing.join('\n')}\n`);
  const xobjects = images.map((image, index) => `/${image.name} ${6 + index} 0 R`).join(' ');
  const objects = [
    encoded.encode('<< /Type /Catalog /Pages 2 0 R >>'),
    encoded.encode('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    encoded.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> /XObject << ${xobjects} >> >> >>`),
    concatBytes([encoded.encode(`<< /Length ${content.length} >>\nstream\n`), content, encoded.encode('endstream')]),
    encoded.encode('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'),
    ...images.map(image => {
      const bytes = deflateSync(image.label.rgb);
      return concatBytes([encoded.encode(`<< /Type /XObject /Subtype /Image /Width ${image.label.width} /Height ${image.label.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${bytes.length} >>\nstream\n`), bytes, encoded.encode('\nendstream')]);
    }),
  ];
  const header = encoded.encode('%PDF-1.4\n');
  let cursor = header.length;
  const offsets: number[] = [];
  const body = objects.map((object, index) => {
    offsets.push(cursor);
    const wrapped = concatBytes([encoded.encode(`${index + 1} 0 obj\n`), object, encoded.encode('\nendobj\n')]);
    cursor += wrapped.length;
    return wrapped;
  });
  const xref = [`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`, ...offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`), `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${cursor}\n%%EOF`].join('');
  return concatBytes([header, ...body, encoded.encode(xref)]);
}

export function movementPath(edge: TreeLayout['edges'][number]) {
  return movementStrokes(edge).map(stroke => stroke.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')).join(' ');
}

export function treeArrowPoints(edge: TreeLayout['edges'][number]): [TreePoint, TreePoint, TreePoint] {
  const base = round(edge.y2 + (edge.movement ? 9 : -8));
  const half = edge.headHalfWidth ?? 4.5;
  return [{ x: edge.x2, y: edge.y2 }, { x: round(edge.x2 - half), y: base }, { x: round(edge.x2 + half), y: base }];
}

export function treeArrowPath(edge: TreeLayout['edges'][number]) {
  const [tip, left, right] = treeArrowPoints(edge);
  return `M ${tip.x} ${tip.y} L ${left.x} ${left.y} L ${right.x} ${right.y} Z`;
}

export function treeSvg(layout: TreeLayout, colors: { line: string }) {
  const mark = (edge: TreeLayout['edges'][number]) => edge.movement
    ? `<path d="${movementPath(edge)}" fill="none" stroke="${escapeXml(colors.line)}" stroke-width="1.5"/>`
    : edge.bend
      ? `<path d="M ${edge.x1} ${edge.y1} Q ${round((edge.x1 + edge.x2) / 2)} ${round(Math.min(edge.y1, edge.y2) - edge.bend)} ${edge.x2} ${edge.y2}" fill="none" stroke="${escapeXml(colors.line)}" stroke-width="1.5"/>`
      : `<line x1="${edge.x1}" y1="${edge.y1}" x2="${edge.x2}" y2="${edge.y2}" stroke="${escapeXml(colors.line)}" stroke-width="1.5"/>`;
  // A dependency arc points down at the word it labels; a movement arrow rises into the landing
  // site, so its head opens downward beneath the node it reaches.
  const arrows = layout.edges.filter(edge => edge.arrow || edge.movement)
    .map(edge => `<path d="${treeArrowPath(edge)}" fill="#000" stroke="none"/>`).join('');
  const lines = layout.edges.map(mark).join('');
  const relations = layout.edges.filter(edge => edge.label).map(edge => {
    const { x, y } = treeEdgeLabelPoint(edge);
    return `<text x="${x}" y="${y}" fill="#000" font-family="system-ui,sans-serif" font-size="12" font-weight="600" text-anchor="middle" dominant-baseline="central">${escapeXml(edge.label!)}</text>`;
  }).join('');
  const labels = layout.nodes.map(node => {
    const x = round(node.x + node.width / 2), y = round(node.y + node.height / 2), lines = labelLines(node.label);
    const open = `<text x="${x}" y="${y}" fill="#000" font-family="system-ui,sans-serif" font-size="16" font-weight="600" text-anchor="middle" dominant-baseline="central">`;
    if (lines.length === 1) return `${open}${escapeXml(node.label)}</text>`;
    const start = y - (lines.length - 1) * 9;
    return `${open}${lines.map((line, index) => `<tspan x="${x}" y="${round(start + index * 18)}">${escapeXml(line)}</tspan>`).join('')}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">${lines}${arrows}${relations}${labels}</svg>`;
}

function splitRole(label: string) {
  const match = /^(.*)@([^@\s]+)$/u.exec(label);
  if (!match?.[1] || !match[2]) return { label };
  return { label: match[1], role: match[2] };
}

function assign(raw: Raw, form: TreeForm, writtenRoles = true): TreeDiagram {
  const nodes: TreeDiagram['nodes'] = [];
  const walk = (node: Raw, depth: number): string => {
    if (nodes.length >= maxNodes) throw new Error('TREE_TOO_BIG');
    if (depth > maxDepth) throw new Error('TREE_TOO_BIG');
    const parts = writtenRoles ? splitRole(normalizeMovementLabel(node.label)) : { label: node.label };
    if (!parts.label || parts.label.length > maxLabel || /\p{C}/u.test(parts.label)) throw new Error('TREE_PARSE');
    const slot = { id: `n${nodes.length + 1}`, label: parts.label, children: [] as string[], ...(parts.role ? { role: parts.role } : {}) };
    nodes.push(slot);
    slot.children = node.children.map(child => walk(child, depth + 1));
    return slot.id;
  };
  return treeDiagramSchema.parse({ root: walk(raw, 0), nodes, ...(form ? { form } : {}) });
}

type BracketToken = string | { label: string };

function scan(input: string) {
  const tokens: BracketToken[] = [];
  for (let index = 0; index < input.length;) {
    const char = input[index];
    if (/\s/u.test(char)) { index++; continue; }
    if ('()[]'.includes(char)) { tokens.push(char); index++; continue; }
    if (char === '"') {
      let label = '';
      let end = index + 1;
      for (;;) {
        const quote = input.indexOf('"', end);
        if (quote === -1) throw new Error('TREE_PARSE');
        label += input.slice(end, quote);
        end = quote + 1;
        if (input[end] !== '"') break;
        label += '"';
        end++;
      }
      if (!label) throw new Error('TREE_PARSE');
      tokens.push({ label });
      index = end;
      continue;
    }
    let end = index + 1;
    while (end < input.length && !/[\s()[\]"]/u.test(input[end])) end++;
    tokens.push(input.slice(index, end));
    index = end;
  }
  return tokens;
}

function readNode(tokens: BracketToken[], start: number, depth = 0): { node: Raw; next: number } {
  if (depth > maxDepth) throw new Error('TREE_TOO_BIG');
  const token = tokens[start];
  if (!token || token === ')' || token === ']') throw new Error('TREE_PARSE');
  if (token !== '(' && token !== '[') return { node: { label: typeof token === 'string' ? token : token.label, children: [] }, next: start + 1 };
  const close = token === '(' ? ')' : ']';
  const name = tokens[start + 1];
  if (!name || (typeof name === 'string' && '()[]'.includes(name))) throw new Error('TREE_PARSE');
  const children: Raw[] = [];
  let cursor = start + 2;
  while (tokens[cursor] !== close) {
    if (cursor >= tokens.length) throw new Error('TREE_PARSE');
    const child = readNode(tokens, cursor, depth + 1);
    children.push(child.node);
    cursor = child.next;
  }
  return { node: { label: typeof name === 'string' ? name : name.label, children }, next: cursor + 1 };
}

function parseBrackets(input: string) {
  const tokens = scan(input);
  const parsed = readNode(tokens, 0);
  if (parsed.next !== tokens.length) throw new Error('TREE_PARSE');
  return parsed.node;
}

const pennTokens = new Map([['-LRB-', '('], ['-RRB-', ')'], ['-LSB-', '['], ['-RSB-', ']'], ['-LCB-', '{'], ['-RCB-', '}'], ['``', '"'], ["''", '"']]);
function checkedTreeInput(input: string) {
  const text = normalizeTreeInput(input).trim();
  if (!text || text.length > 200_000 || /\p{C}/u.test(text.replace(/[\t\r\n]/gu, ''))) throw new Error('TREE_PARSE');
  return text;
}

const modelSurface = (value: string) => normalizeTreeInput(value).replace(/[“”]/gu, '"').replace(/[‘’]/gu, "'").replace(/\s+/gu, ' ').trim();

function matchesModelSurface(source: string, words: readonly string[]) {
  // Models may split contractions and punctuation, but must preserve spaces between source words.
  let remaining = modelSurface(source);
  for (const word of words) {
    const token = modelSurface(word);
    if (!token || !remaining.startsWith(token)) return false;
    remaining = remaining.slice(token.length).trimStart();
  }
  return !remaining;
}
const auxiliaryTags = new Map([
  ['am', 'VBP'], ['are', 'VBP'], ['were', 'VBD'], ['was', 'VBD'], ['is', 'VBZ'], ["'s", 'VBZ'],
  ['be', 'VB'], ['been', 'VBN'], ['being', 'VBG'], ['has', 'VBZ'], ['having', 'VBG'],
  ['does', 'VBZ'], ['did', 'VBD'], ['done', 'VBN'], ['doing', 'VBG'],
]);

export function drawModelConstituency(source: string, brackets: string) {
  const root = parseBrackets(checkedTreeInput(brackets));
  if (root.label !== 'S1' || root.children.length !== 1) throw new Error('TREE_PARSE');
  const words: string[] = [];
  const visit = (node: Raw) => {
    const leaf = node.children.length === 1 && !node.children[0].children.length ? node.children[0] : undefined;
    if (!leaf) {
      if (!node.children.length || node.children.some(child => !child.children.length)) throw new Error('TREE_PARSE');
      node.children.forEach(visit);
      return;
    }
    if (node.label === '-NONE-') throw new Error('TREE_PARSE');
    if (node.label === 'AUX' || node.label === 'AUXG') {
      const tag = auxiliaryTags.get(auxiliaryKey(leaf.label));
      if (!tag) throw new Error('TREE_PARSE');
      node.label = tag;
    }
    leaf.label = pennTokens.get(leaf.label) ?? leaf.label;
    words.push(leaf.label);
  };
  visit(root.children[0]);
  if (!matchesModelSurface(source, words)) throw new Error('TREE_PARSE');
  return assign(root.children[0], 'constituency', false);
}

function parseOutline(input: string) {
  const rows = input.split(/\r?\n/).map(line => line.replace(/\s+$/u, '')).filter(line => line.trim()).map(line => {
    const indent = /^[ \t]*/u.exec(line)?.[0] ?? '';
    const label = line.slice(indent.length).trim();
    if (!label) throw new Error('TREE_PARSE');
    return { width: [...indent].reduce((sum, char) => sum + (char === '\t' ? 2 : 1), 0), label };
  });
  if (!rows.length || rows[0].width !== 0) throw new Error('TREE_PARSE');
  const root: Raw = { label: rows[0].label, children: [] };
  const stack = [{ width: 0, node: root }];
  for (const row of rows.slice(1)) {
    while (stack.length > 1 && row.width <= stack.at(-1)!.width) stack.pop();
    if (row.width <= stack.at(-1)!.width) throw new Error('TREE_PARSE');
    const node: Raw = { label: row.label, children: [] };
    stack.at(-1)!.node.children.push(node);
    stack.push({ width: row.width, node });
  }
  return root;
}

// Brackets and outlines keep the written structure. A sentence follows PTB II conventions.
// Numbered head rows stay dependency trees, projective or crossing.
const dependencyLine = /^(\d+)\s+(\S+)\s+(\d+)\s+(\S+)$/u;
const autoStart = /^(?:ID=[^\r\n]+\r?\n[ \t]*)?\(\s*<[LT](?=\s|>)/u;

function parseCcgAuto(text: string): Raw {
  // AUTO headers delimit categories that themselves contain parentheses and brackets.
  const header = /\s*\(\s*<([LT])\s+([^<>]+)>/yu;
  const close = /\s*\)/yu;
  let cursor = text.startsWith('ID=') ? text.indexOf('\n') + 1 : 0;
  let nodes = 0;
  const read = (depth: number): Raw => {
    if (++nodes > maxNodes || depth > maxDepth) throw new Error('TREE_TOO_BIG');
    header.lastIndex = cursor;
    const match = header.exec(text);
    if (!match) throw new Error('TREE_PARSE');
    cursor = header.lastIndex;
    const fields = match[2].trim().split(/\s+/u);
    const [category, first, second, word] = fields;
    if (!category || category.includes('|')) throw new Error('TREE_PARSE');
    let label = category;
    const children: Raw[] = [];
    if (match[1] === 'L') {
      if (fields.length !== 5 || !word || word.includes('|')) throw new Error('TREE_PARSE');
      label = `${word}|${category}`;
    } else {
      if (fields.length !== 3 || (second !== '1' && second !== '2')
          || (first !== '0' && !(first === '1' && second === '2'))) throw new Error('TREE_PARSE');
      children.push(read(depth + 1));
      if (second === '2') children.push(read(depth + 1));
    }
    close.lastIndex = cursor;
    if (!close.test(text)) throw new Error('TREE_PARSE');
    cursor = close.lastIndex;
    return { label, children };
  };
  const root = read(0);
  if (cursor !== text.length) throw new Error('TREE_PARSE');
  return root;
}

export function drawModelCcg(source: string, auto: string) {
  const root = parseCcgAuto(checkedTreeInput(auto));
  const words: string[] = [];
  const visit = (node: Raw) => {
    if (node.children.length) { node.children.forEach(visit); return; }
    const split = node.label.indexOf('|');
    const word = node.label.slice(0, split);
    const surface = pennTokens.get(word) ?? word;
    node.label = surface + node.label.slice(split);
    words.push(surface);
  };
  visit(root);
  if (!matchesModelSurface(source, words)) throw new Error('TREE_PARSE');
  return assign(root, 'ccg', false);
}

export function isWrittenTreeInput(input: string) {
  const text = normalizeTreeInput(input).trim();
  if (autoStart.test(text)) return true;
  // Closed-class subjects and sentence punctuation distinguish prose from category-labelled trees.
  // shortcut: ambiguous bare labels retain bracket syntax; add explicit input modes if prose must override them.
  const subject = /^\(\s*(?:i|you|he|she|it|we|they|the|a|an|this|that|these|those|my|your|his|her|our|their)\b/iu.test(text);
  const proseParentheses = text.startsWith('(') && /\)\s*[.!?]*$/u.test(text) && (subject || (/(?:[.!?]\s*\)|\)\s*[.!?]+)$/u.test(text)
    && !/^\(\s*(?:[A-Z][A-Z0-9$-]*|"[^"]*")(?=\s|[()])/u.test(text)));
  return text.startsWith('[') || (text.startsWith('(') && !proseParentheses) || /\n[\t ]+\S/u.test(text)
    || (Boolean(text) && text.split(/\r?\n/u).every(line => !line.trim() || dependencyLine.test(line.trim())));
}

export function drawTree(input: string, form: TreeForm = 'constituency', pos?: PosLookup) {
  const text = checkedTreeInput(input);
  if (autoStart.test(text)) return assign(parseCcgAuto(text), 'ccg', false);
  const dependency = parseDependency(text);
  if (dependency) return dependency;
  const written = isWrittenTreeInput(text);
  const raw = written ? text.startsWith('(') || text.startsWith('[') ? parseBrackets(text) : parseOutline(text) : parseTaggedSentence(text, pos);
  if (form === 'dependency') return dependencyDiagram(raw);
  return assign(presentTree(raw, form), form);
}

function dependencyDiagram(raw: RawNode) {
  const rows = rowsToDependency(phraseDependencies(raw));
  const rootIndex = Math.max(0, rows.findIndex(row => row.head < 0));
  const nodes = rows.map((row, index) => ({
    id: `n${index + 1}`,
    label: row.word,
    children: [] as string[],
    order: index + 1,
    ...(index === rootIndex ? {} : { role: row.role }),
  }));
  rows.forEach((row, index) => { if (row.head >= 0 && row.head !== index) nodes[row.head].children.push(nodes[index].id); });
  return treeDiagramSchema.parse({ kind: 'dependency', form: 'dependency', root: nodes[rootIndex].id, nodes });
}

function parseDependency(input: string) {
  const lines = input.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length || lines.some(line => !dependencyLine.test(line))) return;
  const rows = lines.map(line => {
    const match = dependencyLine.exec(line)!;
    const word = match[2].replaceAll('_', ' ').normalize('NFKC').trim().replace(/\s+/g, ' ');
    return { index: Number(match[1]), word, head: Number(match[3]), role: match[4] };
  });
  return dependencyTreeFromRows(rows);
}

type DependencyRow = { index: number; word: string; head: number; role: string };

export function drawConlluDependency(input: string, source?: string) {
  if (input.length > 200_000) throw new Error('TREE_TOO_BIG');
  const rows: DependencyRow[] = [];
  const surface: string[] = [];
  let multiwordEnd = 0;
  for (const line of input.split(/\r?\n/u)) {
    if (!line || line.startsWith('#')) continue;
    const columns = line.split('\t');
    if (columns.length !== 10) throw new Error('TREE_PARSE');
    const [index, form, , , , , head, role] = columns;
    if (/^\d+\.\d+$/u.test(index)) continue;
    const range = /^(\d+)-(\d+)$/u.exec(index);
    if (range) {
      const start = Number(range[1]), end = Number(range[2]);
      if (start !== rows.length + 1 || start <= multiwordEnd || end <= start || end > maxNodes || !form) throw new Error('TREE_PARSE');
      surface.push(form);
      multiwordEnd = end;
      continue;
    }
    // Model rows are sequential and restart at one for each sentence.
    const id = rows.length + 1;
    if (index !== String(id) || !/^\d+$/u.test(head)) throw new Error('TREE_PARSE');
    if (id > multiwordEnd) surface.push(form);
    rows.push({ index: id, word: form.normalize('NFKC'), head: Number(head), role });
  }
  if (rows.length < multiwordEnd || (source !== undefined && !matchesModelSurface(source, surface))) throw new Error('TREE_PARSE');
  return dependencyTreeFromRows(rows);
}

function dependencyTreeFromRows(rows: DependencyRow[]) {
  if (rows.length > maxNodes) throw new Error('TREE_TOO_BIG');
  if (rows.some(({ word, role }) => !word.trim() || word.length > maxLabel || role.length > maxRole || /\p{C}/u.test(`${word}${role}`))) throw new Error('TREE_PARSE');
  if (rows.some(row => !Number.isInteger(row.index) || row.index < 1 || row.index > 999_999 || !Number.isInteger(row.head) || row.head < 0 || row.head > 999_999)) throw new Error('TREE_PARSE');
  const id = new Map(rows.map((row, position) => [row.index, `n${position + 1}`]));
  if (id.size !== rows.length || rows.some(row => row.head === row.index)) throw new Error('TREE_PARSE');
  const roots = rows.filter(row => row.head === 0);
  if (roots.length !== 1 || rows.some(row => row.head !== 0 && !id.has(row.head))) throw new Error('TREE_PARSE');
  const nodes = rows.map(row => ({ id: id.get(row.index)!, label: row.word, children: [] as string[], order: row.index, ...(row.head ? { role: row.role } : {}) }));
  const byId = new Map(nodes.map(node => [node.id, node]));
  for (const row of rows) if (row.head) byId.get(id.get(row.head)!)!.children.push(id.get(row.index)!);
  try { return treeDiagramSchema.parse({ kind: 'dependency', form: 'dependency', root: id.get(roots[0].index)!, nodes }); }
  catch (error) { if (error instanceof Error && error.message === 'TREE_TOO_BIG') throw error; throw new Error('TREE_PARSE'); }
}
