import type { Difficulty } from "./engine/difficulty";

const STATS_KEY = "liar-sudoku-stats";

export interface DifficultyStats {
  solved: number;
  bestTimeSeconds: number | null;
}

export interface ModeStats {
  gentle: DifficultyStats;
  sharp: DifficultyStats;
  extreme: DifficultyStats;
}

export interface Stats {
  liar: ModeStats;
  normal: ModeStats;
  totalSolved: number;
  currentStreak: number;
  longestStreak: number;
  /** Local date string (YYYY-MM-DD) of the last day at least one puzzle was solved. */
  lastSolvedDate: string | null;
}

function emptyDifficultyStats(): DifficultyStats {
  return { solved: 0, bestTimeSeconds: null };
}

function emptyModeStats(): ModeStats {
  return { gentle: emptyDifficultyStats(), sharp: emptyDifficultyStats(), extreme: emptyDifficultyStats() };
}

function emptyStats(): Stats {
  return {
    liar: emptyModeStats(),
    normal: emptyModeStats(),
    totalSolved: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastSolvedDate: null,
  };
}

export function loadStats(): Stats {
  try {
    const raw = window.localStorage.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    const parsed = JSON.parse(raw) as Partial<Stats>;
    // Merge over a fresh default so an older/partial shape never crashes a read.
    return { ...emptyStats(), ...parsed };
  } catch {
    return emptyStats();
  }
}

function saveStats(stats: Stats): void {
  try {
    window.localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // Best-effort — losing a stats write shouldn't crash the game.
  }
}

/** Local (not UTC) date string, so the streak follows the player's actual day. */
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isYesterday(dateStr: string, today: string): boolean {
  const [ty, tm, td] = today.split("-").map(Number);
  const yesterday = new Date(ty, tm - 1, td - 1);
  const expected = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(
    yesterday.getDate(),
  ).padStart(2, "0")}`;
  return dateStr === expected;
}

export interface RecordSolveResult {
  stats: Stats;
  isNewBestTime: boolean;
  streakChanged: boolean;
}

/**
 * Call once per completed puzzle. Updates the solve count and best time for
 * that mode/difficulty, and advances the daily streak — but only once per
 * calendar day, no matter how many puzzles get solved that day.
 */
export function recordSolve(mode: "liar" | "normal", difficulty: Difficulty, timeSeconds: number): RecordSolveResult {
  const stats = loadStats();
  const today = todayLocal();

  let streakChanged = false;
  if (stats.lastSolvedDate !== today) {
    stats.currentStreak = isYesterday(stats.lastSolvedDate ?? "", today) ? stats.currentStreak + 1 : 1;
    stats.longestStreak = Math.max(stats.longestStreak, stats.currentStreak);
    stats.lastSolvedDate = today;
    streakChanged = true;
  }

  const modeStats = stats[mode];
  const diffStats = modeStats[difficulty];
  diffStats.solved += 1;
  const isNewBestTime = diffStats.bestTimeSeconds === null || timeSeconds < diffStats.bestTimeSeconds;
  if (isNewBestTime) diffStats.bestTimeSeconds = timeSeconds;

  stats.totalSolved += 1;

  saveStats(stats);
  return { stats, isNewBestTime, streakChanged };
}
