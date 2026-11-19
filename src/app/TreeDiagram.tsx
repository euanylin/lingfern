import { SingleLineField } from './SingleLineField';
import { movementStrokes } from '../shared/tree-movement-strokes';
import { messages } from '../locales';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Locale } from '../shared/content';
import { findSavedTree, recordTree } from '../data/lookupHistory';
import { readTreeDraft, saveTreeDraft } from '../data/treeDraft';
import { createTreeParser } from '../data/treeParser';
import { useExitPresence } from './DisclosurePanel';
import { closeModal, cycleModalFocus, showModal } from './modal';
import { addChild, addSibling, blankTree, canDropNode, drawTree, isClearedTree, isWrittenTreeInput, linkMovement, unlinkMovement, exampleSentence, exampleTree, labelAllowed, labelLines, layoutTree, moveNode, orderedDependencyNodes, removeNode, renameNode, reorderTo, reparentNode, sentenceFileName, treeEdgeLabelPoint, treeFileName, treeForms, movementPath, treeArrowPath, treeArrowPoints, treePdf, treeSvg, treeText, type TreeDiagram as Diagram, type TreeForm, type TreePdfLabel } from '../shared/tree';
import { loadWordNetPos, type PosLookup } from '../shared/wordnet-pos';
import { SettingsPicker } from './SettingsPicker';
import { isTraceLabel, labelIndex } from '../shared/tree-movement';

const labels = messages('treeDiagram');
const historyCopy = messages('lookupHistory_lookupHistoryCopy');
const backupLabels = messages('profileBackup');
type ExportKind = 'save' | 'export';
const exportFormats = [['svg', 'SVG'], ['png', 'PNG'], ['webp', 'WebP'], ['jpeg', 'JPEG'], ['pdf', 'PDF']] as const;
type ExportFormat = typeof exportFormats[number][0];
const exportExtension: Record<ExportFormat, string> = { svg: 'svg', png: 'png', webp: 'webp', jpeg: 'jpg', pdf: 'pdf' };
const treeSymbols = [
  ['prime', '′'],
  ['backslash', '\\'],
  ['slash', '/'],
  ['bar', '|'],
  ['roleMark', '@'],
  ['lambda', 'λ'],
  ['empty', '∅'],
  ['openBracket', '['],
  ['closeBracket', ']'],
] as const;

function moveFormat(event: KeyboardEvent<HTMLButtonElement>, index: number) {
  const next = event.key === 'ArrowDown' ? (index + 1) % exportFormats.length : event.key === 'ArrowUp' ? (index - 1 + exportFormats.length) % exportFormats.length : event.key === 'Home' ? 0 : event.key === 'End' ? exportFormats.length - 1 : -1;
  if (next < 0) return;
  event.preventDefault();
  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role=option]')[next]?.focus();
}

function HistoryIcon({ direction }: { direction: 'undo' | 'redo' }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {direction === 'undo'
      ? <><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11"/></>
      : <><path d="M15 14 20 9l-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0-5.5 5.5 5.5 5.5 0 0 0 5.5 5.5H13"/></>}
  </svg>;
}

function ZoomIcon({ direction }: { direction: 'in' | 'out' }) {  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" focusable="false">
    <circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.4 15.4 4.6 4.6"/><path d="M7.5 10.5h6"/>{direction === 'in' && <path d="M10.5 7.5v6"/>}
  </svg>;
}

function FullscreenIcon({ exit }: { exit: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {exit
      ? <><path d="M9 4v5H4"/><path d="M15 4v5h5"/><path d="M9 20v-5H4"/><path d="M15 20v-5h5"/></>
      : <><path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/></>}
  </svg>;
}

function ClearIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M4 7h16"/><path d="M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7"/>
    <path d="M6.3 7l.9 12a1.2 1.2 0 0 0 1.2 1.1h7.2a1.2 1.2 0 0 0 1.2-1.1l.9-12"/>
    <path d="M10.2 11v5.5M13.8 11v5.5"/>
  </svg>;
}

function acceptedName(value: string, fallback: string) {
  const filename = (value.trim() || fallback).replace(/\.(svg|png|webp|jpe?g|pdf)$/i, '');
  if (!filename || filename.length > 80 || /[<>:"/\\|?*]/.test(filename) || /[. ]$/.test(filename) || Array.from(filename).some(character => character.charCodeAt(0) < 32)) return;
  return filename;
}

function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function safeColor(value: string, fallback: string) {
  return /^(?:rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)|rgba\(\d{1,3}, \d{1,3}, \d{1,3}, (?:0|1|0?\.\d+)\)|#[0-9a-f]{6})$/i.test(value) ? value : fallback;
}

function labelBitmap(label: string): TreePdfLabel {
  const rows = labelLines(label);
  if (rows.every(line => [...line].every(char => { const code = char.charCodeAt(0); return code >= 32 && code <= 126; }))) return null;
  const canvas = document.createElement('canvas');
  const scale = 2;
  const font = '600 16px system-ui, sans-serif';
  const probe = canvas.getContext('2d');
  if (!probe) throw new Error('TREE_EXPORT');
  probe.font = font;
  const cssWidth = Math.max(1, ...rows.map(line => Math.ceil(probe.measureText(line).width)));
  const cssHeight = rows.length === 1 ? 20 : rows.length * 18;
  canvas.width = cssWidth * scale;
  canvas.height = cssHeight * scale;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('TREE_EXPORT');
  context.scale(scale, scale);
  context.fillStyle = '#fff';
  context.fillRect(0, 0, cssWidth, cssHeight);
  context.fillStyle = '#000';
  context.font = font;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  rows.forEach((line, index) => context.fillText(line, cssWidth / 2, rows.length === 1 ? cssHeight / 2 : index * 18 + 9));
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const rgb = new Uint8Array(canvas.width * canvas.height * 3);
  for (let index = 0, target = 0; index < pixels.length; index += 4, target += 3) { rgb[target] = pixels[index]; rgb[target + 1] = pixels[index + 1]; rgb[target + 2] = pixels[index + 2]; }
  return { width: canvas.width, height: canvas.height, cssWidth, cssHeight, rgb };
}

type NodeMenuState = { id: string; invoker: HTMLElement; rect: { left: number; right: number; top: number; bottom: number } };

function NodeMenu({ menu, label, items, onClose }: { menu: NodeMenuState; label: string; items: { label: string; disabled?: boolean; checked?: boolean; run: () => void }[]; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 148, height: 228 });
  useLayoutEffect(() => { root.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) onClose(); };
    const scroll = (event: Event) => { if (!(event.target instanceof Node && root.current?.contains(event.target))) onClose(); };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', onClose);
    const viewport = innerWidth < 1200 ? window.visualViewport : undefined;
    viewport?.addEventListener('scroll', onClose);
    viewport?.addEventListener('resize', onClose);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', onClose); viewport?.removeEventListener('scroll', onClose); viewport?.removeEventListener('resize', onClose); };
  }, [onClose]);
  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.borderBoxSize[0].inlineSize, height: entry.borderBoxSize[0].blockSize }));
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const viewport = window.visualViewport;
  const viewportLeft = viewport?.offsetLeft ?? 0, viewportTop = viewport?.offsetTop ?? 0;
  const viewportWidth = viewport?.width ?? innerWidth, viewportBottom = viewportTop + (viewport?.height ?? innerHeight);
  const below = viewportBottom - menu.rect.bottom >= size.height + 10;
  const left = Math.max(viewportLeft + 8, Math.min((menu.rect.left + menu.rect.right - size.width) / 2, viewportLeft + viewportWidth - size.width - 8));
  const top = Math.max(viewportTop + 8, Math.min(below ? menu.rect.bottom + 10 : menu.rect.top - size.height - 10, viewportBottom - size.height - 8));
  return <div ref={root} className="tree-node-menu" role="menu" aria-label={label} onKeyDown={event => {
    if (event.key === 'Tab' || event.key === 'Escape') {
      if (event.key === 'Escape' || menu.invoker.closest('[aria-modal=true]')) event.preventDefault();
      menu.invoker.focus({ preventScroll: true });
      onClose();
      return;
    }
    const options = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'ArrowDown' ? (index + 1) % options.length : event.key === 'ArrowUp' ? (index - 1 + options.length) % options.length : event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : -1;
    if (next >= 0) { event.preventDefault(); options[next]?.focus({ preventScroll: true }); options[next]?.scrollIntoView({ block: 'nearest' }); }
  }} style={{ left, top, maxWidth: viewportWidth - 16, maxHeight: Math.max(44, (viewport?.height ?? innerHeight) - 16) }}>
    {items.map(item => <button key={item.label} type="button" role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={item.checked} disabled={item.disabled} onPointerDown={event => event.preventDefault()} onClick={() => { item.run(); onClose(); }}>{item.label}</button>)}
  </div>;
}

