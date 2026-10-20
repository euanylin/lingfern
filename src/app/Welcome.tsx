import { NavIcon } from './NavIcon';
import { memo, useCallback, useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { messages } from '../locales';
import { topicSchema, type Locale } from '../shared/content';
import { DailyQuote } from './DailyQuote';
import { Fern } from './Fern';
import { firstRunCopy } from './FirstRun';
import { PracticeCard } from './PracticeCard';
import { SettingsPicker } from './SettingsPicker';
import { OfflineInstall } from './OfflineInstall';
import { CommunityImport, InstalledResources } from './CommunityImport';

const TodayPreview = memo(function TodayPreview({ locale, profileId, date, onDayChange, onContinue, active }: WelcomeProps & { active: boolean }) {
  const [topics, setTopics] = useState({ reading: '', listening: '' });
  const app = messages('app')[locale], first = firstRunCopy[locale], training = messages('app_training')[locale];
  const options = [{ value: '', label: training.automatic }, ...topicSchema.options.map((value, i) => ({ value, label: first.themes[i] }))];
  return <div className="today-home">
    <div className="today-layout"><section className="hero today-hero"><p className="eyebrow"><time dateTime={date}>{new Date(`${date}T12:00:00`).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}</time></p><Fern profileId={profileId} entries={[]} locale={locale} illustrationActive={active}/><h1>{app.today}</h1></section>
      <section className="practice-section" aria-labelledby="welcome-practice-title" inert><header className="practice-section-heading"><h2 id="welcome-practice-title">{messages('app_practice')[locale]}</h2><a className="records-link" href="/progress">{messages('app_history')[locale]}</a></header><div className="task-grid today-grid">
        {(['reading', 'listening'] as const).map(skill => <div className={`primary-task${skill === 'reading' ? ' reading-task' : ''}`} key={skill}><PracticeCard title={first[skill]} locale={locale} records={[]} dataSkill={skill} onStart={onContinue}><SettingsPicker variant="topic" label={messages('corpusPractice_topic')[locale]} value={topics[skill]} options={options} onChange={value => setTopics(previous => ({ ...previous, [skill]: value }))}/></PracticeCard></div>)}
        <div className="primary-task combined-training"><PracticeCard title={training.title} locale={locale} records={[]} dataSkill="combined" onStart={onContinue}>{(['reading','listening'] as const).map(skill => <SettingsPicker key={skill} variant="topic" displayLabel={first[skill]} label={skill === 'reading' ? training.readingTopic : training.listeningTopic} value={topics[skill]} options={options} onChange={value => setTopics(previous => ({ ...previous, [skill]: value }))}/>)}</PracticeCard></div>
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
    <OfflineInstall locale={locale} profileId={profileId} online={navigator.onLine} onReady={() => {}}/><InstalledResources locale={locale} profileId={profileId}/><CommunityImport locale={locale} profileId={profileId} onInstalled={() => {}}/>
  </div>;
});

type WelcomeProps = { locale: Locale; profileId: string; date: string; onDayChange: (day: string) => void; onContinue: () => void; settings: ReactNode };
export function Welcome(props: WelcomeProps) {
  const { locale, onContinue } = props, t = messages('onboarding')[locale], app = messages('app')[locale];
  const titles = [app.today, app.library, app.settings], subtitles = [t.subToday, t.subLibrary, `${app.preferences} · ${t.subSync}`];
  const [position, setPosition] = useState(0), [active, setActive] = useState(0);
  const [width, setWidth] = useState(0), [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [screenRatio, setScreenRatio] = useState(() => innerWidth / innerHeight);
  const stage = useRef<HTMLDivElement>(null), frame = useRef(0), current = useRef(0);
  const drag = useRef<{ id: number; x: number; y: number; position: number; moved: boolean; axis?: 'x' | 'y' } | undefined>(undefined), suppressClick = useRef(false);
  const pointerHeld = useRef(false);
  const idleUntil = useRef(performance.now() + 6000), keyboard = useRef(false);
  const wheel = useRef<{ at: number; total: number; start: number; horizontal: boolean; timer?: ReturnType<typeof setTimeout> }>({ at: 0, total: 0, start: 0, horizontal: false });
  const rtl = locale === 'ar' ? -1 : 1;
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)'), update = () => setReduced(media.matches);
    const resize = () => setScreenRatio(innerWidth / innerHeight);
    media.addEventListener('change', update);
    window.addEventListener('resize', resize);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width)); observer.observe(stage.current!);
    return () => { media.removeEventListener('change', update); window.removeEventListener('resize', resize); observer.disconnect(); cancelAnimationFrame(frame.current); };
  }, []);
  const cardWidth = Math.min(width - (innerWidth < 700 ? 40 : 0), innerWidth < 700 ? 420 : screenRatio <= 1 ? 600 : 900);
  const shift = innerWidth < 700 ? Math.min(75, width * .18) : Math.min(300, Math.max(24, (width - cardWidth * .85) / 2));
  function paint(value: number) { current.current = value; setPosition(value); setActive(((Math.round(value) % 3) + 3) % 3); }
  const go = useCallback((target: number) => {
    clearTimeout(wheel.current.timer); wheel.current.timer = undefined; wheel.current.at = 0;
    idleUntil.current = performance.now() + 6000;
    cancelAnimationFrame(frame.current);
    const start = current.current, began = performance.now();
    const finish = () => { const next = ((Math.round(target) % 3) + 3) % 3; paint(next); };
    if (reduced || matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
    const animate = (now: number) => {
      const progress = Math.min(1, (now - began) / 720); paint(start + (target - start) * (1 - (1 - progress) ** 4));
      if (progress < 1) frame.current = requestAnimationFrame(animate); else finish();
    };
    frame.current = requestAnimationFrame(animate);
  }, [reduced]);
  useEffect(() => { if (reduced) go(Math.round(current.current)); }, [go, reduced]);
  useEffect(() => {
    if (reduced) return;
    const timer = window.setInterval(() => {
      const root = stage.current;
      if (document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches || drag.current || pointerHeld.current || performance.now() < idleUntil.current || root?.querySelector('input:focus,textarea:focus,select:focus') || (keyboard.current && root?.closest('.welcome')?.contains(document.activeElement))) return;
      go(Math.round(current.current) + 1);
    }, 500);
    const wake = () => { idleUntil.current = performance.now() + 6000; };
    const root = stage.current!.closest('.welcome')!;
    const down = () => { keyboard.current = false; pointerHeld.current = true; wake(); };
    const release = () => { pointerHeld.current = false; wake(); };
    root.addEventListener('pointerdown', down, { passive: true, capture: true });
    window.addEventListener('pointerup', release, { passive: true, capture: true });
    window.addEventListener('pointercancel', release, { passive: true, capture: true });
    const events = ['pointermove', 'wheel', 'keydown', 'input', 'change', 'scroll'];
    for (const name of events) window.addEventListener(name, wake, { passive: true, capture: true });
    document.addEventListener('visibilitychange', release);
    return () => {
      clearInterval(timer); root.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', release, true); window.removeEventListener('pointercancel', release, true);
      for (const name of events) window.removeEventListener(name, wake, true);
      document.removeEventListener('visibilitychange', release);
    };
  }, [go, reduced]);
  useEffect(() => {
    const root = stage.current!;
    const scroll = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || (event.target instanceof Element && event.target.closest('.setting-menu,input,textarea,select'))) return;
      const now = performance.now(); idleUntil.current = now + 6000;
      const gesture = wheel.current;
      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey;
      if (!gesture.at || now - gesture.at > 180 || (!gesture.horizontal && horizontal)) {
        clearTimeout(gesture.timer);
        gesture.start = current.current; gesture.total = 0;
        gesture.horizontal = horizontal;
      }
      gesture.at = now;
      if (!gesture.horizontal || (!horizontal && Math.abs(event.deltaY) >= 8)) return;
      // Own horizontal gestures only inside the carousel, including their momentum tail.
      event.preventDefault(); keyboard.current = false; cancelAnimationFrame(frame.current);
      gesture.total += (event.shiftKey ? event.deltaY * rtl : event.deltaX * rtl) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
      const target = Math.round(gesture.start) + (Math.abs(gesture.total) >= 40 ? Math.sign(gesture.total) : 0);
      const value = reduced ? target : gesture.start + Math.max(-1, Math.min(1, gesture.total / Math.max(90, shift * 1.1)));
      frame.current = requestAnimationFrame(() => paint(value));
      clearTimeout(gesture.timer);
      gesture.timer = setTimeout(() => { gesture.at = 0; gesture.timer = undefined; go(target); }, 180);
    };
    root.addEventListener('wheel', scroll, { passive: false });
    return () => { root.removeEventListener('wheel', scroll); clearTimeout(wheel.current.timer); };
  }, [go, rtl, shift, reduced]);
  function end(event: ReactPointerEvent<HTMLDivElement>) {
    const held = drag.current; drag.current = undefined;
    if (!held || held.id !== event.pointerId) return;
    if (held.moved) suppressClick.current = true;
    if (held.moved || Math.abs(current.current - Math.round(current.current)) > .001) go(Math.round(current.current));
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return <section className="welcome" aria-label={t.carousel} style={{ '--welcome-card-ratio': Math.max(.9, Math.min(1.85, screenRatio)) } as React.CSSProperties} onFocusCapture={() => { idleUntil.current = performance.now() + 6000; }} onKeyDownCapture={() => { keyboard.current = true; idleUntil.current = performance.now() + 6000; }} onKeyDown={event => { if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || (event.target instanceof Element && event.target.closest('input,textarea,select,[role=listbox]'))) return; event.preventDefault(); go(active + (event.key === 'ArrowRight' ? rtl : -rtl)); }}>
    <div className="welcome-stage" ref={stage} role="region" aria-roledescription={t.carousel} aria-label={t.carousel}
      onPointerDown={event => { keyboard.current = false; idleUntil.current = performance.now() + 6000; suppressClick.current = false; if (event.isPrimary && event.button === 0) { clearTimeout(wheel.current.timer); wheel.current.at = 0; cancelAnimationFrame(frame.current); drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, position: current.current, moved: false }; } }}
      onPointerMove={event => {
        idleUntil.current = performance.now() + 6000;
        const held = drag.current; if (!held || held.id !== event.pointerId) return;
        const dx = event.clientX - held.x, dy = event.clientY - held.y;
        if (!held.axis && Math.max(Math.abs(dx), Math.abs(dy)) >= 12) {
          if (Math.abs(dy) > Math.abs(dx)) held.axis = 'y';
          else if (Math.abs(dx) >= Math.abs(dy) * 1.25) { held.axis = 'x'; held.moved = true; cancelAnimationFrame(frame.current); event.currentTarget.setPointerCapture(event.pointerId); }
        }
        if (held.axis === 'x') { event.preventDefault(); paint(held.position + Math.max(-1, Math.min(1, -dx * rtl / Math.max(90, shift * 1.1)))); }
      }} onPointerUp={end} onPointerCancel={end}
      onClickCapture={event => { if (suppressClick.current) { suppressClick.current = false; event.preventDefault(); event.stopPropagation(); } }}>
      {titles.map((title, index) => {
        const distance = ((index - position + 4.5) % 3 + 3) % 3 - 1.5, away = Math.abs(distance), side = Math.max(-1, Math.min(1, distance));
        const x = (side + (distance - side) * .3) * shift * rtl, scale = 1 - .12 * Math.min(away, 1) - .1 * Math.max(0, away - 1);
        const amount = Math.max(0, Math.min(1, (away - .25) / .75)), blur = 1.25 * amount * amount * (3 - 2 * amount);
        return <article key={index} className="welcome-card" data-current={index === active} role="group" aria-label={t.slideN.replace('{n}', String(index + 1))} aria-hidden={index !== active} style={{ transform: reduced ? 'none' : `translateX(${x}px) scale(${scale}) perspective(1600px) rotateY(${side * 14 * rtl}deg)`, opacity: reduced ? Number(index === active) : away > 1 ? Math.max(0, 1 - (away - 1) / .4) : 1, zIndex: 100 - Math.round(away * 20), visibility: reduced && index !== active ? 'hidden' : 'visible' }}>
          <div className="welcome-shadow" style={{ opacity: reduced ? 1 : 1 - .8 * Math.min(away, 1) }}/>
          <div className="welcome-window" inert={index !== active || !!drag.current?.moved} style={{ filter: reduced || blur < .05 ? 'none' : `blur(${blur}px)` }}>
            <header className="welcome-site-header"><span className="home-mark" role="img" aria-label="Lingfern"><span className="brand-symbol" aria-hidden="true"/></span><span className="mobile-brand" role="img" aria-label="Lingfern"><span className="brand-symbol" aria-hidden="true"/></span><nav className="desktop-nav" data-display="text" aria-label={app.navigation}>{(['today', 'library', 'settings'] as const).map((name, target) => <a key={name} href={`/${name}`} aria-current={index === target ? 'page' : undefined} onClick={event => { event.preventDefault(); go(target); }}><span className="nav-label">{app[name]}</span></a>)}</nav></header>
            <div className="welcome-content">{index === 0 ? <TodayPreview {...props} active={Math.abs(((position + 4.5) % 3 + 3) % 3 - 1.5) < .25}/> : index === 1 ? <div inert><LibraryPreview locale={locale} profileId={props.profileId}/></div> : <div inert>{props.settings}</div>}</div>
            <nav className="mobile-nav welcome-mobile-nav" data-display="both" aria-label={app.navigation}>{(['today', 'library', 'settings'] as const).map((name, target) => <a key={name} href={`/${name}`} aria-current={index === target ? 'page' : undefined} onClick={event => { event.preventDefault(); go(target); }}><NavIcon name={name}/><span className="nav-label">{app[name]}</span></a>)}</nav>
            <div className="welcome-shade" style={{ opacity: reduced ? 0 : Math.min(.25, away * .18) }}/>
          </div>
          {index !== active && !reduced && <button className="welcome-side" type="button" tabIndex={-1} aria-hidden="true" onClick={() => go(position + distance)}>{title}</button>}
        </article>;
      })}
    </div>
    <div className="welcome-caption"><div aria-live="polite" aria-atomic="true"><h1>{titles[active]}</h1><p>{subtitles[active]}</p></div>
      <div className="welcome-controls"><div className="welcome-dots">{titles.map((title, index) => <button key={title} type="button" aria-label={t.slideN.replace('{n}', String(index + 1))} aria-current={index === active ? 'true' : undefined} onClick={() => go(position + (((index - position + 4.5) % 3 + 3) % 3 - 1.5))}><span style={{ width: `${7 + 19 * Math.max(0, 1 - Math.abs(((index - position + 4.5) % 3 + 3) % 3 - 1.5))}px`, backgroundColor: `color-mix(in srgb,var(--ink) ${100 * Math.max(0, 1 - Math.abs(((index - position + 4.5) % 3 + 3) % 3 - 1.5))}%,var(--control))` }}/></button>)}</div></div>
      <button type="button" className="primary welcome-start" onClick={onContinue}>{messages('corpusPractice')[locale].start}</button>
    </div>
  </section>;
}
