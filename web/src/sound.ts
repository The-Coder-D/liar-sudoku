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
let volume = 1; // 0..1 user volume, multiplied into the master level

const BASE_LEVEL = 0.25; // Deliberately quiet: this is texture, not a soundtrack.
const level = () => (muted ? 0 : BASE_LEVEL * volume);

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null; // No Web Audio support — stay silent rather than crash.
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = level();
    master.connect(ctx.destination);
  }
  // Browsers suspend the context until a user gesture; resume on first real use.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function applyLevel(): void {
  if (master && ctx) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.01);
}

export function setSoundMuted(value: boolean): void {
  muted = value;
  applyLevel();
}

/** 0..1. Applies instantly and to everything, including sounds already playing. */
export function setMasterVolume(value: number): void {
  volume = Math.min(1, Math.max(0, value));
  applyLevel();
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

interface NoiseOptions {
  duration?: number;
  gain?: number;
  delay?: number;
  /** Band-pass centre; sweep it with `sweepTo` for whooshes. */
  freq?: number;
  sweepTo?: number;
  q?: number;
}

let noiseBuffer: AudioBuffer | null = null;

/** Filtered white-noise burst: whooshes, thuds, soft "paper" clicks. */
function noise({ duration = 0.15, gain = 0.3, delay = 0, freq = 1200, sweepTo, q = 0.9 }: NoiseOptions): void {
  if (muted) return;
  const audio = ensureContext();
  if (!audio || !master) return;
  if (!noiseBuffer) {
    noiseBuffer = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const start = audio.currentTime + delay;
  const src = audio.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, start);
  if (sweepTo !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.max(sweepTo, 20), start + duration);
  const env = audio.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.02, duration / 3));
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  src.connect(filter);
  filter.connect(env);
  env.connect(master);
  src.start(start);
  src.stop(start + duration + 0.02);
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

  /** Placing a digit. Pitch wobbles a little each time so rapid entry doesn't sound mechanical. */
  place: () => {
    tone({ freq: 600 + Math.random() * 60, duration: 0.09, type: "triangle", gain: 0.34 });
    noise({ duration: 0.03, gain: 0.07, freq: 2600, q: 1.5 });
  },

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

  /** Full solve: rising fanfare, a held chord, and a sparkle on top. */
  solved: () => {
    arpeggio([523.25, 659.25, 783.99, 1046.5, 1318.51], 0.11, { duration: 0.34, gain: 0.55 });
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone({ freq: f, duration: 0.9, type: "sine", gain: 0.22, delay: 0.6 }));
    [2093, 2637, 3136, 2637, 3520].forEach((f, i) => tone({ freq: f, duration: 0.12, type: "sine", gain: 0.1, delay: 0.7 + i * 0.07 }));
  },

  /** Requesting a hint: a soft inquisitive rise. */
  hint: () => tone({ freq: 480, slideTo: 720, duration: 0.17, type: "sine", gain: 0.26 }),

  /** UI navigation — entering a mode, opening a modal. */
  click: () => tone({ freq: 340, duration: 0.05, type: "square", gain: 0.12 }),

  /** Soft tap for ordinary buttons. */
  tap: () => {
    tone({ freq: 520, duration: 0.035, type: "sine", gain: 0.14 });
    noise({ duration: 0.025, gain: 0.05, freq: 3000, q: 1.2 });
  },

  /** Switching screens: a quick airy sweep. */
  whoosh: () => noise({ duration: 0.28, gain: 0.16, freq: 500, sweepTo: 2600, q: 0.7 }),

  modalOpen: () => {
    tone({ freq: 440, slideTo: 660, duration: 0.1, type: "sine", gain: 0.16 });
    noise({ duration: 0.12, gain: 0.05, freq: 900, sweepTo: 2200 });
  },
  modalClose: () => tone({ freq: 600, slideTo: 380, duration: 0.1, type: "sine", gain: 0.14 }),

  /** The professor's signature "hoo-hoo". */
  hoot: () => {
    tone({ freq: 330, slideTo: 290, duration: 0.18, type: "sine", gain: 0.3 });
    tone({ freq: 330, slideTo: 270, duration: 0.26, type: "sine", gain: 0.3, delay: 0.24 });
  },

  /** Owl dozing off: a slow downward sigh. */
  yawn: () => {
    tone({ freq: 520, slideTo: 200, duration: 0.7, type: "sine", gain: 0.16 });
    noise({ duration: 0.6, gain: 0.04, freq: 900, sweepTo: 300 });
  },

  /** Owl waking: two quick up-chirps. */
  wake: () => {
    tone({ freq: 700, slideTo: 1000, duration: 0.07, type: "sine", gain: 0.16 });
    tone({ freq: 800, slideTo: 1200, duration: 0.07, type: "sine", gain: 0.16, delay: 0.09 });
  },

  /** Twinkle: install success, new best, small rewards. */
  sparkle: () => [1568, 2093, 2637, 3136].forEach((f, i) => tone({ freq: f, duration: 0.14, type: "sine", gain: 0.12, delay: i * 0.06 })),

  /** A wrong accusation: dull thud plus the low buzz. */
  accuseWrong: () => {
    tone({ freq: 110, slideTo: 60, duration: 0.22, type: "sine", gain: 0.5 });
    noise({ duration: 0.12, gain: 0.18, freq: 220, q: 0.6 });
    tone({ freq: 170, duration: 0.18, type: "sawtooth", gain: 0.14, delay: 0.06 });
  },

  /** A personal best. */
  newBest: () => {
    arpeggio([784, 988, 1175, 1568], 0.07, { duration: 0.2, gain: 0.4 });
    tone({ freq: 2349, duration: 0.3, type: "sine", gain: 0.12, delay: 0.32 });
  },

  /** The professor speaking: a short two-note chirp, owl-ish. */
  chirp: () => {
    tone({ freq: 880, duration: 0.07, type: "sine", gain: 0.16 });
    tone({ freq: 1170, duration: 0.07, type: "sine", gain: 0.13, delay: 0.085 });
  },
};
