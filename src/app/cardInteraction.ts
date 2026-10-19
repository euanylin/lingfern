const textEntry = (target: EventTarget | null) => target instanceof Element && !!target.closest('textarea,[contenteditable]:not([contenteditable=false]),input:not([type=checkbox],[type=radio],[type=range],[type=button],[type=submit],[type=reset],[type=file],[type=color])');

export function cardActivity(changed: (active: boolean) => void) {
  let held = false, timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => { clearTimeout(timer); held = false; changed(false); };
  const pulse = () => {
    clearTimeout(timer); changed(true);
    timer = setTimeout(() => { if (!held) changed(false); }, 120);
  };
  return {
    start: () => { held = true; clearTimeout(timer); changed(true); },
    end: () => { if (held) { held = false; pulse(); } },
    pulse, cancel,
    scrollEnd: () => { if (!held) cancel(); },
    dispose: () => clearTimeout(timer),
  };
}

export function cardInteraction(panel: HTMLElement, changed: (active: boolean) => void) {
  let scrolling = false;
  const state = cardActivity(active => { if (!active) scrolling = false; changed(active); });
  const editor = (event: Event) => textEntry(event.target);
  const start = (event: PointerEvent) => { if (editor(event)) state.cancel(); else { scrolling = true; state.start(); } };
  const activate = (event: Event) => { if (editor(event)) state.cancel(); else { scrolling = true; state.pulse(); } };
  // Let React commit native radio/checkbox changes before blur re-renders their controlled values.
  const click = (event: MouseEvent) => { if (event.target instanceof Node && panel.contains(event.target)) activate(event); };
  const scroll = (event: Event) => { if (scrolling && !editor(event)) state.pulse(); };
  const editing = (event: Event) => { if (editor(event)) state.cancel(); };
  const leave = (event: PointerEvent) => { if (event.pointerType === 'mouse') state.cancel(); };
  panel.addEventListener('pointerdown', start);
  panel.addEventListener('pointerleave', leave);
  window.addEventListener('click', click);
  panel.addEventListener('wheel', activate, { passive: true });
  panel.addEventListener('scroll', scroll, true);
  panel.addEventListener('scrollend', state.scrollEnd, true);
  panel.addEventListener('input', editing, true);
  panel.addEventListener('focusin', editing);
  window.addEventListener('pointerup', state.end);
  window.addEventListener('pointercancel', state.end);
  window.addEventListener('blur', state.cancel);
  return { ...state, dispose() {
    state.dispose();
    panel.removeEventListener('pointerdown', start);
    panel.removeEventListener('pointerleave', leave);
    window.removeEventListener('click', click);
    panel.removeEventListener('wheel', activate);
    panel.removeEventListener('scroll', scroll, true);
    panel.removeEventListener('scrollend', state.scrollEnd, true);
    panel.removeEventListener('input', editing, true);
    panel.removeEventListener('focusin', editing);
    window.removeEventListener('pointerup', state.end);
    window.removeEventListener('pointercancel', state.end);
    window.removeEventListener('blur', state.cancel);
  } };
}
