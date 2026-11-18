import { expect, test } from '@playwright/test';

// Long interface labels must not turn the wrapped action row back into a long row plus one stray button.
for (const [locale, width, rows] of [['de-DE', 390, 2], ['ru-RU', 390, 2], ['de-DE', 1120, 1]] as const) test(`${locale} keeps ${rows} balanced action row(s) at ${width}px`, async ({ browser }) => {
  const context = await browser.newContext({ locale, viewport: { width, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto('/library/trees');
    const source = page.locator('#tree-source');
    await expect(source).toBeEnabled();
    await source.fill('the cat sat on the mat');
    await source.press('Enter');
    await source.click();
    const info = await page.evaluate(() => {
      const rowsOf = (root: Element) => {
        const tops = new Map<number, number>();
        for (const button of root.querySelectorAll('button')) {
          const top = Math.round(button.getBoundingClientRect().top);
          tops.set(top, (tops.get(top) ?? 0) + 1);
        }
        return [...tops.values()];
      };
      const buttons = [...document.querySelectorAll('.tree-actions:not(.tree-save-actions) button')];
      const symbols = document.querySelector('.tree-symbols')!;
      const symbolButtons = [...symbols.querySelectorAll('button')];
      return {
        rows: rowsOf(document.querySelector('.tree-actions:not(.tree-save-actions)')!),
        symbolRows: rowsOf(symbols),
        symbolWidths: [...new Set(symbolButtons.map(button => Math.round(button.getBoundingClientRect().width)))],
        widths: [...new Set(buttons.map(button => Math.round(button.getBoundingClientRect().width)))],
        labelOverflow: [...buttons, ...symbolButtons].filter(button => button.scrollWidth > button.clientWidth + 1).length,
        pageOverflow: document.documentElement.scrollWidth <= innerWidth + 1,
      };
    });
    expect(info.rows).toHaveLength(rows);
    if (rows > 1) {
      expect(Math.max(...info.rows) - Math.min(...info.rows)).toBeLessThanOrEqual(1);
    }
    // The symbol row balances as 5 + 4 when narrow and stays in one row when wide.
    const symbolsBalanced = width > 620 ? info.symbolRows.length === 1 : info.symbolRows.join() === '5,4';
    expect(symbolsBalanced, `${locale}/${width} symbols ${info.symbolRows}`).toBe(true);
    expect(info.labelOverflow).toBe(0);
    expect(info.pageOverflow).toBe(true);
  } finally { await context.close(); }
});

for (const width of [320, 390, 640, 1120]) test(`copy/save/export and left/right stay grouped at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { Reflect.set(window, 'copiedTree', text); } } }));
  await page.goto('/library/trees');
  await expect(page.locator('#tree-source')).toBeEnabled();
  await page.locator('#tree-source').fill('(Root (N token))');
  await page.locator('#tree-source').press('Enter');
  const output = page.locator('.tree-save-actions');
  await expect(output.getByRole('button')).toHaveText(['复制文本', '保存', '导出']);
  const tops = await output.getByRole('button').evaluateAll(buttons => buttons.map(button => Math.round(button.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
  const left = await page.getByRole('button', { name: '左移', exact: true }).boundingBox();
  const right = await page.getByRole('button', { name: '右移', exact: true }).boundingBox();
  expect(left!.y).toBe(right!.y);
  expect(right!.x).toBeGreaterThan(left!.x);
  const overflow = await page.locator('.tree-actions button').evaluateAll(buttons => buttons.some(button => button.scrollWidth > button.clientWidth + 1 || button.getBoundingClientRect().height < 44));
  expect(overflow).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await output.getByRole('button', { name: '复制文本', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'copiedTree'))).toContain('token');
  await output.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('action-rows.png'), fullPage: true });
});

for (const width of [320, 390, 1120]) test(`movement toggle keeps its size and unlink shares its row at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  const placement = await page.locator('.tree-page').evaluate(root => {
    const frame = root.querySelector('.tree-frame')!.getBoundingClientRect();
    return { frameTop: frame.top, frameBottom: frame.bottom, editsBottom: root.querySelector('.tree-actions:not(.tree-save-actions)')!.getBoundingClientRect().bottom, symbolsBottom: root.querySelector('.tree-symbols')!.getBoundingClientRect().bottom, outputsTop: root.querySelector('.tree-save-actions')!.getBoundingClientRect().top };
  });
  const toolbarRows = await page.locator('.tree-toolbar').evaluate(root => {
    const form = root.querySelector('.tree-form')!.getBoundingClientRect();
    const edits = root.querySelector('.tree-actions')!.getBoundingClientRect();
    return { formCenter: (form.top + form.bottom) / 2, formBottom: form.bottom, editTop: edits.top, editCenter: (edits.top + edits.bottom) / 2 };
  });
  if (width === 1120) expect(toolbarRows.editCenter).toBeCloseTo(toolbarRows.formCenter, 1);
  else expect(toolbarRows.editTop).toBeGreaterThanOrEqual(toolbarRows.formBottom);
  expect(placement.editsBottom).toBeLessThanOrEqual(placement.frameTop);
  expect(placement.symbolsBottom).toBeGreaterThan(placement.frameBottom);
  expect(placement.outputsTop).toBeGreaterThanOrEqual(placement.frameBottom);
  await source.fill('(Root (A₁) (B₁))');
  await source.press('Enter');
  await page.getByRole('treeitem', { name: 'A₁', exact: true }).click();
  const toggle = page.getByRole('button', { name: '移位', exact: true });
  const unlink = page.getByRole('button', { name: '取消移位', exact: true });
  await toggle.scrollIntoViewIfNeeded();
  const dimensions = () => toggle.evaluate(button => ({ width: getComputedStyle(button).width, height: getComputedStyle(button).height }));
  const before = await dimensions();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(await dimensions()).toEqual(before);
  const a = (await toggle.boundingBox())!, b = (await unlink.boundingBox())!;
  expect(a.y).toBe(b.y);
  const positions = await page.locator('.tree-movement-actions button').evaluateAll(buttons => buttons.map(button => ({ top: button.getBoundingClientRect().top, width: button.getBoundingClientRect().width })));
  expect(positions).toHaveLength(4);
  expect(new Set(positions.map(position => position.top)).size).toBe(1);
  const checkEdges = async () => {
    const edges = await page.locator('.tree-actions:not(.tree-save-actions)').evaluate(root => {
      const first = root.querySelector('button')!.getBoundingClientRect();
      const third = root.querySelectorAll(':scope > button')[2].getBoundingClientRect();
      const buttons = [...root.querySelectorAll('.tree-movement-actions button')];
      return { left: first.left, right: third.right, rowLeft: buttons[0].getBoundingClientRect().left, rowRight: buttons.at(-1)!.getBoundingClientRect().right, fonts: buttons.map(button => getComputedStyle(button).fontSize), widths: buttons.map(button => button.getBoundingClientRect().width) };
    });
    expect(edges.rowLeft).toBeCloseTo(edges.left, 1);
    expect(edges.rowRight).toBeCloseTo(edges.right, 1);
    return edges;
  };
  if (width < 620) {
    expect(new Set(positions.map(position => position.width)).size).toBeGreaterThan(1);
    expect((await checkEdges()).fonts).toEqual(['13px', '13px', '13px', '13px']);
  }
  expect(b.x).toBeGreaterThan(a.x);
  expect(a.height).toBeGreaterThanOrEqual(44);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(await dimensions()).toEqual(before);
  await unlink.click();
  await expect(page.locator('.tree-movement-actions button')).toHaveCount(3);
  if (width < 620) {
    const normal = await checkEdges();
    expect(normal.fonts).toEqual(['14px', '14px', '14px']);
    expect(Math.max(...normal.widths) - Math.min(...normal.widths)).toBeLessThan(1);
  }
  expect(await page.locator('.tree-actions button').evaluateAll(buttons => buttons.some(button => button.scrollWidth > button.clientWidth + 1))).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
