import { expect, it, vi } from 'vitest';
const loaded = vi.hoisted(() => vi.fn());
vi.mock('../content/corpus/text-review-rules.json', async () => {
  loaded();
  return vi.importActual('../content/corpus/text-review-rules.json');
});
it('loads review rules only when reviewing excerpts and shares concurrent loads without bypassing holds', async () => {
  const { reviewedExcerpts } = await import('../src/data/corpus');
  expect(loaded).not.toHaveBeenCalled();
  const source = { rootId: 'not-a-reviewed-root', sourceHash: '0'.repeat(64), originalText: 'Original sentence.' };
  const excerpts = [{ text: source.originalText }];
  expect(await Promise.all([reviewedExcerpts(source, excerpts), reviewedExcerpts(source, excerpts)])).toEqual([excerpts, excerpts]);
  expect(loaded).toHaveBeenCalledTimes(1);
  const { default: rules } = await import('../content/corpus/text-review-rules.json');
  const review = rules.records[0];
  expect(await reviewedExcerpts({ ...source, rootId: review.rootId }, excerpts)).toEqual([]);
  expect(loaded).toHaveBeenCalledTimes(1);
});
