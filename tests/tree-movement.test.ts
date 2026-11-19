import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { drawTree, layoutTree, linkMovement, sentenceFileName, treeFileName, movementPath, treeArrowPoints, treePdf, treeSvg, treeText, treeDiagramSchema, unlinkMovement, type TreeDiagram } from '../src/shared/tree';
import { movementStrokes } from '../src/shared/tree-movement-strokes';
import { isTraceLabel, labelIndex, nextIndex, normalizeMovementLabel, subscript, withIndex, withoutIndex } from '../src/shared/tree-movement';
import { resolvePos, type WordNetPos } from '../src/shared/wordnet-pos';

// The installed dictionary, read the way the page reads it, so the movement checks run on the same
// analysis the product shows.
const letters = [...'abcdefghijklmnopqrstuvwxyz0'];
const buckets = new Map(letters.map(letter => [letter, JSON.parse(readFileSync(`public/dictionary/oewn-2025/pos-${letter}.json`, 'utf8')) as Record<string, number>]));
const forms = JSON.parse(readFileSync('public/dictionary/oewn-2025/forms.json', 'utf8')) as Record<string, string[]>;
const parts: WordNetPos[] = ['noun', 'verb', 'adjective', 'adverb'];
const lookup = (word: string) => {
  const counts = resolvePos(word, buckets, forms);
  const ordered = parts.filter(part => counts[part] > 0).map(part => [part, counts[part]] as const);
  return ordered.length ? ordered : undefined;
};

const traceLabel = (diagram: TreeDiagram) => diagram.nodes.find(node => isTraceLabel(node.label))?.label;
const indexed = (diagram: TreeDiagram, prefix: string) => diagram.nodes.find(node => node.label.startsWith(prefix) && labelIndex(node.label) !== undefined)?.label;

it('reads and writes a movement index in a label', () => {
  expect(subscript(12)).toBe('₁₂');
  expect(withIndex('what', 2)).toBe('what₂');
  expect(withIndex('what₉', 3)).toBe('what₃');
  expect(withoutIndex('what₂')).toBe('what');
  expect(isTraceLabel('t₁')).toBe(true);
  expect(isTraceLabel('∅₂')).toBe(true);
  expect(isTraceLabel('t')).toBe(false);
  expect(isTraceLabel('the')).toBe(false);
  expect(nextIndex(['what₁', 't₂', 'book'])).toBe(3);
  expect(normalizeMovementLabel('what₁|Wh')).toBe('what₁|Wh');
  expect(labelIndex('what₁|Wh')).toBe(1);
  expect(withoutIndex('what₁|Wh')).toBe('what|Wh');
  expect(withIndex('what₁|Wh', 2)).toBe('what₂|Wh');
});

it('coindexes the constituent that moved with the trace it left behind', () => {
  const whQuestion = drawTree('what did you see', 'constituency', lookup);
  expect(traceLabel(whQuestion)).toBe('t₁');
  expect(indexed(whQuestion, 'what')).toBe('what₁');
  // Subject extraction leaves a subject trace even without auxiliary inversion.
  const subjectQuestion = drawTree('who wrote this letter', 'constituency', lookup);
  expect(traceLabel(subjectQuestion)).toBe('t₁');
  expect(indexed(subjectQuestion, 'who')).toBe('who₁');
  // An object relative, in its wh and zero forms.
  expect(traceLabel(drawTree('the book which I read is good', 'constituency', lookup))).toBe('t₁');
  expect(indexed(drawTree('the book which I read is good', 'constituency', lookup), 'which')).toBe('which₁');
  const zero = drawTree('the book I read is good', 'constituency', lookup);
  expect(traceLabel(zero)).toBe('t₁');
  expect(indexed(zero, 'book')).toBe('book₁');
  // A pied-piped relative leaves an adverbial trace.
  const pied = drawTree('the city in which I live is old', 'constituency', lookup);
  expect(traceLabel(pied)).toBe('t₁');
  expect(indexed(pied, 'which')).toBe('which₁');
  // A passive moves its subject out of the object slot; a "by" phrase is the evidence.
  const passive = drawTree('the letter was written by my father', 'constituency', lookup);
  expect(traceLabel(passive)).toBe('t₁');
  expect(indexed(passive, 'letter')).toBe('letter₁');
  // A cleft leaves a subject gap in its relative clause.
  const cleft = drawTree('it was John who broke the window', 'constituency', lookup);
  expect(traceLabel(cleft)).toBe('t₁');
  expect(indexed(cleft, 'who')).toBe('who₁');
});

it('leaves clauses without movement alone', () => {
  // Appositives, complements and adjectival predicates do not acquire extraction gaps.
  for (const sentence of ['she has been working all day', 'the window was broken', 'she is tired', 'she herself arrived', 'the fact that she left is sad', 'he said that the world is flat']) {
    const diagram = drawTree(sentence, 'constituency', lookup);
    expect(traceLabel(diagram), sentence).toBeUndefined();
    expect(diagram.nodes.every(node => labelIndex(node.label) === undefined), sentence).toBe(true);
  }
});

