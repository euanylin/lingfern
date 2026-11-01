import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

export function useExitPresence(open: boolean, element: RefObject<HTMLElement | null>) {
  const [retained, setRetained] = useState(open);
  useEffect(() => {
    if (open) { setRetained(true); return; }
    const duration = element.current ? parseFloat(getComputedStyle(element.current).transitionDuration) * 1000 : 0;
    if (!duration) { setRetained(false); return; }
    // Keep contents mounted through the closing transition, then release their DOM.
    const timer = window.setTimeout(() => setRetained(false), duration + 50);
    return () => clearTimeout(timer);
  }, [open, element]);
  return open || retained;
}

export function DisclosurePanel({ id, open, children, className = '', keepMounted = false }: { id: string; open: boolean; children: () => ReactNode; className?: string; keepMounted?: boolean }) {
  const panel = useRef<HTMLDivElement>(null), present = useExitPresence(open, panel);
  return <div ref={panel} id={id} className={`disclosure-panel ${className}`.trim()} data-open={open} aria-hidden={!open} inert={!open}>
    <div className="disclosure-clip" hidden={!present}>{(present || keepMounted) && children()}</div>
  </div>;
}
