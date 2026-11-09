import test from 'node:test';
import assert from 'node:assert/strict';
import { GapScheduler } from '../src/spacing.js';

function clock() {
  let elapsed = 0, nextId = 0;
  const timers = new Map();
  return {
    now: () => elapsed,
    setTimer(callback, milliseconds) { const id = ++nextId; timers.set(id, { callback, at: elapsed + milliseconds }); return id; },
    clearTimer(id) { timers.delete(id); },
    advance(milliseconds) {
      elapsed += milliseconds;
      for (const [id, timer] of [...timers]) if (timer.at <= elapsed && timers.delete(id)) timer.callback();
    },
    get count() { return timers.size; },
    callback: () => [...timers.values()][0]?.callback,
  };
}

test('countdown follows elapsed time when timer callbacks are delayed', async () => {
  const time = clock(), scheduler = new GapScheduler(time), ticks = [];
  const completed = scheduler.wait(2, remaining => ticks.push(remaining));
  assert.equal(scheduler.pending, true); assert.equal(time.count, 1);
  time.advance(700); time.advance(600); time.advance(1000);
  assert.equal(await completed, true); assert.deepEqual(ticks, [2, 1.3, 0.7, 0]);
  assert.equal(scheduler.pending, false); assert.equal(time.count, 0);
});

test('cancel settles immediately and removes the pending timer', async () => {
  const time = clock(), scheduler = new GapScheduler(time);
  const pending = scheduler.wait(10); scheduler.cancel();
  assert.equal(await pending, false); assert.equal(scheduler.pending, false); assert.equal(time.count, 0);
  scheduler.cancel(); assert.equal(scheduler.pending, false);
});

test('restarting cancels the old wait and stale callbacks cannot affect the new wait', async () => {
  const time = clock(), scheduler = new GapScheduler(time), ticks = [];
  const old = scheduler.wait(1), stale = time.callback();
  const current = scheduler.wait(3, remaining => ticks.push(remaining));
  assert.equal(await old, false); stale();
  assert.equal(scheduler.pending, true); assert.deepEqual(ticks, [3]); assert.equal(time.count, 1);
  time.advance(3000); assert.equal(await current, true); assert.deepEqual(ticks, [3, 0]);
});

test('zero spacing completes immediately and cancels an earlier wait', async () => {
  const time = clock(), scheduler = new GapScheduler(time), ticks = [];
  const old = scheduler.wait(2), immediate = scheduler.wait(0, remaining => ticks.push(remaining));
  assert.equal(await old, false); assert.equal(await immediate, true); assert.deepEqual(ticks, [0]);
  assert.equal(time.count, 0); assert.equal(scheduler.pending, false);
});

test('spacing accepts finite values up to ten seconds and rejects invalid values', async () => {
  const time = clock(), scheduler = new GapScheduler(time);
  const pending = scheduler.wait(0.25); time.advance(250); assert.equal(await pending, true);
  for (const value of [-1, 10.1, NaN, Infinity, -Infinity, null, '2']) await assert.rejects(scheduler.wait(value), /between 0 and 10/);
  await assert.rejects(scheduler.wait(1, null), /must be a function/);
  assert.equal(scheduler.pending, false); assert.equal(time.count, 0);
});

test('initial countdown callback failures reject without a pending timer', async () => {
  const time = clock(), scheduler = new GapScheduler(time), error = new Error('Countdown failed');
  await assert.rejects(scheduler.wait(2, () => { throw error; }), failure => failure === error);
  assert.equal(scheduler.pending, false); assert.equal(time.count, 0);
  await assert.rejects(scheduler.wait(0, () => { throw error; }), failure => failure === error);
});

test('later callback failures settle the wait and allow a fresh countdown', async () => {
  const time = clock(), scheduler = new GapScheduler(time);
  const pending = scheduler.wait(2, remaining => { if (remaining < 2) throw new Error('Countdown failed'); });
  time.advance(500); await assert.rejects(pending, /Countdown failed/);
  assert.equal(scheduler.pending, false); assert.equal(time.count, 0);
  const next = scheduler.wait(1); time.advance(1000); assert.equal(await next, true);
});

test('countdown callbacks can cancel or replace their own wait safely', async () => {
  const time = clock(), scheduler = new GapScheduler(time);
  assert.equal(await scheduler.wait(2, () => scheduler.cancel()), false);
  let replacement;
  const old = scheduler.wait(2, remaining => { if (remaining < 2) replacement = scheduler.wait(1); });
  time.advance(500); assert.equal(await old, false); assert.equal(time.count, 1);
  time.advance(1000); assert.equal(await replacement, true); assert.equal(scheduler.pending, false);
});
