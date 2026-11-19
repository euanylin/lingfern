import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('shows incomplete CCG derivations and clears the warning after a valid redraw', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1120, height: 900 });
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  await source.fill('the more you read');
  await source.press('Enter');
  await page.getByRole('button', { name: '类型: 成分树' }).click();
  await page.getByRole('option', { name: '组合范畴语法（CCG）', exact: true }).click();
  await expect(page.getByRole('treeitem', { name: '?', exact: true }).first()).toBeVisible();
  await expect(page.locator('#tree-generated-note')).toHaveText('推导未完成：? 表示无法组合。');
  await expect(source).toHaveAttribute('aria-describedby', 'tree-generated-note');
  await page.screenshot({ path: testInfo.outputPath('ccg-incomplete.png'), fullPage: true });
  await source.fill('why did she leave');
  await source.press('Enter');
  await expect(page.getByRole('treeitem', { name: '?', exact: true })).toHaveCount(0);
  await expect(page.getByRole('treeitem', { name: 'S', exact: true }).first()).toBeVisible();
  await expect(page.locator('#tree-generated-note')).toHaveCount(0);
});

test('names the available phrase presentations without claiming a TAG grammar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/library/trees');
  await page.getByRole('button', { name: '类型: 成分树' }).click();
  for (const name of ['X′ 结构', '裸短语结构', '派生成分树', '完整成分树', '简化成分树', '组合范畴语法（CCG）', '特征标注树']) {
    await expect(page.getByRole('option', { name, exact: true })).toBeVisible();
  }
  await page.getByRole('option', { name: '派生成分树', exact: true }).click();
  await expect(page.getByRole('button', { name: '类型: 派生成分树' })).toBeVisible();
  await expect(page.getByRole('treeitem', { name: /[αβ]/u })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('draws an inverted passive with a coindexed subject and gap', async ({ page }) => {
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  await source.fill('Was the letter written yesterday?');
  await source.press('Enter');
  await expect(page.getByRole('treeitem', { name: 'letter₁', exact: true })).toBeVisible();
  await expect(page.getByRole('treeitem', { name: 't₁', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '类型: 成分树' }).click();
  await page.getByRole('option', { name: '依存树', exact: true }).click();
  await expect(page.getByText('aux:pass', { exact: true })).toBeVisible();
  await expect(page.getByText('nsubj:pass', { exact: true })).toBeVisible();
  await expect(page.getByRole('treeitem', { name: 't₁', exact: true })).toHaveCount(0);
});

test('places a zero relative under its noun and preserves its stranded preposition', async ({ page }) => {
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  await source.fill('I bought the book I was looking for.');
  await source.press('Enter');
  await expect(page.getByRole('treeitem', { name: 'book₁', exact: true })).toBeVisible();
  await expect(page.getByRole('treeitem', { name: 't₁', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '类型: 成分树' }).click();
  await page.getByRole('option', { name: '依存树', exact: true }).click();
  await expect(page.getByText('acl:relcl', { exact: true })).toBeVisible();
  await expect(page.getByText('obl', { exact: true })).toBeVisible();
  await expect(page.getByRole('treeitem', { name: 'for', exact: true })).toBeVisible();
});

test('serves the current compiled service worker and renders Today in an isolated context', async ({ page, request }) => {
  const sw = await request.get('http://127.0.0.1:8787/sw.js');
  expect(sw.status()).toBe(200);
  expect(await sw.text()).toBe(readFileSync('dist/sw.js', 'utf8'));
  await page.goto('http://127.0.0.1:8787/today');
  await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  await page.goto('http://127.0.0.1:8787/settings');
  await expect(page.locator('#settings-update-value')).toHaveText('v0.2');
});

test('keeps a contracted auxiliary attached to its predicate after sentence punctuation', async ({ page }) => {
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  await source.fill("We’ve finished.");
  await source.press('Enter');
  await page.getByRole('button', { name: '类型: 成分树' }).click();
  await page.getByRole('option', { name: '依存树', exact: true }).click();
  await expect(page.getByRole('button', { name: '类型: 依存树' })).toBeVisible();
  await expect(page.getByRole('treeitem', { name: 'finished', exact: true })).toBeVisible();
  await expect(page.getByRole('treeitem', { name: '’ve', exact: true })).toBeVisible();
  await expect(page.getByRole('treeitem', { name: '.', exact: true })).toBeVisible();
  await expect(page.getByRole('treeitem', { name: "We’ve", exact: true })).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await source.fill('“we left.”');
  await source.press('Enter');
  for (const label of ['“', 'left', '”']) await expect(page.getByRole('treeitem', { name: label, exact: true })).toBeVisible();
});

test('generates nested quotations and prose parentheses without switching to written-tree mode', async ({ page }) => {
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  await page.getByRole('button', { name: '类型: 成分树' }).click();
  await page.getByRole('option', { name: '依存树', exact: true }).click();
  await expect(page.getByRole('button', { name: '类型: 依存树' })).toBeVisible();
  for (const sentence of ['(the cat slept.)', 'she said “he said ‘we left.’”', 'the cat\nslept.']) {
    await source.fill(sentence);
    await source.press('Enter');
    await expect(page.getByRole('button', { name: '类型: 依存树' })).toBeVisible();
    const words = sentence.includes('said') ? ['she', 'he', 'we', 'left'] : ['the', 'cat', 'slept'];
    await expect(page.getByRole('treeitem', { name: words.at(-1)!, exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    for (const word of words) await expect(page.getByRole('treeitem', { name: word, exact: true })).toBeVisible();
  }
});

test('retains the requested presentation when another sentence is submitted during dictionary loading', async ({ page }) => {
  let release!: () => void;
  const loaded = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/dictionary/oewn-2025/pos-*.json', async route => {
    await loaded;
    await route.continue();
  });
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  try {
    await page.getByRole('button', { name: '类型: 成分树' }).click();
    await page.getByRole('option', { name: '依存树', exact: true }).click();
    await source.fill('the cat slept.');
    await source.press('Enter');
  } finally { release(); }
  await expect(page.getByRole('button', { name: '类型: 依存树' })).toBeVisible();
  await expect(page.getByRole('treeitem', { name: 'slept', exact: true })).toBeVisible();
  await expect(page.getByRole('treeitem', { name: 'VP', exact: true })).toHaveCount(0);
});

test('draws date, numeric, list and apposition relations through the real sentence editor', async ({ page }) => {
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  await page.getByRole('button', { name: '类型: 成分树' }).click();
  await page.getByRole('option', { name: '依存树', exact: true }).click();
  await expect(page.getByRole('button', { name: '类型: 依存树' })).toBeVisible();
  for (const [sentence, word, relation] of [
    ['the town was founded September 20, 1888.', '20', 'obl:unmarked'],
    ['the town was founded Jan. 2nd, 2024.', '2nd', 'obl:unmarked'],
    ['the town was founded 2024-02-29.', '2024-02-29', 'obl:unmarked'],
    ['we counted -1,234.5.', '-1,234.5', 'obj'],
    ['we bought apples, pears, and oranges.', 'oranges', 'conj'],
    ['my brother, a doctor, left.', 'doctor', 'appos'],
  ]) {
    await source.fill(sentence);
    await source.press('Enter');
    await expect(page.getByRole('treeitem', { name: word, exact: true })).toBeVisible();
    await expect(page.locator('.tree-edge-label').filter({ hasText: new RegExp(`^${relation}$`, 'u') }).first()).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
});

test('heads a coordinated object infinitive with its selecting verb', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (text: string) => { Reflect.set(window, 'copiedTree', text); } },
  }));
  await page.goto('/library/trees');
  await page.getByRole('button', { name: '类型: 成分树' }).click();
  await page.getByRole('option', { name: '依存树', exact: true }).click();
  const source = page.locator('#tree-source');
  await source.fill('She will call and ask him to leave.');
  await source.press('Enter');
  await expect(page.getByRole('treeitem', { name: 'leave', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '复制文本', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'copiedTree'))).toContain('5 ask 3 conj\n6 him 5 obj\n7 to 8 mark\n8 leave 5 xcomp');
});

