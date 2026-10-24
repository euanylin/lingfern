import { aboutCopy as t } from './aboutCopy';
import audioSources from '../../content/audio-sources.json';
import dailyQuotes from '../../content/daily-quotes-metadata.json';
import credits from '../../content/about-credits.json';
const ipaWords = __LINGFERN_IPA_WORD_SOURCES__;
const ipaSounds = __LINGFERN_IPA_SOUND_SOURCES__;

const recordingGroups = [
  { title: t.originalRecordings, items: audioSources.map(item => ({ label: item.transcript && item.transcript.length <= 40 ? item.transcript : item.title, source: item.source, author: item.author, license: item.license!, changes: item.changes, licenseUrl: item.licenseUrl! })) },
  { title: t.ipaWords, items: ipaWords.map(item => ({ label: item.word, source: item.source, author: item.author, license: item.license, changes: item.changes, licenseUrl: item.licenseUrl })) },
  { title: t.ipaSounds, items: ipaSounds.map(item => ({ label: `/${item.ipa.join(', ')}/`, source: item.source, author: item.author, license: item.license, changes: item.changes, licenseUrl: item.licenseUrl })) },
];

export function About() {
  return <section className="about-page" lang="en" dir="ltr">
    <a className="about-back" href="/settings">← {t.settings}</a>
    <h1>{t.title}</h1>
    <div className="about-logo" role="img" aria-label="Lingfern">
      <span className="brand-symbol" aria-hidden="true"/>
    </div>
    <div className="about-credits">
      <p className="about-copyright">© Euan Lin</p>
      <p className="about-project-terms muted"><a href="https://github.com/euanylin/lingfern" aria-label="Lingfern on GitHub" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Lingfern ↗</a> · <a href="/licenses/lingfern/LICENSE">{t.projectCode}</a> · <a href="/licenses/lingfern/CC-BY-4.0.txt">{t.projectText}</a> · <a href="/licenses/lingfern/NOTICE">{t.projectNotice}</a>. <a href="/licenses/lingfern/BRAND.md">{t.brandTerms}</a>.</p>
      <section>
        <h2>{t.openSource}</h2>
        <ul className="about-projects">{credits.software.map(({ name, license, url }) => <li key={name}><a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{name} ↗</a> <span>{license}</span></li>)}</ul>
        <details className="about-credit-details"><summary>{t.buildTools} ({credits.development.length})</summary><ul>{credits.development.map(({ name, license, url }) => <li key={name}><a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{name} ↗</a> <span>{license}</span></li>)}</ul></details>
        <a href="/THIRD_PARTY_NOTICES.md">{t.licences} ↗</a>
      </section>
      <section>
        <h2>{t.contentSources}</h2>
        <p><a href="/dictionary/oewn-2025/README.md">Open English WordNet 2025 ↗</a> · <a href="/dictionary/oewn-2025/LICENSE.md">CC BY 4.0 ↗</a> · <a href="/dictionary/oewn-2025/WNDB_License.txt">Princeton WordNet licence ↗</a></p>
        <p>{t.ipaClassification}: <a href={credits.ipaClassification.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{credits.ipaClassification.name} ↗</a> · <a href={credits.ipaClassification.licenseUrl} target="_blank" rel="noopener noreferrer">{credits.ipaClassification.license}</a>. {credits.ipaClassification.copyright} {t.ipaAdaptation}</p>
        <details className="about-credit-details"><summary>{t.corpora} ({credits.corpora.length})</summary><p>{t.corpusNotice}</p><ul>{credits.corpora.map(({ name, terms, url }) => <li key={name}><a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{name} ↗</a><span>{terms}</span></li>)}</ul></details>
        <details className="about-credit-details"><summary>{t.quotes} ({dailyQuotes.quoteCount})</summary><ul><li><a href={dailyQuotes.source.url} target="_blank" rel="noopener noreferrer">{dailyQuotes.source.title} ↗</a><span>{dailyQuotes.source.license}</span></li></ul><p><a href="/daily-quotes/README.md">{t.reuseNotes} ↗</a></p></details>
        <h3>{t.audioSources}</h3>
        <p>{t.audioNotice}</p>
        {recordingGroups.map(group => <details className="about-credit-details" key={group.title}><summary>{group.title} ({group.items.length})</summary><ul>{group.items.map(item => <li key={item.source}><a href={item.source} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{item.label} ↗</a><span>{item.author} · <a href={item.licenseUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{item.license}</a></span><span>{item.changes}</span></li>)}</ul></details>)}
      </section>
    </div>
    <ul className="about-links">
      <li><a href="https://rinuan.org/" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><span className="about-link-label"><span className="about-brand-icon about-book-icon" aria-hidden="true"/>{t.blog}</span><span>rinuan.org</span><span className="about-link-arrow" aria-hidden="true">↗</span></a></li>
      <li><a href="mailto:euan@rinuan.org"><span className="about-link-label"><span className="about-brand-icon about-mail-icon" aria-hidden="true"/>{t.email}</span><span>euan@rinuan.org</span><span className="about-link-arrow" aria-hidden="true">↗</span></a></li>
      <li><a href="https://github.com/euanylin" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><span className="about-link-label"><span className="about-brand-icon about-github-icon" aria-hidden="true"/>GitHub</span><span>github.com/euanylin</span><span className="about-link-arrow" aria-hidden="true">↗</span></a></li>
    </ul>
  </section>;
}
