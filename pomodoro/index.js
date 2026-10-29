'use strict';

const jibo = require('jibo'), BeSkill = require('@be/be-framework').BeSkill;
const lifecycle = require('./touch-lifecycle'), Timer = require('./timer'), UI = require('./ui');

const M = Timer.MINUTE, STORE_KEY = 'be.pomodoro.minutes';
const minutes = n => n + (n === 1 ? ' minute' : ' minutes');

// Saved lengths survive relaunches; anything missing or out of range falls back to the default.
function loadMinutes() {
    let saved = {};
    try { saved = JSON.parse(global.localStorage.getItem(STORE_KEY)) || {}; } catch (_) {}
    const result = {}, defaults = new Timer().options;
    UI.COLUMNS.forEach(c => {
        const value = saved[c[0]];
        result[c[0]] = Number.isInteger(value) && value >= c[3] && value <= c[4] ? value : defaults[c[0]] / M;
    });
    return result;
}
function saveMinutes(value) { try { global.localStorage.setItem(STORE_KEY, JSON.stringify(value)); } catch (_) {} }
const toDurations = value => ({ focus: value.focus * M, short: value.short * M, long: value.long * M });

class PomodoroSkill extends BeSkill {
    constructor() { super(...arguments); this.generation = 0; this.view = null; this.closing = null; }
    open() {
        if (this.view) { this.close(error => { if (!error) this.open(); }); return; }
        const generation = ++this.generation, views = jibo.face.views;
        this.closing = null; this.leaving = false; this.started = false;
        this.minutes = loadMinutes(); this.timer = new Timer(toDurations(this.minutes));
        this.ui = new UI({
            start: () => {
                if (!this.started) this.say("Let's focus for " + minutes(this.minutes.focus) + '.');
                this.started = true; this.timer.start(Date.now()); this.render();
            },
            pause: () => { this.timer.pause(Date.now()); this.render(); },
            restart: () => { this.timer.restart(Date.now()); this.render(); },
            stop: () => this.leave(),
            edit: () => { this.ui.edit(this.minutes); this.render(); },
            save: value => {
                this.minutes = Object.assign({}, value); saveMinutes(this.minutes);
                this.timer.setDurations(toDurations(this.minutes)); this.ui.edit(null); this.render();
            },
            cancel: () => { this.ui.edit(null); this.render(); }
        });
        const view = this.view = lifecycle.prepareView(views.createView('View', this.ui.config(views)));
        view.addAction(views.ActionData.CALLBACK, { callback: () => this.leave() }, true, false, views.GESTURE.SWIPE_DOWN);
        const current = () => generation === this.generation && !this.leaving && !!this.view;
        views.changeView({ addView: view, transitionOpen: views.TRANSITION.IN, transitionClose: views.TRANSITION.OUT },
            () => { if (current()) this.interval = setInterval(() => this.tick(), 250); },
            () => { if (current()) this.leave(); },
            () => { if (current()) { this.ui.decorate(view, global.PIXI); this.render(); } });
    }
    tick() {
        const finished = this.timer.tick(Date.now());
        if (finished === 'focus') {
            this.say(this.timer.phase === 'long'
                ? "Great job, that's four rounds! Take a " + minutes(this.minutes.long) + ' break.'
                : 'Nice work! Take a ' + minutes(this.minutes.short) + ' break.');
        } else if (finished) this.say("Break's over. Let's focus.");
        // The editor is static; only redraw it when a button changes it.
        if (!this.ui || !this.ui.editing) this.render();
    }
    render() { if (this.ui) this.ui.render(this.timer, Date.now()); }
    say(text) {
        try { this.speaking = true; Promise.resolve(jibo.tts.speak(text)).catch(() => {}).then(() => { this.speaking = false; }); }
        catch (_) { this.speaking = false; }
    }
    leave() { if (this.leaving) return; this.leaving = true; this.exit({ noElementsOfSurprise: true }); }
    close(done) {
        done = done || (() => {});
        if (this.closing) {
            if (this.closing.finished) done(this.closing.error); else this.closing.callbacks.push(done);
            return;
        }
        const closing = this.closing = { finished: false, error: null, callbacks: [done] };
        ++this.generation; this.leaving = true; clearInterval(this.interval); this.interval = null;
        if (this.speaking) { try { Promise.resolve(jibo.tts.stop()).catch(() => {}); } catch (_) {} this.speaking = false; }
        lifecycle.closeView(jibo.face.views, jibo.face.tween, this.view, require('timers'), 'pomodoro', error => {
            closing.finished = true; closing.error = error || null;
            if (!error) { this.view = null; this.ui = null; }
            closing.callbacks.splice(0).forEach(callback => callback(closing.error));
        });
    }
    destroy(done) { this.close(error => super.destroy(baseError => done(error || baseError))); }
}

PomodoroSkill.loadMinutes = loadMinutes;
module.exports = PomodoroSkill;