it('links a subject-relative that to the subject gap and keeps content that unindexed', () => {
  const relative = 'The birds that grew tired fell.';
  expect(treeText(drawTree(relative, 'constituency', lookup))).toContain('[SBAR [WHNP [WDT that₁]] [S t₁ [VP');
  expect(treeText(drawTree(relative, 'dependency', lookup))).toContain('4 grew 2 acl:relcl');
  const ccg = drawTree(relative, 'ccg', lookup);
  expect(ccg.nodes[0].label).toBe('S');
  expect(ccg.nodes.some(node => node.label === '?')).toBe(false);
  for (const [sentence, marker] of [['The claim that she left surprised me.', '[IN that]'], ['That was true.', '[DT That]']]) {
    const diagram = drawTree(sentence, 'constituency', lookup);
    expect(treeText(diagram)).toContain(marker);
    expect(traceLabel(diagram)).toBeUndefined();
  }
});

it('keeps movement in phrase presentations and overt words in dependencies', () => {
  for (const form of ['constituency', 'xbar', 'bare', 'tag', 'cst', 'ast', 'feature'] as const) {
    const text = treeText(drawTree('what did you see', form, lookup));
    expect(text, form).toContain('₁');
  }
  for (const form of ['ccg', 'dependency'] as const) expect(treeText(drawTree('what did you see', form, lookup))).not.toContain('₁');
  const feature = drawTree('what did you see', 'feature', lookup);
  expect(feature.nodes.some(node => node.label.startsWith('what₁|'))).toBe(true);
  expect(layoutTree(feature).edges.filter(edge => edge.movement)).toHaveLength(1);
});

it('names a saved diagram after its words, not its notation', () => {
  const diagram = drawTree('what did you see', 'constituency', lookup);
  expect(treeFileName(diagram)).toBe('what-did-you-see');
  expect(sentenceFileName('what did you see')).toBe('what-did-you-see');
});

it('draws an upward arrow from the trace to the constituent that moved', () => {
  const diagram = drawTree('what did you see', 'constituency', lookup);
  const layout = layoutTree(diagram);
  const arrows = layout.edges.filter(edge => edge.movement);
  expect(arrows).toHaveLength(1);
  const trace = diagram.nodes.find(node => isTraceLabel(node.label))!;
  const filler = diagram.nodes.find(node => node.label.startsWith('what'))!;
  const traceBox = layout.nodes.find(node => node.id === trace.id)!;
  const fillerBox = layout.nodes.find(node => node.id === filler.id)!;
  // The line leaves the trace's bottom, runs along a rail below both nodes, and rises into the
  // landing site, so it never crosses a node box.
  expect(Math.abs(arrows[0].x1 - (traceBox.x + traceBox.width / 2))).toBeLessThan(1);
  expect(Math.abs(arrows[0].y1 - (traceBox.y + traceBox.height))).toBeLessThan(1);
  expect(Math.abs(arrows[0].y2 - (fillerBox.y + fillerBox.height))).toBeLessThan(1);
  expect(arrows[0].rail).toBeGreaterThan(Math.max(arrows[0].y1, arrows[0].y2));
  const svg = treeSvg(layout, { line: '#000' });
  expect(svg).toContain(movementPath(arrows[0]));
  // Its arrowhead points up at the landing site, so the base sits below the apex.
  expect(svg).toContain(`M ${arrows[0].x2} ${arrows[0].y2} L ${arrows[0].x2 - 4.5} ${arrows[0].y2 + 9}`);
});

