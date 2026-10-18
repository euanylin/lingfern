import records from '../content/corpus/catalogue.json';
import type { TeachingSummary } from './mcp';

// Real source titles only; removed fictional test courses and answers are never exposed.
export const publicTeachingCatalogue: readonly TeachingSummary[] = records.map(source => ({
  id: source.id, title: source.title, goal: 'Locate original wording and support a short interpretation using source evidence.',
  goalId: 'source-wording-and-summary', level: 'B2', skill: 'reading', reviewStatus: 'draft',
}));
