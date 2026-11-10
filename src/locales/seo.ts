import type { Locale } from '../shared/locale.ts';
import en from './en/seo.json' with { type: 'json' };
import hans from './zh-Hans/seo.json' with { type: 'json' };
import hant from './zh-Hant/seo.json' with { type: 'json' };
import ja from './ja/seo.json' with { type: 'json' };
import ko from './ko/seo.json' with { type: 'json' };
import fr from './fr/seo.json' with { type: 'json' };
import es from './es/seo.json' with { type: 'json' };
import de from './de/seo.json' with { type: 'json' };
import pt from './pt/seo.json' with { type: 'json' };
import it from './it/seo.json' with { type: 'json' };
import ru from './ru/seo.json' with { type: 'json' };
import ar from './ar/seo.json' with { type: 'json' };
import hi from './hi/seo.json' with { type: 'json' };
import id from './id/seo.json' with { type: 'json' };

export const seoCopy = { en, 'zh-Hans': hans, 'zh-Hant': hant, ja, ko, fr, es, de, pt, it, ru, ar, hi, id } satisfies Record<Locale, typeof en>;
