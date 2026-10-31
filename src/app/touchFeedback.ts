import { cardActivity } from './cardInteraction';

export function touchFeedback() {
  let target: HTMLElement | undefined, pointer: { id: number; x: number; y: number } | undefined;
  const state = cardActivity(active => {
    if (active && target) target.dataset.touchActive = '';
    else { target?.removeAttribute('data-touch-active'); target = undefined; }
  });
  const cancel = () => { pointer = undefined; state.cancel(); };
  const keyboard = (event: KeyboardEvent) => {
    if (event.isComposing || ['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;
    // Soft-keyboard input must not activate keyboard-navigation focus rings.
    if (event.target instanceof Element && event.target.closest('input,textarea,[contenteditable]:not([contenteditable=false])') && !['Tab', 'Escape'].includes(event.key)) return;
    delete document.documentElement.dataset.touchInput;
  };
  const start = (event: PointerEvent) => {
    cancel();
    if (event.isPrimary) {
      if (['touch', 'pen'].includes(event.pointerType)) document.documentElement.dataset.touchInput = '';
      else delete document.documentElement.dataset.touchInput;
    }
    if (!event.isPrimary || !['touch', 'pen'].includes(event.pointerType) || !(event.target instanceof Element)) return;
    const control = event.target.closest<HTMLElement>('button,a[href],summary,select,[role=option],label.option,label.package-row,label.backup-file-label,input[type=range]');
    if (!control || control.matches(':disabled,[aria-disabled=true],.question-sheet-scrim') || control.closest('[inert],[aria-disabled=true]') || control.querySelector('input:disabled')) return;
    target = control; pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }; state.start();
  };
  const move = (event: PointerEvent) => {
    if (pointer?.id === event.pointerId && !target?.matches('input[type=range]') && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 10) cancel();
  };
  const end = (event: PointerEvent) => { if (pointer?.id === event.pointerId) { pointer = undefined; state.end(); } };
  // Observe native events without blocking clicks, scrolling, selection, or focus.
  document.addEventListener('pointerdown', start, { passive: true, capture: true });
  document.addEventListener('keydown', keyboard, true);
  document.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerup', end, { passive: true });
  document.addEventListener('pointercancel', cancel, { passive: true });
  document.addEventListener('scroll', cancel, true);
  window.addEventListener('blur', cancel);
  window.addEventListener('pagehide', cancel);
  return () => {
    cancel(); state.dispose();
    delete document.documentElement.dataset.touchInput;
    document.removeEventListener('pointerdown', start, true);
    document.removeEventListener('keydown', keyboard, true);
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', end);
    document.removeEventListener('pointercancel', cancel);
    document.removeEventListener('scroll', cancel, true);
    window.removeEventListener('blur', cancel);
    window.removeEventListener('pagehide', cancel);
  };
}
