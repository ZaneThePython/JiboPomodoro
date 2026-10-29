'use strict';

const path = require('path');

// Native Jibo face: black background, Proxima Nova labels and stock ActionButtons
// (same component/colors as the Radio player). The ring is drawn with PIXI.
// The time editor borrows the Clock skill's timer-edit screen: its chevron,
// chevron hit areas and rotation, and Set/Cancel buttons at the same positions.
const CX = 640, CY = 330, R = 235, RING = 24;
const GRAY = [0x58586D, 0x282735], CYAN = [0x25F2FB, 0x107799];
const PHASES = {
    focus: { title: 'Focus', color: 0x25F2FB },
    short: { title: 'Short break', color: 0x5CE07A },
    long: { title: 'Long break', color: 0xB58CFF }
};
const ICON = name => 'core://resources/actionIcons/' + name + '.png';
const CHEVRON = path.join(__dirname, 'resources/chevron.png');
// [id, icon, colors, x, y, caption]
const BUTTONS = [
    ['start', 'play', CYAN, 170, 232, 'Start'], ['pause', 'pause', CYAN, 170, 232, 'Pause'],
    ['restart', 'restart', GRAY, 978, 150, 'Restart'], ['stop', 'stop', GRAY, 978, 360, 'Stop']
];
// Editor columns: [phase, caption, centre x, min, max] in minutes
const COLUMNS = [['focus', 'Focus', 200, 1, 90], ['short', 'Short break', 500, 1, 30], ['long', 'Long break', 800, 1, 60]];
const MAIN = ['phase', 'time', 'next', 'round', 'timeTap', 'restart', 'restartCaption', 'stop', 'stopCaption'];
const EDIT = ['editTitle', 'set', 'setCaption', 'cancel', 'cancelCaption'].concat(...COLUMNS.map(c =>
    [c[0] + 'Label', c[0] + 'Value', c[0] + 'Unit', c[0] + 'Up', c[0] + 'Down']));