function themeColors() {
  const probe = document.createElement('span');
  probe.style.borderColor = 'var(--control)';
  document.body.appendChild(probe);
  const colors = { line: safeColor(getComputedStyle(probe).borderColor, '#7A827A') };
  probe.remove();
  return colors;
}

export function TreeDiagram({ locale, profileId, initialQuery = '', disabled = false }: { locale: Locale; profileId: string; initialQuery?: string; disabled?: boolean }) {
  const t = labels[locale];
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const sourceRef = useRef<HTMLTextAreaElement>(null);
  // The board opens on a worked example, and its sentence is what regenerating starts from.
  const [source, setSource] = useState(exampleSentence);
  const [draggingId, setDraggingId] = useState<string>();
  const [dropId, setDropId] = useState<string>();
  const [nodeMenu, setNodeMenu] = useState<NodeMenuState>();
  const [editingId, setEditingId] = useState<string>();
  const dragFrame = useRef(0);
  const longPress = useRef<{ timer: ReturnType<typeof setTimeout>; pointerId: number; x: number; y: number } | null>(null);
  const cancelLongPress = useCallback(() => { if (longPress.current) clearTimeout(longPress.current.timer); longPress.current = null; }, []);
  const editRevision = useRef(0);
  const parser = useMemo(createTreeParser, []);
  const drawRequest = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => { drawRequest.current?.abort(); parser.dispose(); }, [parser, profileId]);
  type Step = { diagram: Diagram; form: TreeForm; selected: string; source: string; draft: string; generated: boolean };
  const past = useRef<Step[]>([]);
  const future = useRef<Step[]>([]);
  const labelUndo = useRef<string | undefined>(undefined);
  const [, bumpHistory] = useState(0);
  const [diagram, setDiagram] = useState<Diagram>(() => exampleTree());
  const [form, setForm] = useState<TreeForm>('constituency');
  const requestedForm = useRef<TreeForm>('constituency');
  const commitForm = useCallback((value: TreeForm) => {
    parser.dispose(value);
    requestedForm.current = value;
    setForm(value);
  }, [parser]);
  const [selected, setSelected] = useState('n1');
  const [draft, setDraft] = useState('S');
  const [naming, setNaming] = useState<ExportKind>();
  const [fallback, setFallback] = useState('');
  const [exportName, setExportName] = useState('');
  const [exportError, setExportError] = useState('');
  const [notice, setNotice] = useState('');
  const [problem, setProblem] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [autoSaveFailed, setAutoSaveFailed] = useState(false);
  // Written trees keep their supplied structure.
  const [generated, setGenerated] = useState(true);
  const diagramRef = useRef(diagram);
  const labelRef = useRef<HTMLTextAreaElement>(null);
  const focusLabel = useRef(false);
  const symbolInput = useRef<HTMLTextAreaElement>(null);
  const symbolCaret = useRef({ start: 0, end: 0 });
  const editOrigin = useRef('');
  const cancelEdit = useRef(false);
  const nameDialog = useRef<HTMLDialogElement>(null);
  const nameCancel = useRef<HTMLButtonElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const exportButton = useRef<HTMLButtonElement>(null);
  const [format, setFormat] = useState<ExportFormat>('svg');
  const [formatsOpen, setFormatsOpen] = useState(false);
  const suffixRef = useRef<HTMLButtonElement>(null);
  const formatMenu = useRef<HTMLDivElement>(null);
  const formatFromKeys = useRef(false);
  const formatsPresent = useExitPresence(formatsOpen, formatMenu);
  const frameRef = useRef<HTMLDivElement>(null);
  const fullscreenButton = useRef<HTMLButtonElement>(null);
  // Vertical scrolling stays native until the board is wide enough for two-axis touch panning.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0, left: 0, top: 0 });
  const [zoom, setZoom] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [panX, setPanX] = useState(0);
  const pendingScroll = useRef<number | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | { mode: 'pending' | 'pan'; x: number; y: number; direct: boolean; pointerId: number }
    | { mode: 'pinch'; distance: number; scale: number; contentX: number; contentY: number; anchorX: number; offsetY: number }
    | null
  >(null);
  diagramRef.current = diagram;
  const selectedId = diagram.nodes.some(node => node.id === selected) ? selected : diagram.root;
  const layout = useMemo(() => layoutTree(diagram), [diagram]);
  const fitScale = frame.width > 0 && frame.height > 0 ? Math.min(1, frame.width / Math.max(1, layout.width), frame.height / Math.max(1, layout.height)) : 1;
  const minScale = Math.min(0.1, fitScale);
  const scale = zoom ?? fitScale;
  const contentWidth = layout.width * scale;
  const contentHeight = layout.height * scale;
  // Horizontal pan is clamped so the content edge can never leave the frame; smaller content centred.
  const clampPan = (value: number, size: number, visible: number) => visible > 0 ? Math.max(Math.min(0, visible - size), Math.min(0, value)) : 0;
  const baseX = frame.width > 0 ? Math.max(0, (frame.width - contentWidth) / 2) : 0;
  const baseY = frame.height > 0 ? Math.max(0, (frame.height - contentHeight) / 2) : 0;
  const panShift = clampPan(panX, contentWidth, frame.width);
  const sideways = frame.width > 0 && contentWidth > frame.width + 0.5;
  const percent = Math.round(scale * 100);
  const limit = (value: number, minimum: number) => Math.min(4, Math.max(minimum, Number(value.toFixed(3))));
  const viewport = { scale, minScale, frame, baseX, baseY, panShift, contentWidth, width: layout.width, height: layout.height, sideways };
  const view = useRef(viewport);
  view.current = viewport;
  // Applied after the new content height is in the DOM so the zoom anchor stays under the cursor.
  useLayoutEffect(() => {
    if (pendingScroll.current === null || !scrollRef.current) return;
    scrollRef.current.scrollTop = pendingScroll.current;
    pendingScroll.current = null;
  }, [scale, expanded]);

  const applyAnchoredZoom = (value: number, x: number, y: number, contentX: number, contentY: number) => {
    const state = view.current;
    const width = state.width * value, height = state.height * value;
    const baseX = Math.max(0, (state.frame.width - width) / 2), baseY = Math.max(0, (state.frame.height - height) / 2);
    setZoom(value);
    setPanX(clampPan(x - baseX - contentX * value, width, state.frame.width));
    pendingScroll.current = Math.max(0, baseY + contentY * value - y);
  };
  // Zoom around a screen point so the content under the pointer stays put.
  const setScaleAt = (next: number, clientX: number, clientY: number) => {
    const element = scrollRef.current;
    const state = view.current;
    const value = limit(next, state.minScale);
    if (!element || value === state.scale) return;
    const rect = element.getBoundingClientRect();
    const x = clientX - rect.left - state.frame.left, y = clientY - rect.top - state.frame.top;
    const contentX = (x - state.baseX - state.panShift) / state.scale;
    const contentY = (element.scrollTop + y - state.baseY) / state.scale;
    applyAnchoredZoom(value, x, y, contentX, contentY);
  };
  const zoomAtCentre = (factor: number) => {
    const element = scrollRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const state = view.current;
    setScaleAt(state.scale * factor, rect.left + state.frame.left + state.frame.width / 2, rect.top + state.frame.top + state.frame.height / 2);
  };
  const fitToCard = () => {
    setZoom(null);
    setPanX(0);
    pendingScroll.current = null;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };
  const setFullscreen = useCallback((value: boolean) => {
    fullscreenButton.current?.focus({ preventScroll: true });
    setExpanded(value);
    setPanX(0);
    pendingScroll.current = 0;
  }, []);
  useLayoutEffect(() => {
    const board = frameRef.current;
    if (!expanded || !board) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    // Keep the same mounted board while removing the obscured controls from focus and accessibility.
    const background: HTMLElement[] = [];
    for (let element: HTMLElement = board; element.parentElement && element.parentElement !== document.body; element = element.parentElement) {
      for (const sibling of element.parentElement.children) {
        if (sibling !== element && sibling instanceof HTMLElement && !sibling.inert) {
          sibling.inert = true;
          background.push(sibling);
        }
      }
    }
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && !event.isComposing) setFullscreen(false);
    };
    document.addEventListener('keydown', escape);
    return () => {
      root.style.overflow = previous;
      for (const sibling of background) sibling.inert = false;
      document.removeEventListener('keydown', escape);
    };
  }, [expanded, setFullscreen]);

  const startGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest('.tree-node-edit'))) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const element = scrollRef.current;
    const state = view.current;
    if (!element) return;
    if (pointers.current.size >= 2) {
      const [first, second] = [...pointers.current.values()];
      const rect = element.getBoundingClientRect();
      const anchorX = (first.x + second.x) / 2, anchorY = (first.y + second.y) / 2;
      const offsetY = anchorY - rect.top - state.frame.top;
      gesture.current = {
        mode: 'pinch',
        distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
        scale: state.scale,
        contentX: (anchorX - rect.left - state.frame.left - state.baseX - state.panShift) / state.scale,
        contentY: (element.scrollTop + offsetY - state.baseY) / state.scale,
        anchorX, offsetY,
      };
      return;
    }
    if (!state.sideways) return;
    const direct = event.pointerType === 'touch' || event.pointerType === 'pen';
    if (!direct && event.target instanceof Element && event.target.closest('.tree-node')) return;
    // Wait for real movement so a click or double-click is never captured or treated as a drag.
    gesture.current = { mode: 'pending', x: event.clientX, y: event.clientY, direct, pointerId: event.pointerId };
  };
  const moveGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const current = gesture.current, state = view.current, element = scrollRef.current;
    if (!current || !element) return;
    if (current.mode !== 'pinch') {
      if (current.pointerId !== event.pointerId || !state.sideways) return;
      const dx = event.clientX - current.x;
      const dy = current.direct ? event.clientY - current.y : 0;
      if (current.mode === 'pending') {
        if (Math.hypot(dx, dy) < 4) return;
        current.mode = 'pan';
        cancelLongPress();
        try { element.setPointerCapture(event.pointerId); } catch { /* keep panning without capture */ }
      }
      current.x = event.clientX;
      current.y = event.clientY;
      if (dx) setPanX(previous => clampPan(clampPan(previous, state.contentWidth, state.frame.width) + dx, state.contentWidth, state.frame.width));
      if (dy) {
        const top = element.scrollTop - dy;
        element.scrollTop = top;
        // Hand a nearly vertical swipe back to the page at the card's edge.
        if (!expanded && Math.abs(dx) < Math.abs(dy) / 4 && (top < 0 || top > element.scrollHeight - element.clientHeight)) window.scrollBy(0, top - element.scrollTop);
      }
      return;
    }
    const points = [...pointers.current.values()];
    if (points.length < 2) return;
    const distance = Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y));
    const next = limit(current.scale * distance / current.distance, state.minScale);
    if (next === state.scale) return;
    const rect = element.getBoundingClientRect();
    applyAnchoredZoom(next, current.anchorX - rect.left - state.frame.left, current.offsetY, current.contentX, current.contentY);
  };
  const endGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (gesture.current && gesture.current.mode !== 'pinch' && gesture.current.pointerId === event.pointerId) {
      try { scrollRef.current?.releasePointerCapture(event.pointerId); } catch { /* already released */ }
    }
    pointers.current.delete(event.pointerId);
    if (!pointers.current.size) gesture.current = null;
    else if (pointers.current.size === 1 && gesture.current?.mode === 'pinch') {
      const [[pointerId, point]] = pointers.current;
      gesture.current = event.type === 'pointerup' ? { mode: 'pending', ...point, pointerId, direct: true } : null;
    }
  };

  // Pan horizontally without cancelling native vertical scrolling, including diagonal glides.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      const state = view.current;
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        setScaleAt(state.scale * Math.exp(-event.deltaY * 0.01), event.clientX, event.clientY);
        return;
      }
      if (!state.sideways || !event.deltaX) return;
      setPanX(previous => clampPan(clampPan(previous, state.contentWidth, state.frame.width) - event.deltaX, state.contentWidth, state.frame.width));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);
  const onBoardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const element = scrollRef.current;
    const state = view.current;
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomAtCentre(1.25); }
    else if (event.key === '-' || event.key === '_') { event.preventDefault(); zoomAtCentre(1 / 1.25); }
    else if (event.key === '0') { event.preventDefault(); fitToCard(); }
    else if (event.key.startsWith('Arrow')) {
      const step = event.shiftKey ? 120 : 40;
      const dx = event.key === 'ArrowLeft' ? step : event.key === 'ArrowRight' ? -step : 0;
      const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
      if (!dx && !dy) return;
      event.preventDefault();
      if (dy && element) element.scrollTop += dy;
      if (dx) setPanX(clampPan(state.panShift + dx, state.contentWidth, state.frame.width));
    }
  };
  // Measure before paint so the fitted scale is in place on the first frame and nodes never jump
  // under a click or double-click.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const measure = () => {
      const style = getComputedStyle(element);
      const left = parseFloat(style.paddingLeft) || 0, top = parseFloat(style.paddingTop) || 0;
      const width = element.clientWidth - left - (parseFloat(style.paddingRight) || 0);
      const height = element.clientHeight - top - (parseFloat(style.paddingBottom) || 0);
      setFrame(previous => previous.width === width && previous.height === height && previous.left === left && previous.top === top ? previous : { width: Math.max(0, width), height: Math.max(0, height), left, top });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded]);
  const parents = useMemo(() => new Map(diagram.nodes.flatMap(node => node.children.map(child => [child, node] as const))), [diagram]);
  const parent = parents.get(selectedId);
  const linear = useMemo(() => diagram.kind === 'dependency' ? orderedDependencyNodes(diagram) : [], [diagram]);
  const canShift = (id: string, direction: -1 | 1) => {
    if (diagram.kind === 'dependency') {
      const index = linear.findIndex(node => node.id === id);
      return index >= 0 && index + direction >= 0 && index + direction < linear.length;
    }
    const owner = parents.get(id);
    if (!owner) return false;
    const index = owner.children.indexOf(id);
    return index >= 0 && index + direction >= 0 && index + direction < owner.children.length;
  };

  useEffect(() => { labelUndo.current = undefined; setDraft(diagramRef.current.nodes.find(node => node.id === selectedId)?.label ?? ''); if (focusLabel.current) { focusLabel.current = false; labelRef.current?.focus(); } }, [selectedId]);
  useEffect(() => {
    const field = sourceRef.current;
    if (!field) return;
    field.style.height = '0px';
    field.style.height = `${field.scrollHeight}px`;
  }, [source]);
  useEffect(() => {
    const query = initialQuery.trim();
    const revision = editRevision.current;
    let live = true;
    const load = async () => {
      if (!query) return readTreeDraft(profileId);
      const saved = await findSavedTree(profileId, query);
      const diagram = saved?.diagram;
      if (!diagram) return;
      return { diagram, source: treeText(diagram), form: diagram.form ?? (diagram.kind === 'dependency' ? 'dependency' as const : 'constituency' as const), generated: diagram.nodes.length > 1 };
    };
    load().then(saved => {
      if (!live || revision !== editRevision.current || !saved) return;
      const { diagram } = saved;
      setDiagram(diagram);
      setSource(saved.source);
      setGenerated(saved.generated);
      commitForm(saved.form);
      past.current = [];
      future.current = [];
      labelUndo.current = undefined;
      bumpHistory(value => value + 1);
      setSelected(diagram.root);
      setDraft(diagram.nodes.find(node => node.id === diagram.root)?.label ?? '');
      setProblem('');
    }).catch(() => { if (live && revision === editRevision.current) setProblem(historyCopy[localeRef.current].failed); })
      .finally(() => { if (live) setDraftReady(true); });
    return () => { live = false; };
  }, [profileId, initialQuery, commitForm]);

  // Persist edits immediately; navigation must not cancel a pending draft write.
  useEffect(() => {
    if (!draftReady || disabled || !editRevision.current) return;
    let live = true;
    void saveTreeDraft(profileId, { diagram, source, form, generated }).then(() => { if (live) setAutoSaveFailed(false); }, () => { if (live) setAutoSaveFailed(true); });
    return () => { live = false; };
  }, [profileId, diagram, source, form, generated, draftReady, disabled]);

  const closeNodeMenu = useCallback(() => setNodeMenu(undefined), []);
  const openNodeMenu = (id: string, element: HTMLElement) => {
    if (disabled) return;
    cancelLongPress();
    const rect = element.getBoundingClientRect();
    setSelected(id);
    setNodeMenu({ id, invoker: element, rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom } });
  };
  useEffect(() => {
    window.addEventListener('scroll', cancelLongPress, true);
    window.addEventListener('blur', cancelLongPress);
    return () => { cancelLongPress(); window.removeEventListener('scroll', cancelLongPress, true); window.removeEventListener('blur', cancelLongPress); };
  }, [cancelLongPress, disabled, diagram]);
  const edited = (keepRequestedForm = false) => {
    editRevision.current += 1;
    drawRequest.current?.abort();
    if (!keepRequestedForm) requestedForm.current = form;
  };
  const markHistory = () => bumpHistory(value => value + 1);
  const currentStep = (): Step => ({ diagram, form, selected: selectedId, source, draft, generated });
  const pushHistory = () => {
    past.current.push(currentStep());
    if (past.current.length > 50) past.current.shift();
    future.current = [];
    labelUndo.current = undefined;
    markHistory();
  };
  const restoreStep = (step: Step) => {
    edited();
    setDiagram(step.diagram);
    setGenerated(step.generated);
    commitForm(step.form);
    setSelected(step.selected);
    setSource(step.source);
    setDraft(step.draft);
    setEditingId(undefined);
    setNotice('');
    setProblem('');
    labelUndo.current = undefined;
    markHistory();
  };
  const undo = () => {
    const step = past.current.pop();
    if (!step) return;
    future.current.push(currentStep());
    restoreStep(step);
  };
  const redo = () => {
    const step = future.current.pop();
    if (!step) return;
    past.current.push(currentStep());
    restoreStep(step);
  };
  const blankNow = isClearedTree(diagram, source, form);
  const clearTree = () => {
    if (blankNow) return;
    const blank = blankTree(form);
    pushHistory();
    edited();
    setDiagram(blank);
    setGenerated(false);
    setSource('');
    setSelected(blank.root);
    setDraft(blank.nodes[0]?.label ?? '');
    setEditingId(undefined);
    setNotice('');
    setProblem('');
  };
  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  undoRef.current = undo;
  redoRef.current = redo;
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.isComposing || !(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;
      const field = document.activeElement;
      if ((field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) && field.id !== 'tree-label' && !field.classList.contains('tree-node-edit')) return;
      if (document.querySelector('dialog[open]')) return;
      event.preventDefault();
      if (key === 'y' || event.shiftKey) redoRef.current();
      else undoRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const grow = (next: Diagram, id: string) => {
    pushHistory();
    edited();
    // Keep mobile taps on the board instead of scrolling to the separate label input.
    focusLabel.current = !matchMedia('(pointer: coarse)').matches;
    if (!focusLabel.current) nodeMenu?.invoker.focus({ preventScroll: true });
    setDiagram(next);
    setSelected(id);
    setNotice('');
    setProblem('');
  };
  // Movement mode coindexes nodes without changing their parent or sibling order.
  const [moveOpen, setMoveOpen] = useState(false);
  const movementMode = moveOpen && !disabled && diagram.nodes.length > 1;
  const movementDrag = useRef<{ id: string; pointerId: number; x: number; y: number; moved: boolean } | null>(null);
  const suppressMoveClick = useRef(false);
  const startNodePress = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    cancelLongPress();
    suppressMoveClick.current = false;
    // Native touch dragging must not compete with the long-press menu.
    event.currentTarget.draggable = event.pointerType !== 'touch' && !disabled && !movementMode && id !== diagram.root;
    if (movementMode) startMovement(event, id);
    else if (event.pointerType !== 'touch') setSelected(id);
    if (disabled || event.pointerType !== 'touch' || !event.isPrimary) return;
    const element = event.currentTarget;
    longPress.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, timer: setTimeout(() => {
      longPress.current = null;
      movementDrag.current = null;
      suppressMoveClick.current = true;
      finishDrag();
      if (element.isConnected) openNodeMenu(id, element);
    }, 500) };
  };
  const moveNodePress = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const press = longPress.current;
    if (press && press.pointerId === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) >= 4) cancelLongPress();
    moveMovement(event);
  };
  const endNodePress = (event: ReactPointerEvent<HTMLButtonElement>) => { cancelLongPress(); endMovement(event); };
  const selectedHasIndex = diagram.nodes.some(node => node.id === selectedId && labelIndex(node.label) !== undefined);
  const canLinkMove = (fromId: string, toId: string) => {
    if (toId !== diagram.root && !parents.has(toId)) return false;
    for (let id: string | undefined = toId; id; id = parents.get(id)?.id) {
      if (id === fromId) return false;
    }
    return true;
  };
  const linkMove = (fromId: string, partnerId: string) => {
    if (!canLinkMove(fromId, partnerId)) return;
    try {
      const next = linkMovement(diagram, fromId, partnerId);
      pushHistory(); edited(); setDiagram(next); setSelected(fromId); setNotice(''); setProblem('');
    } catch (error) { setProblem(error instanceof Error && error.message === 'TREE_MOVE_INDEX' ? t.moveIndexFull : t.tooBig); }
  };
  const movementTarget = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-tree-node]');
    return target && scrollRef.current?.contains(target) ? target.dataset.treeNode : undefined;
  };
  const startMovement = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    if (!movementMode || event.button !== 0) return;
    event.stopPropagation();
    setSelected(id);
    suppressMoveClick.current = false;
    movementDrag.current = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveMovement = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = movementDrag.current;
    if (!movementMode || !drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 4) return;
    drag.moved = true;
    setDraggingId(drag.id);
    const target = movementTarget(event);
    setDropId(target && canLinkMove(drag.id, target) ? target : undefined);
  };
  const endMovement = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = movementDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    movementDrag.current = null;
    suppressMoveClick.current = drag.moved;
    finishDrag();
    if (event.type === 'pointerup' && movementMode && drag.moved) {
      const target = movementTarget(event);
      if (target) linkMove(drag.id, target);
    }
  };
  const clearMove = (id: string) => {
    try {
      const next = unlinkMovement(diagram, id);
      if (next === diagram) return;
      pushHistory(); edited(); setDiagram(next); setNotice(''); setProblem('');
    } catch { setProblem(t.tooBig); }
  };
  const createChild = (id: string) => { try { const next = addChild(diagram, id); grow(next, next.nodes.at(-1)!.id); } catch { setProblem(t.tooBig); } };
  const createSibling = (id: string) => { try { const next = addSibling(diagram, id); grow(next, next.nodes.at(-1)!.id); } catch { setProblem(t.tooBig); } };
  const shiftNode = (id: string, direction: -1 | 1) => {
    const next = moveNode(diagram, id, direction);
    if (next === diagram) return;
    pushHistory();
    edited();
    setDiagram(next);
    setSelected(id);
    setNotice('');
  };
  const deleteNode = (id: string) => {
    const next = removeNode(diagram, id);
    if (next === diagram) return;
    pushHistory();
    edited();
    const parentNode = parents.get(id);
    setDiagram(next);
    if (parentNode) setSelected(parentNode.id);
    setNotice('');
  };
  const dropNode = (fromId: string | undefined, toId: string) => {
    if (!fromId) return;
    const siblings = parents.get(fromId)?.id === parents.get(toId)?.id;
    try {
      const next = siblings ? reorderTo(diagram, fromId, toId) : reparentNode(diagram, fromId, toId);
      if (next === diagram) return;
      pushHistory();
      edited();
      setDiagram(next);
      setSelected(fromId);
      setNotice('');
      setProblem('');
    }
    catch { setProblem(t.tooBig); }
  };
  const startDrag = (event: DragEvent<HTMLButtonElement>, id: string) => {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
    // A render during dragstart replaces the source node and cancels the drag.
    dragFrame.current = requestAnimationFrame(() => { dragFrame.current = 0; setDraggingId(id); });
  };
  const finishDrag = () => { if (dragFrame.current) cancelAnimationFrame(dragFrame.current); setDraggingId(undefined); setDropId(undefined); };
  const toggleMovement = () => { setMoveOpen(open => !open); movementDrag.current = null; finishDrag(); };
  const copyTree = async () => {
    const text = treeText(diagram);
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const field = document.createElement('textarea');
        field.value = text;
        field.setAttribute('readonly', '');
        document.body.appendChild(field);
        try {
          field.select();
          if (!document.execCommand('copy')) throw new Error('TREE_COPY');
        } finally { field.remove(); }
      }
      setNotice(t.copied);
      setProblem('');
    } catch { setProblem(t.copyFailed); setNotice(''); }
  };
  const draw = (text = source, nextForm = requestedForm.current) => {
    const written = isWrittenTreeInput(text);
    drawRequest.current?.abort();
    const request = new AbortController();
    drawRequest.current = request;
    const revision = ++editRevision.current;
    const apply = (pos?: PosLookup, modeled?: Diagram) => {
      if (request.signal.aborted || revision !== editRevision.current) return;
      try {
        const next = modeled ?? drawTree(text, written ? 'constituency' : nextForm, pos);
        pushHistory();
        edited();
        setSource(text);
        setGenerated(!written);
        setDiagram(next);
        commitForm(next.form ?? nextForm);
        setSelected(next.root);
        setDraft(next.nodes.find(node => node.id === next.root)?.label ?? '');
        setEditingId(undefined);
        setNotice('');
        setProblem('');
      } catch (error) {
        requestedForm.current = form;
        setProblem(error instanceof Error && error.message === 'TREE_TOO_BIG' ? t.tooBig : t.parseFailed);
      }
    };
    if (written) { apply(); return; }
    void parser.parse(text, request.signal, nextForm).then(async model => {
      if (request.signal.aborted) return;
      if (model && nextForm !== 'constituency') { apply(undefined, model); return; }
      const pos = await loadWordNetPos(text.split(/\s+/u)).catch(() => undefined);
      if (request.signal.aborted) return;
      if (!model) { apply(pos); return; }
      let prior: Diagram | undefined;
      try { prior = drawTree(text, nextForm, pos); } catch { /* The model may succeed where the rules fail. */ }
      // Retain the rule-based tree when it has movement traces.
      apply(undefined, prior?.nodes.some(node => isTraceLabel(node.label)) ? prior : model);
    });
  };
  const chooseForm = (value: string) => {
    if (!treeForms.includes(value as TreeForm)) return;
    const nextForm = value as TreeForm;
    if (nextForm === requestedForm.current) return;
    if (nextForm === form) { drawRequest.current?.abort(); requestedForm.current = form; return; }
    // A new sentence keeps this choice even while the dictionary request is pending.
    requestedForm.current = nextForm;
    if (blankNow) {
      edited();
      const blank = blankTree(nextForm);
      pushHistory();
      commitForm(nextForm);
      setDiagram(blank);
      setGenerated(false);
      setSelected(blank.root);
      setDraft(blank.nodes[0]?.label ?? '');
      setEditingId(undefined);
      setProblem('');
      return;
    }
    if (!source.trim()) { edited(); commitForm(nextForm); return; }
    draw(source, nextForm);
  };
  const changeLabel = (value: string) => {
    edited();
    setDraft(value);
    setNotice('');
    if (!labelAllowed(value)) return;
    try {
      const next = renameNode(diagram, selectedId, value);
      if (labelUndo.current !== selectedId) {
        past.current.push(currentStep());
        if (past.current.length > 50) past.current.shift();
        labelUndo.current = selectedId;
      }
      future.current = [];
      markHistory();
      setDiagram(next);
      setProblem('');
    }
    catch { setProblem(t.parseFailed); }
  };
  const insertSymbol = (symbol: string) => {
    const active = document.activeElement;
    const live = active === sourceRef.current ? sourceRef.current : active === labelRef.current ? labelRef.current : active instanceof HTMLTextAreaElement && active.classList.contains('tree-node-edit') ? active : null;
    // A closed inline editor hands its caret back to the selected-node label field.
    const remembered = symbolInput.current;
    const rememberedField = remembered?.isConnected ? remembered : remembered?.classList.contains('tree-node-edit') ? labelRef.current : null;
    const field = live ?? rememberedField ?? sourceRef.current;
    if (!field) return;
    const atEnd = !live && field !== rememberedField;
    const caretEnd = field.value.length;
    const start = live ? field.selectionStart ?? caretEnd : atEnd ? caretEnd : symbolCaret.current.start;
    const end = live ? field.selectionEnd ?? start : atEnd ? caretEnd : symbolCaret.current.end;
    const limit = field.maxLength > 0 ? field.maxLength : 200_000;
    if (field.value.length - (end - start) + symbol.length > limit) return;
    const next = field.value.slice(0, start) + symbol + field.value.slice(end);
    const caret = start + symbol.length;
    // Keep focus within the tap gesture so touch keyboards can open without a page jump.
    field.focus({ preventScroll: true });
    symbolCaret.current = { start: caret, end: caret };
    if (field === sourceRef.current) { pushHistory(); edited(true); setSource(next); }
    else changeLabel(next);
    requestAnimationFrame(() => { if (field.isConnected) field.setSelectionRange(caret, caret); });
  };
  const noteSymbolField = (field: HTMLTextAreaElement) => {
    symbolInput.current = field;
    symbolCaret.current = { start: field.selectionStart ?? field.value.length, end: field.selectionEnd ?? field.value.length };
  };
  const beginEdit = (id: string, label: string) => {
    if (disabled) return;
    editOrigin.current = label;
    cancelEdit.current = false;
    setNodeMenu(undefined);
    setSelected(id);
    setDraft(label);
    setEditingId(id);
  };
  const finishEdit = () => {
    if (cancelEdit.current) { cancelEdit.current = false; setEditingId(undefined); return; }
    labelUndo.current = undefined;
    setDraft(diagram.nodes.find(node => node.id === editingId)?.label ?? draft);
    setEditingId(undefined);
  };
  const cancelNodeEdit = () => {
    const origin = editOrigin.current;
    cancelEdit.current = true;
    if (labelUndo.current === editingId && past.current.length) { past.current.pop(); labelUndo.current = undefined; markHistory(); }
    if (editingId && labelAllowed(origin)) { try { setDiagram(renameNode(diagram, editingId, origin)); } catch { /* Keep the current label if restoration is rejected. */ } }
    setDraft(origin);
    setEditingId(undefined);
  };
  useEffect(() => { if (naming) { nameCancel.current?.setAttribute('autofocus', ''); showModal(nameDialog.current); } }, [naming]);
  useEffect(() => { if (!formatsOpen || (document.activeElement === suffixRef.current && !formatFromKeys.current)) return; formatFromKeys.current = false; formatMenu.current?.querySelector<HTMLButtonElement>('[aria-selected=true]')?.focus({ preventScroll: true }); }, [formatsOpen]);
  // The default name is the drawn sentence with hyphens between words. It comes from the drawing,
  // so an edited label is reflected; the typed sentence fills in when the drawing cannot name
  // itself, as with bare phrase structure (a head word is the node, not a leaf) or a blank board.
  const defaultName = () => {
    const drawn = treeFileName(diagram);
    return drawn === 'syntax-tree' ? sentenceFileName(source) ?? drawn : drawn;
  };
  const openName = (kind: ExportKind) => { setNaming(kind); setFormat('svg'); setFormatsOpen(false); setFallback(defaultName()); setExportName(''); setExportError(''); };
  const chooseFormat = (value: ExportFormat) => { setFormat(value); setFormatsOpen(false); suffixRef.current?.focus({ preventScroll: true }); };
  const closeName = () => closeModal(nameDialog.current, () => { setNaming(undefined); (naming === 'export' ? exportButton : saveButton).current?.focus(); });
  const rasterBlob = (background?: string, type = 'image/png', quality?: number) => new Promise<Blob | null>(resolve => {
    const colors = themeColors();
    // Browsers cap canvas dimensions, so very large trees are rendered at a reduced scale.
    const scale = Math.min(2, 16000 / Math.max(layout.width, layout.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(layout.width * scale);
    canvas.height = Math.ceil(layout.height * scale);
    const context = canvas.getContext('2d', { alpha: !background });
    if (!context) { resolve(null); return; }
    context.scale(scale, scale);
    if (background) { context.fillStyle = background; context.fillRect(0, 0, layout.width, layout.height); }
    context.strokeStyle = colors.line;
    context.lineWidth = 1.5;
    for (const edge of layout.edges) {
      context.beginPath();
      if (edge.movement) {
        for (const stroke of movementStrokes(edge)) stroke.forEach((point, index) => {
          if (index) context.lineTo(point.x, point.y);
          else context.moveTo(point.x, point.y);
        });
      } else if (edge.bend) {
        const cx = (edge.x1 + edge.x2) / 2, cy = Math.min(edge.y1, edge.y2) - edge.bend;
        context.moveTo(edge.x1, edge.y1);
        context.quadraticCurveTo(cx, cy, edge.x2, edge.y2);
      } else { context.moveTo(edge.x1, edge.y1); context.lineTo(edge.x2, edge.y2); }
      context.stroke();
    }
    context.fillStyle = '#000';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '600 12px system-ui, sans-serif';
    for (const edge of layout.edges) {
      if (!edge.label) continue;
      const { x, y } = treeEdgeLabelPoint(edge);
      context.fillText(edge.label, x, y);
    }
    for (const edge of layout.edges) if (edge.arrow || edge.movement) {
      const [tip, left, right] = treeArrowPoints(edge);
      context.beginPath();
      context.moveTo(tip.x, tip.y);
      context.lineTo(left.x, left.y);
      context.lineTo(right.x, right.y);
      context.closePath();
      context.fill();
    }
    context.font = '600 16px system-ui, sans-serif';
    for (const node of layout.nodes) {
      const rows = labelLines(node.label);
      const top = node.y + node.height / 2 - (rows.length - 1) * 9;
      rows.forEach((line, index) => context.fillText(line, node.x + node.width / 2, top + index * 18));
    }
    canvas.toBlob(resolve, type, quality);
  });
  const confirmName = async () => {
    if (!naming) return;
    const filename = acceptedName(exportName, fallback);
    if (!filename) { setExportError(backupLabels[locale].invalidName); return; }
    try {
      if (naming === 'save') await recordTree(profileId, filename, diagram);
      else await saveExport(filename, format);
      closeModal(nameDialog.current, () => { setNaming(undefined); setNotice(naming === 'save' ? t.saved : ''); setProblem(''); (naming === 'export' ? exportButton : saveButton).current?.focus(); });
    } catch { setExportError(naming === 'save' ? historyCopy[locale].saveFailed : t.exportFailed); }
  };
  async function saveExport(filename: string, selectedFormat: ExportFormat) {
    const extension = exportExtension[selectedFormat];
    if (selectedFormat === 'svg') { saveFile(new Blob([treeSvg(layout, themeColors())], { type: 'image/svg+xml' }), `${filename}.${extension}`); return; }
    if (selectedFormat === 'pdf') {
      saveFile(new Blob([treePdf(layout, layout.nodes.map(node => labelBitmap(node.label)), layout.edges.map(edge => edge.label ? labelBitmap(edge.label) : null))], { type: 'application/pdf' }), `${filename}.${extension}`);
      return;
    }
    const type = selectedFormat === 'jpeg' ? 'image/jpeg' : selectedFormat === 'webp' ? 'image/webp' : 'image/png';
    const blob = await rasterBlob(selectedFormat === 'jpeg' ? '#fff' : undefined, type, selectedFormat === 'jpeg' ? 0.92 : undefined);
    if (blob?.type !== type) throw new Error('TREE_EXPORT');
    saveFile(blob, `${filename}.${extension}`);
  }

  const incompleteDerivation = generated && form === 'ccg' && diagram.nodes.length > 1 && diagram.nodes.some(node => node.label === '?');
  return <section className="reference-page tree-page" onKeyDown={event => { if (event.key === 'Escape' && movementMode && !event.defaultPrevented && !event.nativeEvent.isComposing) { event.preventDefault(); setMoveOpen(false); movementDrag.current = null; finishDrag(); } }}><h1>{t.title}</h1>
    {problem && <p className="error" role="alert">{problem}</p>}
    {autoSaveFailed && <p className="error" role="alert">{t.autoSaveFailed}</p>}
    {notice && <p role="status">{notice}</p>}
    <div className="tree-toolbar">
      <div className="tree-form"><SettingsPicker label={t.form.label} value={form} disabled={disabled} options={treeForms.map(value => ({ value, label: t.form[value] }))} onChange={chooseForm}/><div className="tree-history" dir="ltr"><button type="button" title={t.undo} aria-label={t.undo} disabled={disabled || !past.current.length} onClick={undo}><HistoryIcon direction="undo"/></button><button type="button" title={t.redo} aria-label={t.redo} disabled={disabled || !future.current.length} onClick={redo}><HistoryIcon direction="redo"/></button><button type="button" className="tree-clear" title={t.clear} aria-label={t.clear} disabled={disabled || blankNow} onClick={clearTree}><ClearIcon/></button></div></div>
      <div className="tree-actions">
        <button className="button" type="button" disabled={disabled} onClick={() => createChild(selectedId)}>{t.addChild}</button>
        <button className="button" type="button" disabled={disabled || !parent} onClick={() => createSibling(selectedId)}>{t.addSibling}</button>
        <button className="button" type="button" disabled={disabled || selectedId === diagram.root} onClick={() => deleteNode(selectedId)}>{t.remove}</button>
        <div className="tree-movement-actions" dir="ltr" role="group" aria-label={t.move}>
          <button className="button" type="button" disabled={disabled || !canShift(selectedId, -1)} onClick={() => shiftNode(selectedId, -1)}>{t.moveLeft}</button>
          <button className="button" type="button" disabled={disabled || !canShift(selectedId, 1)} onClick={() => shiftNode(selectedId, 1)}>{t.moveRight}</button>
          <button className={movementMode ? 'primary' : 'button'} type="button" disabled={disabled || diagram.nodes.length < 2} aria-pressed={movementMode} onClick={toggleMovement}>{t.move}</button>
          {selectedHasIndex && <button className="button" type="button" disabled={disabled} onClick={() => clearMove(selectedId)}>{t.moveClear}</button>}
        </div>
      </div>
    </div>
    <div ref={frameRef} className="tree-frame" data-expanded={expanded ? '' : undefined} role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined} aria-label={expanded ? t.title : undefined} onKeyDown={expanded ? event => cycleModalFocus(event, event.currentTarget) : undefined}>
    <div className="tree-zoom" dir="ltr" role="group" aria-label={t.zoom.group}>
      <button type="button" aria-label={t.zoom.out} title={t.zoom.out} disabled={scale <= minScale} onClick={() => zoomAtCentre(1 / 1.25)}><ZoomIcon direction="out"/></button>
      <button type="button" className="tree-zoom-level" aria-label={`${t.zoom.fit}: ${percent}%`} title={t.zoom.fit} onClick={fitToCard}>{percent}%</button>
      <button type="button" aria-label={t.zoom.in} title={t.zoom.in} disabled={scale >= 4} onClick={() => zoomAtCentre(1.25)}><ZoomIcon direction="in"/></button>
      <button ref={fullscreenButton} type="button" className="tree-zoom-fullscreen" aria-label={expanded ? t.zoom.exitFullscreen : t.zoom.fullscreen} title={expanded ? t.zoom.exitFullscreen : t.zoom.fullscreen} aria-pressed={expanded} onClick={() => setFullscreen(!expanded)}><FullscreenIcon exit={expanded}/></button>
    </div>
    <div className="tree-scroll" dir="ltr" ref={scrollRef} data-sideways={sideways ? '' : undefined} tabIndex={0} role="group" aria-label={t.zoom.group} onPointerDownCapture={event => { if (!event.isPrimary) cancelLongPress(); }} onPointerDown={startGesture} onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={endGesture} onKeyDown={onBoardKeyDown}>
      <div className="tree-canvas" style={{ left: frame.left + baseX + panShift, top: frame.top + baseY, width: contentWidth, height: contentHeight }}>
        <div className="tree-board" data-movement={movementMode ? '' : undefined} dir="ltr" role="tree" aria-label={t.title} style={{ width: layout.width, height: layout.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
      <svg aria-hidden="true" width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`}>{layout.edges.map((edge, index) => edge.movement ? <path key={index} d={movementPath(edge)} /> : edge.bend ? <path key={index} d={`M ${edge.x1} ${edge.y1} Q ${(edge.x1 + edge.x2) / 2} ${Math.min(edge.y1, edge.y2) - edge.bend} ${edge.x2} ${edge.y2}`} /> : <line key={index} x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2} />)}{layout.edges.map((edge, index) => edge.arrow || edge.movement ? <path key={`arrow-${index}`} className="tree-arrow" d={treeArrowPath(edge)} /> : null)}{layout.edges.map((edge, index) => edge.label ? <text key={`rel-${index}`} className="tree-edge-label" {...treeEdgeLabelPoint(edge)}>{edge.label}</text> : null)}</svg>
      {layout.nodes.map(node => editingId === node.id
        ? <SingleLineField key={node.id} className="tree-node tree-node-edit" dir="auto" aria-label={editOrigin.current || node.label} maxLength={200} value={draft} disabled={disabled} style={{ left: node.x, top: node.y, width: Math.max(node.width, 44), height: node.height }} autoFocus onFocus={event => { event.currentTarget.select(); noteSymbolField(event.currentTarget); }} onChange={event => changeLabel(event.target.value)} onBlur={event => { noteSymbolField(event.currentTarget); const toSymbols = event.relatedTarget instanceof Element && !!event.relatedTarget.closest('.tree-symbols'); if (toSymbols) return; finishEdit(); }} onKeyDown={event => { if (event.nativeEvent.isComposing) return; if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } if (event.key === 'Escape') { event.preventDefault(); cancelNodeEdit(); } }}/>
        : <button key={node.id} type="button" className={`tree-node${draggingId === node.id ? ' tree-node-dragging' : ''}${dropId === node.id ? ' tree-node-drop' : ''}`} role="treeitem" aria-selected={node.id === selectedId} aria-label={labelLines(node.label).length > 1 ? labelLines(node.label).join(' ') : undefined} dir="auto" data-tree-node={node.id} draggable={!disabled && !movementMode && node.id !== diagram.root} disabled={disabled} style={{ left: node.x, top: node.y, width: node.width, height: node.height }} onClick={event => { if (suppressMoveClick.current) { suppressMoveClick.current = false; return; } if (movementMode && event.detail === 0 && selectedId !== node.id) linkMove(selectedId, node.id); else setSelected(node.id); }} onPointerDown={event => startNodePress(event, node.id)} onPointerMove={moveNodePress} onPointerUp={endNodePress} onPointerCancel={endNodePress} onLostPointerCapture={endNodePress} onDoubleClick={() => { if (!movementMode) beginEdit(node.id, node.label); }} onContextMenu={event => { event.preventDefault(); openNodeMenu(node.id, event.currentTarget); }} onDragStart={event => startDrag(event, node.id)} onDragEnd={finishDrag} onDragOver={event => { if (!draggingId || !canDropNode(diagram, draggingId, node.id)) return; event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move'; setDropId(current => current === node.id ? current : node.id); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropId(current => current === node.id ? undefined : current); }} onDrop={event => { event.preventDefault(); event.stopPropagation(); const fromId = draggingId; const toId = dropId && diagram.nodes.some(item => item.children.includes(fromId ?? '') && item.children.includes(dropId)) ? dropId : node.id; finishDrag(); dropNode(fromId, toId); }}>{labelLines(node.label).map((line, index) => <span key={index}>{line}</span>)}</button>)}
        </div>
      </div>
    </div>
    </div>
    {nodeMenu && diagram.nodes.some(node => node.id === nodeMenu.id) && createPortal(<NodeMenu menu={nodeMenu} label={diagram.nodes.find(node => node.id === nodeMenu.id)?.label ?? t.title} onClose={closeNodeMenu} items={(() => { const id = nodeMenu.id; return [{ label: t.addChild, run: () => createChild(id) }, { label: t.addSibling, disabled: !diagram.nodes.some(node => node.children.includes(id)), run: () => createSibling(id) }, { label: t.moveLeft, disabled: !canShift(id, -1), run: () => shiftNode(id, -1) }, { label: t.moveRight, disabled: !canShift(id, 1), run: () => shiftNode(id, 1) }, { label: t.move, disabled: disabled || diagram.nodes.length < 2, checked: movementMode, run: toggleMovement }, ...(labelIndex(diagram.nodes.find(node => node.id === id)!.label) !== undefined ? [{ label: t.moveClear, run: () => clearMove(id) }] : []), { label: t.remove, disabled: id === diagram.root, run: () => deleteNode(id) }]; })()}/>, expanded ? frameRef.current ?? document.body : document.body)}
    <div className="tree-symbols" dir="ltr" role="group" aria-label={t.symbol.group}>{treeSymbols.map(([name, glyph]) => <button key={name} type="button" dir="ltr" disabled={disabled} aria-label={t.symbol[name]} onPointerDown={event => event.preventDefault()} onClick={() => insertSymbol(glyph)}>{glyph}</button>)}</div>
    <label className="reference-search tree-source"><span className="tree-source-head">{t.source}{incompleteDerivation && <small id="tree-generated-note" className="tree-generated-note">{t.incomplete}</small>}</span><textarea autoComplete="off" id="tree-source" dir="ltr" aria-label={t.source} aria-describedby={incompleteDerivation ? "tree-generated-note" : undefined} ref={sourceRef} rows={1} value={source} maxLength={200_000} disabled={disabled} onFocus={event => noteSymbolField(event.currentTarget)} onBlur={event => noteSymbolField(event.currentTarget)} onChange={event => { edited(true); setSource(event.target.value); }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); draw(event.currentTarget.value); } }}/></label>
    <label className="tree-field" htmlFor="tree-label">{t.label}<SingleLineField id="tree-label" dir="auto" ref={labelRef} value={draft} maxLength={200} disabled={disabled} onFocus={event => noteSymbolField(event.currentTarget)} onChange={event => changeLabel(event.target.value)} onBlur={event => { noteSymbolField(event.currentTarget); const toSymbols = event.relatedTarget instanceof Element && !!event.relatedTarget.closest('.tree-symbols'); if (!toSymbols) setDraft(diagram.nodes.find(node => node.id === selectedId)?.label ?? draft); }}/></label>
    <div className="tree-actions tree-save-actions">
      <button className="button" type="button" disabled={disabled} onClick={() => void copyTree()}>{t.copy}</button>
      <button className="button" type="button" ref={saveButton} disabled={disabled} onClick={() => openName('save')}>{t.save}</button>
      <button className="button" type="button" ref={exportButton} disabled={disabled} onClick={() => openName('export')}>{t.export}</button>
    </div>
    {naming && createPortal(<dialog ref={nameDialog} className="offline-remove-dialog backup-export-dialog" aria-labelledby="tree-export-title" onCancel={event => { event.preventDefault(); if (formatsOpen) { setFormatsOpen(false); suffixRef.current?.focus({ preventScroll: true }); return; } closeName(); }} onClick={event => { if (event.target === event.currentTarget) closeName(); }}>
      <form autoComplete="off" onSubmit={event => { event.preventDefault(); void confirmName(); }} onClick={event => { if (event.target instanceof Element && event.target.closest('.tree-format-suffix, .tree-format-menu')) return; setFormatsOpen(false); }}>
        <h2 id="tree-export-title">{naming === 'save' ? t.save : t.export}</h2>
        <label className="backup-export-label" htmlFor="tree-export-name">{backupLabels[locale].fileName}</label>
        <div className="backup-export-field" dir="ltr"><SingleLineField id="tree-export-name" dir="auto" maxLength={80} value={exportName} placeholder={fallback} data-default={!exportName.trim()} aria-describedby={naming === 'export' ? 'tree-export-extension' : undefined} aria-invalid={!!exportError} onChange={event => { setExportName(event.target.value); setExportError(''); }}/>{naming === 'export' && <button ref={suffixRef} id="tree-export-extension" className="tree-format-suffix" type="button" dir="ltr" aria-haspopup="listbox" aria-expanded={formatsOpen} aria-controls="tree-format-menu" aria-label={`${t.format}: .${exportExtension[format]}`} onClick={() => setFormatsOpen(open => !open)} onKeyDown={event => { if (event.key === 'Escape' && formatsOpen) { event.preventDefault(); setFormatsOpen(false); return; } if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); formatFromKeys.current = true; setFormatsOpen(true); } }}>.{exportExtension[format]}<span className="tree-format-chevron" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" focusable="false"><path d="m6 9 6 6 6-6"/></svg></span></button>}</div>
        {naming === 'export' && formatsPresent && <div ref={formatMenu} id="tree-format-menu" className="tree-format-menu" data-open={formatsOpen} role="listbox" aria-label={t.format} aria-hidden={!formatsOpen} inert={!formatsOpen}><div className="tree-format-menu-clip"><div className="tree-format-options">{exportFormats.map(([value, label], index) => <button key={value} type="button" role="option" aria-selected={format === value} onClick={() => chooseFormat(value)} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setFormatsOpen(false); suffixRef.current?.focus({ preventScroll: true }); return; } moveFormat(event, index); }}><span className="setting-check" aria-hidden="true">{format === value && <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 3 3 7-8"/></svg>}</span>{label}</button>)}</div></div></div>}
        {exportError && <p className="error" role="alert">{exportError}</p>}
        <div className="offline-remove-dialog-actions"><button className="button" ref={nameCancel} type="button" onClick={closeName}>{backupLabels[locale].cancel}</button><button className="primary" type="submit">{backupLabels[locale].save}</button></div>
      </form>
    </dialog>, document.body)}
  </section>;
}
