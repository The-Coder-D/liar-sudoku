import type { Grid } from "./engine/sudoku";

/**
 * Digits that don't clash with anything already visible in the cell's row,
 * column or box. This is a plain "what fits here by the rules" check on the
 * grid exactly as the player sees it — it deliberately knows nothing about
 * the solution (or which clue is the lie), so it can't leak anything.
 */
export function getCandidates(grid: Grid, row: number, col: number): number[] {
  const used = new Set<number>();
  for (let i = 0; i < 9; i++) {
    used.add(grid[row][i]);
    used.add(grid[i][col]);
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      used.add(grid[r][c]);
    }
  }
  const result: number[] = [];
  for (let d = 1; d <= 9; d++) {
    if (!used.has(d)) result.push(d);
  }
  return result;
}

/** True on phones/tablets where the primary input is a finger, not a mouse. */
export function isCoarsePointer(): boolean {
  try {
    return window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}
