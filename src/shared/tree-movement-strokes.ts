import type { TreeLayout } from './tree';

type Edge = TreeLayout['edges'][number];
type Point = NonNullable<Edge['points']>[number];
type Segment = readonly [Point, Point];
type Interval = [number, number];

const gap = 4;
const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;
const pointAt = (a: Point, b: Point, t: number) => ({
  x: Math.round((a.x + (b.x - a.x) * t) * 100) / 100,
  y: Math.round((a.y + (b.y - a.y) * t) * 100) / 100,
});
const segments = (points: Point[]): Segment[] => points.slice(1).map((point, i) => [points[i], point]);

function blockedInterval([a, b]: Segment, [c, d]: Segment, length: number, overlapOnly = false): Interval | undefined {
  if (Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) > Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x))
      || Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) > Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y))) return;
  const px = b.x - a.x, py = b.y - a.y;
  const qx = d.x - c.x, qy = d.y - c.y;
  const dx = c.x - a.x, dy = c.y - a.y;
  const divisor = cross(px, py, qx, qy);
  let low: number, high: number;
  if (divisor) {
    if (overlapOnly) return;
    const t = cross(dx, dy, qx, qy) / divisor;
    const u = cross(dx, dy, px, py) / divisor;
    if (t < 0 || t > 1 || u < 0 || u > 1) return;
    low = high = t;
  } else {
    if (cross(dx, dy, px, py) !== 0 || (qx === 0 && qy === 0)) return;
    const first = px ? dx / px : dy / py;
    const last = px ? (d.x - a.x) / px : (d.y - a.y) / py;
    low = Math.min(first, last);
    high = Math.max(first, last);
    if (overlapOnly && Math.max(0, low) >= Math.min(1, high)) return;
  }
  return [Math.max(0, low - gap / length), Math.min(1, high + gap / length)];
}

function separateStroke(points: Point[], visible: Segment[]) {
  const strokes: Point[][] = [];
  let clippedLength = 0;
  const painted: Segment[] = [];
  for (const segment of segments(points)) {
    const [a, b] = segment;
    const length = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    if (!length) continue;
    const gaps = visible.flatMap(other => {
      const hit = blockedInterval(segment, other, length);
      return hit ? [hit] : [];
    });
    for (const other of painted) {
      const hit = blockedInterval(segment, other, length, true);
      if (hit) gaps.push(hit);
    }
    gaps.sort((left, right) => left[0] - right[0]);
    const append = (start: number, end: number) => {
      if (start >= end) return;
      const from = pointAt(a, b, start), to = pointAt(a, b, end);
      painted.push([from, to]);
      const last = strokes.at(-1);
      const previous = last?.at(-1);
      if (previous?.x === from.x && previous.y === from.y) last!.push(to);
      else strokes.push([from, to]);
    };
    let cursor = 0;
    for (const [start, end] of gaps) {
      append(cursor, start);
      clippedLength += Math.max(0, end - Math.max(cursor, start)) * length;
      cursor = Math.max(cursor, end);
    }
    append(cursor, 1);
  }
  return { strokes, clippedLength };
}

// Branches draw continuously. In an unavoidable crossing, break only the lower-priority path.
export function separateMovementStrokes(movements: Edge[], branches: Edge[]) {
  const visible: Segment[] = branches.map(edge => [{ x: edge.x1, y: edge.y1 }, { x: edge.x2, y: edge.y2 }]);
  let clutter = 0;
  for (const movement of movements) {
    const result = separateStroke(movement.points!, visible);
    if (result.clippedLength) {
      movement.strokes = result.strokes;
      clutter += result.clippedLength;
    }
    for (const stroke of movementStrokes(movement)) {
      const lines = segments(stroke);
      if (result.clippedLength) {
        const length = lines.reduce((sum, [a, b]) => sum + Math.abs(b.x - a.x) + Math.abs(b.y - a.y), 0);
        // Leave enough continuous line around each break to show which way the arrow runs.
        clutter += Math.max(0, 24 - length) / 2;
      }
      visible.push(...lines);
    }
  }
  return clutter;
}

export function movementStrokes(edge: Edge) {
  return edge.strokes ?? [edge.points!];
}
