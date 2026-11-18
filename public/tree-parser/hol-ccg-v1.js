import { Tokenizer } from './tokenizers-0.2.0.js';
import { Tensor, graphLoader, modelJson } from './onnx-v1.js';
import { decodeHolCcg } from './hol-ccg-decoder-v1.js';
import { tokenizeHolCcg, treebankTokens } from './hol-ccg-tokenizer-v1.js';

const base = '/resources/tree-hol-ccg-v1/';
let model;

async function loadModel() {
  const [loadGraph, data, config, rules] = await Promise.all([
    graphLoader(base), modelJson(base, 'tokenizer'), modelJson(base, 'tokenizer_config'), modelJson(base, 'grammar'),
  ]);
  data.pre_tokenizer.add_prefix_space = true;
  const tokenizer = new Tokenizer(data, config);
  const encoder = await loadGraph('encoder');
  const heads = await loadGraph('heads');
  return { tokenizer, encoder, heads, rules };
}

self.addEventListener('message', async ({ data }) => {
  try {
    if (typeof data !== 'string' || !data || data.length > 4096 || /[<>]/u.test(data)) throw new Error('TREE_MODEL_INPUT');
    const tokens = treebankTokens(data);
    if (!tokens.length || tokens.length > 100) throw new Error('TREE_MODEL_INPUT');
    const { tokenizer, encoder, heads, rules } = await (model ??= loadModel());
    const { ids, pooling } = tokenizeHolCcg(tokenizer, tokens);
    const { vectors, probabilities } = await encoder.run({
      ids: new Tensor('int64', BigInt64Array.from(ids, BigInt), [1, ids.length]),
      pooling: new Tensor('float32', pooling, [tokens.length, ids.length]),
    });
    const auto = await decodeHolCcg(tokens, { vectors: vectors.data, probabilities: probabilities.data }, rules, async (vectors, count) => {
      const { spans, phrases } = await heads.run({ vectors: new Tensor('float32', vectors, [count, 1024]) });
      return { spans: spans.data, phrases: phrases.data };
    });
    self.postMessage(auto ?? null);
  } catch {
    self.postMessage(null);
  }
});
