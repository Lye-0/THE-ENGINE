/* One crank angle drives the complete four-stroke mechanism.
 * Coordinates: X = crank axis, Y = up, Z = exhaust side. 1.2 units = 86 mm.
 * Timing is a fixed illustrative calibration, not an OEM ECU map.
 */
(function (root) {
    'use strict';
    const TAU = Math.PI * 2, CYCLE = TAU * 2, DEG = Math.PI / 180;
    const CRANK_RADIUS = .60, ROD_LENGTH = 1.92, MM_PER_UNIT = 86 / 1.2;
    const FIRING_OFFSETS = Object.freeze([0, 3 * Math.PI, Math.PI, 2 * Math.PI]);
    const HEAD = Object.freeze({ tilt: 14 * DEG, seatY: 2.98, seatZ: .30, valveX: .23,
        followerTop: .80, camBase: .28, springBase: .15, springHeight: .43,
        bore: .60, pistonCrown: .331, sparkY: 3.006, sparkGap: .9 / MM_PER_UNIT });
    const CAM_DISTANCE = HEAD.followerTop + HEAD.camBase;
    const CAM_Y = HEAD.seatY + CAM_DISTANCE * Math.cos(HEAD.tilt);
    const CAM_Z = HEAD.seatZ + CAM_DISTANCE * Math.sin(HEAD.tilt);
    const ROOF_Y = HEAD.seatY + HEAD.seatZ * Math.tan(HEAD.tilt);
    const SPRING = Object.freeze({ radius: .125, wireRadius: .02, turns: 6, movingMass: .045, preload: 180,
        // k = G d^4 / (8 D^3 N), spring steel G = 79 GPa, k in N/mm.
        rate: 79000 * (.04 * MM_PER_UNIT) ** 4 / (8 * (.25 * MM_PER_UNIT) ** 3 * 6) });
    const VALVE_EVENTS = Object.freeze({
        intake: Object.freeze({ open: 332 * DEG, duration: 288 * DEG, lift: .115 }),
        exhaust: Object.freeze({ open: 108 * DEG, duration: 288 * DEG, lift: .105 })
    });
    const STAGES = Object.freeze([
        { name: 'POWER', ja: '膨張', color: '#e8a475', rgb: [1, .32, .09] },
        { name: 'EXHAUST', ja: '排気', color: '#a4b3b9', rgb: [.53, .61, .63] },
        { name: 'INTAKE', ja: '吸気', color: '#82c0d1', rgb: [.16, .56, .75] },
        { name: 'COMPRESSION', ja: '圧縮', color: '#d4c088', rgb: [.9, .65, .28] }
    ]);
    function wrap(a, period = CYCLE) { return ((a % period) + period) % period; }
    function pistonAt(angle, r = CRANK_RADIUS, l = ROD_LENGTH) {
        if (!(l > r && r > 0)) throw new RangeError('Connecting rod must be longer than the positive crank radius.');
        const z = r * Math.sin(angle), y = r * Math.cos(angle), pinY = y + Math.sqrt(l * l - z * z);
        return { y: pinY, crankY: y, crankZ: z, rodAngle: Math.atan2(-z, pinY - y) };
    }
    // Smooth clearance ramps: lift, velocity and acceleration all reach zero
    // at the seat. The central cosine gives a round, convex cam nose.
    function shoulder(t) {
        const w = .08;
        if (t >= w && t <= 1 - w) return [t, 1, 0];
        const end = t > .5, q = (end ? 1 - t : t) / w;
        const f = w * (6 * q ** 3 - 8 * q ** 4 + 3 * q ** 5);
        const d = 18 * q ** 2 - 32 * q ** 3 + 15 * q ** 4;
        const dd = (36 * q - 96 * q ** 2 + 60 * q ** 3) / w;
        return [end ? 1 - f : f, d, end ? -dd : dd];
    }
    function valveMotion(phase, type) {
        const e = VALVE_EVENTS[type];
        if (!e) throw new RangeError('Valve type must be intake or exhaust.');
        const t = wrap(phase - e.open) / e.duration;
        if (t <= 0 || t >= 1) return { lift: 0, velocity: 0, acceleration: 0 };
        const [f, d, dd] = shoulder(t), a = TAU * f;
        return { lift: e.lift * Math.sin(Math.PI * f) ** 2,
            velocity: e.lift * Math.PI * Math.sin(a) * d / e.duration,
            acceleration: e.lift * (2 * Math.PI ** 2 * Math.cos(a) * d * d + Math.PI * Math.sin(a) * dd) / e.duration ** 2 };
    }
    function valveLift(phase, type) { return valveMotion(phase, type).lift; }
    function cylinderAt(angle, index) {
        if (!Number.isInteger(index) || index < 0 || index > 3) throw new RangeError('Cylinder index must be 0–3.');
        const phase = wrap(angle - FIRING_OFFSETS[index]), piston = pistonAt(phase), stageIndex = Math.min(3, Math.floor(phase / Math.PI));
        return { ...piston, phase, stageIndex, stage: STAGES[stageIndex], progress: phase / Math.PI - stageIndex,
            intake: valveLift(phase, 'intake'), exhaust: valveLift(phase, 'exhaust') };
    }
    function ignitionAt(phase, rpm = 1200) {
        const speed = Math.max(800, Math.min(6000, rpm)), omega = speed / 60 * TAU;
        const advance = (10 + 22 * Math.min(1, (speed - 800) / 3200)) * DEG;
        const age = wrap(phase + advance), seconds = age / omega, duration = .0012;
        const active = seconds < duration;
        const intensity = active ? (.45 + .55 * Math.exp(-seconds / .00022)) * (1 - (seconds / duration) ** 4) : 0;
        const burnDuration = (advance / DEG + 48) * DEG;
        const burn = Math.max(0, Math.min(1, (age - omega * .00015) / burnDuration));
        return { active, intensity, age, seconds, advance, duration, burn,
            burning: seconds >= .00015 && age < burnDuration, start: CYCLE - advance };
    }
    function injectionAt(phase, rpm = 1200) {
        const omega = Math.max(800, Math.min(6000, rpm)) / 60 * TAU;
        const age = wrap(phase - 380 * DEG) / omega, duration = .003, flight = .0024;
        return { active: age < duration, visible: age < duration + flight, age, duration, flight,
            front: Math.min(1, age / flight), tail: Math.max(0, (age - duration) / flight) };
    }
    function advance(angle, dt, rpm, scale) {
        if (![angle, dt, rpm, scale].every(Number.isFinite)) throw new TypeError('Finite motion inputs required.');
        return wrap(angle + Math.max(0, dt) * Math.max(0, rpm) / 60 * TAU * Math.max(0, scale));
    }
    const K = Object.freeze({ TAU, CYCLE, DEG, CRANK_RADIUS, ROD_LENGTH, MM_PER_UNIT, HEAD, CAM_Y, CAM_Z, ROOF_Y, SPRING,
        VALVE_EVENTS, FIRING_OFFSETS, STAGES, wrap, pistonAt, valveMotion, valveLift, cylinderAt, ignitionAt, injectionAt,
        advance, camAngle: angle => angle / 2, chamberRoof: z => ROOF_Y - Math.abs(z) * Math.tan(HEAD.tilt) });
    (root.FERRO = root.FERRO || {}).K = K;
    if (typeof module !== 'undefined' && module.exports) module.exports = K;
})(globalThis);
