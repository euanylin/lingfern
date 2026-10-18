import { expect, it } from 'vitest';
import { pickerMenuPosition } from '../src/app/SettingsPicker';

it('opens below the trigger with a four pixel gap and right alignment', () => {
  expect(pickerMenuPosition({ top: 100, right: 320, height: 44 }, { width: 160, height: 180 }, { left: 0, top: 0, width: 375, height: 667 })).toEqual({ left: 160, top: 148 });
});

it('clamps menus wider than the trigger inside both viewport edges', () => {
  const popup = { width: 240, height: 300 }, viewport = { left: 0, top: 0, width: 375, height: 667 };
  expect(pickerMenuPosition({ top: 100, right: 120, height: 44 }, popup, viewport)).toEqual({ left: 8, top: 148 });
  expect(pickerMenuPosition({ top: 100, right: 500, height: 44 }, popup, viewport)).toEqual({ left: 127, top: 148 });
});

it('flips above when the full menu cannot fit below, keeping a four pixel gap', () => {
  const viewport = { left: 0, top: 0, width: 375, height: 400 };
  expect(pickerMenuPosition({ top: 320, right: 300, height: 44 }, { width: 240, height: 180 }, viewport)).toEqual({ left: 60, top: 136 });
});

it('clamps vertical edges if neither placement fits and keeps an offscreen trigger bounded', () => {
  const viewport = { left: 0, top: 0, width: 375, height: 400 }, popup = { width: 240, height: 280 };
  expect(pickerMenuPosition({ top: 100, right: 300, height: 44 }, popup, viewport).top).toBe(8);
  expect(pickerMenuPosition({ top: 500, right: 300, height: 44 }, popup, viewport).top).toBe(112);
  expect(pickerMenuPosition({ top: -100, right: 300, height: 44 }, popup, viewport).top).toBe(8);
});

it('fits an exact bottom margin without flipping', () => {
  expect(pickerMenuPosition({ top: 100, right: 300, height: 44 }, { width: 160, height: 244 }, { left: 0, top: 0, width: 375, height: 400 }).top).toBe(148);
});

it('uses reduced visual viewport offsets for zoom and keyboard bounds', () => {
  const viewport = { left: 80, top: 120, width: 260, height: 300 };
  const point = pickerMenuPosition({ top: 360, right: 500, height: 44 }, { width: 240, height: 220 }, viewport);
  expect(point).toEqual({ left: 92, top: 136 });
  expect(point.left + 240).toBeLessThanOrEqual(viewport.left + viewport.width - 8);
  expect(point.top + 220).toBeLessThanOrEqual(viewport.top + viewport.height - 8);
});
