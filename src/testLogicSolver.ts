import { cloneGrid } from "./sudoku";
import { generateLiarPuzzle } from "./liarGenerator";
import { propagateFully } from "./logicSolver";

const RUNS = 20;
let contradictionFound = 0;
let stuckOnLie = 0;
let solvedAfterFix = 0;
let stuckAfterFix = 0;

for (let i = 0; i < RUNS; i++) {
  const puzzle = generateLiarPuzzle(30);

  // Case A: propagate on the puzzle AS SHOWN (lie included) — can pure logic find the contradiction?
  const withLie = propagateFully(cloneGrid(puzzle.puzzle));
  if (withLie.outcome === "contradiction") {
    contradictionFound++;
  } else {
    stuckOnLie++;
    console.log(`Run ${i + 1}: with-lie outcome = ${withLie.outcome} (no explainable contradiction found)`);
  }

  // Case B: propagate on the TRUE givens (liar cell blanked) — can pure logic fully solve it?
  const fixed = cloneGrid(puzzle.puzzle);
  fixed[puzzle.liarRow][puzzle.liarCol] = 0;
  const afterFix = propagateFully(fixed);
  if (afterFix.outcome === "solved") {
    solvedAfterFix++;
  } else {
    stuckAfterFix++;
    console.log(`Run ${i + 1}: after-fix outcome = ${afterFix.outcome} (needs deeper technique or guessing)`);
  }
}

console.log(`\nWith lie included: ${contradictionFound}/${RUNS} reached an explainable contradiction, ${stuckOnLie} got stuck.`);
console.log(`After removing the lie: ${solvedAfterFix}/${RUNS} fully solved by singles alone, ${stuckAfterFix} got stuck.`);
