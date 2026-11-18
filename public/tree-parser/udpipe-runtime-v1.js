import createUDPipe from './udpipe-v1.js';

const resources = '/resources/tree-parser-v1/';
export async function loadUDPipe() {
  const engine = await createUDPipe({ locateFile: () => resources + 'udpipe.wasm' });
  const model = await fetch(resources + 'english.udpipe', { credentials: 'omit', redirect: 'error' });
  if (!model.ok) throw new Error('TREE_MODEL');
  const bytes = new Uint8Array(await model.arrayBuffer());
  if (bytes.length !== 16368326) throw new Error('TREE_MODEL_SIZE');
  engine.FS.writeFile('/english.udpipe', bytes);
  if (!engine.initModel('/english.udpipe')) throw new Error('TREE_MODEL');
  engine.FS.unlink('/english.udpipe');
  return engine;
}
