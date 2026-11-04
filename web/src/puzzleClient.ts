/**
 * Asks a Web Worker for a puzzle. If workers aren't available (or fail to load,
 * e.g. an odd offline edge case), it quietly falls back to generating on the main thread,
 * so the game always works; the worker is purely a smoothness upgrade.
 */
import { generateNormalPuzzle, generatePuzzleForDifficulty, type Difficulty } from "./engine/difficulty";

type LiarResult = ReturnType<typeof generatePuzzleForDifficulty>;
type NormalResult = ReturnType<typeof generateNormalPuzzle>;

let worker: Worker | null = null;
let workerBroken = typeof Worker === "undefined";
let nextId = 1;
const pending = new Map<number, { resolve: (v: never) => void; reject: (e: unknown) => void }>();

function getWorker(): Worker | null {
  if (workerBroken) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./puzzleWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; result?: unknown; error?: string }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data.result as never);
      else p.reject(new Error(e.data.error));
    };
    worker.onerror = () => {
      // Worker failed to load/run: fail everything in flight (callers fall back) and stop using it.
      workerBroken = true;
      worker?.terminate();
      worker = null;
      pending.forEach((p) => p.reject(new Error("worker failed")));
      pending.clear();
    };
    return worker;
  } catch {
    workerBroken = true;
    return null;
  }
}

function ask<T>(kind: "liar" | "normal", difficulty: Difficulty, fallback: () => T): Promise<T> {
  const w = getWorker();
  if (!w) return new Promise((resolve) => setTimeout(() => resolve(fallback()), 30));
  return new Promise<T>((resolve) => {
    const id = nextId++;
    pending.set(id, { resolve: resolve as (v: never) => void, reject: () => setTimeout(() => resolve(fallback()), 0) });
    w.postMessage({ id, kind, difficulty });
  });
}

export const generateLiarAsync = (d: Difficulty): Promise<LiarResult> => ask("liar", d, () => generatePuzzleForDifficulty(d));
export const generateNormalAsync = (d: Difficulty): Promise<NormalResult> => ask("normal", d, () => generateNormalPuzzle(d));
