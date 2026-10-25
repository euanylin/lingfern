import { contentLocale } from '../shared/locale';
import { messages } from '../locales';
import { loadRuntimeResources, runtimeResources } from '../data/runtimeResources';
import { sourcePacks, installedSourcePacks, installSourcePack, removeSourcePack } from '../data/sourcePacks';
import { liveQuery } from 'dexie';
import { createPortal } from 'react-dom';
import { readInstallationIntents, saveInstallationIntent } from '../data/installationIntent';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { topicSchema, type Locale } from '../shared/content';
import { firstRunCopy } from './FirstRun';
import { installOfflineResources, installedOfflineGroups, offlineGroups, removeOfflineResources } from '../data/offline';

const labels = messages('offlineInstall');

const libraryLabels = messages('offlineInstall_libraryLabels');

const size = (bytes: number) => bytes < 1_048_576 ? `${Math.ceil(bytes / 1024)} KiB` : `${(bytes / 1_048_576).toFixed(1)} MiB`;

export function OfflineInstall({ locale, online, onReady, onIntentsChange, profileId, initialInstalled, initialIntents, preview = false }: { preview?: boolean; initialIntents?: Awaited<ReturnType<typeof readInstallationIntents>>; initialInstalled?: Set<string>; profileId: string; locale: Locale; online: boolean; onReady: (ready: boolean, publicGroups: Set<string>) => void; onIntentsChange?: (intents: Awaited<ReturnType<typeof readInstallationIntents>>) => void }) {
  const t = labels[locale], ui = libraryLabels[locale];
  const sourceById = new Map(sourcePacks.map(pack => [pack.id, pack]));
  const downloadableGroups = [...offlineGroups, ...sourcePacks];
  const details = (id: string) => {
    const pack = sourceById.get(id);
    if (!pack) return '';
    const count = pack.passages ?? pack.clips ?? 0;
    return messages('additional', { count: count.toLocaleString(locale) })[locale].excerpts;
  };
  const topicName = (id: string) => {
    const pack = sourceById.get(id), topic = topicSchema.safeParse(pack?.topic);
    return topic.success ? firstRunCopy[locale].themes[topicSchema.options.indexOf(topic.data)] : pack?.topic ?? ui.other;
  };
  const name = (id: string) => t.names[id as keyof typeof t.names] ?? sourceById.get(id)?.title[contentLocale(locale)] ?? id;
  const categories = [
    { id: 'reading' as const, groups: downloadableGroups.filter(group => (group.id === 'corpus' || group.id === 'corpus-open-reading') || sourceById.get(group.id)?.skill === 'reading') },
    { id: 'listening' as const, groups: downloadableGroups.filter(group => group.id.startsWith('audio-') || sourceById.get(group.id)?.skill === 'listening') },
    { id: 'reference' as const, groups: offlineGroups.filter(group => !group.id.startsWith('audio-') && group.id !== 'corpus' && group.id !== 'corpus-open-reading') },
  ];
  const [intents, setIntents] = useState<Awaited<ReturnType<typeof readInstallationIntents>>>(() => initialIntents ?? { current: new Set(), unavailable: new Set() });
  const [checking, setChecking] = useState(!initialInstalled);
  const [installed, setInstalled] = useState<Set<string>>(() => initialInstalled ?? new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const removalDialog = useRef<HTMLDialogElement>(null), removalCancel = useRef<HTMLButtonElement>(null), removalTrigger = useRef<HTMLButtonElement>(null);
  const [installing, setInstalling] = useState(false);
  const actionsVisible = selected.size > 0 || installing;
  const actions = useRef<HTMLDivElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState('');
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null), busy = useRef(false), progressTime = useRef(0);
  useEffect(() => { if (initialInstalled) { setInstalled(initialInstalled); setChecking(false); } }, [initialInstalled]);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onIntentsChangeRef = useRef(onIntentsChange);
  onIntentsChangeRef.current = onIntentsChange;
  useLayoutEffect(() => {
    const bar = actions.current, main = bar?.closest('main');
    if (!bar || !main) return;
    const measure = () => {
      const height = `${bar.offsetHeight}px`;
      if (main.style.getPropertyValue('--offline-action-height') !== height) main.style.setProperty('--offline-action-height', height);
    };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(bar);
    return () => { observer.disconnect(); main.style.removeProperty('--offline-action-height'); };
  }, [actionsVisible]);
  useEffect(() => {
    let live = true;
    void loadRuntimeResources(!preview).then(() => Promise.all([installedOfflineGroups(), installedSourcePacks(profileId)])).then(([publicGroups, sourceGroups]) => { const found = new Set([...publicGroups, ...sourceGroups]); if (live) { setInstalled(found); setChecking(false); onReadyRef.current(found.size > 0, publicGroups); } }).catch(() => { if (live) { setChecking(false); setError(t.failed); } });
    return () => { live = false; controller.current?.abort(); };
  }, []);
  useEffect(() => {
    const observer = liveQuery(() => readInstallationIntents(profileId)).subscribe({ next: intents => { setIntents(intents); onIntentsChangeRef.current?.(intents); }, error: () => setError(t.intentFailed) });
    return () => observer.unsubscribe();
  }, [profileId, t.intentFailed]);
  const pendingIntents = [...new Set([...intents.current].filter(id => !installed.has(id)).concat([...intents.unavailable]))];
  async function clearPending() {
    setDeleting(true); setError('');
    try {
      for (const id of pendingIntents) await saveInstallationIntent(profileId, id, false);
      const next = await readInstallationIntents(profileId);
      setIntents(next); onIntentsChangeRef.current?.(next);
    }
    catch { setError(t.intentFailed); }
    finally { setDeleting(false); }
  }
  const chosen = downloadableGroups.filter(group => selected.has(group.id) && !installed.has(group.id));
  const removable = downloadableGroups.filter(group => selected.has(group.id) && installed.has(group.id));
  const chosenBytes = chosen.reduce((sum, group) => sum + group.bytes, 0);
  const matches = (id: string) => {
    const pack = sourceById.get(id);
    return `${name(id)} ${pack ? topicName(id) + ' ' + pack.title.en : ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  };
  const visible = downloadableGroups.filter(group => matches(group.id));
  const allVisibleSelected = visible.length > 0 && visible.every(group => selected.has(group.id));
  function selectGroups(ids: string[]) {
    setSelected(previous => {
      const next = new Set(previous), remove = ids.every(id => previous.has(id));
      for (const id of ids) if (remove) next.delete(id); else next.add(id);
      return next;
    });
  }
  useEffect(() => { if (confirmingRemoval) { removalDialog.current?.showModal(); removalCancel.current?.focus(); } }, [confirmingRemoval]);
  function closeRemoval() { if (deleting) return; removalDialog.current?.close(); setConfirmingRemoval(false); removalTrigger.current?.focus(); }
  function row(group: typeof downloadableGroups[number]) {
    const pack = sourceById.get(group.id);
    const fullTitle = name(group.id), parts = fullTitle.split(' · '), title = pack && parts.length > 2 ? parts.slice(2).join(' · ') : fullTitle;
    return <label className="package-row" key={group.id}>
      <input type="checkbox" checked={selected.has(group.id)} aria-label={fullTitle} onChange={() => selectGroups([group.id])}/>
      <span className="package-copy"><span className="package-title" title={fullTitle} lang={pack && title === pack.title.en.split(' · ').slice(2).join(' · ') ? 'en' : undefined}>{title}</span><small>{size(group.bytes)}{details(group.id)}{!installed.has(group.id) && intents.current.has(group.id) && ` · ${t.wanted}`}</small></span>
      {installed.has(group.id) && <span className="package-status">{t.ready}</span>}
    </label>;
  }
  function categoryRows(category: typeof categories[number]) {
    const base = category.groups.filter(group => !sourceById.has(group.id));
    const buckets = new Map<string, typeof downloadableGroups>();
    for (const group of category.groups.filter(group => sourceById.has(group.id))) {
      const topic = sourceById.get(group.id)!.topic;
      const bucket = buckets.get(topic) ?? []; bucket.push(group); buckets.set(topic, bucket);
    }
    const singletons = [...buckets.values()].filter(groups => groups.length === 1).flat();
    const grouped = [...buckets.entries()].filter(([, groups]) => groups.length > 1).map(([topic, groups]) => ({ key: topic, title: topicName(groups[0].id), groups }));
    if (base.length && category.id !== 'reference') grouped.unshift({ key: 'general', title: ui.general, groups: base });
    if (singletons.length) grouped.push({ key: 'other', title: ui.other, groups: singletons });
    return <>
      {category.id === 'reference' && <div className="package-list offline-base-packages">{base.filter(group => matches(group.id)).map(row)}</div>}
      {grouped.map(bucket => {
        const groups = bucket.groups.filter(group => matches(group.id)); if (!groups.length) return null;
        const key = `${category.id}:${bucket.key}`, open = !!query.trim() || expanded.has(key), selectedCount = groups.filter(group => selected.has(group.id)).length, installedCount = groups.filter(group => installed.has(group.id)).length;
        return <div className="offline-source-group" role="group" aria-labelledby={`offline-group-${key}`} key={key}>
          <div className="offline-source-group-heading">
            <label className="offline-group-check"><input type="checkbox" aria-label={`${t.categories[category.id]} · ${bucket.title}`} checked={selectedCount === groups.length} aria-checked={selectedCount > 0 && selectedCount < groups.length ? 'mixed' : selectedCount === groups.length} ref={node => { if (node) node.indeterminate = selectedCount > 0 && selectedCount < groups.length; }} onChange={() => { selectGroups(groups.map(group => group.id)); if (selectedCount !== groups.length) setExpanded(previous => new Set([...previous, key])); }}/></label>
            <button className="offline-source-group-toggle" type="button" aria-expanded={open} aria-controls={`offline-group-items-${key}`} onClick={() => setExpanded(previous => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next; })}><span id={`offline-group-${key}`}>{bucket.title}</span><small>{ui.count.replace('{count}', String(groups.length))}{installedCount > 0 && ` · ${ui.installed.replace('{count}', String(installedCount))}`}</small><span className="offline-group-chevron" aria-hidden="true">⌄</span></button>
          </div>
          <div className="package-list offline-group-items" id={`offline-group-items-${key}`} hidden={!open}>{(open || bucket.key === 'general') && groups.map(row)}</div>
        </div>;
      })}
    </>;
  }
  async function install() {
    const request = new AbortController(); controller.current = request; busy.current = true; progressTime.current = 0;
    const packages = chosen;
    const bytes = chosenBytes;
    let completed = 0;
    const finished = new Set<string>();
    const report = (current: number) => { if (performance.now() - progressTime.current >= 100) { progressTime.current = performance.now(); setProgress(completed + current); } };
    setProgress(0); setTotal(bytes); setError(''); setInstalling(true);
    try {
      for (const group of packages) {
        setActive(group.id);
        const isSource = sourcePacks.some(pack => pack.id === group.id);
        const ready = isSource ? (await installSourcePack(group.id, profileId, request.signal, report), true) : await installOfflineResources(group.id, report, request.signal, profileId);
        if (!ready) throw new Error('INCOMPLETE_PACKAGE');
        completed += group.bytes; setProgress(completed); finished.add(group.id);
      }
    } catch (cause) {
      setError(cause instanceof Error && cause.message === 'INSTALLATION_INTENT_FAILED' ? t.intentFailed : cause instanceof DOMException && cause.name === 'AbortError' ? t.cancelled : cause instanceof DOMException && cause.name === 'QuotaExceededError' ? t.quota : cause instanceof Error && cause.message === 'UNSUPPORTED' ? t.unsupported : t.failed);
    } finally {
      busy.current = false; await refresh();
      setSelected(previous => new Set([...previous].filter(id => !finished.has(id))));
      setInstalling(false); setActive(''); controller.current = null;
    }
  }
  async function removeSelected() {
    busy.current = true; setDeleting(true); setError('');
    try {
      const sources = removable.filter(group => sourcePacks.some(pack => pack.id === group.id)).map(group => group.id);
      const publicGroups = removable.filter(group => !sources.includes(group.id)).map(group => group.id);
      if (sources.length) await removeSourcePack(sources, profileId);
      if (publicGroups.length) await removeOfflineResources(publicGroups, profileId);
    } catch (cause) { setError(cause instanceof Error && cause.message === 'INSTALLATION_INTENT_FAILED' ? t.intentFailed : t.removeFailed); }
    finally {
      busy.current = false;
      const found = await refresh();
      if (found) setSelected(previous => new Set([...previous].filter(id => !removable.some(group => group.id === id) || found.has(id))));
      setDeleting(false);
    }
  }
  async function refresh() {
    try {
      const [publicGroups, sourceGroups] = await Promise.all([installedOfflineGroups(), installedSourcePacks(profileId)]);
      const found = new Set([...publicGroups, ...sourceGroups]);
      setInstalled(found); onReadyRef.current(found.size > 0, publicGroups); return found;
    } catch { setError(t.failed); }
  }
  useEffect(() => {
    const changed = () => { if (!busy.current) void refresh(); };
    window.addEventListener('lingfern-resources-installed', changed);
    return () => window.removeEventListener('lingfern-resources-installed', changed);
  }, [profileId, t.failed]);
  return <section className="offline-install" aria-label={t.title} aria-busy={checking}>
    <h2>{t.title}</h2>{!checking && !installing && !deleting && [...intents.current].some(id => !installed.has(id)) && <p className="muted installation-intent-notice">{t.intentions}</p>}{!checking && intents.unavailable.size > 0 && <p className="muted" role="status">{t.unavailableIntent}</p>}
    {!checking && !installing && !deleting && pendingIntents.length > 0 && <button type="button" disabled={installing || deleting} onClick={() => void clearPending()}>{t.clearPending}</button>}
    {checking && <p className="sr-only" role="status">{t.checking}</p>}
    <div className="offline-package-details">
      <fieldset disabled={checking || installing || deleting || confirmingRemoval} aria-label={t.select}>
        <label className="offline-search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><span className="sr-only">{ui.search}</span><input type="search" name="resource-search" value={query} placeholder={ui.search} onChange={event => setQuery(event.target.value)} autoComplete="off"/></label>
        <div className="offline-package-heading"><span aria-live="polite">{t.selectedCount.replace('{count}', String(selected.size))}</span>{visible.length > 0 && <button className="offline-select-all" type="button" onClick={() => selectGroups(visible.map(group => group.id))}>{allVisibleSelected ? t.clear : t.all}</button>}</div>
        {!visible.length && <p className="muted" role="status">{ui.empty} <button type="button" onClick={() => setQuery('')}>{ui.clearSearch}</button></p>}
        <div className="offline-categories">{categories.filter(category => category.groups.some(group => matches(group.id))).map(category => <section className="offline-category" key={category.id}><h3>{t.categories[category.id]}</h3>{categoryRows(category)}</section>)}</div>
      </fieldset>
    </div>
      {actionsVisible && <div ref={actions} className="offline-selection-actions" role="region" aria-label={ui.actions}><p className="muted" aria-live="polite">{t.selectedCount.replace('{count}', String(selected.size))} · {ui.downloadAction} {size(chosenBytes)}</p>
      {installing ? <div className="offline-download-progress"><p role="status"><span title={name(active)}>{t.installing} {name(active)}</span><span dir="ltr">{size(progress)} / {size(total)}</span></p><progress max={total} value={progress} aria-label={t.installing}/><button type="button" onClick={() => controller.current?.abort()}>{t.cancel}</button></div> : <div className="offline-actions">{removable.length > 0 && <button className="offline-remove" aria-label={t.remove} ref={removalTrigger} type="button" disabled={deleting || removable.length === 0} onClick={() => setConfirmingRemoval(true)}>{deleting ? t.removing : ui.removeAction}</button>}{chosen.length > 0 && <button aria-label={t.start} className="primary" type="button" disabled={deleting || !online || chosen.length === 0} onClick={() => void install()}>{ui.downloadAction}</button>}</div>}</div>}
      {selected.size > 0 && <details className="resource-pack-tools"><summary>{t.zip}</summary><div className="resource-pack-links">{downloadableGroups.filter(group => selected.has(group.id)).map(group => { const path = 'path' in group ? group.path : runtimeResources.downloads.packs.find(pack => pack.id === group.id && pack.version === group.version)?.path; return path ? <a key={group.id} href={path} download>{name(group.id)} · {t.zipDownload}</a> : null; })}</div></details>}
      {confirmingRemoval && createPortal(<dialog role="alertdialog" ref={removalDialog} className="offline-remove-dialog" aria-labelledby="offline-remove-title" onCancel={event => { event.preventDefault(); closeRemoval(); }} onClick={event => { if (event.target === event.currentTarget) closeRemoval(); }}><h2 id="offline-remove-title">{ui.removeTitle}</h2><p>{ui.removeDetail.replace('{count}', String(removable.length)).replace('{size}', size(removable.reduce((sum, group) => sum + group.bytes, 0)))}</p><div className="offline-remove-dialog-actions"><button ref={removalCancel} type="button" disabled={deleting} onClick={closeRemoval}>{t.cancel}</button><button className="offline-remove-confirm" type="button" disabled={deleting} onClick={() => { removalDialog.current?.close(); setConfirmingRemoval(false); void removeSelected(); }}>{t.remove}</button></div></dialog>, document.body)}
      {!online && chosen.length > 0 && <p className="muted">{t.online}</p>}{error && <p role="alert" className="error">{error}</p>}
  </section>;
}
