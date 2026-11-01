import { useEffect, useLayoutEffect, useImperativeHandle, useRef, type ComponentPropsWithRef } from 'react';

export function AnimatedDetails({ ref, onToggle, onClickCapture, onExpandedChange, className = '', ...props }: ComponentPropsWithRef<'details'> & { onExpandedChange?: (expanded: boolean) => void }) {
  const root = useRef<HTMLDetailsElement>(null);
  const motion = useRef<{ animation?: Animation; frame?: number; target?: boolean; reported?: boolean; settled: boolean; restore?: () => void }>({ settled: !!props.open });
  useImperativeHandle(ref, () => root.current!, []);
  function cancel() {
    const state = motion.current;
    cancelAnimationFrame(state.frame ?? 0);
    if (state.animation) { state.animation.onfinish = null; state.animation.cancel(); }
    state.restore?.();
    state.animation = undefined; state.restore = undefined;
  }
  function finish() {
    const element = root.current, expanded = motion.current.target;
    if (!element || expanded === undefined) return;
    cancel(); motion.current.target = undefined; motion.current.settled = expanded;
    element.open = expanded; delete element.dataset.expanded;
    const summary = element.querySelector('summary');
    if (summary?.hasAttribute('aria-expanded')) summary.setAttribute('aria-expanded', String(expanded));
  }
  function collapsedHeight(element: HTMLDetailsElement) {
    const summary = element.querySelector('summary')!, style = getComputedStyle(element), label = getComputedStyle(summary);
    return summary.getBoundingClientRect().height + ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce((sum, key) => sum + parseFloat(style[key as keyof CSSStyleDeclaration] as string || '0'), 0) + parseFloat(label.marginTop) + parseFloat(label.marginBottom);
  }
  function animate(expanded: boolean, start: number) {
    const element = root.current!;
    cancel(); motion.current.target = expanded;
    onExpandedChange?.(expanded);
    if (matchMedia('(prefers-reduced-motion:reduce)').matches) { finish(); return; }
    const height = element.style.height, overflow = element.style.overflow;
    const summary = element.querySelector('summary')!, aria = summary.getAttribute('aria-expanded');
    const contents = [...element.children].filter((child): child is HTMLElement => child instanceof HTMLElement && child !== summary);
    const states = contents.map(child => ({ child, inert: child.inert, hidden: child.getAttribute('aria-hidden') }));
    if (!expanded) {
      if (contents.some(child => child.contains(document.activeElement))) summary.focus({ preventScroll: true });
      for (const child of contents) { child.inert = true; child.setAttribute('aria-hidden', 'true'); }
    }
    const additions = !expanded ? new MutationObserver(() => {
      for (const child of element.children) if (child instanceof HTMLElement && child.tagName !== 'SUMMARY' && !states.some(state => state.child === child)) {
        states.push({ child, inert: child.inert, hidden: child.getAttribute('aria-hidden') });
        child.inert = true; child.setAttribute('aria-hidden', 'true');
      }
    }) : undefined;
    additions?.observe(element, { childList: true });
    motion.current.restore = () => {
      additions?.disconnect();
      element.style.height = height; element.style.overflow = overflow;
      if (aria === null) summary.removeAttribute('aria-expanded'); else summary.setAttribute('aria-expanded', aria);
      for (const state of states) { state.child.inert = state.inert; if (state.hidden === null) state.child.removeAttribute('aria-hidden'); else state.child.setAttribute('aria-hidden', state.hidden); }
    };
    // Clip height transitions without trimming the summary's horizontal feedback.
    element.style.height = `${start}px`; element.style.overflow = 'visible clip';
    element.dataset.expanded = String(expanded); summary.setAttribute('aria-expanded', String(expanded)); element.open = true;
    // Native toggle handlers can mount lazy contents before measuring the open height.
    motion.current.frame = requestAnimationFrame(() => {
      element.style.height = height;
      const end = expanded ? element.getBoundingClientRect().height : collapsedHeight(element);
      element.style.height = `${end}px`;
      const animation = element.animate({ height: [`${start}px`, `${end}px`] }, { duration: 220, easing: 'cubic-bezier(.2,0,0,1)' });
      motion.current.animation = animation; animation.onfinish = finish;
    });
  }
  useLayoutEffect(() => {
    const element = root.current!, state = motion.current;
    if (props.open === undefined || props.open === (state.target ?? state.settled)) return;
    if (!props.open) element.open = true;
    animate(props.open, props.open && state.target === undefined ? collapsedHeight(element) : element.getBoundingClientRect().height);
  }, [props.open]);
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion:reduce)'), change = () => { if (reduced.matches) finish(); };
    reduced.addEventListener('change', change);
    return () => { reduced.removeEventListener('change', change); cancel(); };
  }, []);
  return <details {...props} ref={root} className={`animated-details ${className}`.trim()} onClickCapture={event => {
    onClickCapture?.(event);
    const target = event.target instanceof Element ? event.target : null, summary = target?.closest('summary');
    if (event.defaultPrevented || summary?.parentElement !== root.current || target?.closest('a,button,input,select,textarea,label')) return;
    event.preventDefault(); animate(!(motion.current.target ?? root.current!.open), root.current!.getBoundingClientRect().height);
  }} onToggle={event => {
    if (event.target !== event.currentTarget) return;
    const element = event.currentTarget, state = motion.current;
    if (state.target !== undefined && !element.open) { const height = element.getBoundingClientRect().height; element.open = true; animate(false, height); return; }
    if (element.open !== state.reported && (element.open || state.target === undefined && !state.settled)) { state.reported = element.open; onToggle?.(event); }
    if (state.target !== undefined || element.open === state.settled) return;
    if (element.open) animate(true, collapsedHeight(element));
    else { element.open = true; animate(false, element.getBoundingClientRect().height); }
  }}/>;
}
