import './Welcome.css';
import fernSymbol from '../../public/icon.svg?raw';
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

const previewPages = ['today', 'library', 'settings'] as const;
const wrapCard = (value: number) => ((value % previewPages.length) + previewPages.length) % previewPages.length;

type WelcomeProps = { locale: Locale; profileId: string; online: boolean; date: string; onDayChange: (day: string) => void; onContinue: () => void; settings: ReactNode };
type TodayPreviewProps = Pick<WelcomeProps, 'locale' | 'profileId' | 'date' | 'onDayChange' | 'onContinue'> & { active: boolean };

const TodayPreview = memo(function TodayPreview({ locale, profileId, date, onDayChange, onContinue, active }: TodayPreviewProps) {
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

const LibraryPreview = memo(function LibraryPreview({ locale, profileId, online }: { locale: Locale; profileId: string; online: boolean }) {
  const app = messages('app')[locale];
  return <div className="library-page">
    <div className="library-page-heading"><h1>{app.library}</h1><div className="library-history-entry"><a className="records-link" href="/library/history">{messages('lookupHistory_lookupHistoryCopy')[locale].entry}</a></div></div>
    <section className="library-references"><h2>{app.references}</h2>
      {(['dictionary', 'ipa', 'grammar'] as const).map(name => <a className="library-reference-tile" href={`/library/${name}`} key={name}>{name === 'dictionary' ? app.dictionaryEntry : app[name]}</a>)}
    </section>
    <OfflineInstall locale={locale} profileId={profileId} online={online} onReady={() => {}} preview/><InstalledResources locale={locale} profileId={profileId}/><CommunityImport locale={locale} profileId={profileId} onInstalled={() => {}}/>
  </div>;
});

export function Welcome({ locale, profileId, online, date, onDayChange, onContinue, settings }: WelcomeProps) {
  const t = messages('onboarding')[locale], app = messages('app')[locale];
  const subtitles = [t.subToday, t.subLibrary, `${app.preferences} · ${t.subSync}`];
  const [active, setActive] = useState(0), [fernActive, setFernActive] = useState(true);
  const [width, setWidth] = useState(0), [reduced, setReduced] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 1 });
  const screenRatio = viewport.width / viewport.height;
  const inputFrame = useRef(0);
  const stage = useRef<HTMLDivElement>(null), frame = useRef(0), current = useRef(0), destination = useRef(0);
  const cards = useRef<({ card: HTMLElement; window: HTMLElement; shadow: HTMLElement; shade: HTMLElement } | null)[]>([]), dots = useRef<(HTMLSpanElement | null)[]>([]);
  const selected = useRef(0), growing = useRef(true);
  const drag = useRef<{ id: number; x: number; y: number; position: number; at: number; last: number; velocity: number; axis?: 'x' | 'y' } | undefined>(undefined), suppressClick = useRef(false);
  const pointerHeld = useRef(false), cancelWheel = useRef(() => {});
  const idleUntil = useRef(performance.now() + 6000), keyboard = useRef(false);
  const autoRotating = useRef(false);
  const rtl = locale === 'ar' ? -1 : 1;
  useLayoutEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)'), update = () => setReduced(media.matches);
    const resize = () => {
      const width = innerWidth, height = innerHeight;
      // Narrow card geometry already follows CSS viewport units during browser-bar motion.
      setViewport(current => current.width === width && (width < 700 || current.height === height) ? current : { width, height });
    };
    update(); resize();
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
    const next = wrapCard(Math.round(value));
    if (next !== selected.current) { selected.current = next; setActive(next); }
    const todayActive = Math.abs(wrapCard(value + 4.5) - 1.5) < .25;
    if (todayActive !== growing.current) { growing.current = todayActive; setFernActive(todayActive); }
    cards.current.forEach((layers, index) => {
      if (!layers) return;
      const { card, window, shadow, shade } = layers;
      const distance = wrapCard(index - value + 4.5) - 1.5, away = Math.abs(distance);
      const x = distance * shift * rtl;
      const scale = 1 - .12 * Math.min(away, 1) - .1 * Math.max(0, away - 1);
      // Project depth in two dimensions so the scroll surfaces stay flat.
      const projection = 1600 / (1600 + 100 * away);
      card.style.transform = reduced ? 'none' : `translate(${x}px,0) scale(${scale * projection})`;
      if (card.dataset.current !== String(index === next)) { card.dataset.current = String(index === next); card.setAttribute('aria-hidden', String(index !== next)); }
      const inert = index !== next || drag.current?.axis === 'x';
      if (window.inert !== inert) window.inert = inert;
      shadow.style.opacity = String(reduced ? 1 : 1 - .8 * Math.min(away, 1));
      shade.style.opacity = String(reduced ? 0 : Math.min(.25, away * .18));
      const dot = dots.current[index], weight = Math.max(0, 1 - away);
      if (dot) {
        const button = dot.parentElement!;
        if (button.hasAttribute('aria-current') !== (index === next)) { if (index === next) button.setAttribute('aria-current', 'true'); else button.removeAttribute('aria-current'); }
        dot.style.transform = `scaleX(${(7 + 19 * weight) / 26})`; dot.style.opacity = String(.4 + .6 * weight); dot.style.borderRadius = `${3.5 * 26 / (7 + 19 * weight)}px / 3.5px`; }
    });
  }, [reduced, rtl, shift]);
  // Keep queued frames on current geometry without restarting their spring.
  const livePaint = useRef(paint);
  useLayoutEffect(() => { livePaint.current = paint; paint(current.current); }, [paint]);
  const go = useCallback((target: number, velocity = 0, followDirection = false) => {
    autoRotating.current = false;
    idleUntil.current = performance.now() + 6000;
    cancelAnimationFrame(frame.current);
    // Choose the nearest loop copy, even during an unfinished drag.
    if (!followDirection) target = current.current + (wrapCard(target - current.current + 4.5) - 1.5);
    const offset = current.current - target, toward = Math.sign(-offset);
    // Residual velocity away from the landing would make the card retreat before settling.
    const speed = toward * Math.min(6, Math.max(0, toward * velocity), 18 * Math.abs(offset)), began = performance.now();
    destination.current = target;
    const finish = () => { frame.current = 0; autoRotating.current = false; destination.current = wrapCard(Math.round(target)); livePaint.current(destination.current); };
    if (reduced || matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
    // Preserve release velocity with an interruptible critically damped spring.
    const animate = (now: number) => {
      const seconds = (now - began) / 1000, decay = Math.exp(-18 * seconds);
      const value = target + (offset + (speed + 18 * offset) * seconds) * decay;
      livePaint.current(value);
      if (seconds < .8 && Math.abs(value - target) > .0005) frame.current = requestAnimationFrame(animate); else finish();
    };
    frame.current = requestAnimationFrame(animate);
  }, [reduced]);
  useEffect(() => { if (reduced) go(Math.round(current.current)); }, [go, reduced]);
  useEffect(() => {
    if (reduced) return;
    const rotate = () => {
      const root = stage.current;
      if (document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches || drag.current || pointerHeld.current || performance.now() < idleUntil.current || root?.querySelector('input:focus,textarea:focus,select:focus') || (keyboard.current && root?.closest('.welcome')?.contains(document.activeElement))) return;
      go(Math.round(current.current) + 1);
      autoRotating.current = true;
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
      frame.current = 0; inputFrame.current = 0; autoRotating.current = false;
      const held = drag.current;
      if (held?.axis === 'x') destination.current = Math.round(held.last);
      if (held?.axis) suppressClick.current = true;
      drag.current = undefined;
      if (held && stage.current?.hasPointerCapture(held.id)) stage.current.releasePointerCapture(held.id);
      // Finish the invisible transition once; resume at its normal resting pose.
      destination.current = wrapCard(Math.round(destination.current));
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
    const flickLimit = Math.max(64, dragDistance / 8);
    let start = 0, origin = 0, total = 0, velocity = 0, settled = true, cancelled = false, sustainedContact = false, nativeContact = false;
    let wheelFrame = 0, wheelPosition = 0, horizontal = false, lastAt = 0, startedAt = 0, samples = 0, travel = 0, flick = false, snapping = false;
    let coast: 'free' | { target: number; easeFrom: number; native: boolean } | undefined;
    let lastHorizontalAt = 0, lastDeltaX = 0, slowingSamples = 0;
    let lastWheelTime = 0, recentWheelSpeed = 0;
    let release: ReturnType<typeof setTimeout> | undefined;
    const paintWheel = () => { wheelFrame = 0; paint(wheelPosition); };
    const flush = () => { if (wheelFrame) { cancelAnimationFrame(wheelFrame); paintWheel(); } };
    const clearRelease = () => { clearTimeout(release); release = undefined; };
    const settle = () => {
      clearRelease(); cancelled = false;
      if (settled || drag.current) return;
      flush(); horizontal = false; settled = true; snapping = flick || coast !== undefined;
      go(target(), velocity, flick || typeof coast === 'object');
    };
    const target = () => {
      if (typeof coast === 'object') return coast.target;
      // A new flick advances from the committed card, even while it is still moving.
      if (flick) return origin + Math.sign(total);
      if (Math.abs(total) < 36) return origin;
      // Confirmed long contact can carry the next card before it reaches the midpoint.
      const lead = sustainedContact ? Math.sign(total) * .35 : 0;
      const nearest = Math.round(start + total / dragDistance + lead);
      // Finish near the visible position, including when a new stroke interrupts release.
      return total > 0 ? Math.max(Math.floor(start) + 1, nearest) : Math.min(Math.ceil(start) - 1, nearest);
    };
    const scheduleEnd = (delay = 200) => { clearRelease(); release = setTimeout(settle, Math.max(0, delay - (performance.now() - lastAt))); };
    cancelWheel.current = () => {
      const ending = release !== undefined;
      if (!settled) destination.current = target();
      clearRelease(); flush();
      cancelled ||= !settled; horizontal = false; settled = true;
      if (ending) scheduleEnd();
    };
    const off = gestures.on('wheel', event => {
      // Deceleration can be held contact; settle only after the wheel stream stops.
      if (event.isEnding) {
        if (event.isMomentumCancel) return;
        // Inferred inertia can shorten the library timeout below a still-moving finger's cadence.
        if (coast === 'free' && !settled) scheduleEnd(64);
        else if (typeof coast === 'object' && coast.native && event.isMomentum && !settled) settle();
        else if (release === undefined) scheduleEnd();
        return;
      }
      if (drag.current) return;
      clearRelease();
      if (cancelled) return;
      // Let the snap finish without feeding the same gesture's inertia back into the spring.
      if (snapping && event.isMomentum) return;
      snapping = false;
      horizontal = true;
      const delta = event.axisDelta[0] * rtl;
      // Decide from contact distance before the first inertia sample can push it over the limit.
      if (!settled && flick && event.isMomentum && delta * total > 0) { settle(); return; }
      const freshContact = coast === 'free' && event.isStart && !event.isMomentum;
      if (settled || freshContact) {
        flush();
        // A manual stroke starts from the visible card, not a pending automatic destination.
        origin = frame.current && !autoRotating.current ? destination.current : Math.round(current.current);
        start = current.current; total = 0; settled = false;
        startedAt = lastAt; samples = 0; travel = 0;
        coast = undefined; sustainedContact = false; nativeContact = false;
      }
      // Inertia can carry a card to its contact-selected destination, without selecting another.
      if (!event.isMomentum) {
        if (typeof coast === 'object' && !reduced) total = (wheelPosition - start) * dragDistance;
        coast = undefined;
      } else if (!coast && Math.abs(total) >= 36 && delta * total > 0) {
        let landing = target(), native = false;
        // Use release speed only when the browser confirms both contact and inertia.
        if (nativeContact && 'momentum' in event.event && event.event.momentum === true
          && Math.abs(total) >= dragDistance * .4 && Math.abs(total) >= travel * .8 && velocity * total > 0) {
          const speed = Math.abs(velocity);
          const contactDistance = Math.abs(total) / dragDistance;
          if (speed >= 6 && (contactDistance >= 1 || contactDistance + speed * .16 >= 1.5)) {
            // An intentional fast multi-card stroke follows native inertia until release ends.
            coast = 'free';
            sustainedContact = false;
          } else {
            const direction = Math.sign(total);
            const projected = Math.round(start + total / dragDistance + direction * Math.min(1.25, speed * .16));
            if ((projected - landing) * direction > 0) {
              landing += direction;
              native = true;
            }
          }
        }
        if (coast !== 'free') {
          const limit = (landing - start) * dragDistance;
          coast = { target: landing, easeFrom: total + (limit - total) * (native ? .8 : .5), native };
          if ((limit - total) * delta <= 0) { settle(); return; }
        }
      }
      total += delta;
      samples++;
      travel += Math.abs(delta);
      const distance = Math.abs(total);
      if (!event.isMomentum) {
        nativeContact = 'momentum' in event.event && event.event.momentum === false;
        sustainedContact = nativeContact && lastAt - startedAt >= 180 && distance >= dragDistance && distance >= travel * .8;
      }
      flick = samples > 1 && lastAt - startedAt <= 100 && distance >= 24 && distance <= flickLimit && distance >= travel * .8;
      velocity = event.axisVelocity[0] * rtl * 1000 / dragDistance;
      if (frame.current) { cancelAnimationFrame(frame.current); frame.current = 0; autoRotating.current = false; }
      // Trackpad events can arrive faster than the display can present them.
      let offset = total;
      let handoff = false;
      if (typeof coast === 'object') {
        const remaining = (coast.target - start) * dragDistance - coast.easeFrom;
        const progress = (total - coast.easeFrom) / remaining;
        // Ease into the remaining distance with continuous speed at the transition.
        if (progress > 0) {
          offset = coast.easeFrom - remaining * Math.expm1(-progress);
          velocity *= Math.exp(-progress);
          handoff = true;
        }
      }
      wheelPosition = reduced ? target() : start + offset / dragDistance;
      if (!wheelFrame) wheelFrame = requestAnimationFrame(paintWheel);
      // Continue deceleration in the spring when the flick releases or the coast nears its target.
      if (handoff || flick && event.isMomentum) settle();
      else if (flick) scheduleEnd(110);
    });
    const scroll = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || drag.current || (event.target instanceof Element && event.target.closest('.setting-menu,input,textarea,select'))) { horizontal = false; return; }
      idleUntil.current = performance.now() + 6000;
      const mode = event.deltaMode;
      if (event.shiftKey || mode === WheelEvent.DOM_DELTA_PAGE) { horizontal = false; return; }
      // Vertical samples are still contact, even when their scrolling stays native.
      lastAt = performance.now();
      // Tolerate slight diagonal jitter during horizontal contact; clear vertical input stays native.
      const horizontalRatio = horizontal ? 2 / 3 : 1;
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) * horizontalRatio) {
        horizontal = false;
        if (release !== undefined) scheduleEnd();
        return;
      }
      // WheelGestures normalizes pixel and line deltas before measuring the stroke.
      event.preventDefault(); keyboard.current = false;
      const momentum = (event as WheelEvent & { momentum?: boolean }).momentum;
      const gap = lastAt - lastHorizontalAt;
      const sameDirection = event.deltaX * lastDeltaX > 0;
      const magnitude = Math.abs(event.deltaX), previousMagnitude = Math.abs(lastDeltaX);
      // Compare speed across coalesced pixel events using their input timestamps.
      const elapsed = Math.max(8, event.timeStamp - lastWheelTime);
      const recentSpeed = mode === WheelEvent.DOM_DELTA_PIXEL && sameDirection && elapsed < 40 ? recentWheelSpeed : 0;
      const coalescedMagnitude = recentSpeed * elapsed * 1.25;
      recentWheelSpeed = Math.max(magnitude / elapsed, recentSpeed * Math.exp(-elapsed / 80));
      lastWheelTime = event.timeStamp;
      if (momentum !== undefined || !sameDirection || gap >= 40 || magnitude > previousMagnitude) slowingSamples = 0;
      else if (magnitude < previousMagnitude) slowingSamples++;
      // A renewed push can end an unmarked short stroke before its idle timer fires.
      const renewedPush = gap >= 40 && magnitude > previousMagnitude * 1.15;
      const renewed = momentum === undefined && (
        snapping && (renewedPush || event.deltaX * lastDeltaX < 0) ||
        !settled && flick && renewedPush && sameDirection
      );
      lastHorizontalAt = lastAt; lastDeltaX = event.deltaX;
      // Quantized inertia repeats values and can briefly jump from 2 to 3 pixels.
      const roundingNoise = mode === WheelEvent.DOM_DELTA_PIXEL ? 3 : 0;
      if (momentum === undefined && snapping && sameDirection && gap < 200
        && magnitude <= Math.max(roundingNoise, previousMagnitude * 1.15, coalescedMagnitude)) return;
      // Recognize deceleration during contact before the stroke can pass its first landing.
      const inferredCoast = slowingSamples >= 3 && !settled
        && Math.abs(total) >= dragDistance / 4 && Math.abs(total) < dragDistance * 1.25;
      if (renewed || inferredCoast) {
        if (renewed && !settled) settle();
        const { deltaX, deltaY, deltaMode, timeStamp } = event;
        gestures.feedWheel({ deltaX, deltaY, deltaMode, timeStamp, momentum: !renewed });
      } else gestures.feedWheel(event);
    };
    root.addEventListener('wheel', scroll, { passive: false });
    return () => {
      root.removeEventListener('wheel', scroll); clearRelease(); cancelAnimationFrame(wheelFrame); cancelWheel.current = () => {}; off(); gestures.disconnect();
      // Geometry changes must finish pending contact; an unmounted carousel stays stopped.
      if (!settled && !drag.current && root.isConnected) { livePaint.current(wheelPosition); go(target(), velocity, flick || typeof coast === 'object'); }
    };
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
  function selectCard(index: number) {
    cancelWheel.current();
    go(index);
  }
  function previewNav(index: number, mobile = false) {
    return <nav className={mobile ? 'mobile-nav welcome-mobile-nav' : 'desktop-nav'} data-display={mobile ? 'both' : 'text'} aria-label={app.navigation}>
      {previewPages.map((name, target) => <a key={name} href={`/${name}`} aria-current={index === target ? 'page' : undefined}
        onClick={event => { event.preventDefault(); selectCard(target); }}>
        {mobile && <NavIcon name={name}/>}<span className="nav-label">{app[name]}</span>
      </a>)}
    </nav>;
  }
  return <section className="welcome" aria-label={t.carousel} style={{ '--welcome-card-ratio': viewport.width > 0 ? Math.max(.9, Math.min(1.85, screenRatio)) : undefined } as React.CSSProperties} onFocusCapture={() => { idleUntil.current = performance.now() + 6000; }} onKeyDownCapture={() => { keyboard.current = true; idleUntil.current = performance.now() + 6000; }} onKeyDown={event => { if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || (event.target instanceof Element && event.target.closest('input,textarea,select,[role=listbox]'))) return; event.preventDefault(); cancelWheel.current(); go(Math.round(current.current) + (event.key === 'ArrowRight' ? rtl : -rtl)); }}>
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
          if (!inputFrame.current) inputFrame.current = requestAnimationFrame(() => { inputFrame.current = 0; if (drag.current === held) livePaint.current(held.last); });
        }
      }} onPointerUp={end} onPointerCancel={end}
      onClickCapture={event => { if (suppressClick.current) { suppressClick.current = false; if (event.detail > 0) { event.preventDefault(); event.stopPropagation(); } } }}>
      {previewPages.map((name, index) => <div key={name} ref={node => {
        // These layers share the card's lifetime; keep lookups out of animation frames.
        cards.current[index] = node ? { card: node, window: node.querySelector<HTMLElement>('.welcome-window')!, shadow: node.querySelector<HTMLElement>('.welcome-shadow')!, shade: node.querySelector<HTMLElement>('.welcome-shade')! } : null;
      }} className="welcome-card" data-current={index === 0} role="group" aria-label={t.slideN.replace('{n}', String(index + 1))} aria-hidden={index !== 0}
          onClick={event => { if (event.target === event.currentTarget && index !== selected.current) selectCard(index); }}>
          <div className="welcome-shadow"/>
          <div className="welcome-window" inert={index !== 0}>
            <header className="welcome-site-header"><span className="home-mark" role="img" aria-label="Lingfern"><span className="brand-symbol" aria-hidden="true" dangerouslySetInnerHTML={{ __html: fernSymbol }}/></span><span className="mobile-brand" role="img" aria-label="Lingfern"><span className="brand-symbol" aria-hidden="true" dangerouslySetInnerHTML={{ __html: fernSymbol }}/></span>{previewNav(index)}</header>
            <div className="welcome-content">{name === 'today' ? <TodayPreview locale={locale} profileId={profileId} date={date} onDayChange={onDayChange} onContinue={onContinue} active={fernActive}/> : name === 'library' ? <div inert><LibraryPreview locale={locale} profileId={profileId} online={online}/></div> : <div inert>{settings}</div>}</div>
            {previewNav(index, true)}
            <div className="welcome-shade"/>
          </div>
        </div>)}
    </div>
    <div className="welcome-caption"><div className="welcome-caption-copy" aria-live="polite" aria-atomic="true">{previewPages.map((name, index) => <div key={name} className="welcome-caption-slide" aria-hidden={index !== active} style={{ visibility: index === active ? 'visible' : 'hidden' }}><h1>{app[name]}</h1><p>{subtitles[index]}</p></div>)}</div>
      <div className="welcome-controls"><div className="welcome-dots">{previewPages.map((name, index) => <button key={name} type="button" aria-label={t.slideN.replace('{n}', String(index + 1))} aria-current={index === 0 ? 'true' : undefined} onClick={() => selectCard(index)}><span ref={node => { dots.current[index] = node; }}/></button>)}</div></div>
      <button type="button" className="primary welcome-start" onClick={onContinue}>{messages('corpusPractice')[locale].start}</button>
    </div>
  </section>;
}
