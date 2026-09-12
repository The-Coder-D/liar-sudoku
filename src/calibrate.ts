/**
 * Measures how two real difficulty signals scale with clue count, so
 * difficulty tiers can be based on actual data instead of a guess:
 *
 *  - accusation chain length: how many forced logical steps it takes to
 *    walk the lie into a contradiction (longer = the lie is buried deeper,
 *    harder to catch)
 *  - fill outcome: after the lie is removed, does naked/hidden-single logic
 *    alone fully solve the rest, or does it get stuck needing something
 *    this solver doesn't have (a proxy for how much of the grid rewards
 *    genuine deduction over simple pattern-spotting)
 */

import { cloneGrid } from "./sudoku";
import { generateLiarPuzzle } from "./liarGenerator";
import { propagateFully } from "./logicSolver";

const CLUE_COUNTS = [26, 28, 30, 32, 34, 36];
const RUNS_PER_COUNT = 6;

for (const clueCount of CLUE_COUNTS) {
  let totalChainLength = 0;
  let contradictionsFound = 0;
  let fillSolved = 0;
  let fillStuck = 0;
  let totalFillSteps = 0;
  let generationFailures = 0;
  const start = Date.now();

  for (let i = 0; i < RUNS_PER_COUNT; i++) {
    let puzzle;
    try {
      puzzle = generateLiarPuzzle(clueCount);
    } catch {
      generationFailures++;
      continue;
    }

    const withLie = propagateFully(cloneGrid(puzzle.puzzle));
    if (withLie.outcome === "contradiction") {
      contradictionsFound++;
      totalChainLength += withLie.steps.length;
    }

    const fixed = cloneGrid(puzzle.puzzle);
    fixed[puzzle.liarRow][puzzle.liarCol] = 0;
    const afterFix = propagateFully(fixed);
    if (afterFix.outcome === "solved") {
      fillSolved++;
      totalFillSteps += afterFix.steps.length;
    } else {
      fillStuck++;
    }
  }

  const elapsed = Date.now() - start;
  const avgChain = contradictionsFound > 0 ? (totalChainLength / contradictionsFound).toFixed(1) : "n/a";
  const avgFillSteps = fillSolved > 0 ? (totalFillSteps / fillSolved).toFixed(1) : "n/a";

  console.log(
    `clues=${clueCount}: avg chain=${avgChain} steps | contradiction ${contradictionsFound}/${RUNS_PER_COUNT} | ` +
      `fill solved ${fillSolved}/${RUNS_PER_COUNT} (avg ${avgFillSteps} steps) | ` +
      `failures=${generationFailures} | ${elapsed}ms total`,
  );
}
