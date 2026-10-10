// Answer sounds, synthesised with Web Audio so there are no audio files to
// download. The on/off switch is stored per device.

const KEY = "edme:sound";
let context = null;

export function soundEnabled() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled) {
  try {
    localStorage.setItem(KEY, enabled ? "on" : "off");
  } catch { /* private mode: the choice just lasts until reload */ }
}

function audio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  context ??= new Ctx();
  // Browsers start the context suspended until a user gesture; answering is one.
  if (context.state === "suspended") context.resume().catch(() => {});
  return context;
}

function tone(ctx, { freq, start, length, type = "sine", volume = 0.16 }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const t0 = ctx.currentTime + start;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + length + 0.02);
}

/** Bright two-note rise for a right answer, a soft low step down for a miss. */
export function playAnswerSound(correct) {
  if (!soundEnabled()) return;
  try {
    const ctx = audio();
    if (!ctx) return;
    if (correct) {
      tone(ctx, { freq: 659.25, start: 0, length: 0.14 });
      tone(ctx, { freq: 880, start: 0.09, length: 0.24 });
    } else {
      tone(ctx, { freq: 261.63, start: 0, length: 0.16, type: "triangle", volume: 0.2 });
      tone(ctx, { freq: 196, start: 0.11, length: 0.26, type: "triangle", volume: 0.2 });
    }
  } catch { /* sound is a bonus, never block an answer */ }
}
