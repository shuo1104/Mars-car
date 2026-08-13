/**
 * Mars Rover Web Audio API Sound Synthesizer
 * Pure Web Audio - no external audio files required!
 */
class RoverAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.engineOsc = null;
        this.engineGain = null;
        this.windGain = null;
        this.windFilter = null;
        this.laserOsc = null;
        this.laserGain = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.initialized = true;
            this.setupEngine();
            this.setupWind();
        } catch (e) {
            console.warn("Web Audio API not supported", e);
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setupEngine() {
        if (!this.ctx) return;
        // Low frequency motor rumble
        this.engineOsc = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();

        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.setValueAtTime(40, this.ctx.currentTime); // Base idle freq 40Hz

        // Lowpass filter for deep electric motor hum
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(150, this.ctx.currentTime);

        this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);

        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);

        this.engineOsc.start();
    }

    updateEngineSound(speed, isAccelerating) {
        if (!this.initialized || !this.enabled || !this.engineOsc) return;
        
        const now = this.ctx.currentTime;
        const targetFreq = 40 + Math.abs(speed) * 8; // Pitch rises with speed
        const targetGain = isAccelerating ? Math.min(0.25, 0.05 + Math.abs(speed) * 0.02) : Math.abs(speed) > 0.1 ? 0.05 : 0;

        this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.1);
        this.engineGain.gain.setTargetAtTime(targetGain, now, 0.1);
    }

    setupWind() {
        if (!this.ctx) return;
        // Pink noise generator for Mars atmospheric wind
        const bufferSize = this.ctx.sampleRate * 2;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
            output[i] *= 0.11;
            b6 = white * 0.115926;
        }

        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        this.windFilter = this.ctx.createBiquadFilter();
        this.windFilter.type = 'bandpass';
        this.windFilter.frequency.setValueAtTime(300, this.ctx.currentTime);
        this.windFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);

        this.windGain = this.ctx.createGain();
        this.windGain.gain.setValueAtTime(0.02, this.ctx.currentTime); // Low baseline ambient

        whiteNoise.connect(this.windFilter);
        this.windFilter.connect(this.windGain);
        this.windGain.connect(this.ctx.destination);

        whiteNoise.start();
    }

    setSandstormWind(isStorm) {
        if (!this.initialized || !this.windGain) return;
        const now = this.ctx.currentTime;
        const targetGain = isStorm ? 0.35 : 0.02;
        const targetFreq = isStorm ? 500 : 300;
        this.windGain.gain.setTargetAtTime(targetGain, now, 1.5);
        this.windFilter.frequency.setTargetAtTime(targetFreq, now, 1.5);
    }

    playLaserScan() {
        if (!this.initialized || !this.enabled) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1800, now + 0.15);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.15);
    }

    playSampleCollected() {
        if (!this.initialized || !this.enabled) return;
        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio

        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.08);

            gain.gain.setValueAtTime(0.2, now + idx * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.2);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + idx * 0.08);
            osc.stop(now + idx * 0.08 + 0.2);
        });
    }

    playUIClick() {
        if (!this.initialized || !this.enabled) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.04);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.04);
    }

    toggleAudio() {
        this.enabled = !this.enabled;
        if (!this.enabled && this.engineGain) {
            this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
        }
        return this.enabled;
    }
}

window.roverAudio = new RoverAudio();
