import { seedLegacyAnswers } from './workspace';
import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';
import { fernGrowth } from '../../src/core/fern';

test('saved practice and unique lookups grow the same SVG through intermediate shapes', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/today');
  const fern = page.locator('.fern'), stem = fern.locator('.fern-stem');
  await expect(fern).toHaveAttribute('aria-label', /阅读 0 次，听力 0 次，查询 0 项/);
  const initial = await stem.getAttribute('d');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await seedLegacyAnswers(page, 2); await page.goto('/today');
  await expect(fern).toHaveAttribute('aria-label', /阅读 1 次/);
  await expect(fern).toHaveAttribute('data-growth', String(fernGrowth(.5, 0, 0).stem));
  expect(await stem.getAttribute('d')).not.toEqual(initial);
  await fern.evaluate(el => { (window as unknown as { originalFern: Element }).originalFern = el; });
  const other = await context.newPage(); await other.goto('/library/dictionary');
  const before = await stem.getAttribute('d');
  await other.getByRole('combobox').fill('apple'); await other.getByRole('combobox').press('Enter');
  await page.bringToFront();
  await expect(fern).toHaveAttribute('aria-label', /查询 1 项/);
  const samples = await fern.evaluate(async el => {
    const values = new Set<string>();
    for (let index = 0; index < 12; index++) { await new Promise(requestAnimationFrame); values.add(el.querySelector('.fern-stem')!.getAttribute('d')!); }
    return [...values];
  });
  expect(samples.length).toBeGreaterThan(3); expect(samples.some(value => value !== before)).toBe(true);
  expect(await fern.evaluate(el => el === (window as unknown as { originalFern: Element }).originalFern)).toBe(true);
  await expect(fern).toHaveAttribute('data-growth', String(fernGrowth(.5, 0, 1).stem));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(fern).toHaveAttribute('data-motion', 'reduced');
  const grown = await stem.getAttribute('d');
  await other.getByRole('combobox').fill('APPLE'); await other.getByRole('combobox').press('Enter');
  await expect(fern).toHaveAttribute('aria-label', /查询 1 项/); expect(await stem.getAttribute('d')).toEqual(grown);
  await page.reload(); await expect(fern).toHaveAttribute('aria-label', /阅读 1 次，听力 0 次，查询 1 项/); await expect(stem).toHaveAttribute('d', grown!);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(async () => { await (await import('/src/data/lookupHistory.ts' as string)).recordLookup('local-guest', 'grammar', 'since / for'); });
  await expect(fern).toHaveAttribute('data-growth', String(fernGrowth(.5, 0, 2).stem));
  await page.evaluate(async () => {
    const { profiles, settings } = await import('/src/data/db.ts' as string);
    await profiles.put({ id: 'other', name: 'Other', createdAt: new Date().toISOString() });
    await settings.put({ key: 'activeProfile', value: 'other' });
  });
  await page.reload(); await expect(fern).toHaveAttribute('aria-label', /阅读 0 次，听力 0 次，查询 0 项/); await expect(stem).toHaveAttribute('d', initial!);
  await other.close();
});

