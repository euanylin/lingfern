import { expect, test } from '@playwright/test';
import { confirmTask } from './task-start';
import { selectPicker } from './picker';
import { languagePacks } from '../../src/locales';

async function counts(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const { sessions, exposures } = await import('/src/data/db.ts' as string);
    return { sessions: await sessions.count(), exposures: await exposures.count() };
  });
}

test('task details confirm metadata without starting, exposing passages or playing audio', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/today');
  const before = await counts(page);
  const media: string[] = [];
  page.on('request', request => { if (request.url().includes('/audio/')) media.push(request.url()); });
  const row = page.locator('.task-row').filter({ has: page.getByRole('heading', { name: '听懂临时变动' }) });
  const trigger = row.getByRole('button', { name: '开始听力' });
  // Check keyboard focus return; Safari pointer clicks may not focus buttons.
  await trigger.focus();
  await trigger.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('opacity', '1');
  await expect(dialog).toHaveCSS('width', '520px');
  await expect(dialog.getByRole('button', { name: '关闭', exact: true })).toBeFocused();
  await expect(dialog).toContainText('Kokoro-82M');
  await expect(dialog).toContainText('合成语音');
  await expect(dialog.locator('.task-detail-body > dl').first().locator('dt')).toHaveText(['题型', '音频']);
  await expect(dialog).not.toContainText('预计用时');
  await expect(dialog).not.toContainText('学习中可暂停');
  await expect(dialog).not.toContainText('资源大小');
  await expect(dialog.locator('audio')).toHaveCount(0);
  await expect(dialog.locator('.primary')).toHaveCount(1);
  expect(await counts(page)).toEqual(before);
  expect(media.length).toBeGreaterThan(0);
  await expect(dialog.locator('audio')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await counts(page)).toEqual(before);
  await trigger.click();
  await expect(dialog).toHaveCSS('opacity', '1');
  for (const width of [1440, 1200, 1024, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 812 });
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    if (width < 768) await expect(dialog).toHaveCSS('width', `${width}px`);
    await page.screenshot({ path: `output/playwright/task-detail-${width}-light-zh-Hans.png` });
  }
  await dialog.getByRole('button', { name: '关闭' }).click();
  await trigger.click();
  await confirmTask(page);
  await expect(page).toHaveURL(/\/learn\//);
  expect((await counts(page)).sessions).toBe(before.sessions + 1);
});

test('task detail remains usable in three languages, dark theme, short screens and enlarged text', async ({ page }) => {
  await page.goto('/settings');
  await selectPicker(page, languagePacks['zh-Hans'].app.theme, 'dark');
  for (const locale of ['en', 'zh-Hant', 'zh-Hans'] as const) {
    await page.goto('/settings');
    const currentLabel = await page.getByRole('button', { name: /^(语言|語言|Language):/ }).getAttribute('aria-label');
    await selectPicker(page, currentLabel!, locale);
    await expect(page.getByRole('button', { name: languagePacks[locale].app.theme }).and(page.locator('.setting-trigger'))).toHaveAttribute('data-value', 'dark');
    await page.setViewportSize({ width: 320, height: 500 });
    await page.goto('/today');
    const title = { en: 'Preserve disagreement and responsibility', 'zh-Hant': '保留分歧與責任', 'zh-Hans': '保留分歧与责任' }[locale];
    await page.locator('.task-row').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).getByRole('button').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS('opacity', '1');
    await expect(dialog.locator('.task-detail-body > dl').first().locator('dt')).toHaveText([languagePacks[locale].taskDetail.types]);
    await expect(dialog).not.toContainText(/Estimated time|预计用时|預計用時/);
    await page.evaluate(() => document.documentElement.style.fontSize = '200%');
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await dialog.locator('button.primary').scrollIntoViewIfNeeded();
    await expect(dialog.locator('button.primary')).toBeVisible();
    await page.screenshot({ path: `output/playwright/task-detail-320x500-dark-${locale}-200percent.png` });
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.documentElement.style.fontSize = '');
  }
});

