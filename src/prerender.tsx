import { renderToString } from 'react-dom/server';
import { App, preloadPublicPage } from './app/App';
import type { PublicPageState } from './shared/prerender';

export async function render(state: PublicPageState) {
  await preloadPublicPage(state.path);
  return renderToString(<App initialPage={state}/>);
}
