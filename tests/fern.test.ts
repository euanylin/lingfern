import { expect, it } from 'vitest';
import fc from 'fast-check';
import { createHash } from 'node:crypto';
import { advanceFern, fernGrowth, fernShape } from '../src/core/fern';

it('unfolds continuously from the existing bud, with independent reading/listening sides', () => {
  const empty = fernGrowth(0, 0, 0);
  expect(empty).toEqual({ stem: 0, left: 0, right: 0 });
  expect(fernShape(empty).stem).toBe('M120 171 C111 134 105 101 116 70 128 31 168 45 162 76 157 101 127 94 132 74 136 63 149 67 147 76');
  const reading = fernGrowth(1, 0, 0), listening = fernGrowth(0, 1, 0), lookup = fernGrowth(0, 0, 1);
  expect(reading.left).toBeGreaterThan(0); expect(reading.right).toBe(0);
  expect(listening.right).toBe(reading.left); expect(listening.left).toBe(0);
  expect(lookup.left).toBe(lookup.right); expect(lookup.stem).toBeGreaterThan(0);
  expect(fernShape(fernGrowth(.5, 0, 0)).stem).not.toEqual(fernShape(reading).stem);
});

it('makes learning much stronger than reference history and caps reference-only growth', () => {
  const lookup = fernGrowth(0, 0, 1).stem, practice = fernGrowth(1, 0, 0).stem, test = fernGrowth(3, 0, 0).stem;
  expect(practice / lookup).toBeGreaterThan(40);
  expect(test).toBeGreaterThan(practice * 2);
  expect(fernGrowth(0, 0, 100000)).toEqual(fernGrowth(0, 0, 50));
  expect(fernGrowth(0, 0, 100000).stem).toBeLessThan(.05);
});

it('slows progressively while still leaving substantial room for later growth', () => {
  const steps = [0, 12, 24, 48, 96, 192];
  const gains = steps.map(value => fernGrowth(value + 1, 0, 0).left - fernGrowth(value, 0, 0).left);
  gains.forEach((gain, index) => { expect(gain).toBeGreaterThan(0); if (index) expect(gain).toBeLessThan(gains[index - 1]); });
  expect(fernGrowth(24, 0, 0).left).toBe(.5);
  expect(fernGrowth(216, 0, 0).left).toBe(.9);
  expect(fernGrowth(Number.NaN, -1, Number.POSITIVE_INFINITY)).toEqual(fernGrowth(0, 0, 0));
});

it('preserves smooth motion across frame rates and new growth targets', () => {
  const target = fernGrowth(40, 40, 30);
  const run = (fps: number) => {
    let growth = fernGrowth(0, 0, 0), velocity = { stem: 0, left: 0, right: 0 };
    for (let frame = 0; frame < fps * 2; frame++) ({ growth, velocity } = advanceFern(growth, velocity, target, 1 / fps));
    return { growth, velocity };
  };
  const sixty = run(60);
  for (const fps of [30, 120]) for (const key of ['stem', 'left', 'right'] as const) {
    expect(run(fps).growth[key]).toBeCloseTo(sixty.growth[key], 12);
    expect(run(fps).velocity[key]).toBeCloseTo(sixty.velocity[key], 12);
  }
  const continued = advanceFern(sixty.growth, sixty.velocity, fernGrowth(80, 80, 100), 1 / 60);
  expect(continued.growth.stem).toBeGreaterThan(sixty.growth.stem);
  expect(continued.velocity.stem).toBeGreaterThan(0);
  expect(advanceFern(sixty.growth, sixty.velocity, target, 0)).toEqual(sixty);
});

it('eases each pinna in and out without a jump in expansion speed', () => {
  const path = (amount: number) => fernShape({ stem: .5, left: amount, right: 0 }).left[3];
  const coords = (value: string) => (value.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g) ?? []).map(Number);
  for (const threshold of [3 / 13, 4 / 13]) {
    const first = coords(path(threshold - .00001)), last = coords(path(threshold + .00001));
    if (first.length) expect(Math.max(...first.map((value, index) => Math.abs(value - last[index])))).toBeLessThan(.000001);
    else for (const axis of [0, 1]) {
      const values = last.filter((_, index) => index % 2 === axis);
      expect(Math.max(...values) - Math.min(...values)).toBeLessThan(.000001);
    }
  }
});