test('uninstalled offline audio opens metadata with a library action and creates no session', async ({ page, context }) => {
  await page.goto('/today');
  await expect(page.locator('.task-row').filter({ has: page.getByRole('heading', { name: '听懂临时变动' }) })).toBeVisible();
  const before = await counts(page);
  await context.setOffline(true);
  await page.locator('.task-row').filter({ has: page.getByRole('heading', { name: '听懂临时变动' }) }).getByRole('button', { name: '下载内容' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('合成语音');
  await expect(dialog.getByRole('link', { name: '下载内容' })).toHaveAttribute('href', '/library');
  await expect(dialog.locator('button.primary')).toHaveCount(0);
  expect(await counts(page)).toEqual(before);
  await context.setOffline(false);
  await expect(dialog.getByRole('button', { name: '开始听力' })).toBeVisible();
  await context.setOffline(true);
  await expect(dialog.locator('button.primary')).toHaveCount(0);
});

test('isolated draft check detail renders metadata only without approving it for the catalogue', async ({ page }) => {
  await page.goto('/today');
  const text = await page.evaluate(async () => {
    const { createElement } = (await import('/node_modules/.vite/deps/react.js' as string)).default;
    const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default;
    const { TaskDetail } = await import('/src/app/TaskDetail.tsx' as string);
    const { default: lesson } = await import('/tests/fixtures/content/a1-check-reading.json' as string);
    const host = document.createElement('div'); document.body.appendChild(host);
    createRoot(host).render(createElement(TaskDetail, { lesson, locale: 'en', profileId: 'local-guest', action: 'Test fixture', available: false, busy: false, startError: '', onStart: async () => {}, onClose: () => {} }));
    return lesson.materials.flatMap((material: { blocks: { text: string }[]; questions: { prompt: string; options: string[] }[] }) => [...material.blocks.map(block => block.text), ...material.questions.flatMap(question => [question.prompt, ...question.options])]);
  });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('opacity', '1');
  await expect(dialog).toContainText('Question types');
  await expect(dialog).toContainText('Multiple choice');
  const rendered = await dialog.innerText();
  for (const hidden of text) expect(rendered).not.toContain(hidden);
  await expect(dialog.locator('audio')).toHaveCount(0);
});

test('independent listening check retains its playback and preview restriction', async ({ page }) => {
  await page.goto('/today');
  await page.evaluate(async () => {
    const { createElement } = (await import('/node_modules/.vite/deps/react.js' as string)).default;
    const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default;
    const { TaskDetail } = await import('/src/app/TaskDetail.tsx' as string);
    const { default: lessons } = await import('/tests/fixtures/retired-content/voa-listening-checks.json' as string);
    const host = document.createElement('div'); document.body.appendChild(host);
    createRoot(host).render(createElement(TaskDetail, { lesson: lessons[0], locale: 'en', profileId: 'local-guest', action: 'Test fixture', available: false, busy: false, startError: '', onStart: async () => {}, onClose: () => {} }));
  });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(languagePacks.en.taskDetail.check);
  await expect(dialog.locator('audio,.passage')).toHaveCount(0);
});

test('combined preview omits both estimates while retaining actual audio duration', async ({ page }) => {
  await page.goto('/today');
  const seconds = await page.evaluate(async () => {
    const { createElement } = (await import('/node_modules/.vite/deps/react.js' as string)).default;
    const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default;
    const { TaskDetail } = await import('/src/app/TaskDetail.tsx' as string);
    const { default: lesson } = await import('/tests/fixtures/content/a1-reading.json' as string);
    const { default: additionalLesson } = await import('/tests/fixtures/content/a1-listening.json' as string);
    const host = document.createElement('div'); document.body.appendChild(host);
    createRoot(host).render(createElement(TaskDetail, { lesson, additionalLesson, locale: 'en', profileId: 'local-guest', action: 'Practice', available: true, busy: false, startError: '', onStart: async () => {}, onClose: () => {} }));
    return Math.round(additionalLesson.materials.reduce((sum: number, material: { audio?: { duration: number } }) => sum + (material.audio?.duration ?? 0), 0));
  });
  const dialog = page.getByRole('dialog');
  await expect(dialog).not.toContainText(/Estimated time|预计用时|預計用時/);
  await expect(dialog.locator('section dl dt')).toHaveText(languagePacks.en.taskDetail.audio);
  await expect(dialog.locator('section dl dd')).toContainText(`${seconds} ${languagePacks.en.taskDetail.seconds}`);
  await expect(dialog.locator('audio,.passage')).toHaveCount(0);
});

test('community preview reads each owner once while retaining every media and profile check', async ({ page }) => {
  await page.goto('/today');
  const count = await page.evaluate(async () => {
    const { createElement } = (await import('/node_modules/.vite/deps/react.js' as string)).default;
    const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default;
    const { TaskDetail } = await import('/src/app/TaskDetail.tsx' as string);
    const { communityPacks } = await import('/src/data/db.ts' as string);
    const { default: raw } = await import('/tests/fixtures/content/a1-listening.json' as string);
    const hash = 'd'.repeat(64), profileId = 'synthetic-preview-profile', lesson = structuredClone(raw);
    lesson.communityPackageId = hash; lesson.sourceId = `community:${hash}:synthetic`;
    lesson.materials.forEach((material: { audio: { src: string } }, index: number) => { material.audio.src = `/audio/community-${hash}/synthetic-${index}.mp3`; });
    const pack = { profileId, hash, id: 'synthetic-preview', lessons: [], sources: [{ id: 'synthetic', title: 'Synthetic source', author: 'Synthetic author', license: 'CC0' }], state: 'ready', installedAt: '2026-10-25T00:00:00Z' };
    await communityPacks.put(pack);
    const cache = await caches.open(`lingfern-community-${hash}`);
    for (const material of lesson.materials) await cache.put(material.audio.src, new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'audio/mpeg' } }));
    const get = communityPacks.get.bind(communityPacks), match = Cache.prototype.match;
    Reflect.set(window, 'previewReads', { owners: 0, media: 0 });
    communityPacks.get = (key: unknown) => { if (Array.isArray(key) && key[0] === profileId && key[1] === hash) Reflect.get(window, 'previewReads').owners++; return get(key); };
    Cache.prototype.match = async function (...args) {
      const response = await match.apply(this, args);
      if (response && String(args[0]).includes(hash)) { const blob = response.blob.bind(response); response.blob = () => { Reflect.get(window, 'previewReads').media++; return blob(); }; }
      return response;
    };
    const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
    const mount = (key: string) => root.render(createElement(TaskDetail, { key, lesson, locale: 'en', profileId, action: 'Synthetic start', available: true, busy: false, startError: '', onStart: async () => {}, onClose: () => root.unmount() }));
    Reflect.set(window, 'changePreview', async (state: string) => {
      if (state === 'missing') await cache.delete(lesson.materials[0].audio.src);
      else { await communityPacks.delete([profileId, hash]); await communityPacks.put({ ...pack, profileId: 'other-synthetic-profile' }); }
      mount(state);
    });
    mount('ready'); return lesson.materials.length;
  });
  const dialog = page.getByRole('dialog'), start = dialog.getByRole('button', { name: 'Synthetic start', exact: true });
  await expect(start).toBeEnabled();
  expect(await page.evaluate(() => Reflect.get(window, 'previewReads'))).toEqual({ owners: 1, media: count });
  await expect(dialog).toContainText('Synthetic source');
  await page.evaluate(() => Reflect.get(window, 'changePreview')('missing'));
  await expect(dialog.locator('.error')).toBeVisible(); await expect(start).toBeDisabled();
  await page.evaluate(() => Reflect.get(window, 'changePreview')('different-owner'));
  await expect(dialog.locator('.error')).toBeVisible(); await expect(start).toBeDisabled();
});

