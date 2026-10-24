import './Welcome.css';
import { WheelGestures } from 'wheel-gestures';
import { NavIcon } from './NavIcon';
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { messages } from '../locales';
import { type Locale } from '../shared/content';
import { DailyQuote } from './DailyQuote';
import { Fern } from './Fern';
import { firstRunCopy } from './FirstRun';
import { PracticeCard } from './PracticeCard';
import { PracticeOptions } from './PracticeOptions';
import { automaticPractice } from '../shared/practiceSelection';
import { OfflineInstall } from './OfflineInstall';
import { CommunityImport, InstalledResources } from './CommunityImport';

const TodayPreview = memo(function TodayPreview({ locale, profileId, date, onDayChange, onContinue, active }: WelcomeProps & { active: boolean }) {
  const app = messages('app')[locale], first = firstRunCopy[locale], training = messages('app_training')[locale];
  return <div className="today-home">
    <div className="today-layout"><section className="hero today-hero"><p className="eyebrow"><time dateTime={date}>{new Date(`${date}T12:00:00`).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}</time></p><Fern profileId={profileId} entries={[]} locale={locale} illustrationActive={active}/><h1>{app.today}</h1></section>
      <section className="practice-section" aria-labelledby="welcome-practice-title" inert><header className="practice-section-heading"><h2 id="welcome-practice-title">{messages('app_practice')[locale]}</h2><a className="records-link" href="/progress">{messages('app_history')[locale]}</a></header><div className="task-grid today-grid">
        {(['reading', 'listening'] as const).map(skill => <div className={`primary-task${skill === 'reading' ? ' reading-task' : ''}`} key={skill}><PracticeCard title={first[skill]} locale={locale} records={[]} dataSkill={skill} onStart={onContinue}><PracticeOptions locale={locale} profileId={profileId} skill={skill} value={automaticPractice} history={[]} records={[]} disabled={false} onChange={async () => {}}/></PracticeCard></div>)}
        <div className="primary-task combined-training"><PracticeCard title={training.title} locale={locale} records={[]} dataSkill="combined" onStart={onContinue}>{(['reading','listening'] as const).map(skill => <PracticeOptions key={skill} locale={locale} profileId={profileId} skill={skill} value={automaticPractice} history={[]} records={[]} disabled={false} onChange={async () => {}}/>)}</PracticeCard></div>
      </div></section>
    </div><DailyQuote locale={locale} onDayChange={onDayChange}/>
  </div>;
});

const LibraryPreview = memo(function LibraryPreview({ locale, profileId }: { locale: Locale; profileId: string }) {
  const app = messages('app')[locale];
  return <div className="library-page">
    <div className="library-page-heading"><h1>{app.library}</h1><div className="library-history-entry"><a className="records-link" href="/library/history">{messages('lookupHistory_lookupHistoryCopy')[locale].entry}</a></div></div>
    <section className="library-references"><h2>{app.references}</h2>
      {(['dictionary', 'ipa', 'grammar'] as const).map(name => <a className="library-reference-tile" href={`/library/${name}`} key={name}>{name === 'dictionary' ? app.dictionaryEntry : app[name]}</a>)}
    </section>
    <OfflineInstall locale={locale} profileId={profileId} online={navigator.onLine} onReady={() => {}} preview/><InstalledResources locale={locale} profileId={profileId}/><CommunityImport locale={locale} profileId={profileId} onInstalled={() => {}}/>
  </div>;
});

