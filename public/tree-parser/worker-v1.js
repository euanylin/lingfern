import { loadUDPipe } from './udpipe-runtime-v1.js';

let parser;

self.addEventListener('message', async ({ data }) => {
  try {
    const engine = await (parser ??= loadUDPipe());
    self.postMessage(engine.parseToConllu(data));
  } catch {
    self.postMessage(null);
  }
});
