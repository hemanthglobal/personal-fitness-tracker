/* Tiny timer cues: synthesized beeps (no audio files) + vibration where supported. */

let ctx: AudioContext | null = null;

/** Call from a tap handler: browsers only allow audio after a user gesture. */
export function unlockAudio() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq: number, ms: number, when = 0, volume = 0.18) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + ms / 1000 + 0.02);
}

const vibrate = (pattern: number | number[]) => {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
};

export const cue = {
  /** Last 3 seconds of a phase. */
  tick: (sound: boolean) => { if (sound) tone(660, 90); },
  /** Work phase starts. */
  go: (sound: boolean) => { if (sound) tone(990, 260); vibrate(180); },
  /** Session finished. */
  done: (sound: boolean) => { if (sound) { tone(784, 180); tone(988, 180, 0.2); tone(1318, 320, 0.4); } vibrate([120, 80, 120]); },
};
