import './IpaChart.css';
import { messages } from '../locales';
import { useEffect, useRef, useState } from 'react';
import { ipaChartSchema, ipaSymbols, officialIpaChart, rhoticRows, diphthongRows, type IpaCell, type IpaEntry } from './ipaTables';
import { fullIpaAudioSchema, fullIpaSoundSymbols, type FullIpaSound } from './ipaFullAudio';
import type { Locale } from '../shared/content';
import { recordLookup } from '../data/lookupHistory';

import { fullVowels, fullPlaces, placeBreaks, fullConsonants, affricates, nonPulmonic, diacritics, suprasegmentals, otherSymbolRows, toneGroups, englishVariants } from './fullIpa';

const labels = messages('ipaChart');
// Common mobile fonts lack these compound accents.
const toneAccents: Record<string, string> = { '᷄': 'M2 9H9L16 2', '᷅': 'M2 2L9 9H16', '᷈': 'M2 2L7 9L12 2L17 9' };

function linesAfterSpaces(text: string) {
  const parts = text.split(' ');
  return parts.map((part, index) => <span key={`${index}-${part}`}>{index > 0 && <br/>}{part}{index < parts.length - 1 ? ' ' : null}</span>);
}

function revealChartControl(target: EventTarget) {
  const button = target instanceof Element ? target.closest('button') : null;
  const chart = button?.closest<HTMLElement>('.ipa-vowel-scroll,.ipa-table-scroll');
  if (!button || !chart) return;
  const bounds = chart.getBoundingClientRect(), box = button.getBoundingClientRect();
  const start = bounds.left + chart.clientLeft, right = start + chart.clientWidth;
  const left = Math.max(start, button.closest('tr')?.querySelector('th')?.getBoundingClientRect().right ?? start);
  // Reveal feedback beyond sticky row titles without moving the page or intercepting swipes.
  chart.scrollLeft += Math.min(0, box.left - left - 8) + Math.max(0, box.right - right + 8);
}