it('separates nested, crossing and reversed movement spans, reusing rails only for disjoint spans', () => {
  for (const source of [
    '(S a₁ b₂ t₂ t₁)',
    '(S a₁ b₂ t₁ t₂)',
    '(S t₁ t₂ b₂ a₁)',
    '(S a₁ t₁ b₂ t₂)',
    '(S a₁ (VP b₂ (V t₂) t₁))',
    '(S a₁ b₂ c₃ d₄ t₄ t₃ t₂ t₁)',
    '(S what₁ who₂ (VP (V saw) t₂ t₁))',
    '(S (NP₁ (N parent)) (VP (V (V child)) t₁))',
    '(S (A₁ (B₂ ("wide wide wide wide wide" word))) t₁ t₂)',
    '(S (NP₁ (N (N child))) (VP₂ (V (V child)) t₁ t₂))',
  ]) {
    const diagram = drawTree(source);
    const layout = layoutTree(diagram);
    const arrows = layout.edges.filter(edge => edge.movement);
    expect(arrows.length, source).toBeGreaterThanOrEqual(1);
    const bottom = Math.max(...layout.nodes.map(node => node.y + node.height));
    for (const [index, edge] of arrows.entries()) {
      expect(edge.rail!, source).toBeGreaterThanOrEqual(Math.max(edge.y1, edge.y2) + 18);
      for (const [i, point] of edge.points!.entries()) {
        if (!i) continue;
        const prev = edge.points![i - 1];
        expect(point.x === prev.x || point.y === prev.y).toBe(true);
        for (const node of layout.nodes) {
          const crosses = point.x === prev.x
            ? point.x > node.x && point.x < node.x + node.width && Math.max(point.y, prev.y) > node.y && Math.min(point.y, prev.y) < node.y + node.height
            : point.y > node.y && point.y < node.y + node.height && Math.max(point.x, prev.x) > node.x && Math.min(point.x, prev.x) < node.x + node.width;
          expect(crosses, `${source}: ${node.label}`).toBe(false);
        }
      }
      expect(layout.height, source).toBeGreaterThanOrEqual(edge.rail! + 20);
      for (const other of arrows.slice(index + 1)) {
        const overlaps = Math.max(Math.min(edge.x1, edge.x2), Math.min(other.x1, other.x2)) <= Math.min(Math.max(edge.x1, edge.x2), Math.max(other.x1, other.x2));
        if (overlaps && edge.rail! > bottom && other.rail! > bottom) {
          expect(Math.abs(edge.rail! - other.rail!), source).toBeGreaterThanOrEqual(18);
        }
      }
    }
    const horizontals = arrows.flatMap(edge => edge.points!.slice(1).flatMap((point, index) => {
      const prev = edge.points![index];
      return point.y === prev.y && point.x !== prev.x ? [{ y: point.y, left: Math.min(point.x, prev.x), right: Math.max(point.x, prev.x) }] : [];
    }));
    for (const [i, line] of horizontals.entries()) for (const other of horizontals.slice(i + 1)) {
      expect(line.y === other.y && Math.max(line.left, other.left) < Math.min(line.right, other.right), source).toBe(false);
    }
    if (source === '(S a₁ t₁ b₂ t₂)') expect(arrows[0].rail).toBe(arrows[1].rail);
    if (source === '(S a₁ b₂ t₂ t₁)') expect(arrows.find(edge => edge.x1 - edge.x2 > arrows[0].x1 - arrows[0].x2)!.rail).toBeGreaterThan(arrows[0].rail!);
    expect(layoutTree({ ...diagram, nodes: [...diagram.nodes].reverse() }).edges.filter(edge => edge.movement)).toEqual(arrows);
    const svg = treeSvg(layout, { line: '#000' });
    const pdf = new TextDecoder().decode(treePdf({ ...layout, nodes: layout.nodes.map(node => ({ ...node, label: 'X' })) }, layout.nodes.map(() => null)));
    for (const edge of arrows) {
      expect(svg).toContain(movementPath(edge));
      for (const stroke of movementStrokes(edge)) {
        expect(pdf).toContain(stroke.map((point, index) => `${point.x} ${Math.round((layout.height - point.y) * 100) / 100} ${index ? 'l' : 'm'}`).join('\n'));
      }
      expect(pdf).toContain(`${edge.x2} ${layout.height - edge.y2} m\n${edge.x2 - 4.5} ${layout.height - edge.y2 - 9} l`);
    }
  }
});

it('keeps the branch continuous through an unavoidable bottom-route crossing', () => {
  const layout = layoutTree(drawTree('Where did Mary put the book which John read?', 'constituency', lookup));
  const arrows = layout.edges.filter(edge => edge.movement);
  const bent = arrows.find(edge => edge.points!.length > 4)!;
  const [from, corner, turn] = bent.points!;
  expect(from.x).toBe(corner.x);
  expect(corner.y).toBe(turn.y);
  const y = corner.y;
  const x = layout.edges.filter(edge => !edge.movement && edge.y1 < y && y < edge.y2)
    .map(edge => edge.x1 + (edge.x2 - edge.x1) * (y - edge.y1) / (edge.y2 - edge.y1))
    .find(x => x > Math.min(corner.x, turn.x) && x < Math.max(corner.x, turn.x))!;
  expect(x).toBeDefined();
  expect(movementStrokes(bent).length).toBeGreaterThan(1);
  for (const stroke of movementStrokes(bent)) {
    for (const [index, end] of stroke.slice(1).entries()) {
      const start = stroke[index];
      if (start.y === y && end.y === y) {
        expect(Math.min(start.x, end.x) < x && x < Math.max(start.x, end.x)).toBe(false);
      }
    }
  }
});

