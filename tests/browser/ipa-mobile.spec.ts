import { expect, test } from '@playwright/test';

test.use({ isMobile: true, hasTouch: true });

test('narrow vowel chart keeps the full trapezoid visible and playable', async ({ page }, testInfo) => {
  await page.goto('/library/ipa');
  await page.getByRole('button', { name: '详细版', exact: true }).click();
  const chart = page.locator('.ipa-vowel-scroll');
  await chart.evaluate(element => Promise.allSettled(element.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished)));
  await page.locator('audio').evaluate((audio: HTMLAudioElement) => { audio.muted = true; audio.loop = true; });
  for (const width of [600, 390, 320]) {
    await page.setViewportSize({ width, height: 812 });
    await expect.poll(() => chart.evaluate(el => {
      const labels = [...el.querySelectorAll('.ipa-vowel-columns span')].map(label => label.getBoundingClientRect());
      const bounds = el.getBoundingClientRect();
      return el.scrollWidth <= el.clientWidth + 1 && labels.length === 3 && labels.every(box => box.left >= bounds.left - 1 && box.right <= bounds.right + 1);
    })).toBe(true);
    expect(await chart.locator('.ipa-vowel-columns span').evaluateAll(labels => labels.map(label => {
      const chart = label.closest('.ipa-vowel-scroll')!.getBoundingClientRect(), box = label.getBoundingClientRect();
      return box.left >= chart.left - 1 && box.right <= chart.right + 1;
    }))).toEqual([true, true, true]);
    for (const name of ['Play sound /i/', 'Play sound /u/'] as const) {
      const word = chart.getByRole('button', { name, exact: true });
      await word.evaluate(element => element.scrollIntoView({ block: 'center' }));
      expect(await word.evaluate(button => {
        const chart = button.closest('.ipa-vowel-scroll')!.getBoundingClientRect(), box = button.getBoundingClientRect();
        return box.left >= chart.left - 1 && box.right <= chart.right + 1;
      }), `${width}/${name} stays inside the fitted chart`).toBe(true);
      await word.tap();
      await expect(word).toHaveAttribute('aria-pressed', 'true');
      expect(await word.evaluate(button => {
        const chart = button.closest('.ipa-vowel-scroll')!.getBoundingClientRect(), box = button.getBoundingClientRect();
        return box.left >= chart.left - 1 && box.right <= chart.right + 1
          && button.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
      })).toBe(true);
      await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime > 0 && !audio.paused)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`vowel-fit-${width}-${name.replaceAll(/[^\w]+/g, '')}.png`) });
      await word.tap();
      await expect(word).toHaveAttribute('aria-pressed', 'false');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

for (const [table, leftSound, rightSound] of [['consonants', 'p', 'ʔ']] as const) test(`narrow ${table} reveals feedback beyond its sticky row title`, async ({ page }, testInfo) => {
  await page.goto('/library/ipa');
  await page.getByRole('button', { name: '详细版', exact: true }).click();
  const chart = page.locator(`.ipa-table-${table}`).locator('..');
  await chart.evaluate(element => Promise.allSettled(element.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished)));
  await page.locator('audio').evaluate((audio: HTMLAudioElement) => { audio.muted = true; audio.loop = true; });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 812 });
    for (const edge of ['left', 'right'] as const) {
      const button = chart.getByRole('button', { name: `Play sound /${edge === 'left' ? leftSound : rightSound}/`, exact: true });
      await button.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'center' }));
      const point = await button.evaluate((button, edge) => {
        const chart = button.closest('.ipa-table-scroll')!, bounds = chart.getBoundingClientRect(), box = button.getBoundingClientRect();
        const left = button.closest('tr')!.querySelector('th')!.getBoundingClientRect().right, right = bounds.left + chart.clientLeft + chart.clientWidth;
        chart.scrollLeft += edge === 'left' ? box.right - left - 20 : box.left - right + 20;
        return { x: edge === 'left' ? left + 8 : right - 8, y: box.top + box.height / 2, pageY: window.scrollY };
      }, edge);
      const fullyVisible = () => button.evaluate(button => {
        const chart = button.closest('.ipa-table-scroll')!, bounds = chart.getBoundingClientRect(), box = button.getBoundingClientRect();
        return box.left >= button.closest('tr')!.querySelector('th')!.getBoundingClientRect().right && box.right <= bounds.left + chart.clientLeft + chart.clientWidth;
      });
      expect(await fullyVisible(), `${width}/${edge} starts partially clipped`).toBe(false);
      await page.touchscreen.tap(point.x, point.y);
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(fullyVisible, { message: `${width}/${edge} feedback clears the sticky title and scroll edge` }).toBe(true);
      expect(await page.evaluate(() => window.scrollY)).toBe(point.pageY);
      expect(await button.evaluate(button => {
        const box = button.getBoundingClientRect();
        return [box.left + 5, box.right - 5].every(x => [box.top + 12, box.bottom - 12].every(y => button.contains(document.elementFromPoint(x, y))));
      })).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${table}-${width}-${edge}.png`) });
      await button.tap();
      await expect(button).toHaveAttribute('aria-pressed', 'false');
    }
  }
});

test('enlarged vowel words stay inside their feedback surface', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto('/library/ipa');
  await page.getByRole('button', { name: '详细版', exact: true }).click();
  const chart = page.locator('.ipa-vowel-scroll');
  await expect(chart.locator('.ipa-symbol')).not.toHaveCount(0);
  await expect(chart.locator('.playback-icon')).toHaveCount(0);
  await page.evaluate(() => document.documentElement.style.fontSize = '200%');
  await expect.poll(() => chart.evaluate(el => {
    const bounds = el.getBoundingClientRect();
    return el.scrollWidth <= el.clientWidth + 1 && [...el.querySelectorAll('button')].every(button => button.getBoundingClientRect().bottom <= bounds.bottom + 1);
  })).toBe(true);
  expect(await chart.locator('.ipa-symbol').evaluateAll(buttons => buttons.filter(button => {
    const box = button.getBoundingClientRect(), word = button.querySelector('span')!.getBoundingClientRect();
    return word.left < box.left || word.right > box.right || word.top < box.top || word.bottom > box.bottom;
  }).map(button => button.getAttribute('aria-label')))).toEqual([]);
});

test('keyboard focus reveals a consonant obscured by its sticky row title', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto('/library/ipa');
  await page.getByRole('button', { name: '详细版', exact: true }).click();
  const chart = page.locator('.ipa-table-consonants').locator('..');
  const button = chart.getByRole('button', { name: 'Play sound /p/', exact: true });
  // WebKit's default macOS tab mode needs Option-Tab to include buttons.
  const nextControl = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
  await page.keyboard.press(nextControl);
  await chart.focus();
  await button.evaluate(element => element.scrollIntoView({ block: 'center' }));
  await button.evaluate(button => {
    const box = button.getBoundingClientRect(), left = button.closest('tr')!.querySelector('th')!.getBoundingClientRect().right;
    button.closest('.ipa-table-scroll')!.scrollLeft += box.right - left - 20;
  });
  const pageY = await page.evaluate(() => scrollY);
  await page.keyboard.press(nextControl);
  await expect(button).toBeFocused();
  expect(await button.evaluate(button => button.getBoundingClientRect().left >= button.closest('tr')!.querySelector('th')!.getBoundingClientRect().right)).toBe(true);
  expect(await page.evaluate(() => scrollY)).toBe(pageY);
  await expect(chart.locator('button[aria-pressed=true]')).toHaveCount(0);
});
