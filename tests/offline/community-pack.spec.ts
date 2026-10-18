import { confirmTask } from '../browser/task-start';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { zipSync } from 'fflate';
const reading = JSON.parse(readFileSync('tests/fixtures/content/a1-reading.json', 'utf8')) as { id: string; sourceId: string; title: Record<string, string>; materials: { title: string; [key: string]: unknown }[] };
const listening = JSON.parse(readFileSync('tests/fixtures/content/a1-listening.json', 'utf8')) as { sourceId: string; materials: { audio: { src: string; sha256: string } }[] };

const encoder = new TextEncoder();
const sha = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))), byte => byte.toString(16).padStart(2, '0')).join('');

async function makeZip(corrupt: false | 'manifest' | 'media' | 'image' = false) {
  const audio = Object.fromEntries(listening.materials.map((material, index) => [`media/word-${index + 1}.mp3`, new Uint8Array(readFileSync(`public${material.audio.src}`))]));
  const image = new Uint8Array(readFileSync('public/icon-192.png'));
  if (corrupt === 'image') image[image.length - 20] ^= 1;
  if (corrupt === 'media') audio['media/word-1.mp3'] = encoder.encode('ID3not a recording');
  const badAudioHash = corrupt === 'media' ? await sha(audio['media/word-1.mp3']) : '';
  const illustration = { src: 'media/illustration.png', sha256: await sha(image), alt: { 'zh-Hans': '示例插图', 'zh-Hant': '示例插圖', en: 'Example illustration' }, sourceId: reading.sourceId };
  const lessons = [{ ...reading, materials: reading.materials.map((material, index) => index ? material : { ...material, illustration }) }, { ...listening, materials: listening.materials.map((material, index) => ({ ...material, audio: { ...material.audio, src: `media/word-${index + 1}.mp3`, sha256: index === 0 && corrupt === 'media' ? badAudioHash : material.audio.sha256 } })) }];
  const files: Record<string, Uint8Array> = {
    'lessons.json': encoder.encode(JSON.stringify(lessons)),
    'sources.json': encoder.encode(JSON.stringify([
      { id: reading.sourceId, title: 'Meeting messages', author: 'Example author', license: 'Private use', attribution: 'Example author' },
      { id: listening.sourceId, title: 'Word recordings', author: 'Dvortygirl', license: 'CC BY-SA 3.0', attribution: 'Dvortygirl / Wikimedia Commons' },
    ])),
    'dictionary.json': encoder.encode(JSON.stringify([{ term: 'ferncourseword', definition: 'A word used only in this private course.', example: 'This ferncourseword stays local.', sourceId: reading.sourceId }])),
    'media/illustration.png': image,
    ...audio,
  };
  const manifest = { format: 'lingfern-community-content', version: 1, id: 'sample-course', language: 'en', levels: ['A1'], materialCount: 6, files: Object.fromEntries(await Promise.all(Object.entries(files).map(async ([name, bytes]) => [name, { bytes: bytes.length, sha256: await sha(bytes) }]))) };
  if (corrupt === 'manifest') files['sources.json'] = encoder.encode('[]');
  return Buffer.from(zipSync({ ...files, 'manifest.json': encoder.encode(JSON.stringify(manifest)) }));
}

