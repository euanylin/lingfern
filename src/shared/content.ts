import '../validationConfig';
import procedureListeningSources from '../../public/audio/b1-speech/PROCEDURE.json' with { type: 'json' };
import intentionListeningSources from '../../public/audio/b1-speech/INTENTION.json' with { type: 'json' };
import motiveListeningSources from '../../public/audio/b1-speech/MOTIVE.json' with { type: 'json' };
import referenceListeningSources from '../../public/audio/b1-speech/REFERENCE.json' with { type: 'json' };
import conditionListeningSources from '../../public/audio/b1-speech/CONDITION.json' with { type: 'json' };
import mainPointListeningSources from '../../public/audio/b1-speech/MAINIDEA.json' with { type: 'json' };
import ruleListeningSources from '../../public/audio/a2-speech/RULE.json' with { type: 'json' };
import reasonListeningSources from '../../public/audio/a2-speech/REASON.json' with { type: 'json' };
import changeListeningSources from '../../public/audio/a2-speech/UPDATE.json' with { type: 'json' };
import orderListeningSources from '../../public/audio/a2-speech/ORDER.json' with { type: 'json' };
import personalListeningSources from '../../public/audio/a2-speech/PERSONAL.json' with { type: 'json' };
import { z } from 'zod';
import { answerPointCount, quantityBudget, quantityReportSchema, readingWordCount } from './practiceQuantity';

