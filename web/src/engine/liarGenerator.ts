/**
 * The novel mechanic: exactly one of the given clues is a lie.
 *
 * A valid "liar puzzle" must satisfy three things, or it's not fair to a player:
 *
 *  1. PROVABLE   — treating every given clue (including the fake one) as true
 *                  must be globally impossible (zero valid completions).
 *                  That's what lets a player *prove* a lie exists, rather
 *                  than just suspect one.
 *
 *  2. UNAMBIGUOUS — no OTHER single clue could be blamed instead. If removing
 *                  a different clue would also make everything consistent,
 *                  the puzzle has more than one "correct" accusation, which
 *                  isn't a fair puzzle — it's a guess.
 *
 *  3. RESOLVABLE  — once the true liar clue is identified and discarded, the
 *                  remaining clues must lead back to exactly one valid,
 *                  correct solution.
 *
 * We never take a shortcut here: every candidate liar-puzzle is checked
 * against all three conditions before it's accepted.
 */

import { cloneGrid, countSolutions, generateFullSolution, generateGivens, type Grid } from "./sudoku";

/**
 * Digits already visible in this cell's row, column, or box among the
 * OTHER given clues. A fake value drawn from this set would create an
 * instantly-spottable duplicate (two identical givens sharing a unit) —
 * a "lie" a player could catch in two seconds without any real logic.
 * We deliberately avoid ever generating that.
 */
function visibleNeighborDigits(givens: Grid, row: number, col: number): Set<number> {
  const used = new Set<number>();
  for (let i = 0; i < 9; i++) {
    if (i !== col && givens[row][i] !== 0) used.add(givens[row][i]);
    if (i !== row && givens[i][col] !== 0) used.add(givens[i][col]);
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if ((r !== row || c !== col) && givens[r][c] !== 0) used.add(givens[r][c]);
    }
  }
  return used;
}

export interface LiarPuzzle {
  /** The puzzle as shown to the player: given clues, one of which is false. */
  puzzle: Grid;
  liarRow: number;
  liarCol: number;
  /** The correct, fully-solved grid (never shown to the player up front). */
  trueSolution: Grid;
}

/**
 * Attempts to turn a fair, uniquely-solvable set of givens into a liar
 * puzzle by corrupting exactly one clue. Returns null if no corruption
 * of any given clue satisfies all three fairness conditions above —
 * the caller should generate a fresh base puzzle and try again.
 */
export function injectLiarClue(fullGrid: Grid, givens: Grid): LiarPuzzle | null {
  const givenCells: [number, number][] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (givens[r][c] !== 0) givenCells.push([r, c]);
    }
  }

  for (const [r, c] of shuffle(givenCells)) {
    const trueValue = fullGrid[r][c];
    const neighborDigits = visibleNeighborDigits(givens, r, c);
    const wrongValues = shuffle(
      [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => n !== trueValue && !neighborDigits.has(n)),
    );

    for (const fakeValue of wrongValues) {
      const candidate = cloneGrid(givens);
      candidate[r][c] = fakeValue;

      // Condition 1: PROVABLE — the full given set (with the lie) must be impossible.
      if (countSolutions(cloneGrid(candidate), 2) !== 0) continue;

      // Condition 3: RESOLVABLE — check this BEFORE the expensive condition 2 below.
      // At low clue counts most candidate cells fail this (removing them breaks
      // uniqueness entirely, lie or no lie), so checking the cheap single-solve
      // condition first avoids paying for condition 2's ~N solves on candidates
      // that were always going to be rejected anyway.
      const withLiarRemoved = cloneGrid(candidate);
      withLiarRemoved[r][c] = 0;
      if (countSolutions(cloneGrid(withLiarRemoved), 2) !== 1) continue;

      // Condition 2: UNAMBIGUOUS — no other clue's removal should also fix it.
      const onlyThisClueExplainsIt = givenCells.every(([gr, gc]) => {
        if (gr === r && gc === c) return true; // already checked above as condition 3
        const trial = cloneGrid(candidate);
        trial[gr][gc] = 0;
        return countSolutions(trial, 2) === 0; // still broken without this cell → good
      });
      if (!onlyThisClueExplainsIt) continue;

      return { puzzle: candidate, liarRow: r, liarCol: c, trueSolution: fullGrid };
    }
  }

  return null;
}

/**
 * Full pipeline: generate a full solution, carve a fair puzzle out of it,
 * then try to inject a provable, unambiguous lie. Retries with a fresh
 * base puzzle if a given attempt can't produce a valid liar placement.
 */
export function generateLiarPuzzle(clueCount = 30, maxRetries = 30): LiarPuzzle {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const full = generateFullSolution();
    const givens = generateGivens(full, clueCount);
    const result = injectLiarClue(full, givens);
    if (result) return result;
  }
  throw new Error(
    `Couldn't generate a valid liar puzzle after ${maxRetries} attempts at clueCount=${clueCount}. ` +
      `Try a higher clue count (more givens make a provable, unambiguous lie easier to construct).`
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
