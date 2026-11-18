/*
 * Tidy tree layout (variable-size nodes, linear time).
 *
 * TypeScript adaptation of `non-layered-tidy-tree-layout` 2.0.2
 * (https://github.com/stetrevor/non-layered-tidy-tree-layout), a JavaScript port of
 * cwi-swat/non-layered-tidy-trees. The algorithm is A.J. van der Ploeg,
 * "Drawing Non-layered Tidy Trees in Linear Time" (2013), which extends
 * Reingold-Tilford / Walker / Buchheim-Junger-Leipert to nodes of different sizes.
 *
 * MIT License
 *
 * Copyright (c) 2019 Michael Wong
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

export type TidyInput = { id: string; width: number; height: number; children: TidyInput[] };

class Node {
  x = 0;
  prelim = 0;
  mod = 0;
  shift = 0;
  change = 0;
  leftThread: Node | null = null;
  rightThread: Node | null = null;
  extremeLeft: Node | null = null;
  extremeRight: Node | null = null;
  modSumExtremeLeft = 0;
  modSumExtremeRight = 0;
  readonly children: Node[];

  constructor(readonly input: TidyInput, readonly width: number, readonly height: number, readonly y: number, readonly horizontalGap: number, readonly verticalGap: number) {
    this.children = input.children.map(child => new Node(child, child.width + horizontalGap, child.height + verticalGap, y + height, horizontalGap, verticalGap));
  }
}

function bottom(node: Node) {
  return node.y + node.height;
}

function setExtremes(node: Node) {
  if (!node.children.length) {
    node.extremeLeft = node.extremeRight = node;
    node.modSumExtremeLeft = node.modSumExtremeRight = 0;
    return;
  }
  node.extremeLeft = node.children[0].extremeLeft;
  node.modSumExtremeLeft = node.children[0].modSumExtremeLeft;
  node.extremeRight = node.children[node.children.length - 1].extremeRight;
  node.modSumExtremeRight = node.children[node.children.length - 1].modSumExtremeRight;
}

// Linked list of left-sibling indexes and their lowest vertical coordinate.
class IndexLowY {
  constructor(readonly lowY: number, readonly index: number, readonly next: IndexLowY | null) {}
}

function updateIndexLowY(minY: number, index: number, list: IndexLowY | null) {
  // Drop siblings hidden by the new subtree.
  while (list !== null && minY >= list.lowY) list = list.next;
  return new IndexLowY(minY, index, list);
}

function distributeExtra(node: Node, index: number, previous: number, distance: number) {
  if (previous === index - 1) return;
  const count = index - previous;
  node.children[previous + 1].shift += distance / count;
  node.children[index].shift -= distance / count;
  node.children[index].change -= distance - distance / count;
}

function moveSubtree(node: Node, index: number, previous: number, distance: number) {
  node.children[index].mod += distance;
  node.children[index].modSumExtremeLeft += distance;
  node.children[index].modSumExtremeRight += distance;
  distributeExtra(node, index, previous, distance);
}

const nextLeftContour = (node: Node) => node.children.length ? node.children[0] : node.leftThread;
const nextRightContour = (node: Node) => node.children.length ? node.children[node.children.length - 1] : node.rightThread;

function setLeftThread(node: Node, index: number, contour: Node, modSum: number) {
  const left = node.children[0].extremeLeft!;
  left.leftThread = contour;
  const difference = modSum - contour.mod - node.children[0].modSumExtremeLeft;
  left.mod += difference;
  left.prelim -= difference;
  node.children[0].extremeLeft = node.children[index].extremeLeft;
  node.children[0].modSumExtremeLeft = node.children[index].modSumExtremeLeft;
}

function setRightThread(node: Node, index: number, contour: Node, modSum: number) {
  const right = node.children[index].extremeRight!;
  right.rightThread = contour;
  const difference = modSum - contour.mod - node.children[index].modSumExtremeRight;
  right.mod += difference;
  right.prelim -= difference;
  node.children[index].extremeRight = node.children[index - 1].extremeRight;
  node.children[index].modSumExtremeRight = node.children[index - 1].modSumExtremeRight;
}

// Move the right subtree right until its left contour clears the left contour of its siblings.
function separate(node: Node, index: number, list: IndexLowY | null) {
  let right = node.children[index - 1], rightMod = right.mod;
  let left = node.children[index], leftMod = left.mod;
  while (right !== null && left !== null) {
    if (list !== null && bottom(right) > list.lowY) list = list.next;
    const distance = rightMod + right.prelim + right.width - (leftMod + left.prelim);
    if (distance > 0) {
      leftMod += distance;
      moveSubtree(node, index, list ? list.index : index - 1, distance);
    }
    const rightBottom = bottom(right), leftBottom = bottom(left);
    if (rightBottom <= leftBottom) {
      right = nextRightContour(right) as Node;
      if (right !== null) rightMod += right.mod;
    }
    if (rightBottom >= leftBottom) {
      left = nextLeftContour(left) as Node;
      if (left !== null) leftMod += left.mod;
    }
  }
  if (right === null && left !== null) setLeftThread(node, index, left, leftMod);
  else if (right !== null && left === null) setRightThread(node, index, right, rightMod);
}

function positionRoot(node: Node) {
  const last = node.children[node.children.length - 1];
  node.prelim = (node.children[0].prelim + node.children[0].mod + last.mod + last.prelim + last.width) / 2 - node.width / 2;
}

function firstWalk(node: Node) {
  if (!node.children.length) { setExtremes(node); return; }
  firstWalk(node.children[0]);
  let list: IndexLowY | null = updateIndexLowY(bottom(node.children[0].extremeLeft!), 0, null);
  for (let index = 1; index < node.children.length; index++) {
    firstWalk(node.children[index]);
    separate(node, index, list);
    list = updateIndexLowY(bottom(node.children[index].extremeRight!), index, list);
  }
  positionRoot(node);
  setExtremes(node);
}

function addChildSpacing(node: Node) {
  let distance = 0, modSumDelta = 0;
  node.children.forEach(child => {
    distance += child.shift;
    modSumDelta += distance + child.change;
    child.mod += modSumDelta;
  });
}

function secondWalk(node: Node, modSum: number) {
  modSum += node.mod;
  node.x = node.prelim + modSum;
  addChildSpacing(node);
  node.children.forEach(child => secondWalk(child, modSum));
}

export function tidyTreeLayout(root: TidyInput, horizontalGap: number, verticalGap: number) {
  const tree = new Node(root, root.width + horizontalGap, root.height + verticalGap, 0, horizontalGap, verticalGap);
  firstWalk(tree);
  secondWalk(tree, 0);
  const placed = new Map<string, { x: number; y: number }>();
  const bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
  const collect = (node: Node) => {
    const x = node.x + horizontalGap / 2;
    placed.set(node.input.id, { x, y: node.y });
    bounds.left = Math.min(bounds.left, x);
    bounds.right = Math.max(bounds.right, x + node.input.width);
    bounds.top = Math.min(bounds.top, node.y);
    bounds.bottom = Math.max(bounds.bottom, node.y + node.input.height);
    node.children.forEach(collect);
  };
  collect(tree);
  if (!placed.size) throw new Error('TREE_LAYOUT');
  return { placed, bounds };
}
