import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { selectPicker } from './picker';

const draft = JSON.parse(readFileSync(new URL('../fixtures/retired-content/voa-listening-checks.json', import.meta.url), 'utf8'))[0];
const providerSnapshot = structuredClone(draft); providerSnapshot.mode = 'test'; delete providerSnapshot.expectedMinutes;
// Pair existing provider/Commons fixtures while preserving roots and evidence.
// Meet the two-source practice shape without inventing or approving sources.
const word = JSON.parse(readFileSync(new URL('../../tests/fixtures/content/a1-listening.json', import.meta.url), 'utf8')).materials[0];
for (const question of word.questions) delete question.hints;
providerSnapshot.materials.push(word);

test('isolated practice snapshot uses the shared detail action and test restrictions without catalogue approval', async ({ page }) => {
  await page.goto('/settings');
  await selectPicker(page, '语言', 'en');
  const before = await page.evaluate(async () => (await import('/src/data/db.ts' as string)).sessions.count());
  await page.evaluate(async fixture => {
    const { createElement } = (await import('/node_modules/.vite/deps/react.js' as string)).default;
    const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default;
    const { TaskDetail } = await import('/src/app/TaskDetail.tsx' as string);
    // Keep valid practice fixtures outside normal curriculum installs.
    const practice = fixture;
    const { asTestLesson } = await import('/src/shared/content.ts' as string);
    const host = document.createElement('div'); document.body.appendChild(host);
    createRoot(host).render(createElement(TaskDetail, {
      lesson: practice, locale: 'en', profileId: 'local-guest', action: 'Start listening', available: true,
      busy: false, startError: '',
      onStart: async () => { throw new Error('Practice callback must not run for Test'); },
      // Pass the exact preview snapshot without selecting another source.
      onCheck: async (snapshot: typeof practice) => { const session = await (await import('/src/data/db.ts' as string)).createSession(asTestLesson(snapshot)); location.assign(`/learn/${session.id}`); },
      onClose: () => {},
    }));
  }, JSON.parse(readFileSync(new URL('../../tests/fixtures/content/a1-listening.json', import.meta.url), 'utf8')));
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('[data-mode=practice]')).toHaveText('Practice');
  await expect(dialog.locator('[data-mode=test]')).toHaveText('Test');
  await expect(dialog.locator('audio,.passage')).toHaveCount(0);
  expect(await page.evaluate(async () => (await import('/src/data/db.ts' as string)).sessions.count())).toBe(before);
  await dialog.locator('[data-mode=test]').click();
  await expect(page.locator('.question-panel')).toBeVisible();
  await expect(page.locator('.session-meta')).toHaveCount(0);
  await expect(page.locator('.check-intro')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload(); await expect(page.locator('.question-panel')).toBeVisible();
  await expect(page.locator('.question-sheet-toggle')).not.toBeVisible();
  await expect(page.getByRole('button', { name: /hint/i })).toHaveCount(0);
  await expect(page.locator('.dictionary-panel')).toHaveCount(0);
  await expect(page.locator('.audio-timeline input[type=range]')).toBeVisible();
  await expect(page.locator('.teaching,.hint,.ai-handoff,.self-assessment,.selection-dictionary,.check-end')).toHaveCount(0);
  const actual = await page.evaluate(async () => (await (await import('/src/data/db.ts' as string)).sessions.toArray())[0].lesson);
  const practice = JSON.parse(readFileSync(new URL('../../tests/fixtures/content/a1-listening.json', import.meta.url), 'utf8'));
  expect(actual.mode).toBe('test'); expect(actual.id).toBe(practice.id); expect(actual.reviewStatus).toBe(practice.reviewStatus);
  expect(actual.materials.map((material: { rootId: string; questions: { id: string }[] }) => ({ rootId: material.rootId, ids: material.questions.map(question => question.id) }))).toEqual(practice.materials.map((material: { rootId: string; questions: { id: string }[] }) => ({ rootId: material.rootId, ids: material.questions.map(question => question.id) })));
  expect(actual.teaching).toBeUndefined(); expect(actual.workedExample).toBeUndefined();
});

