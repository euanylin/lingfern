import { useLayoutEffect, useRef } from 'react';

export function useQuestionSheetLayout(layoutKey: string, enabled: boolean, mobile: boolean, open: boolean) {
  const clearance = useRef(0), container = useRef<HTMLElement | null>(null);
  // Retain reserved page space across pane changes so short pages cannot clamp their scroll position.
  useLayoutEffect(() => () => {
    const main = container.current;
    if (main) for (const property of ['--learning-viewport', '--learning-header', '--learning-panels-height', '--learning-bottom', '--question-sheet-clearance', '--question-sheet-height', '--question-sheet-limit']) main.style.removeProperty(property);
  }, [enabled]);
  useLayoutEffect(() => {
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
      main.style.setProperty('--learning-bottom', `${Math.max(0, innerHeight - height - (viewport?.offsetTop ?? 0))}px`);
      if (mobile && toggle) {
        clearance.current = toggle.getBoundingClientRect().height;
        const headerBottom = Math.max(headerHeight, header.getBoundingClientRect().bottom - (viewport?.offsetTop ?? 0));
        const limit = Math.max(0, Math.min(height * .7, height - headerBottom - 24));
        main.style.setProperty('--question-sheet-limit', `${limit}px`);
        main.style.setProperty('--question-sheet-height', `${open ? limit : clearance.current}px`);
      }
      main.style.setProperty('--question-sheet-clearance', `${clearance.current}px`);
    };
    const observer = new ResizeObserver(fit); observer.observe(header); if (mobile && toggle) observer.observe(toggle); fit();
    window.addEventListener('resize', fit); window.addEventListener('scroll', fit, { passive: true });
    viewport?.addEventListener('resize', fit); viewport?.addEventListener('scroll', fit);
    return () => {
      observer.disconnect(); window.removeEventListener('resize', fit); window.removeEventListener('scroll', fit);
      viewport?.removeEventListener('resize', fit); viewport?.removeEventListener('scroll', fit);
    };
  }, [layoutKey, enabled, mobile, open]);
}