class UI {
    constructor(actions) { this.actions = actions; this.editing = null; }
    config(views) {
        const components = [];
        const callback = fn => ({ type: views.ActionData.CALLBACK, data: { callback: fn } });
        const label = (id, y, size, font, x, color, bold) => components.push({ type: 'Label', id: id, text: '',
            position: { x: x === undefined ? 'CENTER' : x, y: y }, targetAnchor: { x: 0.5, y: 0.5 },
            style: { fontFamily: font, fontSize: size, fill: color || '#FFFFFF', fontWeight: bold ? 'bold' : 'normal' } });
        const actionButton = (id, icon, colors, x, y, fn) => components.push({ type: 'ActionButton', id: id, iconSrc: icon,
            colors: colors, position: { x: x, y: y }, transform: { scaleX: 0.5, scaleY: 0.5 }, action: callback(fn) });

        label('phase', CY - 110, 45, 'Proxima Nova Soft');
        label('time', CY + 5, 150, 'Proxima Nova Light');
        label('next', CY + 115, 32, 'Proxima Nova Soft', undefined, '#9A9AB0');
        label('round', 660, 36, 'Proxima Nova Soft');
        // Tapping the time (inside the ring) opens the editor.
        components.push({ type: 'Button', id: 'timeTap', assets: [], position: { x: CX - 190, y: CY - 150 },
            hitArea: { x: 0, y: 0, width: 380, height: 300 }, action: callback(() => this.actions.edit()) });
        BUTTONS.forEach(b => {
            actionButton(b[0], ICON(b[1]), b[2], b[3], b[4], () => this.actions[b[0]]());
            label(b[0] + 'Caption', b[4] + 170, 32, 'Proxima Nova Light', b[3] + 66);
        });

        label('editTitle', 70, 80, 'Proxima Nova Soft', 500, undefined, true);
        COLUMNS.forEach(c => {
            label(c[0] + 'Label', 190, 40, 'Proxima Nova Soft', c[2]);
            components.push({ type: 'Button', id: c[0] + 'Up', assets: [{ id: 'chevron_up', src: CHEVRON, type: 'texture' }],
                position: { x: c[2] - 24, y: 262 }, action: callback(() => this.step(c, 1)) });
            label(c[0] + 'Value', 395, 130, 'Proxima Nova Light', c[2]);
            label(c[0] + 'Unit', 480, 36, 'Proxima Nova Light', c[2], '#9A9AB0');
            components.push({ type: 'Button', id: c[0] + 'Down', assets: [{ id: 'chevron_down', src: CHEVRON, type: 'texture' }],
                position: { x: c[2] + 24, y: 576 }, action: callback(() => this.step(c, -1)) });
        });
        actionButton('set', 'jibo://resources/actionIcons/ok.png', 'confirm', 1068, 212, () => this.actions.save(this.editing));
        label('setCaption', 384, 45, 'Proxima Nova Light', 1132);
        actionButton('cancel', 'jibo://resources/actionIcons/cancel.png', [0x545469, 0x2A2938], 1068, 468, () => this.actions.cancel());
        label('cancelCaption', 630, 45, 'Proxima Nova Light', 1132);
        return { viewConfig: { type: 'View', id: 'pomodoro', category: 'gui', ignoreSwipeDown: true, transitionStageOnly: true },
            componentConfigs: components };
    }
    decorate(view, PIXI) {
        this.view = view; this.PIXI = PIXI;
        const background = new PIXI.Graphics(); background.beginFill(0x000000); background.drawRect(0, 0, 1280, 720); background.endFill();
        view.stage.addChildAt(background, 0);
        this.ring = new PIXI.Graphics(); view.stage.addChildAt(this.ring, 1);
        this.dots = new PIXI.Graphics(); view.stage.addChildAt(this.dots, 2);
        // Same chevron hit areas and down-arrow rotation as Clock's TimerEditGUIView.
        COLUMNS.forEach(c => {
            view.getComponentById(c[0] + 'Up').setupHitArea(new PIXI.Rectangle(-50, -37, 150, 150));
            const down = view.getComponentById(c[0] + 'Down');
            down.setupHitArea(new PIXI.Rectangle(-50, -37, 150, 150)); down.display.rotation = Math.PI;
        });
    }
    text(id, value) { const c = this.view.getComponentById(id); if (c && c.text !== value) c.text = value; }
    show(id, visible) {
        const c = this.view.getComponentById(id);
        c.display.visible = visible; if (c.lockInput) c.lockInput(!visible);
    }
    // Enter the editor with minutes {focus, short, long}, or leave it with null.
    edit(minutes) { this.editing = minutes ? Object.assign({}, minutes) : null; }
    step(column, delta) {
        const key = column[0];
        this.editing[key] = Math.max(column[3], Math.min(column[4], this.editing[key] + delta));
        this.text(key + 'Value', String(this.editing[key]));
    }
    render(timer, now) {
        if (!this.view || !this.ring) return;
        const editing = !!this.editing;
        MAIN.forEach(id => this.show(id, !editing)); EDIT.forEach(id => this.show(id, editing));
        this.ring.visible = this.dots.visible = !editing;
        if (editing) {
            ['start', 'startCaption', 'pause', 'pauseCaption'].forEach(id => this.show(id, false));
            this.text('editTitle', 'Set your times');
            COLUMNS.forEach(c => {
                this.text(c[0] + 'Label', c[1]); this.text(c[0] + 'Value', String(this.editing[c[0]])); this.text(c[0] + 'Unit', 'minutes');
            });
            this.text('setCaption', 'Set'); this.text('cancelCaption', 'Cancel');
            return;
        }
        const phase = PHASES[timer.phase], left = timer.left(now), progress = timer.progress(now);
        const ready = !timer.running && progress === 0;
        this.text('phase', phase.title);
        this.text('time', clock(left));
        this.text('next', ready ? 'Tap the time to change it' : nextLabel(timer));
        this.text('round', 'Round ' + timer.round + ' of ' + timer.options.rounds);
        BUTTONS.forEach(b => this.text(b[0] + 'Caption', b[5]));
        this.show('start', !timer.running); this.show('startCaption', !timer.running);
        this.show('pause', timer.running); this.show('pauseCaption', timer.running);
        this.view.getComponentById('time').display.alpha = timer.running ? 1 : 0.55;

        const g = this.ring; g.clear();
        g.lineStyle(RING, 0x21202B); g.drawCircle(CX, CY, R);
        g.lineStyle(RING, phase.color);
        if (progress > 0) {
            // Remaining time shrinks clockwise from 12 o'clock.
            const a = -Math.PI / 2 + 2 * Math.PI * progress;
            g.moveTo(CX + R * Math.cos(a), CY + R * Math.sin(a)); g.arc(CX, CY, R, a, Math.PI * 1.5);
        } else g.drawCircle(CX, CY, R);
        // One dot per focus round; filled once that round's focus is done.
        const d = this.dots, n = timer.options.rounds, gap = 34, x0 = CX - (n - 1) * gap / 2; d.clear();
        for (let i = 1; i <= n; i++) {
            const done = i < timer.round || (i === timer.round && timer.phase !== 'focus');
            d.lineStyle(3, 0x58586D); d.beginFill(done ? 0x25F2FB : i === timer.round ? 0x37364A : 0x000000);
            d.drawCircle(x0 + (i - 1) * gap, 610, 10); d.endFill();
        }
    }
}

function nextLabel(timer) {
    if (timer.phase !== 'focus') return 'Then: focus round ' + (timer.phase === 'long' ? 1 : timer.round + 1);
    return timer.round >= timer.options.rounds ? 'Then: long break' : 'Then: short break';
}
function clock(ms) { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }

UI.clock = clock; UI.COLUMNS = COLUMNS;
module.exports = UI;
