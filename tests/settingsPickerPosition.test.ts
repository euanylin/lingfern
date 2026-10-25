import { expect, it } from 'vitest';
import { pickerMenuPosition } from '../src/app/SettingsPicker';

it('opens below the trigger with a four pixel gap and right alignment', () => {
  expect(pickerMenuPosition({ left: 40, top: 100, right: 320, height: 44 }, { width: 160, height: 180 }, { left: 0, top: 0, width: 375, height: 667 })).toEqual({ left: 160, top: 148 });
});

it('clamps menus wider than the trigger inside both viewport edges', () => {
  const popup = { width: 240, height: 300 }, viewport = { left: 0, top: 0, width: 375, height: 667 };
  expect(pickerMenuPosition({ left: 40, top: 100, right: 120, height: 44 }, popup, viewport)).toEqual({ left: 8, top: 148 });
  expect(pickerMenuPosition({ left: 40, top: 100, right: 500, height: 44 }, popup, viewport)).toEqual({ left: 127, top: 148 });
});

it('flips above when the full menu cannot fit below, keeping a four pixel gap', () => {
  const viewport = { left: 0, top: 0, width: 375, height: 400 };
  expect(pickerMenuPosition({ left: 40, top: 320, right: 300, height: 44 }, { width: 240, height: 180 }, viewport)).toEqual({ left: 60, top: 136 });
});

it('clamps vertical edges if neither placement fits and keeps an offscreen trigger bounded', () => {
  const viewport = { left: 0, top: 0, width: 375, height: 400 }, popup = { width: 240, height: 280 };
  expect(pickerMenuPosition({ left: 40, top: 100, right: 300, height: 44 }, popup, viewport).top).toBe(8);
  expect(pickerMenuPosition({ left: 40, top: 500, right: 300, height: 44 }, popup, viewport).top).toBe(112);
  expect(pickerMenuPosition({ left: 40, top: -100, right: 300, height: 44 }, popup, viewport).top).toBe(8);
});

it('fits an exact bottom margin without flipping', () => {
  expect(pickerMenuPosition({ left: 40, top: 100, right: 300, height: 44 }, { width: 160, height: 244 }, { left: 0, top: 0, width: 375, height: 400 }).top).toBe(148);
});

it('uses reduced visual viewport offsets for zoom and keyboard bounds', () => {
  const viewport = { left: 80, top: 120, width: 260, height: 300 };
  const point = pickerMenuPosition({ left: 40, top: 360, right: 500, height: 44 }, { width: 240, height: 220 }, viewport);
  expect(point).toEqual({ left: 92, top: 136 });
  expect(point.left + 240).toBeLessThanOrEqual(viewport.left + viewport.width - 8);
  expect(point.top + 220).toBeLessThanOrEqual(viewport.top + viewport.height - 8);
});

it('keeps right-to-left triggers near the left edge inside the dialog clipping region', () => {
  const point = pickerMenuPosition({ left: 40, top: 220, right: 985, height: 44 }, { width: 240, height: 300 }, { left: 920, top: 0, width: 520, height: 900 });
  expect(point).toEqual({ left: 928, top: 268 });
});


it('anchors wide fields to their start edge while preserving compact value alignment', () => {
  const viewport = { left: 0, top: 0, width: 830, height: 780 }, popup = { width: 160, height: 340 };
  const anchor = { left: 332, top: 92, right: 566, height: 68 };
  expect(pickerMenuPosition(anchor, popup, viewport, 'left')).toEqual({ left: 332, top: 164 });
  expect(pickerMenuPosition(anchor, popup, viewport, 'right')).toEqual({ left: 406, top: 164 });
});

it('keeps left-aligned menus inside their scroll surface and reduced visual viewport', () => {
  const viewport = { left: 100, top: 50, width: 300, height: 400 }, popup = { width: 160, height: 180 };
  expect(pickerMenuPosition({ left: 40, top: 100, right: 274, height: 44 }, popup, viewport, 'left')).toEqual({ left: 108, top: 148 });
  expect(pickerMenuPosition({ left: 350, top: 100, right: 584, height: 44 }, popup, viewport, 'left')).toEqual({ left: 232, top: 148 });
});
