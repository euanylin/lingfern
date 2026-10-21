import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { multiGapListening } from '../fixtures/workspace-lessons';
import type { Lesson } from '../../src/shared/content';

async function seed(page: import('@playwright/test').Page, lesson: Lesson) {
  return page.evaluate(async lesson => {
    const id = crypto.randomUUID(), hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(lesson)))), byte => byte.toString(16).padStart(2, '0')).join('');
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('lingfern'); open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result, tx = db.transaction('sessions', 'readwrite');
        tx.objectStore('sessions').add({ id, profileId: 'local-guest', lesson, contentHash: hash, position: 0, status: 'active', startedAt: new Date().toISOString(), assistance: { hintLevel: 0, teachingProvided: true }, leaseUntil: 0, workspace: { drafts: {}, assistance: {} } });
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); };
      };
    }); return id;
  }, lesson);
}

test('installed offline workspace preserves arbitrary reading answers and multi-gap native audio through reload and submission', async ({ page, context }) => {
  await page.goto('/library');
  await page.getByRole('button', { name: /^通用材料/ }).last().click();
  const pack = page.locator('.package-row').filter({ hasText: 'C2 听力录音' }); await pack.locator('input').check();
  await page.getByRole('button', { name: '下载所选资源' }).click(); await expect(pack).toContainText('已安装', { timeout: 90_000 });
  await page.evaluate(() => navigator.serviceWorker.ready); await page.reload();
  const raw = JSON.parse(readFileSync(new URL('../fixtures/content/a1-reading.json', import.meta.url), 'utf8')) as Lesson; raw.organization = 'material-v1'; raw.id = 'offline-workspace-reading';
  const readingId = await seed(page, raw), listening = multiGapListening(), listeningId = await seed(page, listening);
  await context.setOffline(true); await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/learn/${readingId}`); await expect(page.locator('.material-workspace')).toBeVisible();
  await page.locator('.workspace-questions .question-sheet-toggle').click();
  const items = raw.materials.flatMap(material => material.questions);
  for (const [index, question] of [...items].reverse().entries()) {
    await page.locator('.workspace-card button').nth(items.length - 1 - index).click();
    if (!('options' in question)) throw new Error('NO_CHOICE');
    await page.locator('.workspace-question[data-selected=true]').getByRole('radio').nth(question.answer).check();
  }
  await expect(page.locator('.workspace-save-status')).toHaveText('已保存在本设备');
  await page.reload(); await page.locator('.workspace-questions .question-sheet-toggle').click(); await expect(page.locator('.workspace-card button[data-answered=true]')).toHaveCount(4);
  await page.locator('.workspace-card button').last().click();
  await page.getByRole('button', { name: '提交练习', exact: true }).click(); await expect(page.locator('#workspace-result')).toBeVisible(); await expect(page.locator('.workspace-review')).toHaveCount(4);
  await page.reload(); await expect(page.locator('#workspace-result')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(`/learn/${listeningId}`);
  const question = listening.materials[0].questions[0]; if (!('gaps' in question)) throw new Error('NO_GAPS');
  await page.locator('.inline-gap input').nth(1).fill(question.gaps[1].answer); await page.locator('.inline-gap input').first().fill(question.gaps[0].answer);
  await expect(page.locator('.workspace-save-status')).toHaveText('已保存在本设备');
  await page.reload(); await expect(page.locator('.inline-gap input').nth(1)).toHaveValue(question.gaps[1].answer);
  for (const [index, material] of listening.materials.entries()) {
    if (index) await page.locator('.workspace-card button').nth(2).click();
    const audio = page.locator('audio'); await expect(audio).toHaveAttribute('src', material.audio!.src);
    await audio.evaluate((audio: HTMLAudioElement) => { audio.muted = true; audio.playbackRate = 16; });
    await page.getByRole('button', { name: '播放 / 重听', exact: true }).click();
    if (index) for (const [position, item] of material.questions.entries()) {
      if (!('options' in item)) throw new Error('NO_CHOICE');
      await page.locator('.workspace-question').nth(position).getByRole('radio').nth(item.answer).check();
    }
    await expect.poll(() => audio.evaluate((audio: HTMLAudioElement) => audio.ended && audio.duration > 0), { timeout: 15_000 }).toBe(true);
    await expect(page.getByText('录音已播放，可以选择并保存。', { exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: '提交练习', exact: true }).click(); await expect(page.locator('#workspace-result')).toBeVisible();
  await expect(page.locator('.workspace-review').first().locator('.slot-result')).toHaveText(['1: ✓ 回答正确', '2: ✓ 回答正确']);
  await page.reload(); await expect(page.locator('.workspace-review')).toHaveCount(3);
});
