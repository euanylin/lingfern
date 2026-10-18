import { expect, it, vi } from 'vitest';

it('loads only the requested teaching package, keeps English fallback and reuses successful loads', async () => {
  vi.resetModules();
  const { instructionPacks, loadInstructionLocale, translateInstruction } = await import('../src/locales/teaching');
  expect(Object.keys(instructionPacks)).toEqual([]);
  await loadInstructionLocale('en');
  await loadInstructionLocale('zh-Hans');
  expect(Object.keys(instructionPacks)).toEqual([]);
  await loadInstructionLocale('ar');
  expect(Object.keys(instructionPacks)).toEqual(['ar']);
  const pack = instructionPacks.ar;
  expect(translateInstruction('Listen again.', 'ar')).toBe(pack!['Listen again.']);
  expect(translateInstruction('Unknown private sentence.', 'ar')).toBe('Unknown private sentence.');
  await loadInstructionLocale('ar');
  expect(instructionPacks.ar).toBe(pack);
});
