// Stanza's greedy IN_ORDER transition scheme for the English PTB3 checkpoint.
function id(vocab, label) {
  return Object.hasOwn(vocab, label) ? vocab[label] : undefined;
}

function charInputs(words, vocab, reverse) {
  const ordered = reverse ? words.slice().reverse() : words;
  const chars = [id(vocab, '\n')];
  const offsets = [];
  for (const word of ordered) {
    const letters = [...word];
    if (reverse) letters.reverse();
    for (const letter of letters) chars.push(id(vocab, letter) ?? 1);
    chars.push(id(vocab, ' '));
    offsets.push(chars.length - 1);
  }
  if (reverse) offsets.reverse();
  return [chars, offsets];
}

function stanzaWordInputs(taggedWords, metadata) {
  const words = taggedWords.map(([word]) => word);
  const [forward_chars, forward_offsets] = charInputs(words, metadata.forward, false);
  const [backward_chars, backward_offsets] = charInputs(words, metadata.backward, true);
  return {
    word: words.map(word => id(metadata.word, word) ?? id(metadata.word, word.toLowerCase()) ?? 1),
    delta: words.map(word => id(metadata.delta, word) ?? 1),
    tag: taggedWords.map(([, tag]) => id(metadata.tag, tag) ?? 1),
    forward_chars, forward_offsets, backward_chars, backward_offsets,
  };
}

function unaryDepth(node) {
  let depth = 0;
  while (node?.children?.length === 1) {
    node = node.children[0];
    depth++;
  }
  return depth;
}

export async function decodeStanza(tagged, metadata, infer) {
  const { width, unary_limit: unaryLimit, transitions, root_labels: roots } = metadata;
  const queue = await infer.words(stanzaWordInputs(tagged, metadata));
  if (queue.length !== (tagged.length + 2) * width) throw new Error('STANZA_QUEUE');
  const wordAt = position => queue.subarray((position + 1) * width, (position + 2) * width);
  const vector = x => Float32Array.from(x);
  const stack = [{ state: metadata.initial_constituent.map(vector) }];
  let transState = metadata.initial_transition.map(vector);
  let position = 0;
  let opens = 0;
  let previous;
  const hidden = state => state[0].subarray(state[0].length / 2);

  for (let step = 0; step < tagged.length * 20 + 20; step++) {
    const top = stack.at(-1);
    const noWords = position === tagged.length;
    if (noWords && stack.length === 2 && roots.includes(top.node?.label)) return top.node;
    const word = wordAt(position);
    const scores = await infer.predict(word, hidden(transState), hidden(top.state));
    let index = -1;
    for (let i = 0; i < transitions.length; i++) {
      if (!Number.isFinite(scores[i]) || (index !== -1 && scores[index] >= scores[i])) continue;
      const [op, label] = transitions[i];
      let legal;
      if (op === 'shift') legal = !noWords && (opens > 0 || stack.length === 1);
      else if (op === 'close') legal = opens > 0 && (previous !== 'open' || opens > 1 || noWords
        || unaryDepth(stack.at(-2)?.node) <= unaryLimit);
      else legal = opens <= tagged.length + 10 && stack.length > 1 && previous !== 'open'
        && (roots.includes(label) ? opens === 0 && noWords : opens === 0 && !noWords || unaryDepth(top.node) <= unaryLimit);
      if (legal) index = i;
    }
    if (index === -1) return;
    const [op, label, openIndex] = transitions[index];
    let entry;
    if (op === 'shift') {
      const [token, tag] = tagged[position++];
      entry = { node: { label: tag, children: [{ label: token }] }, vector: word };
    } else if (op === 'open') {
      opens++;
      entry = { open: label, vector: vector(metadata.opens[openIndex]) };
    } else {
      opens--;
      const children = [];
      while (stack.length > 1 && !stack.at(-1).open) children.push(stack.pop());
      const marker = stack.pop();
      const first = stack.pop();
      if (!marker?.open || !first?.node || !stack.length) return;
      children.push(first);
      children.reverse();
      const values = new Float32Array(children.length * width);
      for (const [i, child] of children.entries()) values.set(child.vector, i * width);
      entry = { node: { label: marker.open, children: children.map(child => child.node) }, vector: await infer.reduce(values) };
    }
    entry.state = await infer.constituent(entry.vector, stack.at(-1).state);
    stack.push(entry);
    transState = await infer.transition(index, transState);
    previous = op;
  }
}

export function stanzaInference(ort, sessions, width) {
  const int = values => new ort.Tensor('int64', BigInt64Array.from(values, BigInt), [values.length]);
  const float = (values, dims = [values.length]) => new ort.Tensor('float32', values, dims);
  const state = values => float(values, [2, 1, values.length / 2]);
  const push = async (graph, inputs, [h, c]) => {
    const result = await graph.run({ ...inputs, h: state(h), c: state(c) });
    return [result.next_h.data, result.next_c.data];
  };
  return {
    words: async inputs => (await sessions.words.run(Object.fromEntries(
      Object.entries(inputs).map(([key, values]) => [key, int(values)]),
    ))).queue.data,
    predict: async (word, transition, constituent) => (await sessions.predict.run({
      word: float(word), transition: float(transition), constituent: float(constituent),
    })).scores.data,
    reduce: async values => (await sessions.reduce.run({ values: float(values, [values.length / width, width]) })).tree.data,
    constituent: (value, current) => push(sessions.constituent, { value: float(value) }, current),
    transition: (index, current) => push(sessions.transition, { index: int([index]) }, current),
  };
}
