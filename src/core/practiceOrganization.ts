import { lessonSchema, correctAnswerText, type Lesson, type Question, type CorpusQuestionKind } from '../shared/content';
import { corpusDates, corpusRestoration, restorationWords } from './corpus';
import { sentenceSegments } from './corpusSegments';
import type { SpokenCorpus } from './spokenCorpus';

// Bound effort without CEFR calibration or fill quotas.
export const practiceBudgets = {
  readingBands: [[250, 3, 6], [500, 6, 10], [900, 10, 16], [Infinity, 14, 24]],
  levelMinutes: { A1: 9, A2: 12, B1: 16, B2: 20, C1: 25, C2: 30 },
  maxMinutes: 35, maxQuestions: 32, maxRestorations: 12,
  listening: { baseSpacing: 9, minimumSpacing: 6, maximumSpacing: 14, inputSeconds: 3, maxGaps: 8 },
} as const;
type Material = Lesson['materials'][number];
type Alignment = { start: number; end: number; audioStart: number; audioEnd: number; text: string };
const english = (text: string) => ({ en: text, 'zh-Hans': text, 'zh-Hant': text });
const support = [english('Find the source sentence.'), english('Keep the words around the gap together.'), english('Check the exact source wording and spelling.')];

export function readingQuestionPlan(material: Material, level: Lesson['targetLevel'], themes: Lesson['themes'] = []) {
  const text = material.blocks.map(block => block.text).join('\n\n');
  const tokens = text.match(/\b[a-z]+\b/gi) ?? [];
  const paragraphs = text.split(/\n\s*\n/).filter(Boolean).length;
  const sentences = sentenceSegments(text);
  const complexity = tokens.filter(word => word.length >= 9).length / Math.max(tokens.length, 1);
  const relations = (text.match(/\b(?:because|however|although|therefore|whereas|unless|according)\b/gi) ?? []).length;
  const facts = (text.match(/\b\d+(?:\.\d+)?\b/g) ?? []).length;
  const genre = /dialogue|conversation|story|novel|tale/i.test(material.title) ? 'narrative' : /report|research|science|study/i.test(material.title) || themes.some(theme => ['science', 'technology', 'history', 'environment', 'nature'].includes(theme)) ? 'expository' : 'general';
  const [, low, high] = practiceBudgets.readingBands.find(([limit]) => tokens.length < limit)!;
  const useful = [...new Set(sentences.map(sentence => sentence.segment.trim().replace(/\s+/g, ' ')))].filter(sentence => corpusRestoration(sentence, 0, undefined, level === 'A1' || level === 'A2')).length;
  const effort = level === 'A1' || level === 'A2' ? 1.5 : 1;
  const minutes = Math.min(practiceBudgets.maxMinutes, practiceBudgets.levelMinutes[level]);
  const extra = tokens.length >= 900 && paragraphs >= 8 && relations + facts >= 8 ? Math.min(6, Math.floor(Math.max(0, useful - high) / 4)) : 0;
  const desired = extra + Math.round(low + Math.min(high - low, (paragraphs - 1) * .7 + relations * .25 + facts * .15 + (genre === 'expository' ? .5 : 0)) - complexity * 8);
  return { words: tokens.length, paragraphs, complexity, relations, facts, genre, useful, minutes, target: Math.max(material.questions.length, Math.min(desired, useful, Math.floor(minutes / effort), practiceBudgets.maxQuestions)) };
}

export function listeningGapSpacing(words: number, duration: number, level: Lesson['targetLevel']) {
  const settings = practiceBudgets.listening;
  const rate = words / Math.max(duration, 1);
  const support = level === 'A1' || level === 'A2' ? 2 : level === 'C1' || level === 'C2' ? -1 : 0;
  return Math.min(settings.maximumSpacing, Math.max(settings.minimumSpacing, settings.baseSpacing + (rate - 2) * 1.5 + support + settings.inputSeconds));
}

