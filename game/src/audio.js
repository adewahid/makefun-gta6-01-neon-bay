// All sound is synthesized with WebAudio: no audio files, no network.
// The context is created on the first user gesture; everything is guarded
// so the game still runs (silently) where audio is unavailable.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let musicTimer = null;
  let engineOsc = null;
  let engineGain = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch { return false; }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ctx.currentTime + dur);
    } catch { /* ignore */ }
  }

  function noise(dur, vol, low) {
    if (!ctx || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = low || 1200;
      const g = ctx.createGain();
      g.gain.value = vol || 0.25;
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
    } catch { /* ignore */ }
  }

  // A slow two-bar bass loop with a hat tick, in A minor.
  const BASS = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 58.27, 0, 65.41, 0];
  function startMusic() {
    if (!ctx || musicTimer) return;
    musicTimer = setInterval(() => {
      if (muted || !ctx) return;
      const n = BASS[musicStep % BASS.length];
      if (n) tone(n, 0.22, 'triangle', 0.16);
      if (musicStep % 2 === 0) noise(0.03, 0.05, 6000);
      musicStep++;
    }, 170);
  }

  function startEngine() {
    if (!ctx || engineOsc) return;
    try {
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 500;
      engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
    } catch { /* ignore */ }
  }

  return {
    unlock() { if (ensure()) { startMusic(); startEngine(); } },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() { return muted; },
    setEngine(speed01, on) {
      if (!ctx || !engineOsc) return;
      try {
        engineOsc.frequency.setTargetAtTime(45 + speed01 * 130, ctx.currentTime, 0.08);
        engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.05 : 0.0, ctx.currentTime, 0.1);
      } catch { /* ignore */ }
    },
    shoot() { noise(0.12, 0.3, 2400); tone(180, 0.08, 'square', 0.12, 60); },
    punch() { noise(0.08, 0.22, 900); },
    pickup() { tone(660, 0.1, 'sine', 0.2); setTimeout(() => tone(990, 0.14, 'sine', 0.2), 90); },
    crash() { noise(0.25, 0.35, 700); },
    siren() { tone(750, 0.35, 'sine', 0.07, 1050); },
    horn() { tone(370, 0.18, 'square', 0.12); tone(466, 0.18, 'square', 0.1); },
    mission() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.2), i * 110)); },
    fail() { [330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.12), i * 150)); },
    click() { tone(880, 0.05, 'square', 0.1); },
  };
}
