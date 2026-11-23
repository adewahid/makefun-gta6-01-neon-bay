// Solmar Bay — all sound is synthesised with WebAudio: no audio files.
// Engine hum, sirens, gunshots, pickups, jingles and a laid-back bassline
// that keeps time with the in-game clock.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine: two detuned saws through a lowpass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 55.7;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filt); engineOsc2.connect(filt);
      filt.connect(engineGain); engineGain.connect(master);
      engineOsc.start(); engineOsc2.start();
      engineOsc._f2 = engineOsc2;
      startMusic();
    } catch (e) { ctx = null; return false; }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq || 1200;
    const g = ctx.createGain();
    g.gain.value = vol || 0.25;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  // A slow, sunny bassline: Am – F – C – G roots with a soft pluck.
  const BASS = [55, 43.65, 65.41, 49];
  function startMusic() {
    if (musicTimer) return;
    musicTimer = setInterval(() => {
      if (!ctx || muted) return;
      const bar = Math.floor(musicStep / 4) % 4;
      const root = BASS[bar];
      if (musicStep % 4 === 0) tone(root, 0.9, 'triangle', 0.16);
      if (musicStep % 2 === 1) tone(root * 2, 0.16, 'triangle', 0.05);
      if (musicStep % 8 === 6) tone(root * 1.5, 0.3, 'sine', 0.07);
      musicStep++;
    }, 300);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    setEngine(running, speedRatio) {
      if (!ctx || muted) { if (engineGain) engineGain.gain.value = 0; return; }
      if (engineGain) engineGain.gain.value = running ? 0.05 + speedRatio * 0.05 : 0;
      if (engineOsc) {
        engineOsc.frequency.value = 48 + speedRatio * 130;
        engineOsc._f2.frequency.value = 48.7 + speedRatio * 132;
      }
    },
    siren(on) {
      if (!ctx || muted) return;
      // Two-tone siren handled by the caller pulsing this each frame is too
      // chatty; instead play a short wail blip the police module schedules.
      tone(on ? 880 : 660, 0.28, 'sine', 0.045, on ? 660 : 880);
    },
    shot() { noise(0.12, 0.3, 2400); tone(180, 0.08, 'square', 0.12, 60); },
    punch() { noise(0.08, 0.2, 700); },
    pickup() { tone(660, 0.09, 'sine', 0.14); setTimeout(() => tone(990, 0.14, 'sine', 0.14), 80); },
    cash() { tone(880, 0.08, 'triangle', 0.15); setTimeout(() => tone(1174, 0.1, 'triangle', 0.15), 70); setTimeout(() => tone(1568, 0.16, 'triangle', 0.15), 140); },
    crash() { noise(0.3, 0.35, 500); tone(90, 0.25, 'sawtooth', 0.15, 40); },
    explosion() { noise(0.7, 0.5, 300); tone(60, 0.6, 'sine', 0.3, 28); },
    busted() { tone(392, 0.2, 'square', 0.12); setTimeout(() => tone(311, 0.3, 'square', 0.12), 180); },
    missionDone() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.16), i * 110));
    },
    missionFail() {
      [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sawtooth', 0.1), i * 130));
    },
    click() { tone(1200, 0.04, 'square', 0.06); },
  };
}