function readingExtras(material: Material, level: Lesson['targetLevel'], seed: number, themes: Lesson['themes']): Question[] {
  const plan = readingQuestionPlan(material, level, themes);
  const needed = Math.min(practiceBudgets.maxRestorations, plan.target - material.questions.length);
  if (needed <= 0) return [];
  const counts = new Map<string, number>();
  for (const block of material.blocks) for (const word of restorationWords(block.text, undefined, level === 'A1' || level === 'A2')) counts.set(word.word, (counts.get(word.word) ?? 0) + 1);
  const candidates = material.blocks.flatMap(block => sentenceSegments(block.text).flatMap(sentence => {
    const words = [...restorationWords(sentence.segment, undefined, level === 'A1' || level === 'A2')];
    const eligible = words.map((word, index) => ({ word, index })).filter(({ word }) => counts.get(word.word) === 1);
    if (!eligible.length) return [];
    const gap = corpusRestoration(sentence.segment, eligible[(seed + sentence.index) % eligible.length].index, undefined, level === 'A1' || level === 'A2');
    if (!gap || sentence.segment.length > 600) return [];
    const start = sentence.index + gap.evidence.start, end = sentence.index + gap.evidence.end;
    if (material.questions.filter(question => !('criteria' in question)).some(question => [{ blockId: question.blockId, ...question.evidence }, ...(question.additionalEvidence ?? [])].some(span => span.blockId === block.id && span.start < sentence.index + sentence.segment.length && span.end > sentence.index))) return [];
    if (material.questions.some(question => question.prompt.toLowerCase().includes(gap.answer.toLowerCase()) || !!correctAnswerText(question) && gap.text.toLowerCase().includes(correctAnswerText(question).toLowerCase()))) return [];
    const paragraph = block.text.slice(0, start).split(/\n\s*\n/).length - 1;
    return [{ block, sentence, gap, start, end, paragraph }];
  }));
  // Scan each paragraph once before adding more; do not repeat sentences or targets.
  const selected: typeof candidates = [], words = new Set<string>();
  for (let pass = 0; selected.length < needed && pass < needed; pass++) {
    const paragraphs = new Set<string>();
    for (const candidate of candidates) {
      const key = `${candidate.block.id}:${candidate.paragraph}`, word = candidate.gap.answer.toLowerCase();
      if (selected.includes(candidate) || words.has(word) || paragraphs.has(key) || selected.some(other => other.gap.text.toLowerCase().includes(word) || candidate.gap.text.toLowerCase().includes(other.gap.answer.toLowerCase()))) continue;
      selected.push(candidate); words.add(word); paragraphs.add(key);
      if (selected.length >= needed) break;
    }
  }
  return selected.sort((a, b) => material.blocks.indexOf(a.block) - material.blocks.indexOf(b.block) || a.start - b.start).map(candidate => ({
    kind: 'completion', id: `${material.id.slice(0, 50)}-word-${material.blocks.indexOf(candidate.block)}-${candidate.start}`, blockId: candidate.block.id,
    prompt: `Complete with one word from the passage.\n${candidate.gap.text.trim()}`, answer: candidate.gap.answer, accepted: [candidate.gap.answer],
    evidence: { start: candidate.start, end: candidate.end }, hints: support,
    explanation: english('The missing word is taken exactly from this source sentence. This checks wording in context; it is not an inferred comprehension score.'),
  }));
}

