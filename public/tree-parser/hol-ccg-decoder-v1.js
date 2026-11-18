// Hol-CCG uses FFT-based circular correlation and keeps the best hypothesis per final category.
// The original algorithm is distributed under the MIT license. See the model package notice.
const width = 1024;
const threshold = Math.fround(0.01);
const batchSize = 64;
const epsilon = 1e-12;
const reversal = Uint16Array.from({ length: width }, (_, index) => {
  let bits = index;
  let reversed = 0;
  for (let bit = 1; bit < width; bit *= 2) {
    reversed = (reversed << 1) + (bits & 1);
    bits >>= 1;
  }
  return reversed;
});
const cos = Float64Array.from({ length: width / 2 }, (_, i) => Math.cos(-2 * Math.PI * i / width));
const sin = Float64Array.from({ length: width / 2 }, (_, i) => Math.sin(-2 * Math.PI * i / width));

function fft(real, imaginary, inverse = false) {
  for (let i = 0; i < width; i++) {
    const j = reversal[i];
    if (j <= i) continue;
    [real[i], real[j]] = [real[j], real[i]];
    [imaginary[i], imaginary[j]] = [imaginary[j], imaginary[i]];
  }
  for (let size = 2; size <= width; size *= 2) {
    const half = size / 2;
    for (let start = 0; start < width; start += size) {
      for (let k = 0; k < half; k++) {
        const index = k * (width / size);
        const a = start + k;
        const b = a + half;
        const im = inverse ? -sin[index] : sin[index];
        const r = real[b] * cos[index] - imaginary[b] * im;
        const t = real[b] * im + imaginary[b] * cos[index];
        real[b] = real[a] - r;
        imaginary[b] = imaginary[a] - t;
        real[a] += r;
        imaginary[a] += t;
      }
    }
  }
}

function spectrum(vector) {
  const real = Float64Array.from(vector);
  const imaginary = new Float64Array(width);
  fft(real, imaginary);
  return { real, imaginary };
}

function correlate(a, b, result, norm) {
  const real = new Float64Array(width);
  const imaginary = new Float64Array(width);
  for (let i = 0; i < width; i++) {
    real[i] = a.real[i] * b.real[i] + a.imaginary[i] * b.imaginary[i];
    imaginary[i] = a.real[i] * b.imaginary[i] - a.imaginary[i] * b.real[i];
  }
  fft(real, imaginary, true);
  let squared = 0;
  for (const component of real) squared += component * component;
  const scale = norm / Math.max(Math.sqrt(squared), width * epsilon);
  for (let i = 0; i < width; i++) result[i] = real[i] * scale;
}

function keep(cell, chain, score, vector, node) {
  const category = chain.at(-1);
  if ((cell.get(category)?.score ?? -Infinity) >= score) return;
  let tree = { ...node, category: chain[0] };
  for (const parent of chain.slice(1)) tree = { category: parent, head: 0, children: [tree] };
  cell.set(category, { score, vector, tree });
}

function auto(tree) {
  const { category, word, head, children } = tree;
  return word === undefined
    ? `(<T ${category} ${head} ${children.length}> ${children.map(auto).join(' ')} )`
    : `(<L ${category} POS POS ${word} ${category}>)`;
}

export async function decodeHolCcg(tokens, encoded, rules, scoreBatch) {
  const { vectors, probabilities } = encoded;
  const words = rules.words;
  const categoryIds = Object.keys(words).map(Number);
  const rowSize = probabilities.length / tokens.length;
  if (vectors.length !== width * tokens.length || !Number.isInteger(rowSize)) throw new Error('CCG_MODEL_OUTPUT');
  const chart = tokens.map((word, i) => {
    const row = probabilities.subarray(i * rowSize, (i + 1) * rowSize);
    const candidates = categoryIds.slice().sort((a, b) => row[b] - row[a]);
    const vector = spectrum(vectors.subarray(i * width, (i + 1) * width));
    const cell = new Map();
    for (const id of candidates) {
      if (cell.size && row[id] < threshold) break;
      keep(cell, words[id].split('-->'), Math.log(row[id] + epsilon), vector, { word });
    }
    return [undefined, cell];
  });

  let checked = 0;
  let scored = 0;
  // Bound worst-case chart work independently of the caller's timeout.
  function* pairs(start, end) {
    for (let split = start + 1; split < end; split++) {
      for (const [leftLabel, left] of chart[start][split - start]) {
        if (!Object.hasOwn(rules.grammar, leftLabel)) continue;
        const parentsByRight = rules.grammar[leftLabel];
        for (const [rightLabel, right] of chart[split][end - split]) {
          if (++checked > 1_000_000) throw new Error('CCG_CHART_SIZE');
          if (!Object.hasOwn(parentsByRight, rightLabel)) continue;
          if (++scored > 32_000) throw new Error('CCG_CHART_SIZE');
          yield { left, right, parents: parentsByRight[rightLabel] };
        }
      }
    }
  }

  const matrix = new Float32Array(batchSize * width);
  for (let length = 2; length <= tokens.length; length++) {
    const batch = [];
    const flush = async () => {
      const { spans, phrases } = await scoreBatch(matrix.subarray(0, batch.length * width), batch.length);
      const rowLength = phrases.length / batch.length;
      for (const [row, { cell, left, right, parents }] of batch.entries()) {
        if (spans[row] < threshold) continue;
        let vector;
        for (const [parent, index, head] of parents) {
          const probability = phrases[row * rowLength + index];
          if (probability < threshold) continue;
          const chain = parent.split('-->');
          const score = left.score + right.score + Math.log(probability + epsilon) + Math.log(spans[row] + epsilon);
          if ((cell.get(chain.at(-1))?.score ?? -Infinity) >= score) continue;
          vector ??= spectrum(matrix.subarray(row * width, (row + 1) * width));
          keep(cell, chain, score, vector, { head, children: [left.tree, right.tree] });
        }
      }
      batch.length = 0;
    };

    for (let start = 0; start + length <= tokens.length; start++) {
      const cell = new Map();
      chart[start][length] = cell;
      for (const pair of pairs(start, start + length)) {
        correlate(pair.left.vector, pair.right.vector, matrix.subarray(batch.length * width), rules.norm);
        batch.push({ ...pair, cell });
        if (batch.length === batchSize) await flush();
      }
    }
    if (batch.length) await flush();
  }
  let best;
  for (const entry of chart[0][tokens.length].values()) {
    if (!best || entry.score > best.score) best = entry;
  }
  return best ? auto(best.tree) : undefined;
}
