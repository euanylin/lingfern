import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// The card keeps its own scroll position, so a node's viewport rect is captured just before the
// synthetic mouse event instead of relying on the locator's internal scrolling.
async function doubleClickNode(page: Page, name: string) {
  const box = (await page.getByRole('treeitem', { name, exact: true }).boundingBox())!;
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
}

async function clickNode(page: Page, name: string) {
  const box = (await page.getByRole('treeitem', { name, exact: true }).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

test('draws, edits, saves and exports a syntax tree from Reference', async ({ page }) => {
  await page.setViewportSize({ width: 1120, height: 900 });
  await page.goto('/library');
  await page.getByRole('link', { name: '句法树', exact: true }).click();
  await expect(page.getByRole('heading', { name: '句法树', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '撤销' })).toBeDisabled();
  // A first visit shows a worked example instead of a lone root label. Its relative clause adds a
  // second S, so the root is addressed by position.
  await expect(page.getByRole('textbox', { name: '句子、括号、缩进或依存' })).toHaveValue('The man who caught the ball is my uncle');
  await expect(page.getByRole('treeitem', { name: 'S', exact: true })).toHaveCount(2);
  await expect(page.getByRole('treeitem', { name: 'S', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('treeitem', { name: 'SBAR', exact: true })).toBeVisible();
  await expect(page.getByRole('treeitem', { name: 'caught', exact: true })).toBeVisible();
  // Starting a fresh drawing clears it back to the blank root.
  await page.getByRole('button', { name: '清空' }).click();
  await expect(page.getByRole('textbox', { name: '句子、括号、缩进或依存' })).toHaveValue('');
  await expect(page.getByRole('treeitem', { name: 'S', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: '清空' })).toBeDisabled();
  await page.getByRole('button', { name: '类型: 成分树' }).click();
  await page.getByRole('option', { name: '依存树' }).click();
  await expect(page.getByRole('treeitem', { name: 'ROOT', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.getByRole('treeitem', { name: 'S', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重做' }).click();
  await expect(page.getByRole('treeitem', { name: 'ROOT', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '类型: 依存树' }).click();
  await page.getByRole('option', { name: '成分树', exact: true }).click();
  await expect(page.getByRole('treeitem', { name: 'S', exact: true })).toBeVisible();
  // The symbol row is always on screen; an insertion targets the focused field.
  await expect(page.getByRole('button', { name: '阶标' })).toBeVisible();
  await expect(page.getByRole('button', { name: '添加同级' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '重做' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '清空' })).toBeDisabled();
  await page.getByRole('button', { name: '添加子节点' }).click();
  await expect(page.getByRole('treeitem', { name: 'X', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '清空' })).toBeEnabled();
  await expect(page.getByRole('treeitem', { name: 'X', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.getByRole('treeitem', { name: 'X', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '重做' })).toBeEnabled();
  await page.getByRole('button', { name: '重做' }).click();
  await expect(page.getByRole('treeitem', { name: 'X', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '清空' }).click();
  await expect(page.getByRole('treeitem', { name: 'X', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: '句子、括号、缩进或依存' })).toHaveValue('');
  await expect(page.getByRole('treeitem', { name: 'S', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.getByRole('treeitem', { name: 'X', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '清空' }).click();
  await expect(page.getByRole('treeitem', { name: 'X', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.getByRole('treeitem', { name: 'X', exact: true })).toBeVisible();
  await page.getByRole('treeitem', { name: 'X', exact: true }).click({ button: 'right' });
  const nodeMenu = page.getByRole('menu', { name: 'X' });
  await expect(nodeMenu.getByRole('menuitem', { name: '删除节点' })).toBeEnabled();
  await nodeMenu.getByRole('menuitem', { name: '删除节点' }).click();
  await expect(page.getByRole('treeitem', { name: 'X', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.getByRole('treeitem', { name: 'X', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重做' }).click();
  await expect(page.getByRole('treeitem', { name: 'X', exact: true })).toHaveCount(0);
  await page.getByRole('treeitem', { name: 'S', exact: true }).click({ button: 'right' });
  const rootMenu = page.getByRole('menu', { name: 'S' });
  await expect(rootMenu.getByRole('menuitem', { name: '添加同级' })).toBeDisabled();
  await expect(rootMenu.getByRole('menuitem', { name: '删除节点' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.getByRole('button', { name: '添加子节点' }).click();
  await expect(page.getByRole('treeitem', { name: 'X', exact: true })).toBeVisible();
  const source = page.getByRole('textbox', { name: '句子、括号、缩进或依存' });
  await source.click();
  await expect(page.getByRole('button', { name: '阶标' })).toBeVisible();
  await page.getByRole('button', { name: '阶标' }).click();
  await page.getByRole('button', { name: '反斜线' }).click();
  await expect(source).toHaveValue('′\\');
  // Leaving the field keeps the row in place, and the caret is remembered.
  await page.getByRole('heading', { name: '句法树' }).click();
  await expect(page.getByRole('button', { name: '阶标' })).toBeVisible();
  await page.getByRole('button', { name: '斜线', exact: true }).click();
  await expect(source).toHaveValue('′\\/');
  await source.fill('(Company (Engineering (Frontend) (Backend)) (Design))');
  await source.press('Enter');
  await expect(page.getByRole('button', { name: '自动绘制' })).toHaveCount(0);
  await expect(page.getByRole('treeitem', { name: 'Frontend', exact: true })).toBeVisible();
  await expect(page.getByRole('treeitem', { name: 'X', exact: true })).toHaveCount(0);
  await source.fill('the cat sat on the mat');
  // The sentence is tagged from the installed WordNet index.
  const posRequest = page.waitForRequest(request => /\/dictionary\/oewn-2025\/pos-[a-z0-9]\.json$/.test(request.url()));
  await source.press('Enter');
  expect((await posRequest).url()).toContain('/dictionary/oewn-2025/pos-');
  await expect(page.getByRole('treeitem', { name: 'NN', exact: true })).toHaveCount(2);
  await expect(page.getByRole('treeitem', { name: 'VBD', exact: true })).toHaveCount(1);
  const satNode = page.getByRole('treeitem', { name: 'sat', exact: true });
  await satNode.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  await doubleClickNode(page, 'sat');
  const sat = page.getByRole('textbox', { name: 'sat', exact: true });
  await sat.fill('sits');
  await sat.press('Enter');
  await expect(page.getByRole('treeitem', { name: 'sits', exact: true })).toBeVisible();
  await clickNode(page, 'cat');
  await page.getByRole('textbox', { name: '标签' }).fill('kitten');
  const kitten = page.getByRole('treeitem', { name: 'kitten', exact: true });
  await expect(kitten).toBeVisible();
  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.getByRole('treeitem', { name: 'cat', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重做' }).click();
  await expect(kitten).toBeVisible();
  await expect(kitten).not.toHaveCSS('color', 'rgb(0, 0, 0)');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: '复制文本' }).click();
  await expect(page.getByText('已复制。')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('[NN kitten]');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const dialog = page.getByRole('dialog');
  // The default name follows the drawing: its sentence words joined by hyphens, after the edits above.
  const expectedName = 'the-kitten-sits-on-the-mat';
  await expect(dialog.getByRole('textbox')).toHaveAttribute('placeholder', expectedName);
  await dialog.getByRole('textbox').fill('the cat');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('已保存到历史记录。')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  // Six node-edit controls wrap into two rows, followed by the copy action.
  const actionRows = await page.evaluate(() => {
    const tops = new Map<number, number>();
    for (const button of document.querySelectorAll('.tree-actions:not(.tree-save-actions) button')) {
      const top = Math.round(button.getBoundingClientRect().top);
      tops.set(top, (tops.get(top) ?? 0) + 1);
    }
    return { rows: [...tops.values()], overflow: [...document.querySelectorAll('.tree-actions:not(.tree-save-actions) button')].filter(button => button.scrollWidth > button.clientWidth + 1).length };
  });
  expect(actionRows).toEqual({ rows: [3, 3], overflow: 0 });
  await page.goto('/library/history');
  await page.getByRole('link', { name: /the cat/ }).click();
  await expect(page.getByRole('treeitem', { name: 'kitten', exact: true })).toBeVisible();
  await expect(page.getByRole('treeitem', { name: 'PP', exact: true })).toBeVisible();
  const svgDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出', exact: true }).click();
  const exportDialog = page.getByRole('dialog');
  await expect(exportDialog.locator('#tree-export-extension')).toHaveText('.svg');
  const name = (await exportDialog.locator('#tree-export-name').boundingBox())!;
  const format = (await exportDialog.locator('#tree-export-extension').boundingBox())!;
  expect(format.height).toBe(name.height);
  expect(format.y).toBe(name.y);
  await expect(exportDialog.getByRole('button', { name: '格式: SVG' })).toHaveCount(0);
  await expect(exportDialog.getByRole('option', { name: 'WebP' })).toHaveCount(0);
  await exportDialog.getByRole('button', { name: '格式: .svg' }).click();
  await expect(exportDialog.getByRole('option', { name: 'WebP' })).toBeVisible();
  await expect(exportDialog.getByRole('option', { name: 'JPEG' })).toBeVisible();
  await expect(exportDialog.getByRole('option', { name: 'PDF', exact: true })).toBeVisible();
  await exportDialog.getByRole('option', { name: 'SVG', exact: true }).click();
  await expect(exportDialog.getByRole('option', { name: 'WebP' })).toHaveCount(0);
  await exportDialog.getByRole('button', { name: '保存', exact: true }).click();
  const svg = await svgDownload;
  expect(svg.suggestedFilename()).toBe(`${expectedName}.svg`);
  const svgText = readFileSync((await svg.path())!, 'utf8');
  expect(svgText).toContain('<svg');
  expect(svgText).toContain('kitten');
  expect(svgText).toContain('fill="#000"');
  expect(svgText).not.toContain('<rect');
  expect(svgText).not.toContain('<script');
  const pngDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出', exact: true }).click();
  const pngDialog = page.getByRole('dialog');
  await pngDialog.getByRole('button', { name: '格式: .svg' }).click();
  await pngDialog.getByRole('option', { name: 'PNG', exact: true }).click();
  await expect(pngDialog.locator('#tree-export-extension')).toHaveText('.png');
  await pngDialog.getByRole('button', { name: '保存', exact: true }).click();
  const png = await pngDownload;
  expect(png.suggestedFilename()).toBe(`${expectedName}.png`);
  const pngBytes = readFileSync((await png.path())!);
  expect(pngBytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  const alpha = await page.evaluate(async (source) => {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return { corner: -1, ink: 0 };
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let ink = 0, black = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] === 0) continue;
      ink++;
      if (pixels[index] < 20 && pixels[index + 1] < 20 && pixels[index + 2] < 20) black++;
    }
    return { corner: pixels[3], ink, black };
  }, `data:image/png;base64,${pngBytes.toString('base64')}`);
  expect(alpha.corner).toBe(0);
  expect(alpha.black).toBeGreaterThan(0);
  await page.setViewportSize({ width: 1120, height: 900 });
  const dependency = '1 the 2 det\n2 cat 3 nsubj\n3 sat 0 root';
  await source.evaluate((element, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, dependency);
  await expect(source).toHaveValue(dependency);
  await source.click();
  await page.keyboard.press('Enter');
  const the = page.getByRole('treeitem', { name: 'the', exact: true });
  const cat = page.getByRole('treeitem', { name: 'cat', exact: true });
  const satWord = page.getByRole('treeitem', { name: 'sat', exact: true });
  await expect(satWord).toBeVisible();
  const boxes = await Promise.all([the, cat, satWord].map(async item => item.boundingBox()));
  expect(boxes[0] && boxes[1] && boxes[2]).toBeTruthy();
  expect(Math.abs(boxes[0]!.y - boxes[2]!.y)).toBeLessThan(1);
  expect(boxes[0]!.x).toBeLessThan(boxes[1]!.x);
  expect(boxes[1]!.x).toBeLessThan(boxes[2]!.x);
  await expect(page.locator('css=.tree-board path:not(.tree-arrow)')).toHaveCount(2);
  await expect(page.locator('css=.tree-board path.tree-arrow')).toHaveCount(2);
  await expect(page.locator('css=.tree-board svg text').filter({ hasText: 'nsubj' })).toHaveCount(1);
  await cat.click();
  await expect(page.getByRole('textbox', { name: '标签' })).toHaveValue('cat');
  await page.getByRole('button', { name: '左移', exact: true }).click();
  const swapped = await Promise.all([the.boundingBox(), cat.boundingBox()]);
  expect(swapped[0]!.x).toBeGreaterThan(swapped[1]!.x);
  await page.getByRole('button', { name: '类型: 依存树' }).click();
  await page.getByRole('option', { name: '成分树', exact: true }).click();
  await source.fill('["NP|CASE nom|NUM sg" N]');
  await source.click();
  await page.keyboard.press('Enter');
  const matrix = page.getByRole('treeitem', { name: 'NP CASE nom NUM sg' });
  await expect(matrix).toBeVisible();
  expect((await matrix.boundingBox())!.height).toBeGreaterThan(44);
  const label = page.getByRole('textbox', { name: '标签' });
  await label.click();
  await page.keyboard.press('End');
  await page.getByRole('button', { name: '兰姆达' }).click();
  await expect(label).toHaveValue(/λ$/);
  await expect(page.getByRole('treeitem', { name: /λ$/ })).toBeVisible();
});

test('keeps the sentence field clear for complete generated and written trees', async ({ page }) => {
  await page.goto('/library/trees');
  const source = page.getByRole('textbox', { name: '句子、括号、缩进或依存' });
  await expect(source).toBeEnabled();
  await expect(page.locator('#tree-generated-note')).toHaveCount(0);
  for (const [text, word] of [['(S (NP (DT the) (NN cat)) (VP (VBD sat)))', 'cat'], ['the students read the old book', 'book']]) {
    await source.fill(text);
    await source.press('Enter');
    await expect(page.getByRole('treeitem', { name: word, exact: true })).toBeVisible();
    await expect(page.locator('#tree-generated-note')).toHaveCount(0);
  }
});

for (const width of [1120, 390]) test(`separates movement rails at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/library/trees');
  const source = page.getByRole('textbox', { name: '句子、括号、缩进或依存' });
  await source.fill('(S what₁ who₂ (VP (V saw) t₂ t₁))');
  await source.press('Enter');
  await expect(page.getByRole('treeitem', { name: 't₁', exact: true })).toBeVisible();
  const paths = page.locator('.tree-board svg > path:not(.tree-arrow)');
  await expect(paths).toHaveCount(2);
  const routes = await paths.evaluateAll(elements => elements.map(element => {
    const coordinates = element.getAttribute('d')!.match(/[\d.]+/g)!.map(Number);
    return Array.from({ length: coordinates.length / 2 }, (_, index) => ({ x: coordinates[index * 2], y: coordinates[index * 2 + 1] }));
  }));
  const rails = routes.map(points => Math.max(...points.map(point => point.y)));
  expect(Math.abs(rails[0] - rails[1])).toBeGreaterThanOrEqual(18);
  const boxes = await page.locator('.tree-node').evaluateAll(elements => elements.map(element => {
    const node = element as HTMLElement;
    return { x: node.offsetLeft, y: node.offsetTop, width: node.offsetWidth, height: node.offsetHeight };
  }));
  for (const points of routes) for (const [index, point] of points.entries()) {
    if (!index) continue;
    const prev = points[index - 1];
    for (const box of boxes) {
      const crosses = point.x === prev.x
        ? point.x > box.x + 1 && point.x < box.x + box.width - 1 && Math.max(point.y, prev.y) > box.y + 1 && Math.min(point.y, prev.y) < box.y + box.height - 1
        : point.y > box.y + 1 && point.y < box.y + box.height - 1 && Math.max(point.x, prev.x) > box.x + 1 && Math.min(point.x, prev.x) < box.x + box.width - 1;
      expect(crosses).toBe(false);
    }
  }
  const height = await page.locator('.tree-board svg').getAttribute('height');
  expect(Number(height)).toBeGreaterThanOrEqual(Math.max(...rails) + 20);
  await page.getByRole('button', { name: '放大', exact: true }).click();
  await expect(paths).toHaveCount(2);
  await page.screenshot({ path: info.outputPath('movement-rails.png'), fullPage: true });
});
