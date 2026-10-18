import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processBatchSources } from '../scripts/spoken-process.mjs';

const item = (articlePageId, fileId = articlePageId) => ({ articlePageId, fileId, transcriptStatus: 'downloaded-source', audioStatus: 'verified-download' });
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const state = () => ({ seen: new Set(), records: [], failures: [] });

test('four independent roots overlap, remain bounded and commit in source order with one checkpoint writer', async () => {
  const context = state();
  let active = 0, maximum = 0, writers = 0, maximumWriters = 0, checkpoints = 0;
  await processBatchSources(Array.from({ length: 28 }, (_, index) => item(index + 1)), {
    ...context,
    processItem: async source => {
      active++; maximum = Math.max(maximum, active);
      await pause(source.fileId % 4 === 1 ? 12 : 2);
      active--;
      return { record: source };
    },
    checkpoint: async complete => {
      assert.equal(complete, false); assert.equal(active, 0);
      writers++; maximumWriters = Math.max(maximumWriters, writers);
      await pause(2); checkpoints++; writers--;
    },
  });
  assert.equal(maximum, 4);
  assert.equal(maximumWriters, 1); assert.equal(checkpoints, 1);
  assert.deepEqual(context.records.map(source => source.fileId), Array.from({ length: 28 }, (_, index) => index + 1));
});

test('duplicate roots try candidates sequentially, fall back after rejection, and never replay a successful root', async () => {
  const context = state();
  const calls = [];
  const processItem = async source => {
    calls.push(source.fileId); await pause(2);
    if (source.fileId === 10) return { failure: { fileId: 10, error: 'AUDIO_INTEGRITY' } };
    return { record: source };
  };
  const options = { ...context, processItem, checkpoint: async () => {} };
  await processBatchSources([item(1, 10), item(2, 20), item(1, 11), item(1, 12)], options);
  assert.deepEqual(context.records.map(source => source.fileId), [11, 20]);
  assert.deepEqual(context.failures, [{ fileId: 10, error: 'AUDIO_INTEGRITY' }]);
  assert(!calls.includes(12)); assert(calls.indexOf(11) > calls.indexOf(10));
  await processBatchSources([item(1, 13), item(2, 21), item(3, 30)], options);
  assert.deepEqual(context.records.map(source => source.fileId), [11, 20, 30]);
  assert(!calls.includes(13) && !calls.includes(21));
});

test('all roots settle, every fatal is collected, and failures prevent complete publication', async () => {
  const context = state();
  const completed = [];
  const checkpoints = [];
  const run = async () => {
    await processBatchSources([item(1), item(2), item(3), item(4), item(5)], {
      ...context,
      processItem: async source => {
        await pause(source.fileId === 4 ? 15 : 2);
        completed.push(source.fileId);
        if (source.fileId < 3) throw new Error('ARTICLE_INTEGRITY');
        return { record: source };
      },
      checkpoint: async complete => { checkpoints.push(complete); assert.equal(completed.length, 4); },
    });
    checkpoints.push(true);
  };
  await assert.rejects(run, error => error instanceof AggregateError && error.errors.length === 2);
  assert.deepEqual(completed.slice().sort(), [1, 2, 3, 4]);
  assert.deepEqual(checkpoints, [false]);
  assert.deepEqual(context.records.map(source => source.fileId), [3, 4]);
  assert.deepEqual(context.failures.map(failure => failure.fileId), [1, 2]);
  assert(context.failures.every(failure => failure.fatal === true));
});
