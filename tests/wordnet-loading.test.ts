import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

function dictionary(failForms = false) {
  const requested: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    requested.push(url);
    if (url.endsWith('forms.json')) return new Response(JSON.stringify({ sat: ['sit'], went: ['go'] }), { status: failForms ? 503 : 200 });
    const payload = url.endsWith('pos-s.json') ? { sat: 1, sit: 10 << 4 }
      : url.endsWith('pos-g.json') ? { go: 10 << 4 } : {};
    return new Response(JSON.stringify(payload), { status: 200 });
  }));
  return requested;
}

it('loads irregular readings even when the surface form already has a noun entry', async () => {
  const requested = dictionary();
  const { loadWordNetPos } = await import('../src/shared/wordnet-pos');
  const lookup = await loadWordNetPos(['sat']);
  expect(lookup?.('sat')).toEqual([['noun', 1], ['verb', 10]]);
  expect(requested.some(url => url.endsWith('forms.json'))).toBe(true);
});

it('loads a cross-letter lemma at a sentence punctuation boundary', async () => {
  dictionary();
  const { loadWordNetPos } = await import('../src/shared/wordnet-pos');
  const lookup = await loadWordNetPos(['went.']);
  expect(lookup?.('went')).toEqual([['verb', 10]]);
});

it('retains direct readings when the optional inflection resource fails', async () => {
  dictionary(true);
  const { loadWordNetPos } = await import('../src/shared/wordnet-pos');
  const lookup = await loadWordNetPos(['sat']);
  expect(lookup?.('sat')).toEqual([['noun', 1]]);
});