it('gives crossed movement rails more room without spreading disjoint links', () => {
  const crossed = layoutTree(drawTree('(S a₁ b₂ t₁ t₂)'));
  const crossing = crossed.edges.find(edge => edge.strokes)!;
  const [start, stop] = crossing.strokes![0];
  expect(start.x).toBe(stop.x);
  expect(Math.abs(stop.y - start.y)).toBeGreaterThanOrEqual(24);

  const disjoint = layoutTree(drawTree('(S a₁ t₁ b₂ t₂)'));
  const arrows = disjoint.edges.filter(edge => edge.movement);
  expect(arrows).toHaveLength(2);
  expect(arrows.every(edge => !edge.strokes && edge.rail === edge.y1 + 18)).toBe(true);
  expect(disjoint.height).toBeLessThan(crossed.height);
});

it('widens branches when the extra room clears a crossing in an X′ tree', () => {
  const diagram = drawTree('The book I read was written by Mary', 'xbar', lookup);
  const layout = layoutTree(diagram);
  const arrows = layout.edges.filter(edge => edge.movement);
  expect(layout.width).toBeGreaterThan(900);
  expect(arrows).toHaveLength(3);
  expect(arrows.map(edge => movementStrokes(edge).length).sort()).toEqual([1, 1, 2]);
  expect(layoutTree({ ...diagram, nodes: [...diagram.nodes].reverse() })).toMatchObject({
    width: layout.width,
    height: layout.height,
  });
});

it('lengthens branches when a taller layout makes both movement paths continuous', () => {
  const diagram = drawTree('(AA (BBB₁ (CCC₂ (FFF I JJJ))) D EE (GGG (HH t₁) t₂))');
  const layout = layoutTree(diagram);
  const branches = layout.edges.filter(edge => !edge.movement);
  expect(branches.every(edge => edge.y2 - edge.y1 > 28)).toBe(true);
  const arrows = layout.edges.filter(edge => edge.movement);
  expect(arrows).toHaveLength(2);
  expect(arrows.every(edge => !edge.strokes)).toBe(true);
});

it('keeps arrowheads separate on a heavily shared target', () => {
  const layout = layoutTree(drawTree('(S b₁ (VP t₁ t₁ t₁ t₁ t₁ t₁ t₁))'));
  const heads = layout.edges.filter(edge => edge.movement).map(treeArrowPoints).sort((a, b) => a[0].x - b[0].x);
  expect(heads).toHaveLength(7);
  for (const [, left, right] of heads) expect(right.x - left.x).toBeCloseTo(9);
  for (let i = 1; i < heads.length; i++) expect(heads[i - 1][2].x).toBeLessThan(heads[i][1].x);
});

it('does not fold both legs of a bottom route onto the same column', () => {
  const layout = layoutTree(drawTree('(WWWWW (WWWWWWWWW₁ (WWWWWWWWWW (WW WWWWWWW WWWWWWWW (WWWWWWWWWW WW))) (WWWWW t₁)) WW)'));
  const route = layout.edges.find(edge => edge.movement)!.points!;
  const points = route.filter(point => point.y === Math.max(...route.map(point => point.y)));
  expect(new Set(points.map(point => point.x)).size).toBe(2);
});

it('keeps both X′ movement arrows close to the worked-example nodes', () => {
  const diagram = drawTree('The man who caught the ball is my uncle', 'xbar', lookup);
  const layout = layoutTree(diagram);
  const movements = layout.edges.filter(edge => edge.movement);
  expect(movements).toHaveLength(2);
  for (const label of ['who₁', 'is₂']) {
    const node = layout.nodes.find(node => node.label === label)!;
    const edge = movements.find(edge => Math.abs(edge.x2 - node.x - node.width / 2) < .01 && edge.y2 === node.y + node.height)!;
    expect(edge.rail).toBe(Math.max(edge.y1, edge.y2) + 18);
  }
  expect(layout.height).toBe(Math.max(...layout.nodes.map(node => node.y + node.height)) + 20);
});

it('shortens a deep aligned link and moves wider obstructed rails below the branches', () => {
  const deep = layoutTree(drawTree('(S (A₁ (B (C (D t₁)))) (VP (V (V (V (V (V (V tail))))))))'));
  const aligned = deep.edges.find(edge => edge.movement)!;
  expect(aligned.rail).toBe(Math.max(aligned.y1, aligned.y2) + 18);

  const wide = layoutTree(drawTree('Where did Mary put the book which John read?', 'constituency', lookup));
  const bottom = Math.max(...wide.nodes.map(node => node.y + node.height));
  const arrows = wide.edges.filter(edge => edge.movement);
  expect(arrows).toHaveLength(2);
  for (const edge of arrows) expect(edge.rail).toBeGreaterThan(bottom);
});

it('keeps movement into a phrase from covering its vertical child branch', () => {
  const layout = layoutTree(drawTree('(S (A₁ (V word)) (B t₁) (VP (V (V (V tail)))))'));
  const arrow = layout.edges.find(edge => edge.movement)!;
  const target = layout.nodes.find(node => node.label === 'A₁')!;
  const center = target.x + target.width / 2;
  expect(layout.edges.some(edge => !edge.movement && edge.x1 === center && edge.x2 === center && edge.y1 === arrow.y2)).toBe(true);
  expect(Math.abs(arrow.x2 - center)).toBeGreaterThanOrEqual(9);
  expect(arrow.x2).toBeLessThan(target.x + target.width - 4.5);
});

