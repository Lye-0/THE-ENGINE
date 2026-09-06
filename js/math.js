/* FERRO — small, dependency-free column-major math library. */
(function (root) {
    'use strict';
    const F = root.FERRO = root.FERRO || {};
    const V = { add: (a, b) => a.map((v, i) => v + b[i]), sub: (a, b) => a.map((v, i) => v - b[i]), mul: (a, s) => a.map(v => v * s), dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], len: a => Math.hypot(...a), norm: a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); }, lerp: (a, b, t) => a.map((v, i) => v + (b[i] - v) * t) };
    const M = {
        identity: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
        mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++)
            for (let r = 0; r < 4; r++)
                o[c * 4 + r] = a[r] * b[c * 4] + a[r + 4] * b[c * 4 + 1] + a[r + 8] * b[c * 4 + 2] + a[r + 12] * b[c * 4 + 3]; return o; },
        compose(p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) { const a = Math.cos(r[0]), b = Math.sin(r[0]), c = Math.cos(r[1]), d = Math.sin(r[1]), e = Math.cos(r[2]), f = Math.sin(r[2]); return new Float32Array([c * e * s[0], (a * f + b * e * d) * s[0], (b * f - a * e * d) * s[0], 0, -c * f * s[1], (a * e - b * f * d) * s[1], (b * e + a * f * d) * s[1], 0, d * s[2], -b * c * s[2], a * c * s[2], 0, p[0], p[1], p[2], 1]); },
        perspective(fov, aspect, near, far) { const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far); return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]); },
        ortho(l, r, b, t, n, f) { return new Float32Array([2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]); },
        lookAt(eye, target, up = [0, 1, 0]) { const z = V.norm(V.sub(eye, target)), x = V.norm(V.cross(up, z)), y = V.cross(z, x); return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -V.dot(x, eye), -V.dot(y, eye), -V.dot(z, eye), 1]); },
        transform(m, p) { const x = p[0], y = p[1], z = p[2], w = p[3] === undefined ? 1 : p[3]; return [m[0] * x + m[4] * y + m[8] * z + m[12] * w, m[1] * x + m[5] * y + m[9] * z + m[13] * w, m[2] * x + m[6] * y + m[10] * z + m[14] * w, m[3] * x + m[7] * y + m[11] * z + m[15] * w]; },
        invert(a) { const out = new Float32Array(16); const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7], a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15]; const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32; let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; if (!det)
            return M.identity(); det = 1 / det; out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det; out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det; out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det; out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det; out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det; out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det; out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det; out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det; return out; }
    };
    let nodeId = 0;
    class Node {
        constructor(geometry = null, material = null, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) { this.id = ++nodeId; this.geometry = geometry; this.material = material; this.p = [p[0] || 0, p[1] || 0, p[2] || 0]; this.r = [r[0] || 0, r[1] || 0, r[2] || 0]; this.s = [s[0] ?? 1, s[1] ?? 1, s[2] ?? 1]; this.children = []; this.visible = true; this.world = M.identity(); this.castShadow = true; }
        add(n) { this.children.push(n); return n; }
        group(p = [0, 0, 0], r = [0, 0, 0]) { return this.add(new Node(null, null, p, r)); }
        update(parent) { this.world = M.mul(parent || M.identity(), M.compose(this.p, this.r, this.s)); for (const c of this.children)
            if (c.visible)
                c.update(this.world); }
    }
    F.V = V;
    F.M = M;
    F.Node = Node;
    F.clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    F.mix = (a, b, t) => a + (b - a) * t;
})(globalThis);
