// Movement (移位) is represented with a subscript index shared by a moved constituent and the trace
// it left behind: "what₁ ... t₁". The index lives in the label instead of a new schema field so that
// every presentation, saved record and export keeps it without a separate migration.
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
  let highest = 0;
  for (const label of labels) {
    const index = labelIndex(label);
    if (index !== undefined && index > highest) highest = index;
  }
  return Math.min(maxIndex, highest + 1);
}

type MovementNode = { id: string; label: string; children: string[] };

/**
 * Pairs the two nodes that share a movement index: the position the constituent left (the trace, or
 * the deeper node when a learner linked two ordinary nodes by hand) and the constituent itself (the
 * shallower node, because the moved constituent is drawn above the position it came from).
 */
export function movementPairs(nodes: readonly MovementNode[], root: string) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const depth = new Map<string, number>();
  const walk = (id: string, level: number) => {
    const node = byId.get(id);
    if (!node || depth.has(id)) return;
    depth.set(id, level);
    for (const child of node.children) walk(child, level + 1);
  };
  walk(root, 0);
  const groups = new Map<number, MovementNode[]>();
  for (const node of nodes) {
    const index = labelIndex(node.label);
    if (index === undefined) continue;
    groups.set(index, [...(groups.get(index) ?? []), node]);
  }
  const pairs: { trace: string; antecedent: string; index: number }[] = [];
  for (const [index, group] of groups) {
    if (group.length < 2) continue;
    const traces = group.filter(node => isTraceLabel(node.label)).sort((a, b) => a.id.localeCompare(b.id));
    if (traces.length) {
      const antecedent = group.filter(node => !isTraceLabel(node.label)).sort((a, b) => (depth.get(a.id) ?? 0) - (depth.get(b.id) ?? 0) || a.id.localeCompare(b.id))[0];
      if (antecedent) for (const trace of traces) pairs.push({ trace: trace.id, antecedent: antecedent.id, index });
      continue;
    }
    // A hand-linked ordinary pair connects the deeper node to the shallower one.
    const deepestFirst = [...group].sort((left, right) => (depth.get(right.id) ?? 0) - (depth.get(left.id) ?? 0));
    const trace = deepestFirst[0];
    const antecedent = [...group]
      .filter(node => node.id !== trace.id)
      .sort((left, right) => (depth.get(left.id) ?? 0) - (depth.get(right.id) ?? 0))[0];
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
