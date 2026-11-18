import { offlineGroupReady } from './offline';
import { loadCachedRuntimeResources } from './runtimeResources';
import { drawConlluDependency, drawModelCcg, drawModelConstituency, type TreeDiagram, type TreeForm } from '../shared/tree';

type ModelConverter = (source: string, output: string) => TreeDiagram;
type Engine = { pack: string; script: string; convert: ModelConverter; requires?: string };
const engines: Partial<Record<TreeForm, Engine[]>> = {
  dependency: [{ pack: 'tree-parser', script: 'worker-v1', convert: (source, output) => drawConlluDependency(output, source) }],
  constituency: [
    { pack: 'tree-stanza', script: 'stanza-v1', convert: drawModelConstituency, requires: 'tree-parser' },
    { pack: 'tree-constituency', script: 'constituency-v1', convert: drawModelConstituency },
  ],
  ccg: [{ pack: 'tree-hol-ccg', script: 'hol-ccg-v1', convert: drawModelCcg }],
};

function requestParse(worker: Worker, source: string, signal: AbortSignal) {
  return new Promise<string>((resolve, reject) => {
    signal.throwIfAborted();
    const timeout = setTimeout(fail, 12_000);
    function finish() {
      clearTimeout(timeout);
      worker.removeEventListener('message', receive);
      worker.removeEventListener('error', fail);
      worker.removeEventListener('messageerror', fail);
      signal.removeEventListener('abort', fail);
    }
    function fail() { finish(); reject(new Error('TREE_MODEL')); }
    function receive(event: MessageEvent<unknown>) {
      if (typeof event.data !== 'string') { fail(); return; }
      finish();
      resolve(event.data);
    }
    worker.addEventListener('message', receive);
    worker.addEventListener('error', fail);
    worker.addEventListener('messageerror', fail);
    signal.addEventListener('abort', fail, { once: true });
    try { worker.postMessage(source); } catch { fail(); }
  });
}

export function createTreeParser() {
  let active: { worker: Worker; form: TreeForm; engine: Engine; lifetime: AbortController } | undefined;
  const dispose = (keep?: TreeForm) => {
    if (!active || active.form === keep) return;
    const { worker, lifetime } = active;
    active = undefined;
    lifetime.abort();
    worker.terminate();
  };

  return {
    dispose,
    async parse(text: string, signal: AbortSignal, form: TreeForm) {
      const available = engines[form];
      if (!available) return;
      const source = text.normalize('NFKC').trim();
      const dependency = form === 'dependency';
      if (!source || source.length > (dependency ? 8192 : 4096) || source.split(/\s+/u).length > (dependency ? 200 : 120)
          || /\p{C}/u.test(source.replace(/[\t\r\n]/gu, '')) || (!dependency && /[<>]/u.test(source))) return;
      if (signal.aborted) return;
      try { await loadCachedRuntimeResources(); } catch { return; }
      for (const engine of available) {
        if (signal.aborted) return;
        let worker: Worker | undefined;
        try {
          if (!await offlineGroupReady(engine.pack) || (engine.requires && !await offlineGroupReady(engine.requires))) continue;
          if (signal.aborted) return;
          if (active?.engine !== engine) {
            dispose();
            active = { worker: new Worker(`/tree-parser/${engine.script}.js`, { type: 'module' }), form, engine, lifetime: new AbortController() };
          }
          worker = active.worker;
          const request = AbortSignal.any([signal, active.lifetime.signal]);
          const parsed = await requestParse(worker, source, request);
          if (request.aborted) return;
          return engine.convert(source, parsed);
        } catch {
          // A failed engine yields to the next installed engine or the rule parser.
          if (worker) {
            if (active?.worker !== worker) return;
            dispose();
          }
        }
      }
      if (!signal.aborted) dispose();
    },
  };
}
