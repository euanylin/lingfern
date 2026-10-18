import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { expect, it } from 'vitest';
import { spokenAttributionPairs, spokenAttributionMatchingPrompt } from '../src/core/spokenAttribution';
import { spokenCorpusLesson, spokenCorpusSchema } from '../src/core/spokenCorpus';
import { score } from '../src/shared/content';

it('rejects non-claims, incomplete quotations and duplicate source identities', () => {
  const claim = 'Maya said the service might open next month.';
  for (const other of ['Homer says nothing at the wedding.', 'Maya argued the service would open later this year.', 'Noah said "the service would open next month.', 'Noah said the service might open next month.']) expect(spokenAttributionPairs(claim + ' ' + other, 0)).toBeUndefined();
  const other = 'Noah argued the opening depended on further funding.';
  const text = claim + ' ' + other;
  expect(spokenAttributionPairs(text, 1)?.pairs).toEqual(spokenAttributionPairs(text, 0)?.pairs.toReversed());
  expect(() => spokenAttributionPairs(text, -1)).toThrow('INVALID_SPOKEN_ATTRIBUTION');
});

it('generates exact timed named-source matching from the actual catalogue, preserving scoring, context and exposure', () => {
  const catalogue = JSON.parse(readFileSync('content/source-packs.json', 'utf8')) as { packs: { skill: string; path: string; sha256: string }[] };
  const inspected = new Set<string>();
  for (const entry of catalogue.packs.filter(pack => pack.skill === 'listening')) {
    const raw = JSON.parse(new TextDecoder().decode(unzipSync(readFileSync('public' + entry.path), { filter: file => file.name === 'spoken.json' })['spoken.json']));
    const bank = spokenCorpusSchema.parse({ ...raw, communityPackageId: entry.sha256, records: raw.records.map((source: { clips: { audio: { src: string } }[] }) => ({ ...source, clips: source.clips.map(clip => ({ ...clip, audio: { ...clip.audio, src: clip.audio.src.replace(/^media\//, `/audio/community-${entry.sha256}/`) } })) })) });
    for (const source of bank.records) for (const clip of source.clips) {
      if (clip.qualityFlags.length || !spokenAttributionPairs(clip.text, 0)) continue;
      inspected.add(source.rootId + ':' + clip.id);
      const seen = new Set(bank.records.flatMap(record => record.clips.filter(other => other.id !== clip.id && record.rootId === source.rootId).map(other => other.id)));
      const lesson = spokenCorpusLesson(bank, seen, 0, 91, 'C2', [], 'matching', [], `matching:${spokenAttributionMatchingPrompt}`)!;
      const material = lesson.materials.find(part => part.id === `corpus-${clip.id}`)!;
      expect(material).toBeDefined();
      expect(new Set(lesson.materials.map(part => part.rootId)).size).toBe(2);
      const question = material.questions[0];
      if (!('kind' in question) || question.kind !== 'matching') throw new Error('Expected named-source matching');
      expect(question.prompt).toBe(spokenAttributionMatchingPrompt);
      const spans = [question.evidence, ...question.additionalEvidence!];
      for (const [index, pair] of question.pairs.entries()) {
        const evidence = clip.text.slice(spans[index].start, spans[index].end);
        if (['gutenberg-book-10123', 'gutenberg-book-9745'].includes(source.rootId)) { expect(evidence).toContain(pair.answer); expect(pair.label).not.toContain(pair.answer); }
        else expect(evidence).toBe(`${pair.answer} ${pair.label}`);
      }
      expect([...question.choices].sort()).toEqual(question.pairs.map(pair => pair.answer).sort());
      expect(question.evidence.audioStart).toBeGreaterThanOrEqual(0);
      expect(question.evidence.audioEnd).toBeLessThanOrEqual(clip.audio.duration);
      expect(score(question, question.pairs.map(pair => pair.answer)).correct).toBe(true);
      expect(score(question, question.pairs.map(pair => pair.answer).reverse()).correct).toBe(false);
      const response = material.questions[1];
      expect('kind' in response && response.kind).toBe('response');
      expect(response.prompt).toContain('surrounding context');
      expect(score(response, 'A learner interpretation.').correct).toBeNull();
      const excluded = spokenCorpusLesson(bank, new Set([clip.id]), 0, 91, 'C2', [], 'matching', [], `matching:${spokenAttributionMatchingPrompt}`);
      expect(excluded?.materials.some(part => part.id === material.id) ?? false).toBe(false);
      for (const level of ['A1', 'A2'] as const) expect(spokenCorpusLesson(bank, new Set(), 0, 91, level)?.materials.some(part => part.questions[0].prompt === spokenAttributionMatchingPrompt) ?? false).toBe(false);
    }
  }
  expect([...inspected].sort()).toEqual([
  "gutenberg-book-10123:76f5439a53548b5b3b33b1fa1b007bba2c4ed7c1ea9e4a1cb334c21ae53c552c",
  "gutenberg-book-9745:947c953b6370f2683f0272bc633e4f96df9a2aec8eb7b48b6df1b1763126e9d6",
  "wikipedia-article-14018:c3b601b275b9af35c57f39a684c19438098864878ae2266fcddfa130d119bc8c",
  "wikipedia-article-18855029:6722154a8bbcd422813b468976c9552cb65b252d61130f9eba2347174470ca16",
  "wikipedia-article-18855029:b7ebddc9c6e679b45415e87010c3ef4fd80f88cad39617aefc69b91706ff3665",
  "wikipedia-article-18855029:dea3c4cad36eabd94543aa2c09712a43ad08eadc0778c40e8f0f4729f4a8db25",
  "wikipedia-article-24495502:0b6b27a185c252601537f20d44d23f03c2137ceb35116bf2b6e17df3eef35624",
  "wikipedia-article-24495502:5d3b62beeccc937d58bb5a618fe25a33a4c3699eb782be0466371515e0d967f6"
]);
});
