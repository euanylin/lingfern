import { chromium, expect } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { corpusInterestMatch, corpusPracticeHistory } from '../src/core/corpusPractice.ts';

// Local-only actual bank acceptance; private sources and learner records never enter CI.
const origin = 'http://127.0.0.1:8787';
const starting = process.argv.find(arg => arg.startsWith('--starting='))?.slice(11);
assert(!starting || ['A1','A2','B1','B2','C1','C2'].includes(starting));
const directory = process.argv.find(arg => arg.startsWith('--bank-directory='))?.slice(17) ?? 'private/corpus/spoken/listening-packs';
const files = (await readdir(directory)).filter(name => name.endsWith('.zip')).sort().map(name => `${directory}/${name}`);
const interest = process.argv.includes('--interest') ? 'science' : undefined;
const due = process.argv.includes('--due');
const replay = process.argv.includes('--replay');
const mixed = process.argv.includes('--mixed');
const inventory = JSON.parse(await readFile(`${directory}/inventory.json`, 'utf8'));
assert(inventory.roots >= 774 && inventory.clips >= 1454);
assert.equal(files.length, inventory.packs.length);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1440, height: 900 } });
const page = await context.newPage(); const errors = [], external = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', route => {
  if (route.request().url().startsWith(origin + '/')) return route.continue();
  external.push(route.request().url()); return route.abort();
});
async function rows(table) {
  return page.evaluate(table => new Promise((resolve, reject) => {
    const open = indexedDB.open('lingfern'); open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, request = db.transaction(table).objectStore(table).getAll();
      request.onsuccess = () => { resolve(request.result); db.close(); };
      request.onerror = () => { reject(request.error); db.close(); };
    };
  }), table);
}
try {
  await page.goto(`${origin}/library`); await page.evaluate(() => navigator.serviceWorker.ready); await page.reload();
  assert(await page.evaluate(() => !!navigator.serviceWorker.controller)); await context.setOffline(true);
  await page.getByLabel('导入 ZIP').setInputFiles('private/retired-public-packs/2026-10-01-listening-quality-update/wikipedia-listening-001.zip');
  await expect(page.locator('.community-import').getByRole('status').filter({ hasText: '资源已安装' })).toBeVisible({ timeout: 90000 });
  const legacy = await rows('communityPacks');
  assert.equal(legacy.length, 1); assert(legacy[0].spoken.records.every(record => record.clips.every(clip => clip.qualityFlags.length > 0)));
  await page.goto(`${origin}/today`);
  await page.locator('.corpus-practice[data-skill=listening]').getByRole('button', { name: '开始', exact: true }).click();
  await expect(page.locator('.corpus-practice[data-skill=listening] [role=status]')).toContainText('试试其他资料。');
  await expect(page.getByRole('dialog')).toHaveCount(0); assert.equal((await rows('sessions')).length, 0);
  assert.equal((await rows('communityPacks')).length, 1);
  await page.goto(`${origin}/library`);
  await page.getByLabel('导入 ZIP').setInputFiles(files);
  await expect(page.locator('.community-import').getByRole('status').filter({ hasText: '资源已安装' })).toBeVisible({ timeout: 300000 });
  const installed = await rows('communityPacks');
  assert.equal(installed.length, inventory.packs.length + legacy.length);
  assert(installed.some(pack => pack.hash === legacy[0].hash));
  const packs = installed.filter(pack => pack.hash !== legacy[0].hash);
  if (inventory.textReview) for (const root of inventory.textReview.withheld) assert(packs.every(pack => pack.spoken.records.every(record => record.rootId !== root)));
  assert.equal(packs.length, inventory.packs.length); assert(packs.every(pack => pack.state === 'ready' && pack.lessons.length === 0 && pack.spoken?.communityPackageId === pack.hash));
  assert.equal(packs.reduce((sum, pack) => sum + pack.spoken.records.length, 0), inventory.roots);
  assert.equal(packs.reduce((sum, pack) => sum + pack.spoken.records.reduce((total, record) => total + record.clips.length, 0), 0), inventory.clips);
  const flagged = packs.flatMap(pack => pack.spoken.records).flatMap(record => record.clips).filter(clip => clip.qualityFlags.length);
  assert(flagged.length > 0);
  let generationPacks = packs;
  if (mixed) {
    const currentDirectory = 'private/corpus/spoken/reviewed-listening-packs';
    const currentFiles = (await readdir(currentDirectory)).filter(name => name.endsWith('.zip')).sort().map(name => `${currentDirectory}/${name}`);
    const currentInventory = JSON.parse(await readFile(`${currentDirectory}/inventory.json`, 'utf8'));
    await page.getByLabel('导入 ZIP').setInputFiles(currentFiles);
    await expect(page.locator('.community-import').getByRole('status').filter({ hasText: '资源已安装' })).toBeVisible({ timeout: 300000 });
    const all = await rows('communityPacks');
    assert.equal(all.length, installed.length + currentInventory.packs.length);
    assert(installed.every(pack => all.some(row => row.hash === pack.hash)));
    const currentHashes = new Set(currentInventory.packs.map(pack => pack.sha256));
    generationPacks = all.filter(pack => currentHashes.has(pack.hash));
    assert.equal(generationPacks.length, currentInventory.packs.length);
  }
  let annotatedCompletions = 0;
  if ((directory.includes('annotated') || directory.includes('review-filtered') || directory.includes('sentence') || directory.includes('reviewed'))) assert(packs.every(pack => pack.spoken.records.every(record => record.clips.every(clip => clip.language))));
  const assertEligible = lesson => {
    assert.equal(lesson.sourceId, lesson.materials[0].sourceId);
    const bank = generationPacks.find(pack => pack.hash === lesson.communityPackageId);
    assert(bank, 'A current installed context was shadowed by an older source alias');
    for (const material of lesson.materials) {
      const clip = bank.spoken.records.flatMap(record => record.clips).find(clip => `corpus-${clip.id}` === material.id);
      assert(clip && clip.qualityFlags.length === 0);
      if ((directory.includes('annotated') || directory.includes('review-filtered') || directory.includes('sentence') || directory.includes('reviewed'))) for (const question of material.questions) {
        if ('kind' in question && question.kind === 'completion' && clip.language.tokens.length) {
          assert(clip.language.tokens.some(token => clip.text.slice(token.start, token.end) === question.answer));
          annotatedCompletions++;
        }
      }
    }
  };
  const cached = await page.evaluate(async packs => {
    let count = 0;
    for (const pack of packs) {
      const cache = await caches.open(`lingfern-community-${pack.hash}`);
      for (const record of pack.spoken.records) for (const clip of record.clips) {
        if (!await cache.match(clip.audio.src)) throw new Error('MISSING_RECORDING'); count++;
      }
    }
    return count;
  }, packs);
  assert.equal(cached, inventory.clips);
  console.log(`All ${packs.length} actual banks/${inventory.roots} roots/${cached} playable assets imported with the network disconnected.`);
  await page.goto(`${origin}/today`);
  if (starting) {
    await page.goto(`${origin}/start`);
    for (let step = 0; step < 2; step++) await page.getByRole('button', { name: '跳过这一步', exact: true }).click();
    if (interest) { await page.getByLabel('科普', { exact: true }).check(); await page.getByRole('button', { name: '保存并继续', exact: true }).click(); }
    else await page.getByRole('button', { name: '跳过这一步', exact: true }).click();
    await page.getByRole('group', { name: '听力', exact: true }).getByLabel(new RegExp('^' + starting + ' ·')).check();
    await page.getByRole('group', { name: '阅读', exact: true }).getByLabel(/^C2 ·/).check();
    await page.getByRole('button', { name: '保存并继续', exact: true }).click();
    await page.getByRole('button', { name: '保存并前往今日', exact: true }).click();
    assert((await rows('profiles')).some(profile => profile.preferences?.listening === starting));
  }
  const practice = page.locator('.corpus-practice[data-skill=listening]');
  const dialog = page.getByRole('dialog');
  // Fix only the generation seed in this isolated profile; source text/audio stay real.
  let sequenceFound = false;
  for (let seed = 0; seed < 60 && !sequenceFound; seed++) {
    await page.evaluate(seed => {
      window.lingfernTestRandom ??= crypto.getRandomValues.bind(crypto);
      crypto.getRandomValues = values => values instanceof Uint32Array && values.length === 1 ? (values[0] = seed, values) : window.lingfernTestRandom(values);
    }, seed);
    await practice.getByRole('button', { name: '开始', exact: true }).click();
    await expect(dialog).toBeVisible();
    sequenceFound = (await dialog.innerText()).includes('排序');
    if (!sequenceFound) await dialog.getByRole('button', { name: '关闭详情', exact: true }).click();
  }
  await page.evaluate(() => { crypto.getRandomValues = window.lingfernTestRandom; delete window.lingfernTestRandom; });
  assert(sequenceFound, 'No real source produced a sequence task in 60 deterministic seeds');
  await expect(dialog).toContainText('音频');
  await expect(dialog).not.toContainText('暂时无法读取');
  await expect(dialog.locator('.eyebrow')).toHaveText('LISTENING');
  await dialog.locator('button[data-mode=practice]').click();
  await expect(page).toHaveURL(/\/learn\//);
  const session = (await rows('sessions'))[0];
  if (interest) { assert((await rows('profiles')).some(profile => profile.preferences?.interests.includes(interest))); assert(session.lesson.materials.some(material => corpusInterestMatch(material.title + '\n' + material.blocks[0].text, [interest]))); }
  if (starting === 'B1') assert(session.lesson.materials.every(material => material.audio.duration <= 35));
  await expect(page.locator('.session-meta')).toHaveCount(0);
  assert.equal(session.lesson.skill, 'listening');
  await expect(page.getByText('离线', { exact: true })).toBeVisible();
  await expect(page.getByText(/尚未确认资源完整安装/)).toHaveCount(0);
  assertEligible(session.lesson);
  assert(session.lesson.materials.some(material => material.questions.some(question => question.kind === 'sequence')));
  await page.goto(`${origin}/today`);
  await expect(practice.getByRole('button', { name: '继续', exact: true })).toBeVisible();
  await practice.getByRole('button', { name: '继续', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/learn/${session.id}$`));
  assert(session.lesson.skill === 'listening' && session.lesson.generation.generator === 'corpus-v1');
  assert.equal(new Set(session.lesson.materials.map(material => material.rootId)).size, 2);
  assert(session.lesson.materials.every(material => material.audio.src.startsWith(`/audio/community-${session.lesson.communityPackageId}/`) && !material.audio.synthetic));
  await expect(page.locator('.learning-grid + .source')).toContainText('Recording:');
  await expect(page.locator('.material .passage')).toHaveCount(0);
  for (const width of [1440, 1200, 1024, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 812 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (width < 1200) await expect.poll(() => page.locator('.question-panel').evaluate(card => { const box = card.getBoundingClientRect(); return Math.abs(box.left - Math.max(12, (innerWidth - 560) / 2)) < 1 && Math.abs(box.top - (innerHeight - 120)) < 1; })).toBe(true);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: `output/playwright/wikipedia-${mixed ? 'mixed' : 'sentence'}-listening-${width}-light-zh-Hans-offline.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 }); await expect(page.locator('#question-sheet-content')).not.toHaveAttribute('inert');
  const questions = session.lesson.materials.flatMap(material => material.questions);
  for (let index = 0; index < questions.length; index++) {
    const question = questions[index];
    await expect(page.locator('.question-panel form h2')).toHaveText(question.prompt); await expect(page.locator('.feedback')).not.toBeVisible();
    if (question.kind === 'completion' || question.kind === 'sequence') {
      if (question.kind === 'completion') await page.locator('.completion-answer input').fill(question.answer);
      else for (const step of question.acceptedOrders[0]) await page.getByRole('button', { name: `添加步骤: ${step}`, exact: true }).click();
      if (question.kind === 'completion') await expect(page.locator('.completion-answer input')).toHaveValue(question.answer);
      await expect(page.getByRole('button', { name: '保存答案', exact: true })).toBeDisabled();
      await page.locator('audio').evaluate(audio => audio.playbackRate = 4);
      await page.getByRole('button', { name: '播放 / 重听', exact: true }).click();
      await expect(page.getByText('录音已播放，可以选择并保存。', { exact: true })).toBeVisible({ timeout: session.lesson.materials[index / 2].audio.duration * 250 + 15000 });
      if (replay && index === 0) {
        await page.getByRole('button', { name: '播放 / 重听', exact: true }).click();
        await expect.poll(() => page.locator('audio').evaluate(audio => audio.ended), {
          timeout: session.lesson.materials[0].audio.duration * 250 + 15000,
        }).toBe(true);
      }
    } else await page.locator('.response-answer textarea').fill('The speaker describes a situation in the recording. I support my interpretation with specific words I heard and avoid inventing missing context.');
    await page.getByRole('button', { name: '保存答案', exact: true }).click();
    await expect(page.getByRole('heading', { name: question.kind !== 'response' ? '✓ 回答正确' : '已保存 · 未自动评分', exact: true })).toBeVisible();
    if (question.kind === 'response') {
      for (const fieldset of await page.locator('.self-assessment fieldset').all()) await fieldset.locator('input[value=met]').check();
      await page.getByRole('button', { name: 'Save self-assessment', exact: true }).click();
      await expect(page.getByText('Self-assessment saved.', { exact: true })).toBeVisible();
    }
    await page.reload(); await expect(page.locator('.feedback')).toBeVisible();
    if (index === 0) {
      await page.locator('.ai-handoff > summary').click();
      await expect(page.locator('.ai-preview')).toContainText(session.lesson.materials[0].audio.sourceUrl);
      await expect(page.locator('.ai-preview')).toContainText('Recording:');
      await expect(page.locator('.ai-preview')).not.toContainText('B2 /');
      await page.locator('.ai-handoff > summary').click();
    }
    if (index < questions.length - 1) await page.getByRole('button', { name: '下一题', exact: true }).click();
  }
  const saved = await rows('attempts'); assert.equal(saved.length, 4);
  assert.equal(saved.filter(answer => answer.correct === null).length, 2); assert(saved.every(answer => answer.assistance.audioCompleted));
  assert(saved.filter(answer => answer.correct === null).every(answer => answer.selfAssessment.every(value => value === 'met')));
  await page.getByRole('link', { name: '返回今日', exact: true }).click(); await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  await page.goto(`${origin}/progress`);
  await expect(page.locator('.progress-source-list .progress-cell')).toHaveCount(1);
  await expect(page.locator('.progress-matrix')).toHaveCount(0);
  if (due) await page.clock.setFixedTime(new Date(Math.max(...saved.map(answer => Date.parse(answer.submittedAt))) + 86400001));
  await page.goto(`${origin}/today`);
  if (replay) {
    assert(saved.some(answer => answer.correct !== null && answer.assistance.playbackRequests > 1));
  }
  const policy = corpusPracticeHistory(await rows('sessions'), saved, session.profileId, 'listening', 'all', starting);
  const shorter = { A1: 8, A2: 12, B1: 20, B2: 25, C1: 35, C2: 60 };
  const longer = { A1: 12, A2: 25, B1: 60, B2: 91, C1: 91, C2: 91 };
  assert.equal(policy.maxSeconds, (replay ? shorter : longer)[starting ?? 'B2']);
  assert.equal(policy.independent, !replay);
  if (replay) assert(policy.focus);
  await practice.getByRole('button', { name: '开始', exact: true }).click();
  if (due) await expect(page.getByRole('dialog')).toContainText('复习:');
  await page.getByRole('dialog').locator('button[data-mode=practice]').click();
  const fresh = (await rows('sessions')).find(item => item.id !== session.id);
  assertEligible(fresh.lesson);
  if (due) { assert(fresh.lesson.generation.focus); assert(fresh.lesson.materials.some(material => material.questions.some(question => question.kind === fresh.lesson.generation.focus))); assert(fresh.lesson.materials.every(material => !session.lesson.materials.some(old => old.rootId === material.rootId))); }
  if (replay) { assert.equal(fresh.lesson.generation.focus, policy.focus.kind); assert(fresh.lesson.materials.some(material => material.questions.some(question => question.kind === policy.focus.kind))); }
  assert(fresh.lesson.materials.every(material => material.audio.duration <= policy.maxSeconds));
  if (replay) assert(fresh.lesson.materials.every(material => material.audio.duration <= shorter[starting ?? 'B2']));
  assert(fresh && fresh.lesson.materials.every(material => !session.lesson.materials.some(old => old.id === material.id)));
  const missing = fresh.lesson.materials[0].audio.src;
  await page.evaluate(async ({ hash, path }) => { const cache = await caches.open(`lingfern-community-${hash}`); await cache.delete(path); }, { hash: fresh.lesson.communityPackageId, path: missing });
  await page.reload(); await page.getByRole('button', { name: '播放 / 重听', exact: true }).click();
  await expect(page.locator('.material [role=alert]')).toBeVisible(); assert.equal((await rows('attempts')).length, 4);
  if ((directory.includes('annotated') || directory.includes('review-filtered') || directory.includes('sentence') || directory.includes('reviewed'))) assert(annotatedCompletions > 0);
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  console.log('PASS: two-root client listening generation, real offline playback gating, four saves/two unscored, English self-assessment and source-credit recovery/handoff, fresh clips, missing-audio failure preserves answers; six widths. Draft transcripts/permissions remain unapproved.');
} finally { await context.close(); await browser.close(); }
