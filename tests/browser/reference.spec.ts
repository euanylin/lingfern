import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';

test('IPA tables keep their axes while narrow screens scroll inside the table', async ({ page }) => {
  await page.goto('/library/ipa');
  await expect(page.getByRole('button', { name: '简易版', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '详细版', exact: true }).click();
  await expect(page.locator('.ipa-table')).toHaveCount(4);
  await expect(page.locator('.ipa-entry')).toHaveCount(126);
  await expect(page.locator('.ipa-reference-entry')).toHaveCount(85);
  await expect(page.locator('.ipa-entry:not(.ipa-reference-entry)')).toHaveCount(41);
  for (const width of [320, 375, 640, 700, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const selector of ['.ipa-table-consonants']) {
      const scroll = page.locator(selector).locator('..');
      const rowHeading = page.locator(selector).locator('tbody th').first();
      await scroll.evaluate(el => el.scrollLeft = 0);
      const before = (await rowHeading.boundingBox())!;
      await scroll.evaluate(el => el.scrollLeft = el.scrollWidth);
      expect(Math.abs((await rowHeading.boundingBox())!.x - before.x)).toBeLessThanOrEqual(1);
      expect(await scroll.evaluate(el => el.clientWidth <= innerWidth)).toBe(true);
      await scroll.evaluate(el => el.scrollLeft = 0);
    }
  }
});

test('Library exposes classified IPA with sound/word controls and a searchable usage dictionary in three languages', async ({ page }) => {
  await page.goto('/library');
  await page.getByRole('link', { name: 'IPA 发音表' }).click();
  await expect(page.getByRole('button', { name: '简易版', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '详细版', exact: true }).click();
  await expect(page.locator('.ipa-group > h2')).toHaveText(['Vowels', 'Pulmonic consonants', 'Non-pulmonic consonants', 'Other symbols', 'Affricates (examples)', 'Diacritics', 'Suprasegmentals', 'Tones and word accents']);
  await expect(page.locator('.ipa-group').first().locator(':scope > .ipa-category > h3')).toHaveText(['English rhotic vowels', 'English diphthongs']);
  await expect(page.locator('.ipa-table-consonants tbody th')).toHaveText(['Plosive', 'Nasal', 'Trill', 'Tap or flap', 'Fricative', 'Lateral fricative', 'Approximant', 'Lateral approximant']);
  await expect(page.locator('.ipa-entry')).toHaveCount(126);
  await expect(page.locator('.ipa-reference-entry')).toHaveCount(85);
  await expect(page.locator('.ipa-entry:not(.ipa-reference-entry)')).toHaveCount(41);
  await expect(page.locator('.ipa-entry:not(.ipa-reference-entry)').first().locator('strong')).toHaveText('ee');
  expect(await page.locator('.ipa-entry:not(.ipa-reference-entry)').first().evaluate(row => [...row.children].map(child => child.tagName))).toEqual(['BUTTON', 'BUTTON']);
  await expect(page.locator('.ipa-entry:not(.ipa-reference-entry)').first().locator('button svg')).toHaveCount(2);
  expect(await page.locator('.ipa-entry:not(.ipa-reference-entry)').first().locator('button svg path').evaluateAll(paths => paths.map(path => path.getAttribute('d')))).toEqual(['M7 3v18l15-9z', 'M7 3v18l15-9z']);
  await expect(page.getByRole('heading', { name: 'English diphthongs' })).toBeVisible();
  expect(await page.locator('.ipa-table-consonants .ipa-cell-pair').evaluateAll(cells => cells.filter(cell => cell.querySelectorAll('.ipa-entry:not(.ipa-reference-entry)').length === 2).length)).toBe(7);
  await expect(page.getByRole('button', { name: 'Play sound /i/' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play word see' })).toBeVisible();
  await page.getByRole('link', { name: '资料库', exact: true }).click();
  await page.getByRole('link', { name: '英语用法词典' }).click();
  await page.getByRole('searchbox', { name: '搜索单词、搭配或用法疑问' }).fill('被动');
  await expect(page.locator('.grammar-results details')).toHaveCount(1);
  await page.locator('.grammar-results summary').click();
  await expect(page.getByText('The page was corrected on Monday.')).toBeVisible();
  await expect(page.getByText('进一步说明：')).toBeVisible();
  await expect(page.getByText('The samples were collected in May.')).toBeVisible();
  await page.getByRole('searchbox', { name: '搜索单词、搭配或用法疑问' }).fill('since / for');
  await expect(page.locator('.grammar-results details')).toHaveCount(1);
  await page.locator('.grammar-results summary').click();
  await expect(page.getByText('I have lived here since 2020.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '设置', exact: true }).click();
  await selectPicker(page, '语言', 'en');
  await page.goto('/library/ipa');
  await expect(page.getByRole('button', { name: 'Simple', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Detailed', exact: true }).click();
  await expect(page.locator('.ipa-group > h2')).toHaveText(['Vowels', 'Pulmonic consonants', 'Non-pulmonic consonants', 'Other symbols', 'Affricates (examples)', 'Diacritics', 'Suprasegmentals', 'Tones and word accents']);
  await page.goto('/library/grammar');
  await expect(page.getByRole('heading', { name: 'English usage dictionary' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search words, patterns or usage questions' }).fill('passive');
  await expect(page.locator('.grammar-results details')).toHaveCount(1);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await selectPicker(page, 'Language', 'zh-Hant');
  await page.goto('/library/ipa');
  await expect(page.getByRole('button', { name: '簡易版', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '詳細版', exact: true }).click();
  await expect(page.locator('.ipa-group > h2')).toHaveText(['Vowels', 'Pulmonic consonants', 'Non-pulmonic consonants', 'Other symbols', 'Affricates (examples)', 'Diacritics', 'Suprasegmentals', 'Tones and word accents']);
  await page.goto('/library/grammar');
  await expect(page.getByRole('heading', { name: '英語用法詞典' })).toBeVisible();
  await expect(page.locator('.grammar-results details')).toHaveCount(68);
  await expect(page.locator('.grammar-results summary > small')).toHaveCount(0);
  await page.getByRole('searchbox', { name: '搜尋單字、搭配或用法疑問' }).fill('only');
  await expect(page.locator('.grammar-results details').filter({ hasText: 'only 放在哪裡會改變意思？' })).toHaveCount(1);
  await page.locator('.grammar-results details').filter({ hasText: 'only 放在哪裡會改變意思？' }).locator('summary').click();
  await expect(page.getByText('Sara reviewed only the draft.', { exact: true })).toBeVisible();
});
