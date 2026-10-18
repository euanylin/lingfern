import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import raw from './fixtures/content/a1-reading.json';
import { lessonSchema, type Locale } from '../src/shared/content';
import { type Attempt } from '../src/data/db';
import { AiHandoff } from '../src/app/AiHandoff';

it.each<Locale>(['zh-Hans', 'zh-Hant', 'en'])('keeps real source and audio credits without draft or limitation banners: %s', locale => {
  const lesson = lessonSchema.parse(raw), material = lesson.materials[0], question = material.questions[0];
  material.credit = { attribution: 'Source Author', license: 'CC BY 4.0', sourceUrl: 'https://example.org/source' };
  material.audio = { src: '/audio/example.mp3', duration: 10, sha256: 'a'.repeat(64), author: 'Recording Author', license: 'CC BY 3.0', sourceUrl: 'https://example.org/audio' };
  const attempt: Attempt = { id: 'test', sessionId: 'test', profileId: 'local-guest', questionId: question.id, rootId: material.rootId, answer: '', correct: null, rule: 'test', assistance: { hintLevel: 0 }, submittedAt: '2026-10-13T00:00:00Z' };
  const html = renderToStaticMarkup(createElement(AiHandoff, { locale, lesson, material, question, attempt }));
  expect(html).not.toMatch(/开发草稿|開發草稿|人工审阅|人工審閱|development draft|editorial review pending|使用限制|Limitations|formal language level/i);
  for (const credit of ['Source Author', 'CC BY 4.0', 'Recording Author', 'CC BY 3.0']) expect(html).toContain(credit);
});
