import { messages } from '../locales';
import type { Locale } from '../shared/locale';
import '../../public/404.css';

export function NotFound({ locale }: { locale: Locale }) {
  const copy = messages('notFound')[locale];
  return <div className="not-found-copy"><p className="eyebrow" dir="ltr">404</p><h1>{copy.title}</h1><p className="not-found-description">{copy.description}</p><a className="button primary" href="/today">{messages('app')[locale].finish}</a></div>;
}
