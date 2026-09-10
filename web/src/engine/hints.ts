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

import { createEmptyGrid, type Grid } from "./sudoku";
import type { LiarPuzzle } from "./liarGenerator";
import { propagateFully, type Contradiction, type LogicStep } from "./logicSolver";

export interface FillHint extends LogicStep {}

/**
 * Finds the next cell the player could safely fill in using only naked
 * and hidden singles, based on the true given clues plus anything the
 * player has already correctly entered. Returns null if no such step
 * exists yet (would need a deeper technique this solver doesn't have,
 * or genuine guessing).
 */
export function getFillHint(puzzle: LiarPuzzle, userGrid: Grid): FillHint | null {
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

  const result = propagateFully(seed);
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
