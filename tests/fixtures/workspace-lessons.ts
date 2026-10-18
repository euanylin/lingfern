import { readFileSync } from 'node:fs';
import type { Lesson } from '../../src/shared/content';
const raw = JSON.parse(readFileSync(new URL('./content/c2-listening.json', import.meta.url), 'utf8')) as Lesson;
/** Isolated UI fixture: losslessly join two speaker blocks; retain the authored audio evidence intervals. */
export function multiGapListening() {
  const lesson = structuredClone(raw), material = lesson.materials[0], original = material.questions[0];
  const offsets = new Map<string, number>(); let text = '';
  for (const block of material.blocks) { if (text) text += '\n\n'; offsets.set(block.id, text.length); text += block.text; }
  const spans = [{ blockId: original.blockId, ...original.evidence }, ...(original.additionalEvidence ?? [])];
  const gaps = spans.map((span, index) => {
    const offset = offsets.get(span.blockId)!, source = text.slice(offset + span.start, offset + span.end);
    const word = /\b[a-z]{6,14}\b/.exec(source)!;
    return { id: `g${index + 1}`, answer: word[0], accepted: [word[0]], maxWords: 1, evidence: { start: offset + span.start + word.index, end: offset + span.start + word.index + word[0].length, audioStart: span.audioStart!, audioEnd: span.audioEnd! } };
  });
  const start = offsets.get(spans[0].blockId)! + spans[0].start, end = offsets.get(spans.at(-1)!.blockId)! + spans.at(-1)!.end; let passage = text.slice(start, end);
  for (const gap of [...gaps].reverse()) passage = passage.slice(0, gap.evidence.start - start) + `{{${gap.id}}}` + passage.slice(gap.evidence.end - start);
  material.blocks = [{ id: 'joined-speakers', text }];
  material.questions = [{ kind: 'gap-fill', id: 'heard-two-gaps', blockId: 'joined-speakers', prompt: 'Complete the extract. Write ONE WORD in each gap.', passage, gaps,
    evidence: { start, end, audioStart: spans[0].audioStart!, audioEnd: spans.at(-1)!.audioEnd! }, hints: original.hints,
    explanation: { en: 'Each word occurs in its cited recorded statement.', 'zh-Hans': 'Each word occurs in its cited recorded statement.', 'zh-Hant': 'Each word occurs in its cited recorded statement.' } }];
  lesson.id = 'isolated-multi-gap-audio'; lesson.organization = 'material-v1';
  return lesson;
}
