import { readSourcePackFixture } from './fixtures/source-pack-regression';
import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { expect, it } from 'vitest';
import { spokenCondition, spokenConditionPrompt } from '../src/core/spokenCondition';
import { spokenCorpusLesson, spokenCorpusSchema } from '../src/core/spokenCorpus';
import { score } from '../src/shared/content';

it('rejects inherited conditional distractors and incomplete or indirect condition cues', () => {
  const target = 'If the temperature rises, the equipment stops working.';
  expect(spokenCondition(target + ' The same goes for the next unit, and so on. This equipment is checked every morning.', 0)).toBeUndefined();
  const alternatives = 'The building opened in March. Engineers monitor the equipment every morning.';
  for (const sentence of ['Engineers check if the equipment works.', 'Even if the temperature rises, the equipment works.', 'If the temperature rises.']) expect(spokenCondition(sentence + ' ' + alternatives, 0)).toBeUndefined();
  expect(spokenCondition(target + ' ' + target + ' ' + alternatives, 0)).toBeUndefined();
  expect(() => spokenCondition(target, -1)).toThrow('INVALID_SPOKEN_CONDITION');
});

it('retains a postposed condition with its complete outcome and excludes indirect or quoted cues', () => {
  const target = 'The gate opens for visitors, if the green button is pressed.';
  const alternatives = 'The building opened in March. Engineers monitor the equipment every morning.';
  for (const seed of [0, 1, 2]) {
    const task = spokenCondition(target + ' ' + alternatives, seed)!;
    expect(task.spans[task.accepted[0]].text).toBe(target);
    expect(task.evidence).toEqual({ start: 0, end: target.length });
  }
  for (const sentence of ['The technician asks a question, "if the gate is open".', 'The visitor checks, to see if the gate is open.', 'The technician wondered, if the green button was pressed.', 'The gate stays open, even if the button is pressed.', 'The gate opens, if the button is pressed, unless it is locked.']) {
    expect(spokenCondition(sentence + ' ' + alternatives, 0)).toBeUndefined();
  }
});

it('generates exact timed conditions from the actual catalogue, preserving scoring, context and exposure', () => {
  const catalogue = JSON.parse(readFileSync('content/source-packs.json', 'utf8')) as { packs: { skill: string; path: string; sha256: string }[] };
  let count = 0;
  for (const entry of catalogue.packs.filter(pack => pack.skill === 'listening')) {
    const raw = JSON.parse(new TextDecoder().decode(unzipSync(readFileSync('public' + entry.path), { filter: file => file.name === 'spoken.json' })['spoken.json']));
    const bank = spokenCorpusSchema.parse({ ...raw, communityPackageId: entry.sha256, records: raw.records.map((source: { clips: { audio: { src: string } }[] }) => ({ ...source, clips: source.clips.map(clip => ({ ...clip, audio: { ...clip.audio, src: clip.audio.src.replace(/^media\//, `/audio/community-${entry.sha256}/`) } })) })) });
    for (const source of bank.records) for (const clip of source.clips) {
      if (clip.qualityFlags.length || !spokenCondition(clip.text, 0)) continue;
      if (clip.audio.duration > 91) {
        const bounded = spokenCorpusLesson(bank, new Set(), 0, 91, 'C2', [], 'evidence', `evidence:${spokenConditionPrompt}`);
        expect(bounded?.materials.some(part => part.id === `corpus-${clip.id}`) ?? false).toBe(false);
        continue;
      }
      count++;
      const seen = new Set(bank.records.flatMap(record => record.clips.filter(other => other.id !== clip.id && record.rootId === source.rootId).map(other => other.id)));
      const lesson = spokenCorpusLesson(bank, seen, 0, 91, 'C2', [], 'evidence', `evidence:${spokenConditionPrompt}`)!;
      const material = lesson.materials.find(part => part.id === `corpus-${clip.id}`)!;
      expect(material).toBeDefined();
      expect(new Set(lesson.materials.map(part => part.rootId)).size).toBe(2);
      const question = material.questions[0];
      if (!('kind' in question) || question.kind !== 'evidence') throw new Error('Expected conditional evidence');
      expect(question.prompt).toBe(spokenConditionPrompt);
      for (const span of question.spans) expect(clip.text.slice(span.start, span.end)).toBe(span.text);
      expect(question.evidence.audioStart).toBeGreaterThanOrEqual(0);
      expect(question.evidence.audioEnd).toBeLessThanOrEqual(clip.audio.duration);
      expect(score(question, question.accepted[0]).correct).toBe(true);
      expect(score(question, (question.accepted[0] + 1) % 3).correct).toBe(false);
      const response = material.questions[1];
      expect('kind' in response && response.kind).toBe('response');
      expect(response.prompt).toContain('other requirements');
      expect(score(response, 'A learner interpretation.').correct).toBeNull();
      const excluded = spokenCorpusLesson(bank, new Set([clip.id]), 0, 91, 'C2', [], 'evidence', `evidence:${spokenConditionPrompt}`);
      expect(excluded?.materials.some(part => part.id === material.id) ?? false).toBe(false);
      for (const level of ['A1', 'A2'] as const) expect(spokenCorpusLesson(bank, new Set(), 0, 91, level)?.materials.some(part => part.questions[0].prompt === spokenConditionPrompt) ?? false).toBe(false);
    }
  }
  expect(count).toBe(13);
});

it('applies the same conditional operation to two actual package005 roots without reusing exposed clips', async () => {
  const { inspectCommunityPack } = await import('../src/data/communityPack');
  const bank = (await inspectCommunityPack(readSourcePackFixture('wikipedia-listening-005'))).spoken!;
  for (let seed = 0; seed < 8; seed++) {
    const lesson = spokenCorpusLesson(bank, new Set(), seed, 60, 'B2', [], 'evidence', `evidence:${spokenConditionPrompt}`)!;
    expect(lesson.materials.map(material => material.title).sort()).toEqual(['Colocation centre', 'Cookie Clicker']);
    for (const material of lesson.materials) expect(material.questions[0].prompt).toBe(spokenConditionPrompt);
    const seen = new Set(lesson.materials.map(material => material.id.slice('corpus-'.length)));
    const next = spokenCorpusLesson(bank, seen, seed, 60, 'B2', [], 'evidence', `evidence:${spokenConditionPrompt}`);
    expect(next?.materials.every(material => !seen.has(material.id.slice('corpus-'.length))) ?? true).toBe(true);
    expect(next?.materials.some(material => material.questions[0].prompt === spokenConditionPrompt) ?? false).toBe(false);
  }
});
