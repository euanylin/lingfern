import createParser from './charniak-v1.js';

const resources = '/resources/tree-constituency-v1/';

async function loadModel() {
  const response = await fetch(resources + 'model.bin', { credentials: 'omit', redirect: 'error' });
  if (!response.ok || !response.body) throw new Error('TREE_MODEL');
  const model = new Uint8Array(36993521);
  const reader = response.body.pipeThrough(new DecompressionStream('gzip')).getReader();
  let offset = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      model.set(value, offset);
      offset += value.byteLength;
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  if (offset !== model.length) throw new Error('TREE_MODEL_SIZE');
  return model.buffer;
}

let parser;
const trees = [];
self.addEventListener('message', async ({ data }) => {
  if (typeof data !== 'string' || !data || data.length > 4096 || /[<>]/u.test(data) || data.split(/\s+/u).length > 120) {
    self.postMessage(null);
    return;
  }
  try {
    parser ??= loadModel().then(async model => {
      const instance = await createParser({
        locateFile: name => resources + name,
        getPreloadedPackage: (_name, bytes) => {
          if (bytes !== model.byteLength) throw new Error('TREE_MODEL_SIZE');
          return model;
        },
        print: line => { if (line.startsWith('(S1 ')) trees.push(line); },
        printErr: () => {},
      });
      instance.cwrap('load_model', null, ['string'])('/model/');
      instance._set_nth(1);
      return instance.cwrap('parse_sentence', null, ['string']);
    });
    const parse = await parser;
    trees.length = 0;
    parse('<s> ' + data.replace(/\s+/gu, ' ') + ' </s>\n');
    self.postMessage(trees.length === 1 ? trees[0] : null);
  } catch {
    self.postMessage(null);
  }
});