test('grown foliage fits the existing Today layout in all locales, themes and screen sizes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/today');
  await page.evaluate(async () => {
    const { sessions, attempts, settings } = await import('/src/data/db.ts' as string);
    const { catalogue } = await import('/tests/fixtures/catalogue.ts' as string);
    const { questions } = await import('/src/shared/content.ts' as string);
    for (let index = 0; index < 160; index++) {
      const lesson = catalogue.find((item: { skill: string; targetLevel: string }) => item.skill === (index % 2 ? 'listening' : 'reading') && item.targetLevel === 'A1');
      const id = `synthetic-${index}`;
      await sessions.put({ id, profileId: 'local-guest', lesson, contentHash: 'synthetic', position: 1, status: 'completed', startedAt: new Date().toISOString(), assistance: { hintLevel: 0 }, leaseUntil: 0 });
      for (const [questionIndex, item] of questions(lesson).entries()) await attempts.put({ id: `${id}-${questionIndex}`, sessionId: id, profileId: 'local-guest', questionId: item.question.id, rootId: item.material.rootId, answer: 0, correct: false, rule: 'synthetic', assistance: { hintLevel: 0 }, submittedAt: new Date().toISOString() });
    }
    await settings.put({ key: 'profile:local-guest:lookupHistory', value: JSON.stringify(Array.from({ length: 100 }, (_, index) => ({ kind: 'dictionary', term: `synthetic ${index}`, lookedUpAt: new Date().toISOString() }))) });
  });
  for (const locale of ['zh-Hans', 'zh-Hant', 'en']) for (const theme of ['light', 'dark']) {
    await page.goto('/settings'); await selectPicker(page, (await page.locator('.setting-trigger').first().getAttribute('aria-label'))!, locale);
    await selectPicker(page, (await page.locator('.setting-trigger').nth(1).getAttribute('aria-label'))!, theme);
    for (const width of [1440, 375, 320]) {
      await page.setViewportSize({ width, height: 812 }); await page.goto('/today');
      const fern = page.locator('.fern'); await expect(fern).toHaveAttribute('aria-label', /80/);
      await expect(fern).toHaveAttribute('data-growth', String(fernGrowth(80, 80, 100).stem));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await fern.evaluate((el: SVGSVGElement) => {
        const box = el.getBBox(); return box.x >= 0 && box.y >= 0 && box.x + box.width <= 240 && box.y + box.height <= 180;
      })).toBe(true);
      expect(await page.locator('.reading-task button').first().evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await expect(fern).toHaveAttribute('data-motion', 'active');
      await fern.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(fern).toHaveAttribute('data-motion', 'reduced');
      if (locale === 'zh-Hans' && ((width === 1440 && theme === 'light') || (width === 320 && theme === 'dark'))) await page.locator('.today-home').screenshot({ path: `output/playwright/fern-grown-${width}-${theme}-zh-Hans-synthetic.png` });
    }
  }
});

test('idle foliage moves gently around a fixed root and pauses on visibility events or reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/today');
  await page.evaluate(async () => {
    await (await import('/src/data/db.ts' as string)).settings.put({ key: 'profile:local-guest:lookupHistory', value: JSON.stringify(Array.from({ length: 100 }, (_, index) => ({ kind: 'dictionary', term: `synthetic ${index}`, lookedUpAt: new Date().toISOString() }))) });
  });
  const fern = page.locator('.fern'), stem = fern.locator('.fern-stem');
  await expect(fern).toHaveAttribute('data-growth', String(fernGrowth(0, 0, 100).stem));
  const geometry = await fern.boundingBox();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(fern).toHaveAttribute('data-motion', 'active');
  const samples = await fern.evaluate(async el => {
    const roots: number[][] = [], tips: number[] = [], leaves = new Set<string>();
    const path = el.querySelector<SVGPathElement>('.fern-stem')!;
    for (let frame = 0; frame < 90; frame++) {
      await new Promise(requestAnimationFrame);
      const root = path.getPointAtLength(0), tip = path.getPointAtLength(path.getTotalLength());
      roots.push([root.x,root.y]); tips.push(tip.x); leaves.add(el.querySelector('.fern-pinna')!.getAttribute('d')!);
    }
    return { roots, tips, leaves: leaves.size };
  });
  expect(samples.roots.every(root => root[0] === 120 && root[1] === 171)).toBe(true);
  expect(Math.max(...samples.tips) - Math.min(...samples.tips)).toBeGreaterThan(.1);
  expect(Math.max(...samples.tips) - Math.min(...samples.tips)).toBeLessThan(8);
  expect(samples.leaves).toBeGreaterThan(80);
  expect(await fern.boundingBox()).toEqual(geometry);
  await expect(fern).toHaveAttribute('data-growth', String(fernGrowth(0, 0, 100).stem));
  await page.evaluate(() => scrollTo(0,document.body.scrollHeight));
  await expect(fern).toHaveAttribute('data-motion', 'paused');
  const paused = await stem.getAttribute('d'); await page.waitForTimeout(150);
  expect(await stem.getAttribute('d')).toBe(paused);
  await fern.scrollIntoViewIfNeeded(); await expect(fern).toHaveAttribute('data-motion', 'active');
  await expect.poll(() => stem.getAttribute('d')).not.toBe(paused);
  // Dispatch visibility explicitly because headless Chrome keeps both tabs visible.
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(fern).toHaveAttribute('data-motion', 'paused');
  const background = await stem.getAttribute('d'); await page.waitForTimeout(150);
  expect(await stem.getAttribute('d')).toBe(background);
  await page.evaluate(() => { Reflect.deleteProperty(document, 'hidden'); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(fern).toHaveAttribute('data-motion', 'active');
  await page.emulateMedia({ reducedMotion: 'reduce' }); await expect(fern).toHaveAttribute('data-motion', 'reduced');
  const still = await stem.getAttribute('d'); await page.waitForTimeout(150);
  expect(await stem.getAttribute('d')).toBe(still);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(fern).toHaveAttribute('data-motion', 'active');
  await expect.poll(() => stem.getAttribute('d')).not.toBe(still);
});

