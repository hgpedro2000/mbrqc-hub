let audioCtx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  try {
    if (!audioCtx) {
      const Ctor: typeof AudioContext =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      audioCtx = new Ctor();
    }
    if (audioCtx.state === "suspended") {
      void audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Loud scanner-style beep. On Android plays at maximum volume even with the
 * device on silent (uses the media channel). On iOS the physical mute switch
 * silences Web Audio — there is no web API to bypass that, so we also fire
 * the Vibration API as a reinforced tactile fallback.
 */
export function playBeep(frequency = 2400, duration = 280) {
  // Tactile reinforcement (works even when iOS mute switch silences audio).
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      (navigator as any).vibrate?.([60, 40, 120]);
    }
  } catch {}

  const ctx = ensureCtx();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const end = now + duration / 1000;

    // Master gain — pushed close to 1.0 for maximum loudness.
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.95, now + 0.01);
    master.gain.setValueAtTime(0.95, end - 0.04);
    master.gain.exponentialRampToValueAtTime(0.001, end);
    master.connect(ctx.destination);

    // Stacked oscillators (square + saw + higher harmonic) → loud, piercing,
    // scanner-like tone that cuts through ambient noise.
    const tones: Array<{ type: OscillatorType; freq: number; gain: number }> = [
      { type: "square", freq: frequency, gain: 0.6 },
      { type: "sawtooth", freq: frequency * 0.5, gain: 0.35 },
      { type: "square", freq: frequency * 2, gain: 0.25 },
    ];

    for (const t of tones) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = t.type;
      osc.frequency.value = t.freq;
      g.gain.value = t.gain;
      osc.connect(g).connect(master);
      osc.start(now);
      osc.stop(end);
    }
  } catch {
    // Silent fail — audio not critical.
  }
}

/**
 * Call once after a user gesture (login submit, button tap) to unlock the
 * AudioContext on browsers that block autoplay. After this, playBeep() works
 * without further interaction.
 */
export function primeBeep() {
  const ctx = ensureCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0.0001; // silent priming tick
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.01);
  } catch {}
}
