import { expect, test } from '@playwright/test';

test('pastes an external CCG derivation and retains it when a later import fails', async ({ page }) => {
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  const form = page.locator('.tree-form .setting-trigger');
  await expect(source).toBeEnabled();
  await source.fill(String.raw`ID=example.1 PARSER=GOLD NUMPARSE=1
(<T S[dcl] 1 2> (<L NP PRP PRP She NP>) (<L S[dcl]\NP VBD VBD left S[dcl]\NP>) )`);
  await source.press('Enter');
  const word = page.getByRole('treeitem', { name: String.raw`left S[dcl]\NP`, exact: true });
  await expect(word).toBeVisible();
  await expect(form).toHaveAttribute('data-value', 'ccg');
  await expect(page.locator('#tree-generated-note')).toHaveCount(0);
  await source.fill('(<T S[dcl] 0 2> (<L NP PRP PRP They NP>) )');
  await source.press('Enter');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(word).toBeVisible();
  await expect(form).toHaveAttribute('data-value', 'ccg');
});
