import assert from 'node:assert/strict';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';

const output = process.env.LINGFERN_FIRST_SCREEN_OUTPUT ?? 'private/verification/first-screen-20261017';
const origin = 'http://127.0.0.1:8787';
const locales = ['zh-Hans', 'zh-Hant', 'en', 'ja', 'ko', 'fr', 'es', 'de', 'pt', 'it', 'ru', 'ar', 'hi', 'id'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const compressed = bytes => gzipSync(bytes).length;
const files = await readdir('dist/assets');
const nativeNames = await Promise.all(locales.map(async locale => [locale, JSON.parse(await readFile(`src/locales/${locale}/messages.json`, 'utf8')).meta.nativeName]));
const interfaceChunks = new Map();
for (const name of files.filter(name => name.endsWith('.js'))) {
  const source = await readFile('dist/assets/' + name, 'utf8');
  if (!source.includes('nativeName')) continue;
  const included = nativeNames.filter(([, label]) => source.includes('nativeName:`' + label + '`') || source.includes('"nativeName":"' + label + '"')).map(([locale]) => locale);
  if (included.length) interfaceChunks.set('/assets/' + name, included);
}
assert(locales.every(locale => [...interfaceChunks.values()].some(included => included.includes(locale))), 'Every built interface package must be identifiable');
const size = async name => compressed(await readFile('dist/assets/' + name));
const maximum = async pattern => Math.max(...await Promise.all(files.filter(name => pattern.test(name)).map(size)));
const maxQuote = await maximum(/^\d{3}-.*\.js$/);
const maxTeaching = await maximum(/^teaching-.*\.js$/);
assert.equal(files.filter(name => /^\d{3}-.*\.js$/.test(name)).length, 51);
assert.equal(files.filter(name => /^teaching-.*\.js$/.test(name)).length, 11);
const catalogueBytes = await readFile('public/resources/catalogue.json');
const report = { resourceCatalogue: { path: '/resources/catalogue.json', bytes: catalogueBytes.length, gzip: compressed(catalogueBytes), sha256: sha(catalogueBytes) }, passed: false, budgetBytes: 1024 * 1024, includes: 'All page-requested JS/CSS through settled translated Today and complete visible first quotation; plus conservative largest quote and teaching chunks. Resource catalogue is listed separately; background SW installation traffic is excluded. This is the Plan16 essential page JS/CSS metric, not total network transfer.', maxQuote, maxTeaching, runs: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const locale of locales) {
    const labels = JSON.parse(await readFile(`src/locales/${locale}/messages.json`, 'utf8'));
    const context = await browser.newContext({ locale: locale === 'zh-Hans' ? 'zh-CN' : locale === 'zh-Hant' ? 'zh-TW' : locale, viewport: { width: locale === 'ar' ? 375 : 1440, height: 900 }, colorScheme: locale === 'ar' ? 'dark' : 'light' });
    const page = await context.newPage();
    const pending = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      const path = new URL(response.url()).pathname;
      if (/\.(js|css)$/.test(path) && ['script', 'stylesheet'].includes(response.request().resourceType())) pending.push((async () => {
        assert.equal(new URL(response.url()).origin, origin);
        assert.equal(response.status(), 200);
        const bytes = await response.body();
        assert.equal(sha(bytes), sha(await readFile('dist' + path)));
        return { path, bytes: bytes.length, gzip: compressed(bytes), sha256: sha(bytes) };
      })());
    });
    await page.goto(origin + '/today');
    await expect(page.getByRole('heading', { name: labels.app.today, exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('.daily-quote[data-quote-id] blockquote')).toBeVisible();
    await page.waitForLoadState('networkidle');
    const resources = [...new Map((await Promise.all(pending)).map(file => [file.path, file])).values()];
    const interfaceLocales = [...new Set(resources.flatMap(file => interfaceChunks.get(file.path) ?? []))];
    assert(interfaceLocales.includes(locale));
    assert(interfaceLocales.every(value => value === locale || value === 'en'), `${locale}: unrelated interface languages downloaded: ${interfaceLocales}`);
    assert(!resources.some(file => /\/(?:corpus|prepareCorpusPractice|text-review|Learning|Dictionary|GrammarLookup|SavedWords|ProfileBackup|GithubIdentity|ProgressRecords|CompletionTiming|SessionHistory|SyncConflicts|OfflineInstall|CommunityImport|LookupHistory|UnsavedDemo)-/.test(file.path)), 'Unopened views and generation modules are not first-screen work');
    const total = resources.reduce((sum, file) => sum + file.gzip, 0);
    const shared = resources.filter(file => !/\/(?:\d{3}|teaching)-/.test(file.path)).reduce((sum, file) => sum + file.gzip, 0);
    const worstCase = shared + maxTeaching + maxQuote;
    assert(total <= report.budgetBytes, `${locale}: ${total}`);
    assert(worstCase <= report.budgetBytes, `${locale} conservative bound: ${worstCase}`);
    assert.deepEqual(errors, []);
    const timing = await page.evaluate(() => ({ paint: performance.getEntriesByType('paint').map(entry => entry.toJSON()), heap: performance.memory ? { used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize, limit: performance.memory.jsHeapSizeLimit } : null }));
    const sw = await context.request.get(origin + '/sw.js');
    assert.equal(sha(await sw.body()), sha(await readFile('dist/sw.js')));
    report.runs.push({ locale, total, worstCase, interfaceLocales, timing, resources, quote: await page.locator('.daily-quote').getAttribute('data-quote-id') });
    await context.close();
  }
  report.passed = true;
  await mkdir(output, { recursive: true });
  await writeFile(output + '/first-screen.json', JSON.stringify(report, null, 2) + '\n');
  console.log(`PASS:14 locales; maximum observed ${Math.max(...report.runs.map(run => run.total))} bytes; conservative all-quote/all-teaching bound ${Math.max(...report.runs.map(run => run.worstCase))} bytes <=1MiB. Gzip estimates, local Chrome, no production/mobile claim.`);
} finally { await browser.close(); }
