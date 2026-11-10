import './validationConfig';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App, preloadPublicPage } from './app/App';
import './app/style.css';
import { loadUiLocale } from './locales';
import { initialLocale } from './app/i18n';
import { db } from './data/db';
import { publicPageStateSchema } from './shared/prerender';
import { prepareDailyQuote } from './app/DailyQuote';
import { defaultInterface, readInitialInterface } from './app/initialInterface';
import { localeDirection } from './shared/locale';

// Open local storage while the required interface language is downloading.
void db.open().catch(() => { /* App.load reports storage failures with its normal retry. */ });

// Route chunks import this shell; finish module evaluation before awaiting them.
async function boot() {
  if (location.pathname === '/introduction' && !location.search) prepareDailyQuote();
  const initialInterface = await readInitialInterface(initialLocale()).catch(() => defaultInterface(initialLocale()));
  try { await loadUiLocale(initialInterface.locale); } catch { /* App.load offers retry. */ }
  document.documentElement.lang = initialInterface.locale;
  document.documentElement.dir = localeDirection(initialInterface.locale);
  document.documentElement.dataset.theme = initialInterface.theme;
  const root = document.getElementById('root')!;
  const initial = root.dataset.publicPage;
  if (initial) {
    try {
      const state = publicPageStateSchema.parse(JSON.parse(initial));
      if (state.path !== location.pathname || location.search) throw new Error('PUBLIC_PAGE_MISMATCH');
      await Promise.all([preloadPublicPage(state.path), loadUiLocale(state.locale ?? 'en')]);
      for (const element of root.querySelectorAll<HTMLElement>('[data-public-style]')) {
        element.style.cssText = element.dataset.publicStyle!;
        delete element.dataset.publicStyle;
        for (const name of [...element.classList]) if (name.startsWith('public-style-')) element.classList.remove(name);
        if (!element.classList.length) element.removeAttribute('class');
      }
      hydrateRoot(root, <App initialPage={state} initialInterface={initialInterface}/>);
      delete root.dataset.publicPage;
      return;
    } catch { /* Ordinary rendering retains the existing load error and retry UI. */ }
  }
  delete root.dataset.publicPage;
  createRoot(root).render(<App initialInterface={initialInterface}/>);
}
void boot();