test('invalid lookup history stays intact and does not block Today', async ({ page }) => {
  await page.goto('/today');
  await page.evaluate(async () => { await (await import('/src/data/db.ts' as string)).settings.put({ key: 'profile:local-guest:lookupHistory', value: 'invalid' }); });
  await expect(page.getByRole('alert')).toContainText('查询记录无法读取');
  await expect(page.locator('.reading-task button').first()).toBeEnabled();
  expect(await page.evaluate(async () => (await (await import('/src/data/db.ts' as string)).settings.get('profile:local-guest:lookupHistory')).value)).toBe('invalid');
});

test('returning to Today resumes the last drawn shape and growth velocity', async ({ page }) => {
  await page.goto('/library');
  await expect(page.getByRole('heading', { name: '资料库', exact: true })).toBeVisible();
  await page.locator('.desktop-nav a[href="/today"]').click();
  const fern = page.locator('.fern');
  await expect(fern).toHaveAttribute('data-growth', '0');
  await page.evaluate(async () => {
    await (await import('/src/data/db.ts' as string)).settings.put({ key: 'profile:local-guest:lookupHistory', value: JSON.stringify(Array.from({ length: 100 }, (_, index) => ({ kind: 'dictionary', term: `synthetic ${index}`, lookedUpAt: new Date().toISOString() }))) });
  });
  await expect(fern).toHaveAttribute('aria-label', /查询 100 项/);
  const velocity = await fern.evaluate(async el => {
    const samples: { growth: number; time: number }[] = [];
    for (let frame = 0; frame < 12; frame++) {
      const time = await new Promise<number>(requestAnimationFrame);
      samples.push({ growth: Number(el.getAttribute('data-growth')), time });
    }
    const [first,last] = samples.slice(-2);
    return (last.growth - first.growth) / ((last.time - first.time) / 1000);
  });
  expect(velocity).toBeGreaterThan(fernGrowth(0, 0, 100).stem / 10);
  await page.evaluate(() => {
    const element = document.querySelector('.fern')!;
    // A suspended navigation keeps drawing until the destination commits.
    const observer = new MutationObserver(() => {
      if (element.isConnected) return;
      observer.disconnect();
      document.documentElement.dataset.fernBeforeLeave = JSON.stringify([...element.querySelectorAll('path')].map(node => node.getAttribute('d')));
    });
    observer.observe(document.getElementById('root')!, { childList: true, subtree: true });
  });
  await page.locator('.desktop-nav a[href="/library"]').click();
  await expect(page.getByRole('heading', { name: '资料库', exact: true })).toBeVisible();
  const before = await page.evaluate(() => JSON.parse(document.documentElement.dataset.fernBeforeLeave!));
  const returned = page.evaluate(() => new Promise<{ paths: (string | null)[]; velocity: number }>(resolve => {
    const observer = new MutationObserver(async () => {
      const element = document.querySelector('.fern');
      if (!element) return;
      observer.disconnect();
      const paths = [...element.querySelectorAll('path')].map(node => node.getAttribute('d'));
      const start = Number(element.getAttribute('data-growth'));
      const first = await new Promise<number>(requestAnimationFrame);
      // Handle repeated callbacks with identical frame timestamps.
      let time = first;
      for (let frame = 0; frame < 12 && time <= first; frame++) time = await new Promise<number>(requestAnimationFrame);
      resolve({ paths, velocity: (Number(element.getAttribute('data-growth')) - start) / ((time - first) / 1000) });
    });
    observer.observe(document.getElementById('root')!, { childList: true, subtree: true });
  }));
  await page.locator('.desktop-nav a[href="/today"]').click();
  const result = await returned;
  expect(result.paths).toEqual(before);
  expect(result.velocity).toBeGreaterThan(velocity / 2);
  await expect(fern).toHaveAttribute('data-growth', String(fernGrowth(0, 0, 100).stem));
});

