import { messages } from '../locales';
import { notifyResourceChange } from '../data/resourceChanges';
import { liveQuery } from 'dexie';
import { installResourcePack, type ResourcePack } from '../data/resourcePack';
import { isSourcePack } from '../data/sourcePacks';
import { useEffect, useRef, useState } from 'react';
import type { Locale } from '../shared/content';
import type { CommunityPack } from '../data/communityPack';
import { communityPacks, type CommunityPackageRecord } from '../data/db';
import { communityPackageReady, installCommunityPack } from '../data/communityInstall';

const labels = messages('communityImport');

export function CommunityImport({ locale, profileId, onInstalled }: { locale: Locale; profileId: string; onInstalled: () => void }) {
  const t = labels[locale];
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState('');
  const controller = useRef<AbortController | null>(null);
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => { controller.current?.abort(); worker.current?.terminate(); }, [profileId]);
  async function importFiles(selected?: FileList) {
    const files = Array.from(selected ?? []);
    if (!files.length) return;
    if (files.length > 100 || files.some(file => file.size > 100 * 1024 * 1024)) { setMessage(t.failed); return; }
    const request = new AbortController(); controller.current = request;
    setBusy(true); setMessage('');
    try {
      for (const [index, file] of files.entries()) {
      setProgress(`${index + 1}/${files.length}`);
      if (request.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (request.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      const pack = await new Promise<{ kind: 'community'; pack: CommunityPack } | { kind: 'resource'; pack: ResourcePack }>((resolve, reject) => {
        const instance = new Worker(new URL('../data/importPack.worker.ts', import.meta.url), { type: 'module' });
        worker.current = instance;
        const abort = () => { instance.terminate(); reject(new DOMException('Cancelled', 'AbortError')); };
        request.signal.addEventListener('abort', abort, { once: true });
        instance.onmessage = (event: MessageEvent<({ kind: 'community'; pack: CommunityPack } | { kind: 'resource'; pack: ResourcePack }) | { error: string }>) => {
          request.signal.removeEventListener('abort', abort);
          instance.terminate(); worker.current = null;
          if ('pack' in event.data) resolve(event.data);
          else reject(new Error(event.data.error ?? 'COMMUNITY_INVALID'));
        };
        instance.onerror = () => { request.signal.removeEventListener('abort', abort); instance.terminate(); worker.current = null; reject(new Error('COMMUNITY_INVALID')); };
        instance.postMessage(bytes, [bytes.buffer]);
      });
      if (pack.kind === 'resource') await installResourcePack(pack.pack, profileId, request.signal);
      else await installCommunityPack(pack.pack, profileId, request.signal);
      notifyResourceChange();
      }
      setMessage(t.done);
    } catch (error) { setMessage(error instanceof Error && error.message === 'UNSUPPORTED' ? t.unsupported : error instanceof DOMException && error.name === 'AbortError' ? t.cancel : t.failed); }
    finally {
      try {
        onInstalled();
      } catch { setMessage(t.failed); }
      setProgress(''); worker.current?.terminate(); worker.current = null; controller.current = null; setBusy(false);
    }
  }
  return <section className="community-import"><header className="community-import-header"><h2>{t.title}</h2>
    <label className="backup-file-label"><input className="sr-only" type="file" multiple accept=".zip,application/zip" aria-label={t.choose} disabled={busy} onChange={event => { void importFiles(event.target.files ?? undefined); event.target.value = ''; }}/><span className="button backup-file-button">{busy ? t.busy : t.choose}</span></label></header>
    {busy && <><span role="status">{t.busy} {progress}</span><button type="button" onClick={() => controller.current?.abort()}>{t.cancel}</button></>}
    {message && <p role="status">{message}</p>}

  </section>;
}

export function InstalledResources({ locale, profileId }: { locale: Locale; profileId: string }) {
  const t = labels[locale];
  const [packages, setPackages] = useState<{ pack: CommunityPackageRecord; ready: boolean }[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    const subscription = liveQuery(async () => {
      const found = await communityPacks.where('profileId').equals(profileId).filter(pack => pack.state === 'ready' && !isSourcePack(pack.hash)).toArray();
      return Promise.all(found.map(async pack => ({ pack, ready: await communityPackageReady(pack) })));
    }).subscribe({ next: value => { setPackages(value); setError(false); }, error: () => setError(true) });
    return () => subscription.unsubscribe();
  }, [profileId]);
  if (error) return <p className="error" role="alert">{t.failed}</p>;
  if (!packages.length) return null;
  return <details className="installed-resources"><summary>{t.installed} <span className="muted">{packages.length}</span><span className="installed-resources-chevron" aria-hidden="true">⌄</span></summary>
    <ul className="installed-resource-list">{packages.map(({ pack, ready }) => <li className="installed-resource-row" key={pack.hash}>
      <div className="installed-resource-heading"><span className="installed-resource-title" title={pack.id}>{pack.id}</span><span className="installed-resource-status">{ready ? pack.spoken || pack.lessons.some(lesson => lesson.skill === 'listening') ? t.offline : t.installed : t.repair}</span></div>
      <p className="installed-resource-meta">{pack.spoken ? `${pack.spoken.records.length} ${messages('additional')[locale].recordingSources}` : pack.corpus ? `${pack.corpus.records.length} ${messages('additional')[locale].articles}` : `${pack.lessons.length} ${t.lessons}`}{pack.dictionary?.length ? ` · ${pack.dictionary.length} ${t.meanings}` : ''}</p>
      <details className="installed-resource-sources"><summary>{t.sources}</summary><ul>{pack.sources.map(source => <li key={source.id}>{source.title} · {source.attribution} · {source.license}</li>)}</ul></details>
    </li>)}</ul>
  </details>;
}
