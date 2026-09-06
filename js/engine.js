/* FERRO I/4 — original procedural exhibit, modelled in approximate display units.
 * The independent parts share geometry buffers. The animation is derived only
 * from K.cylinderAt(), never from unrelated sine-wave animation clocks.
 */
(function (F) {
    'use strict';
    const { G, Node, V, K } = F, PI = Math.PI, TAU = PI * 2;
    class Engine {
        constructor(renderer) {
            this.renderer = renderer;
            this.root = new Node();
            this.mode = 'cutaway';
            this.explosion = 0;
            this.angle = 75 * PI / 180;
            this.pistons = [];
            this.rods = [];
            this.valves = [];
            this.cams = [];
            this.gases = [];
            this.sparks = [];
            this.links = [];
            this.cache = new Map();
            this.partCount = 0;
            const mat = F.material;
            this.m = { piston: mat('#a7b3bb', .94, .29, 1), steel: mat('#a2acb3', 1, .245, 1), polish: mat('#c1c6cb', 1, .15, 1), alloy: mat('#9aa6ae', .92, .31, 2), forged: mat('#637079', 1, .28, 2), bore: mat('#52616b', 1, .245, 1), dark: mat('#24323b', .86, .35, 2), graphite: mat('#202e37', .83, .3, 3), black: mat('#111a20', .65, .36), recess: mat('#11191c', .85, .42), rubber: mat('#10191c', .05, .71), brass: mat('#bfa269', .95, .26, 1), copper: mat('#b78965', .92, .27, 1), header: mat('#8e8980', 1, .3, 1), plinth: mat('#1c2b33', .65, .46, 3), glass: mat('#526c75', .75, .2, 0, { alpha: .13 }), guide: mat('#e5bb91', .5, .3, 0, { alpha: .15, emission: .3 }) };
            this.makePlinth();
            this.makeCrank();
            this.makePistons();
            this.makeValvetrain();
            this.makeTiming();
            this.makeHousing();
            this.makeExterior();
            this.makeGuides();
            this.update(this.angle, 0, true);
        }
        cached(key, fn) { if (!this.cache.has(key))
            this.cache.set(key, fn()); return this.cache.get(key); }
        box(w, h, d, b = .035) { return this.cached('b' + [w, h, d, b], () => G.box(w, h, d, b, 2)); }
        cyl(r, h, n = 48, b = .012) { return this.cached('c' + [r, h, n, b], () => G.cylinder(r, h, n, b)); }
        ring(ro, ri, h, n = 48, start = 0, arc = TAU) { return this.cached('r' + [ro, ri, h, n, start, arc], () => G.ring(ro, ri, h, n, start, arc)); }
        torus(r, t, n = 48) { return this.cached('t' + [r, t, n], () => G.torus(r, t, n, 7)); }
        mesh(parent, g, m, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) { this.partCount++; return parent.add(new Node(g, m, p, r, s)); }
        bolt(parent, p, r = [0, 0, 0], scale = 1, material = this.m.polish) { const group = parent.group(p, r); group.s = [scale, scale, scale]; this.mesh(group, this.cyl(.068, .021, 24, .003), this.m.forged, [0, .01, 0]); this.mesh(group, this.cyl(.051, .056, 6, .005), material, [0, .045, 0]); this.mesh(group, this.cyl(.023, .002, 6, .001), this.m.recess, [0, .074, 0]); return group; }
        pipe(parent, points, radius = .12, material = this.m.header) { return this.mesh(parent, G.tube(G.curve(points, 36), radius, 14), material); }
        label(parent, text, w, h, p, r, small = '') { const c = document.createElement('canvas'); c.width = 1024; c.height = 192; const ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height); ctx.fillStyle = '#b6c6cc'; ctx.font = '500 94px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 512, 78); if (small) {
            ctx.font = '25px monospace';
            ctx.fillStyle = '#829da6';
            ctx.fillText(small, 512, 155);
        } const tex = this.renderer.makeTexture(c), m = F.material('#d3dbe0', .8, .31, 0, { texture: tex }); const g = G.geo([-w / 2, -h / 2, 0, w / 2, -h / 2, 0, w / 2, h / 2, 0, -w / 2, h / 2, 0], [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], [0, 0, 1, 0, 1, 1, 0, 1], [0, 1, 2, 0, 2, 3]); return this.mesh(parent, g, m, p, r); }
        makePlinth() {
            const m = this.m, root = this.root;
            this.mesh(root, this.box(7.3, .15, 3.3, .07), m.plinth, [0, -1.49, 0]);
            this.mesh(root, this.box(7.25, .022, 3.25, .012), m.forged, [0, -1.405, 0]);
            this.mesh(root, this.box(7.13, .025, 3.11, .01), m.plinth, [0, -1.387, 0]);
            for (const x of [-2.63, 2.63])
                for (const z of [-1.10, 1.1]) {
                    this.mesh(root, this.cyl(.20, .10, 32), m.rubber, [x, -1.61, z]);
                    this.mesh(root, this.box(.29, .53, .36), m.dark, [x, -1.11, z]);
                    this.bolt(root, [x, -.83, z], [], .82);
                    this.mesh(root, this.box(.34, .08, .77), m.forged, [x, -.91, z * .69]);
                }
            this.label(root, 'F E R R O', 1.13, .19, [-2.45, -1.368, 1.09], [-PI / 2, 0, 0], 'ENGINE OBSERVATORY / 001');
            const shadow = F.material('#0c1519', 0, .98, 5, { alpha: .40 });
            this.mesh(root, this.cyl(1, .002, 72, 0), shadow, [0, -1.665, 0], [0, 0, 0], [4.1, 1, 2.3]).castShadow = false;
            this.bedplate = root.group();
            for (const z of [-.77, .77])
                this.mesh(this.bedplate, this.box(5.88, .14, .17), m.alloy, [0, -.68, z]);
            for (const x of [-2.9, -1.45, 0, 1.45, 2.9]) {
                this.mesh(this.bedplate, this.box(.27, .23, 1.48), m.alloy, [x, -.54, 0]);
                this.mesh(this.bedplate, this.ring(.315, .186, .255, 40, -PI / 2, PI), m.forged, [x, 0, 0], [0, 0, -PI / 2]);
                this.mesh(this.bedplate, this.box(.27, .30, .79, .025), m.alloy, [x, -.34, 0]);
                for (const z of [-.54, .54])
                    this.bolt(this.bedplate, [x, -.31, z], [0, 0, 0], 1.1);
            }
        }
        makeCrank() {
            const m = this.m;
            this.crank = this.root.group();
            const g = this.crank;
            for (const x of [-2.9, -1.45, 0, 1.45, 2.9]) {
                this.mesh(g, this.cyl(.182, .47, 64), m.polish, [x, 0, 0], [0, 0, -PI / 2]);
                this.mesh(g, this.ring(.198, .181, .025), m.brass, [x - .19, 0, 0], [0, 0, -PI / 2]);
                this.mesh(g, this.ring(.198, .181, .025), m.brass, [x + .19, 0, 0], [0, 0, -PI / 2]);
            }
            this.xs = [-2.175, -.725, .725, 2.175];
            const webPoly = [[-.21, .74], [-.10, .87], [.10, .87], [.23, .72], [.24, .33], [.39, -.03], [.58, -.27], [.57, -.48], [.32, -.71], [0, -.76], [-.32, -.71], [-.57, -.48], [-.58, -.27], [-.39, -.03], [-.24, .33]];
            const webGeo = G.extrude(webPoly, .19, .045);
            this.xs.forEach((x, i) => {
                const phase = -K.FIRING_OFFSETS[i], throwGroup = g.group([x, 0, 0], [phase, 0, 0]);
                for (const side of [-1, 1]) {
                    this.mesh(throwGroup, webGeo, m.forged, [side * .345, 0, 0], [0, -PI / 2, 0]);
                    this.mesh(throwGroup, this.cyl(.265, .019, 48), m.steel, [side * .446, .6, 0], [0, 0, -PI / 2]);
                    this.mesh(throwGroup, this.cyl(.098, .003, 24), m.recess, [side * .46, .60, 0], [0, 0, -PI / 2]);
                    this.mesh(throwGroup, this.cyl(.16, .012, 40), m.polish, [side * .448, 0, 0], [0, 0, -PI / 2]);
                }
                this.mesh(throwGroup, this.cyl(.168, .53, 56), m.polish, [0, .6, 0], [0, 0, -PI / 2]);
                this.mesh(throwGroup, this.ring(.179, .166, .027), m.brass, [-.25, .6, 0], [0, 0, -PI / 2]);
                this.mesh(throwGroup, this.ring(.179, .166, .027), m.brass, [.25, .6, 0], [0, 0, -PI / 2]);
            });
            this.mesh(g, this.cyl(.15, .5, 48), m.polish, [-3.24, 0, 0], [0, 0, -PI / 2]);
            this.mesh(g, this.cyl(.26, .14, 64), m.dark, [-3.40, 0, 0], [0, 0, -PI / 2]);
            this.mesh(g, this.cyl(.245, .08, 64), m.forged, [-3.5, 0, 0], [0, 0, -PI / 2]);
            this.bolt(g, [-3.547, 0, 0], [0, 0, PI / 2], 1.7);
            const flywheel = g.group([3.27, 0, 0]);
            this.mesh(flywheel, this.cyl(.98, .14, 96, .025), m.forged, [0, 0, 0], [0, 0, -PI / 2]);
            this.mesh(flywheel, this.ring(1.03, .83, .047, 96), m.polish, [.094, 0, 0], [0, 0, -PI / 2]);
            this.mesh(flywheel, G.gear(1.052, 108, .074), m.steel, [0, 0, 0], [0, -PI / 2, 0]);
            this.mesh(flywheel, this.cyl(.31, .30, 56), m.polish, [.055, 0, 0], [0, 0, -PI / 2]);
            this.mesh(flywheel, this.ring(.69, .65, .012, 80), m.alloy, [.081, 0, 0], [0, 0, -PI / 2]);
            for (let i = 0; i < 8; i++) {
                const a = i / 8 * TAU;
                this.bolt(flywheel, [.095, .48 * Math.cos(a), .48 * Math.sin(a)], [0, 0, -PI / 2], .85);
                this.mesh(flywheel, this.cyl(.105, .004, 32), m.recess, [-.075, .77 * Math.cos(a), .77 * Math.sin(a)], [0, 0, -PI / 2]);
            }
        }
        makePistons() {
            const m = this.m;
            const pistonGeo = G.lathe([[.42, -.385], [.53, -.385], [.574, -.35], [.589, -.15], [.589, -.05], [.576, -.034], [.576, .012], [.594, .027], [.594, .093], [.576, .106], [.576, .15], [.598, .163], [.598, .203], [.577, .213], [.577, .257], [.596, .27], [.596, .302], [.568, .331], [0, .331]], 72);
            const rodGeo = G.extrude([[-.115, .16], [-.14, .35], [-.07, 1.53], [-.12, 1.74], [.12, 1.74], [.07, 1.53], [.14, .35], [.115, .16]], .18, .017);
            this.xs.forEach((x, i) => {
                const piston = this.root.group([x, 0, 0]);
                this.pistons.push(piston);
                this.mesh(piston, pistonGeo, m.piston);
                for (const yy of [.231, .129, -.011])
                    this.mesh(piston, this.ring(.600, .576, .026, 72), m.steel, [0, yy, 0]);
                this.mesh(piston, this.ring(.59, .58, .011, 72), m.recess, [0, .064, 0]);
                for (let a = 0; a < TAU; a += TAU / 24)
                    this.mesh(piston, this.cyl(.011, .002, 8, 0), m.recess, [Math.cos(a) * .595, .031, Math.sin(a) * .595], [PI / 2, 0, -a]);
                for (const xx of [-.21, .21])
                    for (const zz of [-.24, .24]) {
                        this.mesh(piston, this.cyl(.137, .0018, 36, 0), m.recess, [xx, .332, zz]);
                        this.mesh(piston, this.torus(.135, .0035, 36), m.steel, [xx, .334, zz]);
                    }
                this.mesh(piston, this.cyl(.105, 1.181, 48), m.polish, [0, 0, 0], [0, 0, -PI / 2]);
                for (const side of [-1, 1]) {
                    this.mesh(piston, this.ring(.117, .087, .013, 40), m.steel, [side * .589, 0, 0], [0, 0, -PI / 2]);
                    this.mesh(piston, this.cyl(.058, .003, 32, 0), m.recess, [side * .598, 0, 0], [0, 0, -PI / 2]);
                }
                const rod = this.root.group([x, 0, 0]);
                this.rods.push(rod);
                this.mesh(rod, rodGeo, m.steel, [0, 0, 0], [0, -PI / 2, 0]);
                this.mesh(rod, this.box(.015, 1.26, .105, .012), m.forged, [.095, .98, 0]);
                this.mesh(rod, this.box(.015, 1.26, .105, .012), m.forged, [-.095, .98, 0]);
                this.mesh(rod, this.ring(.284, .173, .244, 56), m.steel, [0, 0, 0], [0, 0, -PI / 2]);
                this.mesh(rod, this.ring(.181, .164, .25, 56), m.brass, [0, 0, 0], [0, 0, -PI / 2]);
                this.mesh(rod, this.ring(.18, .105, .244, 40), m.steel, [0, K.ROD_LENGTH, 0], [0, 0, -PI / 2]);
                this.mesh(rod, this.ring(.11, .094, .247, 40), m.brass, [0, K.ROD_LENGTH, 0], [0, 0, -PI / 2]);
                this.mesh(rod, this.box(.257, .012, .47, .004), m.recess, [0, -.108, 0]);
                for (const zz of [-.205, .205])
                    this.bolt(rod, [0, -.245, zz], [PI, 0, 0], .63);
                // Sectioned liners expose the piston travel; the missing half is intentional.
                this.mesh(this.root, this.ring(.665, .619, 1.89, 64, PI, PI), m.bore, [x, 1.997, 0]);
                this.mesh(this.root, this.ring(.685, .616, .043, 64, PI, PI), m.alloy, [x, 2.96, 0]);
                this.mesh(this.root, this.ring(.681, .663, .055, 64, PI, PI), m.brass, [x, 2.935, 0]);
                for (const side of [-1, 1])
                    this.mesh(this.root, this.box(.043, 1.87, .022, .002), m.copper, [x + side * .644, 1.998, -.002]);
                const gasMat = F.material(K.STAGES[0].rgb, 0, .6, 4, { alpha: .15, emission: .2 }), gas = this.mesh(this.root, this.cyl(.571, 1, 56, 0), gasMat, [x, 2, 0]);
                gas.castShadow = false;
                this.gases.push(gas);
            });
        }
        makeValvetrain() {
            const m = this.m;
            this.valveFrame = this.root.group();
            this.camFrame = this.root.group();
            for (const z of [-.47, .47]) {
                const cam = this.camFrame.group([0, 4.02, z]);
                this.cams.push(cam);
                this.mesh(cam, this.cyl(.116, 5.86, 56), m.polish, [0, 0, 0], [0, 0, -PI / 2]);
                for (const x of [-2.85, -1.45, 0, 1.45, 2.85]) {
                    this.mesh(cam, this.cyl(.143, .19, 48), m.polish, [x, 0, 0], [0, 0, -PI / 2]);
                    const frame = this.camFrame;
                    this.mesh(frame, this.box(.23, .14, .44, .025), m.alloy, [x, 4.19, z]);
                    for (const side of [-1, 1]) {
                        this.mesh(frame, this.box(.18, .39, .075, .012), m.alloy, [x, 3.96, z + side * .18]);
                        this.bolt(frame, [x, 4.268, z + side * .15], [0, 0, 0], .65);
                    }
                }
                this.xs.forEach((x, i) => { for (const dx of [-.2, .2])
                    this.mesh(cam, G.cam(K.FIRING_OFFSETS[i], z > 0 ? 'exhaust' : 'intake'), m.steel, [x + dx, 0, 0], [0, -PI / 2, 0]); });
            }
            const springGeo = G.helix(.093, .49, 7, .0145);
            this.xs.forEach((x, i) => {
                for (const z of [-.47, .47])
                    for (const dx of [-.20, .20]) {
                        const kind = z > 0 ? 'exhaust' : 'intake', vgroup = this.valveFrame.group([x + dx, 0, z]);
                        const moving = vgroup.group();
                        this.mesh(moving, G.lathe([[0, 2.944], [.18, 2.944], [.194, 2.954], [.176, 2.977], [.041, 3.021], [.033, 3.11]], 40), m.polish);
                        this.mesh(moving, this.cyl(.029, .68, 28, .003), m.brass, [0, 3.37, 0]);
                        this.mesh(moving, this.cyl(.122, .16, 40, .009), m.forged, [0, 3.77, 0]);
                        this.mesh(moving, this.cyl(.125, .017, 40, .003), m.polish, [0, 3.853, 0]);
                        this.mesh(moving, this.cyl(.134, .036, 40, .005), m.steel, [0, 3.634, 0]);
                        const spring = this.mesh(vgroup, springGeo, m.polish, [0, 3.13, 0]);
                        this.mesh(vgroup, this.ring(.139, .045, .031, 40), m.forged, [0, 3.116, 0]);
                        this.mesh(vgroup, this.ring(.211, .18, .019, 48), m.brass, [0, 2.982, 0]);
                        this.valves.push({ moving, spring, i, kind });
                    }
                const plug = this.valveFrame.group([x, 0, 0]);
                this.mesh(plug, this.cyl(.045, .15, 24, .001), m.brass, [0, 3.011, 0]);
                this.mesh(plug, this.cyl(.091, .09, 6, .003), m.steel, [0, 3.129, 0]);
                this.mesh(plug, this.cyl(.057, .28, 32, .006), F.material('#d1c8b6', .05, .3), [0, 3.32, 0]);
                for (let h = 0; h < 5; h++)
                    this.mesh(plug, this.torus(.055, .009, 24), m.alloy, [0, 3.255 + h * .033, 0]);
                this.mesh(plug, this.cyl(.045, .075, 24, .005), m.polish, [0, 3.50, 0]);
                const spark = this.mesh(plug, G.sphere(.034, 12, 8), F.material('#ffd2a0', 0, .3, 4, { alpha: .1, emission: 3 }), [0, 2.953, 0]);
                spark.castShadow = false;
                this.sparks.push(spark);
            });
            // A rear section of the machined head remains to locate the visible valve seats.
            this.mesh(this.valveFrame, this.box(5.78, .14, .17, .015), m.alloy, [0, 3.02, -.76]);
            this.mesh(this.valveFrame, this.box(5.78, .08, .12, .01), m.steel, [0, 3.10, -.73]);
            for (const x of [-2.83, -1.45, 0, 1.45, 2.83]) {
                this.mesh(this.camFrame, this.box(.17, .89, .13, .014), m.alloy, [x, 3.53, -.74]);
                this.bolt(this.valveFrame, [x, 3.101, -.77], [0, 0, 0], .7);
            }
        }
        makeTiming() {
            const m = this.m;
            this.timing = this.root.group();
            this.sprockets = [];
            const defs = [{ y: 0, z: 0, r: .21, teeth: 20, rate: 1 }, { y: 4.02, z: -.47, r: .42, teeth: 40, rate: .5 }, { y: 4.02, z: .47, r: .42, teeth: 40, rate: .5 }];
            for (const d of defs) {
                const g = this.timing.group([-3.10, d.y, d.z]);
                this.sprockets.push({ g, rate: d.rate });
                this.mesh(g, G.gear(d.r, d.teeth, .10), m.steel, [0, 0, 0], [0, -PI / 2, 0]);
                this.mesh(g, this.cyl(d.r * .83, .118, 56), m.forged, [0, 0, 0], [0, 0, -PI / 2]);
                this.mesh(g, this.ring(d.r * .72, d.r * .64, .006, 48), m.polish, [-.063, 0, 0], [0, 0, -PI / 2]);
                this.mesh(g, this.cyl(d.r * .26, .154, 32), m.polish, [0, 0, 0], [0, 0, -PI / 2]);
                this.bolt(g, [-.081, 0, 0], [0, 0, PI / 2], d.rate === 1 ? 1 : 1.15);
                for (let i = 0; i < 6; i++) {
                    const a = i / 6 * TAU;
                    this.mesh(g, this.cyl(d.r * .14, .007, 24, .002), m.recess, [-.064, Math.cos(a) * d.r * .49, Math.sin(a) * d.r * .49], [0, 0, -PI / 2]);
                }
            }
            // The convex envelope of the three pitch circles gives a closed timing-chain path.
            const points = [];
            for (const d of defs)
                for (let i = 0; i < 96; i++) {
                    const a = i / 96 * TAU;
                    points.push([d.z + Math.sin(a) * (d.r + .025), d.y + Math.cos(a) * (d.r + .025)]);
                }
            points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
            const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
            const lower = [], upper = [];
            for (const p of points) {
                while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0)
                    lower.pop();
                lower.push(p);
            }
            for (const p of points.slice().reverse()) {
                while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0)
                    upper.pop();
                upper.push(p);
            }
            this.chainPath = lower.slice(0, -1).concat(upper.slice(0, -1));
            this.chainLengths = [0];
            for (let i = 0; i < this.chainPath.length; i++) {
                const p = this.chainPath[i], q = this.chainPath[(i + 1) % this.chainPath.length];
                this.chainLengths.push(this.chainLengths.at(-1) + Math.hypot(q[0] - p[0], q[1] - p[1]));
            }
            this.chainLength = this.chainLengths.at(-1);
            const count = Math.round(this.chainLength / (TAU * .42 / 40));
            this.chainCount = count;
            const plate = this.box(.023, this.chainLength / count * .88, .049, .008), pin = this.cyl(.015, .126, 12, .002);
            for (let i = 0; i < count; i++) {
                const g = this.timing.group();
                for (const side of [-1, 1])
                    this.mesh(g, plate, i % 2 ? m.steel : m.forged, [side * .049, 0, 0]);
                this.mesh(g, pin, m.polish, [0, -this.chainLength / count * .39, 0], [0, 0, -PI / 2]);
                this.links.push(g);
            }
            for (const side of [-1, 1]) {
                const points = [[-3.02, .25, side * .32], [-3.02, 1.45, side * .56], [-3.02, 2.75, side * .77], [-3.02, 3.55, side * .89]];
                this.pipe(this.timing, points, .028, m.black);
                this.pipe(this.timing, points.map(p => [p[0] - .012, p[1], p[2] + side * .016]), .009, m.brass);
            }
        }
        chainSample(distance) { const d = K.wrap(distance, this.chainLength), lengths = this.chainLengths; let lo = 0, hi = lengths.length - 1; while (lo + 1 < hi) {
            const mid = (lo + hi) >> 1;
            if (lengths[mid] <= d)
                lo = mid;
            else
                hi = mid;
        } const a = this.chainPath[lo], b = this.chainPath[(lo + 1) % this.chainPath.length], t = (d - lengths[lo]) / (lengths[lo + 1] - lengths[lo]); return { y: a[1] + (b[1] - a[1]) * t, z: a[0] + (b[0] - a[0]) * t, angle: Math.atan2(b[0] - a[0], b[1] - a[1]) }; }
        makeHousing() {
            const m = this.m;
            this.backFrame = this.root.group();
            this.mesh(this.backFrame, this.box(5.77, 2.23, .12, .025), m.forged, [0, 1.78, -.82]);
            for (const x of [-2.84, -1.46, 0, 1.46, 2.84]) {
                this.mesh(this.backFrame, this.box(.115, 2.34, .12, .019), m.alloy, [x, 1.76, -.89]);
                this.bolt(this.backFrame, [x, 2.981, -.86], [], .8);
            }
            // Open, weight-bearing lower crankcase. Oil pan is a separate exterior group.
            this.mesh(this.backFrame, this.box(5.71, .32, .12, .02), m.alloy, [0, -.55, -.80]);
            for (const x of this.xs)
                this.mesh(this.backFrame, this.box(.31, .10, .45, .035), m.alloy, [x, .80, -.6]);
            this.frontShell = this.root.group();
            this.backShell = this.root.group();
            for (const side of [-1, 1]) {
                const shell = side > 0 ? this.frontShell : this.backShell;
                this.mesh(shell, this.box(5.84, 2.43, .17, .045), m.alloy, [0, 1.735, side * .77]);
                this.mesh(shell, this.box(5.93, .14, 1.68, .018), m.steel, [0, 2.99, 0]);
                for (const x of [-2.81, -2.14, -1.45, -.73, 0, .73, 1.45, 2.14, 2.81]) {
                    this.mesh(shell, this.box(.058, 1.64, .07, .012), m.alloy, [x, 1.52, side * .885]);
                    this.bolt(shell, [x, 2.53, side * .863], [side * PI / 2, 0, 0], .63);
                    this.bolt(shell, [x, .591, side * .875], [side * PI / 2, 0, 0], .75);
                }
                for (const x of this.xs) {
                    this.mesh(shell, this.cyl(.204, .018, 56, .005), m.forged, [x, 1.78, side * .86], [PI / 2, 0, 0]);
                    this.mesh(shell, this.ring(.194, .17, .015, 48), m.steel, [x, 1.78, side * .876], [PI / 2, 0, 0]);
                    this.mesh(shell, this.box(.43, .09, .025, .013), m.alloy, [x, 2.30, side * .864]);
                }
            }
            this.sump = this.root.group();
            this.mesh(this.sump, this.box(5.69, .15, 1.72, .025), m.alloy, [0, .44, 0]);
            this.mesh(this.sump, this.box(5.52, .99, 1.60, .12), m.dark, [0, -.09, 0]);
            this.mesh(this.sump, this.box(5.31, .17, 1.43, .08), m.graphite, [0, -.64, 0]);
            for (const z of [-.84, .84])
                for (let x = -2.6; x <= 2.61; x += .65)
                    this.bolt(this.sump, [x, .525, z], [], .7);
            for (let x = -2.3; x <= 2.31; x += .46)
                this.mesh(this.sump, this.box(.027, .57, .05, .01), m.forged, [x, -.15, .813]);
            this.bolt(this.sump, [2.15, -.42, .822], [PI / 2, 0, 0], 1.2);
            const tpoly = [[-.35, -.60], [.35, -.60], [.54, -.32], [.79, 3.66], [.88, 4.14], [.72, 4.51], [-.72, 4.51], [-.88, 4.14], [-.79, 3.66], [-.54, -.32]];
            this.timingCover = this.root.group();
            this.mesh(this.timingCover, G.extrude(tpoly, .18, .055), m.dark, [-3.30, 0, 0], [0, -PI / 2, 0]);
            for (const zz of [-.24, .24])
                this.mesh(this.timingCover, this.box(.024, 3.51, .022, .006), m.forged, [-3.399, 1.64, zz]);
            for (const y of [-.32, .70, 1.9, 3.0, 4.16])
                for (const side of [-1, 1])
                    this.bolt(this.timingCover, [-3.403, y, side * (.38 + y * .085)], [0, 0, PI / 2], .78);
        }
        makeExterior() {
            const m = this.m;
            this.headShell = this.root.group();
            this.mesh(this.headShell, this.box(5.90, .80, 1.60, .08), m.alloy, [0, 3.39, 0]);
            this.mesh(this.headShell, this.box(5.96, .056, 1.69, .016), m.steel, [0, 3.814, 0]);
            this.mesh(this.headShell, this.box(5.97, .025, 1.68, .01), m.recess, [0, 3.854, 0]);
            for (const side of [-1, 1]) {
                for (const x of [-2.77, -1.45, 0, 1.45, 2.77])
                    this.bolt(this.headShell, [x, 3.45, side * .814], [side * PI / 2, 0, 0], .75);
                for (const y of [3.2, 3.28, 3.71])
                    this.mesh(this.headShell, this.box(5.52, .022, .025, .005), m.steel, [0, y, side * .812]);
            }
            this.cover = this.root.group();
            this.mesh(this.cover, this.box(5.83, .44, 1.61, .14), m.graphite, [0, 4.16, 0]);
            this.mesh(this.cover, this.box(5.93, .07, 1.70, .03), m.polish, [0, 3.935, 0]);
            this.mesh(this.cover, this.box(5.9, .04, 1.67, .02), m.black, [0, 3.988, 0]);
            for (let i = 0; i < 6; i++)
                this.mesh(this.cover, this.box(5.34, .016, .028, .008), m.steel, [0, 4.383, -.18 - i * .075]);
            this.label(this.cover, 'F E R R O', 2.64, .42, [.03, 4.389, .36], [-PI / 2, 0, 0], 'TWIN CAM  /  16 VALVE');
            for (const side of [-1, 1])
                for (const x of [-2.70, -1.45, 0, 1.45, 2.70])
                    this.bolt(this.cover, [x, 4.26, side * .7], [], .78);
            for (const x of this.xs) {
                this.mesh(this.cover, this.box(.29, .17, .26, .035), m.black, [x, 4.42, .13]);
                this.mesh(this.cover, this.cyl(.064, .21, 24), m.rubber, [x, 4.365, .15]);
                this.pipe(this.cover, [[x, 4.48, .17], [x + .1, 4.47, .5], [x + .17, 4.25, .85], [x + .19, 3.92, .98]], .027, m.rubber);
            }
            this.mesh(this.cover, this.cyl(.176, .13, 40, .018), m.black, [2.21, 4.459, -.4]);
            this.mesh(this.cover, this.box(.19, .025, .045, .01), m.forged, [2.21, 4.535, -.4]);
            this.headers = this.root.group();
            for (const x of this.xs) {
                this.mesh(this.headers, this.box(.63, .38, .085, .08), m.forged, [x, 2.785, .85]);
                for (const dx of [-.245, .245])
                    this.bolt(this.headers, [x + dx, 2.81, .902], [PI / 2, 0, 0], .65);
                this.pipe(this.headers, [[x, 2.8, .9], [x, 2.7, 1.13], [x + .03, 2.32, 1.43], [x + .11, 1.88, 1.56], [x + .20, 1.43, 1.56]], .147, m.header);
                for (const yy of [2.2, 1.72])
                    this.mesh(this.headers, this.torus(.148, .008, 36), m.copper, [x + .075, yy, 1.53]);
            }
            this.mesh(this.headers, this.cyl(.235, 5.87, 64, .03), m.graphite, [0, 1.365, 1.57], [0, 0, -PI / 2]);
            for (const x of [-2.83, 2.83]) {
                this.mesh(this.headers, this.ring(.269, .222, .056, 56), m.polish, [x, 1.365, 1.57], [0, 0, -PI / 2]);
                this.mesh(this.headers, this.cyl(.213, .008, 48, .005), m.recess, [x + Math.sign(x) * .1, 1.365, 1.57], [0, 0, -PI / 2]);
            }
            this.intake = this.root.group();
            for (const x of this.xs) {
                this.pipe(this.intake, [[x, 2.88, -.8], [x, 2.83, -1.1], [x - .08, 2.58, -1.43], [x - .11, 2.30, -1.42]], .13, m.alloy);
            }
            this.mesh(this.intake, this.cyl(.32, 5.74, 64, .025), m.graphite, [0, 2.25, -1.45], [0, 0, -PI / 2]);
            this.mesh(this.intake, this.ring(.33, .285, .10, 56), m.polish, [-2.9, 2.25, -1.45], [0, 0, -PI / 2]);
        }
        makeGuides() { this.guides = this.root.group(); for (const x of [-2.83, -1.45, 1.45, 2.83])
            for (const z of [-.70, .70])
                for (let y = 3; y < 6.5; y += .18)
                    this.mesh(this.guides, this.cyl(.003, .075, 6, .001), this.m.guide, [x, y, z]).castShadow = false; }
        setMode(mode) { if (!['exterior', 'cutaway', 'exploded'].includes(mode))
            throw new Error('Unknown view mode.'); this.mode = mode; }
        update(angle, dt, combustion) {
            this.angle = K.wrap(angle);
            if (this.reducedMotion) this.explosion = this.mode === 'exploded' ? 1 : 0;
            this.explosion += ((this.mode === 'exploded' ? 1 : 0) - this.explosion) * (1 - Math.exp(-Math.max(dt, .001) * 5));
            if (Math.abs(this.explosion - (this.mode === 'exploded' ? 1 : 0)) < .001)
                this.explosion = this.mode === 'exploded' ? 1 : 0;
            const ex = this.explosion;
            this.crank.r[0] = this.angle;
            for (let i = 0; i < 4; i++) {
                const s = K.cylinderAt(this.angle, i);
                this.pistons[i].p[1] = s.y;
                const rod = this.rods[i];
                rod.p[1] = s.crankY;
                rod.p[2] = s.crankZ;
                rod.r[0] = s.rodAngle;
                const gas = this.gases[i], top = s.y + .334, h = Math.max(.025, 2.977 - top);
                gas.p[1] = top + h / 2;
                gas.s[1] = h;
                gas.material.color = s.stage.rgb;
                gas.material.alpha = s.stageIndex === 0 ? .15 + .14 * Math.exp(-s.progress * 4) : s.stageIndex === 2 ? .075 : .035;
                gas.material.emission = s.stageIndex === 0 ? .9 * Math.exp(-s.progress * 4) : .04;
                gas.visible = !!combustion && this.mode === 'cutaway';
                this.sparks[i].visible = !!combustion && s.phase < .35 && this.mode === 'cutaway';
                this.sparks[i].material.alpha = Math.max(.1, 1 - s.phase / .35);
            }
            for (const v of this.valves) {
                const s = K.cylinderAt(this.angle, v.i), lift = s[v.kind];
                v.moving.p[1] = -lift;
                v.spring.s[1] = (.49 - lift) / .49;
            }
            for (const cam of this.cams)
                cam.r[0] = K.camAngle(this.angle);
            this.valveFrame.p[1] = ex * .72;
            this.camFrame.p[1] = ex * 1.37;
            this.cover.p[1] = ex * 2.27;
            this.headShell.p[1] = ex * .74;
            this.frontShell.p[2] = ex * 1.57;
            this.frontShell.p[1] = ex * .22;
            this.backShell.p[2] = -ex * 1.46;
            this.headers.p[2] = ex * 1.62;
            this.headers.p[1] = ex * .73;
            this.intake.p[2] = -ex * 1.26;
            this.intake.p[1] = ex * .67;
            this.sump.p[2] = ex * 2.13;
            this.timingCover.p[0] = -ex * 1.14;
            const exterior = this.mode !== 'cutaway';
            for (const n of [this.cover, this.headShell, this.frontShell, this.backShell, this.sump, this.timingCover, this.headers, this.intake])
                n.visible = exterior;
            this.backFrame.visible = this.mode === 'cutaway';
            this.guides.visible = ex > .08;
            this.guides.s[1] = .8 + ex * .2;
            this.timing.visible = ex < .025;
            if (this.timing.visible) {
                for (const { g, rate } of this.sprockets)
                    g.r[0] = this.angle * rate;
                for (let i = 0; i < this.links.length; i++) {
                    const p = this.chainSample(i / this.links.length * this.chainLength - this.angle / K.TAU * 20 * (this.chainLength / this.chainCount)), g = this.links[i];
                    g.p = [-3.10, p.y, p.z];
                    g.r[0] = p.angle;
                }
            }
        }
        anchors() { return [[this.xs[0], this.pistons[0].p[1] + .30, .35], [.60, .0, .48], [this.xs[2], 3.5 + this.valveFrame.p[1], .47], [.02, 4.18 + this.camFrame.p[1], .47], [-3.16, 2.10, -.10]]; }
    }
    F.Engine = Engine;
})(globalThis.FERRO);