type WelcomeProps = { locale: Locale; profileId: string; date: string; onDayChange: (day: string) => void; onContinue: () => void; settings: ReactNode };
export function Welcome(props: WelcomeProps) {
  const { locale, onContinue } = props, t = messages('onboarding')[locale], app = messages('app')[locale];
  const titles = [app.today, app.library, app.settings], subtitles = [t.subToday, t.subLibrary, `${app.preferences} · ${t.subSync}`];
  const [active, setActive] = useState(0), [fernActive, setFernActive] = useState(true);
  const [width, setWidth] = useState(0), [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [viewport, setViewport] = useState(() => ({ width: innerWidth, height: innerHeight }));
  const screenRatio = viewport.width / viewport.height;
  const inputFrame = useRef(0);
  const stage = useRef<HTMLDivElement>(null), frame = useRef(0), current = useRef(0), destination = useRef(0);
  const cards = useRef<(HTMLElement | null)[]>([]), dots = useRef<(HTMLSpanElement | null)[]>([]);
  const selected = useRef(0), growing = useRef(true);
  const drag = useRef<{ id: number; x: number; y: number; position: number; at: number; last: number; velocity: number; axis?: 'x' | 'y' } | undefined>(undefined), suppressClick = useRef(false);
  const pointerHeld = useRef(false), cancelWheel = useRef(() => {});
  const idleUntil = useRef(performance.now() + 6000), keyboard = useRef(false);
  const rtl = locale === 'ar' ? -1 : 1;
  useLayoutEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)'), update = () => setReduced(media.matches);
    const resize = () => setViewport({ width: innerWidth, height: innerHeight });
    media.addEventListener('change', update);
    window.addEventListener('resize', resize);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width)); observer.observe(stage.current!);
    return () => { media.removeEventListener('change', update); window.removeEventListener('resize', resize); observer.disconnect(); cancelAnimationFrame(frame.current); cancelAnimationFrame(inputFrame.current); };
  }, []);
  const cardWidth = Math.min(width - (viewport.width < 700 ? 40 : 0), viewport.width < 700 ? 420 : screenRatio <= 1 ? 600 : 900);
  // Keep loop wrapping outside the viewport, including ultrawide displays.
  const shift = Math.max(cardWidth * .92 + 12, (viewport.width + cardWidth * .8 + 64) / 3), dragDistance = Math.max(90, shift);
  const swipeDistance = Math.max(90, viewport.width < 700 ? cardWidth * .6 : Math.min(300, Math.max(24, (width - cardWidth * .85) / 2)) * 1.1);
  const paint = useCallback((value: number) => {
    current.current = value;
    const next = ((Math.round(value) % 3) + 3) % 3;
    if (next !== selected.current) { selected.current = next; setActive(next); }
    const todayActive = Math.abs(((value + 4.5) % 3 + 3) % 3 - 1.5) < .25;
    if (todayActive !== growing.current) { growing.current = todayActive; setFernActive(todayActive); }
    cards.current.forEach((card, index) => {
      if (!card) return;
      const distance = ((index - value + 4.5) % 3 + 3) % 3 - 1.5, away = Math.abs(distance);
      const x = distance * shift * rtl;
      const scale = 1 - .12 * Math.min(away, 1) - .1 * Math.max(0, away - 1);
      // Preserve the apparent depth without 3D layers around filtered scroll surfaces.
      const projection = 1600 / (1600 + 100 * away);
      card.style.transform = reduced ? 'none' : `translate(${x}px,0) scale(${scale * projection})`;
      if (card.dataset.current !== String(index === next)) { card.dataset.current = String(index === next); card.setAttribute('aria-hidden', String(index !== next)); }
      const window = card.querySelector<HTMLElement>('.welcome-window')!, inert = index !== next || drag.current?.axis === 'x';
      if (window.inert !== inert) window.inert = inert;
      card.querySelector<HTMLElement>('.welcome-shadow')!.style.opacity = String(reduced ? 1 : 1 - .8 * Math.min(away, 1));
      const shade = card.querySelector<HTMLElement>('.welcome-shade')!;
      shade.style.opacity = String(reduced ? 0 : Math.min(.25, away * .18));
      const dot = dots.current[index], weight = Math.max(0, 1 - away);
      if (dot) {
        const button = dot.parentElement!;
        if (button.hasAttribute('aria-current') !== (index === next)) { if (index === next) button.setAttribute('aria-current', 'true'); else button.removeAttribute('aria-current'); }
        dot.style.transform = `scaleX(${(7 + 19 * weight) / 26})`; dot.style.opacity = String(.4 + .6 * weight); dot.style.borderRadius = `${3.5 * 26 / (7 + 19 * weight)}px / 3.5px`; }
    });
  }, [reduced, rtl, shift]);
  useLayoutEffect(() => { paint(current.current); }, [paint]);
  const go = useCallback((target: number, velocity = 0) => {
    idleUntil.current = performance.now() + 6000;
    cancelAnimationFrame(frame.current);
    // Choose the nearest loop copy, even during an unfinished drag.
    target = current.current + (((target - current.current + 4.5) % 3 + 3) % 3 - 1.5);
    const offset = current.current - target, toward = Math.sign(-offset);
    const speed = toward * velocity > 0 ? toward * Math.min(6, Math.abs(velocity), 18 * Math.abs(offset)) : Math.max(-6, Math.min(6, velocity)), began = performance.now();
    destination.current = target;
    const finish = () => { frame.current = 0; destination.current = ((Math.round(target) % 3) + 3) % 3; paint(destination.current); };
    if (reduced || matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
    // Preserve release velocity with an interruptible critically damped spring.
    const animate = (now: number) => {
      const seconds = (now - began) / 1000, decay = Math.exp(-18 * seconds);
      const value = target + (offset + (speed + 18 * offset) * seconds) * decay;
      paint(value);
      if (seconds < .8 && Math.abs(value - target) > .0005) frame.current = requestAnimationFrame(animate); else finish();
    };
    frame.current = requestAnimationFrame(animate);
  }, [paint, reduced]);
  useEffect(() => { if (reduced) go(Math.round(current.current)); }, [go, reduced]);
  useEffect(() => {
    if (reduced) return;
    const rotate = () => {
      const root = stage.current;
      if (document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches || drag.current || pointerHeld.current || performance.now() < idleUntil.current || root?.querySelector('input:focus,textarea:focus,select:focus') || (keyboard.current && root?.closest('.welcome')?.contains(document.activeElement))) return;
      go(Math.round(current.current) + 1);
    };
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => { if (!document.hidden && timer === undefined) timer = setInterval(rotate, 500); };
    start();
    const wake = () => { idleUntil.current = performance.now() + 6000; };
    const root = stage.current!.closest('.welcome')!;
    const down = () => { keyboard.current = false; pointerHeld.current = true; wake(); };
    const release = () => { pointerHeld.current = false; wake(); };
    const visibility = () => {
      release();
      if (!document.hidden) { start(); return; }
      clearInterval(timer); timer = undefined; cancelWheel.current();
      cancelAnimationFrame(frame.current); cancelAnimationFrame(inputFrame.current);
      frame.current = 0; inputFrame.current = 0;
      const held = drag.current;
      if (held?.axis === 'x') destination.current = Math.round(held.last);
      if (held?.axis) suppressClick.current = true;
      drag.current = undefined;
      if (held && stage.current?.hasPointerCapture(held.id)) stage.current.releasePointerCapture(held.id);
      // Finish the invisible transition once; resume at its normal resting pose.
      destination.current = ((Math.round(destination.current) % 3) + 3) % 3;
      paint(destination.current);
    };
    root.addEventListener('pointerdown', down, { passive: true, capture: true });
    window.addEventListener('pointerup', release, { passive: true, capture: true });
    window.addEventListener('pointercancel', release, { passive: true, capture: true });
    const events = ['pointermove', 'wheel', 'keydown', 'input', 'change', 'scroll'];
    for (const name of events) window.addEventListener(name, wake, { passive: true, capture: true });
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clearInterval(timer); root.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', release, true); window.removeEventListener('pointercancel', release, true);
      for (const name of events) window.removeEventListener(name, wake, true);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [go, paint, reduced]);
  useEffect(() => {
    const root = stage.current!, gestures = WheelGestures({ preventWheelAction: false, reverseSign: false });
    let start = 0, origin = 0, total = 0, velocity = 0, settled = false, lastAt = 0, peak = 0, lastDelta = 0;
    let release: ReturnType<typeof setTimeout>;
    const settle = (ending = false) => { if (!settled && !drag.current) { settled = ending || Math.abs(total) >= 40; go(target(), velocity); } };
    const target = () => origin + (Math.abs(total) >= 40 ? Math.sign(total) : 0);
    cancelWheel.current = () => { settled = true; clearTimeout(release); };
    const off = gestures.on('wheel', event => {
      if (drag.current) return;
      if (event.isEnding) { clearTimeout(release); if (!event.isMomentumCancel) settle(true); return; }
      const delta = event.axisDelta[0] * rtl;
      const fresh = settled && !event.isMomentum && (Math.sign(delta) !== Math.sign(total) || Math.abs(delta) > Math.max(12, Math.abs(lastDelta) * 2) || event.event.timeStamp - lastAt > 160 && Math.abs(delta) >= Math.max(12, Math.min(peak * .8, Math.abs(lastDelta) * 2)));
      if (event.isStart || fresh) {
        peak = 0;
        origin = frame.current ? destination.current : Math.round(current.current);
        cancelAnimationFrame(frame.current); frame.current = 0; start = current.current; total = 0; settled = false;
      }
      lastAt = event.event.timeStamp; lastDelta = delta;
      if (settled) return;
      peak = Math.max(peak, Math.abs(delta)); total += delta;
      velocity = event.axisVelocity[0] * rtl * 1000 / dragDistance;
      clearTimeout(release);
      if (event.isMomentum) { settle(true); return; }
      // Stop following paused contact; keep classifying the inertia tail.
      release = setTimeout(() => settle(), 100);
      cancelAnimationFrame(frame.current); frame.current = 0;
      paint(reduced ? target() : start + Math.max(-1, Math.min(1, total / dragDistance)));
    });
    const scroll = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || drag.current || (event.target instanceof Element && event.target.closest('.setting-menu,input,textarea,select'))) return;
      idleUntil.current = performance.now() + 6000;
      if (event.shiftKey || event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      // Handle horizontal trackpad pixels; preserve native wheel and Shift+wheel.
      event.preventDefault(); keyboard.current = false; gestures.feedWheel(event);
    };
    root.addEventListener('wheel', scroll, { passive: false });
    return () => { root.removeEventListener('wheel', scroll); clearTimeout(release); cancelWheel.current = () => {}; off(); gestures.disconnect(); };
  }, [go, paint, rtl, dragDistance, reduced]);
  function end(event: ReactPointerEvent<HTMLDivElement>) {
    const held = drag.current;
    if (!held || held.id !== event.pointerId) return;
    drag.current = undefined; cancelAnimationFrame(inputFrame.current); inputFrame.current = 0;
    if (held.axis === 'x') paint(held.last);
    if (held.axis) suppressClick.current = true;
    const velocity = event.type === 'pointercancel' || performance.now() - held.at > 100 ? 0 : held.velocity;
    if (held.axis === 'x' || Math.abs(current.current - Math.round(current.current)) > .001) {
      // Keep swipe intent independent of the spacing used to follow the finger.
      const projected = held.position + (current.current - held.position + velocity * .16) * (dragDistance / swipeDistance);
      go(Math.max(Math.round(held.position) - 1, Math.min(Math.round(held.position) + 1, Math.round(projected))), velocity);
    } else paint(current.current);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return <section className="welcome" aria-label={t.carousel} style={{ '--welcome-card-ratio': Math.max(.9, Math.min(1.85, screenRatio)) } as React.CSSProperties} onFocusCapture={() => { idleUntil.current = performance.now() + 6000; }} onKeyDownCapture={() => { keyboard.current = true; idleUntil.current = performance.now() + 6000; }} onKeyDown={event => { if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || (event.target instanceof Element && event.target.closest('input,textarea,select,[role=listbox]'))) return; event.preventDefault(); cancelWheel.current(); go(Math.round(current.current) + (event.key === 'ArrowRight' ? rtl : -rtl)); }}>
    <div className="welcome-stage" ref={stage} role="region" aria-roledescription={t.carousel} aria-label={t.carousel}
      onPointerDown={event => { keyboard.current = false; idleUntil.current = performance.now() + 6000; suppressClick.current = false; if (event.isPrimary && event.button === 0) { cancelWheel.current(); cancelAnimationFrame(inputFrame.current); inputFrame.current = 0; cancelAnimationFrame(frame.current); drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, position: current.current, at: performance.now(), last: current.current, velocity: 0 }; } }}
      onPointerMove={event => {
        idleUntil.current = performance.now() + 6000;
        const held = drag.current; if (!held || held.id !== event.pointerId) return;
        const dx = event.clientX - held.x, dy = event.clientY - held.y;
        if (!held.axis && Math.max(Math.abs(dx), Math.abs(dy)) >= 12) {
          if (Math.abs(dy) > Math.abs(dx)) held.axis = 'y';
          else if (Math.abs(dx) >= Math.abs(dy) * 1.25) { held.axis = 'x'; cancelAnimationFrame(frame.current); event.currentTarget.setPointerCapture(event.pointerId); }
        }
        if (held.axis === 'x') {
          event.preventDefault();
          const value = held.position + Math.max(-1, Math.min(1, -dx * rtl / dragDistance)), now = performance.now();
          held.velocity = (value - held.last) * 1000 / Math.max(8, now - held.at);
          held.at = now; held.last = value;
          // Paint once per frame while retaining the final touch position.
          if (!inputFrame.current) inputFrame.current = requestAnimationFrame(() => { inputFrame.current = 0; if (drag.current === held) paint(held.last); });
        }
      }} onPointerUp={end} onPointerCancel={end}
      onClickCapture={event => { if (suppressClick.current) { suppressClick.current = false; if (event.detail > 0) { event.preventDefault(); event.stopPropagation(); } } }}>
      {titles.map((_, index) => <div key={index} ref={node => { cards.current[index] = node; }} className="welcome-card" data-current={index === 0} role="group" aria-label={t.slideN.replace('{n}', String(index + 1))} aria-hidden={index !== 0}
          onClick={event => { if (event.target === event.currentTarget && index !== selected.current) { cancelWheel.current(); go(index); } }}>
          <div className="welcome-shadow"/>
          <div className="welcome-window" inert={index !== 0}>
            <header className="welcome-site-header"><span className="home-mark" role="img" aria-label="Lingfern"><span className="brand-symbol" aria-hidden="true"/></span><span className="mobile-brand" role="img" aria-label="Lingfern"><span className="brand-symbol" aria-hidden="true"/></span><nav className="desktop-nav" data-display="text" aria-label={app.navigation}>{(['today', 'library', 'settings'] as const).map((name, target) => <a key={name} href={`/${name}`} aria-current={index === target ? 'page' : undefined} onClick={event => { event.preventDefault(); cancelWheel.current(); go(target); }}><span className="nav-label">{app[name]}</span></a>)}</nav></header>
            <div className="welcome-content">{index === 0 ? <TodayPreview {...props} active={fernActive}/> : index === 1 ? <div inert><LibraryPreview locale={locale} profileId={props.profileId}/></div> : <div inert>{props.settings}</div>}</div>
            <nav className="mobile-nav welcome-mobile-nav" data-display="both" aria-label={app.navigation}>{(['today', 'library', 'settings'] as const).map((name, target) => <a key={name} href={`/${name}`} aria-current={index === target ? 'page' : undefined} onClick={event => { event.preventDefault(); cancelWheel.current(); go(target); }}><NavIcon name={name}/><span className="nav-label">{app[name]}</span></a>)}</nav>
            <div className="welcome-shade"/>
          </div>
        </div>)}
    </div>
    <div className="welcome-caption"><div className="welcome-caption-copy" aria-live="polite" aria-atomic="true">{titles.map((title, index) => <div key={index} className="welcome-caption-slide" aria-hidden={index !== active} style={{ visibility: index === active ? 'visible' : 'hidden' }}><h1>{title}</h1><p>{subtitles[index]}</p></div>)}</div>
      <div className="welcome-controls"><div className="welcome-dots">{titles.map((_, index) => <button key={index} type="button" aria-label={t.slideN.replace('{n}', String(index + 1))} aria-current={index === 0 ? 'true' : undefined} onClick={() => { cancelWheel.current(); go(index); }}><span ref={node => { dots.current[index] = node; }}/></button>)}</div></div>
      <button type="button" className="primary welcome-start" onClick={onContinue}>{messages('corpusPractice')[locale].start}</button>
    </div>
  </section>;
}
