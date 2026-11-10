import { expect, it } from 'vitest';
import { canonicalPagePath, pageRoute } from '../src/shared/pageRoutes';

it('canonicalizes only known pages, leaving resources and protocol paths alone', () => {
  for (const path of ['/introduction', '/start', '/today', '/progress', '/library', '/library/dictionary', '/library/saved', '/library/ipa', '/library/grammar', '/library/history', '/settings', '/settings/about', '/learn/valid-session']) {
    expect(pageRoute(path)).toBe(true);
    expect(canonicalPagePath(path + '/')).toBe(path);
    expect(canonicalPagePath(path)).toBeUndefined();
  }
  for (const path of ['/', '/missing/', '/today//', '/library/missing/', '/api/', '/oauth/', '/mcp/', '/.well-known/test/', '/icon.svg/', '/learn/id/extra/']) expect(canonicalPagePath(path)).toBeUndefined();
});
