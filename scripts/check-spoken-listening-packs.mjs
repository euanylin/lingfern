import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { reviewedExcerpt, reviewedAudioHolds } from './corpus-review.mjs';

const directory = process.argv.find(arg => arg.startsWith('--bank-directory='))?.slice(17) ?? 'private/corpus/spoken/listening-packs';
const inventory = JSON.parse(await readFile(`${directory}/inventory.json`, 'utf8'));
const server = await createServer({ cacheDir: 'node_modules/.vite-listening-inspector', server: { middlewareMode: true, hmr: false, ws: false }, mode: 'production' });
try {
  const { inspectCommunityPack } = await server.ssrLoadModule('/src/data/communityPack.ts');
  const { spokenCorpusLesson } = await server.ssrLoadModule('/src/core/spokenCorpus.ts');
  const { score, questions } = await server.ssrLoadModule('/src/shared/content.ts');
  const { reviewedExcerpts } = await server.ssrLoadModule('/src/data/corpus.ts');
  const clipsDirectory = process.argv.find(arg => arg.startsWith('--clips='))?.slice(8) ?? 'private/corpus/spoken/listening-clips';
  const prepared = JSON.parse(await readFile(`${clipsDirectory}/index.json`, 'utf8'));
  const byRoot = new Map(prepared.records.map(record => [record.rootId, record]));
  const raw = JSON.parse(await readFile('private/corpus/spoken/processed.json', 'utf8'));
  const originals = new Map(raw.records.map(record => [record.rootId, record.text]));
  const audioHolds = reviewedAudioHolds(raw.records, prepared.records, JSON.parse(await readFile('private/corpus/spoken/codex-audio-holds.json', 'utf8')));
  const roots = new Set(), clips = new Set(); let generated = 0, flagged = 0;
  for (const entry of inventory.packs) {
    const bytes = await readFile(`${directory}/${entry.id}.zip`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    const pack = await inspectCommunityPack(bytes);
    assert.equal(pack.lessons.length, 0); assert(pack.spoken);
    for (const record of pack.spoken.records) {
      assert(!roots.has(record.rootId)); roots.add(record.rootId);
      assert.equal(record.originalText, originals.get(record.rootId));
      assert.deepEqual(await reviewedExcerpts(record, record.clips), record.clips, 'Actual client review filtering must retain every prepared current clip');
      for (const clip of record.clips) {
        assert(reviewedExcerpt(originals.get(record.rootId), clip.text, inventory.textReview?.excludedSpans?.[record.rootId]));
        const excluded = new Set((inventory.textReview?.excludedTargets?.[record.rootId] ?? []).map(word => word.toLowerCase()));
        if (excluded.size) assert(clip.language, 'Reviewed target exclusions require language metadata');
        for (const token of clip.language?.tokens ?? []) assert(!excluded.has(clip.text.slice(token.start, token.end).toLowerCase()));
        assert.deepEqual(clip.qualityFlags, [...byRoot.get(record.rootId).qualityFlags, ...(audioHolds.has(clip.id) ? [audioHolds.get(clip.id)] : [])]);
        if (clip.qualityFlags.length) flagged++;
        assert(!clips.has(clip.id)); clips.add(clip.id);
        assert(clip.audio.src.startsWith(`/audio/community-${pack.hash}/`));
        assert(clip.credit.attribution.includes('Recording:'));
      }
    }
    const seen = new Set();
    for (let seed = 0; seed < Math.min(8, Math.floor(pack.spoken.records.filter(record => record.clips.some(clip => !clip.qualityFlags.length)).length / 2)); seed++) {
      const lesson = spokenCorpusLesson(pack.spoken, seen, seed, 91);
      assert(lesson && lesson.skill === 'listening' && lesson.communityPackageId === pack.hash && lesson.reviewStatus === 'draft');
      assert.equal(new Set(lesson.materials.map(material => material.rootId)).size, 2);
      for (const { question } of questions(lesson)) assert.equal(score(question, question.kind === 'response' ? 'Source-supported interpretation.' : question.kind === 'sequence' ? question.acceptedOrders[0] : question.kind === 'evidence' ? question.accepted[0] : question.kind === 'matching' ? question.pairs.map(pair => pair.answer) : question.kind === 'table' ? question.rows.map(row => row.answer) : question.answer).correct, question.kind === 'response' ? null : true);
      for (const material of lesson.materials) { assert.equal(byRoot.get(material.rootId).qualityFlags.length, 0); assert(!seen.has(material.id.slice(7))); seen.add(material.id.slice(7)); }
      generated++;
    }
    assert.equal(Object.keys(pack.media).length, pack.spoken.records.reduce((sum, record) => sum + record.clips.length, 0));
  }
  if (inventory.textReview) for (const root of inventory.textReview.withheld) assert(!roots.has(root));
  assert.equal(roots.size, inventory.roots); assert.equal(clips.size, inventory.clips);
  const result = { verifiedAt: new Date().toISOString(), roots: roots.size, clips: clips.size, packs: inventory.packs.length, locallyGeneratedLessons: generated, flaggedClipsWithheld: flagged, independentlyReviewed: 0, published: false };
  await writeFile(`${directory}/verification.json`, JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result));
} finally { await server.close(); }
