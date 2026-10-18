import { contentLocale } from '../shared/locale';
import { contentText, messages } from '../locales';
import { useEffect, useState } from 'react';
import type { Attempt, Session } from '../data/db';
import { practiceLocale, levelSchema, topicSchema, type Lesson, type Locale } from '../shared/content';
import { CorpusPractice } from './CorpusPractice';
import { copy } from './i18n';
import { firstRunCopy } from './FirstRun';
import { SettingsPicker } from './SettingsPicker';
import { TaskDetail, taskMinutes } from './TaskDetail';
import { GeneratedPractice, generatedPracticeLabels } from '../../tests/fixtures/GeneratedPractice';

const labels = messages('taskCatalogue');
export function TaskCatalogue({ locale, lessons, history, records, online, installedGroups, localCorpus = false, localSpoken = false, busy, onStart, profileId, startError }: { localCorpus?: boolean; localSpoken?: boolean; startError: string; profileId: string; locale: Locale; lessons: readonly Lesson[]; history: Session[]; records: Attempt[]; online: boolean; installedGroups: ReadonlySet<string>; busy: boolean; onStart: (lesson: Lesson) => Promise<void> }) {
  const t = labels[locale], c = copy[locale];
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<Lesson>();
  const empty = { skill: 'all', theme: 'all', downloaded: 'all' };
  const [applied, setApplied] = useState(empty), [draft, setDraft] = useState(empty);
  const [desktop, setDesktop] = useState(() => matchMedia('(min-width:1200px)').matches), [open, setOpen] = useState(desktop);
  useEffect(() => { const media = matchMedia('(min-width:1200px)'); const change = () => { setDesktop(media.matches); setOpen(media.matches); }; media.addEventListener('change', change); return () => media.removeEventListener('change', change); }, []);
  const { skill, theme } = applied;
  const controls = desktop ? applied : draft;
  function change(patch: Partial<typeof empty>) { const next = { ...controls, ...patch }; setDraft(next); if (desktop) setApplied(next); }
  const local = (lesson: Lesson) => lesson.skill === 'reading' || !!lesson.communityPackageId || installedGroups.has(`audio-${lesson.targetLevel.toLowerCase()}`);
  const actionFor = (lesson: Lesson) => !online && !local(lesson) ? t.install : history.some(session => session.lesson.id === lesson.id && session.status === 'active') ? c.resume : lesson.skill === 'reading' ? c.start : c.startListening;
  useEffect(() => { if (detail && !lessons.some(item => JSON.stringify(item) === JSON.stringify(detail))) setDetail(undefined); }, [detail, lessons]);
  const all = lessons;
  function matching(filters: typeof empty) {
    const { skill, theme, downloaded } = filters;
    return all.filter(lesson => (skill === 'all' || lesson.skill === skill) && (theme === 'all' || lesson.themes?.includes(theme as typeof topicSchema.options[number])) && (downloaded === 'all' || local(lesson)) && query.trim().toLocaleLowerCase(locale).split(/\s+/).every(word => `${contentText(lesson.title, locale)} ${contentText(lesson.goal, practiceLocale(lesson, locale))}`.toLocaleLowerCase(locale).includes(word)));
  }
  const matches = matching(applied).sort((a, b) => (online ? 0 : Number(local(b)) - Number(local(a))) || levelSchema.options.indexOf(a.targetLevel) - levelSchema.options.indexOf(b.targetLevel));
  function clear() { setQuery(''); setApplied(empty); setDraft(empty); }
  return <section className="task-catalogue">
    <label className="task-search">{t.search}<input type="search" value={query} onChange={event => setQuery(event.target.value)} maxLength={160}/></label>
    <div className="task-catalogue-layout"><details className="task-filters" open={open} onToggle={event => { const expanded = event.currentTarget.open; setOpen(expanded); if (!expanded) setDraft(applied); }}><summary>{t.filters}</summary>
      <SettingsPicker label={t.skill} value={controls.skill} options={[{ value: 'all', label: t.all }, { value: 'reading', label: t.reading }, { value: 'listening', label: t.listening }]} onChange={value => change({ skill: value })}/>
      <SettingsPicker label={t.theme} value={controls.theme} options={[{ value: 'all', label: t.all }, ...topicSchema.options.map((value, index) => ({ value, label: firstRunCopy[locale].themes[index] }))]} onChange={value => change({ theme: value })}/>
      <SettingsPicker label={t.downloaded} value={controls.downloaded} options={[{ value: 'all', label: t.all }, { value: 'local', label: t.local }]} onChange={value => change({ downloaded: value })}/>
      <button type="button" onClick={() => desktop ? clear() : setDraft(empty)}>{t.clear}</button>{!desktop && <div className="backup-actions"><button type="button" onClick={() => { setApplied(draft); setOpen(false); }}>{t.apply} ({matching(draft).length})</button><button type="button" onClick={() => { setDraft(applied); setOpen(false); }}>{t.cancel}</button></div>}
    </details><div className="task-catalogue-list"><p role="status" aria-live="polite">{matches.length} {t.count}</p>
      {!matches.length && <><p>{t.empty}</p><button type="button" onClick={clear}>{t.clear}</button>{!online && <a href="/library">{t.install}</a>}</>}
      {/* ponytail: rough 120-word/minute plus 30-second/response estimate; replace with reviewed unit timings. */}
      {matches.map(lesson => { const completed = history.some(session => session.lesson.id === lesson.id && session.status === 'completed'); const estimated = taskMinutes(lesson); return <section className={`task-row${lesson.communityPackageId ? ' community-task' : ''}`} key={lesson.id}><p className="eyebrow">{lesson.skill.toUpperCase()} · {t.learning}</p><h2 lang={contentText(lesson.title, locale) === lesson.title.en ? 'en' : undefined}>{contentText(lesson.title, locale)}</h2><p lang={practiceLocale(lesson, locale)}>{contentText(lesson.goal, practiceLocale(lesson, locale))}</p><p className="muted">{lesson.communityPackageId && <>{c.communityLessons} · </>}{estimated} {t.minutes} · {local(lesson) ? t.ready : t.missing} · {completed ? t.done : t.fresh}{lesson.themes?.length ? ` · ${lesson.themes.map(value => firstRunCopy[locale].themes[topicSchema.options.indexOf(value)]).join(' / ')}` : ''}</p><button type="button" className="primary" disabled={busy} onClick={() => setDetail(lesson)}>{actionFor(lesson)}</button></section>; })}
    </div></div>
    {detail && <TaskDetail key={detail.id} lesson={detail} action={actionFor(detail)} available={online || local(detail)} locale={locale} profileId={profileId} busy={busy} startError={startError} onStart={onStart} onClose={() => setDetail(undefined)}/>}
    {skill !== 'listening' && (theme === 'all' || theme === 'culture') && (!query.trim() || /english|英语|英語|原文|liter|gutenberg|wiki|b2/i.test(query)) && (applied.downloaded !== 'local' || installedGroups.has('corpus') || installedGroups.has('corpus-open-reading') || localCorpus) && <CorpusPractice key={profileId} locale={locale} profileId={profileId} history={history} records={records} online={online} busy={busy} onStart={onStart} startError={startError}/> }
    {localSpoken && skill !== 'reading' && (theme === 'all' || theme === 'culture') && (!query.trim() || /english|英语|英語|原声|原聲|听力|聽力|listen|wiki|b2/i.test(query)) && <CorpusPractice key={`spoken:${profileId}`} skill="listening" locale={locale} profileId={profileId} history={history} records={records} online={online} busy={busy} onStart={onStart} startError={startError}/> }
    {import.meta.env.MODE === 'test-fixtures' && skill !== 'listening' && (theme === 'all' || theme === 'travel') && (!query.trim() || generatedPracticeLabels[contentLocale(locale)].title.toLocaleLowerCase(locale).includes(query.trim().toLocaleLowerCase(locale))) && <GeneratedPractice locale={locale} history={history} busy={busy} onStart={onStart}/>}
  </section>;
}