test('closing preview aborts pending media and failed media responses release their bodies', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/today');
  const count = await page.evaluate(async () => {
    const { createElement } = (await import('/node_modules/.vite/deps/react.js' as string)).default;
    const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default;
    const { TaskDetail } = await import('/src/app/TaskDetail.tsx' as string);
    const { default: lesson } = await import('/tests/fixtures/content/a1-listening.json' as string);
    const media = new Set(lesson.materials.map((material: { audio: { src: string } }) => material.audio.src)), fetchMedia = window.fetch;
    Reflect.set(window, 'previewNetwork', { requests: 0, aborted: 0, cancelled: 0, fail: false });
    window.fetch = async (input, init) => {
      if (!media.has(String(input))) return fetchMedia(input, init);
      const state = Reflect.get(window, 'previewNetwork'); state.requests++;
      if (state.fail) return new Response(new ReadableStream({ cancel() { state.cancelled++; } }), { status: 503 });
      return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => { state.aborted++; reject(init.signal!.reason); }, { once: true }));
    };
    const mount = () => {
      const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
      root.render(createElement(TaskDetail, { lesson, locale: 'en', profileId: 'local-guest', action: 'Synthetic start', available: true, busy: false, startError: '', onStart: async () => {}, onClose: () => { root.unmount(); host.remove(); } }));
    };
    Reflect.set(window, 'mountPreview', mount); mount(); return lesson.materials.length;
  });
  const dialog = page.getByRole('dialog');
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'previewNetwork').requests)).toBe(count);
  await expect(dialog.getByRole('button', { name: 'Synthetic start', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click(); await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, 'previewNetwork').aborted)).toBe(count);
  await page.evaluate(() => { Reflect.get(window, 'previewNetwork').fail = true; Reflect.get(window, 'mountPreview')(); });
  await expect(dialog.locator('.error')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Synthetic start', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => Reflect.get(window, 'previewNetwork').cancelled)).toBe(count);
  expect(errors).toEqual([]);
});
