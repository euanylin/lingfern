const regions = '.question-sheet-content,.selection-dictionary-body,.dictionary-suggestions,.setting-menu,.ipa-table-scroll,.ipa-vowel-scroll,.task-detail-body,.update-confirm-dialog,.workspace-card nav,textarea,pre';

export function scrollbarVisibility() {
  let frame = 0;
  const observed = new Set<Element>();
  const resize = new ResizeObserver(schedule);
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
  function schedule() { if (!frame) frame = requestAnimationFrame(update); }
  const mutations = new MutationObserver(schedule);
  mutations.observe(document.body, { subtree: true, childList: true, characterData: true });
  window.addEventListener('resize', schedule);
  document.addEventListener('input', schedule, true);
  document.addEventListener('toggle', schedule, true);
  document.addEventListener('load', schedule, true);
  schedule();
  return () => {
    cancelAnimationFrame(frame); resize.disconnect(); mutations.disconnect();
    window.removeEventListener('resize', schedule);
    document.removeEventListener('input', schedule, true);
    document.removeEventListener('toggle', schedule, true);
    document.removeEventListener('load', schedule, true);
    for (const element of [document.documentElement, ...document.querySelectorAll<HTMLElement>(regions)]) {
      delete element.dataset.scrollbarX; delete element.dataset.scrollbarY;
    }
  };
}
