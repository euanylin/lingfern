import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const reading = JSON.parse(readFileSync('tests/fixtures/content/a1-reading.json', 'utf8'));

test('resource topic rows mount on expansion and retain their selection through collapse and search', async ({ page }) => {
  await page.goto('/library');
  const group = page.locator('.offline-source-group').filter({ has: page.locator('.offline-source-group-toggle:not([aria-controls$=":general"])') }).first();
  const toggle = group.locator('.offline-source-group-toggle');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(group.locator('.package-row')).toHaveCount(0);
  await toggle.click();
  const checkbox = group.locator('.package-row input').first();
  const name = (await checkbox.getAttribute('aria-label'))!;
  await checkbox.check();
  await toggle.click();
  await expect(group.locator('.package-row')).toHaveCount(0);
  await expect(page.locator('.offline-package-heading')).toContainText('已选 1 项');
  await toggle.click();
  await expect(group.getByRole('checkbox', { name, exact: true })).toBeChecked();
  await page.getByRole('searchbox', { name: '搜索内容' }).fill(name);
  await expect(page.getByRole('checkbox', { name, exact: true })).toBeChecked();
});

test('dictionary suggestions reuse community terms while typing and refresh after a local package change', async ({ page }) => {
  await page.goto('/library/dictionary');
  await expect(page.getByRole('combobox')).toBeVisible();
  await page.evaluate(async () => {
    const path = '/src/data/db.ts', data = await import(path), where = data.communityPacks.where.bind(data.communityPacks);
    Reflect.set(window, 'dictionaryReads', 0);
    data.communityPacks.where = (index: unknown) => { Reflect.set(window, 'dictionaryReads', Reflect.get(window, 'dictionaryReads') + 1); return where(index); };
  });
  for (const term of ['apple', 'book', 'record']) {
    await page.getByRole('combobox').fill(term);
    await expect(page.getByRole('option', { name: term, exact: true })).toBeVisible();
  }
  expect(await page.evaluate(() => Reflect.get(window, 'dictionaryReads'))).toBe(1);
  await page.evaluate(async () => {
    const path = '/src/data/db.ts', data = await import(path), profileId = (await data.settings.get('activeProfile'))?.value ?? 'local-guest';
    await data.communityPacks.put({ profileId, hash: 'a'.repeat(64), id: 'synthetic-term-refresh', lessons: [], sources: [], dictionary: [{ term: 'fernlookupword', sourceId: 'synthetic', definition: 'Synthetic browser test only.', example: 'A synthetic term.' }], state: 'ready', installedAt: new Date().toISOString() });
  });
  await page.getByRole('combobox').fill('fernlookup');
  await expect(page.getByRole('option', { name: 'fernlookupword', exact: true })).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, 'dictionaryReads'))).toBeGreaterThan(1);
});

test('collapsed session history omits answer DOM and reopens every saved response unchanged', async ({ page }) => {
  await page.goto('/today');
  await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  await page.evaluate(async lesson => {
    const path = '/src/data/db.ts', data = await import(path);
    for (let i = 0; i < 2; i++) {
      const session = await data.createSession(lesson);
      await data.claimSession(session.id, 'history-performance-test');
      const questions = session.lesson.materials.flatMap((material: { questions: { answer: number }[] }) => material.questions);
      for (const [index, question] of questions.entries()) {
        await data.submit(session.id, 'history-performance-test', question.answer);
        if (index + 1 < questions.length) await data.advance(session.id, 'history-performance-test');
      }
    }
  }, reading);
  await page.goto('/progress');
  await expect(page.locator('.history')).toHaveCount(2);
  await expect(page.locator('.history details section')).toHaveCount(0);
  const entry = page.locator('.history').first();
  await expect(entry.locator('summary')).toContainText('4');
  await entry.locator('summary').click();
  await expect(entry.locator('details section')).toHaveCount(4);
  await expect(entry).toContainText(reading.materials[0].questions[0].prompt);
  await entry.locator('summary').click();
  await expect(entry.locator('details section')).toHaveCount(0);
  await entry.locator('summary').click();
  await expect(entry.locator('details section')).toHaveCount(4);
  expect(await page.evaluate(async () => { const path = '/src/data/db.ts'; return (await import(path)).attempts.count(); })).toBe(8);
});

test('grammar searches full explanations without mounting closed detail bodies', async ({ page }) => {
  await page.goto('/library/grammar');
  await expect(page.locator('.grammar-results summary')).toHaveCount(68);
  await expect(page.locator('.grammar-detail')).toHaveCount(0);
  await page.getByRole('searchbox').fill('I have lived here since 2020.');
  const entry = page.locator('.grammar-results details').filter({ hasText: 'since / for' });
  await expect(entry).toHaveCount(1);
  await entry.locator('summary').click();
  await expect(entry.locator('.grammar-detail')).toBeVisible();
  await expect(entry).toContainText('I have lived here since 2020.');
  await entry.locator('summary').click();
  await expect(page.locator('.grammar-detail')).toHaveCount(0);
});
