import { describe, expect, it } from 'vitest';
import raw from './fixtures/content/a1-reading.json';
import { lessonSchema } from '../src/shared/content';
import { prepareFeedback } from '../src/shared/ai-feedback';

const lesson = lessonSchema.parse(raw);
const material = lesson.materials[0];

describe('external feedback boundary', () => {
  it('accepts bounded explanations and degrades unknown references to text', () => {
    const good = prepareFeedback(JSON.stringify({ explanation: 'Use the meeting-place clue.', evidence: [{ blockId: material.blocks[0].id, comment: 'This names the place.' }], reviewGoals: [{ goalId: lesson.goalId, suggestion: 'Practise location clues.' }] }), lesson, material);
    expect(good.unknownReferences).toBe(false);
    expect(prepareFeedback(JSON.stringify({ explanation: 'Useful note.', evidence: [{ blockId: 'missing', comment: 'Unverified citation.' }] }), lesson, material)).toMatchObject({ unknownReferences: true });
    expect(prepareFeedback(JSON.stringify({ practiceDrafts: ['Find a location in a new message.'] }), lesson, material).content).toContain('Find a location');
  });
  it('rejects score edits, markup, and oversized JSON', () => {
    expect(() => prepareFeedback(JSON.stringify({ explanation: 'Fine.', correct: true }), lesson, material)).toThrow();
    expect(() => prepareFeedback(JSON.stringify({ explanation: '<script>alert(1)</script>' }), lesson, material)).toThrow('FEEDBACK_HTML');
    expect(() => prepareFeedback(JSON.stringify({ explanation: '<!DOCTYPE html>' }), lesson, material)).toThrow('FEEDBACK_HTML');
    expect(() => prepareFeedback(' '.repeat(64 * 1024 + 1), lesson, material)).toThrow('FEEDBACK_SIZE');
  });
});
