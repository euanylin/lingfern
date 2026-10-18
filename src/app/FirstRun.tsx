import { messages, languageOptions } from '../locales';
import { topicSchema } from '../shared/content';
import { useEffect, useRef, useState } from 'react';
import { savePreferences } from '../data/db';
import { initialPreferences, type Preferences } from '../shared/preferences';
import type { Lesson, Locale } from '../shared/content';
import { SettingsPicker } from './SettingsPicker';

export const firstRunCopy = messages('firstRun_firstRunCopy');
const purposes = ['daily-life', 'study', 'work', 'travel', 'pleasure'] as const;
const themes = topicSchema.options;
const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export function FirstRun({ profileId, initial, locale, onLocale, onSaved, onStart, reading, listening, listeningReady }: { profileId: string; initial?: Preferences; locale: Locale; onLocale: (locale: Locale) => Promise<void>; onSaved: (value: Preferences) => void; onStart: (lesson: Lesson) => Promise<void>; reading?: Lesson; listening?: Lesson; listeningReady: boolean }) {
  const [value, setValue] = useState<Preferences>(() => initial ? { ...initial, step: initial.completed ? 0 : initial.step } : initialPreferences);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const localeFocus = useRef<HTMLElement | null>(null);
  const t = firstRunCopy[locale];
  useEffect(() => { heading.current?.focus(); }, [value.step]);
  useEffect(() => {
    if (!busy && localeFocus.current) { localeFocus.current.focus(); localeFocus.current = null; }
  }, [busy]);
  async function changeLocale(locale: Locale) {
    localeFocus.current = heading.current?.closest('.first-run')?.querySelector<HTMLElement>('.setting-trigger') ?? null;
    setBusy(true); setFailed(false);
    try { await onLocale(locale); } catch { setFailed(true); } finally { setBusy(false); }
  }
  async function move(step: number, skip = false, demo?: Lesson) {
    setBusy(true); setFailed(false);
    const next = { ...value, step: Math.min(4, step), completed: step > 4 };
    if (skip && value.step === 1) delete next.purpose;
    if (skip && value.step === 2) next.interests = [];
    if (skip && value.step === 3) { delete next.reading; delete next.listening; }
    try {
      await savePreferences(profileId, next, locale); setValue(next); onSaved(next);
      if (demo) await onStart(demo);
      else if (step > 4) { history.pushState(null, '', '/today'); dispatchEvent(new PopStateEvent('popstate')); }
    } catch { setFailed(true); } finally { setBusy(false); }
  }
  return <section className="first-run">
    <div className="first-run-top"><button disabled={busy || value.step === 0} onClick={() => void move(value.step - 1)}>{t.back}</button><span>{t.step.replace('{n}', String(value.step + 1))}</span><button disabled={busy} onClick={() => void move(value.step + 1, true)}>{t.skip}</button></div>
    <h1 ref={heading} tabIndex={-1}>{t.headings[value.step]}</h1>
    <fieldset disabled={busy} className="first-run-choices">
      {value.step === 0 && <SettingsPicker label={t.headings[0]} value={locale} options={languageOptions} onChange={value => void changeLocale(value as Locale)}/>}
      {value.step === 1 && <><legend>{t.headings[1]}</legend>{[undefined, ...purposes].map((purpose, index) => <label className="option" key={purpose ?? 'none'}><input type="radio" name="purpose" checked={value.purpose === purpose} onChange={() => setValue({ ...value, purpose })}/><span>{index === 0 ? t.unsure : t.purposes[index - 1]}</span></label>)}</>}
      {value.step === 2 && <><legend>{t.headings[2]}</legend><p className="muted">{t.interestLimit} · {value.interests.length}/5</p>{themes.map((theme, index) => <label className="option" key={theme}><input type="checkbox" disabled={!value.interests.includes(theme) && value.interests.length >= 5} checked={value.interests.includes(theme)} onChange={event => setValue({ ...value, interests: event.target.checked ? [...value.interests, theme] : value.interests.filter(item => item !== theme) })}/><span>{t.themes[index]}</span></label>)}</>}
      {value.step === 3 && <>{(['reading', 'listening'] as const).map(skill => <fieldset key={skill}><legend>{t[skill]}</legend>{[undefined, ...levels].map((level, index) => <label className="option" key={level ?? 'none'}><input type="radio" name={skill} checked={value[skill] === level} onChange={() => setValue({ ...value, [skill]: level })}/><span>{level ? `${level} · ${t.levels[index - 1]}` : t.unsure}</span></label>)}</fieldset>)}</>}
      {value.step === 4 && <>{reading && <button onClick={() => void move(5, false, reading)}>{t.read}</button>}{listening && <button disabled={!listeningReady} onClick={() => void move(5, false, listening)}>{t.listen}</button>}{listening && !listeningReady && <p>{t.unavailable} <a href="/library">{messages('app')[locale].library}</a></p>}</>}
    </fieldset>
    <button className="primary" disabled={busy} onClick={() => void move(value.step + 1)}>{value.step === 4 ? t.today : t.next}</button>{failed && <p role="alert" className="error">{t.error}</p>}
  </section>;
}
