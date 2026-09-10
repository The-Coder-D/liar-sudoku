/**
 * A human-style logical solver.
 *
 * `sudoku.ts`'s countSolutions() is a brute-force backtracker: great for
 * proving a puzzle is fair, useless for explaining *why* anything is true,
 * because it just tries digits and backs up on failure — nothing a person
 * would recognize as "reasoning."
 *
 * This module instead applies the two most basic human solving techniques,
 * one step at a time, and narrates each one in plain language:
 *
 *  - NAKED SINGLE   — a cell has only one legal candidate left.
 *  - HIDDEN SINGLE  — a digit has only one legal cell left within some
 *                     row, column, or box, even if that cell still shows
 *                     other candidates too.
 *
 * Critically, this same engine can be run on a puzzle that still contains
 * the (unidentified) lying clue. If pure logic — no guessing — walks the
 * board into a cell with zero legal candidates, that's a genuine, human-
 * readable proof that one of the clues used to get there must be false.
 */

import { cloneGrid, type Grid } from "./sudoku";

export type Technique = "naked-single" | "hidden-single";

export interface LogicStep {
  row: number;
  col: number;
  value: number;
  technique: Technique;
  reason: string;
}

export interface Contradiction {
  row: number;
  col: number;
  reason: string;
}

export interface PropagationResult {
  steps: LogicStep[];
  outcome: "solved" | "stuck" | "contradiction";
  contradiction?: Contradiction;
}

export function computeCandidates(grid: Grid): number[][][] {
  const candidates: number[][][] = [];
  for (let r = 0; r < 9; r++) {
    candidates[r] = [];
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] !== 0) {
        candidates[r][c] = [];
        continue;
      }
      const used = new Set<number>();
      for (let i = 0; i < 9; i++) {
        used.add(grid[r][i]);
        used.add(grid[i][c]);
      }
      const boxRow = Math.floor(r / 3) * 3;
      const boxCol = Math.floor(c / 3) * 3;
      for (let br = boxRow; br < boxRow + 3; br++) {
        for (let bc = boxCol; bc < boxCol + 3; bc++) {
          used.add(grid[br][bc]);
        }
      }
      const cellCandidates: number[] = [];
      for (let n = 1; n <= 9; n++) {
        if (!used.has(n)) cellCandidates.push(n);
      }
      candidates[r][c] = cellCandidates;
    }
  }
  return candidates;
}

interface Unit {
  label: string;
  cells: [number, number][];
}

function getUnits(): Unit[] {
  const units: Unit[] = [];
  for (let r = 0; r < 9; r++) {
    units.push({ label: `row ${r + 1}`, cells: Array.from({ length: 9 }, (_, c) => [r, c] as [number, number]) });
  }
  for (let c = 0; c < 9; c++) {
    units.push({ label: `column ${c + 1}`, cells: Array.from({ length: 9 }, (_, r) => [r, c] as [number, number]) });
  }
  for (let b = 0; b < 9; b++) {
    const boxRow = Math.floor(b / 3) * 3;
    const boxCol = (b % 3) * 3;
    const cells: [number, number][] = [];
    for (let r = boxRow; r < boxRow + 3; r++) {
      for (let c = boxCol; c < boxCol + 3; c++) cells.push([r, c]);
    }
    units.push({ label: `box ${b + 1}`, cells });
  }
  return units;
}

const UNITS = getUnits();

function findNakedSingle(grid: Grid, candidates: number[][][]): LogicStep | null {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0 && candidates[r][c].length === 1) {
        const value = candidates[r][c][0];
        return {
          row: r,
          col: c,
          value,
          technique: "naked-single",
          reason: "Every other digit is already used somewhere in this cell's row, column, or box, leaving exactly one possibility.",
        };
      }
    }
  }
  return null;
}

function findHiddenSingle(grid: Grid, candidates: number[][][]): LogicStep | null {
  for (const unit of UNITS) {
    for (let digit = 1; digit <= 9; digit++) {
      const cellsWithDigit = unit.cells.filter(([r, c]) => grid[r][c] === 0 && candidates[r][c].includes(digit));
      if (cellsWithDigit.length === 1) {
        const [row, col] = cellsWithDigit[0];
        return {
          row,
          col,
          value: digit,
          technique: "hidden-single",
          reason: `Within ${unit.label}, one particular digit only fits in this cell — every other empty cell there already rules it out.`,
        };
      }
    }
  }
  return null;
}

/**
 * Applies naked-single and hidden-single logic repeatedly, starting from
 * `startGrid`, until either the grid is solved, a hard contradiction is
 * found (some empty cell has zero legal candidates), or neither technique
 * can make further progress ("stuck" — would need deeper techniques or
 * backtracking, which this human-style solver deliberately doesn't do).
 */
export function propagateFully(startGrid: Grid, maxSteps = 200): PropagationResult {
  const grid = cloneGrid(startGrid);
  const steps: LogicStep[] = [];

  for (let i = 0; i < maxSteps; i++) {
    const candidates = computeCandidates(grid);

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] === 0 && candidates[r][c].length === 0) {
          return {
            steps,
            outcome: "contradiction",
            contradiction: {
              row: r,
              col: c,
              reason: "Every digit 1-9 is already ruled out for this cell by its row, column, and box — no value can legally go here.",
            },
          };
        }
      }
    }

    if (grid.every((row) => row.every((v) => v !== 0))) {
      return { steps, outcome: "solved" };
    }

    const step = findNakedSingle(grid, candidates) ?? findHiddenSingle(grid, candidates);
    if (!step) {
      return { steps, outcome: "stuck" };
    }

    grid[step.row][step.col] = step.value;
    steps.push(step);
  }

  return { steps, outcome: "stuck" };
}
