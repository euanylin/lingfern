import { seoHead } from '../shared/seo';

export function updatePageMetadata(pathname: string, search: string) {
  const template = document.createElement('template');
  template.innerHTML = seoHead(pathname, search);
  document.head.querySelectorAll('[data-lingfern-seo]').forEach(element => element.remove());
  document.head.appendChild(template.content);
}
