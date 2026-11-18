import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { paletteId, paletteIds, paletteOrder } from '../src/shared/palettes';
import { syncSettingSchema } from '../src/shared/sync';

it('keeps exactly 33 validated choices in settings, early boot and styles', () => {
  expect(paletteIds).toHaveLength(33);
  expect(new Set(paletteIds).size).toBe(33);
  const script = readFileSync('public/appearance.js', 'utf8');
  const css = readFileSync('public/palettes.css', 'utf8');
  for (const palette of paletteIds) {
    expect(paletteId(palette)).toBe(palette);
    expect(syncSettingSchema.parse({ key: 'palette', value: palette }).value).toBe(palette);
    expect(script).toContain(`"${palette}"`);
    if (palette !== 'original') expect(css).toContain(`[data-palette=${palette}]`);
  }
  expect(syncSettingSchema.safeParse({ key: 'palette', value: 'unknown' }).success).toBe(false);
  expect(paletteId('unknown')).toBe('basic');
});

it.each([null, '{}', '{"palette":"unknown","mode":"invalid"}', '{broken', '{"palette":"original","mode":"dark"}'])('restores only valid first-paint preferences: %s', saved => {
  const dataset: Record<string, string> = {};
  runInNewContext(readFileSync('public/appearance.js', 'utf8'), { document: { documentElement: { dataset } }, localStorage: { getItem: () => saved }, window: { addEventListener: () => {} }, setTimeout: () => {} });
  expect(dataset.theme).toBe(saved?.includes('original') ? 'dark' : 'system');
  expect(dataset.palette).toBe(saved?.includes('original') ? 'original' : 'basic');
});

it('keeps Basic and Fern first and groups muted alternatives within their color families', () => {
  expect(paletteOrder.slice(0, 2)).toEqual(['basic', 'original']);
  expect([...paletteOrder].sort()).toEqual([...paletteIds].sort());
  for (const [before, middle, after] of [['terracotta', 'cocoa', 'amber'], ['amber', 'sand', 'honey'], ['sky', 'slate', 'ocean']]) {
    const order: readonly string[] = paletteOrder;
    expect(order.indexOf(middle)).toBe(order.indexOf(before) + 1);
    expect(order.indexOf(after)).toBe(order.indexOf(middle) + 1);
  }
});
