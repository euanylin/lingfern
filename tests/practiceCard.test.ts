import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { corpusLesson, corpusSchema } from '../src/core/corpus';
import { PracticeCard, practiceCardProgress } from '../src/app/PracticeCard';
import { questions } from '../src/shared/content';
import type { Attempt, Session } from '../src/data/db';

const lesson = corpusLesson(corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8'))), new Set(), 0)!;
const session: Session = { id: 'card-test', profileId: 'card-profile', lesson, contentHash: 'a'.repeat(64), position: 99, status: 'active', startedAt: '2026-10-09T10:00:00Z', assistance: { hintLevel: 0 }, leaseUntil: 0 };
const item = questions(lesson)[0];
const attempt: Attempt = { id: 'card-answer', sessionId: session.id, profileId: session.profileId, questionId: item.question.id, rootId: item.material.rootId, answer: '', correct: null, rule: 'test', assistance: { hintLevel: 0 }, submittedAt: '2026-10-10T11:00:00Z' };

it('counts saved answers once and ignores position, deleted sessions, foreign profiles and unknown questions', () => {
  expect(practiceCardProgress([session], [])).toMatchObject({ answered: 0, total: questions(lesson).length });
  expect(practiceCardProgress([session, session], [attempt, { ...attempt, id: 'duplicate' }, { ...attempt, profileId: 'other' }, { ...attempt, questionId: 'unknown' }, { ...attempt, rootId: 'foreign-root' }])).toEqual({ answered: 1, total: questions(lesson).length, lastActivityAt: attempt.submittedAt });
  expect(practiceCardProgress([{ ...session, recordsDeleted: true }], [attempt])).toEqual({ answered: 0, total: 0, lastActivityAt: undefined });
});

it('combines real peer question totals without confusing the same question IDs across sessions', () => {
  const peer = { ...session, id: 'card-listening', lesson: { ...lesson, skill: 'listening' as const } };
  expect(practiceCardProgress([session, peer], [attempt, { ...attempt, id: 'peer-answer', sessionId: peer.id }])).toMatchObject({ answered: 2, total: 2 * questions(lesson).length });
});

it('shows one progress bar and tag only for saved answers, with topic before the main action', () => {
  const empty = renderToStaticMarkup(createElement(PracticeCard, {title: 'Reading', locale: 'en', sessions: [session], records: [], recommended: true, onStart: () => undefined, onRestart: async () => undefined}, createElement('span', null, 'Topic: Automatic')));
  expect(empty).not.toContain('Not started');
  expect(empty).not.toContain('practice-card-status');
  expect(empty).toContain('data-state="empty"');
  expect(empty).toContain('practice-card-actions');
  expect(empty).toContain('class="button practice-card-action"');
  expect(empty).not.toContain('Last practiced');
  expect(empty).not.toContain('progressbar');
  expect(empty).not.toContain('more actions');
  expect(empty).not.toContain('minutes');
  expect(empty.indexOf('Topic: Automatic')).toBeLessThan(empty.indexOf('class="button practice-card-action"'));
  const active = renderToStaticMarkup(createElement(PracticeCard, {title: 'Reading', locale: 'en', sessions: [session], records: [attempt], recommended: true, onStart: () => undefined, onRestart: async () => undefined}));
  expect(active).not.toContain('Last practiced');
  expect(active).not.toContain('practice-card-status');
  expect(active).toContain('aria-valuenow="1"');
  expect(active).toContain('Reading Restart');
  expect(active).toContain('Continue');
  expect(active).toContain('class="primary practice-card-action"');
});


it('keeps empty cards compact and neutral in all locales, even when recommended', () => {
  for (const [locale, label] of [['zh-Hans', '开始'], ['zh-Hant', '開始'], ['en', 'Start']] as const) {
    const html = renderToStaticMarkup(createElement(PracticeCard, { title: 'Card', locale, records: [], recommended: true, onStart: () => undefined }, createElement('span', null, 'Topic')));
    expect(html).toContain(`>${label}</button>`);
    expect(html).toContain('class="button practice-card-action"');
    expect(html).not.toMatch(/还没开始|還沒開始|Not started|minutes|分鐘|分钟|practice-card-status|progressbar|practice-card-tag/);
    expect(html.indexOf('Topic')).toBeLessThan(html.indexOf('class="button practice-card-action"'));
  }
});

it('shows only the title, progress and actions while preserving direct restart and short continue labels', () => {
  for (const [locale, label, progress] of [['zh-Hans', '继续', '已答 1/'], ['zh-Hant', '繼續', '已答 1/'], ['en', 'Continue', '1/']] as const) {
    const html = renderToStaticMarkup(createElement(PracticeCard, { title: 'Card', locale, sessions: [session], records: [attempt], onStart: () => undefined, onRestart: async () => undefined }));
    expect(html).toContain(`>${label}</button>`); expect(html).toContain(progress);
    expect(html).not.toContain('practice-card-status'); expect(html).not.toContain('practice-card-tag');
    expect(html).toContain('practice-card-restart'); expect(html).not.toContain('⋯');
    expect(html).toContain('data-state="active"'); expect(html).toContain('aria-valuenow="1"');
    expect(html).not.toMatch(/第.*题|第.*題/);
  }
});

it('uses a full muted bar only for real completed sessions and offers a secondary repeat action without status or scores', () => {
  const completed = { ...session, status: 'completed' as const };
  const records = questions(lesson).map(({ question, material }, index) => ({ ...attempt, id: `saved-${index}`, questionId: question.id, rootId: material.rootId }));
  for (const [locale, done, again] of [['zh-Hans', '已完成', '再练一组'], ['zh-Hant', '已完成', '再練一組'], ['en', 'Completed', 'Practice again']] as const) {
    const html = renderToStaticMarkup(createElement(PracticeCard, { title: 'Card', locale, sessions: [completed], records, recommended: true, onStart: () => undefined, onRestart: async () => undefined }));
    expect(html).toContain('data-state="completed"'); expect(html).not.toContain(`>${done}`); expect(html).toContain(`>${again}</button>`);
    expect(html).toContain(`aria-valuenow="${records.length}"`); expect(html).toContain('width:100%'); expect(html).toContain('class="button practice-card-action"');
    expect(html).not.toMatch(/practice-card-status|practice-card-restart|practice-card-tag|correct|正确|正確/);
  }
  const peer = { ...session, id: 'unfinished-peer' };
  const mixed = renderToStaticMarkup(createElement(PracticeCard, { title: 'Combined', locale: 'en', sessions: [completed, peer], records, onStart: () => undefined }));
  expect(mixed).toContain('data-state="active"'); expect(mixed).not.toContain('Completed');
  const deleted = renderToStaticMarkup(createElement(PracticeCard, { title: 'Card', locale: 'en', sessions: [{ ...completed, recordsDeleted: true }], records, onStart: () => undefined }));
  expect(deleted).toContain('data-state="empty"'); expect(deleted).not.toContain('Completed');
});


it('does not invent full progress when a completed snapshot lacks saved answers', () => {
  const completed = { ...session, status: 'completed' as const };
  const html = renderToStaticMarkup(createElement(PracticeCard, { title: 'Card', locale: 'en', sessions: [completed], records: [attempt], onStart: () => undefined }));
  expect(html).toContain('data-state="active"'); expect(html).toContain('aria-valuenow="1"');
  expect(html).not.toContain('width:100%'); expect(html).not.toContain('Practice again');
  const empty = renderToStaticMarkup(createElement(PracticeCard, { title: 'Card', locale: 'en', sessions: [completed], records: [], onStart: () => undefined }));
  expect(empty).toContain('data-state="empty"'); expect(empty).not.toContain('progressbar');
});
