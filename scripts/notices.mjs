import { readFile, readdir, mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const credits = JSON.parse(await readFile('content/about-credits.json', 'utf8'));
const audioSources = JSON.parse(await readFile('content/audio-sources.json', 'utf8'));
const wordPages = new Set(JSON.parse(await readFile('public/ipa/SOURCES.json', 'utf8')).map(item => item.source));
const lessonAudio = audioSources.filter(source => !wordPages.has(source.source));
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
await mkdir('public/licenses/lingfern', { recursive: true });
for (const file of ['LICENSE', 'NOTICE', 'BRAND.md', 'LICENSES/CC-BY-4.0.txt']) await copyFile(file, path.join('public/licenses/lingfern', path.basename(file)));
const notices = ['# Installed dependency notices', '', 'Generated from the lockfile and packages actually installed on this machine. Platform-specific optional packages not installed are omitted. Original terms remain authoritative. Project content and logos have separate release terms.', ''];
const development = ['# Development dependency notices', '', 'Build/test tools are not shipped in the frontend except selected Workbox components, which also appear in the runtime notices. Entries without bundled license text are explicitly marked for upstream review before redistribution of those tools. See Issues.md.', ''];
for (const [directory, entry] of Object.entries(lock.packages).sort()) {
  if (!directory) continue;
  let pkg;
  try { pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && entry.optional) continue; throw error; }
  const id = `${pkg.name.replaceAll('/', '__')}@${pkg.version}`;
  const files = (await readdir(directory)).filter(name => /^(licen[sc]e|notice|copying)([.-]|$)/i.test(name));
  if (entry.dev) {
    development.push(`## ${pkg.name} ${pkg.version}`, '', `Declared license: ${pkg.license ?? entry.license ?? 'Unknown'}. Source: ${typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url ?? pkg.homepage ?? entry.resolved}`, '');
    if (!files.length && pkg.name === 'wrangler') {
      const source = `https://github.com/cloudflare/workers-sdk/blob/wrangler%40${pkg.version}`;
      development.push(`The installed package omits its license files. The tagged release includes [MIT](${source}/LICENSE-MIT) and [Apache-2.0](${source}/LICENSE-APACHE).`, '');
    } else if (!files.length) development.push('License text not included in this installed package; upstream review pending. Package metadata is not the full license.', '');
    for (const name of files) development.push(`### ${name}`, '', await readFile(path.join(directory, name), 'utf8'), '');
    if (!pkg.name.startsWith('workbox-') || pkg.name === 'workbox-build') continue;
  }
  if (!files.length) throw new Error(`Review missing runtime license files: ${pkg.name}`);
  const target = path.join('public', 'licenses', id);
  await mkdir(target, { recursive: true });
  for (const name of files) await copyFile(path.join(directory, name), path.join(target, name));
  notices.push(`## ${pkg.name} ${pkg.version}`, '', `Scope: ${entry.dev ? 'installed Workbox component; selected modules are bundled in the browser' : 'runtime'}. License: ${pkg.license ?? entry.license ?? 'See original files'}.`, '', `Source: ${typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url ?? pkg.homepage ?? entry.resolved}`, '', ...files.map(name => `- [${name}](licenses/${id}/${name})`), '');
}
notices.push('## Vendored and adapted components', '', ...[...credits.software.filter(project => project.notice), ...credits.syntax]
  .map(({ name, url, license, role, notice }) => `- [${name}](${url}) — ${license}. ${role} [Source and licence notes](${notice.slice(1)}).`), '',
  'Artwork and trademark rights are separate. Parser package notes identify the exact model and source versions. ONNX Runtime ships its original [MIT licence](licenses/onnxruntime-web@1.31.1/LICENSE) and third-party notices. The Charniak pack retains its [Apache-2.0 licence](resources/tree-constituency-v1/LICENSE.txt), original NOTICE and [libc++abi licence](resources/tree-constituency-v1/LICENSE-libcxxabi.txt). The adapted tokenizer retains its [NLTK attribution](licenses/nltk-treebank/AUTHORS.md).', '',
  'The movement editor’s drop interaction references [Hierplane](https://github.com/allenai/hierplane) (Apache-2.0). The MIT tidy-layout port credits A.J. van der Ploeg’s [Java algorithm](https://github.com/cwi-swat/non-layered-tidy-trees/blob/e84be1bb8cc825fbe16ff000443cb8cf25ce8dd8/treelayout/algorithm/Paper.java#L3-L8), whose source header declares it public domain. Lingfern’s phrase-head heuristics use category labels described in the [Penn Treebank II bracketing guidelines](https://languagelog.ldc.upenn.edu/myl/PennTreebank1995.pdf).', '');
notices.push('## Dictionary', '', '[Open English WordNet 2025](dictionary/oewn-2025/README.md): [CC BY 4.0](dictionary/oewn-2025/LICENSE.md), with the inherited [Princeton WordNet licence](dictionary/oewn-2025/WNDB_License.txt). Local adaptation and attribution are documented with the dictionary.', '');
notices.push('## Reading and listening sources', '', 'Individual author/source/edition and adaptation credits are retained with materials and in each downloaded source package. This index does not clear excluded or held material or replace source-specific territorial limits.', '', ...credits.corpora.map(source => `- [${source.name}](${source.url}): ${source.terms}.`), '', 'Retained edition and processing notices: [open reading](corpus/open-reading-NOTICE.md), [reading expansion](corpus/reading-expansion-NOTICE.md), [LibriSpeech](corpus/librispeech-NOTICE.md), [Project Gutenberg](corpus/gutenberg-license.txt), [VOA](corpus/VOA-LICENSE.txt).', '');
notices.push('## Lesson word and speech recordings', '', 'A1 word listening and IPA chart example words use [Dvortygirl](https://commons.wikimedia.org/wiki/User:Dvortygirl) / Wikimedia Commons recordings, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Per-file credits: [word-recording sources](ipa/SOURCES.json).', '', ...lessonAudio.map(source => `- [${source.title}](${source.source}) — ${source.author}. [${source.license}](${source.licenseUrl}). ${source.changes}`), '');
notices.push('## IPA chart classification', '', `${credits.ipaClassification.copyright} [Source and reuse terms](${credits.ipaClassification.url}). ${credits.ipaClassification.changes} [Local licence](ipa/CC-BY-SA-4.0.txt). Accessed 2026-10-18. Layout reference: https://www.ipachart.com/ ; no site code, fonts, artwork or recordings copied from that site.`, '');
notices.push('## IPA sound recordings', '', 'Individual Wikimedia Commons credits, source links, original hashes, conversions and CC BY-SA 3.0 / CC BY-SA 4.0 / CC0 / public-domain status: [IPA phoneme sources](ipa/PHONEME_SOURCES.json). Each recording retains its own source licence.', '');
notices.push('## Daily quotations', '', 'English Wikiquote is the sole quotation source. Page/revision links retain attribution; Wikiquote editorial arrangement remains CC BY-SA 4.0. Underlying quotations retain their separate rights. Scope, changes and source-work checks: [daily quote notices](daily-quotes/README.md).', '');
await writeFile('public/THIRD_PARTY_NOTICES.md', notices.join('\n'));
await writeFile('Dependency_Notices.md', development.join('\n'));
console.log('Generated actual installed dependency notices and retained original license/NOTICE files.');
