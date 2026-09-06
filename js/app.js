/* THE ENGINE UI, input, camera, accessibility and lifecycle. */
(function (F) {
    'use strict';
    const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)], { K, V } = F;
    const PARTS = [
        { name: 'ピストン', en: 'PISTON ASSEMBLY', kicker: 'THE RECIPROCATING ASSEMBLY', body: '燃焼室の圧力を受け止め、上下の動きへ。細いリングがシリンダーとの隙間を密閉し、コンロッドがその力をクランクへ伝えます。', fact: '4 PISTONS / 86 mm BORE<br>1・4番、2・3番がそれぞれ同じ高さで動きます。' },
        { name: 'クランクシャフト', en: 'CRANKSHAFT', kicker: 'THE ROTATING ASSEMBLY', body: 'ピストンの往復運動を、回転へと変える中心軸。偏心したクランクピンと、反対側のカウンターウェイトが、力の流れを形にしています。', fact: '86 mm STROKE / 43 mm THROW<br>コンロッドの両端は、ピストンピンとクランクピンに連動します。' },
        { name: 'バルブ & スプリング', en: 'VALVETRAIN', kicker: 'THE BREATHING MECHANISM', body: '吸気と排気、それぞれに2本のバルブ。カムがバルブを押し下げるとスプリングが縮み、カムが通過すると閉じる位置へ戻ります。', fact: '4 VALVES × 4 CYLINDERS<br>奥側が吸気、手前側が排気。この展示では開閉時期を理想化しています。' },
        { name: 'カムシャフト', en: 'DUAL OVERHEAD CAMSHAFT', kicker: 'THE MASTER OF TIMING', body: '2本のシャフトに並ぶ、卵形のカム。形状と位相の違いが16本のバルブを順番に動かし、エンジンが呼吸するタイミングを決めます。', fact: 'CRANK : CAM = 2 : 1<br>クランクが2回転する間に、カムが1回転します。' },
        { name: 'タイミングチェーン', en: 'TIMING DRIVE', kicker: 'EVERYTHING, IN SYNC', body: 'クランクと2本のカムをつなぐ、連続した金属のリンク。大小のスプロケットが回転比をつくり、ピストンとバルブの動きを同じ時間軸に保ちます。', fact: '20 / 40 TEETH · CHAIN DRIVE<br>分解表示では軸間が離れるため、チェーンを非表示にしています。' }
    ];
    class CameraController {
        constructor(canvas) { this.canvas = canvas; this.yaw = -.65; this.pitch = .34; this.radius = 13.7; this.radiusGoal = 13.7; this.target = [0, 1.0, 0]; this.targetGoal = this.target.slice(); this.auto = false; this.pointers = new Map(); this.mode = 'cutaway'; this.zoom = 1; this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; this.bind(); }
        baseRadius() { const a = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight); return Math.max(13.7, 13.0 / a); }
        frame(mode, reset = false) { this.mode = mode; const ex = mode === 'exploded'; this.zoom = 1; this.radiusGoal = this.baseRadius() * (ex ? 1.40 : 1); this.targetGoal = ex ? [0, 2.43, .03] : [0, 1.0, 0]; if (reset) {
            this.yaw = -.65;
            this.pitch = .34;
            this.auto = false;
        } }
        bind() { const c = this.canvas; c.addEventListener('contextmenu', e => e.preventDefault()); c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId); this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button }); this.auto = false; document.dispatchEvent(new Event('ferro:orbit-stopped')); }); c.addEventListener('pointermove', e => { const old = this.pointers.get(e.pointerId); if (!old)
            return; const before = [...this.pointers.values()].map(p => ({ ...p })); this.pointers.set(e.pointerId, { ...old, x: e.clientX, y: e.clientY }); if (this.pointers.size === 1) {
            if (old.button === 2 || e.shiftKey)
                this.pan(e.clientX - old.x, e.clientY - old.y);
            else {
                this.yaw -= (e.clientX - old.x) * .006;
                this.pitch = F.clamp(this.pitch + (e.clientY - old.y) * .005, -1.18, 1.40);
            }
        }
        else if (this.pointers.size === 2) {
            const after = [...this.pointers.values()], dist = p => Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y), centre = p => [(p[0].x + p[1].x) / 2, (p[0].y + p[1].y) / 2];
            this.changeZoom(dist(before) / Math.max(5, dist(after)));
            const a = centre(after), b = centre(before);
            this.pan(a[0] - b[0], a[1] - b[1]);
        } }); const end = e => { this.pointers.delete(e.pointerId); }; c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end); c.addEventListener('lostpointercapture', end); c.addEventListener('wheel', e => { e.preventDefault(); this.changeZoom(Math.exp(F.clamp(e.deltaY, -160, 160) * .0016)); }, { passive: false }); c.addEventListener('keydown', e => { const keys = { ArrowLeft: [.09, 0], ArrowRight: [-.09, 0], ArrowUp: [0, -.08], ArrowDown: [0, .08] }; if (keys[e.key]) {
            e.preventDefault();
            this.yaw += keys[e.key][0];
            this.pitch = F.clamp(this.pitch + keys[e.key][1], -1.18, 1.4);
        } }); }
        pan(dx, dy) { const scale = this.radiusGoal / Math.max(350, this.canvas.clientHeight) * .52; const right = [Math.cos(this.yaw), 0, -Math.sin(this.yaw)], up = [-Math.sin(this.yaw) * Math.sin(this.pitch), Math.cos(this.pitch), -Math.cos(this.yaw) * Math.sin(this.pitch)]; this.targetGoal = V.add(this.targetGoal, V.add(V.mul(right, -dx * scale), V.mul(up, dy * scale))); this.targetGoal = this.targetGoal.map((v, i) => F.clamp(v, i === 1 ? -2 : -4, i === 1 ? 7 : 4)); }
        changeZoom(factor) { this.radiusGoal = F.clamp(this.radiusGoal * factor, 4.5, 29); }
        update(dt) { const smooth = this.reduced ? 1 : 1 - Math.exp(-dt * 9); this.radius = F.mix(this.radius, this.radiusGoal, smooth); this.target = V.lerp(this.target, this.targetGoal, smooth); if (this.auto)
            this.yaw += dt * .12; const cp = Math.cos(this.pitch); return { eye: [this.target[0] + Math.sin(this.yaw) * cp * this.radius, this.target[1] + Math.sin(this.pitch) * this.radius, this.target[2] + Math.cos(this.yaw) * cp * this.radius], target: this.target, fov: 35 * Math.PI / 180 }; }
    }
    function toast(message) { const node = $('#toast'); node.textContent = message; node.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove('show'), 3200); }
    function fail(error) { console.error(error); $('#loading').classList.add('is-loaded'); const box = document.createElement('div'); box.className = 'error-message'; const wrap = document.createElement('div'), title = document.createElement('p'), desc = document.createElement('p'), button = document.createElement('button'); title.textContent = '3Dを開始できませんでした'; desc.textContent = error.message || String(error); button.textContent = '再読み込み'; button.style.cssText = 'border:1px solid #d6b494;padding:8px 18px;margin-top:10px'; button.addEventListener('click', () => location.reload()); wrap.append(title, desc, button); box.append(wrap); document.body.append(box); window.__ferroError = String(error); }
    function init() {
        try {
            const canvas = $('#engine-canvas'), renderer = new F.Renderer(canvas), engine = new F.Engine(renderer), audio = new F.EngineAudio(), camera = new CameraController(canvas);
            engine.reducedMotion = camera.reduced;
            const state = { mode: 'cutaway', running: !matchMedia('(prefers-reduced-motion: reduce)').matches, rpm: 1200, speed: .025, angle: 75 * Math.PI / 180, combustion: true, quality: 1, exploring: false, part: 0, ready: false, frames: 0 };
            let last = performance.now(), lastUI = 0, raf = 0, hidden = document.hidden, dialogWasRunning = false, disposed = false, lastRenderKey = '';
            const formatRPM = n => Math.round(n).toLocaleString('en-US');
            for (let i = 0; i < 4; i++) {
                const row = document.createElement('div');
                row.className = 'cylinder-row';
                row.innerHTML = `<span>0${i + 1}</span><span class="cycle-track"></span><span class="stroke-name"></span>`;
                $('#cylinder-states').append(row);
            }
            const rows = $$('.cylinder-row');
            const setRunning = running => { state.running = !!running; $('#play').setAttribute('aria-pressed', String(state.running)); $('#play').setAttribute('aria-label', state.running ? '一時停止' : '再生'); $('#play use').setAttribute('href', state.running ? '#i-pause' : '#i-play'); $('#motion-state').classList.toggle('paused', !state.running); $('#motion-state').innerHTML = '<span></span>' + (state.running ? 'MOTION ACTIVE' : 'MOTION PAUSED'); audio.update(state.rpm, state.running && !hidden); };
            function updateUI(force = false) { const now = performance.now(); if (!force && now - lastUI < 65)
                return; lastUI = now; const deg = K.wrap(state.angle) * 180 / Math.PI; $('#angle').value = String(deg); $('#angle').style.setProperty('--fill', (deg / 720 * 100) + '%'); $('#angle-value').textContent = String(Math.floor(deg)).padStart(3, '0') + '°'; for (let i = 0; i < 4; i++) {
                const s = K.cylinderAt(state.angle, i);
                rows[i].style.setProperty('--stroke-color', s.stage.color);
                rows[i].style.setProperty('--stroke-progress', (10 + s.progress * 90) + '%');
                rows[i].querySelector('.stroke-name').textContent = s.stage.name;
                rows[i].setAttribute('aria-label', `${i + 1}番シリンダー：${s.stage.ja}`);
            } }
            function setMode(mode) { engine.setMode(mode); state.mode = mode; for (const b of $$('[data-mode]')) {
                const on = b.dataset.mode === mode;
                b.classList.toggle('active', on);
                b.setAttribute('aria-pressed', String(on));
            } const data = { exterior: ['01', 'EXTERIOR VIEW'], cutaway: ['02', 'CUTAWAY VIEW'], exploded: ['03', 'EXPLODED VIEW'] }[mode]; $('#mode-number').textContent = data[0]; $('#mode-name').textContent = data[1]; camera.frame(mode); if (mode === 'exterior' && state.exploring)
                toggleExplore(false); if (mode === 'exploded')
                toast('部品を離して、組み立ての関係を観察します'); }
            function setAngle(degrees) { setRunning(false); state.angle = K.wrap(F.clamp(Number(degrees) || 0, 0, 720) * Math.PI / 180); engine.update(state.angle, .016, state.combustion); updateUI(true); }
            function setRPM(n) { state.rpm = F.clamp(Number(n) || 800, 800, 6000); $('#rpm').value = String(state.rpm); $('#rpm-value').innerHTML = formatRPM(state.rpm) + ' <small>rpm</small>'; $('#rpm-readout').textContent = formatRPM(state.rpm); $('#rpm').style.setProperty('--fill', ((state.rpm - 800) / 5200 * 100) + '%'); audio.update(state.rpm, state.running && !hidden); }
            function setSpeed(n) { state.speed = Number(n); if (![.0125, .025, .1, 1].includes(state.speed))
                state.speed = .025; $('#speed').value = String(state.speed); $('#slow-label').textContent = state.speed === 1 ? 'REAL TIME · 1× SPEED' : `SLOW MOTION · 1/${Math.round(1 / state.speed)} SPEED`; if (state.speed === 1)
                toast('実時間：動きが速いため、構造の観察には1/40がおすすめです'); }
            function selectPart(index) { state.part = K.wrap(index, PARTS.length); const p = PARTS[state.part]; $('#part-kicker').textContent = String(state.part + 1).padStart(2, '0') + ' / ' + p.kicker; $('#part-index').textContent = String(state.part + 1).padStart(2, '0'); $('#part-title').textContent = p.name; $('#part-en').textContent = p.en; $('#part-description').textContent = p.body; $('#part-fact').innerHTML = p.fact; $('#part-page').textContent = String(state.part + 1).padStart(2, '0') + ' / 05'; $$('.hotspot').forEach((b, i) => { b.classList.toggle('active', i === state.part); b.setAttribute('aria-pressed', String(i === state.part)); }); }
            function toggleExplore(on = !state.exploring) { state.exploring = on; if (on && state.mode === 'exterior')
                setMode('cutaway'); $('#observatory').classList.toggle('is-exploring', on); $('#part-panel').hidden = !on; $('#hotspots').hidden = !on; $('#explore').setAttribute('aria-expanded', String(on)); $('#intro').inert = on; $('#intro').hidden = on; if (on) {
                selectPart(state.part);
                updateHotspots();
                $('#close-part').focus({ preventScroll: true });
            }
            else
                $('#explore').focus({ preventScroll: true }); }
            PARTS.forEach((p, i) => { const b = document.createElement('button'); b.className = 'hotspot'; b.setAttribute('aria-label', p.name + 'の説明'); b.innerHTML = String(i + 1).padStart(2, '0') + '<span>' + p.en + '</span>'; b.addEventListener('click', () => selectPart(i)); $('#hotspots').append(b); });
            const hotspotButtons = $$('.hotspot');
            function updateHotspots() { if (!state.exploring)
                return; engine.anchors().forEach((p, i) => { const screen = renderer.project(p), b = hotspotButtons[i]; const shown = screen && screen[2] < 1 && screen[0] > 0 && screen[0] < canvas.clientWidth && screen[1] > 0 && screen[1] < canvas.clientHeight && !(state.mode === 'exploded' && i === 4); b.hidden = !shown; if (shown) {
                b.style.left = screen[0] + 'px';
                b.style.top = screen[1] + 'px';
            } }); }
            function setQuality(n) { state.quality = n; renderer.setQuality(n); resize(false); const names = ['軽量', '標準', '高品質'], labels = ['LOW', 'STD', 'HIGH']; $('#quality-label').textContent = labels[n]; $('#quality').title = '描画品質：' + names[n]; $('#quality').setAttribute('aria-label', '描画品質：' + names[n] + '。押すと' + names[(n + 1) % 3] + 'に変更'); toast('描画品質：' + names[n]); }
            function resize(reframe = true) { const rect = canvas.getBoundingClientRect(); renderer.resize(rect.width, rect.height); if (reframe)
                camera.frame(state.mode); }
            const observer = new ResizeObserver(() => resize());
            observer.observe($('#viewport'));
            $('#play').addEventListener('click', () => setRunning(!state.running));
            $('#rpm').addEventListener('input', e => setRPM(e.target.value));
            $('#speed').addEventListener('change', e => setSpeed(e.target.value));
            $('#angle').addEventListener('input', e => setAngle(e.target.value));
            for (const b of $$('[data-mode]'))
                b.addEventListener('click', () => setMode(b.dataset.mode));
            $('#combustion').addEventListener('click', () => { state.combustion = !state.combustion; $('#combustion').setAttribute('aria-pressed', String(state.combustion)); });
            $('#explore').addEventListener('click', () => toggleExplore());
            $('#close-part').addEventListener('click', () => toggleExplore(false));
            $('#part-next').addEventListener('click', () => selectPart(state.part + 1));
            $('#part-prev').addEventListener('click', () => selectPart(state.part - 1));
            $('#quality').addEventListener('click', () => setQuality((state.quality + 1) % 3));
            $('#orbit').addEventListener('click', () => { camera.auto = !camera.auto; $('#orbit').setAttribute('aria-pressed', String(camera.auto)); });
            document.addEventListener('ferro:orbit-stopped', () => $('#orbit').setAttribute('aria-pressed', 'false'));
            function resetView() { camera.frame(state.mode, true); $('#orbit').setAttribute('aria-pressed', 'false'); toast('視点をリセットしました'); }
            $('#reset').addEventListener('click', resetView);
            $('.brand').addEventListener('click', e => { e.preventDefault(); resetView(); });
            $('#sound').addEventListener('click', async () => { const button = $('#sound'); if (button.disabled)
                return; button.disabled = true; try {
                if (audio.enabled)
                    audio.disable();
                else {
                    audio.running = state.running && !hidden;
                    await audio.enable();
                }
                button.setAttribute('aria-pressed', String(audio.enabled));
                button.setAttribute('aria-label', audio.enabled ? 'エンジン音をオフ' : 'エンジン音をオン');
                $('#sound use').setAttribute('href', audio.enabled ? '#i-volume' : '#i-mute');
                toast(audio.enabled ? '合成エンジン音をオンにしました' + (state.running ? '' : '。再生すると音が鳴ります') : 'エンジン音をオフにしました');
            }
            catch (e) {
                toast(e.message);
            }
            finally {
                button.disabled = false;
            } });
            $('#fullscreen').addEventListener('click', async () => { try {
                if (document.fullscreenElement)
                    await document.exitFullscreen();
                else if (document.documentElement.requestFullscreen)
                    await document.documentElement.requestFullscreen();
                else
                    toast('このブラウザーでは全画面表示を利用できません');
            }
            catch {
                toast('この表示環境では全画面表示が制限されています');
            } });
            $('#help').addEventListener('click', () => { dialogWasRunning = state.running; setRunning(false); $('#about').showModal(); });
            $('#close-help').addEventListener('click', () => $('#about').close());
            $('#about').addEventListener('close', () => { setRunning(dialogWasRunning); $('#help').focus(); });
            $('#about').addEventListener('click', e => { if (e.target === $('#about')) {
                const r = e.target.getBoundingClientRect();
                if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
                    e.target.close();
            } });
            document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#about').open && state.exploring) {
                e.preventDefault();
                toggleExplore(false);
                return;
            } if ($('#about').open || e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input,select,textarea,button,a'))
                return; const k = e.key.toLowerCase(); if (e.code === 'Space') {
                e.preventDefault();
                setRunning(!state.running);
            }
            else if (k === '1')
                setMode('exterior');
            else if (k === '2')
                setMode('cutaway');
            else if (k === '3')
                setMode('exploded');
            else if (k === 'r')
                resetView();
            else if (k === 'e')
                toggleExplore();
            else if (k === 'escape' && state.exploring)
                toggleExplore(false); });
            document.addEventListener('visibilitychange', () => { hidden = document.hidden; audio.update(state.rpm, state.running && !hidden); last = performance.now(); });
            canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); setRunning(false); state.ready = false; cancelAnimationFrame(raf); toast('3Dの描画が中断されました。復帰を待っています'); });
            canvas.addEventListener('webglcontextrestored', () => location.reload());
            function frame(now) {
                if (disposed)
                    return;
                const dt = Math.min((now - last) / 1000, .1);
                last = now;
                if (!hidden) {
                    if (state.running)
                        state.angle = K.advance(state.angle, dt, state.rpm, state.speed);
                    engine.update(state.angle, dt, state.combustion);
                    const view = camera.update(Math.max(dt, .001)); // A paused exhibition does not redraw identical GPU frames. Camera and mode
                    // transitions still settle smoothly; interaction always invalidates the signature.
                    const renderKey = [state.angle, state.combustion, state.quality, engine.explosion, renderer.width, renderer.height, ...view.eye, ...view.target].map(v => typeof v === 'number' ? v.toFixed(4) : String(v)).join('|') + state.mode;
                    if (state.running || camera.auto || renderKey !== lastRenderKey) {
                        renderer.render(engine.root, view, state.angle);
                        state.frames++;
                        lastRenderKey = renderKey;
                    }
                    updateUI();
                    updateHotspots();
                    if (!state.ready) {
                        state.ready = true;
                        $('#loading').classList.add('is-loaded');
                        document.body.dataset.ready = 'true';
                    }
                }
                raf = requestAnimationFrame(frame);
            }
            resize();
            camera.frame(state.mode);
            camera.radius = camera.radiusGoal;
            setRPM(1200);
            setRunning(state.running);
            updateUI(true);
            window.ferro = { state, engine, renderer, camera, audio, setMode, setAngle, setRPM, setRunning, setSpeed, setQuality, toggleExplore, selectPart, resetView, getDiagnostics: () => ({ ready: state.ready, mode: state.mode, angle: state.angle, rpm: state.rpm, speed: state.speed, running: state.running, quality: ['LOW', 'STD', 'HIGH'][state.quality], frames: state.frames, drawCalls: renderer.stats.drawCalls, triangles: renderer.stats.triangles, parts: renderer.stats.parts, webglError: renderer.gl.getError(), audioState: audio.ctx?.state || 'not-created' }), dispose: () => { disposed = true; cancelAnimationFrame(raf); observer.disconnect(); audio.dispose(); renderer.dispose(); } };
            raf = requestAnimationFrame(frame);
        }
        catch (e) {
            fail(e);
        }
    }
    requestAnimationFrame(() => requestAnimationFrame(init));
})(globalThis.FERRO);
