import { printGrid } from "./sudoku";
import { generateLiarPuzzle } from "./liarGenerator";

console.log("Generating a liar puzzle... (this proves the lie is real before showing it to you)\n");

const start = Date.now();
const result = generateLiarPuzzle(30);
const elapsed = Date.now() - start;

console.log(`Puzzle (one clue below is a lie) — generated in ${elapsed}ms:\n`);
printGrid(result.puzzle);

console.log(
  `\n[dev only] The liar clue is at row ${result.liarRow + 1}, column ${result.liarCol + 1}: ` +
    `shows ${result.puzzle[result.liarRow][result.liarCol]}, should be ${
      result.trueSolution[result.liarRow][result.liarCol]
    }`
);

console.log("\nTrue solution:\n");
printGrid(result.trueSolution);
