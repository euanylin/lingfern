import { messages } from '../locales';
import { PlaybackIcon } from './PlaybackIcon';
import { useEffect, useRef, useState } from 'react';
import { ipaChartSchema, ipaSymbols, officialIpaChart, rhoticRows, diphthongRows, type IpaCell, type IpaEntry } from './ipaTables';
import { fullIpaAudioSchema, fullIpaSoundSymbols, type FullIpaSound } from './ipaFullAudio';
import type { Locale } from '../shared/content';
import { recordLookup } from '../data/lookupHistory';
import { lookupHistoryCopy } from './LookupHistory';

import { fullVowels, fullPlaces, fullConsonants, otherSymbols, affricates, nonPulmonic, diacritics, suprasegmentals, tones, englishVariants } from './fullIpa';

const labels = messages('ipaChart');

export function IpaChart({ locale, profileId, initialQuery = '' }: { locale: Locale; profileId: string; initialQuery?: string }) {
  const t = labels[locale];
  const [entries, setEntries] = useState<IpaEntry[]>();
  const [sounds, setSounds] = useState<FullIpaSound[]>();
  const [fullError, setFullError] = useState(false);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState('');
  const [view, setView] = useState<'simple' | 'detailed'>(() => fullIpaSoundSymbols.includes(initialQuery) && !ipaSymbols.includes(initialQuery) ? 'detailed' : 'simple');
  const [historyError, setHistoryError] = useState(false);
  const chartLabels = view === 'detailed' ? labels.en : t;
  const player = useRef<HTMLAudioElement>(null);
  const focusedEntry = useRef<HTMLElement>(null);
  useEffect(() => {
    let live = true;
    fetch('/ipa/entries.json').then(async response => { if (!response.ok) throw new Error('IPA_UNAVAILABLE'); return ipaChartSchema.parse(await response.json()); }).then(data => { if (live) setEntries(data.entries); }).catch(() => { if (live) setError(t.failed); });
    fetch('/ipa/full-sounds.json').then(async response => { if (!response.ok) throw new Error('IPA_UNAVAILABLE'); return fullIpaAudioSchema.parse(await response.json()); }).then(data => { if (live) setSounds(data.entries); }).catch(() => { if (live) setFullError(true); });
    return () => { live = false; player.current?.pause(); };
  }, [t.failed]);
  useEffect(() => {
    if (initialQuery && focusedEntry.current) {
      focusedEntry.current.scrollIntoView({ block: 'center' });
      focusedEntry.current.focus({ preventScroll: true });
    }
  }, [entries, sounds, initialQuery]);
  async function play(ipa: string, src: string, kind: 'sound' | 'word') {
    const audio = player.current;
    if (!audio) return;
    setError(''); setPlaying(`${ipa}-${kind}`);
    audio.src = src;
    try { await audio.play(); } catch { setPlaying(''); setError(t.failed); return; }
    try { await recordLookup(profileId, 'ipa', ipa); setHistoryError(false); }
    catch { setHistoryError(true); }
  }
  const bySymbol = new Map(entries?.map(entry => [entry.ipa, entry]));
  const bySound = new Map(sounds?.map(entry => [entry.ipa, entry]));
  function renderEntry(symbol: string) {
    const entry = bySymbol.get(symbol);
    if (!entry) {
      const sound = bySound.get(symbol);
      if (!sound) return <span className="ipa-reference-symbol" key={symbol} data-symbol={symbol}>{symbol}</span>;
      return <article className="ipa-entry ipa-reference-entry" key={symbol} data-ipa={symbol} ref={symbol === initialQuery ? focusedEntry : undefined} tabIndex={symbol === initialQuery ? -1 : undefined}>
        <button type="button" className="ipa-symbol" aria-label={`${chartLabels.sound} /${symbol}/`} aria-pressed={playing === `${symbol}-sound`} onClick={() => void play(symbol, sound.soundAudio, 'sound')}>
          <span className={englishVariants.includes(symbol) ? 'ipa-english-variant' : undefined} lang="en" dir="ltr" title={englishVariants.includes(symbol) ? 'English accent variant or allophone' : undefined}>{symbol}</span><PlaybackIcon state={playing === `${symbol}-sound` ? 'stop' : 'play'}/>
        </button>
      </article>;
    }
    return <article className="ipa-entry" key={symbol} data-ipa={symbol} ref={symbol === initialQuery ? focusedEntry : undefined} tabIndex={symbol === initialQuery ? -1 : undefined}>
      {view === 'simple' ? <>
        <span className="ipa-symbol" lang="en" dir="ltr">/{symbol}/</span>
        <button type="button" aria-label={`${chartLabels.sound} /${symbol}/`} aria-pressed={playing === `${symbol}-sound`} onClick={() => void play(symbol, entry.soundAudio, 'sound')}><PlaybackIcon state={playing === `${symbol}-sound` ? 'stop' : 'play'}/></button>
        <span lang="en" dir="ltr">{entry.before}<strong>{entry.bold}</strong>{entry.after}</span>
        <button type="button" aria-label={`${chartLabels.word} ${entry.example}`} aria-pressed={playing === `${symbol}-word`} onClick={() => void play(symbol, entry.audio, 'word')}><PlaybackIcon state={playing === `${symbol}-word` ? 'stop' : 'play'}/></button>
      </> : <>
        <button type="button" className="ipa-symbol" aria-label={`${chartLabels.sound} /${symbol}/`} aria-pressed={playing === `${symbol}-sound`} onClick={() => void play(symbol, entry.soundAudio, 'sound')}><span className="ipa-english-circle" lang="en" dir="ltr">{symbol}</span><PlaybackIcon state={playing === `${symbol}-sound` ? 'stop' : 'play'}/></button>
        <button type="button" className="ipa-word" aria-label={`${chartLabels.word} ${entry.example}`} aria-pressed={playing === `${symbol}-word`} onClick={() => void play(symbol, entry.audio, 'word')}><span lang="en" dir="ltr">{entry.before}<strong>{entry.bold}</strong>{entry.after}</span><PlaybackIcon state={playing === `${symbol}-word` ? 'stop' : 'play'}/></button>
      </>}
    </article>;
  }
  function table({ id, title, axis, columns, rows, legend, note }: { id: string; title: string; axis: string; columns: { key: string; label: string }[]; rows: { key: string; label: string; cells: readonly IpaCell[] }[]; legend?: string; note?: string }) {
    return <section className="ipa-category" key={id}>
      <h3 id={`${id}-title`}>{title}</h3>
      {legend && <p id={`${id}-legend`} className="muted">{legend}</p>}
      {note && <p className="muted">{note}</p>}
      <div className="ipa-table-scroll" role="region" aria-labelledby={`${id}-title`} tabIndex={0}>
        <table className={`ipa-table ipa-table-${id}`} dir="ltr" aria-labelledby={`${id}-title`} aria-describedby={legend ? `${id}-legend` : undefined}>
          <thead><tr><th scope="col"><bdi>{axis}</bdi></th>{columns.map(column => <th scope="col" key={column.key}><bdi>{column.label}</bdi></th>)}</tr></thead>
          <tbody>{rows.map(row => <tr key={row.key} data-row={row.key}><th scope="row"><bdi>{row.label}</bdi></th>{row.cells.map((cell, index) => <td key={columns[index].key} data-column={columns[index].key}><div className={`ipa-cell${cell.length === 2 ? ' ipa-cell-pair' : ''}`}>{cell.map((symbol, slot) => symbol ? renderEntry(symbol) : <span key={slot} aria-hidden="true"/>)}</div></td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>;
  }
  return <section className={`reference-page ipa-page ipa-${view}`}>
    <div className="ipa-heading">
      <h1>{t.title}</h1>
      <a className="ipa-official-link" href={officialIpaChart} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{t.officialChart} <span aria-hidden="true">↗</span></a>
      <p className="muted ipa-scope" lang={view === 'detailed' ? 'en' : locale} dir={view === 'detailed' ? 'ltr' : undefined}>{view === 'detailed' ? 'Full IPA chart. Select a vowel or consonant to hear it. Solid circles mark General American sounds; dashed circles mark selected English variants.' : chartLabels.scope}</p>
    </div>
    <div className="progress-skill-tabs ipa-view-switch" role="group" aria-label={t.view}>
      {(['simple', 'detailed'] as const).map(value => <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)}>{t[value]}</button>)}
    </div>
    {(!entries || view === 'detailed' && !sounds) && !error && !fullError && <p role="status">{t.loading}</p>}
    {(error || view === 'detailed' && fullError) && <p role="alert" className="error">{error || t.failed}</p>}
    {historyError && <p role="alert" className="error">{lookupHistoryCopy[locale].saveFailed}</p>}
    <audio ref={player} preload="none" onEnded={() => setPlaying('')} onError={() => { setPlaying(''); setError(t.failed); }}/>
    {entries && (view === 'simple' ? (['vowel', 'consonant'] as const).map(group => <section className="ipa-group" key={group}>
      <h2>{t.groups[group]}</h2>
      {group === 'consonant' && <section className="ipa-category"><h3>{t.contrast}</h3><div className="ipa-pairs" dir="ltr">{entries.filter(entry => entry.voicing === 'voiceless' && entry.pair).map(entry => <div className="ipa-pair" key={entry.ipa}><span>/{entry.ipa}/</span><span aria-hidden="true">↔</span><span>/{entry.pair}/</span></div>)}</div></section>}
      {[...new Set(entries.filter(entry => entry.group === group).map(entry => entry.category))].map(category => <section className="ipa-category" key={category}>
        <h3>{t.categories[category]}</h3>{category === 'rhotic-vowel' && <p className="muted">{t.rhoticNote}</p>}
        <div className="ipa-grid" dir="ltr">{entries.filter(entry => entry.group === group && entry.category === category).map(entry => renderEntry(entry.ipa))}</div>
      </section>)}
    </section>) : sounds && <>
      <div className="ipa-full-chart" lang="en" dir="ltr">
      <section className="ipa-group" lang="en" dir="ltr"><h2>Vowels</h2><p className="muted">In pairs, the right symbol is rounded. Positions are schematic; English vowel quality varies by accent.</p>
        <div className="ipa-vowel-scroll" role="region" aria-label="Vowel chart: height and backness" tabIndex={0}><div className="ipa-vowel-map">
          <div className="ipa-vowel-columns"><span>Front</span><span>Central</span><span>Back</span></div>
          <div className="ipa-vowel-body"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M10 8H91V92H49ZM51 8L71 92M23 36H91M36 64H91"/></svg>
          {fullVowels.map(row => <div className="ipa-vowel-row" key={row.height}><span className="ipa-vowel-height" style={{ top: `${row.y}%` }}>{row.height}</span>{row.cells.map(([x, left, right]) => <div className="ipa-vowel-pair" key={x} style={{ left: `${x}%`, top: `${row.y}%` }}>{[left, right].map((symbol, index) => symbol ? renderEntry(symbol) : <span key={index}/>)}</div>)}</div>)}
          </div>
        </div></div>
        {table({ id: 'rhotic', title: 'English rhotic vowels', axis: 'Central / Stress', columns: [{ key: 'stressed', label: 'Stressed' }, { key: 'unstressed', label: 'Unstressed' }], rows: rhoticRows.map(row => ({ ...row, label: 'Central' })), note: labels.en.rhoticNote })}
        {table({ id: 'diphthongs', title: 'English diphthongs', axis: 'Start · Height', columns: [{ key: 'ɪ', label: 'Ending /ɪ/' }, { key: 'ʊ', label: 'Ending /ʊ/' }], rows: diphthongRows.map(row => ({ ...row, label: labels.en.heights[row.key] })) })}
      </section>
      <section className="ipa-group" lang="en" dir="ltr"><h2>Pulmonic consonants</h2><p className="muted">In pairs, the right symbol is voiced. Shaded slots are articulations judged impossible; empty slots are unspecified.</p>
        <div className="ipa-table-scroll" role="region" aria-label="Pulmonic consonants" tabIndex={0}><table className="ipa-table ipa-table-consonants"><thead><tr><th scope="col">Manner / Place</th>{fullPlaces.map(place => <th scope="col" key={place}>{place}</th>)}</tr></thead><tbody>{fullConsonants.map(([manner, ...cells]) => <tr key={manner} data-row={manner.toLowerCase().replaceAll(' ', '-')}><th scope="row">{manner}</th>{cells.map((cell, index) => <td key={index} data-column={fullPlaces[index].toLowerCase()}><div className="ipa-cell ipa-cell-pair">{[cell[0], cell[1]].map((symbol, slot) => symbol === '—' ? <span className="ipa-impossible" aria-label="Articulation judged impossible" key={slot}/> : symbol ? renderEntry(symbol) : <span key={slot}/>)}</div></td>)}</tr>)}</tbody></table></div>
      </section>
      <section className="ipa-group" lang="en" dir="ltr"><h2>Non-pulmonic consonants</h2>{table({ id: 'nonpulmonic', title: 'Clicks, implosives and ejectives', axis: 'Place', columns: ['Clicks', 'Voiced implosives', 'Ejectives (examples)'].map(key => ({key, label:key})), rows: nonPulmonic.map(([key, ...cells]) => ({key, label:key, cells})), note: 'ʼ marks an ejective. Examples are not an exhaustive list of combinations.' })}</section>
      {([
        ['other', 'Other symbols', otherSymbols], ['affricates', 'Affricates (examples)', affricates], ['diacritics', 'Diacritics', diacritics], ['suprasegmentals', 'Suprasegmentals', suprasegmentals], ['tones', 'Tones and word accents', tones],
      ] as const).map(([id, title, items]) => <section className="ipa-group" lang="en" dir="ltr" key={id}><h2>{title}</h2>{id === 'affricates' && <p className="muted">Affricates and double articulations may use a tie bar above or below: t͡ʃ = tʃ, d͡ʒ = dʒ; k͡p. These are combinations, not a closed inventory.</p>}<div className="ipa-symbol-list">{items.map(([symbol, description]) => <div className="ipa-symbol-item" key={symbol}>{renderEntry(symbol)}<span>{description}</span></div>)}</div></section>)}
      </div>
      <p className="muted ipa-attribution" lang="en">IPA classification: <a href="https://www.internationalphoneticassociation.org/content/ipa-chart" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">International Phonetic Association</a> (2026), adapted by Lingfern · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">CC BY-SA 4.0</a>.</p>
    </>)}
  </section>;
}
