/* A quiet, synthesised four-cylinder soundscape. Never starts without a gesture. */
(function (F) {
    'use strict';
    class EngineAudio {
        constructor() { this.enabled = false; this.ctx = null; this.running = true; this.rpm = 1200; }
        async enable() {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext)
                throw new Error('このブラウザーはWeb Audioに対応していません。');
            if (!this.ctx) {
                const ctx = this.ctx = new AudioContext();
                this.master = ctx.createGain();
                this.master.gain.value = 0;
                const compressor = ctx.createDynamicsCompressor();
                compressor.threshold.value = -20;
                compressor.knee.value = 20;
                compressor.ratio.value = 5;
                compressor.attack.value = .015;
                compressor.release.value = .22;
                this.master.connect(compressor);
                compressor.connect(ctx.destination);
                const real = new Float32Array(33), imag = new Float32Array(33);
                for (let i = 1; i < 33; i++)
                    imag[i] = 1 / Math.pow(i, 1.2) * (i % 2 ? 1 : .7);
                this.exhaust = ctx.createOscillator();
                this.exhaust.setPeriodicWave(ctx.createPeriodicWave(real, imag));
                this.exhaust.frequency.value = 40;
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 900;
                filter.Q.value = .6;
                this.filter = filter;
                const gain = ctx.createGain();
                gain.gain.value = .38;
                this.exhaust.connect(gain);
                gain.connect(filter);
                filter.connect(this.master);
                this.exhaust.start();
                this.mechanical = ctx.createOscillator();
                this.mechanical.type = 'triangle';
                this.mechanical.frequency.value = 160;
                const mechanicalGain = ctx.createGain();
                mechanicalGain.gain.value = .025;
                this.mechanical.connect(mechanicalGain);
                mechanicalGain.connect(this.master);
                this.mechanical.start();
                const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), data = buffer.getChannelData(0);
                let seed = 74;
                for (let i = 0; i < data.length; i++) {
                    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                    data[i] = (seed / 4294967296 * 2 - 1) * .17;
                }
                this.noise = ctx.createBufferSource();
                this.noise.buffer = buffer;
                this.noise.loop = true;
                const noiseFilter = ctx.createBiquadFilter();
                noiseFilter.type = 'bandpass';
                noiseFilter.frequency.value = 630;
                noiseFilter.Q.value = .6;
                this.noise.connect(noiseFilter);
                noiseFilter.connect(this.master);
                this.noise.start();
            }
            await this.ctx.resume();
            if (this.ctx.state !== 'running')
                throw new Error('音の再生がブラウザーに制限されています。もう一度スピーカーを押してください。');
            this.enabled = true;
            this.update(this.rpm, this.running);
        }
        disable() { this.enabled = false; if (this.ctx)
            this.master.gain.setTargetAtTime(0, this.ctx.currentTime, .07); }
        update(rpm, running) { this.rpm = rpm; this.running = running; if (!this.ctx)
            return; const t = this.ctx.currentTime; this.exhaust.frequency.setTargetAtTime(rpm / 30, t, .10); this.mechanical.frequency.setTargetAtTime(rpm / 60 * 8, t, .10); this.filter.frequency.setTargetAtTime(550 + rpm * .30, t, .15); this.master.gain.setTargetAtTime(this.enabled && running ? .24 : 0, t, .06); }
        async dispose() { this.disable(); if (this.ctx && this.ctx.state !== 'closed')
            await this.ctx.close(); }
    }
    F.EngineAudio = EngineAudio;
})(globalThis.FERRO);
