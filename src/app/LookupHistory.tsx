import { messages } from '../locales';
import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import type { Locale } from '../shared/content';
import { lookupHistoryUrl, readLookupHistory, type LookupRecord } from '../data/lookupHistory';
import { copy } from './i18n';

const lookupHistoryCopy = messages('lookupHistory_lookupHistoryCopy');

export function LookupHistory({ locale, profileId }: { locale: Locale; profileId: string }) {
  const t = lookupHistoryCopy[locale];
  const [rows, setRows] = useState<LookupRecord[]>();
  const [error, setError] = useState(false);
  useEffect(() => {
    const observer = liveQuery(() => readLookupHistory(profileId)).subscribe({ next(result) { setRows(result); setError(false); }, error() { setError(true); } });
    return () => observer.unsubscribe();
  }, [profileId]);
  const today = new Date().toDateString();
  const timeFormat = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const dateFormat = new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return <section className="library-page lookup-history">
    <a className="records-back" href="/library">← {copy[locale].library}</a><h1>{t.title}</h1>
    {error ? <p className="error" role="alert">{t.failed}</p> : !rows ? <p role="status">{copy[locale].loading}</p> : !rows.length ? <p>{t.empty}</p> : <ul className="lookup-history-list">{rows.map(row => {
      const date = new Date(row.lookedUpAt);
      return <li className="history" key={row.id}><a href={lookupHistoryUrl(row)}>
        <span className="lookup-history-row-top"><strong lang="en" dir="ltr">{row.kind === 'ipa' ? `/${row.term}/` : row.term}</strong><span className="lookup-history-kind">{copy[locale][row.kind === 'dictionary' ? 'dictionaryEntry' : row.kind]}</span></span>
        <time dateTime={row.lookedUpAt}>{date.toDateString() === today ? `${messages('practiceCard_today')[locale]} ${timeFormat.format(date)}` : dateFormat.format(date)}</time>
      </a></li>;
    })}</ul>}
  </section>;
}