test('draws ordinary sentence stops and short replies instead of failing on punctuation', async ({ page }) => {
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  await page.getByRole('button', { name: '类型: 成分树' }).click();
  await page.getByRole('option', { name: '依存树', exact: true }).click();
  await expect(page.getByRole('button', { name: '类型: 依存树' })).toBeVisible();
  for (const [sentence, head, stop] of [
    ['what did she see?', 'see', '?'],
    ['I have.', 'have', '.'],
    ['she left?!', 'left', '?!'],
    ['Yes.', 'Yes', '.'],
    ['she left; we stayed.', 'stayed', ';'],
    ['the US grew.', 'grew', '.'],
    ['the constructor worked.', 'worked', '.'],
    ['Notes:', 'Notes', ':'],
    ['she left. we slept.', 'slept', '.'],
    ['Dr. Smith left.', 'Smith', '.'],
    ['(we left).', 'we', '.'],
    ['she announced the news:', 'announced', ':'],
    ['(we left)…', 'we', '...'],
  ]) {
    await source.fill(sentence);
    await source.press('Enter');
    await expect(page.getByRole('treeitem', { name: head, exact: true })).toBeVisible();
    await expect(page.getByRole('treeitem', { name: stop, exact: true }).first()).toBeVisible();
    await expect(page.locator('.tree-edge-label').filter({ hasText: /^punct$/u }).first()).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
});

for (const action of ['none', 'clear', 'edit', 'empty-label', 'undo', 'draft', 'symbol', 'error'] as const) test(`does not let pending generation overwrite ${action}`, async ({ page }) => {
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  let requested!: () => void;
  const started = new Promise<void>(resolve => { requested = resolve; });
  await page.route('**/dictionary/oewn-2025/pos-*.json', async route => {
    requested();
    await ready;
    await route.fulfill({ json: {} });
  });
  await page.route('**/dictionary/oewn-2025/forms.json', route => route.fulfill({ json: {} }));
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  const initialSource = await source.inputValue();
  const dictionaryFinished = page.waitForResponse('**/dictionary/oewn-2025/forms.json');
  try {
    if (action === 'undo') await page.locator('#tree-label').fill('ManualRoot');
    await source.fill(action === 'error' ? 'the' : 'the cat slept.');
    await source.press('Enter');
    await started;
    if (action === 'clear') await page.getByRole('button', { name: '清空', exact: true }).click();
    if (action === 'edit') await page.locator('#tree-label').fill('ManualRoot');
    if (action === 'empty-label') await page.locator('#tree-label').fill('');
    if (action === 'undo') await page.getByRole('button', { name: '撤销', exact: true }).click();
    if (action === 'draft' || action === 'error') await source.fill('this is my unfinished draft');
    if (action === 'symbol') await page.getByRole('button', { name: '特征分隔', exact: true }).click();
  } finally { release(); }
  await (await dictionaryFinished).finished();
  // The final response is tiny; two frames let its callbacks and React commit finish.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (action === 'none') {
    await expect(page.getByRole('treeitem', { name: 'slept', exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  } else await expect(page.getByRole('treeitem', { name: 'slept', exact: true })).toHaveCount(0);
  if (action === 'clear') {
    await expect(source).toHaveValue('');
    await expect(page.getByRole('treeitem')).toHaveCount(1);
  }
  if (action === 'edit') await expect(page.getByRole('treeitem', { name: 'ManualRoot', exact: true })).toBeVisible();
  if (action === 'empty-label') await expect(page.locator('#tree-label')).toHaveValue('');
  if (action === 'undo') await expect(source).toHaveValue(initialSource);
  if (action === 'draft' || action === 'error') await expect(source).toHaveValue('this is my unfinished draft');
  if (action === 'error') await expect(page.getByRole('alert')).toHaveCount(0);
  if (action === 'symbol') await expect(source).toHaveValue('the cat slept.|');
});
