import { expect, test } from '@playwright/test';

const sentence = 'the students read the old book in the quiet library and the teachers wrote a long letter to the new parents and the children played in the small garden near the school and the parents waited at the front door';

test('long sentence renders inside its card', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1120, height: 1000 });
  await page.goto('/library/trees');
  const source = page.getByRole('textbox', { name: '句子、括号、缩进或依存' });
  await expect(source).toBeEnabled();
  await source.fill(sentence);
  await source.press('Enter');
  // Sentence tagging loads the WordNet buckets, so the board fills asynchronously.
  await expect(page.getByRole('treeitem', { name: 'door', exact: true })).toBeVisible();
  const info = await page.evaluate(() => {
    const scroll = document.querySelector('.tree-scroll') as HTMLElement;
    const canvas = document.querySelector('.tree-canvas') as HTMLElement;
    const board = document.querySelector('.tree-board') as HTMLElement;
    return {
      nodes: document.querySelectorAll('.tree-node').length,
      alert: document.querySelector('[role=alert]')?.textContent ?? '',
      boardWidth: Math.round(board.offsetWidth),
      canvasWidth: Math.round(canvas.getBoundingClientRect().width),
      scrollWidth: scroll.clientWidth,
      level: document.querySelector('.tree-zoom-level')!.textContent,
      pageOverflow: document.documentElement.scrollWidth <= innerWidth + 1,
    };
  });
  console.log(JSON.stringify(info));
  expect(info.alert).toBe('');
  expect(info.nodes).toBeGreaterThan(40);
  // The board is scaled to fit the card instead of overflowing into an inner scroller.
  expect(info.canvasWidth).toBeLessThanOrEqual(info.scrollWidth + 1);
  expect(info.boardWidth).toBeGreaterThan(info.canvasWidth);
  expect(Number.parseInt(info.level!, 10)).toBeLessThan(100);
  expect(info.pageOverflow).toBe(true);
  await page.locator('.tree-scroll').screenshot({ path: testInfo.outputPath('long-sentence.png') });
});

test('zooms from the centre and scrolls a tall diagram in the direction of the arrow keys', async ({ page }) => {
  await page.setViewportSize({ width: 1120, height: 820 });
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  const diagram = Array.from({ length: 10 }, (_, index) => `(N${index} `).join('') + 'leaf' + ')'.repeat(10);
  await source.fill(diagram);
  await source.press('Enter');
  await expect(page.getByRole('treeitem', { name: 'leaf', exact: true })).toBeVisible();
  const board = page.locator('.tree-scroll');
  const position = () => board.evaluate(element => element.scrollTop);
  const fitted = await board.evaluate(element => element.scrollHeight - element.clientHeight);
  expect(fitted).toBeLessThanOrEqual(1);
  await board.focus();
  await board.press('+');
  await board.press('+');
  await expect.poll(position).toBeGreaterThan(0);
  await board.evaluate(element => { element.scrollTop = 0; });
  await board.press('ArrowDown');
  await expect.poll(position).toBe(40);
  await board.press('ArrowUp');
  await expect.poll(position).toBe(0);
});
