/**
 * Difficulty tiers, chosen from actual measured data (see calibrate.ts),
 * not guesswork:
 *
 *  - Below ~26 clues, generation becomes unreliable — sometimes 10+
 *    seconds, sometimes failing outright even after 30 retries. This is a
 *    real algorithmic wall (removing clues while preserving a unique
 *    solution gets rare as you approach the theoretical ~17-clue minimum
 *    for classic Sudoku), not something worth hiding behind a spinner.
 *  - At 32+ clues, every sampled puzzle fully solved via naked/hidden
 *    singles alone. Below that, roughly a third needed something this
 *    solver doesn't have — which is exactly the "genuinely hard" feeling
 *    Extreme should have.
 */

import { generateFullSolution, generateGivens, type Grid } from "./sudoku";
import { generateLiarPuzzle, type LiarPuzzle } from "./liarGenerator";

export type Difficulty = "gentle" | "sharp" | "extreme";

export interface DifficultyPreset {
  id: Difficulty;
  label: string;
  clueCount: number;
  description: string;
}

export const DIFFICULTY_PRESETS: Record<Difficulty, DifficultyPreset> = {
  gentle: {
    id: "gentle",
    label: "Gentle",
    clueCount: 36,
    description: "Plenty of clues. Good for learning the mechanic.",
  },
  sharp: {
    id: "sharp",
    label: "Sharp",
    clueCount: 30,
    description: "A real but approachable challenge.",
  },
  extreme: {
    id: "extreme",
    label: "Extreme",
    clueCount: 26,
    description: "Few clues, a deeply-buried lie, and occasional need for reasoning beyond simple singles.",
  },
};

export interface DifficultyResult {
  puzzle: LiarPuzzle;
  requested: Difficulty;
  actualClueCount: number;
  /** True if we couldn't build the requested difficulty in time and used more clues instead. */
  fellBack: boolean;
}

/**
 * Tries to generate a puzzle at the requested difficulty. If that clue
 * count can't produce a valid, fair puzzle within its retry budget (this
 * becomes likelier the fewer clues you ask for), backs off to slightly
 * more clues and tries again, rather than leaving the player staring at
 * a spinner indefinitely.
 */
export function generatePuzzleForDifficulty(difficulty: Difficulty): DifficultyResult {
  const preset = DIFFICULTY_PRESETS[difficulty];
  const maxClueCount = 40;

  for (let clueCount = preset.clueCount; clueCount <= maxClueCount; clueCount += 2) {
    try {
      const puzzle = generateLiarPuzzle(clueCount);
      return { puzzle, requested: difficulty, actualClueCount: clueCount, fellBack: clueCount !== preset.clueCount };
    } catch {
      // This clue count couldn't produce a valid puzzle in its retry budget — back off and try again.
      continue;
    }
  }

  throw new Error(
    `Could not generate a puzzle even after falling back from ${preset.clueCount} up to ${maxClueCount} clues.`,
  );
}

export interface NormalPuzzle {
  puzzle: Grid;
  solution: Grid;
}

/**
 * Classic Sudoku, same difficulty tiers as Liar Sudoku (so "Sharp" means
 * the same clue count in both modes), but no lie to inject — so unlike
 * generatePuzzleForDifficulty, this never needs a retry/fallback loop.
 * Removing clues while preserving uniqueness is the same underlying
 * operation either way, but without the extra fairness checks the liar
 * mechanic requires, it stays fast even at low clue counts.
 */
export function generateNormalPuzzle(difficulty: Difficulty): NormalPuzzle {
  const solution = generateFullSolution();
  const puzzle = generateGivens(solution, DIFFICULTY_PRESETS[difficulty].clueCount);
  return { puzzle, solution };
}
