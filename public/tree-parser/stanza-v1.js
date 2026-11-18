import { Tensor, graphLoader, modelJson } from './onnx-v1.js';
import { decodeStanza, stanzaInference } from './stanza-decoder-v1.js';
import { loadUDPipe } from './udpipe-runtime-v1.js';

const base = '/resources/tree-stanza-v1/';
const ptb = new Map(Object.entries({
  '(': '-LRB-', ')': '-RRB-', '[': '-LSB-', ']': '-RSB-', '{': '-LCB-', '}': '-RCB-', '"': '``',
}));
let tagger;
let model;

async function loadModel() {
  const [loadGraph, metadata] = await Promise.all([graphLoader(base), modelJson(base, 'metadata')]);
  const sessions = {};
  for (const graph of ['words', 'constituent', 'transition', 'predict', 'reduce']) sessions[graph] = await loadGraph(graph);
  return { metadata, infer: stanzaInference({ Tensor }, sessions, metadata.width) };
}

function taggedWords(conllu) {
  const rows = conllu.split('\n').filter(line => /^\d+\t/u.test(line));
  if (!rows.length || rows.length > 100) throw new Error('TREE_MODEL_INPUT');
  return rows.map((line, index) => {
    const [id, word, , , tag] = line.split('\t');
    if (Number(id) !== index + 1 || !word || !tag || tag === '_' || /\s/u.test(word)) throw new Error('TREE_MODEL_TAGS');
    return [word, tag];
  });
}

function brackets(node) {
  if (!node.children) return ptb.get(node.label) ?? node.label;
  return '(' + node.label + ' ' + node.children.map(brackets).join(' ') + ')';
}

self.addEventListener('message', async ({ data }) => {
  try {
    if (typeof data !== 'string' || !data || data.length > 4096 || /[<>]/u.test(data)) throw new Error('TREE_MODEL_INPUT');
    const engine = await (tagger ??= loadUDPipe());
    const tagged = taggedWords(engine.parseToConllu(data));
    const { metadata, infer } = await (model ??= loadModel());
    const root = await decodeStanza(tagged, metadata, infer);
    self.postMessage(root?.children?.length === 1 ? '(S1 ' + brackets(root.children[0]) + ')' : null);
  } catch {
    self.postMessage(null);
  }
});