it('links and unlinks a movement by hand', () => {
  const base = drawTree('the man I met left', 'constituency', lookup);
  const trace = base.nodes.find(node => isTraceLabel(node.label));
  // The automatic analysis already coindexes this one; clear it first to test the manual path.
  const cleared = trace ? unlinkMovement(base, trace.id) : base;
  expect(cleared.nodes.every(node => labelIndex(node.label) === undefined)).toBe(true);
  const filler = cleared.nodes.find(node => node.label === 'man')!;
  const gap = cleared.nodes.find(node => node.label === 't') ?? { id: cleared.nodes.at(-1)!.id, label: 't' };
  const withTrace = gap.id === cleared.nodes.at(-1)!.id
    ? treeDiagramSchema.parse({ ...cleared, nodes: cleared.nodes.map(node => node.id === gap.id ? { ...node, label: 't' } : node) })
    : cleared;
  const linked = linkMovement(withTrace, filler.id, gap.id);
  const linkedFiller = linked.nodes.find(node => node.id === filler.id)!;
  const linkedTrace = linked.nodes.find(node => node.id === gap.id)!;
  expect(labelIndex(linkedFiller.label)).toBe(1);
  expect(labelIndex(linkedTrace.label)).toBe(1);
  expect(linkedTrace.label.startsWith('t')).toBe(true);
  // Linking again replaces the index instead of stacking subscripts.
  const relinked = linkMovement(linked, filler.id, gap.id);
  expect(relinked.nodes.filter(node => node.label.startsWith('man')).map(node => node.label)).toEqual(['man₂']);
  // Unlinking clears both sides.
  const unlinked = unlinkMovement(relinked, filler.id);
  expect(unlinked.nodes.every(node => labelIndex(node.label) === undefined)).toBe(true);
  expect(() => linkMovement(unlinked, filler.id, filler.id)).toThrow();
});

it('treats a manually indexed pair the same way as an automatic one', () => {
  const diagram = treeDiagramSchema.parse({
    root: 'n1',
    nodes: [
      { id: 'n1', label: 'S', children: ['n2', 'n3'] },
      { id: 'n2', label: 'NP', children: ['n4'] },
      { id: 'n4', label: 'what₂', children: [] },
      { id: 'n3', label: 'VP', children: ['n5', 'n6'] },
      { id: 'n5', label: 'see', children: [] },
      { id: 'n6', label: 't₂', children: [] },
    ],
  });
  const layout = layoutTree(diagram);
  expect(layout.edges.filter(edge => edge.movement)).toHaveLength(1);
  const dependency = drawTree(treeText(diagram), 'dependency');
  expect(dependency.nodes.some(node => isTraceLabel(node.label))).toBe(false);
  expect(dependency.nodes.map(node => node.label)).toEqual(['what', 'see']);
  // A hand-linked pair of ordinary words also draws an arc: the deeper node is the trace side.
  const linked = treeDiagramSchema.parse({
    root: 'n1',
    nodes: [
      { id: 'n1', label: 'S', children: ['n2', 'n3'] },
      { id: 'n2', label: 'Mary₁', children: [] },
      { id: 'n3', label: 'VP', children: ['n4'] },
      { id: 'n4', label: 'left₁', children: [] },
    ],
  });
  const linkedArcs = layoutTree(linked).edges.filter(edge => edge.movement);
  expect(linkedArcs).toHaveLength(1);
  const left = layoutTree(linked).nodes.find(node => node.label === 'left₁')!;
  expect(Math.abs(linkedArcs[0].x1 - (left.x + left.width / 2))).toBeLessThan(1);
});

it('allocates a free movement index when the tree already uses 99', () => {
  const diagram = drawTree('(S known₉₉ t₉₉ new t)');
  const filler = diagram.nodes.find(node => node.label === 'new')!;
  const trace = diagram.nodes.find(node => node.label === 't')!;
  const linked = linkMovement(diagram, filler.id, trace.id);
  expect(linked.nodes.map(node => node.label)).toEqual(['S', 'known₉₉', 't₉₉', 'new₁', 't₁']);
  expect(layoutTree(linked).edges.filter(edge => edge.movement)).toHaveLength(2);
  expect(() => nextIndex(Array.from({ length: 99 }, (_, index) => withIndex('used', index + 1)))).toThrow('TREE_MOVE_INDEX');
});