export const corpusQuestionKindSchema = z.enum(['completion', 'sequence', 'evidence', 'matching', 'table', 'choice']);
export type CorpusQuestionKind = z.infer<typeof corpusQuestionKindSchema>;
export const topicSchema = z.enum(['campus', 'daily-life', 'science', 'culture', 'travel', 'technology', 'nature', 'environment', 'history', 'literature', 'music', 'film', 'sport', 'health', 'business', 'society', 'language', 'food']);
export const levelSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
const localizedSchema = z.object({ 'zh-Hans': z.string().min(1), 'zh-Hant': z.string().min(1), en: z.string().min(1) }).strict();
export type { Locale } from './locale';
import { contentLocale, type Locale } from './locale';
const evidenceSchema = z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive(), audioStart: z.number().nonnegative().optional(), audioEnd: z.number().positive().optional(), audioTiming: z.literal('estimated').optional() }).strict();
const additionalEvidenceSchema = evidenceSchema.extend({ blockId: z.string().min(1) });
export const ruleHashesSchema = z.object({ scoring: z.string().regex(/^[a-f0-9]{64}$/), generator: z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict();
const choiceQuestionSchema = z.object({
  variantGroup: z.string().min(1).max(80).optional(),
  id: z.string().min(1), blockId: z.string().min(1), prompt: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(5), answer: z.number().int().nonnegative(),
  evidence: evidenceSchema, additionalEvidence: z.array(additionalEvidenceSchema).optional(),
  hints: z.array(localizedSchema).length(3).optional(), explanations: z.array(localizedSchema).min(2),
}).strict();
const tableQuestionSchema = z.object({
  kind: z.literal('table'), id: z.string().min(1), blockId: z.string().min(1), prompt: z.string().min(1),
  rows: z.array(z.object({ label: z.string().min(1), answer: z.string().min(1).max(60), accepted: z.array(z.string().min(1).max(60)).min(1).max(12) }).strict()).min(2).max(4),
  evidence: evidenceSchema, additionalEvidence: z.array(additionalEvidenceSchema).optional(),
  hints: z.array(localizedSchema).length(3).optional(), explanation: localizedSchema,
}).strict();
const sequenceQuestionSchema = z.object({
  kind: z.literal('sequence'), id: z.string().min(1), blockId: z.string().min(1), prompt: z.string().min(1),
  steps: z.array(z.string().min(1).max(160)).min(3).max(5),
  acceptedOrders: z.array(z.array(z.string()).min(3).max(5)).min(1).max(6),
  evidence: evidenceSchema, additionalEvidence: z.array(additionalEvidenceSchema).optional(),
  hints: z.array(localizedSchema).length(3).optional(), explanation: localizedSchema,
}).strict();
const completionQuestionSchema = z.object({
  kind: z.literal('completion'), id: z.string().min(1), blockId: z.string().min(1), prompt: z.string().min(1),
  answer: z.string().min(1).max(80), accepted: z.array(z.string().min(1).max(80)).min(1).max(8),
  evidence: evidenceSchema, additionalEvidence: z.array(additionalEvidenceSchema).optional(),
  hints: z.array(localizedSchema).length(3).optional(), explanation: localizedSchema,
}).strict();
const gapFillQuestionSchema = z.object({
  kind: z.literal('gap-fill'), id: z.string().min(1), blockId: z.string().min(1), prompt: z.string().min(1), passage: z.string().min(1).max(12000),
  gaps: z.array(z.object({ id: z.string().regex(/^g[1-9][0-9]*$/), answer: z.string().min(1).max(80), accepted: z.array(z.string().min(1).max(80)).min(1).max(8), maxWords: z.number().int().min(1).max(10), evidence: evidenceSchema }).strict()).min(2).max(12),
  evidence: evidenceSchema, additionalEvidence: z.array(additionalEvidenceSchema).optional(), hints: z.array(localizedSchema).length(3).optional(), explanation: localizedSchema,
}).strict();
const matchingQuestionSchema = z.object({
  kind: z.literal('matching'), id: z.string().min(1), blockId: z.string().min(1), prompt: z.string().min(1),
  choices: z.array(z.string().trim().min(1).max(80)).min(2).max(6),
  pairs: z.array(z.object({ label: z.string().trim().min(1).max(240), answer: z.string().min(1).max(80) }).strict()).min(2).max(4),
  evidence: evidenceSchema, additionalEvidence: z.array(additionalEvidenceSchema).optional(),
  hints: z.array(localizedSchema).length(3).optional(), explanation: localizedSchema,
}).strict();
const responseQuestionSchema = z.object({
  kind: z.literal('response'), id: z.string().min(1), blockId: z.string().min(1), prompt: z.string().min(1),
  modelAnswer: z.string().min(1).max(4000).optional(), criteria: z.array(localizedSchema).min(2).max(4),
  parts: z.array(z.string().min(1).max(1000)).min(2).max(12).optional(),
  evidence: evidenceSchema, additionalEvidence: z.array(additionalEvidenceSchema).optional(),
  hints: z.array(localizedSchema).length(3).optional(), explanation: localizedSchema,
}).strict();
export const selfAssessmentSchema = z.array(z.enum(['met', 'revise', 'unsure'])).min(2).max(4);
export type SelfAssessment = z.infer<typeof selfAssessmentSchema>;
const evidenceQuestionSchema = z.object({
  kind: z.literal('evidence'), id: z.string().min(1), blockId: z.string().min(1), prompt: z.string().min(1),
  spans: z.array(additionalEvidenceSchema.extend({ text: z.string().min(20).max(240) })).min(3).max(6),
  accepted: z.array(z.number().int().nonnegative()).min(1).max(6),
  evidence: evidenceSchema, additionalEvidence: z.array(additionalEvidenceSchema).optional(),
  hints: z.array(localizedSchema).length(3).optional(), explanation: localizedSchema,
}).strict();
export const sourceCreditSchema = z.object({
  attribution: z.string().min(1).max(1500), license: z.string().min(1).max(300),
  sourceUrl: z.url().startsWith('https://').max(2000).optional(),
}).strict();
export const questionSchema = z.union([gapFillQuestionSchema, choiceQuestionSchema, tableQuestionSchema, sequenceQuestionSchema, completionQuestionSchema, matchingQuestionSchema, responseQuestionSchema, evidenceQuestionSchema]);
export const recordingSchema = z.object({
  src: z.string().regex(/^\/(?:audio\/[a-z0-9-]+|ipa\/audio)\/[a-z0-9-]+\.mp3$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), duration: z.number().positive().max(7200),
  author: z.string().min(1), sourceUrl: z.string().min(1),
  license: z.string().min(1), synthetic: z.boolean().optional(),
}).strict();
const bundledShortListeningSources = [...personalListeningSources.need, ...personalListeningSources.preference, ...orderListeningSources, ...changeListeningSources, ...reasonListeningSources, ...ruleListeningSources, ...mainPointListeningSources, ...conditionListeningSources, ...referenceListeningSources, ...motiveListeningSources, ...intentionListeningSources, ...procedureListeningSources];
export const lessonSchema = z.object({
  id: z.string().min(1), targetLevel: levelSchema, skill: z.enum(['reading', 'listening']),
  themes: z.array(topicSchema).min(1).max(5).optional(),
  title: localizedSchema, goal: localizedSchema, goalId: z.string().min(1),
  organization: z.literal('material-v1').optional(),
  sourceId: z.string().min(1), reviewStatus: z.enum(['draft', 'approved']), communityPackageId: z.string().regex(/^[a-f0-9]{64}$/).optional(), mode: z.enum(['check', 'test']).optional(), expectedMinutes: z.number().int().positive().max(120).optional(),
  generation: z.discriminatedUnion('generator', [
    z.object({ generator: z.literal('corpus-check-v1'), seed: z.number().int().min(0).max(0xffffffff), startingPoint: z.enum(['A1', 'A2', 'B1', 'B2']) }).strict(),
    z.object({ generator: z.literal('travel-v1'), seed: z.number().int().min(0).max(0xffffffff), index: z.number().int().min(0).max(431) }).strict(),
    z.object({ generator: z.literal('corpus-v1'), seed: z.number().int().min(0).max(0xffffffff), startingPoint: levelSchema.optional(), focus: corpusQuestionKindSchema.optional() }).strict(),
  ]).optional(),
  teaching: localizedSchema.optional(), nextStep: localizedSchema.optional(), workedExample: localizedSchema.optional(),
  materials: z.array(z.object({
    id: z.string().min(1), rootId: z.string().min(1), title: z.string().min(1), sourceId: z.string().min(1).optional(),
    credit: sourceCreditSchema.optional(),
    communityPackageId: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    illustration: z.object({ src: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/), alt: localizedSchema, sourceId: z.string().min(1) }).strict().optional(),
    audio: recordingSchema.optional(),
    quantity: quantityReportSchema.optional(),
    blocks: z.array(z.object({ id: z.string().min(1), title: z.string().min(1).optional(), text: z.string().min(1) }).strict()).min(1),
    questions: z.array(questionSchema).min(1),
  }).strict()).min(1),
}).strict().superRefine((lesson, ctx) => {
  if (lesson.materials.some(material => material.quantity) && answerPointCount(lesson.materials.flatMap(material => material.questions)) > (lesson.skill === 'reading' ? 12 : 20)) ctx.addIssue({ code: 'custom', message: 'Practice exceeds the shared answer-point budget' });
  if (lesson.generation?.generator === 'corpus-check-v1' ? lesson.mode !== 'check' || lesson.skill !== 'reading' || !!lesson.communityPackageId || lesson.targetLevel !== lesson.generation.startingPoint : lesson.generation && (lesson.mode === 'check' || lesson.reviewStatus !== 'draft' || (lesson.communityPackageId && (lesson.generation.generator !== 'corpus-v1' || lesson.skill !== 'listening')))) ctx.addIssue({ code: 'custom', message: 'Generated practice stays draft; generated checks require the dedicated reading-check shape' });
  if (lesson.communityPackageId && (lesson.mode === 'check' || lesson.reviewStatus !== 'draft')) ctx.addIssue({ code: 'custom', message: 'Community lessons are draft learning only' });
  if (lesson.mode === 'check') {
    if (lesson.teaching || lesson.workedExample || lesson.nextStep || !lesson.expectedMinutes || lesson.materials.length !== 1 || lesson.materials[0]?.questions.length !== 4) ctx.addIssue({ code: 'custom', message: 'Check requires duration and one four-response material without teaching' });
  } else if (lesson.mode === 'test') {
    if (lesson.teaching || lesson.workedExample || lesson.nextStep || lesson.expectedMinutes || lesson.materials.length < 2) ctx.addIssue({ code: 'custom', message: 'Test reuses practice materials without assistance' });
  } else if (!lesson.teaching || !lesson.workedExample || lesson.expectedMinutes || lesson.materials.length < 2) ctx.addIssue({ code: 'custom', message: 'Learning requires teaching and a distinct application material' });
  if (lesson.organization && lesson.mode === 'check') ctx.addIssue({ code: 'custom', message: 'Strict checks retain their original organization' });
  const ids = new Set<string>();
  const roots = new Set<string>();
  for (const material of lesson.materials) {
    if (material.quantity) {
      const length = lesson.skill === 'reading' ? readingWordCount(material) : material.audio?.duration, budget = quantityBudget(lesson.skill, length);
      if (material.quantity.length !== length || material.quantity.baseline !== budget.baseline || material.quantity.actual !== answerPointCount(material.questions) || material.quantity.actual > material.quantity.target || material.quantity.target > budget.maximum || material.quantity.preferSegments !== budget.preferSegments) ctx.addIssue({ code: 'custom', message: 'Invalid answer-point quantity report' });
    }
    const packageId = material.communityPackageId ?? lesson.communityPackageId;
    if (material.communityPackageId && (!lesson.communityPackageId || lesson.generation?.generator !== 'corpus-v1' || lesson.skill !== 'listening' || !material.audio || material.illustration || lesson.materials.length !== 2 || lesson.materials[0] === material && material.communityPackageId !== lesson.communityPackageId)) ctx.addIssue({ code: 'custom', message: 'Material package ownership is restricted to generated listening application' });
    if (material.illustration && (!lesson.communityPackageId || !new RegExp(`^/images/community-${lesson.communityPackageId}/[a-z0-9-]+\\.png$`).test(material.illustration.src))) ctx.addIssue({ code: 'custom', message: 'Illustration source is invalid' });
    if ((lesson.skill === 'listening') !== !!material.audio) ctx.addIssue({ code: 'custom', message: 'Audio must match the task skill' });
    const bundledPersonal = !!material.audio && bundledShortListeningSources.some(source =>
      source.rootId === material.rootId && source.audio.src === material.audio!.src && source.audio.sha256 === material.audio!.sha256
      && source.audio.duration === material.audio!.duration && source.audio.author === material.audio!.author && source.audio.sourceUrl === material.audio!.sourceUrl
      && source.audio.license === material.audio!.license && material.audio!.synthetic === false && material.blocks.length === 1 && material.blocks[0].text === source.text
      && material.credit?.attribution === source.credit.attribution && material.credit.license === source.credit.license && material.credit.sourceUrl === source.credit.sourceUrl);
    if (material.audio && bundledShortListeningSources.some(source => source.audio.src === material.audio!.src) && !bundledPersonal) ctx.addIssue({ code: 'custom', message: 'Known short recording metadata must match its inspected source' });
    const bundledFleurs = !!material.audio && /^fleurs-work-[a-f0-9]{64}$/.test(material.rootId)
      && /^\/audio\/a1-sentences\/fleurs-[a-z-]+\.mp3$/.test(material.audio.src) && material.audio.sourceUrl === 'https://huggingface.co/datasets/google/fleurs'
      && material.audio.author === 'FLEURS English volunteer speaker' && material.audio.license === 'CC BY 4.0' && material.audio.synthetic === false
      && !!material.credit?.license.includes('FLORES-200 transcript CC BY-SA 4.0') && material.credit.license.includes('recording CC BY 4.0')
      && /^https:\/\/en\.wikinews\.org\/wiki\/[A-Za-z0-9_%.'()-]+$/.test(material.credit.sourceUrl ?? '');
    if (material.audio && (packageId
      ? !new RegExp(`^/audio/community-${packageId}/[a-z0-9-]+\\.mp3$`).test(material.audio.src) || !(/^(https:\/\/[^\s]+|local:original)$/.test(material.audio.sourceUrl))
      : material.audio.synthetic ? material.audio.sourceUrl !== 'https://huggingface.co/hexgrad/Kokoro-82M' || material.audio.license !== 'Pending project release decision' : !(bundledPersonal || bundledFleurs || (/^https:\/\/commons\.wikimedia\.org\/wiki\/File:[A-Za-z0-9_.-]+$/.test(material.audio.sourceUrl) && material.audio.license === 'CC-BY-SA-3.0') || (/^https:\/\/learningenglish\.voanews\.com\/a\/[a-z0-9-]+\/\d+\.html$/.test(material.audio.sourceUrl) && material.audio.license === 'VOA Learning English original production (public domain)') || (/^https:\/\/www\.jfklibrary\.org\/asset-viewer\/archives\/jfkwha-(?:127-002|001|190-002|218)$/.test(material.audio.sourceUrl) && material.audio.license === 'JFK Library archival recording (public domain)') || (/^https:\/\/www\.eisenhowerlibrary\.gov\/research\/online-documents\/(?:farewell-address|atoms-peace)$/.test(material.audio.sourceUrl) && material.audio.license === 'Original United States federal-government address; public domain in the United States')))) ctx.addIssue({ code: 'custom', message: 'Audio provenance is inconsistent' });
    if (roots.has(material.rootId)) ctx.addIssue({ code: 'custom', message: 'Application must use a different root material' });
    roots.add(material.rootId);
    const blocks = new Map(material.blocks.map(b => [b.id, b.text]));
    if (blocks.size !== material.blocks.length) ctx.addIssue({ code: 'custom', message: 'Duplicate block ID' });
    for (const q of material.questions) {
      if (lesson.mode === 'check' && 'criteria' in q) ctx.addIssue({ code: 'custom', message: 'Open responses are learning-only until a reviewed scoring process exists' });
      if (lesson.mode ? q.hints !== undefined : material === lesson.materials[0] && q.hints?.length !== 3) ctx.addIssue({ code: 'custom', message: 'Hints must match lesson mode' });
      if (lesson.mode === 'test' && 'criteria' in q && q.modelAnswer) ctx.addIssue({ code: 'custom', message: 'Test has no model answer assistance' });
      const text = blocks.get(q.blockId);
      if ('gaps' in q) {
        let restored = q.passage;
        const unique = new Set<string>(); let end = q.evidence.start, audioEnd = 0;
        for (const gap of q.gaps) {
          const token = `{{${gap.id}}}`;
          if (unique.has(gap.id) || restored.split(token).length !== 2 || gap.evidence.start < end || gap.evidence.end > q.evidence.end || text?.slice(gap.evidence.start, gap.evidence.end) !== gap.answer || !gap.accepted.some(value => normalizeCompletion(value) === normalizeCompletion(gap.answer)) || gap.accepted.some(value => value.trim().split(/\s+/).length > gap.maxWords)) ctx.addIssue({ code: 'custom', message: 'Invalid gap source/answer/marker' });
          if (material.audio && (gap.evidence.audioStart === undefined || gap.evidence.audioEnd === undefined || gap.evidence.audioStart < audioEnd || gap.evidence.audioStart < (q.evidence.audioStart ?? 0) || gap.evidence.audioEnd > (q.evidence.audioEnd ?? material.audio.duration) || gap.evidence.audioStart >= gap.evidence.audioEnd || gap.evidence.audioEnd > material.audio.duration)) ctx.addIssue({ code: 'custom', message: 'Invalid aligned gap timing' });
          restored = restored.replace(token, gap.answer); unique.add(gap.id); end = gap.evidence.end; audioEnd = gap.evidence.audioEnd ?? 0;
        }
        if (restored !== text?.slice(q.evidence.start, q.evidence.end) || /\{\{g\d+\}\}/.test(restored)) ctx.addIssue({ code: 'custom', message: 'Gap passage must preserve its exact source' });
      }
      const invalidChoice = 'options' in q && (q.answer >= q.options.length || new Set(q.options).size !== q.options.length || q.explanations.length !== q.options.length);
      const invalidTable = 'rows' in q && (new Set(q.rows.map(row => row.label)).size !== q.rows.length || q.rows.some(row => !row.accepted.map(normalizeAnswer).includes(normalizeAnswer(row.answer))));
      const invalidSequence = 'steps' in q && (new Set(q.steps).size !== q.steps.length || q.acceptedOrders.some(order => order.length !== q.steps.length || new Set(order).size !== q.steps.length || order.some(step => !q.steps.includes(step))) || new Set(q.acceptedOrders.map(order => JSON.stringify(order))).size !== q.acceptedOrders.length);
      const invalidCompletion = 'kind' in q && q.kind === 'completion' && (new Set(q.accepted.map(normalizeCompletion)).size !== q.accepted.length || !q.accepted.map(normalizeCompletion).includes(normalizeCompletion(q.answer)) || !normalizeCompletion(text?.slice(q.evidence.start, q.evidence.end) ?? '').includes(normalizeCompletion(q.answer)));
      const invalidMatching = 'pairs' in q && (new Set(q.choices.map(normalizeAnswer)).size !== q.choices.length || new Set(q.pairs.map(pair => normalizeAnswer(pair.label))).size !== q.pairs.length || q.pairs.some(pair => !q.choices.includes(pair.answer)));
      const invalidEvidence = 'spans' in q && (() => {
        const rangeKey = (span: { blockId: string; start: number; end: number }) => `${span.blockId}:${span.start}:${span.end}`;
        const accepted = q.accepted.map(index => q.spans[index]).filter(Boolean);
        const cited = [{ blockId: q.blockId, ...q.evidence }, ...(q.additionalEvidence ?? [])];
        return new Set(q.accepted).size !== q.accepted.length || accepted.length !== q.accepted.length
          || new Set(q.spans.map(rangeKey)).size !== q.spans.length
          || q.spans.some(span => blocks.get(span.blockId)?.slice(span.start, span.end) !== span.text
            || (material.audio ? span.audioStart === undefined || span.audioEnd === undefined || span.audioStart >= span.audioEnd || span.audioEnd > material.audio.duration : span.audioStart !== undefined || span.audioEnd !== undefined))
          || accepted.some(span => !cited.some(reference => rangeKey(reference) === rangeKey(span)))
          || cited.some(reference => !accepted.some(span => rangeKey(span) === rangeKey(reference)));
      })();
      if (ids.has(q.id) || invalidChoice || invalidTable || invalidSequence || invalidCompletion || invalidMatching || invalidEvidence || text === undefined || q.evidence.end > text.length || q.evidence.start >= q.evidence.end) {
        ctx.addIssue({ code: 'custom', message: `Invalid question or evidence: ${q.id}` });
      }
      for (const evidence of q.additionalEvidence ?? []) {
        const supported = blocks.get(evidence.blockId);
        if (supported === undefined || evidence.start >= evidence.end || evidence.end > supported.length) ctx.addIssue({ code: 'custom', message: `Invalid additional evidence: ${q.id}` });
        if (material.audio && (evidence.audioStart === undefined || evidence.audioEnd === undefined || evidence.audioStart >= evidence.audioEnd || evidence.audioEnd > material.audio.duration)) ctx.addIssue({ code: 'custom', message: `Invalid additional audio evidence: ${q.id}` });
      }
      ids.add(q.id);
      if (material.audio && (q.evidence.audioStart === undefined || q.evidence.audioEnd === undefined || q.evidence.audioStart >= q.evidence.audioEnd || q.evidence.audioEnd > material.audio.duration)) {
        ctx.addIssue({ code: 'custom', message: 'Listening requires a valid audio evidence span' });
      }
    }
  }
});
export type Lesson = z.infer<typeof lessonSchema>;
export function asTestLesson(raw: Lesson): Lesson {
  const snapshot = structuredClone(lessonSchema.parse(raw));
  if (snapshot.mode === 'check') throw new Error('INVALID_TEST');
  snapshot.mode = 'test';
  delete snapshot.teaching;
  delete snapshot.workedExample;
  delete snapshot.nextStep;
  for (const material of snapshot.materials) for (const question of material.questions) {
    delete question.hints;
    if ('criteria' in question) delete question.modelAnswer;
  }
  return lessonSchema.parse(snapshot);
}
export type Question = z.infer<typeof questionSchema>;
/** Resolve instructed roots in old snapshots without adding assistance flags. */
export function teachingSupport(lesson: Lesson, rootId: string, provided = false) {
  return !lesson.mode && (provided || !!lesson.teaching && lesson.materials[0].rootId === rootId);
}
export type Answer = number | string | string[];
export function practiceLocale(lesson: Pick<Lesson, 'targetLevel' | 'generation'> & { goalId?: string }, locale: Locale): Locale {
  const point = lesson.generation?.generator === 'corpus-v1' ? lesson.generation.startingPoint : lesson.targetLevel;
  return point === 'A1' || point === 'A2' ? locale : 'en';
}
export function questions(lesson: Lesson) {
  return lesson.materials.flatMap(material => material.questions.map(question => ({ material, question })));
}

function normalizeAnswer(value: string) { return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ').replace(/\b([ap])\.m\./g, '$1m'); }
function normalizeCompletion(value: string) { return value.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim(); }

export function validateAnswer(question: Question, answer: Answer, partial = false) {
  if ('gaps' in question) {
    if (!Array.isArray(answer) || answer.length !== question.gaps.length || answer.some((value, index) => typeof value !== 'string' || value.length > 80 || (!partial && (!normalizeCompletion(value) || value.trim().split(/\s+/).length > question.gaps[index].maxWords)))) throw new Error('INVALID_ANSWER');
  } else if ('criteria' in question) {
    if (question.parts ? !Array.isArray(answer) || answer.length !== question.parts.length || answer.some(value => typeof value !== 'string' || value.length > 4000 || !partial && !value.trim()) : typeof answer !== 'string' || answer.length > 4000 || !partial && !answer.trim()) throw new Error('INVALID_ANSWER');
  } else if ('pairs' in question) {
    if (!Array.isArray(answer) || answer.length !== question.pairs.length || answer.some(value => !(partial && value === '') && !question.choices.includes(value))) throw new Error('INVALID_ANSWER');
  } else if ('kind' in question && question.kind === 'completion') {
    if (typeof answer !== 'string' || answer.length > 80 || (!partial && !normalizeCompletion(answer))) throw new Error('INVALID_ANSWER');
  } else if ('steps' in question) {
    if (!Array.isArray(answer) || (!partial && answer.length !== question.steps.length) || answer.length > question.steps.length || new Set(answer).size !== answer.length || answer.some(step => !question.steps.includes(step))) throw new Error('INVALID_ANSWER');
  } else if ('rows' in question) {
    if (!Array.isArray(answer) || answer.length !== question.rows.length || answer.some(value => typeof value !== 'string' || value.length > 60 || (!partial && !normalizeAnswer(value)))) throw new Error('INVALID_ANSWER');
  } else if ('spans' in question) {
    if (!Number.isInteger(answer) || typeof answer !== 'number' || answer < 0 || answer >= question.spans.length) throw new Error('INVALID_ANSWER');
  } else if (!Number.isInteger(answer) || typeof answer !== 'number' || answer < 0 || answer >= question.options.length) throw new Error('INVALID_ANSWER');
}

export function score(question: Question, answer: Answer): { correct: boolean | null; rule: string } {
  validateAnswer(question, answer);
  if ('gaps' in question) return { correct: scoreParts(question, answer).every(part => part.correct), rule: 'gap-fill-exact-source-v1' };
  if ('criteria' in question) return { correct: null, rule: 'open-response-unscored-v1' };
  if ('pairs' in question) return { correct: question.pairs.every((pair, index) => pair.answer === (answer as string[])[index]), rule: 'matching-authored-pairs-v1' };
  if ('kind' in question && question.kind === 'completion') return { correct: question.accepted.some(value => normalizeCompletion(value) === normalizeCompletion(answer as string)), rule: 'completion-authored-variants-v1' };
  if ('steps' in question) return { correct: question.acceptedOrders.some(order => order.every((step, index) => step === (answer as string[])[index])), rule: 'sequence-authored-orders-v1' };
  if ('spans' in question) return { correct: question.accepted.includes(answer as number), rule: 'evidence-authored-ranges-v1' };
  if ('rows' in question) {
    const values = answer as string[];
    return { correct: question.rows.every((row, i) => row.accepted.some(accepted => normalizeAnswer(accepted) === normalizeAnswer(values[i]))), rule: 'table-authored-variants-v1' };
  }
  return { correct: answer === question.answer, rule: 'exact-option-v1' };
}

export function scoreParts(question: Question, answer: Answer): { id: string; correct: boolean | null }[] {
  if ('criteria' in question && question.parts) return question.parts.map((_, index) => ({ id: String(index + 1), correct: null }));
  if ('gaps' in question) return question.gaps.map((gap, index) => ({ id: gap.id, correct: gap.accepted.some(value => normalizeCompletion(value) === normalizeCompletion(Array.isArray(answer) ? answer[index] ?? '' : '')) }));
  if ('pairs' in question) return question.pairs.map((pair, index) => ({ id: String(index + 1), correct: Array.isArray(answer) && answer[index] === pair.answer }));
  if ('rows' in question) return question.rows.map((row, index) => ({ id: String(index + 1), correct: row.accepted.some(value => normalizeAnswer(value) === normalizeAnswer(Array.isArray(answer) ? answer[index] ?? '' : '')) }));
  return [{ id: question.id, correct: score(question, answer).correct }];
}

export function answerText(question: Question, answer: Answer) {
  if ('gaps' in question) return question.gaps.map((gap, index) => `${gap.id}: ${Array.isArray(answer) ? answer[index] ?? '' : ''}`).join(' · ');
  if ('criteria' in question) return question.parts && Array.isArray(answer) ? question.parts.map((prompt, index) => `${prompt}: ${answer[index] ?? ''}`).join('\n') : typeof answer === 'string' ? answer : '';
  if ('pairs' in question) return Array.isArray(answer) ? question.pairs.map((pair, index) => `${pair.label}: ${answer[index]}`).join(' · ') : '';
  if ('kind' in question && question.kind === 'completion') return typeof answer === 'string' ? answer : '';
  if ('steps' in question) return Array.isArray(answer) ? answer.join(' → ') : '';
  if ('rows' in question) return Array.isArray(answer) ? question.rows.map((row, index) => `${row.label}: ${answer[index]}`).join(' · ') : '';
  if ('spans' in question) return typeof answer === 'number' ? question.spans[answer]?.text ?? '' : '';
  return typeof answer === 'number' ? question.options[answer] ?? '' : '';
}

export function correctAnswerText(question: Question) {
  if ('gaps' in question) return question.gaps.map(gap => `${gap.id}: ${gap.answer}`).join(' · ');
  if ('criteria' in question) return question.modelAnswer ?? '';
  if ('pairs' in question) return question.pairs.map(pair => `${pair.label}: ${pair.answer}`).join(' · ');
  if ('kind' in question && question.kind === 'completion') return question.answer;
  if ('steps' in question) return question.acceptedOrders.map(order => order.join(' → ')).join(' / ');
  if ('rows' in question) return question.rows.map(row => `${row.label}: ${row.answer}`).join(' · ');
  if ('spans' in question) return question.accepted.map(index => question.spans[index].text).join(' / ');
  return question.options[question.answer];
}

export function explanationText(question: Question, answer: Answer, locale: Locale) {
  return 'explanation' in question ? question.explanation[contentLocale(locale)] : question.explanations[answer as number]?.[contentLocale(locale)] ?? '';
}

export function validateSelfAssessment(question: Question, value: unknown): SelfAssessment {
  const ratings = selfAssessmentSchema.parse(value);
  if (!('criteria' in question) || ratings.length !== question.criteria.length) throw new Error('INVALID_SELF_ASSESSMENT');
  return ratings;
}

/** Preserve legacy package ownership and separate generated-application owners. */
export const materialPackageId = (lesson: Lesson, material: Lesson['materials'][number]) => material.communityPackageId ?? lesson.communityPackageId;
export const lessonPackageIds = (lesson: Lesson) => [...new Set(lesson.materials.map(material => materialPackageId(lesson, material)).filter((id): id is string => !!id))];
