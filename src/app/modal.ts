export function showModal(dialog: HTMLDialogElement | null) {
  if (!dialog) return;
  if (!document.querySelector('dialog:modal')) {
    const root = document.documentElement, gutter = innerWidth - root.clientWidth;
    // Reserving a new gutter shifts pages with overlay scrollbars.
    root.style.setProperty('--modal-gutter', gutter ? 'stable' : 'auto');
    root.style.setProperty('--modal-left-gutter', `${root.clientLeft}px`);
    root.style.setProperty('--modal-right-gutter', `${gutter - root.clientLeft}px`);
  }
  dialog.showModal();
}
