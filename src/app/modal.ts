const closing = new WeakMap<HTMLDialogElement, () => void>();

export function showModal(dialog: HTMLDialogElement | null) {
  if (!dialog) return;
  closing.get(dialog)?.();
  if (!document.querySelector('dialog:modal')) {
    const root = document.documentElement, gutter = innerWidth - root.clientWidth;
    // Reserving a new gutter shifts pages with overlay scrollbars.
    root.style.setProperty('--modal-gutter', gutter ? 'stable' : 'auto');
    root.style.setProperty('--modal-left-gutter', `${root.clientLeft}px`);
    root.style.setProperty('--modal-right-gutter', `${gutter - root.clientLeft}px`);
  }
  dialog.showModal();
}

export function closeModal(dialog: HTMLDialogElement | null, onClosed: () => void) {
  if (!dialog?.open) { onClosed(); return; }
  if (closing.has(dialog)) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches) { dialog.close(); onClosed(); return; }
  const block = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
  const finish = () => {
    cleanup();
    // Navigation or a profile switch may have already closed or removed this dialog.
    if (dialog.isConnected && dialog.open) { dialog.close(); onClosed(); }
  };
  const changed = () => { if (reduced.matches) finish(); };
  const ended = (event: AnimationEvent) => { if (event.target === dialog && !event.pseudoElement && event.animationName === 'modal-out') finish(); };
  const cleanup = () => {
    clearTimeout(timer); closing.delete(dialog); delete dialog.dataset.closing;
    for (const property of ['--modal-exit-opacity', '--modal-exit-translate', '--modal-backdrop-opacity']) dialog.style.removeProperty(property);
    dialog.removeEventListener('click', block, true); dialog.removeEventListener('keydown', block, true);
    dialog.removeEventListener('close', cleanup); dialog.removeEventListener('animationend', ended);
    reduced.removeEventListener('change', changed);
  };
  const current = getComputedStyle(dialog);
  dialog.style.setProperty('--modal-exit-opacity', current.opacity);
  dialog.style.setProperty('--modal-exit-translate', current.translate);
  dialog.style.setProperty('--modal-backdrop-opacity', getComputedStyle(dialog, '::backdrop').opacity);
  dialog.dataset.closing = 'true';
  dialog.addEventListener('click', block, true); dialog.addEventListener('keydown', block, true);
  dialog.addEventListener('close', cleanup); dialog.addEventListener('animationend', ended);
  reduced.addEventListener('change', changed);
  const duration = parseFloat(getComputedStyle(dialog).animationDuration) * 1000 || 0;
  const timer = window.setTimeout(finish, duration + 50);
  closing.set(dialog, cleanup);
}