it('keeps equal-depth manual arrow directions when stored nodes are reordered', () => {
  const diagram = drawTree('(S A₁ B₁)');
  const movements = (tree: TreeDiagram) => layoutTree(tree).edges.filter(edge => edge.movement);
  expect(movements(diagram)).toHaveLength(1);
  expect(movements({ ...diagram, nodes: [...diagram.nodes].reverse() })).toEqual(movements(diagram));
});


it.each([
  ['the city where I live is old', 'where', 'ADVP'],
  ['the man who caught the ball is my uncle', 'who', 'S'],
  ['who wrote this letter', 'who', 'S'],
  ['which student won the prize', 'which', 'S'],
  ['whose car broke down', 'whose', 'S'],
  ['the book which fell was old', 'which', 'S'],
  ['what has she written', 'what', 'VP'],
  ['what did he say that Mary bought', 'what', 'VP'],
  ['who did you talk to', 'who', 'PP'],
  ['which chair did she sit on', 'which', 'PP'],
  ['to whom did you speak', 'whom', 'PP'],
  ['where did he put the book', 'where', 'ADVP'],
  ['when did she arrive', 'when', 'ADVP'],
  ['why did he leave', 'why', 'ADVP'],
  ['the city was founded', 'city', 'VP'],
  ['the letter has been written by Mary', 'letter', 'VP'],
  ['the students were given a test', 'students', 'VP'],
])('marks the actual extraction position: %s', (sentence, filler, parentLabel) => {
  const diagram = drawTree(sentence, 'constituency', lookup);
  const gap = diagram.nodes.find(node => isTraceLabel(node.label))!;
  expect(gap?.label).toBe('t₁');
  expect(indexed(diagram, filler)).toBe(`${filler}₁`);
  expect(diagram.nodes.find(node => node.children.includes(gap.id))?.label).toBe(parentLabel);
  expect(layoutTree(diagram).edges.filter(edge => edge.movement)).toHaveLength(1);
  const dependency = drawTree(sentence, 'dependency', lookup);
  expect(dependency.nodes.map(node => node.label)).toEqual(sentence.split(' '));
  expect(dependency.nodes.some(node => isTraceLabel(node.label))).toBe(false);
});

it.each([
  ['I asked who wrote the letter', 'who'],
  ['I know who came', 'who'],
  ['she wondered which book he read', 'which'],
  ['I asked what she bought', 'what'],
  ['I know what he has written', 'what'],
  ['I know what he said that Mary bought', 'what'],
])('marks overt wh extraction inside an embedded clause: %s', (sentence, filler) => {
  const diagram = drawTree(sentence, 'constituency', lookup);
  expect(indexed(diagram, filler)).toBe(`${filler}₁`);
  expect(diagram.nodes.filter(node => isTraceLabel(node.label))).toHaveLength(1);
  expect(layoutTree(diagram).edges.filter(edge => edge.movement)).toHaveLength(1);
  expect(drawTree(sentence, 'dependency', lookup).nodes.map(node => node.label)).toEqual(sentence.split(' '));
});

it.each([
  ['the letter from Mary was written by John', 'letter', 'Mary'],
  ['the book on the table was written by Mary', 'book', 'table'],
])('indexes the passive subject head rather than its modifier: %s', (sentence, head, modifier) => {
  const diagram = drawTree(sentence, 'constituency', lookup);
  expect(indexed(diagram, head)).toBe(`${head}₁`);
  expect(indexed(diagram, modifier)).toBeUndefined();
  const edge = layoutTree(diagram).edges.find(edge => edge.movement)!;
  const target = layoutTree(diagram).nodes.find(node => node.label === `${head}₁`)!;
  expect(edge.x2).toBe(target.x + target.width / 2);
});

it('keeps relative and passive chains separate without reindexing a trace as a filler', () => {
  const diagram = drawTree('the book which John read was written by Mary', 'constituency', lookup);
  expect(indexed(diagram, 'which')).toBe('which₁');
  expect(indexed(diagram, 'book')).toBe('book₂');
  expect(diagram.nodes.filter(node => isTraceLabel(node.label)).map(node => node.label)).toEqual(['t₁', 't₂']);
  expect(layoutTree(diagram).edges.filter(edge => edge.movement)).toHaveLength(2);
});

