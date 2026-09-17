import type { Grid } from "./engine/sudoku";
import type { Difficulty } from "./engine/difficulty";

const SAVE_KEY = "liar-sudoku-save";

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

export function loadSavedGame(): SavedGame | null {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedGame;
  } catch {
    return null;
  }
}

export function writeSavedGame(save: SavedGame): void {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
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
