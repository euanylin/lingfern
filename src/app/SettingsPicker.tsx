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
type Props = { label: string; options: Option[]; disabled?: boolean; variant?: 'setting' | 'topic' | 'field'; displayLabel?: string; description?: string } & ({ multiple?: false; value: string; onChange: (value: string) => void } | { multiple: true; value: string[]; onChange: (value: string[]) => void });

export function SettingsPicker(props: Props) {
  const { label, value, options, disabled = false, variant = 'setting', displayLabel, description } = props;
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const isSelected = (option: Option) => props.multiple ? option.value ? props.value.includes(option.value) : !props.value.length : option.value === props.value;
  const selected = Math.max(0, options.findIndex(isSelected));
  const selectedText = props.multiple ? options.filter(isSelected).map(option => option.label).join(' / ') : options[selected]?.label ?? '';
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
      // Keep matching menus within the answer panel's visible area.
      const clip = popup.closest('.question-sheet-content,.task-detail-body')?.getBoundingClientRect();
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
    update(!props.multiple);
    const reposition = (event: Event) => { if (!(event.target instanceof Node && popup.contains(event.target))) update(); };
    const dismiss = (event: Event) => {
      if (event.target instanceof Node && popup.contains(event.target)) return;
      if (popup.contains(document.activeElement)) trigger.current?.focus({ preventScroll: true });
      setOpen(false);
    };
    let touchY: number | undefined;
    const touchStart = (event: TouchEvent) => { touchY = event.target instanceof Node && popup.contains(event.target) ? undefined : event.touches[0]?.clientY; };
    const touchMove = (event: TouchEvent) => { if (touchY !== undefined && Math.abs((event.touches[0]?.clientY ?? touchY) - touchY) > 10) dismiss(event); };
    window.addEventListener('resize', reposition);
    // Start scroll dismissal after the trigger finishes scrolling into view.
    const frame = requestAnimationFrame(() => { update(); window.addEventListener('scroll', dismiss, true); });
    window.addEventListener('wheel', dismiss, { capture: true, passive: true });
    window.addEventListener('touchstart', touchStart, { capture: true, passive: true });
    window.addEventListener('touchmove', touchMove, { capture: true, passive: true });
    window.visualViewport?.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('scroll', dismiss);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('wheel', dismiss, true);
      window.removeEventListener('touchstart', touchStart, true);
      window.removeEventListener('touchmove', touchMove, true);
      window.visualViewport?.removeEventListener('resize', reposition);
      window.visualViewport?.removeEventListener('scroll', dismiss);
    };
  }, [open, selected, options, props.multiple]);
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
    if (props.multiple) props.onChange(!option.value ? [] : props.value.includes(option.value) ? props.value.filter(value => value !== option.value) : [...props.value, option.value]);
    else { props.onChange(option.value); setOpen(false); trigger.current?.focus(); }
  }
  function move(event: KeyboardEvent, index: number) {
    const next = event.key === 'ArrowDown' ? (index + 1) % options.length : event.key === 'ArrowUp' ? (index - 1 + options.length) % options.length : event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : -1;
    if (next >= 0) { event.preventDefault(); setFocusIndex(next); }
    else if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
  }
  return <div className={`setting${variant === 'topic' ? ' topic-picker' : variant === 'field' ? ' setting-field' : ''}`} ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <span id={`${id}-label`} className={variant !== 'setting' ? 'sr-only' : undefined}><span>{label}</span>{description && <small id={`${id}-description`} className="setting-description">{description}</small>}</span>
    <button ref={trigger} className="setting-trigger" type="button" data-value={props.multiple ? props.value.join(',') : value} disabled={blocked} aria-label={`${label}: ${variant === 'topic' && displayLabel ? `${displayLabel}: ` : ''}${selectedText}`} aria-describedby={description ? `${id}-description` : undefined} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-options`} onClick={() => open ? setOpen(false) : show()} onKeyDown={event => { if (!open && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); show(event.key === 'ArrowDown' ? (selected + 1) % options.length : event.key === 'ArrowUp' ? (selected - 1 + options.length) % options.length : event.key === 'Home' ? 0 : options.length - 1); } else move(event, selected); }}>
      {variant === 'field' && <span className="setting-field-label" aria-hidden="true">{label}</span>}<span id={`${id}-value`}>{variant === 'topic' && <>{displayLabel ?? label}{['zh-Hans', 'zh-Hant', 'ja'].includes(document.documentElement.lang) ? '：' : ': '}</>}<bdi lang={options[selected]?.lang}>{selectedText}</bdi></span>{variant !== 'field' && <span className="setting-chevron" aria-hidden="true">›</span>}
    </button>
    {open && <div ref={menu} id={`${id}-options`} className="setting-menu" role="listbox" aria-label={label} aria-multiselectable={props.multiple || undefined}>
      {/* Keep Safari menus open through pointer focus loss until the option click. */}
      {options.map((option, index) => <button key={option.value} type="button" role="option" style={{ minHeight: 44 }} data-value={option.value} aria-selected={isSelected(option)} onMouseDown={event => event.preventDefault()} onClick={() => choose(option)} onKeyDown={event => move(event, index)}><span className="setting-check" aria-hidden="true">{isSelected(option) && <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 3 3 7-8"/></svg>}</span><bdi lang={option.lang}>{option.label}</bdi></button>)}
    </div>}
  </div>;
}
