/**
 * A tiny event channel between the games and the professor.
 *
 * The games already tell the professor what to SAY (professorSay). This is
 * for the quieter stuff: "the player just selected a cell", "a digit was
 * placed", "a hint was asked for". The professor turns those into glances,
 * nods, a sleepy yawn, or a nudge when you've been staring at one cell for
 * a while — without the games needing to know any of that.
 *
 * IMPORTANT: never emit anything that reveals whether an entry is right.
 * In Liar Sudoku the honest way to find out is "Check my entries", so a
 * wince on a wrong digit would quietly give the answer away. Placement
 * events carry no correctness information on purpose.
 */

export type OwlEvent =
  | { type: "select"; row: number; col: number }
  | { type: "place" }
  | { type: "note" }
  | { type: "clear" }
  | { type: "hint" }
  | { type: "solved" }
  // Moments the game has already made public (a correct accusation, a finished row/column/box,
  // a wrong accusation). The background reacts to these; none of them leak anything new.
  | { type: "cheer" }
  | { type: "flinch" };

type Listener = (event: OwlEvent) => void;

const listeners = new Set<Listener>();

export function emitOwl(event: OwlEvent): void {
  listeners.forEach((listener) => listener(event));
}

export function onOwl(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
