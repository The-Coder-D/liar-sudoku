import { countSolutions, cloneGrid } from "./sudoku";
import { generateLiarPuzzle } from "./liarGenerator";

const RUNS = 15;
let totalTime = 0;

for (let i = 0; i < RUNS; i++) {
  const start = Date.now();
  const result = generateLiarPuzzle(30);
  const elapsed = Date.now() - start;
  totalTime += elapsed;

  // Independently re-verify all fairness conditions from scratch, not trusting the generator's own checks.
  const provable = countSolutions(cloneGrid(result.puzzle), 2) === 0;

  const fixed = cloneGrid(result.puzzle);
  fixed[result.liarRow][result.liarCol] = 0;
  const resolvedCount = countSolutions(cloneGrid(fixed), 2);
  const resolvable = resolvedCount === 1;

  console.log(
    `Run ${i + 1}: ${elapsed}ms | provable=${provable} | resolvable=${resolvable} (solutions=${resolvedCount})`
  );

  if (!provable || !resolvable) {
    console.error("  FAILURE - a fairness condition was violated!");
    process.exit(1);
  }
}

console.log(`\nAll ${RUNS} runs passed. Average generation time: ${(totalTime / RUNS).toFixed(1)}ms`);