test('isolated draft provider audio uses test controls without approving the source for the catalogue', async ({ page }) => {
  await page.goto('/settings'); await selectPicker(page, '语言', 'en');
  await page.evaluate(async fixture => {
    // Reuse legacy media/questions in test mode without releasing practice sources.
    const { createSession } = await import('/src/data/db.ts' as string);
    const session = await createSession({ ...fixture, mode: 'test' }); location.assign(`/learn/${session.id}`);
  }, providerSnapshot);
  await expect(page.locator('.question-panel')).toBeVisible(); await expect(page.locator('.check-intro')).toHaveCount(0);
  await expect(page.locator('.session-meta')).toHaveCount(0);
  await expect(page.locator('.audio-timeline input[type=range]')).toBeVisible();
  await expect(page.locator('.teaching,.hint,.ai-handoff,.self-assessment,.selection-dictionary,.check-end')).toHaveCount(0);
  const questions = providerSnapshot.materials.flatMap((material: { questions: { options: string[]; answer: number }[] }) => material.questions);
  for (const [index, question] of questions.entries()) {
    await page.getByRole('radio', { name: question.options[question.answer], exact: true }).check();
    if (index === 0 || index === draft.materials[0].questions.length) {
      await expect(page.getByRole('button', { name: 'Save answer', exact: true })).toBeDisabled();
      await page.locator('audio').evaluate((audio: HTMLAudioElement) => { audio.playbackRate = 16; });
      await page.getByRole('button', { name: 'Play / replay', exact: true }).click();
      await expect(page.getByText('Recording played. You can choose and save.', { exact: true })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Save answer', exact: true }).click();
    if (index < questions.length - 1) {
      await expect(page.getByText('Response saved. Answers appear after the check.', { exact: true })).toBeVisible();
      await expect(page.locator('.check-result')).toHaveCount(0);
      await page.reload();
      await page.getByRole('button', { name: 'Next question', exact: true }).click();
      await expect(page.locator('.feedback')).toHaveCount(0);
    }
  }
  await expect(page.getByRole('heading', { name: 'Check finished', exact: true })).toBeVisible();
  await expect(page.locator('.check-result')).toHaveCount(5);
  const state = await page.evaluate(async () => {
    const { sessions, attempts } = await import('/src/data/db.ts' as string);
    const session = (await sessions.toArray())[0];
    return { skill: session.lesson.skill, mode: session.lesson.mode, reviewStatus: session.lesson.reviewStatus,
      checkGroup: !!session.checkGroupId, practiceGroup: !!session.practiceGroupId,
      sameQuestionIds: JSON.stringify(session.lesson.materials.flatMap((material: { questions: { id: string }[] }) => material.questions.map(question => question.id))), helpers: !!session.lesson.teaching || !!session.lesson.workedExample || session.lesson.materials.some((material: { questions: { hints?: unknown; modelAnswer?: unknown }[] }) => material.questions.some(question => question.hints || question.modelAnswer)),
      attempts: (await attempts.toArray()).map((saved: { correct: boolean; assistance: { audioCompleted?: boolean; hintLevel: number; dictionaryUsed?: boolean } }) => ({ correct: saved.correct, audioCompleted: saved.assistance.audioCompleted, hints: saved.assistance.hintLevel, dictionary: !!saved.assistance.dictionaryUsed })) };
  });
  expect(state).toEqual({ skill: 'listening', mode: 'test', reviewStatus: 'draft', checkGroup: false, practiceGroup: false,
    sameQuestionIds: JSON.stringify(providerSnapshot.materials.flatMap((material: { questions: { id: string }[] }) => material.questions.map(question => question.id))), helpers: false,
    attempts: Array.from({ length: 5 }, () => ({ correct: true, audioCompleted: true, hints: 0, dictionary: false })) });
  await page.reload(); await expect(page.locator('.check-result')).toHaveCount(5);
});