export function IpaChart({ locale, profileId, initialQuery = '', initialEntries, initialSounds, disabled = false }: { locale: Locale; profileId: string; initialQuery?: string; initialEntries?: unknown; initialSounds?: unknown; disabled?: boolean }) {
  const t = labels[locale];
  const [entries, setEntries] = useState<IpaEntry[] | undefined>(() => initialEntries ? ipaChartSchema.parse(initialEntries).entries : undefined);
  const [sounds, setSounds] = useState<FullIpaSound[] | undefined>(() => initialSounds ? fullIpaAudioSchema.parse(initialSounds).entries : undefined);
  const [fullError, setFullError] = useState(false);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState('');
  const [view, setView] = useState<'simple' | 'detailed'>(() => fullIpaSoundSymbols.includes(initialQuery) && !ipaSymbols.includes(initialQuery) ? 'detailed' : 'simple');
  const [markEnglish, setMarkEnglish] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const chartLabels = view === 'detailed' ? labels.en : t;
  const player = useRef<HTMLAudioElement>(null);
  const playback = useRef({ id: '', request: 0 });
  const focusedEntry = useRef<HTMLElement>(null);
  useEffect(() => {
    let live = true;
    if (!initialEntries) fetch('/ipa/entries.json').then(async response => { if (!response.ok) throw new Error('IPA_UNAVAILABLE'); return ipaChartSchema.parse(await response.json()); }).then(data => { if (live) setEntries(data.entries); }).catch(() => { if (live) setError(true); });
    if (!initialSounds) fetch('/ipa/full-sounds.json').then(async response => { if (!response.ok) throw new Error('IPA_UNAVAILABLE'); return fullIpaAudioSchema.parse(await response.json()); }).then(data => { if (live) setSounds(data.entries); }).catch(() => { if (live) setFullError(true); });
    return () => { live = false; playback.current.request++; playback.current.id = ''; player.current?.pause(); };
  }, [initialEntries, initialSounds]);
  useEffect(() => {
    if (initialQuery && focusedEntry.current) {
      focusedEntry.current.scrollIntoView({ block: 'center' });
      focusedEntry.current.focus({ preventScroll: true });
    }
  }, [entries, sounds, initialQuery]);
  async function play(id: string, src: string, term = id) {
    if (disabled) return;
    const audio = player.current;
    if (!audio) return;
    const request = ++playback.current.request;
    audio.pause();
    if (playback.current.id === id) {
      playback.current.id = ''; setPlaying(''); return;
    }
    playback.current.id = id;
    setError(false); setPlaying(id);
    audio.src = src;
    // Record the selection independently of audio availability.
    void recordLookup(profileId, 'ipa', term).then(
      () => { if (request === playback.current.request) setHistoryError(false); },
      () => { if (request === playback.current.request) setHistoryError(true); },
    );
    try { await audio.play(); } catch {
      if (request === playback.current.request) { playback.current.id = ''; setPlaying(''); setError(true); }
      return;
    }
  }
  const bySymbol = new Map(entries?.map(entry => [entry.ipa, entry]));
  const bySound = new Map(sounds?.map(entry => [entry.ipa, entry]));
  const failed = error || view === 'detailed' && fullError;
  const marked = view === 'detailed' && markEnglish;
  function renderEntry(symbol: string) {
    const entry = bySymbol.get(symbol);
    const sound = entry ?? bySound.get(symbol);
    if (!sound) {
      const [vowel, letters] = symbol.split(' '), accent = toneAccents[vowel[1]];
      if (!letters || !/^[˥˦˧˨˩]+$/.test(letters)) return <span className="ipa-reference-symbol" key={symbol} data-symbol={symbol}>{symbol}</span>;
      const right = Math.max(8, (letters.length - 1) * 6 + 2);
      const points = [...letters].map((letter, index) => `${index * 6 + 2},${'˥˦˧˨˩'.indexOf(letter) * 5 + 2}`).join(' ');
      return <span className="ipa-reference-symbol" key={symbol} data-symbol={symbol}>
        <span className="sr-only">{symbol}</span><span aria-hidden="true">{accent ? <span className="ipa-compound-tone">e<svg viewBox="0 0 19 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d={accent}/></svg></span> : vowel}<svg className="ipa-tone-letter" viewBox={`0 0 ${right + 3} 26`} style={{ width: `${(right + 3) / 26}em` }} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><polyline points={letters.length === 1 ? `${points} ${right},${'˥˦˧˨˩'.indexOf(letters) * 5 + 2}` : points}/><path d={`M${right} 2V22`}/></svg></span>
      </span>;
    }
    const variant = !entry && marked && englishVariants.includes(symbol);
    return <article className={entry ? "ipa-entry" : "ipa-entry ipa-reference-entry"} key={symbol} data-ipa={symbol} ref={symbol === initialQuery ? focusedEntry : undefined} tabIndex={symbol === initialQuery ? -1 : undefined}>
      <button disabled={disabled} type="button" className="ipa-symbol" aria-label={`${chartLabels.sound} /${symbol}/`} aria-pressed={playing === symbol} onClick={() => void play(symbol, sound.soundAudio)}>
        <span className={variant ? 'ipa-english-variant' : entry && marked ? 'ipa-english-circle' : undefined} lang="en" dir="ltr" title={variant ? 'English accent variant or allophone' : undefined}>{view === 'simple' ? `/${symbol}/` : symbol}</span>
      </button>
      {entry && view === 'simple' && <button disabled={disabled} type="button" className="ipa-word" aria-label={`${t.word} ${entry.example}`} aria-pressed={playing === `word:${symbol}`} onClick={() => void play(`word:${symbol}`, entry.audio, symbol)}><span lang="en" dir="ltr">{entry.before}<strong>{entry.bold}</strong>{entry.after}</span></button>}
    </article>;
  }
  function symbolList(title: string, items: readonly (readonly [string, string])[], columns = '', note?: string) {
    return <section className="ipa-group" lang="en" dir="ltr" key={title}><h2>{title}</h2>{note && <p className="muted">{note}</p>}<div className={`ipa-symbol-list${columns ? ` ${columns}` : ''}`}>{items.map(([symbol, description]) => <div className="ipa-symbol-item" key={symbol}>{renderEntry(symbol)}<span>{description}</span></div>)}</div></section>;
  }
  function table({ id, title, columns, rows, note }: { id: string; title: string; columns: { key: string; label: string }[]; rows: { key: string; label: string; cells: readonly IpaCell[] }[]; note?: string }) {
    return <section className="ipa-category" key={id}>
      <h3 id={`${id}-title`}>{title}</h3>
      {note && <p className="muted">{note}</p>}
      <div className="ipa-table-scroll" role="region" aria-labelledby={`${id}-title`} tabIndex={0}>
        <table className={`ipa-table ipa-table-${id}`} dir="ltr" aria-labelledby={`${id}-title`}>
          <thead><tr><th scope="col"/>{columns.map(column => <th scope="col" key={column.key}><bdi>{column.label}</bdi></th>)}</tr></thead>
          <tbody>{rows.map(row => <tr key={row.key} data-row={row.key}><th scope="row"><bdi>{row.label}</bdi></th>{row.cells.map((cell, index) => <td key={columns[index].key} data-column={columns[index].key}><div className={`ipa-cell${cell.length === 2 ? ' ipa-cell-pair' : ''}`}>{cell.map((symbol, slot) => symbol ? renderEntry(symbol) : <span key={slot} aria-hidden="true"/>)}</div></td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>;
  }
  return <section className={`reference-page ipa-page ipa-${view}`}>
    <div className="ipa-heading">
      <h1>{t.title}</h1>
      <a className="ipa-official-link" href={officialIpaChart} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{t.officialChart} <span aria-hidden="true">↗</span></a>
      <p className="muted ipa-scope" lang={view === 'detailed' ? 'en' : locale} dir={view === 'detailed' ? 'ltr' : undefined}>{view === 'detailed' ? `Full IPA chart. Select a vowel or consonant to hear it.${markEnglish ? ' Solid circles mark General American sounds; dashed circles mark selected English variants.' : ''}` : chartLabels.scope}</p>
    </div>
    <div className="ipa-chart-controls">
      <div className="progress-skill-tabs ipa-view-switch" role="group" aria-label={t.view}>
        {(['simple', 'detailed'] as const).map(value => <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)}>{t[value]}</button>)}
      </div>
      {view === 'detailed' && <button type="button" className="ipa-english-marks" aria-pressed={markEnglish} onClick={() => setMarkEnglish(value => !value)}><span className="ipa-english-marks-mark" aria-hidden="true"/>{t.englishMarks}</button>}
    </div>
    {(!entries || view === 'detailed' && !sounds) && !failed && <p role="status">{t.loading}</p>}
    {failed && <p role="alert" className="error">{t.failed}</p>}
    {historyError && <p role="alert" className="error">{messages('lookupHistory_lookupHistoryCopy')[locale].saveFailed}</p>}
    <audio ref={player} preload="none" onPause={() => { if (player.current?.paused) { playback.current.id = ''; setPlaying(''); } }} onEnded={() => { if (player.current?.ended) { playback.current.id = ''; setPlaying(''); } }} onError={() => { if (player.current?.error) { playback.current.id = ''; setPlaying(''); setError(true); } }}/>
    {entries && (view === 'simple' ? (['vowel', 'consonant'] as const).map(group => <section className="ipa-group" key={group}>
      <h2>{t.groups[group]}</h2>
      {group === 'consonant' && <section className="ipa-category"><h3>{t.contrast}</h3><div className="ipa-pairs" dir="ltr">{entries.filter(entry => entry.voicing === 'voiceless' && entry.pair).map(entry => <div className="ipa-pair" key={entry.ipa}><span>/{entry.ipa}/</span><span aria-hidden="true">↔</span><span>/{entry.pair}/</span></div>)}</div></section>}
      {[...new Set(entries.filter(entry => entry.group === group).map(entry => entry.category))].map(category => <section className="ipa-category" key={category}>
        <h3>{t.categories[category]}</h3>{category === 'rhotic-vowel' && <p className="muted">{t.rhoticNote}</p>}
        <div className="ipa-grid" dir="ltr">{entries.filter(entry => entry.group === group && entry.category === category).map(entry => renderEntry(entry.ipa))}</div>
      </section>)}
    </section>) : sounds && <>
      <div className="ipa-full-chart" lang="en" dir="ltr" onClick={event => revealChartControl(event.target)} onFocus={event => {
        // Pointer focus precedes activation; leave the pressed target in place until the click.
        if (!document.documentElement.hasAttribute('data-pointer-input')) revealChartControl(event.target);
      }}>
      <section className="ipa-group" lang="en" dir="ltr"><h2>Vowels</h2><p className="muted">Where symbols appear in pairs, the one to the right represents a rounded vowel. Positions are schematic; English vowel quality varies by accent.</p>
        <div className="ipa-vowel-scroll" role="region" aria-label="Vowel chart: height and backness" tabIndex={0}><div className="ipa-vowel-map">
          <div className="ipa-vowel-columns"><span>Front</span><span>Central</span><span>Back</span></div>
          <div className="ipa-vowel-body"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M10 8H91V92H49ZM51 8L71 92M23 36H91M36 64H91"/></svg>
          {fullVowels.map(row => <div className="ipa-vowel-row" key={row.height}><span className="ipa-vowel-height" style={{ top: `calc(var(--vowel-inset-y) + (100% - 2 * var(--vowel-inset-y)) * ${row.y} / 100)` }}>{row.height}</span>{row.cells.map(([x, left, right]) => <div className="ipa-vowel-pair" key={x} style={{ left: `calc(var(--vowel-inset-x) + (100% - 2 * var(--vowel-inset-x)) * ${x} / 100)`, top: `calc(var(--vowel-inset-y) + (100% - 2 * var(--vowel-inset-y)) * ${row.y} / 100)` }}>{[left, right].map(symbol => symbol ? renderEntry(symbol) : null)}</div>)}</div>)}
          </div>
        </div></div>
        {table({ id: 'rhotic', title: 'English rhotic vowels', columns: [{ key: 'stressed', label: 'Stressed' }, { key: 'unstressed', label: 'Unstressed' }], rows: rhoticRows.map(row => ({ ...row, label: 'Central' })), note: labels.en.rhoticNote })}
        {table({ id: 'diphthongs', title: 'English diphthongs', columns: [{ key: 'ɪ', label: 'Ending /ɪ/' }, { key: 'ʊ', label: 'Ending /ʊ/' }], rows: diphthongRows.map(row => ({ ...row, label: labels.en.heights[row.key] })) })}
      </section>
      <section className="ipa-group" lang="en" dir="ltr"><h2 id="ipa-pulmonic">Consonants (pulmonic)</h2><p className="muted">Symbols to the right in a cell are voiced, and symbols to the left are voiceless. Shaded areas denote articulations judged impossible. Empty slots are unspecified.</p>
        <div className="ipa-table-scroll" role="region" aria-labelledby="ipa-pulmonic" tabIndex={0}><table className="ipa-table ipa-table-consonants"><thead><tr><th scope="col"/>{fullPlaces.map(place => { const parts = placeBreaks[place]; return <th scope="col" key={place}>{parts ? <span className="ipa-place-break">{parts[0]}<br/>{parts[1]}</span> : <span className="ipa-place">{place}</span>}</th>; })}</tr></thead><tbody>{fullConsonants.map(([manner, ...cells]) => <tr key={manner} data-row={manner.toLowerCase().replaceAll(' ', '-')}><th scope="row">{linesAfterSpaces(manner)}</th>{cells.map((cell, index) => <td key={index} data-column={fullPlaces[index].toLowerCase()}><div className="ipa-cell ipa-cell-pair">{[cell[0], cell[1]].map((symbol, slot) => symbol === '—' ? <span className="ipa-impossible" aria-label="Articulation judged impossible" key={slot}/> : symbol ? renderEntry(symbol) : <span key={slot}/>)}</div></td>)}</tr>)}</tbody></table></div>
      </section>
      <div className="ipa-band">
      <section className="ipa-group" lang="en" dir="ltr"><h2>Consonants (non-pulmonic)</h2>
        <p className="muted">ʼ marks an ejective.</p>
        <div className="ipa-airstreams">{nonPulmonic.map(([title, rows]) => <section className="ipa-airstream" key={title}><h3>{title}</h3>{title === 'Ejectives' && <p className="ipa-examples-label">Examples</p>}{rows.map(([symbol, place]) => <div className="ipa-airstream-row" key={symbol}>{renderEntry(symbol)}<span>{place}</span></div>)}</section>)}</div>
      </section>
      <section className="ipa-group" lang="en" dir="ltr"><h2>Other symbols</h2>
        <div className="ipa-symbol-list ipa-cols-other">{otherSymbolRows.map(([symbols, label]) => <div className="ipa-symbol-item" key={label}><span className="ipa-symbol-cluster">{symbols.map(symbol => renderEntry(symbol))}</span><span>{label}</span></div>)}</div>
        <p className="muted">Affricates and double articulations can be represented by two symbols joined by a tie bar if necessary.</p>
      </section>
      </div>
      {symbolList('Affricates (examples)', affricates, 'ipa-cols-examples', 'These played examples are combinations, not a closed inventory.')}
      <div className="ipa-band">
      {symbolList('Diacritics', diacritics, 'ipa-cols-3', 'Some diacritics may be placed above a symbol with a descender, e.g. ŋ̊.')}
      <div className="ipa-band-side">
      {symbolList('Suprasegmentals', suprasegmentals)}
      <section className="ipa-group" lang="en" dir="ltr"><h2>Tones and word accents</h2><div className="ipa-tone-columns">{toneGroups.map(([title, rows]) => <div key={title}><p className="ipa-tone-head">{title}</p><div className="ipa-symbol-list">{rows.map(([symbol, description]) => <div className="ipa-symbol-item" key={symbol}>{renderEntry(symbol)}<span>{description}</span></div>)}</div></div>)}</div></section>
      </div>
      </div>
      </div>
      <p className="muted ipa-attribution" lang="en">IPA classification: <a href="https://www.internationalphoneticassociation.org/content/ipa-chart" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">International Phonetic Association</a> (2026), adapted by Lingfern · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">CC BY-SA 4.0</a>.</p>
    </>)}
  </section>;
}
