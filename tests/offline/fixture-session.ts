import { expect, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import type { Lesson } from '../../src/shared/content';

const directory = new URL('../fixtures/content/', import.meta.url);
const snapshots = readdirSync(directory).filter(name => name.endsWith('.json')).map(name => JSON.parse(readFileSync(new URL(name, directory), 'utf8')) as Lesson);

// Keep question-type fixtures intact; exercise normal assembly separately.
export async function confirmFixtureTask(page: Page) {
  const title = await page.locator('#task-detail-title').textContent();
  const lesson = snapshots.find(lesson => Object.values(lesson.title).includes(title?.trim() ?? ''));
  if (!lesson) throw new Error(`Missing frozen lesson: ${title}`);
  const id = await page.evaluate(async lesson => {
    const id = crypto.randomUUID(), contentHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(lesson)))), byte => byte.toString(16).padStart(2, '0')).join('');
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('lingfern'); request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, transaction = db.transaction('sessions', 'readwrite');
        transaction.objectStore('sessions').add({ id, profileId: 'local-guest', lesson, contentHash, position: 0, status: 'active', startedAt: new Date().toISOString(), assistance: { hintLevel: 0, teachingProvided: true }, leaseUntil: 0 });
        transaction.oncomplete = () => { db.close(); resolve(); }; transaction.onerror = () => { db.close(); reject(transaction.error); };
      };
    }); return id;
  }, lesson);
  await page.goto(`/learn/${id}`); await expect(page.locator('.material-workspace')).toBeVisible();
}
