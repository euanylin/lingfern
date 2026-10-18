import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { reviewedExcerpt } from './corpus-review.mjs';

const directory = process.argv.find(arg => arg.startsWith('--bank-directory='))?.slice(17) ?? 'private/corpus/spoken/reading-packs';
const inventory = JSON.parse(await readFile(`${directory}/inventory.json`, 'utf8'));
const server = await createServer({ cacheDir: 'node_modules/.vite-reading-inspector', server: { middlewareMode: true, hmr: false, ws: false }, mode: 'production' });
try {
  const { inspectCommunityPack } = await server.ssrLoadModule('/src/data/communityPack.ts');
  const { corpusLesson, corpusRequests, corpusRoleActions, corpusViewpoints } = await server.ssrLoadModule('/src/core/corpus.ts');
  const { score, questions } = await server.ssrLoadModule('/src/shared/content.ts');
  const roots = new Set();
  let passages = 0, generated = 0, sequences = 0, qualifications = 0, attributions = 0, requests = 0, roles = 0, viewpoints = 0;
  const verify = lesson => {
    for (const { material, question } of questions(lesson)) {
      if (question.kind === 'sequence') { sequences++; assert.equal(score(question, question.steps).correct, false); }
      if (question.kind === 'table') {
        const spans = [question.evidence, ...(question.additionalEvidence ?? [])];
        const text = material.blocks.find(block => block.id === question.blockId).text;
        for (const [index, row] of question.rows.entries()) {
          const span = spans[index];
          assert(span && text.slice(span.start, span.end).includes(row.answer));
          if (row.label.includes('________')) assert.equal(row.label.replace('________', row.answer), text.slice(span.start, span.end));
        }
        assert.equal(score(question, question.rows.map(() => 'missing')).correct, false);
      }
      assert.equal(score(question, question.kind === 'response' ? 'An interpretation supported by the source.' : question.kind === 'sequence' ? question.acceptedOrders[0] : question.kind === 'evidence' ? question.accepted[0] : question.kind === 'table' ? question.rows.map(row => row.answer) : question.kind === 'matching' ? question.pairs.map(pair => pair.answer) : question.answer).correct, question.kind === 'response' ? null : true);
    }
  };
  for (const entry of inventory.packs) {
    const bytes = await readFile(`${directory}/${entry.id}.zip`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    const pack = await inspectCommunityPack(bytes);
    assert.equal(pack.lessons.length, 0);
    assert.equal(Object.keys(pack.media).length, 0);
    for (const record of pack.corpus.records) {
      assert(!roots.has(record.rootId)); roots.add(record.rootId);
      assert(record.originalText && record.passages.every(passage => record.originalText.includes(passage.text)));
      const excluded = new Set((inventory.textReview?.excludedTargets?.[record.rootId] ?? []).map(word => word.toLowerCase()));
      for (const passage of record.passages) {
        const request = corpusRequests(passage.text, 0);
        if (request) { requests++; assert.equal(passage.text.slice(request.evidence.start, request.evidence.end), request.sentence); }
        const role = corpusRoleActions(passage.text, 0);
        if (role) { roles++; assert.equal(passage.text.slice(role.evidence.start, role.evidence.end), role.sentence); }
        const comparison = corpusViewpoints(passage.text, 0);
        if (comparison) { viewpoints++; for (const span of [comparison.evidence, ...comparison.otherEvidence]) assert.match(passage.text.slice(span.start, span.end), /^According to /); }
        assert(reviewedExcerpt(record.originalText, passage.text, inventory.textReview?.excludedSpans?.[record.rootId]));
        if (excluded.size) assert(passage.language, 'Reviewed target exclusions require language metadata');
        for (const token of passage.language?.tokens ?? []) assert(!excluded.has(passage.text.slice(token.start, token.end).toLowerCase()));
      }
      passages += record.passages.length;
    }
    const lesson = corpusLesson(pack.corpus, new Set(), 0, 500);
    assert(lesson);
    for (const material of lesson.materials) assert(material.credit?.license.includes('CC BY-SA'));
    verify(lesson);
    for (let seed = 1; seed <= 12; seed++) {
      const candidate = corpusLesson(pack.corpus, new Set(), seed, 500);
      if (candidate) verify(candidate);
      for (const material of candidate?.materials ?? []) for (const question of material.questions) if (question.id.endsWith('-qualify')) {
        if (question.prompt === 'Which sentence explicitly attributes a claim to a named source?') attributions++;
        else qualifications++;
        assert.equal(score(question, question.accepted[0]).correct, true);
        const text = material.blocks.find(block => block.id === question.blockId).text;
        for (const span of question.spans) assert.equal(text.slice(span.start, span.end), span.text);
      }
    }
    generated++;
  }
  if (inventory.textReview) for (const root of inventory.textReview.withheld) assert(!roots.has(root));
  assert.equal(roots.size, inventory.roots); assert.equal(passages, inventory.passages);
  assert(sequences > 0, 'Actual reading banks must exercise source-order generation');
  assert(qualifications > 0, 'Actual reading banks must exercise qualification generation');
  const result = { verifiedAt: new Date().toISOString(), roots: roots.size, passages, packs: inventory.packs.length, locallyGeneratedLessons: generated, sourceSequenceTasks: sequences, sourceQualificationTasks: qualifications, sourceAttributionTasks: attributions, sourceRequestCandidates: requests, sourceRoleCandidates: roles, sourceViewpointCandidates: viewpoints, audioIncluded: 0, published: false };
  await writeFile(`${directory}/verification.json`, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { await server.close(); }
