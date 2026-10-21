export type FernGrowth = { stem: number; left: number; right: number };

const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t*t*t*(t*(t*6-15)+10); };

export function advanceFern(growth: FernGrowth, velocity: FernGrowth, target: FernGrowth, seconds: number) {
  const next = { ...growth }, speed = { ...velocity };
  const damping = 5.6, decay = Math.exp(-damping * seconds);
  for (const key of ['stem', 'left', 'right'] as const) {
    const offset = growth[key] - target[key], momentum = velocity[key] + damping * offset;
    next[key] = Math.max(0, Math.min(1, target[key] + (offset + momentum * seconds) * decay));
    speed[key] = (velocity[key] - damping * momentum * seconds) * decay;
  }
  return { growth: next, velocity: speed };
}

export function fernGrowth(reading: number, listening: number, lookups: number): FernGrowth {
  const count = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
  // Reference activity may grow a small bud, but cannot alone produce a mature fern.
  const reference = Math.min(1, count(lookups) * .02);
  const unfold = (activity: number) => activity / (activity + 24);
  return { stem: unfold(count(reading) + count(listening) + reference), left: unfold(count(reading) + reference / 2), right: unfold(count(listening) + reference / 2) };
}

const bud = [120,171, 111,134,105,101,116,70, 128,31,168,45,162,76, 157,101,127,94,132,74, 136,63,149,67,147,76];
const open = [120,171, 116,147,118,117,120,90, 122,63,120,35,118,18, 116,11,119,8,120,6, 122,6,123,8,123,10];

export function fernShape(growth: FernGrowth, seconds = 0) {
  const entrance = smooth(seconds / 1.5);
  const breeze = (2.8 * Math.sin(seconds * .63) + .9 * Math.sin(seconds * .37 + .7)) * entrance;
  const points = bud.map((value, index) => {
    const coordinate = value + (open[index] - value) * growth.stem;
    const height = index % 2 ? 0 : (171 - bud[index+1] - (open[index+1] - bud[index+1]) * growth.stem) / 165;
    return coordinate + (index % 2 ? 0 : breeze * height * height);
  });
  const stem = `M${points.slice(0,2).join(' ')} C${points.slice(2).join(' ')}`;
  const leaves = (side: -1 | 1, amount: number) => Array.from({ length: 12 }, (_, index) => {
    const reveal = smooth(amount * 13 - index);
    const position = .2 + index * .13 + (side === 1 ? .025 : 0), segment = Math.floor(position), t = position - segment;
    const coordinate = (axis: number) => {
      const offset = segment * 6 + axis;
      return (1-t)**3 * points[offset] + 3*(1-t)**2*t * points[offset+2] + 3*(1-t)*t*t * points[offset+4] + t**3 * points[offset+6];
    };
    const x = coordinate(0), y = coordinate(1);
    const length = (12 + 40 * Math.sin((index + 1) / 13 * Math.PI)) * reveal;
    const flutter = .7 * Math.sin(seconds * .85 - index * .2 + (side === 1 ? .5 : 0)) * entrance;
    const rise = (16 + index * .8 + flutter) * reveal;
    const width = 3.2 * reveal;
    const tipX = x + side * length, tipY = y - rise;
    return `M${x} ${y} Q${x + side * length * .42} ${y - rise * .35 + width} ${tipX} ${tipY} Q${x + side * length * .55} ${y - rise * .65 - width} ${x} ${y}Z`;
  });
  return { stem, left: leaves(-1, growth.left), right: leaves(1, growth.right) };
}
