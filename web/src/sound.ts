/**
 * All sounds are synthesized in-browser with the Web Audio API — no audio
 * files to load, nothing to license, and the whole thing costs a few KB.
 *
 * Two rules keep this from being annoying:
 *  1. The AudioContext is created lazily, on the first real user gesture.
 *     Browsers block audio before that, and creating it eagerly logs console
 *     warnings on every page load.
 *  2. Everything routes through a master gain node, so muting is instant
 *     and global rather than per-sound bookkeeping.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null; // No Web Audio support — stay silent rather than crash.
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.25; // Deliberately quiet — this is background texture, not a soundtrack.
    master.connect(ctx.destination);
  }
  // Browsers suspend the context until a user gesture; resume on first real use.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setSoundMuted(value: boolean): void {
  muted = value;
  if (master && ctx) {
    master.gain.setTargetAtTime(value ? 0 : 0.25, ctx.currentTime, 0.01);
  }
}

interface ToneOptions {
  freq: number;
  duration?: number;
  type?: OscillatorType;
  /** Slide to this frequency over the tone's duration, for swoops and zaps. */
  slideTo?: number;
  gain?: number;
  delay?: number;
}

function tone({ freq, duration = 0.12, type = "sine", slideTo, gain = 1, delay = 0 }: ToneOptions): void {
  if (muted) return;
  const audio = ensureContext();
  if (!audio || !master) return;

  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const env = audio.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), start + duration);
  }

  // Quick attack, smooth exponential decay — avoids the click you get from
  // cutting a waveform off abruptly at non-zero amplitude.
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(env);
  env.connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** Plays a sequence of notes as a small arpeggio. */
function arpeggio(freqs: number[], step = 0.075, opts: Partial<ToneOptions> = {}): void {
  freqs.forEach((freq, i) => tone({ freq, duration: 0.16, type: "triangle", gain: 0.5, ...opts, delay: i * step }));
}

export const sfx = {
  /** Selecting a cell — deliberately near-subliminal, it fires constantly. */
  select: () => tone({ freq: 420, duration: 0.05, type: "sine", gain: 0.18 }),

  /** Toggling a pencil mark — quieter and higher than a real placement, so it never gets confused with one. */
  noteToggle: () => tone({ freq: 900, duration: 0.04, type: "sine", gain: 0.13 }),

  /** Placing a digit. */
  place: () => tone({ freq: 620, duration: 0.09, type: "triangle", gain: 0.34 }),

  /** Clearing a cell — same idea as place, pitched downward. */
  clear: () => tone({ freq: 380, slideTo: 260, duration: 0.1, type: "sine", gain: 0.28 }),

  /** A wrong entry or wrong accusation: low, blunt, but not punishing. */
  wrong: () => {
    tone({ freq: 190, duration: 0.16, type: "sawtooth", gain: 0.24 });
    tone({ freq: 140, duration: 0.2, type: "sine", gain: 0.3, delay: 0.05 });
  },

  /** Correctly identifying the liar clue — the game's signature moment. */
  accuseCorrect: () => arpeggio([523.25, 659.25, 783.99, 1046.5], 0.08),

  /** Completing a row, column, or box. */
  unitComplete: () => arpeggio([659.25, 830.61, 987.77], 0.06),

  /** Full solve — the big one. */
  solved: () => arpeggio([523.25, 659.25, 783.99, 1046.5, 1318.51], 0.11, { duration: 0.34, gain: 0.55 }),

  /** Requesting a hint: a soft inquisitive rise. */
  hint: () => tone({ freq: 480, slideTo: 720, duration: 0.17, type: "sine", gain: 0.26 }),

  /** UI navigation — entering a mode, opening a modal. */
  click: () => tone({ freq: 340, duration: 0.05, type: "square", gain: 0.12 }),

  /** The professor speaking: a short two-note chirp, owl-ish. */
  chirp: () => {
    tone({ freq: 880, duration: 0.07, type: "sine", gain: 0.16 });
    tone({ freq: 1170, duration: 0.07, type: "sine", gain: 0.13, delay: 0.085 });
  },
};
