import { createRoot } from 'react-dom/client';
import { SettingsPicker } from '../../src/app/SettingsPicker';
import { TreeDiagram } from '../../src/app/TreeDiagram';
import type { Locale } from '../../src/shared/locale';

export function mountPicker(container: HTMLElement) {
  const root = createRoot(container);
  const render = (disabled = false, count = 2) => root.render(<SettingsPicker label="Audit palette" value="basic" disabled={disabled} options={[{ value: 'basic', label: 'Default' }, { value: 'original', label: 'Fern' }].slice(0, count)} onChange={value => { container.dataset.choice = value; }}/>);
  render();
  return render;
}

export function mountTree(container: HTMLElement, profileId: string) {
  const root = createRoot(container);
  const render = (locale: Locale) => root.render(<TreeDiagram locale={locale} profileId={profileId} initialQuery="Audit saved"/>);
  render('zh-Hans');
  return render;
}
