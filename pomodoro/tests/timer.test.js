'use strict';
// node tests/timer.test.js  (Node 6 compatible)
const assert = require('assert');
const Timer = require('../timer');
const M = Timer.MINUTE;

let t = new Timer();
assert.strictEqual(t.left(0), 25 * M);
t.start(0);
assert.strictEqual(t.left(10 * M), 15 * M);
t.pause(10 * M);
assert.strictEqual(t.left(99 * M), 15 * M, 'paused time does not move');
t.start(100 * M);
assert.strictEqual(t.tick(114 * M), null);
assert.strictEqual(t.tick(115 * M), 'focus');
assert.deepStrictEqual([t.phase, t.round, t.left(115 * M)], ['short', 1, 5 * M]);

// Full cycle: 4 focus rounds, short breaks between, long break after round 4, then round 1 again.
t = new Timer({ focus: 10, short: 2, long: 5 });
t.start(0);
const seen = [];
for (let now = 0; seen.length < 9; now++) { const done = t.tick(now); if (done) seen.push(done + t.round); }
assert.deepStrictEqual(seen, ['focus1', 'short2', 'focus2', 'short3', 'focus3', 'short4', 'focus4', 'long1', 'focus1']);

// Restart keeps the running state and phase.
t = new Timer(); t.start(0); t.restart(7 * M);
assert.strictEqual(t.left(7 * M), 25 * M); assert.ok(t.running);
t.pause(8 * M); t.restart(9 * M); assert.ok(!t.running); assert.strictEqual(t.left(50 * M), 25 * M);

// A late tick (robot busy) carries the overflow into the next phase instead of losing it.
t = new Timer(); t.start(0);
assert.strictEqual(t.tick(26 * M), 'focus');
assert.strictEqual(t.left(26 * M), 4 * M);

// setDurations: an unstarted phase takes the new length; a running one keeps its countdown.
t = new Timer(); t.setDurations({ focus: 50 * M, short: 10 * M });
assert.strictEqual(t.left(0), 50 * M);
t.start(0); t.setDurations({ focus: 30 * M });
assert.strictEqual(t.left(0), 50 * M, 'running round is not cut short');
assert.strictEqual(t.tick(50 * M), 'focus'); assert.strictEqual(t.left(50 * M), 10 * M);
t.setDurations({ focus: 0, short: -1 });
assert.strictEqual(t.options.focus, 30 * M, 'invalid lengths are ignored');

console.log('timer tests passed');
