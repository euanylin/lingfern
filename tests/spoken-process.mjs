import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { prose } from '../scripts/spoken-process.mjs';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ offline: true });
  const page = await context.newPage();
  const result = await page.evaluate(prose, '<html><head><title>Original article</title></head><body><script>globalThis.executed = true</script><table><tr><td>Sidebar</td></tr></table><p>Original &amp; exact words.<sup class="reference">[1]</sup></p><h2>History</h2><ul><li>First event<ul><li>Nested event</li></ul></li><li>Second event</li></ul><h2>References</h2><p>Excluded bibliography</p></body></html>');
  assert.equal(result.title, 'Original article');
  assert.equal(result.text, 'Original & exact words.\n\nHistory\n\nFirst event Nested event\n\nSecond event');
  assert.equal(await page.evaluate(() => globalThis.executed), undefined);
  assert(!result.text.includes('Sidebar'));
  console.log('Offline inert HTML processing preserves source prose and excludes scripts, sidebar and bibliography.');
} finally { await browser.close(); }
