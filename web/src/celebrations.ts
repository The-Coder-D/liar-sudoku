/**
 * Every celebration in here is grounded in something actually true about
 * the move — never random cheering. A "hidden single, well spotted"
 * message only fires when the move genuinely was a hidden single, found
 * without an active hint. This keeps praise meaningful instead of noisy.
 */

import type { Grid } from "./engine/sudoku";

export function pickRandom<T>(pool: T[]): T {
  return pool[Math.floor(Math.random() * pool.length)];
}

export interface CompletedUnits {
  cells: [number, number][];
  labels: string[];
}

/** Checks which of the row, column, and box containing (row, col) just became fully correct. */
export function detectCompletedUnits(grid: Grid, trueSolution: Grid, row: number, col: number): CompletedUnits {
  const cellSet = new Map<string, [number, number]>();
  const labels: string[] = [];

  let rowComplete = true;
  for (let c = 0; c < 9; c++) {
    if (grid[row][c] !== trueSolution[row][c]) {
      rowComplete = false;
      break;
    }
  }
  if (rowComplete) {
    labels.push(`row ${row + 1}`);
    for (let c = 0; c < 9; c++) cellSet.set(`${row}-${c}`, [row, c]);
  }

  let colComplete = true;
  for (let r = 0; r < 9; r++) {
    if (grid[r][col] !== trueSolution[r][col]) {
      colComplete = false;
      break;
    }
  }
  if (colComplete) {
    labels.push(`column ${col + 1}`);
    for (let r = 0; r < 9; r++) cellSet.set(`${r}-${col}`, [r, col]);
  }

  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  let boxComplete = true;
  outer: for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (grid[r][c] !== trueSolution[r][c]) {
        boxComplete = false;
        break outer;
      }
    }
  }
  if (boxComplete) {
    const boxIndex = Math.floor(row / 3) * 3 + Math.floor(col / 3) + 1;
    labels.push(`box ${boxIndex}`);
    for (let r = boxRow; r < boxRow + 3; r++) {
      for (let c = boxCol; c < boxCol + 3; c++) cellSet.set(`${r}-${c}`, [r, c]);
    }
  }

  return { cells: Array.from(cellSet.values()), labels };
}

export const UNIT_COMPLETE_PHRASES = ["nicely closed out", "locked in cleanly", "all set", "wrapped up"];

export const ACCUSE_SUCCESS_MESSAGES = [
  "Found it — that clue was the lie. The cell's cleared, fill it in like normal.",
  "Confirmed: that clue was false. On to filling the grid.",
  "That's the liar. Nicely reasoned — fill that cell in now.",
];

export const ACCUSE_SUCCESS_FIRST_TRY_MESSAGES = [
  "First try — sharp eyes. That's the lie, go ahead and fill it in.",
  "Straight to it, no wrong guesses first. That's the lie.",
  "Nailed it on the first accusation. That's the lie.",
];

export const FILL_HIDDEN_SINGLE_MESSAGES = [
  "Nice — that's a hidden single, easy to miss. Well spotted.",
  "That one hides in plain sight. Great find.",
  "Sharp — that digit only fit there once you looked closely.",
];

export const FILL_NAKED_SINGLE_MESSAGES = [
  "Good — that's the only digit that fits there.",
  "Right, that cell was fully boxed in.",
];

export const FILL_BEYOND_SINGLES_MESSAGES = [
  "That's not something naked or hidden singles alone explain — you reasoned past what this hint system can even prove. Impressive.",
  "Even the built-in logic solver can't simply justify that one. Nicely deduced.",
];

// Short, punchy variants for the floating toast — the sidebar message above
// carries the full explanation; the toast is just a quick flourish on top of it.

export const TOAST_ACCUSE_MESSAGES = ["Found it!", "That's the lie!", "Caught it!"];

export const TOAST_ACCUSE_FIRST_TRY_MESSAGES = ["First try!", "Sharp eyes!", "Nailed it, no misses!"];

export const TOAST_BEYOND_SINGLES_MESSAGES = ["Brilliant move!", "Genuinely sharp deduction!", "Impressive reasoning!"];

const TOAST_UNIT_SUFFIXES = ["complete!", "locked in!", "nailed it!"];

/** Builds a short toast line like "Row 4 & Box 2 complete!" from detectCompletedUnits' labels. */
export function toastForCompletedUnits(labels: string[]): string {
  const capitalized = labels.map((label) => label.charAt(0).toUpperCase() + label.slice(1));
  return `${capitalized.join(" & ")} ${pickRandom(TOAST_UNIT_SUFFIXES)}`;
}