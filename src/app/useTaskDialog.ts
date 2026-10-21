import { useEffect, useRef, useState } from 'react';
import { cardInteraction } from './cardInteraction';

export function useTaskDialog(id: string, onClose: () => void, historyKey = 'practicePreview') {
  const dialog = useRef<HTMLDialogElement>(null), enterFrame = useRef(0), closeTimer = useRef<number | undefined>(undefined), touchInput = useRef(false);
  const [open, setOpen] = useState(false), [contact, setContact] = useState(false), [hovered, setHovered] = useState(false);
  function finishClose() { clearTimeout(closeTimer.current); closeTimer.current = undefined; dialog.current?.close(); }
  function dismiss() {
    cancelAnimationFrame(enterFrame.current);
    if (closeTimer.current !== undefined || !dialog.current?.open) return;
    setOpen(false);
    const duration = parseFloat(getComputedStyle(dialog.current, '::backdrop').transitionDuration) * 1000;
    // Keep the native focus trap and backdrop through the exit transition.
    if (duration > 0) closeTimer.current = window.setTimeout(finishClose, duration + 50);
    else finishClose();
  }
  function close() { if (window.history.state?.[historyKey] === id) window.history.back(); else dismiss(); }
  useEffect(() => {
    const previous = window.history.state;
    window.history.pushState({ ...previous, [historyKey]: id }, '', location.href);
    window.addEventListener('popstate', dismiss);
    return () => { window.removeEventListener('popstate', dismiss); if (window.history.state?.[historyKey] === id) window.history.replaceState(previous, '', location.href); };
  }, [id, historyKey]);
  useEffect(() => {
    dialog.current?.showModal();
    enterFrame.current = requestAnimationFrame(() => { enterFrame.current = requestAnimationFrame(() => setOpen(true)); });
    const query = matchMedia('(max-width:1199px)');
    let interaction: ReturnType<typeof cardInteraction> | undefined;
    const leave = () => setHovered(false);
    const update = () => { interaction?.dispose(); setContact(false); const body = dialog.current?.querySelector<HTMLElement>('.task-detail-body'); interaction = body ? cardInteraction(body, setContact, !query.matches) : undefined; };
    update(); query.addEventListener('change', update);
    window.addEventListener('blur', leave);
    return () => { cancelAnimationFrame(enterFrame.current); clearTimeout(closeTimer.current); interaction?.dispose(); query.removeEventListener('change', update); window.removeEventListener('blur', leave); };
  }, []);
  return {
    open, close,
    dialogProps: { ref: dialog, 'data-open': open, 'data-blur': hovered || contact, onClose, onCancel: (event: React.SyntheticEvent) => { event.preventDefault(); close(); }, onClick: (event: React.MouseEvent) => { if (event.target === event.currentTarget) close(); }, onTransitionEnd: (event: React.TransitionEvent) => { if (closeTimer.current !== undefined && event.target === event.currentTarget && !event.nativeEvent.pseudoElement && event.propertyName === 'opacity') finishClose(); } },
    bodyProps: {
      onPointerDownCapture: (event: React.PointerEvent) => { if (event.pointerType === 'touch' || event.pointerType === 'pen') { touchInput.current = true; setHovered(false); } },
      onPointerEnter: (event: React.PointerEvent) => { if (event.pointerType === 'mouse' && !touchInput.current) setHovered(true); },
      onPointerMove: (event: React.PointerEvent) => { if (event.pointerType === 'mouse') { touchInput.current = false; setHovered(true); } },
      onPointerLeave: (event: React.PointerEvent) => { if (event.pointerType === 'mouse') setHovered(false); },
    },
  };
}