test('imports community lessons with offline image and audio, and rejects damaged updates', async ({ page, context }) => {
  await page.goto('/library');
  await page.getByLabel('导入 ZIP').setInputFiles({ name: 'sample.zip', mimeType: 'application/zip', buffer: await makeZip() });
  await expect(page.locator('.community-import [role=status]')).toContainText('资源已安装', { timeout: 60_000 });
  await expect(page.locator('.community-import input[type=file]')).toHaveCount(1);
  await expect(page.locator('.resource-pack-tools input[type=file]')).toHaveCount(0);
  const installed = page.locator('.installed-resources');
  await expect(installed).not.toHaveAttribute('open');
  expect(await installed.evaluate(element => element.nextElementSibling?.classList.contains('community-import'))).toBe(true);
  await installed.locator(':scope > summary').click();
  await expect(page.getByText('sample-course')).toBeVisible();
  await expect(page.getByText('1 条词义', { exact: false })).toBeVisible();
  await page.goto('/today');
  const community = page.locator('.task-catalogue-list .community-task');
  await expect(community).toHaveCount(2);
  await expect(community.first()).toContainText('私人或社区课程');
  await community.filter({ has: page.getByRole('heading', { name: reading.title['zh-Hans'], exact: true }) }).getByRole('button').click();
  await confirmTask(page);
  await expect(page).toHaveURL(/\/learn\//);
  await expect(page.getByRole('heading', { name: reading.materials[0].title, level: 1, exact: true })).toBeVisible();
  await expect(page.locator('.session-title')).toHaveCount(0);
  const readingUrl = page.url();
  const illustration = page.getByRole('img', { name: '示例插图' });
  await expect(illustration).toBeVisible();
  await expect.poll(() => illustration.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(192);
  const imageUrl = await illustration.getAttribute('src');
  await page.goto('/library');
  await page.getByLabel('导入 ZIP').setInputFiles({ name: 'bad.zip', mimeType: 'application/zip', buffer: await makeZip('manifest') });
  await expect(page.getByRole('status').filter({ hasText: '资源包无效' })).toContainText('资源包无效');
  await page.getByLabel('导入 ZIP').setInputFiles({ name: 'silent.zip', mimeType: 'application/zip', buffer: await makeZip('media') });
  await expect(page.getByRole('status').filter({ hasText: '资源包无效' })).toContainText('资源包无效');
  await page.getByLabel('导入 ZIP').setInputFiles({ name: 'broken-image.zip', mimeType: 'application/zip', buffer: await makeZip('image') });
  await expect(page.getByRole('status').filter({ hasText: '资源包无效' })).toContainText('资源包无效');
  await page.locator('.installed-resources > summary').click();
  await expect(page.getByText('sample-course')).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await context.setOffline(true);
  await page.goto(readingUrl);
  await expect(page.getByRole('img', { name: '示例插图' })).toBeVisible();
  await expect.poll(() => page.getByRole('img', { name: '示例插图' }).evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(192);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const picture = await page.evaluate(async src => { const response = await fetch(src!); return { status: response.status, type: response.headers.get('Content-Type'), bytes: (await response.arrayBuffer()).byteLength }; }, imageUrl);
  expect(picture.status).toBe(200);
  expect(picture.type).toBe('image/png');
  expect(picture.bytes).toBeGreaterThan(1000);
  await page.goto('/today');
  await expect(page.locator('.task-catalogue-list .community-task')).toHaveCount(2);
  const url = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('lingfern'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const record = await new Promise<{ lessons: { skill: string; materials: { audio?: { src: string } }[] }[] }>((resolve, reject) => { const request = database.transaction('communityPacks').objectStore('communityPacks').getAll(); request.onsuccess = () => resolve(request.result[0]); request.onerror = () => reject(request.error); });
    database.close();
    return record.lessons.find(lesson => lesson.skill === 'listening')!.materials[0].audio!.src;
  });
  const result = await page.evaluate(async src => { const response = await fetch(src); return { status: response.status, bytes: (await response.arrayBuffer()).byteLength }; }, url);
  expect(result.status).toBe(200);
  expect(result.bytes).toBeGreaterThan(1000);
  await page.goto('/library/dictionary');
  await page.getByRole('combobox', { name: '查询单词或短语' }).fill('ferncourseword');
  await expect(page.locator('.dictionary-suggestions [role=option]').first()).toHaveText('ferncourseword');
  await page.getByRole('option', { name: 'ferncourseword', exact: true }).click();
  await expect(page.getByText('A word used only in this private course.')).toBeVisible();
  await expect(page.getByText('Meeting messages', { exact: false })).toBeVisible();
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('lingfern'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(['profiles', 'settings'], 'readwrite');
      tx.objectStore('profiles').put({ id: 'another-profile', name: 'Another profile', createdAt: new Date().toISOString() });
      tx.objectStore('settings').put({ key: 'activeProfile', value: 'another-profile' });
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
    database.close();
  });
  await page.reload();
  await expect(page.locator('.task-catalogue-list .community-task')).toHaveCount(0);
  await page.goto('/library');
  await expect(page.getByText('sample-course')).toHaveCount(0);
  await page.goto('/library/dictionary');
  await page.getByRole('combobox', { name: '查询单词或短语' }).fill('ferncourseword');
  await page.getByRole('combobox', { name: '查询单词或短语' }).press('Enter');
  await expect(page.getByText('A word used only in this private course.')).toHaveCount(0);
});


test('learning popup retains installed course meanings when the general dictionary is unavailable', async ({ page, context }) => {
  await page.goto('/library');
  await page.getByLabel('导入 ZIP').setInputFiles({ name: 'sample.zip', mimeType: 'application/zip', buffer: await makeZip() });
  await expect(page.getByRole('status').filter({ hasText: '资源已安装' })).toBeVisible();
  await page.reload();
  await context.setOffline(true);
  await page.goto('/today');
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click();
  await confirmTask(page);
  // Isolated DOM selection exercises the popup independently of fixture passage vocabulary.
  await page.locator('.passage').first().evaluate(paragraph => {
    const text = document.createTextNode(' ferncourseword'); paragraph.querySelector('[data-block-text]')!.appendChild(text);
    const range = document.createRange(); range.setStart(text, 1); range.setEnd(text, text.length);
    getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
  });
  await page.getByRole('button', { name: '查词', exact: true }).click();
  const popup = page.getByRole('dialog', { name: '查词: ferncourseword' });
  await expect(popup.getByText('A word used only in this private course.')).toBeVisible();
  await expect(popup.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: '关闭查词' }).click();
  await page.locator('.passage').first().evaluate(paragraph => {
    const text = document.createTextNode(' badger'); paragraph.querySelector('[data-block-text]')!.appendChild(text);
    const range = document.createRange(); range.setStart(text, 1); range.setEnd(text, text.length);
    getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
  });
  await page.getByRole('button', { name: '查词', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '查词: badger' }).getByRole('alert')).toContainText('词典暂时无法读取');
});
