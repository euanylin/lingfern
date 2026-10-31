import { readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';
import { renderPageHtml } from './src/shared/seo.ts';
import { publicPrerender } from './scripts/prerender.ts';

// Preserve full public provenance; load display credits only.
const audioCredits = (path: string, label: 'word' | 'ipa') => JSON.stringify(JSON.parse(readFileSync(path, 'utf8')).map((item: Record<string, unknown>) => Object.fromEntries([label, 'source', 'author', 'license', 'licenseUrl', 'changes'].map(key => [key, item[key]]))));

const fixtureRoot = process.env.LINGFERN_OFFLINE_FIXTURES === '1' ? '/tmp/lingfern-offline-fixtures-resources' : '/tmp/lingfern-test-fixtures-resources';

export default defineConfig(({ mode }) => ({
  publicDir: mode === 'test-fixtures' ? `${fixtureRoot}/public` : 'public',
  optimizeDeps: { entries: ['index.html'] },
  define: {
    __LINGFERN_SOURCE_TOPICS__: JSON.stringify(JSON.parse(readFileSync('content/corpus/runtime-audit.json', 'utf8')).topicCoverage.decisions.map(({ rootId, sourceHash, topic }: { rootId: string; sourceHash: string; topic: string }) => ({ rootId, sourceHash, topic }))),
    __LINGFERN_IPA_WORD_SOURCES__: audioCredits('public/ipa/SOURCES.json', 'word'),
    __LINGFERN_IPA_SOUND_SOURCES__: audioCredits('public/ipa/PHONEME_SOURCES.json', 'ipa'),
    __LINGFERN_RULE_HASHES__: JSON.stringify({ scoring: createHash('sha256').update(readFileSync('src/shared/content.ts')).update(readFileSync('src/shared/practiceQuantity.ts')).digest('hex'), generator: createHash('sha256').update(readFileSync('src/core/corpus.ts')).update(readFileSync('src/core/practiceOrganization.ts')).update(readFileSync('src/shared/practiceQuantity.ts')).update(readFileSync('src/core/spokenCorpus.ts')).update(readFileSync('src/core/spokenCondition.ts')).update(readFileSync('src/core/spokenAttribution.ts')).update(readFileSync('src/core/corpusPractice.ts')).update(readFileSync('src/core/corpusSegments.ts')).update(readFileSync('src/core/corpusRhetoricalFunction.ts')).update(readFileSync('content/corpus/c2-rhetorical-function-scopes.json')).update(readFileSync('src/core/corpusDisagreementSynthesis.ts')).update(readFileSync('content/corpus/c2-disagreement-synthesis-scopes.json')).update(readFileSync('src/core/corpusFaithfulParaphrase.ts')).update(readFileSync('content/corpus/c2-faithful-paraphrase-scopes.json')).update(readFileSync('src/core/corpusComplexPragmatics.ts')).update(readFileSync('content/corpus/c2-complex-pragmatics-scopes.json')).update(readFileSync('src/core/corpusLayeredPosition.ts')).update(readFileSync('content/corpus/c2-layered-position-scopes.json')).update(readFileSync('src/core/corpusNuancedMeaning.ts')).update(readFileSync('content/corpus/c2-nuanced-meaning-scopes.json')).update(readFileSync('src/core/corpusInformationDensity.ts')).update(readFileSync('content/corpus/c1-information-density-scopes.json')).update(readFileSync('src/core/corpusIndirectStance.ts')).update(readFileSync('content/corpus/c1-indirect-stance-scopes.json')).update(readFileSync('src/core/corpusArgumentBoundaries.ts')).update(readFileSync('content/corpus/c1-argument-boundaries-scopes.json')).update(readFileSync('src/core/corpusRegisterAudience.ts')).update(readFileSync('content/corpus/c1-register-audience-scopes.json')).update(readFileSync('src/core/corpusDiscourseOrganization.ts')).update(readFileSync('content/corpus/c1-discourse-organization-scopes.json')).update(readFileSync('src/core/corpusReference.ts')).update(readFileSync('src/core/spokenLongAdmission.ts')).update(readFileSync('content/corpus/long-listening-admission.json')).update(readFileSync('src/app/prepareCorpusPractice.ts')).update(readFileSync('src/shared/practiceSelection.ts')).update(readFileSync('src/core/wordListening.ts')).update(readFileSync('src/core/beginnerListening.ts')).digest('hex') }) },
  plugins: [publicPrerender(), { name: 'page-metadata', transformIndexHtml: html => renderPageHtml(html, '/') }, { name: 'omit-finder-metadata', writeBundle(options) {
    if (!options.dir) return;
    for (const file of readdirSync(options.dir, { recursive: true, withFileTypes: true }))
      if (file.isFile() && file.name === '.DS_Store') unlinkSync(join(file.parentPath, file.name));
  } }, VitePWA({
    strategies: 'injectManifest', srcDir: 'src', filename: 'sw.ts', registerType: 'prompt', injectRegister: null,
    manifest: { id: '/', name: 'Lingfern', short_name: 'Lingfern', description: 'Read, listen, and grow into English.', start_url: '/', scope: '/', display: 'standalone', background_color: '#F7F6F2', theme_color: '#536F5B', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }] },
    // Keep the full quote catalogue and evidence available offline.
    injectManifest: { maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, globIgnores: ['prerender/**'], globPatterns: ['**/*.{html,js,css,svg,png,webmanifest}', 'audio/a1-words/word-*.mp3', 'daily-quotes/*.{md,txt,json}', 'THIRD_PARTY_NOTICES.md', 'ipa/CC-BY-SA-*.txt', 'licenses/**/*', 'corpus/*.{md,txt}', 'dictionary/oewn-2025/{README.md,LICENSE.md,WNDB_License.txt}'] },
  })],
  // Keep shared validation outside the entry to avoid its async catalogue cycle.
  build: { sourcemap: true, rolldownOptions: { output: { codeSplitting: { groups: [{ name: id => `messages-${id.split(/[\\/]/).at(-2)}`, test: /src[\\/]locales[\\/](?!en[\\/])[^/\\]+[\\/]messages\.json$/ }, { name: 'content', test: /src[\\/]shared[\\/]content\.ts$/ }, { name: 'app-shell', tags: ['$initial'] }, { name: 'text-review', test: /content[\\/]corpus[\\/]text-review-rules\.json$/ }] } } } },
  server: { proxy: Object.fromEntries(['/api', '/mcp', '/oauth', '/.well-known'].map(route => [route, 'http://127.0.0.1:8787'])) },
  test: { include: ['tests/*.test.ts'], setupFiles: ['fake-indexeddb/auto', 'tests/runtime-resources-setup.ts'], maxWorkers: 1 },
}));
