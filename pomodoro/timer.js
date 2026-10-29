'use strict';

// Pure Pomodoro state machine. Times come from the caller so pauses, sleeps and
// late ticks never drift: remaining time is always endsAt - now.
const MINUTE = 60000;
const DEFAULTS = { focus: 25 * MINUTE, short: 5 * MINUTE, long: 15 * MINUTE, rounds: 4 };

class Timer {
    constructor(options) {
        this.options = Object.assign({}, DEFAULTS, options);
        this.phase = 'focus'; this.round = 1;
        this.remaining = this.duration(); this.endsAt = null;
    }
    duration(phase) { return this.options[phase || this.phase]; }
    get running() { return this.endsAt !== null; }
    left(now) { return this.running ? Math.max(0, this.endsAt - now) : this.remaining; }
    progress(now) { return 1 - this.left(now) / this.duration(); }
    start(now) { if (!this.running) this.endsAt = now + this.remaining; }
    pause(now) { if (this.running) { this.remaining = this.left(now); this.endsAt = null; } }
    restart(now) { const was = this.running; this.endsAt = null; this.remaining = this.duration(); if (was) this.start(now); }
    // New lengths apply to the next phase; an unstarted phase picks up its new length now.
    setDurations(durations) {
        const fresh = !this.running && this.remaining === this.duration();
        ['focus', 'short', 'long'].forEach(key => { if (durations[key] > 0) this.options[key] = durations[key]; });
        if (fresh) this.remaining = this.duration();
    }
    // Returns the finished phase name when the current phase ends, else null.
    // The next phase starts automatically from the moment the last one ended.
    tick(now) {
        if (!this.running || now < this.endsAt) return null;
        const finished = this.phase, endedAt = this.endsAt;
        if (finished === 'focus') this.phase = this.round >= this.options.rounds ? 'long' : 'short';
        else { this.phase = 'focus'; this.round = finished === 'long' ? 1 : this.round + 1; }
        this.remaining = this.duration(); this.endsAt = endedAt + this.remaining;
        if (this.endsAt <= now) this.endsAt = now + this.remaining; // asleep through a whole phase: restart it fresh
        return finished;
    }
}

Timer.MINUTE = MINUTE;
module.exports = Timer;
