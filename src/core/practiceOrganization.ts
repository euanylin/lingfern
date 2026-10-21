import { lessonSchema, type Lesson, type Question, type CorpusQuestionKind } from '../shared/content';
import { afterListeningQuestion, answerPointCount, englishWords, listeningSpacing, quantityBudget, quantityRevision, questionSlots, readingBody, readingWordCount } from '../shared/practiceQuantity';
import { corpusCondition, corpusConcession, corpusEvaluation, corpusQualification, corpusDates, corpusOutcome, corpusRestoration, corpusSequence, restorationWords } from './corpus';
import { sentenceSegments } from './corpusSegments';
import type { SpokenCorpus } from './spokenCorpus';

type Material = Lesson['materials'][number];
type Alignment = { start: number; end: number; audioStart: number; audioEnd: number; text: string };
type Span = Question['evidence'] & { blockId: string };
const english = (text: string) => ({ en: text, 'zh-Hans': text, 'zh-Hant': text });
const support = [english('Find the source sentence.'), english('Keep the words around the answer together.'), english('Check the exact source wording.')];
const references = (question: Question): Span[] => [{ blockId: question.blockId, ...question.evidence }, ...(question.additionalEvidence ?? [])];
const globalQuestion = afterListeningQuestion;
const questionKind = (question: Question) => 'kind' in question ? question.kind === 'gap-fill' ? 'completion' : question.kind : 'choice';
const heavyQuestion = (question: Question) => 'rows' in question || 'pairs' in question || 'criteria' in question || question.prompt.length > 240 || 'options' in question && question.options.join(' ').length > 320 || 'kind' in question && question.kind === 'completion' && englishWords(question.answer).length > 2;

export function readingQuestionPlan(material: Material, level: Lesson['targetLevel'], themes: Lesson['themes'] = []) {
  const body = readingBody(material), text = body.map(part => part.text).join('\n\n'), tokens = englishWords(text);
  const complexity = tokens.filter(word => word.length >= 9).length / Math.max(tokens.length, 1);
  const relations = (text.match(/\b(?:because|however|although|therefore|whereas|unless|according)\b/gi) ?? []).length;
  const facts = (text.match(/\b\d+(?:\.\d+)?\b/g) ?? []).length;
  const genre = /dialogue|conversation|story|novel|tale/i.test(material.title) ? 'narrative' : /report|research|science|study/i.test(material.title) || themes.some(theme => ['science', 'technology', 'history', 'environment', 'nature'].includes(theme)) ? 'expository' : 'general';
  const useful = new Set(sentenceSegments(text).filter(sentence => sentence.segment.length <= 600 && corpusRestoration(sentence.segment, 0, undefined, level === 'A1' || level === 'A2')).map(sentence => sentence.segment.trim().toLowerCase())).size;
  const budget = quantityBudget('reading', tokens.length);
  return { words: tokens.length, paragraphs: body.length, complexity, relations, facts, genre, useful, minutes: level === 'A1' || level === 'A2' ? 12 : 30, ...budget, target: budget.baseline };
}

export function listeningGapSpacing(_words: number, _duration: number, level: Lesson['targetLevel']) { return listeningSpacing(level).minimum; }
function spread<T>(items: readonly T[], maximum: number): T[] { return items.length <= maximum ? [...items] : Array.from({ length: maximum }, (_, index) => items[Math.round(index * (items.length - 1) / (maximum - 1))]); }
function responseParts(question: Question): Question {
  if (!('criteria' in question) || question.parts) return question;
  const numbered = [...question.prompt.matchAll(/(?:^|\n)\s*\d+[.)]\s+([^]*?)(?=\n\s*\d+[.)]\s+|$)/g)].map(match => match[1]), questions = question.prompt.match(/[^?]+\?/g) ?? [];
  const parts = numbered.length > 1 ? numbered : questions.length > 1 ? [...questions.slice(0, -1), question.prompt.slice(questions.slice(0, -1).join('').length)] : [];
  return parts.length >= 2 && parts.length <= 12 ? { ...question, parts: parts.map(part => part.trim()) } : question;
}

