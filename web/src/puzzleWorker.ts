/// <reference lib="webworker" />
// Runs puzzle generation off the main thread so the UI (and the owl) never freeze.
import { generateNormalPuzzle, generatePuzzleForDifficulty, type Difficulty } from "./engine/difficulty";

export type PuzzleRequest = { id: number; kind: "liar" | "normal"; difficulty: Difficulty };

self.onmessage = (e: MessageEvent<PuzzleRequest>) => {
  const { id, kind, difficulty } = e.data;
  try {
    const result = kind === "liar" ? generatePuzzleForDifficulty(difficulty) : generateNormalPuzzle(difficulty);
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err) });
  }
};
