/**
 * Core Sudoku engine: grid utilities, a constraint solver that counts
 * solutions (used to prove uniqueness), a full-solution generator, and
 * a standard "givens" generator (a normal, fair, uniquely-solvable puzzle).
 *
 * Nothing "liar"-specific lives here — this file is just a solid classic
 * Sudoku engine that the liar-clue mechanic builds on top of.
 */

export type Grid = number[][];

const SIZE = 9;
const BOX = 3;

export function createEmptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => [...row]);
}

export function gridsEqual(a: Grid, b: Grid): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Legal candidate digits for an empty cell, given the current grid state. */
export function getCandidates(grid: Grid, row: number, col: number): number[] {
  const used = new Set<number>();
  for (let i = 0; i < SIZE; i++) {
    used.add(grid[row][i]);
    used.add(grid[i][col]);
  }
  const boxRow = Math.floor(row / BOX) * BOX;
  const boxCol = Math.floor(col / BOX) * BOX;
  for (let r = boxRow; r < boxRow + BOX; r++) {
    for (let c = boxCol; c < boxCol + BOX; c++) {
      used.add(grid[r][c]);
    }
  }
  const candidates: number[] = [];
  for (let n = 1; n <= 9; n++) {
    if (!used.has(n)) candidates.push(n);
  }
  return candidates;
}

interface CellChoice {
  row: number;
  col: number;
  candidates: number[];
}

/**
 * Finds the empty cell with the FEWEST legal candidates (the
 * "most constrained variable" heuristic). This makes the backtracking
 * search dramatically faster and lets us detect dead ends early.
 */
function findBestCell(grid: Grid): CellChoice | null {
  let best: CellChoice | null = null;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) {
        const candidates = getCandidates(grid, r, c);
        if (candidates.length === 0) return { row: r, col: c, candidates };
        if (!best || candidates.length < best.candidates.length) {
          best = { row: r, col: c, candidates };
          if (candidates.length === 1) return best;
        }
      }
    }
  }
  return best;
}

/**
 * Counts how many valid completions a grid has, stopping early once
 * `limit` is reached. This is the workhorse of the whole engine:
 * countSolutions(grid, 2) === 1 is how we prove a puzzle is uniquely
 * (and therefore fairly) solvable.
 *
 * Mutates and restores `grid` in place for performance; pass a clone
 * if you need the original preserved.
 */
export function countSolutions(grid: Grid, limit = 2): number {
  const cell = findBestCell(grid);
  if (!cell) return 1; // no empty cells left => a complete, valid grid
  if (cell.candidates.length === 0) return 0; // dead end, no legal digit fits

  let count = 0;
  for (const num of cell.candidates) {
    grid[cell.row][cell.col] = num;
    count += countSolutions(grid, limit);
    grid[cell.row][cell.col] = 0;
    if (count >= limit) break;
  }
  return count;
}

/** Generates a complete, randomly-filled, fully valid Sudoku grid. */
export function generateFullSolution(): Grid {
  const grid = createEmptyGrid();
  fillGrid(grid);
  return grid;
}

function fillGrid(grid: Grid): boolean {
  const cell = findBestCell(grid);
  if (!cell) return true;
  if (cell.candidates.length === 0) return false;

  for (const num of shuffle(cell.candidates)) {
    grid[cell.row][cell.col] = num;
    if (fillGrid(grid)) return true;
    grid[cell.row][cell.col] = 0;
  }
  return false;
}

/**
 * Carves a standard, fair, uniquely-solvable puzzle out of a full solution
 * by removing cells one at a time, only keeping a removal if the puzzle
 * still has exactly one solution afterward.
 */
export function generateGivens(fullGrid: Grid, targetClueCount = 30): Grid {
  const puzzle = cloneGrid(fullGrid);
  const positions = shuffle(
    Array.from({ length: SIZE * SIZE }, (_, i) => [Math.floor(i / SIZE), i % SIZE] as [number, number])
  );

  let clueCount = SIZE * SIZE;
  for (const [r, c] of positions) {
    if (clueCount <= targetClueCount) break;
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;

    const solutions = countSolutions(cloneGrid(puzzle), 2);
    if (solutions === 1) {
      clueCount--;
    } else {
      puzzle[r][c] = backup; // removing this cell broke uniqueness, put it back
    }
  }
  return puzzle;
}

export function printGrid(grid: Grid): void {
  for (let r = 0; r < SIZE; r++) {
    if (r % 3 === 0 && r !== 0) console.log("------+-------+------");
    let line = "";
    for (let c = 0; c < SIZE; c++) {
      if (c % 3 === 0 && c !== 0) line += "| ";
      line += (grid[r][c] === 0 ? "." : grid[r][c]) + " ";
    }
    console.log(line);
  }
}

export const GRID_SIZE = SIZE;