it('retains every gap sharing a lexical antecedent in layout and exports', () => {
  const diagram = drawTree('the book I read was written by Mary', 'constituency', lookup);
  expect(indexed(diagram, 'book')).toBe('book₁');
  expect(diagram.nodes.filter(node => isTraceLabel(node.label)).map(node => node.label)).toEqual(['t₁', 't₁']);
  const layout = layoutTree(diagram);
  const movements = layout.edges.filter(edge => edge.movement);
  expect(movements).toHaveLength(2);
  expect(Math.abs(movements[0].x2 - movements[1].x2)).toBeGreaterThanOrEqual(9);
  for (const edge of movements) {
    const terminals = layout.nodes.filter(node => node.label === 'I' || node.label === 'read');
    expect(terminals).toHaveLength(2);
    expect(edge.rail).toBeGreaterThan(Math.max(...terminals.map(node => node.y + node.height)));
    for (const [index, end] of edge.points!.slice(1).entries()) {
      const start = edge.points![index];
      if (start.y !== end.y) continue;
      const [left, right] = [start.x, end.x].sort((a, b) => a - b);
      for (const node of layout.nodes.filter(node => node.x < right && node.x + node.width > left)) {
        expect(start.y <= node.y - 4 || start.y >= node.y + node.height + 4).toBe(true);
      }
    }
  }
  expect(layoutTree({ ...diagram, nodes: [...diagram.nodes].reverse() }).edges.filter(edge => edge.movement)).toEqual(movements);
  for (const edge of movements) expect(treeSvg(layout, { line: '#000' })).toContain(movementPath(edge));
  expect(drawTree('the book I read was written by Mary', 'dependency', lookup).nodes.map(node => node.label)).toEqual('the book I read was written by Mary'.split(' '));
  expect(layoutTree(drawTree('(S book₁ (VP t₁ t₁))')).edges.filter(edge => edge.movement)).toHaveLength(2);
  expect(layoutTree(drawTree('(S t₁ t₁)')).edges.filter(edge => edge.movement)).toHaveLength(0);
});

it('does not let a nested clause gap suppress a matrix adverbial gap', () => {
  const diagram = drawTree('where did Mary put the book which John read', 'constituency', lookup);
  expect(indexed(diagram, 'which')).toBe('which₁');
  expect(indexed(diagram, 'where')).toBe('where₂');
  const gap = diagram.nodes.find(node => node.label === 't₂')!;
  expect(diagram.nodes.find(node => node.children.includes(gap.id))?.label).toBe('ADVP');
  expect(layoutTree(diagram).edges.filter(edge => edge.movement)).toHaveLength(2);
});

it('keeps temporal adjuncts distinct from interrogative operators', () => {
  for (const sentence of ['she smiled when he arrived', 'when he arrived we left']) {
    expect(drawTree(sentence, 'constituency', lookup).nodes.some(node => isTraceLabel(node.label))).toBe(false);
  }
});


it('keeps a by-passive wh-question verbal rather than treating its participle as a subject noun', () => {
  const diagram = drawTree('who was seen by Mary', 'constituency', lookup);
  expect(indexed(diagram, 'who')).toBe('who₁');
  expect(diagram.nodes.some(node => node.label === 'VBN' && diagram.nodes.find(word => word.id === node.children[0])?.label === 'seen')).toBe(true);
  expect(layoutTree(diagram).edges.filter(edge => edge.movement)).toHaveLength(1);
  expect(treeText(diagram)).toContain('[S t₁ [VP [VBD was]');
  const dependency = drawTree('who was seen by Mary', 'dependency', lookup);
  expect(dependency.nodes.find(node => node.label === 'who')?.role).toBe('nsubj:pass');
  expect(dependency.nodes.find(node => node.label === 'was')?.role).toBe('aux:pass');
  expect(dependency.nodes.find(node => node.label === 'Mary')?.role).toBe('obl:agent');
  const nominal = drawTree('what was the book by Mary', 'constituency', lookup);
  expect(nominal.nodes.some(node => node.label === 'VBN')).toBe(false);
});

it('locates subject and object gaps across dictionary-licensed zero-that complements', () => {
  for (const [sentence, predicate, role, gap] of [
    ['who do you think wrote the letter', 'wrote', 'nsubj', '[S t₁ [VP [VBD wrote]'],
    ['what do you think John bought', 'bought', 'obj', '[VP [VBD bought] t₁]'],
    ['who do you believe Mary said wrote the letter', 'wrote', 'nsubj', '[S t₁ [VP [VBD wrote]'],
    ['what did Mary say John thought Bill bought', 'bought', 'obj', '[VP [VBD bought] t₁]'],
    ['who do you think has left', 'left', 'nsubj', '[S t₁ [VP [VBZ has]'],
  ]) {
    const tree = drawTree(sentence, 'constituency', lookup);
    expect(treeText(tree), sentence).toContain(gap);
    expect(layoutTree(tree).edges.filter(edge => edge.movement), sentence).toHaveLength(1);
    const dependencies = drawTree(sentence, 'dependency', lookup);
    const filler = dependencies.nodes.find(node => node.label === sentence.split(' ')[0])!;
    expect(filler.role, sentence).toBe(role);
    expect(dependencies.nodes.find(node => node.label === predicate)?.children, sentence).toContain(filler.id);
    expect(dependencies.nodes.map(node => node.label), sentence).toEqual(sentence.split(' '));
    expect(treeText(drawTree(sentence, 'ccg', lookup)), sentence).not.toMatch(/t₁|who₁|what₁/u);
  }
  expect(treeText(drawTree('the book which I think John bought is old', 'constituency', lookup))).toContain('[VP [VBD bought] t₁]');
});