test('unreadable reference history preserves the last known growth across navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/today');
  await page.evaluate(async () => {
    await (await import('/src/data/db.ts' as string)).settings.put({ key: 'profile:local-guest:lookupHistory', value: JSON.stringify(Array.from({ length: 40 }, (_, index) => ({ kind: 'dictionary', term: `synthetic ${index}`, lookedUpAt: new Date().toISOString() }))) });
  });
  const fern = page.locator('.fern');
  await expect.poll(async () => Number(await fern.getAttribute('data-growth'))).toBeCloseTo(fernGrowth(0, 0, 40).stem, 12);
  const before = await fern.locator('.fern-stem').getAttribute('d');
  await page.evaluate(async () => { await (await import('/src/data/db.ts' as string)).settings.put({ key: 'profile:local-guest:lookupHistory', value: 'invalid' }); });
  await expect(page.getByRole('alert')).toContainText('查询记录无法读取');
  await expect(fern).toHaveAttribute('aria-label', /查询 40 项/);
  await expect(fern.locator('.fern-stem')).toHaveAttribute('d', before!);
  await page.locator('.desktop-nav a[href="/library"]').click(); await page.locator('.desktop-nav a[href="/today"]').click();
  await expect(page.getByRole('alert')).toContainText('查询记录无法读取');
  await expect(fern.locator('.fern-stem')).toHaveAttribute('d', before!);
  expect(await page.evaluate(async () => (await (await import('/src/data/db.ts' as string)).settings.get('profile:local-guest:lookupHistory')).value)).toBe('invalid');
});

test('a cold reload reserves the fern space and paints complete records before revealing it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/today');
  await page.evaluate(async () => {
    await (await import('/src/data/db.ts' as string)).settings.put({ key: 'profile:local-guest:lookupHistory', value: JSON.stringify(Array.from({ length: 100 }, (_, index) => ({ kind: 'dictionary', term: `synthetic ${index}`, lookedUpAt: new Date().toISOString() }))) });
  });
  await expect(page.locator('.fern')).toHaveAttribute('aria-label', /查询 100 项/);
  await page.addInitScript(() => {
    const state = { first: undefined as { visibility: string; busy: string | null; height: number } | undefined, ready: undefined as { height: number; growth: number } | undefined };
    (window as unknown as { fernLoading: typeof state }).fernLoading = state;
    const observer = new MutationObserver(() => {
      const element = document.querySelector('.fern');
      if (!element) return;
      state.first ??= { visibility: getComputedStyle(element).visibility, busy: element.getAttribute('aria-busy'), height: element.getBoundingClientRect().height };
      if (element.getAttribute('aria-busy') === 'false') {
        state.ready = { height: element.getBoundingClientRect().height, growth: Number(element.getAttribute('data-growth')) };
        observer.disconnect();
      }
    });
    observer.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-busy'] });
  });
  await page.reload(); await expect(page.locator('.fern')).toBeVisible();
  await expect(page.locator('.fern')).toHaveAttribute('aria-busy', 'false');
  const result = await page.evaluate(() => (window as unknown as { fernLoading: { first: { visibility: string; busy: string; height: number }; ready: { height: number; growth: number } } }).fernLoading);
  expect(result.first.visibility).toBe('hidden'); expect(result.first.busy).toBe('true');
  expect(result.first.height).toBeGreaterThan(0); expect(result.ready.height).toBe(result.first.height);
  expect(result.ready.growth).toBeCloseTo(fernGrowth(0, 0, 100).stem, 12);
});

