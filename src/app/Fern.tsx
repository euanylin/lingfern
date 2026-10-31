import { messages } from '../locales';
import { liveQuery } from 'dexie';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { advanceFern, fernGrowth, fernShape, type FernGrowth } from '../core/fern';
import { readLookupHistory } from '../data/lookupHistory';
import { fernActivity, type ProgressEntry } from '../data/progress';
import type { Locale } from '../shared/content';

// Pause all presentation motion when Today is inactive.
type FernMotion = { growth: FernGrowth; velocity: FernGrowth; seconds: number; lookups: number };
const shown = new Map<string, FernMotion>();

export function Fern({ profileId, entries, locale, illustrationActive }: { profileId: string; entries: ProgressEntry[]; locale: Locale; illustrationActive?: boolean }) {
  const illustrating = illustrationActive !== undefined;
  const [lookups, setLookups] = useState<number | undefined>(() => illustrating ? 0 : shown.get(profileId)?.lookups);
  const [failed, setFailed] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(true);
  const { reading, listening, activity } = useMemo(() => ({
    reading: new Set(entries.filter(entry => entry.session.lesson.skill === 'reading').map(entry => entry.session.id)).size,
    listening: new Set(entries.filter(entry => entry.session.lesson.skill === 'listening').map(entry => entry.session.id)).size,
    activity: fernActivity(entries),
  }), [entries]);
  const target = illustrating ? illustrationActive ? fernGrowth(10, 8, 15) : fernGrowth(0, 0, 0) : fernGrowth(activity.reading, activity.listening, lookups ?? 0);
  const initial = useRef((illustrating ? undefined : shown.get(profileId)) ?? { growth: illustrating ? fernGrowth(0, 0, 0) : target, velocity: { stem: 0, left: 0, right: 0 }, seconds: 0, lookups: lookups ?? 0 });
  const illustration = useRef({ phase: 0, target: 0 });
  const motion = useRef({ ...initial.current });
  const destination = useRef(target);
  const frame = useRef(0);
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    let inView = true;
    const update = () => setVisible(inView && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; update(); });
    observer.observe(svg.current!);
    document.addEventListener('visibilitychange', update); update();
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, []);
  useEffect(() => {
    if (illustrating) return;
    const observer = liveQuery(() => readLookupHistory(profileId)).subscribe({
      next(rows) { setLookups(rows.length); setFailed(false); },
      error() { setLookups(previous => previous ?? 0); setFailed(true); },
    });
    return () => observer.unsubscribe();
  }, [profileId, illustrating]);
  useLayoutEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    change();
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  const { stem, left, right } = target;
  useLayoutEffect(() => () => { cancelAnimationFrame(frame.current); frame.current = 0; }, []);
  useLayoutEffect(() => {
    if (lookups === undefined) return;
    const to = { stem, left, right };
    destination.current = to;
    motion.current.lookups = lookups;
    const element = svg.current!;
    const pinnae = element.querySelectorAll<SVGPathElement>('.fern-pinna');
    const stemPath = element.querySelector<SVGPathElement>('.fern-stem')!;
    const paths = [stemPath, ...pinnae], drawn = paths.map(path => path.getAttribute('d'));
    let drawnGrowth = element.getAttribute('data-growth');
    // Update path coordinates per frame; let React handle labels and errors.
    const paint = (value: FernGrowth, seconds = motion.current.seconds) => {
      motion.current.growth = value; if (!illustrating) shown.set(profileId, motion.current);
      const shape = fernShape(value, seconds);
      // Collapsed pinnae have no geometry to redraw during stem motion.
      [shape.stem, ...shape.left, ...shape.right].forEach((d, index) => {
        if (drawn[index] !== d) { paths[index].setAttribute('d', d); drawn[index] = d; }
      });
      const growth = String(value.stem);
      if (drawnGrowth !== growth) { element.setAttribute('data-growth', growth); drawnGrowth = growth; }
    };
    if (!illustrating && !shown.has(profileId)) paint(to, 0);
    illustration.current.target = illustrationActive ? 1.6 : 0;
    if (reduced || !visible) {
      cancelAnimationFrame(frame.current); frame.current = 0;
      if (reduced) { motion.current.seconds = 0; motion.current.velocity = { stem: 0, left: 0, right: 0 }; paint(to, 0); }
      return;
    }
    if (frame.current) return;
    let previous = performance.now();
    if (illustrating) {
      const animate = (time: number) => {
        const direction = Math.sign(illustration.current.target - illustration.current.phase);
        illustration.current.phase = Math.max(0, Math.min(1.6, illustration.current.phase + direction * Math.min(.064, (time - previous) / 1000))); previous = time;
        const value = advanceFern(fernGrowth(0, 0, 0), { stem: 0, left: 0, right: 0 }, fernGrowth(10, 8, 15), illustration.current.phase).growth;
        paint(value, illustration.current.phase);
        if (illustration.current.phase !== illustration.current.target) frame.current = requestAnimationFrame(animate); else frame.current = 0;
      };
      frame.current = requestAnimationFrame(animate); return;
    }
    const animate = (time: number) => {
      const seconds = Math.min(.064, Math.max(0, (time - previous) / 1000));
      motion.current.seconds += seconds;
      const step = advanceFern(motion.current.growth, motion.current.velocity, destination.current, seconds);
      previous = time; motion.current.velocity = step.velocity;
      const settled = (['stem', 'left', 'right'] as const).every(key => Math.abs(step.growth[key] - destination.current[key]) < .00001 && Math.abs(step.velocity[key]) < .00001);
      if (settled) { motion.current.velocity = { stem: 0, left: 0, right: 0 }; paint(destination.current); }
      else paint(step.growth);
      frame.current = requestAnimationFrame(animate);
    };
    frame.current = requestAnimationFrame(animate);
  }, [stem, left, right, lookups, profileId, reduced, visible, illustrating, illustrationActive]);
  const shape = fernShape(initial.current.growth, reduced ? 0 : initial.current.seconds);
  const description = illustrating ? messages('onboarding')[locale].carousel : messages('additional', { reading, listening, lookups: lookups ?? 0, tests: activity.tests })[locale].activity;
  return <><svg ref={svg} className="fern" viewBox="0 0 240 180" role="img" aria-label={description} aria-busy={lookups === undefined} visibility={lookups === undefined ? 'hidden' : 'visible'} data-growth={initial.current.growth.stem} data-motion={reduced ? 'reduced' : visible ? 'active' : 'paused'}>
    <title>{description}</title>
    <g fill="currentColor">{shape.left.map((d, index) => <path className="fern-pinna" key={`left-${index}`} d={d}/>)}{shape.right.map((d, index) => <path className="fern-pinna" key={`right-${index}`} d={d}/>)}</g>
    <path className="fern-stem" d={shape.stem} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/>
  </svg>{failed && <p role="alert" className="error">{messages('lookupHistory_lookupHistoryCopy')[locale].failed}</p>}</>;
}
