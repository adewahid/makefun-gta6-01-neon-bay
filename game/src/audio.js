// audio.js — all sound is synthesized with WebAudio; no audio files.
// Engine hum, police siren, pickup blips, punch thuds and a small
// bass-driven music loop. Created lazily on the first user gesture so the
// browser's autoplay policy is never fought; silent in headless runs.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let muted = false;
  let musicTimer = null;

  const NOTE = { C2: 65.41, E2: 82.41, G2: 98.0, A2: 110.0, B2: 123.47, D3: 146.83, E3: 164.81, G3: 196.0, A3: 220.0, C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0 };

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      startMusic();
      return true;
    } catch (err) {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // A lazy synthwave bassline: Am – F – C – G, one bar each.
  function startMusic() {
    const bass = [NOTE.A2, NOTE.A2, NOTE.A2, NOTE.A2, NOTE.E2, NOTE.E2, NOTE.E2, NOTE.E2,
      NOTE.C2, NOTE.C2, NOTE.C2, NOTE.C2, NOTE.G2, NOTE.G2, NOTE.G2, NOTE.G2,
      NOTE.A2, NOTE.A2, NOTE.A2, NOTE.A2, NOTE.E2, NOTE.E2, NOTE.E2, NOTE.E2,
      NOTE.C2, NOTE.C2, NOTE.C2, NOTE.C2, NOTE.G2, NOTE.G2, NOTE.G2, NOTE.G2];
    const arp = [NOTE.A4, NOTE.C4, NOTE.E4, NOTE.G4, NOTE.A4, NOTE.G4, NOTE.E4, NOTE.C4];
    let step = 0;
    const tick = () => {
      if (!ctx) return;
      const beat = 0.24;
      const root = bass[step % bass.length];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = root;
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + beat * 0.9);
      osc.connect(gain);
      gain.connect(musicGain);
      osc.start();
      osc.stop(ctx.currentTime + beat);
      if (step % 2 === 0) {
        const a = ctx.createOscillator();
        const ag = ctx.createGain();
        a.type = 'square';
        a.frequency.value = arp[(step / 2) % arp.length | 0];
        ag.gain.setValueAtTime(0.12, ctx.currentTime);
        ag.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + beat * 0.8);
        a.connect(ag);
        ag.connect(musicGain);
        a.start();
        a.stop(ctx.currentTime + beat);
      }
      step++;
      musicTimer = setTimeout(tick, beat * 1000);
    };
    tick();
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    // speed 0..1, on foot or driving
    setEngine(speed, driving) {
      if (!ctx || muted) return;
      engineGain.gain.setTargetAtTime(driving ? 0.05 + speed * 0.09 : 0, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + speed * 130, ctx.currentTime, 0.1);
    },
    setSiren(on) {
      if (!ctx) return;
      if (on && !sirenTimer) {
        let high = true;
        sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.2);
        sirenTimer = setInterval(() => {
          high = !high;
          sirenOsc.frequency.setTargetAtTime(high ? 950 : 650, ctx.currentTime, 0.05);
        }, 420);
      } else if (!on && sirenTimer) {
        clearInterval(sirenTimer);
        sirenTimer = null;
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      }
    },
    blip() { tone(880, 0.12, 'sine', 0.25); tone(1320, 0.1, 'sine', 0.18, 0.07); },
    cash() { tone(1046, 0.1, 'triangle', 0.3); tone(1318, 0.1, 'triangle', 0.3, 0.08); tone(1568, 0.18, 'triangle', 0.3, 0.16); },
    thud() { tone(90, 0.15, 'sine', 0.5); },
    crash() { tone(70, 0.3, 'sawtooth', 0.4); tone(50, 0.35, 'square', 0.25, 0.05); },
    sirenSting() { tone(660, 0.2, 'square', 0.2); tone(880, 0.25, 'square', 0.2, 0.18); },
    missionDone() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.3, i * 0.11));
    },
    busted() { [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.25, i * 0.16)); },
  };
}