test('retargets a running animation without replacing nodes or restarting from rest', async ({ page }) => {
  await page.goto('/today');
  await expect(page.locator('.fern')).toHaveAttribute('data-growth', '0');
  await page.evaluate(async () => {
    const { recordLookup } = await import('/src/data/lookupHistory.ts' as string);
    await Promise.all(Array.from({ length: 40 }, (_, index) => recordLookup('local-guest', 'dictionary', `synthetic ${index}`)));
  });
  await expect(page.locator('.fern')).toHaveAttribute('aria-label', /查询 40 项/);
  const result = await page.locator('.fern').evaluate(async el => {
    const nodes = [...el.querySelectorAll('path')], positions: number[] = [], intervals: number[] = [];
    let previous = performance.now();
    const { recordLookup } = await import('/src/data/lookupHistory.ts' as string);
    for (let frame = 0; frame < 90; frame++) {
      const time = await new Promise<number>(requestAnimationFrame);
      intervals.push(time - previous); previous = time;
      positions.push(Number(el.getAttribute('data-growth')));
      if (frame === 18) await recordLookup('local-guest', 'dictionary', 'another synthetic query');
    }
    return { positions, intervals, sameNodes: nodes.every((node, index) => el.querySelectorAll('path')[index] === node) };
  });
  expect(result.sameNodes).toBe(true);
  expect(result.positions.filter((value, index) => index && value > result.positions[index-1]).length).toBeGreaterThan(70);
  expect(result.positions.every((value, index) => !index || value >= result.positions[index-1])).toBe(true);
  await expect(page.locator('.fern')).toHaveAttribute('data-growth', String(fernGrowth(0, 0, 41).stem));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(async () => { await (await import('/src/data/lookupHistory.ts' as string)).recordLookup('local-guest', 'dictionary', 'reduced motion query'); });
  await expect(page.locator('.fern')).toHaveAttribute('data-growth', String(fernGrowth(0, 0, 42).stem));
  const staticPath = await page.locator('.fern-stem').getAttribute('d');
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 150)));
  expect(await page.locator('.fern-stem').getAttribute('d')).toBe(staticPath);
});

test('saved test coverage earns its bonus only when complete and deletion recalculates it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/today');
  const count = await page.evaluate(async () => {
    const { sessions, attempts } = await import('/src/data/db.ts' as string);
    const { catalogue } = await import('/tests/fixtures/catalogue.ts' as string);
    const { questions, asTestLesson } = await import('/src/shared/content.ts' as string);
    const practice = catalogue.find((item: { skill: string; targetLevel: string }) => item.skill === 'reading' && item.targetLevel === 'A1');
    for (const [id, lesson] of [['practice', practice], ['test', asTestLesson(practice)]] as const) {
      await sessions.put({ id, profileId: 'local-guest', lesson, contentHash: 'synthetic', position: 0, status: 'completed', startedAt: new Date().toISOString(), assistance: { hintLevel: 0 }, leaseUntil: 0 });
      for (const [index, item] of questions(lesson).entries()) {
        if (id === 'test' && index > 0) continue;
        await attempts.put({ id: `${id}-${index}`, sessionId: id, profileId: 'local-guest', questionId: item.question.id, rootId: item.material.rootId, answer: 0, correct: false, rule: 'synthetic', assistance: { hintLevel: 0 }, submittedAt: new Date().toISOString() });
      }
    }
    return questions(practice).length;
  });
  await page.reload();
  const fern = page.locator('.fern');
  await expect(fern).toHaveAttribute('data-growth', String(fernGrowth(1 + 1 / count, 0, 0).stem));
  await expect(fern).toHaveAttribute('aria-label', /含 0 次完整测试/);
  await page.evaluate(async () => {
    const { sessions, attempts } = await import('/src/data/db.ts' as string);
    const { questions } = await import('/src/shared/content.ts' as string);
    const session = await sessions.get('test');
    for (const [index, item] of questions(session.lesson).entries()) await attempts.put({ id: `test-${index}`, sessionId: 'test', profileId: 'local-guest', questionId: item.question.id, rootId: item.material.rootId, answer: 0, correct: false, rule: 'synthetic', assistance: { hintLevel: 0 }, submittedAt: new Date().toISOString() });
  });
  await page.reload();
  await expect(fern).toHaveAttribute('data-growth', String(fernGrowth(4, 0, 0).stem));
  await expect(fern).toHaveAttribute('aria-label', /含 1 次完整测试/);
  await page.evaluate(async () => { await (await import('/src/data/db.ts' as string)).attempts.delete('test-0'); });
  await page.reload();
  await expect(fern).toHaveAttribute('data-growth', String(fernGrowth(2 - 1 / count, 0, 0).stem));
  await expect(fern).toHaveAttribute('aria-label', /含 0 次完整测试/);
});