function candidates(material: Material, level: Lesson['targetLevel'], seed: number, kinds: readonly CorpusQuestionKind[]) {
  const result: Question[] = [], body = readingBody(material), allowed = (kind: CorpusQuestionKind) => !kinds.length || kinds.includes(kind);
  const frequencies = new Map<string, number>();
  for (const part of body) for (const sentence of sentenceSegments(part.text)) if (sentence.segment.length <= 12000) for (const word of restorationWords(sentence.segment, undefined, level === 'A1' || level === 'A2')) frequencies.set(word.word, (frequencies.get(word.word) ?? 0) + 1);
  const sentences = body.flatMap(part => sentenceSegments(part.text).map(sentence => ({ blockId: part.blockId, start: part.start + sentence.index, text: sentence.segment })));
  for (const sentence of spread(sentences, 160)) {
    if (sentence.text.length > 600 || !englishWords(sentence.text).length) continue;
    const id = `${material.id.slice(0, 40)}-extra-${material.blocks.findIndex(block => block.id === sentence.blockId)}-${sentence.start}`;
    if (allowed('completion')) {
      const words = [...restorationWords(sentence.text, undefined, level === 'A1' || level === 'A2')];
      const eligible = words.map((word, index) => ({ word, index })).filter(({ word }) => frequencies.get(word.word) === 1), word = eligible[(seed + sentence.start) % eligible.length];
      const gap = word && corpusRestoration(sentence.text, word.index, undefined, level === 'A1' || level === 'A2');
      if (gap) result.push({ kind: 'completion', id, blockId: sentence.blockId, prompt: `Complete with one word from the passage.\n${gap.text.trim()}`, answer: gap.answer, accepted: [gap.answer], evidence: { start: sentence.start + gap.evidence.start, end: sentence.start + gap.evidence.end }, hints: support, explanation: english('The answer is taken exactly from this source sentence. This checks wording in context, not an inferred comprehension score.') });
    }
    if (allowed('choice')) {
      const choice = corpusOutcome(sentence.text, seed);
      if (choice) result.push({ id: `${id}-choice`, blockId: sentence.blockId, prompt: choice.prompt, options: choice.options, answer: choice.answer, evidence: { start: sentence.start + choice.evidence.start, end: sentence.start + choice.evidence.end }, hints: support, explanations: choice.explanations.map(english) });
    }
  }
  for (const part of spread(body, 40)) {
    if (part.text.length > 12000) continue;
    if (allowed('evidence')) for (const [index, generate] of [corpusCondition, corpusConcession, corpusEvaluation, corpusQualification].entries()) {
      const task = generate(part.text, seed);
      if (task) result.push({ kind: 'evidence', id: `${material.id.slice(0, 40)}-meaning-${part.start}-${index}`, blockId: part.blockId, prompt: task.prompt, spans: task.spans.map(span => ({ ...span, blockId: part.blockId, start: part.start + span.start, end: part.start + span.end })), accepted: task.accepted, evidence: { start: part.start + task.evidence.start, end: part.start + task.evidence.end }, hints: support, explanation: english(task.explanation) });
    }
    if (allowed('table')) {
      const dates = corpusDates(part.text, seed);
      if (dates) {
        const points = dates.rows.map((row, index) => ({ row, span: [dates.evidence, ...dates.otherEvidence][index] })).sort((a, b) => a.span.start - b.span.start);
        result.push({ kind: 'table', id: `${material.id.slice(0, 40)}-dates-${part.blockId.slice(-8)}-${part.start}`, blockId: part.blockId, prompt: 'Complete each event with its stated year. Keep the timing qualifications.', rows: points.map(point => point.row), evidence: { start: part.start + points[0].span.start, end: part.start + points[0].span.end }, additionalEvidence: points.slice(1).map(point => ({ blockId: part.blockId, start: part.start + point.span.start, end: part.start + point.span.end })), hints: support, explanation: english('Each year belongs to its quoted event. Preserve words such as before, around and until.') });
      }
    }
    if (allowed('sequence')) {
      const sequence = corpusSequence(part.text, seed);
      if (sequence) result.push({ kind: 'sequence', id: `${material.id.slice(0, 40)}-order-${part.start}`, blockId: part.blockId, prompt: 'Arrange these sentences in their source order.', steps: sequence.steps, acceptedOrders: sequence.acceptedOrders, evidence: { start: part.start + sequence.evidence.start, end: part.start + sequence.evidence.end }, hints: support, explanation: english('The complete source presents these sentences in this order.') });
    }
  }
  return result;
}

