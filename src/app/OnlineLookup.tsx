import type { Locale } from '../shared/content';
import { copy } from './i18n';
import { onlineDictionaries, onlineDictionaryUrl } from './onlineDictionaries';

export function OnlineLookup({ query, locale, online, onOpen }: { query: string; locale: Locale; online: boolean; onOpen?: () => void }) {
  const t = copy[locale];
  const term = query.trim();
  return <section className="online-lookup" aria-label={t.onlineLookup} onClick={event => { if (event.target instanceof Element && event.target.closest('a')) onOpen?.(); }}>
    <div className="online-lookup-links">{onlineDictionaries.map(dictionary => {
      const label = t.onlineLookupLink.replace('{dictionary}', dictionary.name).replace('{query}', term);
      const name = `${dictionary.shortName} ↗`;
      return online && term
        ? <a key={dictionary.id} href={onlineDictionaryUrl(term, dictionary.id)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" title={label} aria-label={label}>{name}</a>
        : <span key={dictionary.id} className="online-lookup-disabled" aria-disabled="true" title={dictionary.name}>{name}</span>;
    })}</div>
    {!online && <p role="status" className="muted">{t.onlineLookupOffline}</p>}
  </section>;
}
