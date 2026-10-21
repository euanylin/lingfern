import { expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OfflineInstall } from '../src/app/OfflineInstall';

// Check async installation readiness in production browsers, not SSR.
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return { ...actual, useState: <T,>(initial: T) => actual.useState(initial === true ? false : initial) };
});

it('renders the existing recording downloads after readiness in every locale outside fixture mode', () => {
  expect(import.meta.env.MODE).not.toBe('test-fixtures');
  const names = {
    'zh-Hans': ['A1 单词录音', 'A2 听力录音', 'B1 听力录音', 'C2 听力录音'],
    'zh-Hant': ['A1 單字錄音', 'A2 聽力錄音', 'B1 聽力錄音', 'C2 聽力錄音'],
    en: ['A1 word audio', 'A2 listening audio', 'B1 listening audio', 'C2 listening audio'],
  };
  for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
    const html = renderToStaticMarkup(createElement(OfflineInstall, { profileId: 'isolated-install-test', locale, online: true, onReady: () => undefined }));
    for (const name of names[locale]) expect(html).toContain(`aria-label="${name}"`);
  }
});
