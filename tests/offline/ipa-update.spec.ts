import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const path = '/ipa/audio/now.mp3';
const original = readFileSync('public' + path);
for (const damaged of [false, true]) test(`an updated IPA catalogue ${damaged ? 'rejects damaged' : 'retains unchanged'} recordings from an older installed package`, async ({ page, context }) => {
  await page.goto('/today');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await expect.poll(() => page.evaluate(async () => !!await (await caches.open('lingfern-resource-catalogue')).match('/resources/catalogue.json'))).toBe(true);
  await page.evaluate(async ({ path, damaged }) => {
    const bytes = new Uint8Array(await (await fetch(path)).arrayBuffer());
    if (damaged) bytes[Math.floor(bytes.length / 2)] ^= 1;
    const cache = await caches.open('lingfern-public-ipa-0000000000000000');
    await cache.put('/offline-complete-ipa-0000000000000000', new Response('0000000000000000'));
    await cache.put(path, new Response(bytes, { headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(bytes.length) } }));
  }, { path, damaged });
  await context.setOffline(true);
  const result = await page.evaluate(async path => {
    try {
      const response = await fetch(path);
      return { ok: response.ok, bytes: [...new Uint8Array(await response.arrayBuffer())] };
    } catch { return { ok: false, bytes: [] }; }
  }, path);
  if (damaged) expect(result.ok).toBe(false);
  else {
    expect(result.ok).toBe(true);
    expect(createHash('sha256').update(new Uint8Array(result.bytes)).digest('hex')).toBe(createHash('sha256').update(original).digest('hex'));
    const partial = await page.evaluate(async path => {
      const response = await fetch(path, { headers: { Range: 'bytes=0-15' } });
      return { status: response.status, bytes: [...new Uint8Array(await response.arrayBuffer())] };
    }, path);
    expect(partial.status).toBe(206);
    expect(partial.bytes).toEqual([...original.subarray(0, 16)]);
  }
});
