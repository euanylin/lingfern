import { afterEach, expect, test, vi } from 'vitest';
import fc from 'fast-check';
import { questionSheetSize } from '../src/app/useQuestionSheetLayout';
import { cardActivity } from '../src/app/cardInteraction';

afterEach(() => vi.useRealTimers());

test('sheet height is continuous, bounded and retains the ordinary initial height', () => {
  expect(questionSheetSize(812, 64).height).toBeCloseTo(812 * .7);
  expect(questionSheetSize(812, 64, 431.375).height).toBe(431.375);
  expect(questionSheetSize(812, 64, 10000).height).toBe(724);
  expect(questionSheetSize(300, 64, 431.375).height).toBe(212);
  expect(questionSheetSize(812, 64, 431.375).height).toBe(431.375);
  fc.assert(fc.property(fc.integer({ min: 0, max: 2000 }), fc.integer({ min: 0, max: 2000 }), fc.integer({ min: -10000, max: 10000 }), (viewport, header, requested) => {
    const size = questionSheetSize(viewport, header, requested);
    expect(size.height).toBeGreaterThanOrEqual(size.minimum);
    expect(size.height).toBeLessThanOrEqual(size.maximum);
    expect(size.maximum).toBe(Math.max(0, viewport - header - 24));
  }));
});

test('pressing and momentum scrolling blur only until interaction becomes idle', () => {
  vi.useFakeTimers();
  const changed = vi.fn(), activity = cardActivity(changed);
  expect(changed).not.toHaveBeenCalled();
  activity.start(); vi.advanceTimersByTime(500);
  expect(changed).toHaveBeenLastCalledWith(true);
  activity.end(); vi.advanceTimersByTime(100); activity.pulse();
  vi.advanceTimersByTime(119); expect(changed).toHaveBeenLastCalledWith(true);
  vi.advanceTimersByTime(1); expect(changed).toHaveBeenLastCalledWith(false);
  activity.pulse(); activity.scrollEnd(); expect(changed).toHaveBeenLastCalledWith(false);
});

test('editing cancels pointer blur and stale idle callbacks', () => {
  vi.useFakeTimers();
  const changed = vi.fn(), activity = cardActivity(changed);
  activity.start(); activity.end(); activity.cancel();
  expect(changed).toHaveBeenLastCalledWith(false);
  changed.mockClear(); activity.end(); vi.advanceTimersByTime(500);
  expect(changed).not.toHaveBeenCalled();
  activity.pulse(); activity.dispose(); changed.mockClear(); vi.advanceTimersByTime(500);
  expect(changed).not.toHaveBeenCalled();
});