it('adds a gentle rooted breeze independently of growth, with smooth bounded frames', () => {
  for (const growth of [fernGrowth(0,0,0), fernGrowth(12,12,30), fernGrowth(80,80,100)]) {
    const baseline = fernShape(growth);
    expect(fernShape(growth, 0)).toEqual(baseline);
    const numbers = (path: string) => (path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g) ?? []).map(Number);
    let previous = numbers(baseline.stem);
    let rooted = true, contained = true, maxStep = 0;
    const states = new Set<string>();
    for (let frame = 1; frame <= 60 * 30; frame++) {
      const shape = fernShape(growth, frame / 60), coordinates = numbers(shape.stem);
      rooted &&= coordinates[0] === 120 && coordinates[1] === 171;
      maxStep = Math.max(maxStep, ...coordinates.map((value,index) => Math.abs(value - previous[index])));
      if (frame % 60 === 0) for (const path of [shape.stem, ...shape.left, ...shape.right]) contained &&= numbers(path).every((value,index) => value >= 0 && value <= (index % 2 ? 180 : 240));
      previous = coordinates; states.add(shape.stem);
    }
    expect(states.size).toBeGreaterThan(1700);
    expect(rooted).toBe(true); expect(contained).toBe(true); expect(maxStep).toBeLessThan(.15);
  }
});

it('keeps all growth and path coordinates bounded, monotonic and rooted at the same point', () => {
  fc.assert(fc.property(fc.nat(100000), fc.nat(100000), fc.nat(100), (reading, listening, lookups) => {
    const value = fernGrowth(reading, listening, lookups), next = fernGrowth(reading + 1, listening + 1, lookups + 1);
    for (const key of ['stem', 'left', 'right'] as const) {
      expect(value[key]).toBeGreaterThanOrEqual(0); expect(value[key]).toBeLessThanOrEqual(1);
      expect(next[key]).toBeGreaterThanOrEqual(value[key]);
    }
    const shape = fernShape(value);
    expect(shape.stem).toMatch(/^M120 171 C/);
    expect(shape.left).toHaveLength(12); expect(shape.right).toHaveLength(12);
    for (const path of [shape.stem, ...shape.left, ...shape.right]) {
      expect(path).not.toMatch(/NaN|Infinity/);
      const coordinates = (path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g) ?? []).map(Number);
      coordinates.forEach((coordinate, index) => { expect(coordinate).toBeGreaterThanOrEqual(0); expect(coordinate).toBeLessThanOrEqual(index % 2 ? 180 : 240); });
    }
  }), { numRuns: 150 });
});

it('preserves visible path geometry to eight decimal places over unfolding and breeze frames', () => {
  const hash = createHash('sha256');
  // The test-only midpoint margin absorbs libm noise without changing runtime coordinates.
  const coordinate = (value: number) => String(Math.round(value * 1e8 + .02) / 1e8);
  let noiseStable = true, detectsDeformation = true;
  for (let frame = 0; frame <= 240; frame++) {
    const growth = { stem: frame / 240, left: Math.max(0, (frame - 20) / 240), right: Math.max(0, (frame - 40) / 240) };
    const shape = fernShape(growth, frame / 60);
    for (const side of ['left', 'right'] as const) shape[side].forEach((path, index) => expect(!!path).toBe(growth[side] * 13 > index));
    hash.update(JSON.stringify(shape).replace(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g, token => {
      const value = Number(token), rounded = coordinate(value);
      noiseStable &&= coordinate(value - 1e-12) === rounded && coordinate(value + 1e-12) === rounded;
      detectsDeformation &&= coordinate(value - 1e-6) !== rounded && coordinate(value + 1e-6) !== rounded;
      return rounded;
    }));
  }
  expect(noiseStable).toBe(true); expect(detectsDeformation).toBe(true);
  expect(hash.digest('hex')).toBe('b83f0b23cc8ce7505b586f3451374c437d80755b9df435a9d11e09ddddd792d0');
});