function sentenceFor(material: Material, span: Span) {
  const text = material.blocks.find(block => block.id === span.blockId)!.text, sentences = sentenceSegments(text).filter(sentence => sentence.index < span.end && sentence.index + sentence.segment.length > span.start);
  return { start: sentences[0]?.index ?? span.start, end: sentences.at(-1) ? sentences.at(-1)!.index + sentences.at(-1)!.segment.length : span.end };
}
function timedSpan(material: Material, span: Span, segments: readonly Alignment[]): Span {
  const text = material.blocks.find(block => block.id === span.blockId)!.text, sentence = sentenceFor(material, span), parts = segments.filter(part => part.end > sentence.start && part.start < sentence.end);
  if (parts.length && !text.slice(sentence.start, parts[0].start).trim() && !text.slice(parts.at(-1)!.end, sentence.end).trim() && parts.every(part => part.start >= sentence.start && part.end <= sentence.end || part.text.trim() === text.slice(sentence.start, sentence.end).trim())) return { ...span, audioStart: parts[0].audioStart, audioEnd: parts.at(-1)!.audioEnd };
  const anchor = parts.length === 1 ? parts[0] : undefined, prefix = material.blocks.slice(0, material.blocks.findIndex(block => block.id === span.blockId)).map(block => block.text).join(' ');
  const words = Math.max(1, englishWords(anchor?.text ?? material.blocks.map(block => block.text).join(' ')).length), before = englishWords(anchor ? text.slice(anchor.start, sentence.start) : prefix + ' ' + text.slice(0, sentence.start)).length, length = englishWords(text.slice(sentence.start, sentence.end)).length;
  const start = anchor?.audioStart ?? 0, duration = (anchor?.audioEnd ?? material.audio!.duration) - start;
  return { ...span, audioStart: Math.max(start, start + duration * before / words - 2), audioEnd: Math.min(anchor?.audioEnd ?? material.audio!.duration, start + duration * (before + length) / words + 2), audioTiming: 'estimated' };
}
function withTiming(material: Material, question: Question, segments: readonly Alignment[]): Question {
  const { blockId: _block, ...evidence } = timedSpan(material, { blockId: question.blockId, ...question.evidence }, segments); void _block;
  if ('gaps' in question) return { ...question, evidence, gaps: question.gaps.map(gap => { const { blockId: _block, ...evidence } = timedSpan(material, { blockId: question.blockId, ...gap.evidence }, segments); void _block; return { ...gap, evidence }; }) };
  const prompt = 'kind' in question && question.kind === 'completion' ? question.prompt.replace('Complete with one word from the passage.', 'Listen and complete with one word from the recording.') : 'steps' in question ? 'Listen and arrange these sentences in their recorded order.' : question.prompt;
  return { ...question, ...('spans' in question ? { spans: question.spans.map(span => ({ ...span, ...timedSpan(material, span, segments) })) } : {}), prompt, evidence, ...(question.additionalEvidence ? { additionalEvidence: question.additionalEvidence.map(span => timedSpan(material, span, segments)) } : {}) };
}
export function listeningAnswerSpans(question: Question): Span[] {
  if (globalQuestion(question)) return [];
  if ('gaps' in question) return question.gaps.map(gap => ({ blockId: question.blockId, ...gap.evidence }));
  const spans = references(question);
  return questionSlots(question) === 1 ? [{ ...spans[0], audioStart: Math.min(...spans.map(span => span.audioStart ?? Infinity)), audioEnd: Math.max(...spans.map(span => span.audioEnd ?? 0)) }] : spans.length === questionSlots(question) ? spans : [];
}
export function listeningSpacingValid(selected: readonly Question[], level: Lesson['targetLevel']) {
  const groups = selected.map(listeningAnswerSpans).filter(spans => spans.length).map(spans => ({ start: spans[0].audioStart ?? 0, end: spans.at(-1)!.audioEnd ?? Infinity })).sort((a, b) => a.start - b.start);
  if (groups.some((group, index) => index > 0 && group.start < groups[index - 1].end)) return false;
  if (selected.some(question => listeningAnswerSpans(question).some((span, index, spans) => index > 0 && (span.audioStart ?? 0) < (spans[index - 1].audioStart ?? 0)))) return false;
  const points = selected.flatMap(question => listeningAnswerSpans(question).map(span => ({ ...span, heavy: heavyQuestion(question) }))).sort((a, b) => (a.audioEnd ?? Infinity) - (b.audioEnd ?? Infinity));
  for (let index = 0; index < points.length; index++) {
    const point = points[index], previous = points[index - 1];
    if (point.audioStart === undefined || point.audioEnd === undefined || point.audioStart >= point.audioEnd) return false;
    if (!previous) continue;
    const spacing = listeningSpacing(level, point.heavy || previous.heavy), safety = point.audioTiming || previous.audioTiming ? 1.25 : 1;
    if (point.audioEnd - previous.audioEnd! < spacing.minimum * safety || point.audioStart - previous.audioEnd! < spacing.response * safety) return false;
  }
  return selected.every(question => globalQuestion(question) || listeningAnswerSpans(question).length === questionSlots(question));
}
function information(material: Material, question: Question) {
  if (globalQuestion(question)) return [`global:${/purpose/i.test(question.prompt) ? 'purpose' : /attitude/i.test(question.prompt) ? 'attitude' : 'main-point'}`];
  return references(question).flatMap(span => {
    const text = material.blocks.find(block => block.id === span.blockId)!.text;
    return sentenceSegments(text).filter(sentence => sentence.index < span.end && sentence.index + sentence.segment.length > span.start).map(sentence => sentence.segment.toLowerCase().replace(/\s+/g, ' ').trim());
  });
}
function choose(material: Material, pool: readonly Question[], target: number, skill: Lesson['skill'], level: Lesson['targetLevel']) {
  const length = material.blocks.reduce((sum, block) => sum + block.text.length, 0), position = (question: Question) => skill === 'listening' ? (question.evidence.audioEnd ?? 0) / material.audio!.duration : (material.blocks.slice(0, material.blocks.findIndex(block => block.id === question.blockId)).reduce((sum, block) => sum + block.text.length, 0) + question.evidence.start) / Math.max(1, length);
  const keys = new Map(pool.map(question => [question, information(material, question)]));
  let best: Question[] = [], bestValue = -Infinity;
  for (const strategy of [0, 1, 2, 3]) {
    const required = material.questions[0], anchor = pool.find(question => question.id === required?.id);
    const selected: Question[] = (material.id.startsWith('corpus-') || anchor && questionSlots(anchor) > 1) && anchor && questionSlots(anchor) <= target && (!globalQuestion(anchor) || questionSlots(anchor) <= 2) && (skill !== 'listening' || listeningSpacingValid([anchor], level)) ? [anchor] : [], used = new Set(selected.flatMap(question => keys.get(question)!)); let slots = answerPointCount(selected);
    while (slots < target) {
      const eligible = pool.filter(question => !selected.includes(question) && slots + questionSlots(question) <= target && !keys.get(question)!.some(key => used.has(key)) && (!globalQuestion(question) || selected.filter(globalQuestion).reduce((sum, question) => sum + questionSlots(question), 0) + questionSlots(question) <= 2) && (skill !== 'listening' || ((!selected.length || !anchor || !material.id.startsWith('corpus-') || selected[0] !== anchor || globalQuestion(anchor) || globalQuestion(question) || position(question) >= position(anchor)) && listeningSpacingValid([...selected, question], level))));
      if (!eligible.length) break;
      const rank = (question: Question) => {
        const distance = selected.length ? Math.min(...selected.map(other => Math.abs(position(question) - position(other)))) : 1 - Math.abs(position(question) - .5), original = material.questions.some(other => other.id === question.id) ? .2 : 0;
        const nearby = skill === 'listening' && !globalQuestion(question) ? Math.min(1, Math.min(...selected.filter(other => !globalQuestion(other)).map(other => Math.abs(position(question) - position(other)) * material.audio!.duration)) / listeningSpacing(level, heavyQuestion(question)).preferred) : 1;
        return distance + original + nearby * .15 + (strategy === 1 ? -questionSlots(question) : strategy === 2 ? questionSlots(question) : 0) + (strategy === 3 ? -position(question) : 0);
      };
      eligible.sort((a, b) => rank(b) - rank(a));
      const question = strategy === 0 && !selected.length && eligible.some(question => question.id === material.questions[0]?.id) ? eligible.find(question => question.id === material.questions[0].id)! : eligible[0];
      selected.push(question); slots += questionSlots(question); keys.get(question)!.forEach(key => used.add(key));
    }
    const positions = selected.map(position).sort((a, b) => a - b), coverage = positions.length > 1 ? positions.at(-1)! - positions[0] : 0, value = slots * 10 + coverage + Number(selected.some(question => question.id === material.questions[0]?.id)) * .1 + new Set(selected.map(questionKind)).size * .08;
    if (value > bestValue) { bestValue = value; best = selected; }
  }
  return best.sort((a, b) => material.id.startsWith('corpus-') && (a.id === material.questions[0]?.id || b.id === material.questions[0]?.id) ? Number(b.id === material.questions[0]?.id) - Number(a.id === material.questions[0]?.id) : skill === 'listening' ? Number(globalQuestion(a)) - Number(globalQuestion(b)) || position(a) - position(b) : position(a) - position(b));
}
export function alignedGapQuestion(material: Material, segments: readonly Alignment[], level: Lesson['targetLevel'], seed: number): Question | undefined {
  if (!material.audio || material.blocks.length !== 1 || !segments.length || segments.some(segment => material.blocks[0].text.slice(segment.start, segment.end) !== segment.text || segment.audioStart < 0 || segment.audioStart >= segment.audioEnd || segment.audioEnd > material.audio!.duration)) return;
  const pool = candidates(material, level, seed, ['completion']).flatMap(question => {
    const segment = segments.find(segment => segment.start <= question.evidence.start && segment.end >= question.evidence.end);
    return segment ? [{ ...question, evidence: { ...question.evidence, audioStart: segment.audioStart, audioEnd: segment.audioEnd } }] : [];
  }), selected = choose(material, pool, quantityBudget('listening', material.audio.duration).baseline, 'listening', level).sort((a, b) => a.evidence.start - b.evidence.start);
  if (selected.length < 2) return;
  const gaps = selected.map((question, index) => { if (!('kind' in question) || question.kind !== 'completion') throw new Error('INVALID_GAP_CANDIDATE'); return { id: `g${index + 1}`, answer: question.answer, accepted: question.accepted, maxWords: 1, evidence: question.evidence }; });
  const start = gaps[0].evidence.start, end = gaps.at(-1)!.evidence.end; let passage = material.blocks[0].text.slice(start, end);
  for (const gap of [...gaps].reverse()) passage = passage.slice(0, gap.evidence.start - start) + `{{${gap.id}}}` + passage.slice(gap.evidence.end - start);
  return { kind: 'gap-fill', id: `${material.id.slice(0, 60)}-gaps`, blockId: material.blocks[0].id, prompt: 'Complete the recording extract. Write ONE WORD in each gap.', passage, gaps, evidence: { start, end, audioStart: gaps[0].evidence.audioStart, audioEnd: gaps.at(-1)!.evidence.audioEnd }, hints: support, explanation: english('Each answer occurs in a different source sentence. Approximate time ranges are labelled as estimates.') };
}
export function organizePractice(raw: Lesson, banks: readonly SpokenCorpus[] = [], kinds: readonly CorpusQuestionKind[] = []): Lesson {
  const lesson = structuredClone(lessonSchema.parse(raw));
  if (lesson.mode === 'check' || lesson.materials.every(material => material.quantity?.revision === quantityRevision && (!kinds.length || material.questions.every(question => kinds.includes(questionKind(question) as CorpusQuestionKind))) && (lesson.skill === 'reading' || listeningSpacingValid(material.questions, lesson.targetLevel)))) return lesson;
  const level = lesson.generation?.generator === 'corpus-v1' ? lesson.generation.startingPoint ?? lesson.targetLevel : lesson.targetLevel, seed = lesson.generation?.seed ?? 0;
  lesson.organization = 'material-v1';
  let remaining = lesson.skill === 'reading' ? 12 : 20;
  if (lesson.materials.length > remaining) throw new Error('TOO_MANY_PRACTICE_MATERIALS');
  const lengths = lesson.materials.map(material => lesson.skill === 'reading' ? readingWordCount(material) : material.audio!.duration), baselines = lengths.map(length => quantityBudget(lesson.skill, length).baseline);
  for (const [index, material] of lesson.materials.entries()) {
    const length = lesson.skill === 'reading' ? readingWordCount(material) : material.audio!.duration, budget = quantityBudget(lesson.skill, length);
    if (!budget.baseline) throw new Error('NO_USABLE_CONTENT');
    const clip = lesson.skill === 'listening' && material.blocks.length === 1 ? banks.flatMap(bank => bank.records.flatMap(record => record.clips)).find(clip => material.audio?.sha256 === clip.audio.sha256 && material.audio.duration === clip.audio.duration && material.blocks[0].text === clip.text) : undefined;
    const originals = material.questions.map(responseParts).filter(question => !kinds.length || kinds.includes(questionKind(question) as CorpusQuestionKind)), additions = candidates(material, level, seed, kinds).map(question => lesson.skill === 'listening' ? withTiming(material, question, clip?.segments ?? []) : question);
    const pool = [...spread(originals, 160), ...additions].filter((question, index, all) => all.findIndex(other => other.id === question.id) === index);
    const available = remaining - (lesson.materials.length - index - 1), fair = Math.max(1, Math.floor(remaining * budget.baseline / baselines.slice(index).reduce((sum, value) => sum + value, 0)));
    let target = Math.min(budget.baseline, fair, available), chosen = choose(material, pool, target, lesson.skill, level);
    const reasons: NonNullable<Material['quantity']>['reasons'] = [];
    if (target < budget.baseline) reasons.push('session-budget');
    if (chosen.some(question => 'criteria' in question) && target > 3) { target--; chosen = choose(material, pool, target, lesson.skill, level); reasons.push('complexity'); }
    if (answerPointCount(chosen) < target) {
      const smallest = Math.min(...pool.map(questionSlots));
      if (smallest > target && smallest <= Math.min(available, budget.maximum, budget.baseline + (budget.baseline >= 10 ? 2 : 1))) { target = smallest; chosen = choose(material, pool, target, lesson.skill, level); reasons.push('intact-groups'); }
    }
    if (answerPointCount(chosen) < target) {
      if (lesson.skill === 'listening' && pool.some(question => !globalQuestion(question) && !listeningAnswerSpans(question).length)) reasons.push('incomplete-slot-timing');
      if (lesson.skill === 'listening' && answerPointCount(pool) >= target) reasons.push('timing-spacing');
      else reasons.push(kinds.length && additions.length === 0 ? 'unsupported-question-kind' : 'insufficient-independent-points');
    }
    if (!chosen.length) throw new Error('NO_USABLE_QUESTIONS');
    if (lesson.skill === 'listening') {
      if (!listeningSpacingValid(chosen, level)) throw new Error('INVALID_LISTENING_SPACING');
    }
    if (lesson.mode) for (const question of chosen) delete question.hints;
    const estimated = chosen.some(question => references(question).some(span => span.audioTiming) || 'gaps' in question && question.gaps.some(gap => gap.evidence.audioTiming));
    if (estimated) reasons.push('estimated-timing');
    material.questions = chosen;
    remaining -= answerPointCount(chosen);
    material.quantity = { revision: quantityRevision, length, baseline: budget.baseline, target, actual: answerPointCount(chosen), preferSegments: budget.preferSegments, timing: lesson.skill === 'reading' ? 'not-applicable' : estimated ? 'estimated' : clip ? 'aligned' : 'provided', reasons: [...new Set(reasons)] };
    if (material.quantity.actual > budget.maximum || material.quantity.actual > target) throw new Error('QUESTION_BUDGET_EXCEEDED');
  }
  return lessonSchema.parse(lesson);
}
