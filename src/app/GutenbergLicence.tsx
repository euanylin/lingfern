import { messages } from '../locales';
import { gutenbergNotice, gutenbergLicence, isGutenbergSource } from '../shared/sourceLicence';
import type { Locale } from '../shared/content';


/** Keep the source's required notice and full terms available without a network. */
export function GutenbergLicence({ sourceUrl, locale }: { sourceUrl?: string; locale: Locale }) {
  if (!isGutenbergSource(sourceUrl)) return null;
  return <section className="gutenberg-licence muted" lang="en">
    <p>{gutenbergNotice}</p>
    <details><summary lang={locale}>{(messages('gutenbergLicence_full_source_licence'))[locale]}</summary>
      {gutenbergLicence.trim().split(/\n\n+/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    </details>
  </section>;
}
