import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const directory = 'private/corpus/spoken/listening-clips';
const index = JSON.parse(await readFile(`${directory}/index.json`, 'utf8'));
const examples = index.records.filter(record => !record.qualityFlags.length).slice(0, 3);
assert.equal(examples.length, 3);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 375, height: 812 } });
const page = await context.newPage();
const errors = [], external = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', route => {
  if (route.request().url().startsWith('http://127.0.0.1:8787/')) return route.continue();
  external.push(route.request().url()); return route.abort();
});
try {
  await page.goto('http://127.0.0.1:8787/today');
  await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  await context.setOffline(true);
  for (const record of examples) {
    const clip = record.clips[0], bytes = await readFile(`${directory}/${clip.file}`);
    await page.evaluate(({ encoded, text }) => {
      document.getElementById('local-clip-check')?.remove();
      const section = document.createElement('section'); section.id = 'local-clip-check'; section.style.paddingBottom = '120px';
      const paragraph = document.createElement('p'); paragraph.textContent = text;
      const audio = document.createElement('audio'); audio.controls = true;
      const raw = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
      audio.src = URL.createObjectURL(new Blob([raw], { type: 'audio/mpeg' }));
      audio.onended = () => { section.dataset.ended = 'true'; URL.revokeObjectURL(audio.src); };
      const button = document.createElement('button'); button.textContent = 'Play local original clip';
      button.onclick = () => { audio.playbackRate = 4; void audio.play(); };
      section.append(paragraph, audio, button); document.body.append(section);
    }, { encoded: bytes.toString('base64'), text: clip.text });
    await page.getByRole('button', { name: 'Play local original clip', exact: true }).click();
    await expect(page.locator('#local-clip-check')).toHaveAttribute('data-ended', 'true', { timeout: clip.duration * 250 + 15000 });
    const actual = await page.locator('#local-clip-check audio').evaluate(audio => ({ duration: audio.duration, ended: audio.ended, error: audio.error?.code }));
    assert(actual.ended && !actual.error && Math.abs(actual.duration - clip.duration) < .2);
    console.log(`Actual offline Chrome playback: ${record.rootId}, ${clip.duration.toFixed(2)}s, ${clip.wordCount} source words. Transcript remains an automatic review candidate.`);
  }
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  console.log('PASS: three distinct original-source clips play to ended offline in isolated Chrome; 今日 renders. This is media preparation acceptance, not a learner-bank or human transcript approval.');
} finally { await context.close(); await browser.close(); }
