import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Attempt, Session } from '../data/db';
import { liveQuery } from 'dexie';
import { useTaskDialog } from './useTaskDialog';
import { createPortal } from 'react-dom';
import { messages } from '../locales';
import { corpusQuestionKindSchema, topicSchema, type Locale } from '../shared/content';
import { practiceSelectionSchema, type PracticeSelection } from '../shared/practiceSelection';
import type { Preferences } from '../shared/preferences';
import { firstRunCopy } from './FirstRun';
import { SettingsPicker } from './SettingsPicker';

type Props = { locale: Locale; profileId: string; skill: 'reading' | 'listening'; preferences?: Preferences; history: Session[]; records: Attempt[]; value: PracticeSelection; disabled: boolean; onChange: (value: PracticeSelection) => Promise<void> };
type Material = { value: string; label: string; group: string };
type MaterialGroup = { group: string; items: Material[] };

export function PracticeOptions(props: Props) {
  const { locale, profileId, skill, preferences, history, records, value, disabled } = props, t = messages('practiceOptions')[locale];
  const [open, setOpen] = useState(false), [requested, setRequested] = useState(false), invoker = useRef<HTMLButtonElement>(null);
  const [materials, setMaterials] = useState<Material[]>([]), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState('');
  const [resources, setResources] = useState(0);
  useEffect(() => {
    if (!requested) return;
    const refresh = () => setResources(value => value + 1);
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('lingfern-resources') : undefined;
    if (channel) channel.onmessage = refresh;
    for (const event of ['lingfern-resources-installed', 'focus', 'online', 'offline']) window.addEventListener(event, refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { channel?.close(); for (const event of ['lingfern-resources-installed', 'focus', 'online', 'offline']) window.removeEventListener(event, refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [requested]);
  useEffect(() => {
    if (!requested) return;
    let current = true, dispose = () => {};
    void import('./prepareCorpusPractice').then(module => {
      if (!current) return;
      const subscription = liveQuery(() => module.practiceMaterials(profileId, skill, preferences, history, records)).subscribe({
        next: items => { setMaterials(items); setLoadError(''); setLoading(false); },
        error: () => { setLoadError(t.failed); setLoading(false); },
      });
      dispose = () => subscription.unsubscribe();
    }).catch(() => { if (current) { setLoadError(t.failed); setLoading(false); } });
    return () => { current = false; dispose(); };
  }, [requested, profileId, skill, preferences, history, records, t.failed, resources]);
  return <>
    <div className="setting topic-picker"><button ref={invoker} className="setting-trigger" type="button" aria-haspopup="dialog" aria-expanded={open} data-practice-skill={skill} data-configured={!!(value.topics.length || value.kinds.length || value.materials.length)} disabled={disabled} onClick={() => { setRequested(true); setOpen(true); }}><span>{t[skill === 'reading' ? 'readingSettings' : 'listeningSettings']}</span><span className="setting-chevron" aria-hidden="true">›</span></button></div>
    {open && <PracticeOptionsPanel {...props} materials={materials} loading={loading} loadError={loadError} onRefresh={() => setResources(value => value + 1)} onClose={() => { setOpen(false); requestAnimationFrame(() => invoker.current?.focus({ preventScroll: true })); }}/>}
  </>;
}

function PracticeOptionsPanel({ locale, skill, value, onChange, onClose, materials, loading, loadError, onRefresh }: Props & { onClose: () => void; materials: Material[]; loading: boolean; loadError: string; onRefresh: () => void }) {
  const t = messages('practiceOptions')[locale], automatic = messages('corpusPractice_automatic')[locale];
  const id = useId(), motion = useTaskDialog(id, onClose, 'practiceSettings');
  const [draft, setDraft] = useState(value), [query, setQuery] = useState('');
  const initialMaterials = useRef(value.materials);
  const saveQueue = useRef(Promise.resolve(true)), revision = useRef(0);
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const [expanded, setExpanded] = useState(new Set(['general', 'unavailable', 'community']));
  useEffect(() => { setExpanded(previous => new Set([...previous, ...materials.filter(item => initialMaterials.current.includes(item.value)).map(item => item.group)])); }, [materials]);
  const change = useCallback((next: PracticeSelection) => {
    setDraft(next);
    const request = ++revision.current;
    setSaving(true); setError('');
    // Keep rapid selections in order so an older write cannot replace the latest choice.
    saveQueue.current = saveQueue.current.then(async () => {
      try { await onChange(practiceSelectionSchema.parse(next)); return true; }
      catch { if (request === revision.current) setError(t.failed); return false; }
      finally { if (request === revision.current) setSaving(false); }
    });
  }, [onChange, t.failed]);
  const toggleMaterial = useCallback((value: string, checked: boolean) => change({ ...draft, materials: checked ? [...draft.materials, value] : draft.materials.filter(item => item !== value) }), [change, draft]);
  const toggleGroup = useCallback((group: string) => setExpanded(previous => { const next = new Set(previous); if (next.has(group)) next.delete(group); else next.add(group); return next; }), []);
  function close() { if (!saving) motion.close(); else void saveQueue.current.then(saved => { if (saved) motion.close(); }); }
  const known = useMemo(() => new Map(materials.map(item => [item.value, item])), [materials]);
  const missing = useCallback((value: string) => ({ value, label: `${t.unavailable} · ${value}`, group: 'unavailable' }), [t.unavailable]);
  const groups = useMemo(() => {
    const selected = new Set(draft.materials), search = query.trim().toLocaleLowerCase(locale);
    const unavailable = initialMaterials.current.filter(value => !known.has(value)).map(missing);
    const items = [...draft.materials.map(value => known.get(value) ?? missing(value)), ...[...unavailable, ...materials].filter(item => !selected.has(item.value))];
    const buckets = new Map(['unavailable', 'community', 'general', ...topicSchema.options].map(group => [group, [] as Material[]]));
    for (const item of items) if (!search || item.label.toLocaleLowerCase(locale).includes(search)) buckets.get(item.group)?.push(item);
    return [...buckets].filter(([, items]) => items.length).map(([group, items]) => ({ group, items }));
  }, [draft.materials, known, locale, materials, missing, query]);
  const selected = draft.materials.length;
  return createPortal(<dialog {...motion.dialogProps} className="task-detail practice-options-dialog" aria-labelledby={id} onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="task-detail-body practice-options-body" {...motion.bodyProps}>
      <header><div><p className="eyebrow" lang="en">{skill.toUpperCase()}</p><h2 id={id}>{t[skill === 'reading' ? 'readingSettings' : 'listeningSettings']}</h2></div><button type="button" disabled={saving} onClick={close}>{t.cancel}</button></header>
      <div className="practice-option-fields">
        <SettingsPicker variant="field" label={messages('corpusPractice_topic')[locale]} multiple value={draft.topics} options={[{ value: '', label: automatic }, ...topicSchema.options.map((value, index) => ({ value, label: firstRunCopy[locale].themes[index] }))]} onChange={topics => change({ ...draft, topics: topicSchema.array().parse(topics) })}/>
        <SettingsPicker variant="field" label={t.kind} multiple value={draft.kinds} options={[{ value: '', label: automatic }, ...corpusQuestionKindSchema.options.map(value => ({ value, label: messages('taskDetail')[locale].kinds[value] }))]} onChange={kinds => change({ ...draft, kinds: corpusQuestionKindSchema.array().parse(kinds) })}/>
      </div>
      <fieldset><legend className="sr-only">{t.materials}</legend><div className="practice-material-heading"><span aria-hidden="true">{t.materials}</span>{selected > 0 && <small role="status">{t.selected.replace('{count}', String(selected))}</small>}</div>
        <div className="practice-material-search"><button type="button" aria-pressed={!selected} onClick={() => change({ ...draft, materials: [] })}>{automatic}{!selected ? ' ✓' : ''}</button><label className="task-search"><span className="sr-only">{t.search}</span><input type="search" placeholder={t.search} value={query} onChange={event => setQuery(event.target.value)}/></label></div>
        {selected > 0 && <div className="practice-selected-materials">{draft.materials.map(value => <button key={value} type="button" aria-pressed="true" title={known.get(value)?.label ?? missing(value).label} onClick={() => change({ ...draft, materials: draft.materials.filter(item => item !== value) })}><bdi lang="en">{known.get(value)?.label ?? missing(value).label}</bdi><span aria-hidden="true">×</span></button>)}</div>}
        {selected === 1 && <p className="muted" role="status">{t.materialHint}</p>}
        {loading && <p className="muted" role="status">{t.loading}</p>}
        <PracticeMaterialList groups={groups} selected={draft.materials} expanded={expanded} searching={!!query.trim()} locale={locale} id={id} onToggle={toggleMaterial} onExpand={toggleGroup}/>
        {!loading && !groups.length && <p>{t.empty}</p>}
      </fieldset>
      {(error || loadError) && <p className="error" role="alert">{error || loadError} <button type="button" disabled={saving} onClick={() => loadError ? onRefresh() : change(draft)}>{messages('app')[locale].retry}</button></p>}
      {saving && <span className="sr-only" role="status">{t.saving}</span>}
    </div>
  </dialog>, document.body);
}

// Contact/blur and save-status changes must not rebuild hundreds of material controls.
const PracticeMaterialList = memo(function PracticeMaterialList({ groups, selected, expanded, searching, locale, id, onToggle, onExpand }: { groups: MaterialGroup[]; selected: string[]; expanded: Set<string>; searching: boolean; locale: Locale; id: string; onToggle: (value: string, checked: boolean) => void; onExpand: (group: string) => void }) {
  const t = messages('practiceOptions')[locale], ui = messages('offlineInstall_libraryLabels')[locale], checked = new Set(selected);
  return <div className="practice-material-list">{groups.map(bucket => {
          const open = searching || expanded.has(bucket.group), title = bucket.group === 'community' ? messages('communityImport')[locale].installed : bucket.group === 'general' ? ui.general : bucket.group === 'unavailable' ? t.unavailable : firstRunCopy[locale].themes[topicSchema.options.indexOf(topicSchema.parse(bucket.group))];
          return <div className="offline-source-group" key={bucket.group}>
            <div className="offline-source-group-heading"><button className="offline-source-group-toggle" type="button" aria-expanded={open} aria-controls={`${id}-${bucket.group}`} onClick={() => onExpand(bucket.group)}><span>{title}</span><small>{ui.count.replace('{count}', String(bucket.items.length))}</small><span className="offline-group-chevron" aria-hidden="true">⌄</span></button></div>
            <div className="package-list offline-group-items" id={`${id}-${bucket.group}`} hidden={!open}>{open && bucket.items.slice(0, 80).map(item => <label key={item.value} className="option"><input type="checkbox" checked={checked.has(item.value)} disabled={!checked.has(item.value) && selected.length >= 32} onChange={event => onToggle(item.value, event.target.checked)}/><span lang="en" dir="ltr">{item.label}</span></label>)}{open && bucket.items.length > 80 && <p className="muted">{t.refine}</p>}</div>
          </div>;
        })}</div>;
});
