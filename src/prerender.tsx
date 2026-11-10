import { renderToString } from 'react-dom/server';
import { loadUiLocale } from './locales';
import { App, preloadPublicPage } from './app/App';
import type { PublicPageState } from './shared/prerender';

export async function render(state: PublicPageState) {
  await Promise.all([preloadPublicPage(state.path), loadUiLocale(state.locale ?? 'en')]);
  return renderToString(<App initialPage={state}/>);
}
