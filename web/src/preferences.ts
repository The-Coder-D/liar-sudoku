import type { Difficulty } from "./engine/difficulty";
import { setMasterVolume, setSoundMuted } from "./sound";
import { setHapticsOn } from "./haptics";

const DEFAULT_DIFFICULTY_KEY = "liar-sudoku-default-difficulty";
const REDUCE_MOTION_KEY = "liar-sudoku-reduce-motion";
const SOUND_KEY = "liar-sudoku-sound";
const VOLUME_KEY = "liar-sudoku-volume";
const HAPTICS_KEY = "liar-sudoku-haptics";

export function getDefaultDifficulty(): Difficulty {
  try {
    const stored = window.localStorage.getItem(DEFAULT_DIFFICULTY_KEY);
    if (stored === "gentle" || stored === "sharp" || stored === "extreme") return stored;
  } catch {
    // Private browsing or blocked storage — fall through to the default.
  }
  return "sharp";
}

export function setDefaultDifficulty(difficulty: Difficulty): void {
  try {
    window.localStorage.setItem(DEFAULT_DIFFICULTY_KEY, difficulty);
  } catch {
    // Best-effort: the setting still applies for this session.
  }
}

/**
 * Reduce motion is OFF by default — animation is a core part of how this
 * game feels. It stays available because motion sensitivity (vestibular
 * disorders, migraine triggers) is a real accessibility need, not a
 * nice-to-have. The OS-level `prefers-reduced-motion` setting is honored
 * separately in index.css and can't be overridden from here.
 */
export function getReduceMotion(): boolean {
  try {
    return window.localStorage.getItem(REDUCE_MOTION_KEY) === "1";
  } catch {
    return false;
  }
}

export function setReduceMotion(enabled: boolean): void {
  try {
    window.localStorage.setItem(REDUCE_MOTION_KEY, enabled ? "1" : "0");
  } catch {
    // Best-effort.
  }
  document.body.classList.toggle("reduced-motion-pref", enabled);
}

export function getSoundEnabled(): boolean {
  try {
    // Sound is ON unless explicitly disabled.
    return window.localStorage.getItem(SOUND_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(SOUND_KEY, enabled ? "1" : "0");
  } catch {
    // Best-effort.
  }
  setSoundMuted(!enabled);
}

export function getSoundVolume(): number {
  try {
    const raw = window.localStorage.getItem(VOLUME_KEY);
    if (raw !== null) {
      const n = Number(raw);
      if (Number.isFinite(n)) return Math.min(1, Math.max(0, n));
    }
  } catch {
    // fall through
  }
  return 0.8;
}

export function setSoundVolume(value: number): void {
  try {
    window.localStorage.setItem(VOLUME_KEY, String(value));
  } catch {
    // Best-effort.
  }
  setMasterVolume(value);
}

export function getHapticsEnabled(): boolean {
  try {
    return window.localStorage.getItem(HAPTICS_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setHapticsEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(HAPTICS_KEY, enabled ? "1" : "0");
  } catch {
    // Best-effort.
  }
  setHapticsOn(enabled);
}

/** Call once on app startup so runtime state matches stored preferences immediately. */
export function applyStoredPreferences(): void {
  document.body.classList.toggle("reduced-motion-pref", getReduceMotion());
  setSoundMuted(!getSoundEnabled());
  setMasterVolume(getSoundVolume());
  setHapticsOn(getHapticsEnabled());
}
