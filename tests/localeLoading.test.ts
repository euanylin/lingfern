import { expect, it, vi } from 'vitest';

it('keeps existing labels and interpolation live after loading another interface language', async () => {
  vi.resetModules();
  const { messages, loadUiLocale, languagePacks } = await import('../src/locales');
  const labels = messages('app'), counts = messages('practiceCard', { p0: 2, p1: 7 });
  expect(labels.fr.today).toBe(languagePacks.en.app.today);
  await Promise.all([loadUiLocale('fr'), loadUiLocale('fr')]);
  expect(labels.fr.today).toBe(languagePacks.fr.app.today);
  expect(counts.fr.progress).toBe(languagePacks.fr.practiceCard.progress.replace('{p0}', '2').replace('{p1}', '7'));
  expect(labels.en.today).toBe(languagePacks.en.app.today);
});
