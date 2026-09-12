/**
 * Two very different kinds of hints, both built on the human-style solver
 * in logicSolver.ts rather than the brute-force backtracker:
 *
 *  - FILL HINTS   — always 100% safe, because they're computed from only
 *                   the verified-true given clues (the lying clue is
 *                   deliberately excluded) plus anything the player has
 *                   already correctly filled in. Never wrong, never
 *                   depends on having found the liar first.
 *
 *  - ACCUSATION HINTS — deliberately run on the puzzle AS SHOWN, lie
 *                   included, to surface the actual logical contradiction
 *                   the lie creates. This is the "why must this clue be
 *                   false" proof, revealed one step at a time.
 */

import { createEmptyGrid, getCandidates, type Grid } from "./sudoku";
import type { LiarPuzzle } from "./liarGenerator";
import { propagateFully, type Contradiction, type LogicStep } from "./logicSolver";

export interface FillHint extends LogicStep {}

/**
 * Builds a grid containing only facts actually known to be true: the
 * verified-true given clues (the lying clue excluded) plus anything the
 * player has already correctly entered. Everything else is 0 — including
 * the player's own mistakes, which are deliberately ignored rather than
 * treated as known information.
 */
export function buildReferenceGrid(puzzle: LiarPuzzle, userGrid: Grid): Grid {
  const seed = createEmptyGrid();

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const isLiarCell = r === puzzle.liarRow && c === puzzle.liarCol;
      const isTrueGiven = puzzle.puzzle[r][c] !== 0 && !isLiarCell;

      if (isTrueGiven) {
        seed[r][c] = puzzle.puzzle[r][c];
      } else if (userGrid[r][c] !== 0 && userGrid[r][c] === puzzle.trueSolution[r][c]) {
        seed[r][c] = userGrid[r][c];
      }
    }
  }

  return seed;
}

/**
 * Finds the next cell the player could safely fill in using only naked
 * and hidden singles, based on the true given clues plus anything the
 * player has already correctly entered. Returns null if no such step
 * exists yet (would need a deeper technique this solver doesn't have,
 * or genuine guessing).
 */
export function getFillHint(puzzle: LiarPuzzle, userGrid: Grid): FillHint | null {
  const result = propagateFully(buildReferenceGrid(puzzle, userGrid));
  return result.steps.length > 0 ? result.steps[0] : null;
}

export interface AccusationChain {
  steps: LogicStep[];
  contradiction: Contradiction | null;
}

/**
 * Runs the human-style solver on the puzzle exactly as shown, lie
 * included. Deterministic for a given puzzle, so it's computed once
 * and stepped through across multiple hint clicks.
 */
export function getAccusationChain(puzzle: LiarPuzzle): AccusationChain {
  const result = propagateFully(puzzle.puzzle);
  return {
    steps: result.steps,
    contradiction: result.outcome === "contradiction" ? (result.contradiction ?? null) : null,
  };
}

/**
 * Classifies whether placing `value` at (row, col) is justified by a naked
 * or hidden single on `referenceGrid` — checking that SPECIFIC move, not
 * just whether it happens to match whichever single step getFillHint's
 * scan order found first. propagateFully only ever returns one "next"
 * step, but a grid can easily have several valid singles available at
 * once; without this, a player who finds a different-but-equally-valid
 * single than the one the hint would have suggested gets no credit for
 * it at all. Returns null if the move needs something beyond these two
 * techniques to justify (which, for a correct move, means the player
 * reasoned past what this solver can explain — the best compliment this
 * engine can honestly give).
 */
export function classifyMove(referenceGrid: Grid, row: number, col: number, value: number): "naked-single" | "hidden-single" | null {
  const candidates = getCandidates(referenceGrid, row, col);
  if (!candidates.includes(value)) return null;
  if (candidates.length === 1) return "naked-single";

  if (isOnlySpotForDigit(referenceGrid, value, rowCells(row))) return "hidden-single";
  if (isOnlySpotForDigit(referenceGrid, value, colCells(col))) return "hidden-single";
  if (isOnlySpotForDigit(referenceGrid, value, boxCells(row, col))) return "hidden-single";

  return null;
}

function rowCells(row: number): [number, number][] {
  return Array.from({ length: 9 }, (_, c) => [row, c]);
}

function colCells(col: number): [number, number][] {
  return Array.from({ length: 9 }, (_, r) => [r, col]);
}

function boxCells(row: number, col: number): [number, number][] {
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  const cells: [number, number][] = [];
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) cells.push([r, c]);
  }
  return cells;
}

function isOnlySpotForDigit(grid: Grid, digit: number, cells: [number, number][]): boolean {
  let count = 0;
  for (const [r, c] of cells) {
    if (grid[r][c] === 0 && getCandidates(grid, r, c).includes(digit)) count++;
  }
  return count === 1;
}