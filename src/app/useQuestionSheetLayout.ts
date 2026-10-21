import { cardInteraction } from './cardInteraction';
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';

const textEntry = (target: EventTarget | null) => target instanceof Element && !!target.closest('textarea,[contenteditable]:not([contenteditable=false]),input:not([type=checkbox],[type=radio],[type=range],[type=button],[type=submit],[type=reset],[type=file],[type=color])');

export function questionSheetSize(viewport: number, headerBottom: number, requested?: number) {
  const maximum = Math.max(0, viewport - headerBottom - 24), minimum = Math.min(220, maximum);
  return { minimum, maximum, height: Math.min(maximum, Math.max(minimum, requested ?? viewport * .7)) };
}

export function useQuestionSheetLayout(layoutKey: string, enabled: boolean, mobile: boolean, open: boolean) {
  const clearance = useRef(0), container = useRef<HTMLElement | null>(null);
  const requested = useRef<number | undefined>(undefined), fitCurrent = useRef<(() => void) | undefined>(undefined);
  const preferred = useRef<number | undefined>(undefined);
  const drag = useRef<{ id: number; y: number; height: number; handle: HTMLElement } | undefined>(undefined);
  const activity = useRef<ReturnType<typeof cardInteraction> | undefined>(undefined);
  const viewportMotion = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [blurBackground, setBlurBackground] = useState(false);
  const [size, setSize] = useState({ minimum: 0, maximum: 0, height: 0 });
  function endDrag() {
    const current = drag.current; drag.current = undefined;
    if (!current) return;
    delete current.handle.closest<HTMLElement>('.question-panel')?.dataset.resizing;
    if (current.handle.hasPointerCapture(current.id)) current.handle.releasePointerCapture(current.id);
  }
  // Preserve reserved space across pane changes to prevent scroll clamping.
  useLayoutEffect(() => () => {
    endDrag();
    clearTimeout(viewportMotion.current);
    const main = container.current;
    if (main) delete main.querySelector<HTMLElement>('.question-panel')?.dataset.viewportResizing;
    if (main) for (const property of ['--learning-viewport', '--learning-header', '--learning-panels-height', '--learning-bottom', '--question-sheet-clearance', '--question-sheet-height']) main.style.removeProperty(property);
  }, [enabled]);
  useLayoutEffect(() => {
    if (!mobile || !open) endDrag();
    if (!enabled) return;
    const grid = document.querySelector<HTMLElement>('.learning-grid');
    const main = grid?.closest('main');
    const panel = grid?.querySelector<HTMLElement>('.question-panel');
    const header = document.querySelector<HTMLElement>('.session-header');
    if (!grid || !main || !panel || !header) return;
    container.current = main;
    const viewport = window.visualViewport;
    const toggle = panel.querySelector<HTMLElement>('.question-sheet-toggle');
    let fittedGeometry = '';
    // Use visible viewport and collapsed-card bounds, including keyboard and zoom changes.
    const fit = (scrollOnly = false) => {
      if (!grid.isConnected) return;
      const height = viewport?.height ?? innerHeight;
      const headerHeight = ['sticky', 'fixed'].includes(getComputedStyle(header).position) ? header.getBoundingClientRect().height : 0;
      const constrained = textEntry(document.activeElement) || (viewport?.scale ?? 1) > 1;
      const bottom = constrained ? Math.max(0, innerHeight - height - (viewport?.offsetTop ?? 0)) : 0;
      const geometry = [innerWidth, innerHeight, viewport?.width, height, viewport?.scale].join(':');
      // Move the anchor with panning; do not resize the card or chase focus.
      if (scrollOnly && mobile && geometry === fittedGeometry) {
        if (main.style.getPropertyValue('--learning-bottom') !== `${bottom}px`) main.style.setProperty('--learning-bottom', `${bottom}px`);
        return;
      }
      fittedGeometry = geometry;
      const viewportChanged = !!main.style.getPropertyValue('--learning-viewport') && (parseFloat(main.style.getPropertyValue('--learning-viewport')) !== height || parseFloat(main.style.getPropertyValue('--learning-bottom')) !== bottom);
      if (mobile && viewportChanged && (constrained || bottom > 0 || parseFloat(main.style.getPropertyValue('--learning-bottom')) > 0)) {
        // Follow keyboard motion without restarting height animation each frame.
        panel.dataset.viewportResizing = 'true'; clearTimeout(viewportMotion.current);
        viewportMotion.current = setTimeout(() => { delete panel.dataset.viewportResizing; viewportMotion.current = undefined; }, 160);
      }
      main.style.setProperty('--learning-viewport', `${height}px`);
      main.style.setProperty('--learning-header', `${headerHeight}px`);
      // Anchor to the document so scrolling cannot resize the card.
      const bottomSpace = parseFloat(getComputedStyle(main).getPropertyValue('--page-bottom-space'));
      main.style.setProperty('--learning-panels-height', `${Math.max(0, height - Math.max(headerHeight + 16, grid.getBoundingClientRect().top + scrollY - (viewport?.offsetTop ?? 0)) - bottomSpace)}px`);
      // Browser bars already move fixed cards; compensate only for editing or zoom.
      main.style.setProperty('--learning-bottom', `${bottom}px`);
      if (mobile && toggle) {
        clearance.current = toggle.offsetHeight;
        const headerBottom = constrained ? Math.max(headerHeight, header.getBoundingClientRect().bottom - (viewport?.offsetTop ?? 0)) : headerHeight;
        const safeBottom = Math.max(0, (parseFloat(getComputedStyle(panel).bottom) || 0) - bottom);
        // Use the stable small viewport for browser bars and visible bounds for keyboard/zoom.
        const stableMaximum = parseFloat(getComputedStyle(panel).maxHeight);
        const available = !constrained && Number.isFinite(stableMaximum) ? stableMaximum + headerHeight + 24 + safeBottom : height;
        if (!constrained || preferred.current === undefined) preferred.current = available * .7 - safeBottom;
        const next = questionSheetSize(available, headerBottom + safeBottom, requested.current ?? preferred.current);
        setSize(previous => previous.minimum === next.minimum && previous.maximum === next.maximum && previous.height === next.height ? previous : next);
        main.style.setProperty('--question-sheet-height', `${open ? next.height : clearance.current}px`);
      }
      main.style.setProperty('--question-sheet-clearance', `${clearance.current}px`);
      const field = document.activeElement;
      if (mobile && viewportChanged && field instanceof HTMLElement && textEntry(field) && panel.contains(field)) {
        const content = field.closest<HTMLElement>('.question-sheet-content');
        if (content) {
          const frame = content.getBoundingClientRect(), box = field.getBoundingClientRect();
          const top = frame.top + 8, bottom = frame.bottom - 8;
          if (box.top < top && box.bottom <= bottom) content.scrollTop += box.top - top;
          else if (box.bottom > bottom && box.top >= top) content.scrollTop += Math.min(box.bottom - bottom, box.top - top);
        }
      }
    };
    fitCurrent.current = fit;
    let resizeFrame = 0;
    const resize = () => { if (!resizeFrame) resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; fit(); }); }, scroll = () => fit(true);
    const observer = new ResizeObserver(resize); observer.observe(header); if (mobile && toggle) observer.observe(toggle); fit();
    window.addEventListener('resize', scroll); window.addEventListener('scroll', scroll, { passive: true });
    viewport?.addEventListener('resize', scroll); viewport?.addEventListener('scroll', scroll);
    return () => {
      fitCurrent.current = undefined;
      cancelAnimationFrame(resizeFrame);
      observer.disconnect(); window.removeEventListener('resize', scroll); window.removeEventListener('scroll', scroll);
      viewport?.removeEventListener('resize', scroll); viewport?.removeEventListener('scroll', scroll);
    };
  }, [layoutKey, enabled, mobile, open]);
  useLayoutEffect(() => {
    if (!enabled || !mobile) return;
    const panel = document.querySelector<HTMLElement>('.learning-grid .question-panel');
    if (!panel) return;
    setBlurBackground(false);
    const state = cardInteraction(panel, setBlurBackground); activity.current = state;
    return () => { endDrag(); state.dispose(); activity.current = undefined; };
  }, [layoutKey, enabled, mobile]);
  const resize = {
    minimum: size.minimum, maximum: size.maximum, height: size.height,
    onPointerDown(event: ReactPointerEvent<HTMLElement>) {
      if (!event.isPrimary || event.button !== 0) return;
      const panel = event.currentTarget.closest<HTMLElement>('.question-panel');
      if (!panel) return;
      event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
      const height = panel.getBoundingClientRect().height;
      drag.current = { id: event.pointerId, y: event.clientY, height, handle: event.currentTarget };
      panel.dataset.resizing = 'true'; requested.current = height; fitCurrent.current?.();
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: ReactPointerEvent<HTMLElement>) {
      const current = drag.current;
      if (current?.id !== event.pointerId) return;
      requested.current = current.height + current.y - event.clientY; fitCurrent.current?.();
    },
    onPointerUp: endDrag, onPointerCancel: endDrag, onLostPointerCapture: endDrag,
    onKeyDown(event: KeyboardEvent<HTMLElement>) {
      const height = event.key === 'ArrowUp' ? size.height + 16 : event.key === 'ArrowDown' ? size.height - 16 : event.key === 'Home' ? size.minimum : event.key === 'End' ? size.maximum : undefined;
      if (height === undefined) return;
      event.preventDefault(); requested.current = height; fitCurrent.current?.(); activity.current?.pulse();
    },
  };
  return { blurBackground, resize };
}

