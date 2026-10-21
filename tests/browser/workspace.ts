import { expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Lesson, Question } from '../../src/shared/content';
import { questionSlots } from '../../src/shared/practiceWorkspace';
import { showLearningPane } from './learning-pane';

export async function openSnapshot(page: Page, name: string, onePerMaterial = false) {
  const lesson = JSON.parse(readFileSync(`tests/fixtures/content/${name}.json`, 'utf8')) as Lesson;
  if (onePerMaterial) lesson.materials = lesson.materials.map(material => ({ ...material, questions: [material.questions[0]] }));
  await page.goto('/today');
  const id = await page.evaluate(async lesson => (await (await import('/src/data/db.ts' as string)).createSession(lesson)).id, lesson);
  await page.goto(`/learn/${id}`);
  await expect(page.locator('.material-workspace')).toBeVisible();
  return { id, lesson };
}
export async function currentSnapshot(page: Page): Promise<Lesson> {
  await expect(page).toHaveURL(/\/learn\/[^/]+$/);
  await expect(page.locator('.material-workspace')).toBeVisible();
  return page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).sessions.get(id)).lesson, page.url().split('/').at(-1));
}
export async function focusQuestion(page: Page, lesson: Lesson, index: number) {
  const questions = lesson.materials.flatMap(material => material.questions), question = questions[index];
  const number = 1 + questions.slice(0, index).reduce((sum, item) => sum + questionSlots(item), 0);
  await showLearningPane(page, 'question');
  const card = page.locator('.workspace-card');
  await card.evaluate((element: HTMLDetailsElement) => { element.open = true; element.scrollIntoView({ block: 'center' }); });
  await card.getByRole('button', { name: new RegExp(`^${number}\\.`) }).click();
  const section = page.locator('.workspace-question').filter({ has: page.locator(`[id="prompt-${question.id}"]`) });
  await expect(section).toBeVisible();
  return section;
}
export async function fillQuestion(section: Locator, question: Question) {
  if ('pairs' in question) {
    for (const [index, pair] of question.pairs.entries()) {
      await section.locator('.setting-trigger').nth(index).click();
      await section.page().getByRole('listbox').getByRole('option', { name: pair.answer, exact: true }).click();
    }
  } else if ('rows' in question) {
    for (const [index, row] of question.rows.entries()) await section.getByRole('textbox').nth(index).fill(row.answer);
  } else if ('steps' in question) {
    for (const step of question.acceptedOrders[0]) await section.locator('.sequence-choices').getByRole('button', { name: `${step} ＋`, exact: true }).click();
  } else if ('criteria' in question) {
    await section.getByRole('textbox').fill(question.modelAnswer ?? 'A source-bound response retaining the stated conditions.');
  } else if ('kind' in question && question.kind === 'completion') await section.getByRole('textbox').fill(question.answer);
  else if ('gaps' in question) for (const [index, gap] of question.gaps.entries()) await section.getByRole('textbox').nth(index).fill(gap.answer);
  else await section.getByRole('radio').nth('spans' in question ? question.accepted[0] : question.answer).check();
}
export async function playMaterial(page: Page) {
  const audio = page.locator('audio');
  await audio.evaluate((element: HTMLAudioElement) => { element.muted = true; element.playbackRate = 16; });
  await page.locator('.audio-play').click();
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.ended), { timeout: 25_000 }).toBe(true);
  await expect.poll(() => page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).sessions.get(id)).assistance.audioCompleted, page.url().split('/').at(-1))).toBe(true);
}
export async function fillWorkspace(page: Page, snapshot?: Lesson) {
  const lesson = snapshot ?? await currentSnapshot(page);
  let index = 0;
  for (const material of lesson.materials) {
    for (const question of material.questions) {
      const section = await focusQuestion(page, lesson, index++);
      await fillQuestion(section, question);
    }
    if (material.audio) await playMaterial(page);
  }
  await expect(page.locator('button[type=submit]')).toBeEnabled();
}
export async function submitWorkspace(page: Page) {
  await page.locator('button[type=submit]').click();
  await expect(page.locator('#workspace-result')).toBeVisible();
}
export async function completeWorkspace(page: Page, lesson?: Lesson) {
  await fillWorkspace(page, lesson); await submitWorkspace(page);
}

export async function verifyWorkspace(page: Page, lesson: Lesson) {
  const questions = lesson.materials.flatMap(material => material.questions.map(question => ({ material, question })));
  const reviews = page.locator('.workspace-review');
  await expect(reviews).toHaveCount(questions.length);
  for (const [index, { material, question }] of questions.entries()) {
    const spans = [{ blockId: question.blockId, ...question.evidence }, ...(question.additionalEvidence ?? [])];
    for (const [part, span] of spans.entries()) {
      const source = material.blocks.find(block => block.id === span.blockId)!.text.slice(span.start, span.end);
      await expect(reviews.nth(index).locator(':scope > blockquote').nth(part)).toContainText(source);
      await expect(reviews.nth(index).locator(':scope > blockquote').nth(part).locator('.evidence-source')).toHaveText(material.blocks.find(block => block.id === span.blockId)!.title ?? material.title);
    }
    if (!('criteria' in question)) await expect(reviews.nth(index).locator('.slot-result')).toHaveText(Array(questionSlots(question)).fill(/✓/));
  }
  const records = await page.evaluate(async id => {
    const db = await import('/src/data/db.ts' as string);
    return { session: await db.sessions.get(id), attempts: await db.attempts.where('sessionId').equals(id).toArray() };
  }, page.url().split('/').at(-1));
  expect(records.session.status).toBe('completed'); expect(records.session.lesson).toEqual(lesson);
  expect(records.attempts).toHaveLength(questions.length);
  return records;
}

export async function seedLegacyAnswers(page: Page, count: number) {
  const lesson = JSON.parse(readFileSync('tests/fixtures/content/a1-reading.json', 'utf8')) as Lesson;
  await page.goto('/today');
  return page.evaluate(async ({ lesson, count }) => {
    const db = await import('/src/data/db.ts' as string);
    const session = await db.createSession(lesson), owner = 'isolated-legacy-regression';
    await db.claimSession(session.id, owner);
    const all = lesson.materials.flatMap(material => material.questions);
    for (let index = 0; index < count; index++) {
      await db.markExposure(await db.sessions.get(session.id));
      const question = all[index]; if (!('options' in question)) throw new Error('Expected a legacy choice fixture');
      await db.submit(session.id, owner, question.answer);
      if (index < count - 1) await db.advance(session.id, owner);
    }
    await db.releaseSession(session.id, owner);
    return session.id;
  }, { lesson, count });
}
