// A shared label subscript links a moved constituent to its trace across saves and exports.
export const MOVEMENT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';
const subscriptRun = /[₀-₉]+(?=\||$)/u;
// A trace is an empty node: the conventional "t", the empty-category glyph, or "e".
const traceShape = /^(?:t|∅|e)(?:@[^@\s]+)?$/u;
const maxIndex = 99;

export function subscript(value: number) {
  return [...String(value)].map(digit => MOVEMENT_DIGITS[Number(digit)]).join('');
}

/** Splits a label into its base and movement index, if it carries one. */
export function splitIndex(label: string): { base: string; index?: number } {
  const match = subscriptRun.exec(label);
  if (!match) return { base: label };
  const digits = [...match[0]].map(character => MOVEMENT_DIGITS.indexOf(character)).join('');
  const index = Number(digits);
  if (!Number.isInteger(index) || index < 1 || index > maxIndex) return { base: label };
  return { base: label.slice(0, match.index) + label.slice(match.index + match[0].length), index };
}

export function labelIndex(label: string): number | undefined {
  return splitIndex(label).index;
}

/** Replaces any existing index, so linking twice never produces "what₁₂". */
export function withIndex(label: string, index: number): string {
  const base = splitIndex(label).base;
  const divider = base.indexOf('|');
  return divider < 0 ? `${base}${subscript(index)}` : `${base.slice(0, divider)}${subscript(index)}${base.slice(divider)}`;
}

export function withoutIndex(label: string): string {
  return splitIndex(label).base;
}

/** A trace is an empty category, by label shape, that carries a movement index. */
export function isTraceLabel(label: string): boolean {
  const { base, index } = splitIndex(label);
  return index !== undefined && traceShape.test(base);
}

export function nextIndex(labels: Iterable<string>): number {
  const used = new Set<number>();
  let highest = 0;
  for (const label of labels) {
    const index = labelIndex(label);
    if (index === undefined) continue;
    used.add(index);
    highest = Math.max(highest, index);
  }
  if (highest < maxIndex) return highest + 1;
  for (let index = 1; index <= maxIndex; index++) {
    if (!used.has(index)) return index;
  }
  throw new Error('TREE_MOVE_INDEX');
}

type MovementNode = { id: string; label: string; children: string[] };

/**
 * Pairs the two nodes that share a movement index: the position the constituent left (the trace, or
 * the deeper node when a learner linked two ordinary nodes by hand) and the constituent itself (the
 * shallower node, because the moved constituent is drawn above the position it came from).
 */
export function movementPairs(nodes: readonly MovementNode[], root: string) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const position = new Map<string, { depth: number; order: number }>();
  const walk = (id: string, level: number) => {
    const node = byId.get(id);
    if (!node || position.has(id)) return;
    position.set(id, { depth: level, order: position.size });
    for (const child of node.children) walk(child, level + 1);
  };
  walk(root, 0);
  const groups = new Map<number, MovementNode[]>();
  for (const node of nodes) {
    const index = labelIndex(node.label);
    if (index === undefined) continue;
    const group = groups.get(index);
    if (group) group.push(node);
    else groups.set(index, [node]);
  }
  const depth = (node: MovementNode) => position.get(node.id)?.depth ?? 0;
  const order = (node: MovementNode) => position.get(node.id)?.order ?? 0;
  const pairs: { trace: string; antecedent: string; index: number }[] = [];
  for (const [index, group] of groups) {
    if (group.length < 2) continue;
    const traces = group.filter(node => isTraceLabel(node.label)).sort((a, b) => a.id.localeCompare(b.id));
    if (traces.length) {
      const antecedent = group.filter(node => !isTraceLabel(node.label)).sort((a, b) => depth(a) - depth(b) || a.id.localeCompare(b.id))[0];
      if (antecedent) for (const trace of traces) pairs.push({ trace: trace.id, antecedent: antecedent.id, index });
      continue;
    }
    // Use child order to break equal-depth ties, independent of snapshot storage order.
    const trace = group.sort((a, b) => depth(b) - depth(a) || order(a) - order(b))[0];
    const antecedent = group
      .filter(node => node.id !== trace.id)
      .sort((a, b) => depth(a) - depth(b) || order(a) - order(b))[0];
    if (!antecedent) continue;
    pairs.push({ trace: trace.id, antecedent: antecedent.id, index });
  }
  return pairs;
}

/**
 * Normalises a label the way the editor always has, without destroying a movement index: NFKC turns
 * the subscript digits into plain digits, so the index is set aside and re-attached afterwards.
 */
export function normalizeMovementLabel(label: string): string {
  return normalizeTreeInput(label).trim().replace(/\s+/g, ' ');
}

/**
 * Normalises typed tree text without flattening movement indices. NFKC turns a subscript digit into
 * a plain digit, so each one is parked in the private-use area and restored afterwards; a tree text
 * saved with "t₁" therefore keeps it when it is drawn again.
 */
export function normalizeTreeInput(input: string): string {
  const parked = input.replace(/[₀-₉]/gu, character => String.fromCharCode(0xe000 + MOVEMENT_DIGITS.indexOf(character)));
  return parked.normalize('NFKC').replace(/[\ue000-\ue009]/gu, character => MOVEMENT_DIGITS[character.charCodeAt(0) - 0xe000]);
}