it('attaches fronted adjuncts and stranded prepositions at their generated gap', () => {
  for (const [sentence, fillerWord, predicateWord, role, caseWord] of [
    ['who did she speak to', 'who', 'speak', 'obl', 'to'],
    ['where did he put the book', 'where', 'put', 'advmod', ''],
    ['to whom did you speak', 'whom', 'speak', 'obl', 'to'],
    ['who do you think John spoke to', 'who', 'spoke', 'obl', 'to'],
  ]) {
    const tree = drawTree(sentence, 'dependency', lookup);
    const filler = tree.nodes.find(node => node.label === fillerWord)!;
    const predicate = tree.nodes.find(node => node.label === predicateWord)!;
    expect(filler.role, sentence).toBe(role);
    expect(predicate.children, sentence).toContain(filler.id);
    if (caseWord) {
      const marker = tree.nodes.find(node => node.label === caseWord)!;
      expect(marker.role, sentence).toBe('case');
      expect(filler.children, sentence).toContain(marker.id);
    }
    expect(tree.nodes.map(node => node.label), sentence).toEqual(sentence.split(' '));
  }
});

it('marks embedded non-temporal wh adjuncts and pied-piped complements', () => {
  for (const [sentence, filler, gap, predicateWord, role] of [
    ['I know where she lives', 'where₁', '[ADVP t₁]', 'lives', 'advmod'],
    ['I asked why she left', 'why₁', '[ADVP t₁]', 'left', 'advmod'],
    ['I know how he solved the problem', 'how₁', '[ADVP t₁]', 'solved', 'advmod'],
    ['I asked to whom she spoke', 'whom₁', '[PP t₁]', 'spoke', 'obl'],
  ]) {
    const diagram = drawTree(sentence, 'constituency', lookup);
    expect(diagram.nodes.some(node => node.label === filler), sentence).toBe(true);
    expect(treeText(diagram), sentence).toContain(gap);
    expect(layoutTree(diagram).edges.filter(edge => edge.movement), sentence).toHaveLength(1);
    const dependency = drawTree(sentence, 'dependency', lookup);
    const operator = dependency.nodes.find(node => node.label === withoutIndex(filler))!;
    expect(operator.role, sentence).toBe(role);
    expect(dependency.nodes.find(node => node.label === predicateWord)?.children, sentence).toContain(operator.id);
    expect(dependency.nodes.map(node => node.label), sentence).toEqual(sentence.split(' '));
  }
  for (const sentence of ['I left when she arrived', 'I wonder whether she left']) {
    expect(drawTree(sentence, 'constituency', lookup).nodes.some(node => isTraceLabel(node.label)), sentence).toBe(false);
  }
});

it('places an existing prepositional-passive gap inside the preposition phrase', () => {
  for (const [sentence, preposition, subjectWord] of [
    ['the chair was sat on', 'on', 'chair'],
    ['this problem was talked about', 'about', 'problem'],
    ['the paper was written on', 'on', 'paper'],
  ]) {
    expect(treeText(drawTree(sentence, 'constituency', lookup)), sentence).toContain(`[PP [IN ${preposition}] t₁]`);
    const dependency = drawTree(sentence, 'dependency', lookup);
    const subject = dependency.nodes.find(node => node.label === subjectWord)!;
    const marker = dependency.nodes.find(node => node.label === preposition)!;
    expect(subject.role, sentence).toBe('nsubj:pass');
    expect(marker.role, sentence).toBe('case');
    expect(subject.children, sentence).toContain(marker.id);
    expect(dependency.nodes.map(node => node.label), sentence).toEqual(sentence.split(' '));
  }
});

it('retains missing irregular participles after be and have', () => {
  for (const [sentence, participle] of [
    ['she has slept', 'slept'],
    ['the house was sold', 'sold'],
    ['she has got a book', 'got'],
  ]) expect(treeText(drawTree(sentence, 'constituency', lookup)), sentence).toContain(`[VBN ${participle}]`);
  expect(drawTree('the house was sold', 'dependency', lookup).nodes.find(node => node.label === 'house')?.role).toBe('nsubj:pass');
});


it('keeps do and have bare after infinitives, modals and do-support', () => {
  for (const [sentence, word] of [
    ['I asked how to do it', 'do'],
    ['I want to have a book', 'have'],
    ['she will have a book', 'have'],
    ['she will not do it', 'do'],
    ['did you have a book', 'have'],
    ['she did not do it', 'do'],
  ]) expect(treeText(drawTree(sentence, 'constituency', lookup)), sentence).toContain(`[VB ${word}]`);
  expect(treeText(drawTree('I have a book', 'constituency', lookup))).toContain('[VBP have]');
  expect(treeText(drawTree('I do it', 'constituency', lookup))).toContain('[VBP do]');
});
