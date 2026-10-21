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
  await expect(dialog).toContainText('Kokoro-82M');
  await expect(dialog).toContainText('合成语音');
  await expect(dialog.locator('.task-detail-body > dl').first().locator('dt')).toHaveText(['预计用时', '题型', '音频']);
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
  await dialog.getByRole('button', { name: '关闭详情' }).click();
  await trigger.click();
  await confirmTask(page);
  await expect(page).toHaveURL(/\/learn\//);
  expect((await counts(page)).sessions).toBe(before.sessions + 1);
});

test('task detail remains usable in three languages, dark theme, short screens and enlarged text', async ({ page }) => {
  for (const locale of ['en', 'zh-Hant', 'zh-Hans'] as const) {
    await page.goto('/settings');
    const currentLabel = await page.getByRole('button', { name: /^(语言|語言|Language)$/ }).getAttribute('aria-label');
    await selectPicker(page, currentLabel!, locale);
    await selectPicker(page, locale === 'en' ? 'Appearance' : locale === 'zh-Hant' ? '外觀' : '外观', 'dark');
    await page.setViewportSize({ width: 320, height: 500 });
    await page.goto('/today');
    const title = { en: 'Preserve disagreement and responsibility', 'zh-Hant': '保留分歧與責任', 'zh-Hans': '保留分歧与责任' }[locale];
    await page.locator('.task-row').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).getByRole('button').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS('opacity', '1');
    await expect(dialog.locator('.task-detail-body > dl').first().locator('dt')).toHaveText([languagePacks[locale].taskDetail.duration, languagePacks[locale].taskDetail.types]);
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
