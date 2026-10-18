import { contentText, messages } from '../locales';
import { useEffect, useRef, useState } from 'react';
import type { Lesson, Locale } from '../shared/content';
import { readingHighlightsOverlap, type ReadingAnnotation } from '../shared/readingAnnotations';
import { saveReadingAnnotation } from '../data/db';
import { normaliseTerm } from '../shared/dictionary';
import { SelectionDictionary, type SelectedWord } from './SelectionDictionary';
import type { OnlineDictionaryId } from './onlineDictionaries';

export const readingAnnotationCopy = messages('readingMaterial_readingAnnotationCopy');
type Mark = ReadingAnnotation['highlights'][number];
export function ReadingMaterial({ material, locale, label, sessionId, owner, annotation, onSaved, onDirty, checking, profileId, online, defaultId, onLookup }: { material: Lesson['materials'][number]; locale: Locale; label: string; sessionId: string; owner: string; annotation?: ReadingAnnotation; onSaved: (annotations: ReadingAnnotation[]) => void; onDirty: (dirty: boolean) => void; checking: boolean; profileId: string; online: boolean; defaultId: OnlineDictionaryId; onLookup: () => Promise<void> }) {
  const t = readingAnnotationCopy[locale];
  const root = useRef<HTMLElement>(null);
  const markTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => clearTimeout(markTimer.current), []);
  const [selection, setSelection] = useState<SelectedWord & { highlight: Mark }>();
  const [note, setNote] = useState(annotation?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const marks = annotation?.highlights ?? [];
  useEffect(() => {
    onDirty(busy || note !== (annotation?.note ?? ''));
    return () => onDirty(false);
  }, [busy, note, annotation?.note, onDirty]);
  useEffect(() => {
    let timer: number | undefined;
    const capture = () => {
      const selected = window.getSelection();
      if (!selected?.rangeCount || selected.isCollapsed) return;
      const range = selected.getRangeAt(0);
      const element = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
      const block = element?.closest<HTMLElement>('[data-block-text]');
      if (!block || !root.current?.contains(block) || !block.contains(range.endContainer)) { setSelection(undefined); return; }
      const before = range.cloneRange(); before.selectNodeContents(block); before.setEnd(range.startContainer, range.startOffset);
      const start = before.toString().length;
      const text = range.toString();
      if (!text.trim() || text.length > 4000) { setSelection(undefined); return; }
      const rect = range.getBoundingClientRect();
      setSelection({ term: text.trim(), rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }, x: (rect.left + rect.right) / 2, y: rect.bottom, input: matchMedia('(any-pointer:coarse)').matches ? 'touch' : 'mouse', highlight: { blockId: block.dataset.blockText!, start, end: start + text.length, text } });
    };
    const selected = () => { clearTimeout(timer); timer = window.setTimeout(capture, 180); };
    document.addEventListener('selectionchange', selected);
    return () => { clearTimeout(timer); document.removeEventListener('selectionchange', selected); };
  }, []);
  async function save(nextMarks = marks) {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const next = await saveReadingAnnotation(sessionId, owner, { materialId: material.id, note, highlights: nextMarks });
      onSaved(next); setMessage(t.saved); return true;
    } catch { setMessage(t.error); return false; }
    finally { setBusy(false); }
  }
  function passage(text: string, blockId: string) {
    const highlights = marks.filter(mark => mark.blockId === blockId);
    const edges = [...new Set([0, text.length, ...highlights.flatMap(mark => [mark.start, mark.end])])].sort((a, b) => a - b);
    return edges.slice(0, -1).map((start, index) => {
      const end = edges[index + 1];
      const value = text.slice(start, end);
      return highlights.some(mark => mark.start <= start && mark.end >= end) ? <mark key={start} onClick={event => { const element = event.currentTarget; const input = matchMedia('(any-pointer:coarse)').matches ? 'touch' : 'mouse'; clearTimeout(markTimer.current); markTimer.current = window.setTimeout(() => { if (!element.isConnected) return; const rect = element.getBoundingClientRect(); setSelection({ term: value.trim(), rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }, x: (rect.left + rect.right) / 2, y: rect.bottom, input, highlight: { blockId, start, end, text: value } }); }, 180); }}>{value}</mark> : <span key={start}>{value}</span>;
    });
  }
  const removing = !!selection && marks.some(mark => readingHighlightsOverlap(mark, selection.highlight));
  return <section className="material reading-workspace" ref={root}>
    {selection && <SelectionDictionary key={`${selection.term}:${selection.x}:${selection.y}`} selected={selection} locale={locale} profileId={profileId} online={online} defaultId={defaultId} onLookup={onLookup} lookupEnabled={!checking && !!normaliseTerm(selection.term)} onClose={() => setSelection(undefined)} actions={<><button type="button" disabled={busy || (!removing && marks.length >= 50)} onPointerDown={event => event.preventDefault()} onClick={async () => { if (await save(removing ? marks.filter(mark => !readingHighlightsOverlap(mark, selection.highlight)) : [...marks, selection.highlight])) setSelection(undefined); }}>{removing ? t.remove : t.highlight}</button>{message === t.error && <p className="error" role="alert">{t.error}</p>}{!removing && marks.length >= 50 && <p className="muted">{t.full}</p>}</>}/>}
    <p className="eyebrow">{label}</p><h1 lang="en">{material.title}</h1>
    {material.illustration && <img className="material-illustration" src={material.illustration.src} alt={contentText(material.illustration.alt, locale)} loading="lazy"/>}
    {material.blocks.map(block => <section key={block.id}>{block.title && <h3 lang="en">{block.title}</h3>}<p className="passage" lang="en"><span data-block-text={block.id}>{passage(block.text, block.id)}</span></p></section>)}
    <details className="reading-notes"><summary>{t.notes} {marks.length > 0 && <span className="muted">({marks.length})</span>}</summary><label htmlFor={`reading-note-${material.id}`}>{t.note}</label><textarea id={`reading-note-${material.id}`} maxLength={4000} rows={4} disabled={busy} value={note} onChange={event => { setNote(event.target.value); setMessage(''); }}/><button type="button" disabled={busy || note === (annotation?.note ?? '')} onClick={() => void save()}>{t.save}</button><p className="muted" role="status">{message || (note !== (annotation?.note ?? '') ? t.changed : '')}</p>{marks.length > 0 && <ul>{marks.map((mark, index) => <li key={`${mark.blockId}:${mark.start}:${index}`}><q lang="en">{mark.text}</q><button type="button" disabled={busy} aria-label={`${t.remove}: ${mark.text}`} onClick={() => void save(marks.filter((_, i) => i !== index))}>×</button></li>)}</ul>}</details>
  </section>;
}
