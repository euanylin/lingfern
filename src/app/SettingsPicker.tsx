import { useEffect, useLayoutEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export function pickerMenuPosition(anchor: { top: number; right: number; height: number }, popup: { width: number; height: number }, viewport: { left: number; top: number; width: number; height: number }) {
  const margin = 8;
  const left = Math.max(viewport.left + margin, Math.min(anchor.right - popup.width, viewport.left + viewport.width - popup.width - margin));
  const below = anchor.top + anchor.height + 4;
  const preferredTop = below + popup.height <= viewport.top + viewport.height - margin ? below : anchor.top - popup.height - 4;
  const top = Math.max(viewport.top + margin, Math.min(preferredTop, viewport.top + viewport.height - popup.height - margin));
  return { left, top };
}

type Option = { value: string; label: string; lang?: string };

export function SettingsPicker({ label, value, options, onChange, disabled = false, variant = 'setting', displayLabel, description }: { label: string; value: string; options: Option[]; onChange: (value: string) => void; disabled?: boolean; variant?: 'setting' | 'topic'; displayLabel?: string; description?: string }) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const selected = Math.max(0, options.findIndex(option => option.value === value));
  const blocked = disabled || options.length === 0;

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useLayoutEffect(() => {
    if (!open || !menu.current || !trigger.current || !root.current) return;
    const popup = menu.current;
    const update = (centerSelected = false) => {
      if (!trigger.current || !root.current) return;
      const visual = window.visualViewport;
      let viewport = { left: visual?.offsetLeft ?? 0, top: visual?.offsetTop ?? 0, width: visual?.width ?? innerWidth, height: visual?.height ?? innerHeight };
      // Matching menus must stay inside the answer panel's visible scroll area.
      const clip = popup.closest('.question-sheet-content')?.getBoundingClientRect();
      if (clip) {
        const left = Math.max(viewport.left, clip.left), top = Math.max(viewport.top, clip.top);
        viewport = { left, top, width: Math.max(0, Math.min(viewport.left + viewport.width, clip.right) - left), height: Math.max(0, Math.min(viewport.top + viewport.height, clip.bottom) - top) };
      }
      const width = Math.max(0, viewport.width - 16), height = Math.max(0, viewport.height - 16);
      popup.style.minWidth = `${Math.min(160, width)}px`;
      popup.style.maxWidth = `${Math.min(320, width)}px`;
      popup.style.maxHeight = `${Math.min(340, viewport.height * .7, height)}px`;
      const option = popup.querySelectorAll<HTMLButtonElement>('[role=option]')[selected];
      if (!option) return;
      const center = option.offsetTop + option.offsetHeight / 2;
      if (centerSelected) popup.scrollTop = Math.max(0, center - popup.clientHeight / 2);
      const placement = pickerMenuPosition(trigger.current.getBoundingClientRect(), { width: popup.offsetWidth, height: popup.offsetHeight }, viewport);
      const origin = root.current.getBoundingClientRect();
      popup.style.right = 'auto';
      popup.style.left = `${placement.left - origin.left}px`;
      popup.style.top = `${placement.top - origin.top}px`;
    };
    update(true);
    const reposition = (event: Event) => { if (!(event.target instanceof Node && popup.contains(event.target))) update(); };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    window.visualViewport?.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('scroll', reposition);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      window.visualViewport?.removeEventListener('resize', reposition);
      window.visualViewport?.removeEventListener('scroll', reposition);
    };
  }, [open, selected, options]);
  useLayoutEffect(() => {
    if (!open || !menu.current) return;
    const popup = menu.current, option = popup.querySelectorAll<HTMLButtonElement>('[role=option]')[focusIndex];
    if (!option) return;
    option.focus({ preventScroll: true });
    if (option.offsetTop < popup.scrollTop) popup.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > popup.scrollTop + popup.clientHeight) popup.scrollTop = option.offsetTop + option.offsetHeight - popup.clientHeight;
  }, [open, focusIndex]);

  function show(index = selected) {
    if (blocked) return;
    setFocusIndex(index);
    setOpen(true);
  }
  function choose(option: Option) {
    onChange(option.value);
    setOpen(false);
    trigger.current?.focus();
  }
  function move(event: KeyboardEvent, index: number) {
    const next = event.key === 'ArrowDown' ? (index + 1) % options.length : event.key === 'ArrowUp' ? (index - 1 + options.length) % options.length : event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : -1;
    if (next >= 0) { event.preventDefault(); setFocusIndex(next); }
    else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
  }
  return <div className={`setting${variant === 'topic' ? ' topic-picker' : ''}`} ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <span id={`${id}-label`} className={variant === 'topic' ? 'sr-only' : undefined}><span>{label}</span>{description && <small id={`${id}-description`} className="setting-description">{description}</small>}</span>
    <button ref={trigger} className="setting-trigger" type="button" data-value={value} disabled={blocked} aria-label={label} aria-describedby={`${id}-value${description ? ` ${id}-description` : ''}`} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-options`} onClick={() => open ? setOpen(false) : show()} onKeyDown={event => { if (!open && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); show(event.key === 'ArrowDown' ? (selected + 1) % options.length : event.key === 'ArrowUp' ? (selected - 1 + options.length) % options.length : event.key === 'Home' ? 0 : options.length - 1); } else move(event, selected); }}>
      <span id={`${id}-value`}>{variant === 'topic' && <>{displayLabel ?? label}{['zh-Hans', 'zh-Hant', 'ja'].includes(document.documentElement.lang) ? '：' : ': '}</>}<bdi lang={options[selected]?.lang}>{options[selected]?.label}</bdi></span><span className="setting-chevron" aria-hidden="true">›</span>
    </button>
    {open && <div ref={menu} id={`${id}-options`} className="setting-menu" role="listbox" aria-label={label}>
      {/* Safari pointer focus loss must not dismiss the menu before the option click. */}
      {options.map((option, index) => <button key={option.value} type="button" role="option" style={{ minHeight: 44 }} data-value={option.value} aria-selected={option.value === value} onMouseDown={event => event.preventDefault()} onClick={() => choose(option)} onKeyDown={event => move(event, index)}><span className="setting-check" aria-hidden="true">{option.value === value && <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 3 3 7-8"/></svg>}</span><bdi lang={option.lang}>{option.label}</bdi></button>)}
    </div>}
  </div>;
}
