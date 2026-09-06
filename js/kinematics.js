/* One source of truth for the crank, all four pistons and all sixteen valves.
 * Cycle origin: cylinder 1 firing TDC. A four-stroke cycle is 720 crank degrees.
 * The valve windows are deliberately idealised (no overlap / lead / lag).
 */
(function (root) {
    'use strict';
    const TAU = Math.PI * 2, CYCLE = TAU * 2, CRANK_RADIUS = .60, ROD_LENGTH = 1.92;
    const FIRING_OFFSETS = Object.freeze([0, 3 * Math.PI, Math.PI, 2 * Math.PI]);
    const STAGES = Object.freeze([
        { name: 'POWER', ja: '膨張', color: '#e8a475', rgb: [1, .32, .09] },
        { name: 'EXHAUST', ja: '排気', color: '#a4b3b9', rgb: [.53, .61, .63] },
        { name: 'INTAKE', ja: '吸気', color: '#82c0d1', rgb: [.16, .56, .75] },
        { name: 'COMPRESSION', ja: '圧縮', color: '#d4c088', rgb: [.9, .65, .28] }
    ]);
    function wrap(a, period = CYCLE) { return ((a % period) + period) % period; }
    function pistonAt(angle, r = CRANK_RADIUS, l = ROD_LENGTH) { if (!(l > r && r > 0))
        throw new RangeError('Connecting rod must be longer than the positive crank radius.'); const z = r * Math.sin(angle), y = r * Math.cos(angle), pinY = y + Math.sqrt(l * l - z * z); return { y: pinY, crankY: y, crankZ: z, rodAngle: Math.atan2(-z, pinY - y) }; }
    function valveLift(phase, type) { const p = wrap(phase), start = type === 'intake' ? 2 * Math.PI : Math.PI, t = (p - start) / Math.PI; return t <= 0 || t >= 1 ? 0 : .16 * Math.sin(t * Math.PI) ** 2; }
    function cylinderAt(angle, index) { if (!Number.isInteger(index) || index < 0 || index > 3)
        throw new RangeError('Cylinder index must be 0–3.'); const phase = wrap(angle - FIRING_OFFSETS[index]), piston = pistonAt(phase), stageIndex = Math.min(3, Math.floor(phase / Math.PI)); return { ...piston, phase, stageIndex, stage: STAGES[stageIndex], progress: phase / Math.PI - stageIndex, intake: valveLift(phase, 'intake'), exhaust: valveLift(phase, 'exhaust') }; }
    function advance(angle, dt, rpm, scale) { if (![angle, dt, rpm, scale].every(Number.isFinite))
        throw new TypeError('Finite motion inputs required.'); return wrap(angle + Math.max(0, dt) * Math.max(0, rpm) / 60 * TAU * Math.max(0, scale)); }
    const K = Object.freeze({ TAU, CYCLE, CRANK_RADIUS, ROD_LENGTH, FIRING_OFFSETS, STAGES, wrap, pistonAt, valveLift, cylinderAt, advance, camAngle: angle => angle / 2 });
    (root.FERRO = root.FERRO || {}).K = K;
    if (typeof module !== 'undefined' && module.exports)
        module.exports = K;
})(globalThis);
