import { messages } from '../locales';
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
    let live = true;
    void readLookupHistory(profileId).then(result => { if (live) setRows(result); }).catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [profileId]);
  return <section className="library-page lookup-history">
    <a className="records-back" href="/library">← {copy[locale].library}</a><h1>{t.title}</h1>
    {error ? <p className="error" role="alert">{t.failed}</p> : !rows ? <p role="status">{copy[locale].loading}</p> : !rows.length ? <p>{t.empty}</p> : <div className="history-grid">{rows.map(row => <article className="history" key={`${row.kind}:${row.term}`}>
      <a href={lookupHistoryUrl(row)}><span lang={row.kind === 'grammar' ? undefined : 'en'}>{row.kind === 'ipa' ? `/${row.term}/` : row.term}</span> · {copy[locale][row.kind === 'dictionary' ? 'dictionaryEntry' : row.kind]}</a>
      <time dateTime={row.lookedUpAt}>{new Date(row.lookedUpAt).toLocaleString(locale)}</time>
    </article>)}</div>}
  </section>;
}
