const regions = '.welcome-content,.question-sheet-content,.selection-dictionary-body,.dictionary-suggestions,.setting-menu-scroll,.ipa-table-scroll,.ipa-vowel-scroll,.task-detail-body,.practice-options-body,.update-confirm-dialog,.workspace-card nav,textarea,pre';

export function scrollbarVisibility() {
  let frame = 0, task = 0;
  const observed = new Set<Element>();
  const active = new Map<HTMLElement, number>();
  const touch = matchMedia('(pointer:coarse)');
  let inputUntil = 0;
  const resize = new ResizeObserver(schedule);
  function input(event: Event) {
    if (!touch.matches || event instanceof WheelEvent && event.ctrlKey) return;
    if (event instanceof KeyboardEvent && !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) { inputUntil = 0; return; }
    inputUntil = performance.now() + 500;
  }
  const resetInput = () => { inputUntil = 0; };
  function scrolled(event: Event) {
    if (!touch.matches) return;
    const element = event.target === document ? document.documentElement : event.target;
    if (!(element instanceof HTMLElement) || performance.now() > inputUntil && !active.has(element)) return;
    clearTimeout(active.get(element));
    if (!element.hasAttribute('data-scrollbar-active')) element.dataset.scrollbarActive = '';
    active.set(element, window.setTimeout(() => { delete element.dataset.scrollbarActive; active.delete(element); }, 700));
  }
  function update() {
    frame = 0;
    const root = document.documentElement;
    const containers = [root, ...document.querySelectorAll<HTMLElement>(regions)];
    const next = new Set<Element>([document.body]);
    const states = containers.map(element => {
      next.add(element);
      for (const child of element === root ? [] : element.children) next.add(child);
      const extent = (size: number) => Math.min(96, Math.max(48, size * .1));
      return { element, x: element.scrollWidth - element.clientWidth > extent(element.clientWidth), y: element.scrollHeight - element.clientHeight > extent(element.clientHeight) };
    });
    for (const element of observed) if (!next.has(element)) { resize.unobserve(element); observed.delete(element); }
    for (const element of next) if (!observed.has(element)) { resize.observe(element); observed.add(element); }
    for (const { element, x, y } of states) {
      if (element.dataset.scrollbarX !== String(x)) element.dataset.scrollbarX = String(x);
      if (element.dataset.scrollbarY !== String(y)) element.dataset.scrollbarY = String(y);
    }
  }
  // Measure optional scroll thumbs after paint to avoid blocking layout.
  function schedule() { if (!frame && !task) frame = requestAnimationFrame(() => { frame = 0; task = window.setTimeout(() => { task = 0; update(); }, 0); }); }
  const mutations = new MutationObserver(schedule);
  mutations.observe(document.body, { subtree: true, childList: true, characterData: true });
  window.addEventListener('resize', schedule);
  document.addEventListener('input', schedule, true);
  document.addEventListener('toggle', schedule, true);
  document.addEventListener('load', schedule, true);
  // Ignore layout, focus and route-reset scrolling until a real scroll gesture.
  document.addEventListener('wheel', input, { passive: true, capture: true });
  document.addEventListener('pointerdown', resetInput, { passive: true, capture: true });
  document.addEventListener('touchmove', input, { passive: true, capture: true });
  document.addEventListener('keydown', input, true);
  document.addEventListener('scroll', scrolled, true);
  schedule();
  return () => {
    cancelAnimationFrame(frame); clearTimeout(task); resize.disconnect(); mutations.disconnect();
    window.removeEventListener('resize', schedule);
    document.removeEventListener('input', schedule, true);
    document.removeEventListener('toggle', schedule, true);
    document.removeEventListener('load', schedule, true);
    document.removeEventListener('wheel', input, true);
    document.removeEventListener('pointerdown', resetInput, true);
    document.removeEventListener('touchmove', input, true);
    document.removeEventListener('keydown', input, true);
    document.removeEventListener('scroll', scrolled, true);
    for (const [element, timer] of active) { clearTimeout(timer); delete element.dataset.scrollbarActive; }
    for (const element of [document.documentElement, ...document.querySelectorAll<HTMLElement>(regions)]) {
      delete element.dataset.scrollbarX; delete element.dataset.scrollbarY;
    }
  };
}
