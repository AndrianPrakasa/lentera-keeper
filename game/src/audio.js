// Sound only: every effect is synthesised with WebAudio oscillators, so the
// game ships no audio files and makes no network request. The context is
// created on the first user gesture (browsers require one); until then every
// call is a silent no-op, which is also how headless screenshot runs behave.
export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return context;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      context = new AC();
      master = context.createGain();
      master.gain.value = 0.22;
      master.connect(context.destination);
    } catch {
      context = null;
    }
    return context;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    } catch {
      // A sound that fails to play must never break the game.
    }
  }

  function noise(dur, vol) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    try {
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = vol;
      src.buffer = buffer;
      src.connect(gain);
      gain.connect(master);
      src.start();
    } catch {
      // Silent is fine.
    }
  }

  return {
    unlock() {
      ensure();
    },
    setMuted(value) {
      muted = value;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      tone(720, 0.07, 'square', 0.16, 380);
    },
    hit() {
      noise(0.09, 0.25);
      tone(220, 0.08, 'triangle', 0.2, 110);
    },
    shard() {
      tone(880, 0.06, 'sine', 0.16);
      tone(1320, 0.09, 'sine', 0.12);
    },
    pickup() {
      tone(523, 0.09, 'sine', 0.2);
      tone(784, 0.12, 'sine', 0.2);
    },
    hurt() {
      tone(160, 0.25, 'sawtooth', 0.25, 60);
      noise(0.15, 0.2);
    },
    waveClear() {
      [523, 659, 784, 1047].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.14, 'triangle', 0.2), i * 90);
      });
    },
    boss() {
      tone(98, 0.5, 'sawtooth', 0.25, 49);
      tone(147, 0.5, 'sawtooth', 0.18, 73);
    },
    victory() {
      [523, 659, 784, 1047, 1319].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.2, 'triangle', 0.22), i * 110);
      });
    },
    gameOver() {
      [392, 330, 262, 196].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.22, 'triangle', 0.2), i * 160);
      });
    },
    click() {
      tone(660, 0.05, 'sine', 0.14);
    },
  };
}
