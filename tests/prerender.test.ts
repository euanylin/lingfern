import { expect, it } from 'vitest';
import { extractPublicStyles } from '../scripts/prerender';
import { publicPageStateSchema } from '../src/shared/prerender';
import { prerenderPath, publicPages } from '../src/shared/seo';

it('keeps public hydration state scoped to known public routes and valid dates', () => {
  for (const path of Object.keys(publicPages)) {
    expect(publicPageStateSchema.parse({ path, day: '2026-10-26' }).path).toBe(path);
    expect(prerenderPath(path)).toBe(`/prerender${path}.html.txt`);
  }
  for (const path of ['/settings', '/learn/private-record', '/missing']) {
    expect(publicPageStateSchema.safeParse({ path, day: '2026-10-26' }).success).toBe(false);
    expect(prerenderPath(path)).toBeUndefined();
  }
  expect(publicPageStateSchema.safeParse({ path: '/introduction', day: '2026-02-30' }).success).toBe(false);
  expect(publicPageStateSchema.safeParse({ path: '/introduction', day: '2026-10-26', profileId: 'private' }).success).toBe(false);
});

it('extracts exact static style values without inline CSS, duplicate rules or malformed void elements', () => {
  const source = '<div class="existing" style="visibility:hidden"><input style="visibility:hidden"/><svg style="width:0.5em"></svg></div>';
  const { html, css } = extractPublicStyles(source);
  expect(html).not.toMatch(/\sstyle="/);
  expect(html).toContain(' existing');
  expect(html).toMatch(/<input data-public-style="visibility:hidden" class="public-style-[a-f0-9]+"\/>/);
  expect(html).toContain('data-public-style="width:0.5em"');
  expect(css.match(/visibility:hidden/g)).toHaveLength(1);
  expect(css).toContain('width:0.5em');
  expect(extractPublicStyles('<p>Plain body</p>')).toEqual({ html: '<p>Plain body</p>', css: '' });
  expect(() => extractPublicStyles('<p style="content:&quot;quoted&quot;">')).toThrow('PUBLIC_STYLE_ENCODING');
});
