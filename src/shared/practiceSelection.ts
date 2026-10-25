import { z } from 'zod';
import { corpusQuestionKindSchema, topicSchema, type Lesson, type CorpusQuestionKind } from './content';
import { exposureRootIdSchema } from './exposure';
import { corpusInterestMatch } from './topicMatch';

export const practiceSelectionSchema = z.preprocess(value => {
  if (value && typeof value === 'object' && 'kind' in value && !('kinds' in value)) {
    const { kind, ...rest } = value;
    value = { ...rest, kinds: kind === undefined ? [] : [kind] };
  }
  if (value && typeof value === 'object' && 'topic' in value && !('topics' in value)) {
    const { topic, ...rest } = value;
    value = { ...rest, topics: topic === undefined ? [] : [topic] };
  }
  return value;
}, z.object({
  topics: z.array(topicSchema).max(topicSchema.options.length).refine(topics => new Set(topics).size === topics.length).default([]),
  kinds: z.array(corpusQuestionKindSchema).max(corpusQuestionKindSchema.options.length).refine(kinds => new Set(kinds).size === kinds.length).default([]),
  materials: z.array(exposureRootIdSchema).max(32).refine(ids => new Set(ids).size === ids.length),
}).strict());
export type PracticeSelection = z.infer<typeof practiceSelectionSchema>;
export const automaticPractice: PracticeSelection = { topics: [], kinds: [], materials: [] };
export function practiceSelectionMatches(lesson: Lesson, selection: PracticeSelection) {
  return (!selection.topics.length || (lesson.themes ? lesson.themes.some(topic => selection.topics.includes(topic)) : lesson.materials.every(material => corpusInterestMatch(material.title + '\n' + material.blocks.map(block => block.text).join('\n'), selection.topics))))
    && lesson.materials.every(material => (!selection.materials.length || selection.materials.includes(material.rootId)) && (!selection.kinds.length || material.questions.every(question => selection.kinds.some(kind => kind === ('gaps' in question ? 'completion' : 'kind' in question ? question.kind : 'choice')))));
}
export function readPracticeSelection(value?: string): PracticeSelection {
  if (value === undefined) return automaticPractice;
  try { return practiceSelectionSchema.parse(JSON.parse(value)); }
  catch { throw new Error('INVALID_PRACTICE_SELECTION'); }
}

// Keep occasional reflection, using high seed bits independently of short task rotations.
export function automaticQuestionKinds(seed: number, kinds: readonly CorpusQuestionKind[] = []) {
  return kinds.length || (seed >>> 16) % 10 === 0 ? kinds : corpusQuestionKindSchema.options;
}
