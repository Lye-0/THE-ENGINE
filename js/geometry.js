/* Procedural, indexed geometry. No model or texture downloads are required. */
(function (F) {
    'use strict';
    const { V } = F;
    let id = 0;
    function geo(p, n, uv, idx) { return { id: ++id, positions: new Float32Array(p), normals: new Float32Array(n), uvs: new Float32Array(uv), indices: new Uint32Array(idx) }; }
    function meshBuilder() { return { p: [], n: [], uv: [], i: [], vertex(p, n, uv = [0, 0]) { const k = this.p.length / 3; this.p.push(...p); this.n.push(...n); this.uv.push(...uv); return k; }, tri(a, b, c) { this.i.push(a, b, c); }, quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }, done() { return geo(this.p, this.n, this.uv, this.i); } }; }
    function lathe(profile, segments = 64, start = 0, arc = Math.PI * 2) {
        const b = meshBuilder();
        for (let j = 0; j < profile.length; j++) {
            const before = profile[Math.max(0, j - 1)], after = profile[Math.min(profile.length - 1, j + 1)], dr = after[0] - before[0], dy = after[1] - before[1], len = Math.hypot(dr, dy) || 1;
            for (let k = 0; k <= segments; k++) {
                const a = start + k / segments * arc, c = Math.cos(a), s = Math.sin(a);
                b.vertex([profile[j][0] * c, profile[j][1], profile[j][0] * s], [dy / len * c, -dr / len, dy / len * s], [k / segments, j / (profile.length - 1)]);
            }
        }
        // Profile is traversed from the bottom centre, around the outside, to the top centre.
        for (let j = 0; j < profile.length - 1; j++)
            for (let k = 0; k < segments; k++) {
                const a = j * (segments + 1) + k, bb = a + segments + 1;
                b.quad(a, bb, bb + 1, a + 1);
            }
        return b.done();
    }
    function cylinder(r = 1, h = 1, segments = 64, bevel = .03) { bevel = Math.min(bevel, r * .45, h * .2); return lathe([[0, -h / 2], [r - bevel, -h / 2], [r, -h / 2 + bevel], [r, h / 2 - bevel], [r - bevel, h / 2], [0, h / 2]], segments); }
    function ring(outer, inner, h, segments = 64, start = 0, arc = Math.PI * 2) { const be = Math.min(.012, h * .2, (outer - inner) * .2); return lathe([[inner, -h / 2], [outer - be, -h / 2], [outer, -h / 2 + be], [outer, h / 2 - be], [outer - be, h / 2], [inner, h / 2], [inner, -h / 2]], segments, start, arc); }
    function box(w = 1, h = 1, d = 1, bevel = .04, steps = 3) {
        const b = meshBuilder(), half = [w / 2, h / 2, d / 2];
        bevel = Math.min(bevel, ...half.map(x => x * .6));
        const inner = half.map(v => v - bevel);
        const faces = [{ axis: 0, sign: 1, u: 2, v: 1 }, { axis: 0, sign: -1, u: 1, v: 2 }, { axis: 1, sign: 1, u: 0, v: 2 }, { axis: 1, sign: -1, u: 2, v: 0 }, { axis: 2, sign: 1, u: 1, v: 0 }, { axis: 2, sign: -1, u: 0, v: 1 }];
        for (const f of faces) {
            const cuts = (a) => [-half[a], ...Array.from({ length: steps }, (_, i) => -half[a] + (i + 1) / steps * bevel), ...Array.from({ length: steps + 1 }, (_, i) => inner[a] + i / steps * bevel)];
            const us = cuts(f.u), vs = cuts(f.v), base = b.p.length / 3;
            for (let j = 0; j < vs.length; j++)
                for (let i = 0; i < us.length; i++) {
                    const p = [0, 0, 0];
                    p[f.axis] = half[f.axis] * f.sign;
                    p[f.u] = us[i];
                    p[f.v] = vs[j];
                    const c = p.map((v, k) => F.clamp(v, -inner[k], inner[k])), normal = V.norm(V.sub(p, c)), q = V.add(c, V.mul(normal, bevel));
                    b.vertex(q, normal, [i / (us.length - 1), j / (vs.length - 1)]);
                }
            for (let j = 0; j < vs.length - 1; j++)
                for (let i = 0; i < us.length - 1; i++) {
                    const a = base + j * us.length + i;
                    b.quad(a, a + us.length, a + us.length + 1, a + 1);
                }
        }
        return b.done();
    }
    function sphere(r = 1, width = 24, height = 16) { const b = meshBuilder(); for (let y = 0; y <= height; y++)
        for (let x = 0; x <= width; x++) {
            const t = y / height * Math.PI, p = x / width * Math.PI * 2, n = [Math.sin(t) * Math.cos(p), Math.cos(t), Math.sin(t) * Math.sin(p)];
            b.vertex(V.mul(n, r), n, [x / width, y / height]);
        } for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
            const a = y * (width + 1) + x;
            b.quad(a, a + 1, a + width + 2, a + width + 1);
        } return b.done(); }
    function torus(radius = .5, tube = .04, segments = 64, sides = 8, arc = Math.PI * 2) { const b = meshBuilder(); for (let i = 0; i <= segments; i++) {
        const a = i / segments * arc;
        for (let j = 0; j <= sides; j++) {
            const t = j / sides * Math.PI * 2, n = [Math.cos(a) * Math.cos(t), Math.sin(t), Math.sin(a) * Math.cos(t)];
            b.vertex([(radius + tube * Math.cos(t)) * Math.cos(a), tube * Math.sin(t), (radius + tube * Math.cos(t)) * Math.sin(a)], n, [i / segments, j / sides]);
        }
    } for (let i = 0; i < segments; i++)
        for (let j = 0; j < sides; j++) {
            const a = i * (sides + 1) + j;
            b.quad(a, a + 1, a + sides + 2, a + sides + 1);
        } return b.done(); }
    function tube(points, radius = .08, sides = 10) { const b = meshBuilder(); let prev = null; for (let i = 0; i < points.length; i++) {
        const tangent = V.norm(V.sub(points[Math.min(points.length - 1, i + 1)], points[Math.max(0, i - 1)]));
        let n = prev ? V.norm(V.sub(prev, V.mul(tangent, V.dot(prev, tangent)))) : V.norm(V.cross(tangent, Math.abs(tangent[1]) > .95 ? [1, 0, 0] : [0, 1, 0]));
        const binormal = V.norm(V.cross(tangent, n));
        prev = n;
        for (let j = 0; j <= sides; j++) {
            const a = j / sides * Math.PI * 2, nn = V.add(V.mul(n, Math.cos(a)), V.mul(binormal, Math.sin(a)));
            b.vertex(V.add(points[i], V.mul(nn, radius)), nn, [j / sides, i / (points.length - 1)]);
        }
    } for (let i = 0; i < points.length - 1; i++)
        for (let j = 0; j < sides; j++) {
            const a = i * (sides + 1) + j;
            b.quad(a, a + 1, a + sides + 2, a + sides + 1);
        } return b.done(); }
    function curve(points, samples = 48) { const out = []; for (let j = 0; j <= samples; j++) {
        const t = j / samples * (points.length - 1), i = Math.min(points.length - 2, Math.floor(t)), f = t - i, p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
        out.push([0, 1, 2].map(k => .5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * f + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * f * f + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * f * f * f)));
    } return out; }
    function helix(radius = .095, height = .44, turns = 7, tubeRadius = .018) { const points = []; for (let i = 0; i <= turns * 22; i++) {
        const t = i / (turns * 22), a = t * turns * Math.PI * 2;
        points.push([Math.cos(a) * radius, t * height, Math.sin(a) * radius]);
    } return tube(points, tubeRadius, 6); }
    // Convex polygon extrusion along Z; optional bevel creates a separate machined edge.
    function extrude(poly, depth = .16, bevel = .015) {
        const b = meshBuilder();
        const center = poly.reduce((a, p) => [a[0] + p[0] / poly.length, a[1] + p[1] / poly.length], [0, 0]);
        let area = 0;
        poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]; area += p[0] * q[1] - q[0] * p[1]; });
        if (area < 0)
            poly = poly.slice().reverse();
        const inset = poly.map(p => { const d = [p[0] - center[0], p[1] - center[1]], l = Math.hypot(...d) || 1; return [p[0] - d[0] / l * bevel, p[1] - d[1] / l * bevel]; });
        for (const side of [-1, 1]) {
            const c = b.vertex([center[0], center[1], side * depth / 2], [0, 0, side]);
            const ids = inset.map(p => b.vertex([p[0], p[1], side * depth / 2], [0, 0, side]));
            for (let i = 0; i < ids.length; i++) {
                const next = (i + 1) % ids.length;
                side > 0 ? b.tri(c, ids[i], ids[next]) : b.tri(c, ids[next], ids[i]);
            }
        }
        for (let i = 0; i < poly.length; i++) {
            const j = (i + 1) % poly.length, p = poly[i], q = poly[j], n = V.norm([q[1] - p[1], p[0] - q[0], 0]);
            const a = b.vertex([...p, -depth / 2 + bevel], n), bb = b.vertex([...q, -depth / 2 + bevel], n), c = b.vertex([...q, depth / 2 - bevel], n), d = b.vertex([...p, depth / 2 - bevel], n);
            b.quad(a, bb, c, d);
            for (const sign of [-1, 1]) {
                const normal = V.norm([n[0], n[1], sign]);
                const v0 = b.vertex([...p, sign * (depth / 2 - bevel)], normal), v1 = b.vertex([...q, sign * (depth / 2 - bevel)], normal), v2 = b.vertex([...inset[j], sign * depth / 2], normal), v3 = b.vertex([...inset[i], sign * depth / 2], normal);
                sign > 0 ? b.quad(v0, v1, v2, v3) : b.quad(v3, v2, v1, v0);
            }
        }
        return b.done();
    }
    function gear(radius = .4, teeth = 40, thickness = .1) { const p = []; for (let t = 0; t < teeth; t++)
        for (let k = 0; k < 4; k++) {
            const a = (t + k / 4) / teeth * Math.PI * 2, r = radius * (k === 1 || k === 2 ? 1.04 : .94);
            p.push([Math.cos(a) * r, Math.sin(a) * r]);
        } return extrude(p, thickness, .004); }
    // The envelope of the flat bucket's planes, not a radial approximation.
    // h is support distance and h' locates the moving contact point. A positive
    // h+h'' is checked in tests to exclude undercuts and self-intersections.
    function cam(phaseOffset, kind, segments = 384, tilt = 0) {
        const b = meshBuilder(), profile = [], normals = [], depth = .145, bevel = .007;
        for (let i = 0; i <= segments; i++) {
            const a = i / segments * Math.PI * 2, n = [Math.cos(a), Math.sin(a)];
            const motion = F.K.valveMotion(2 * (a + tilt + Math.PI / 2) - phaseOffset, kind);
            const h = F.K.HEAD.camBase + motion.lift, derivative = 2 * motion.velocity;
            profile.push([h * n[0] - derivative * n[1], h * n[1] + derivative * n[0]]);
            normals.push(n);
        }
        const rows = [];
        for (const side of [-1, 1]) {
            for (let j = 0; j <= 3; j++) {
                const t = (side < 0 ? 3 - j : j) / 3 * Math.PI / 2;
                rows.push({ z: side * (depth / 2 - bevel + bevel * Math.sin(t)), inset: bevel * (1 - Math.cos(t)), nz: side * Math.sin(t), nr: Math.cos(t) });
            }
        }
        for (const row of rows) for (let i = 0; i <= segments; i++) {
            const p = profile[i], n = normals[i];
            b.vertex([p[0] - n[0] * row.inset, p[1] - n[1] * row.inset, row.z],
                [n[0] * row.nr, n[1] * row.nr, row.nz], [i / segments, (row.z / depth + .5)]);
        }
        for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < segments; i++) {
            const a = j * (segments + 1) + i;
            b.quad(a, a + 1, a + segments + 2, a + segments + 1);
        }
        for (const side of [-1, 1]) {
            const c = b.vertex([0, 0, side * depth / 2], [0, 0, side]);
            const rim = profile.map((p, i) => b.vertex([p[0] - bevel * normals[i][0], p[1] - bevel * normals[i][1], side * depth / 2], [0, 0, side]));
            for (let i = 0; i < segments; i++) side > 0 ? b.tri(c, rim[i], rim[i + 1]) : b.tri(c, rim[i + 1], rim[i]);
        }
        return b.done();
    }
    // Hollow runners with inner walls, end lips and actual section edges.
    function sweptPipe(points, radius = .18, wall = .023, sides = 32, start = 0, arc = Math.PI * 2, cutFacing = null) {
        const b = meshBuilder(), frames = [], count = sides + 1;
        let prev;
        for (let i = 0; i < points.length; i++) {
            const t = V.norm(V.sub(points[Math.min(i + 1, points.length - 1)], points[Math.max(i - 1, 0)]));
            const n = prev ? V.norm(V.sub(prev, V.mul(t, V.dot(prev, t)))) : V.norm(V.cross(t, Math.abs(t[1]) > .95 ? [1, 0, 0] : [0, 1, 0]));
            frames.push({ n, b: V.norm(V.cross(t, n)), t }); prev = n;
        }
        for (const inner of [false, true]) {
            const base = b.p.length / 3;
            for (let i = 0; i < points.length; i++) for (let j = 0; j <= sides; j++) {
                const f = frames[i];
                const begin = cutFacing ? Math.atan2(-V.dot(cutFacing, f.b), -V.dot(cutFacing, f.n)) - arc / 2 : start;
                const a = begin + j / sides * arc;
                const normal = V.add(V.mul(f.n, Math.cos(a)), V.mul(f.b, Math.sin(a)));
                const r = (Array.isArray(radius) ? radius[i] : radius) - (inner ? wall : 0);
                b.vertex(V.add(points[i], V.mul(normal, r)), V.mul(normal, inner ? -1 : 1), [j / sides, i / (points.length - 1)]);
            }
            for (let i = 0; i < points.length - 1; i++) for (let j = 0; j < sides; j++) {
                const a = base + i * count + j;
                inner ? b.quad(a, a + count, a + count + 1, a + 1) : b.quad(a, a + 1, a + count + 1, a + count);
            }
        }
        const layer = points.length * count;
        for (const end of [0, points.length - 1]) for (let j = 0; j < sides; j++) {
            const a = end * count + j, normal = V.mul(frames[end].t, end === 0 ? -1 : 1);
            const ids = [a, a + 1, a + 1 + layer, a + layer].map(k => b.vertex(b.p.slice(k * 3, k * 3 + 3), normal));
            end === 0 ? b.quad(...ids.slice().reverse()) : b.quad(...ids);
        }
        if (arc < Math.PI * 2 - 1e-6) for (const side of [0, sides]) for (let i = 0; i < points.length - 1; i++) {
            const a = i * count + side, ids = [a, a + count, a + count + layer, a + layer];
            const p = ids.map(k => b.p.slice(k * 3, k * 3 + 3));
            const n = V.norm(V.cross(V.sub(p[1], p[0]), V.sub(p[2], p[0])));
            const out = p.map(q => b.vertex(q, side ? n : V.mul(n, -1)));
            side ? b.quad(...out) : b.quad(...out.reverse());
        }
        return b.done();
    }
    // One inlet and two outlets. Each branch starts as one half of the common
    // bore and smoothly becomes round. No independent pipe walls overlap in
    // the inlet. The small central web begins only at the downstream split.
    function branchedPipe({ trunk, branches, inletRadius, outletRadius, wall = .022, cutPlane = null }) {
        const b = meshBuilder(), sides = 48, half = sides / 2;
        const planeN = cutPlane ? V.norm(cutPlane.normal) : null;
        const distance = p => V.dot(planeN, p) - cutPlane.offset / V.len(cutPlane.normal);
        const vertex = (p, n) => ({ p, n });
        function triangle(a, c, d) {
            const area = V.cross(V.sub(c.p, a.p), V.sub(d.p, a.p));
            if (V.len(area) < 1e-12) return;
            if (V.dot(area, V.add(a.n, V.add(c.n, d.n))) < 0) [c, d] = [d, c];
            b.tri(...[a, c, d].map(v => b.vertex(v.p, v.n)));
        }
        function face(vertices) {
            for (let k = 1; k < vertices.length - 1; k++) {
                let poly = [vertices[0], vertices[k], vertices[k + 1]];
                if (cutPlane) {
                    const clipped = [];
                    for (let j = 0; j < poly.length; j++) {
                        const a = poly[j], c = poly[(j + 1) % poly.length], da = distance(a.p), dc = distance(c.p);
                        if (da <= 0) clipped.push(a);
                        if ((da < 0 && dc > 0) || (da > 0 && dc < 0)) {
                            const t = da / (da - dc);
                            clipped.push(vertex(V.lerp(a.p, c.p, t), V.norm(V.lerp(a.n, c.n, t))));
                        }
                    }
                    poly = clipped;
                }
                for (let j = 1; j < poly.length - 1; j++) triangle(poly[0], poly[j], poly[j + 1]);
            }
        }
        // Cap only the thickness of each wall cell, never the open lumen.
        function sectionCell(points) {
            if (!cutPlane) return;
            const ds = points.map(distance);
            if (Math.min(...ds) >= 0 || Math.max(...ds) <= 0) return;
            const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]], cut = [];
            for (const [a, c] of edges) {
                if (ds[a] * ds[c] > 0 || Math.abs(ds[a] - ds[c]) < 1e-12) continue;
                const p = V.lerp(points[a], points[c], ds[a] / (ds[a] - ds[c]));
                if (!cut.some(q => V.len(V.sub(p, q)) < 1e-8)) cut.push(p);
            }
            if (cut.length < 3) return;
            const centre = cut.reduce((sum, p) => V.add(sum, V.mul(p, 1 / cut.length)), [0,0,0]);
            const ref = Math.abs(planeN[0]) < .9 ? [1,0,0] : [0,1,0];
            const u = V.norm(V.sub(ref, V.mul(planeN, V.dot(ref, planeN)))), v = V.cross(planeN, u);
            const angle = p => Math.atan2(V.dot(V.sub(p, centre), v), V.dot(V.sub(p, centre), u));
            cut.sort((a, c) => angle(a) - angle(c));
            for (let j = 1; j < cut.length - 1; j++) triangle(vertex(cut[0], planeN), vertex(cut[j], planeN), vertex(cut[j + 1], planeN));
        }
        const trunkPath = curve(trunk, 12), junction = trunkPath.at(-1);
        const junctionTangent = V.norm(V.sub(trunkPath.at(-1), trunkPath.at(-2)));
        function rings(points, branchSign = 0) {
            const extent = Math.abs(points.at(-1)[0] - junction[0]);
            return points.map((centre, i) => {
                const tangent = branchSign && i === 0 ? junctionTangent : V.norm(V.sub(points[Math.min(i + 1, points.length - 1)], points[Math.max(i - 1, 0)]));
                const u = V.norm(V.sub([1,0,0], V.mul(tangent, tangent[0]))), v = V.norm(V.cross(u, tangent));
                const progress = branchSign ? F.clamp(Math.abs(centre[0] - junction[0]) / extent, 0, 1) : 0;
                const blend = progress * progress * (3 - 2 * progress), ro = F.mix(inletRadius, outletRadius, blend);
                const row = { centre, tangent, u, v, outer: [], inner: [], outer2: [], inner2: [], sign: branchSign || 1 };
                for (const inside of [false, true]) for (let j = 0; j < sides; j++) {
                    const r = ro - (inside ? wall : 0), angle = -Math.PI / 2 + j / sides * Math.PI * 2;
                    let xy = [r * Math.cos(angle), r * Math.sin(angle)];
                    if (branchSign) {
                        const divider = inside ? wall / 2 : 0, limit = Math.acos(divider / r), height = Math.sqrt(r * r - divider * divider);
                        const mouth = j <= half ? [r * Math.cos(-limit + j / half * limit * 2), r * Math.sin(-limit + j / half * limit * 2)] : [divider, height * (3 - 4 * j / sides)];
                        xy = V.lerp([...mouth, 0], [...xy, 0], blend).slice(0,2);
                        xy[0] *= branchSign;
                    }
                    const name = inside ? 'inner' : 'outer';
                    row[name].push(V.add(centre, V.add(V.mul(u, xy[0]), V.mul(v, xy[1]))));
                    row[name + '2'].push(xy);
                }
                return row;
            });
        }
        function shell(rows, capStart, capEnd) {
            const normals = {};
            for (const name of ['outer','inner']) normals[name] = rows.map((row, i) => row[name].map((p, j) => {
                const previous = (j + sides - 1) % sides, next = (j + 1) % sides;
                const along = V.sub(rows[Math.min(i + 1, rows.length - 1)][name][j], rows[Math.max(i - 1, 0)][name][j]);
                const across = V.sub(row[name][next], row[name][previous]), q = row[name + '2'];
                const dx = q[next][0] - q[previous][0], dy = q[next][1] - q[previous][1];
                const outward = V.add(V.mul(row.u, dy * row.sign), V.mul(row.v, -dx * row.sign));
                let n = V.norm(V.cross(along, across));
                if (V.dot(n, outward) < 0) n = V.mul(n, -1);
                return name === 'inner' ? V.mul(n, -1) : n;
            }));
            for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < sides; j++) {
                const next = (j + 1) % sides, indices = [[i,j],[i,next],[i+1,next],[i+1,j]];
                for (const name of ['outer','inner']) face(indices.map(([a,c]) => vertex(rows[a][name][c], normals[name][a][c])));
                sectionCell(['outer','inner'].flatMap(name => indices.map(([a,c]) => rows[a][name][c])));
            }
            for (const end of [0, rows.length - 1]) {
                if (!(end === 0 ? capStart : capEnd)) continue;
                const row = rows[end], n = V.mul(row.tangent, end === 0 ? -1 : 1);
                for (let j = 0; j < sides; j++) {
                    const next = (j + 1) % sides;
                    face([row.outer[j], row.outer[next], row.inner[next], row.inner[j]].map(p => vertex(p, n)));
                }
            }
        }
        shell(rings(trunkPath), true, false);
        for (const branch of branches) shell(rings(curve(branch, 28), Math.sign(branch.at(-1)[0] - junction[0])), true, true);
        return b.done();
    }
    F.G = { geo, lathe, cylinder, ring, box, sphere, torus, tube, curve, helix, extrude, gear, cam, sweptPipe, branchedPipe };
})(globalThis.FERRO);