export function alignedGapQuestion(material: Material, segments: readonly Alignment[], level: Lesson['targetLevel'], seed: number): Question | undefined {
  if (!material.audio || material.blocks.length !== 1) return;
  const block = material.blocks[0], spacing = listeningGapSpacing(block.text.trim().split(/\s+/).length, material.audio.duration, level);
  const frequencies = new Map<string, number>();
  for (const word of restorationWords(block.text, undefined, level === 'A1' || level === 'A2')) frequencies.set(word.word, (frequencies.get(word.word) ?? 0) + 1);
  const chosen: { gap: NonNullable<ReturnType<typeof corpusRestoration>>; segment: Alignment }[] = [];
  const occupied = material.questions.filter(question => !('criteria' in question)).flatMap(question => [question.evidence, ...(question.additionalEvidence ?? [])]);
  const lastObjective = Math.max(0, ...occupied.map(span => span.audioEnd ?? material.audio!.duration));
  for (const segment of segments) {
    if (occupied.length && segment.audioStart < lastObjective + spacing) continue;
    if (block.text.slice(segment.start, segment.end) !== segment.text || segment.audioStart < 0 || segment.audioEnd > material.audio.duration || segment.audioStart >= segment.audioEnd) continue;
    // Use conservative segment bounds without interpolating word times.
    if (occupied.some(span => span.audioStart === undefined || span.audioEnd === undefined || segment.audioStart < span.audioEnd + spacing && segment.audioEnd + spacing > span.audioStart)) continue;
    if (chosen.length && segment.audioStart - chosen.at(-1)!.segment.audioEnd < spacing) continue;
    const words = [...restorationWords(segment.text, undefined, level === 'A1' || level === 'A2')];
    const eligible = words.map((word, index) => ({ word, index })).filter(({ word }) => frequencies.get(word.word) === 1);
    if (!eligible.length) continue;
    const gap = corpusRestoration(segment.text, eligible[(seed + chosen.length) % eligible.length].index, undefined, level === 'A1' || level === 'A2');
    if (!gap || chosen.some(other => other.gap.answer.toLowerCase() === gap.answer.toLowerCase())) continue;
    chosen.push({ gap, segment });
    if (chosen.length >= Math.min(practiceBudgets.listening.maxGaps, Math.floor(material.audio.duration / spacing))) break;
  }
  if (chosen.length < 2) return;
  const start = chosen[0].segment.start, end = chosen.at(-1)!.segment.end;
  const gaps = chosen.map(({ gap, segment }, index) => ({ id: `g${index + 1}`, answer: gap.answer, accepted: [gap.answer], maxWords: 1, evidence: { start: segment.start + gap.evidence.start, end: segment.start + gap.evidence.end, audioStart: segment.audioStart, audioEnd: segment.audioEnd } }));
  let passage = block.text.slice(start, end);
  for (const gap of [...gaps].reverse()) passage = passage.slice(0, gap.evidence.start - start) + `{{${gap.id}}}` + passage.slice(gap.evidence.end - start);
  return { kind: 'gap-fill', id: `${material.id.slice(0, 60)}-gaps`, blockId: block.id, prompt: 'Complete the recording extract. Write ONE WORD in each gap.', passage, gaps,
    evidence: { start, end, audioStart: chosen[0].segment.audioStart, audioEnd: chosen.at(-1)!.segment.audioEnd }, hints: support,
    explanation: english('Each missing word is present in the recording. Time ranges identify verified aligned segments, not estimated word timestamps.') };
}

export function organizePractice(raw: Lesson, banks: readonly SpokenCorpus[] = [], kinds: readonly CorpusQuestionKind[] = []): Lesson {
  const lesson = structuredClone(lessonSchema.parse(raw));
  if (lesson.mode === 'check' || lesson.organization) return lesson;
  const level = lesson.generation?.generator === 'corpus-v1' ? lesson.generation.startingPoint ?? lesson.targetLevel : lesson.targetLevel;
  const seed = lesson.generation?.seed ?? 0;
  lesson.organization = 'material-v1';
  for (const material of lesson.materials) {
    if (lesson.skill === 'reading') {
      const plan = readingQuestionPlan(material, level, lesson.themes);
      for (const block of material.blocks) {
        if (kinds.length && !kinds.includes('table')) break;
        if (material.questions.length >= plan.target || block.text.length > 12000) break;
        const dates = corpusDates(block.text, seed);
        if (!dates) continue;
        const spans = [dates.evidence, ...dates.otherEvidence];
        if (material.questions.filter(question => !('criteria' in question)).some(question => [{ blockId: question.blockId, ...question.evidence }, ...(question.additionalEvidence ?? [])].some(other => other.blockId === block.id && spans.some(span => span.start < other.end && span.end > other.start)))) continue;
        material.questions.push({ kind: 'table', id: `${material.id.slice(0, 48)}-dates-${material.blocks.indexOf(block)}`, blockId: block.id, prompt: 'Complete each event with its year from the passage. Keep the timing qualifications.', rows: dates.rows, evidence: dates.evidence, additionalEvidence: dates.otherEvidence.map(span => ({ ...span, blockId: block.id })), hints: support, explanation: english('Each date belongs to its quoted event. Words such as before, around and until do not establish an exact event date or a cause.') });
      }
      if (!kinds.length || kinds.includes('completion')) material.questions.push(...readingExtras(material, level, seed, lesson.themes));
    }
    else {
      const clip = banks.flatMap(bank => bank.records.flatMap(record => record.clips)).find(clip => material.audio?.sha256 === clip.audio.sha256 && material.audio.duration === clip.audio.duration && material.blocks[0].text === clip.text);
      const extra = (!kinds.length || kinds.includes('completion')) && clip && alignedGapQuestion(material, clip.segments, level, seed);
      if (extra) material.questions.push(extra);
      material.questions.sort((a, b) => Number('criteria' in a) - Number('criteria' in b) || (a.evidence.audioStart ?? 0) - (b.evidence.audioStart ?? 0));
    }
  }
  return lessonSchema.parse(lesson);
}
