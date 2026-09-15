import type { Difficulty } from "./engine/difficulty";
import { setSoundMuted } from "./sound";

const DEFAULT_DIFFICULTY_KEY = "liar-sudoku-default-difficulty";
const REDUCE_MOTION_KEY = "liar-sudoku-reduce-motion";
const SOUND_KEY = "liar-sudoku-sound";

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

/** Call once on app startup so runtime state matches stored preferences immediately. */
export function applyStoredPreferences(): void {
  document.body.classList.toggle("reduced-motion-pref", getReduceMotion());
  setSoundMuted(!getSoundEnabled());
}
