import { env, InferenceSession, Tensor } from './ort-wasm-1.31.1.js';

env.wasm.numThreads = 1;
env.wasm.proxy = false;

const chunkBytes = 16 * 1024 * 1024;
const maxGraphBytes = 160 * 1024 * 1024;

async function modelResponse(url) {
  const response = await fetch(url, { credentials: 'omit', redirect: 'error' });
  if (!response.ok || !response.body || /text\/html/iu.test(response.headers.get('Content-Type') ?? '')) {
    await response.body?.cancel().catch(() => {});
    throw new Error('TREE_MODEL_HTTP');
  }
  return response;
}

export async function modelJson(base, name) {
  return (await modelResponse(base + name + '.json')).json();
}

export async function graphLoader(base) {
  env.wasm.wasmPaths = { wasm: new URL(base + 'ort-wasm-simd-threaded.wasm', self.location.href).href };
  const sizes = await modelJson(base, 'graphs');
  return async name => {
    const size = sizes[name];
    if (!Number.isInteger(size) || size < 1 || size > maxGraphBytes) throw new Error('TREE_MODEL_SIZE');
    const graph = new Uint8Array(size);
    for (let i = 0; i * chunkBytes < size; i++) {
      const start = i * chunkBytes;
      const end = Math.min(start + chunkBytes, size);
      const response = await modelResponse(base + name + '-' + i + '.bin');
      const reader = response.body.getReader();
      let position = start;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (position + value.length > end) throw new Error('TREE_MODEL_SIZE');
          graph.set(value, position);
          position += value.length;
        }
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      if (position !== end) throw new Error('TREE_MODEL_SIZE');
    }
    return InferenceSession.create(graph, { executionProviders: ['wasm'] });
  };
}

export { Tensor };
