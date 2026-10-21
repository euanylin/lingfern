import records from '../content/corpus/catalogue.json';
import type { TeachingSummary } from './mcp';

// Expose real public source titles without retired fictional courses or answers.
export const publicTeachingCatalogue: readonly TeachingSummary[] = records.map(source => ({
  id: source.id, title: source.title, goal: 'Locate original wording and support a short interpretation using source evidence.',
  goalId: 'source-wording-and-summary', level: 'B2', skill: 'reading', reviewStatus: 'draft',
}));
