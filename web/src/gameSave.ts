import type { Grid } from "./engine/sudoku";
import type { Difficulty } from "./engine/difficulty";

const SAVE_KEY = "liar-sudoku-save";
/** Bump if the saved shape ever changes incompatibly; sanitizeSave decides what to do with older data. */
const SAVE_VERSION = 1;

interface SavedLiarGame {
  mode: "liar";
  difficulty: Difficulty;
  puzzle: Grid;
  liarRow: number;
  liarCol: number;
  trueSolution: Grid;
  userGrid: Grid;
  liarFound: boolean;
  mistakes: number;
  elapsedSeconds: number;
  savedAt: number;
  /** Optional so saves made before pencil marks existed still parse fine. */
  pencilMarks?: Record<string, number[]>;
}

interface SavedNormalGame {
  mode: "normal";
  difficulty: Difficulty;
  puzzle: Grid;
  solution: Grid;
  userGrid: Grid;
  mistakesCaught: number;
  elapsedSeconds: number;
  savedAt: number;
  pencilMarks?: Record<string, number[]>;
}

export type SavedGame = SavedLiarGame | SavedNormalGame;

const isGrid = (g: unknown): g is Grid =>
  Array.isArray(g) && g.length === 9 && g.every((r) => Array.isArray(r) && r.length === 9 && r.every((n) => Number.isInteger(n) && n >= 0 && n <= 9));
const isDifficulty = (d: unknown): d is Difficulty => d === "gentle" || d === "sharp" || d === "extreme";
const isCoord = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 8;

/** Returns the save only if it is structurally sound; anything else (corrupt, hand-edited, from an incompatible version) is dropped. */
export function sanitizeSave(input: unknown): SavedGame | null {
  if (!input || typeof input !== "object") return null;
  const s = input as Record<string, unknown>;
  if (!isDifficulty(s.difficulty) || !isGrid(s.puzzle) || !isGrid(s.userGrid)) return null;
  if (typeof s.elapsedSeconds !== "number" || !Number.isFinite(s.elapsedSeconds) || s.elapsedSeconds < 0) return null;
  if (s.mode === "liar") {
    if (!isGrid(s.trueSolution) || !isCoord(s.liarRow) || !isCoord(s.liarCol)) return null;
    if (typeof s.liarFound !== "boolean" || typeof s.mistakes !== "number") return null;
  } else if (s.mode === "normal") {
    if (!isGrid(s.solution) || typeof s.mistakesCaught !== "number") return null;
  } else {
    return null;
  }
  return input as SavedGame;
}

export function loadSavedGame(): SavedGame | null {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = sanitizeSave(JSON.parse(raw));
    if (!save) clearSavedGame(); // a broken save must never be able to crash the menu
    return save;
  } catch {
    return null;
  }
}

export function writeSavedGame(save: SavedGame): void {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ ...save, v: SAVE_VERSION }));
  } catch {
    // Best-effort — a failed autosave shouldn't interrupt play.
  }
}

export function clearSavedGame(): void {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Best-effort.
  }
}

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** A short human-readable summary for the Load Game card, e.g. "Liar Sudoku · Sharp · 4:12 in". */
export function describeSavedGame(save: SavedGame): string {
  const label = save.mode === "liar" ? "Liar Sudoku" : "Normal Sudoku";
  const difficultyLabel = save.difficulty.charAt(0).toUpperCase() + save.difficulty.slice(1);
  return `${label} · ${difficultyLabel} · ${formatElapsed(save.elapsedSeconds)} in`;
}
