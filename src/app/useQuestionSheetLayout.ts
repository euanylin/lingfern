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
  const drag = useRef<{ id: number; y: number; height: number; handle: HTMLElement } | undefined>(undefined);
  const activity = useRef<ReturnType<typeof cardInteraction> | undefined>(undefined);
  const [blurBackground, setBlurBackground] = useState(false);
  const [size, setSize] = useState({ minimum: 0, maximum: 0, height: 0 });
  function endDrag() {
    const current = drag.current; drag.current = undefined;
    if (!current) return;
    delete current.handle.closest<HTMLElement>('.question-panel')?.dataset.resizing;
    if (current.handle.hasPointerCapture(current.id)) current.handle.releasePointerCapture(current.id);
  }
  // Retain reserved page space across pane changes so short pages cannot clamp their scroll position.
  useLayoutEffect(() => () => {
    endDrag();
    const main = container.current;
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
    // Use the visible viewport and the actual collapsed card height, including keyboard/zoom changes.
    const fit = () => {
      if (!grid.isConnected) return;
      const height = viewport?.height ?? innerHeight;
      const headerHeight = ['sticky', 'fixed'].includes(getComputedStyle(header).position) ? header.getBoundingClientRect().height : 0;
      main.style.setProperty('--learning-viewport', `${height}px`);
      main.style.setProperty('--learning-header', `${headerHeight}px`);
      // Anchor to the document so scrolling cannot resize the answer card.
      main.style.setProperty('--learning-panels-height', `${Math.max(0, height - Math.max(headerHeight + 16, grid.getBoundingClientRect().top + scrollY - (viewport?.offsetTop ?? 0)) - 16)}px`);
      // Browser-bar animation already moves fixed cards; compensate only for editing or zoom.
      const constrained = textEntry(document.activeElement) || (viewport?.scale ?? 1) > 1;
      const bottom = constrained ? Math.max(0, innerHeight - height - (viewport?.offsetTop ?? 0)) : 0;
      main.style.setProperty('--learning-bottom', `${bottom}px`);
      if (mobile && toggle) {
        clearance.current = toggle.offsetHeight;
        const headerBottom = constrained ? Math.max(headerHeight, header.getBoundingClientRect().bottom - (viewport?.offsetTop ?? 0)) : headerHeight;
        const safeBottom = Math.max(0, (parseFloat(getComputedStyle(panel).bottom) || 0) - bottom);
        // The small viewport stays stable while browser bars animate; keyboards and zoom still use the visible area.
        const stableMaximum = parseFloat(getComputedStyle(panel).maxHeight);
        const available = !constrained && Number.isFinite(stableMaximum) ? stableMaximum + headerHeight + 24 + safeBottom : height;
        const next = questionSheetSize(available, headerBottom + safeBottom, requested.current ?? available * .7 - safeBottom);
        setSize(previous => previous.minimum === next.minimum && previous.maximum === next.maximum && previous.height === next.height ? previous : next);
        main.style.setProperty('--question-sheet-height', `${open ? next.height : clearance.current}px`);
      }
      main.style.setProperty('--question-sheet-clearance', `${clearance.current}px`);
    };
    fitCurrent.current = fit;
    const observer = new ResizeObserver(fit); observer.observe(header); if (mobile && toggle) observer.observe(toggle); fit();
    window.addEventListener('resize', fit); window.addEventListener('scroll', fit, { passive: true });
    viewport?.addEventListener('resize', fit); viewport?.addEventListener('scroll', fit);
    return () => {
      fitCurrent.current = undefined;
      observer.disconnect(); window.removeEventListener('resize', fit); window.removeEventListener('scroll', fit);
      viewport?.removeEventListener('resize', fit); viewport?.removeEventListener('scroll', fit);
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

