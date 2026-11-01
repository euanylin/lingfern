import { AnimatedDetails } from './AnimatedDetails';
import { messages } from '../locales';
import { gutenbergNotice, gutenbergLicence, isGutenbergSource } from '../shared/sourceLicence';
import type { Locale } from '../shared/content';


/** Keep required source notices and full terms available offline. */
export function GutenbergLicence({ sourceUrl, locale }: { sourceUrl?: string; locale: Locale }) {
  if (!isGutenbergSource(sourceUrl)) return null;
  return <section className="gutenberg-licence muted" lang="en">
    <p>{gutenbergNotice}</p>
    <AnimatedDetails><summary lang={locale}>{(messages('gutenbergLicence_full_source_licence'))[locale]}</summary>
      {gutenbergLicence.trim().split(/\n\n+/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    </AnimatedDetails>
  </section>;
}
