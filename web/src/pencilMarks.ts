/**
 * Pencil marks are candidate digits a player notes in a blank cell while
 * still deciding. Stored as Map<"row-col", Set<digit>> in memory for cheap
 * mutation; converted to a plain serializable record for save/resume,
 * since Sets don't survive JSON.stringify.
 */

export type PencilMarks = Map<string, Set<number>>;

export function clonePencilMarks(marks: PencilMarks): PencilMarks {
  const next = new Map<string, Set<number>>();
  marks.forEach((set, key) => next.set(key, new Set(set)));
  return next;
}

/**
 * Removes `digit` from every cell sharing a row, column, or box with
 * (row, col) — the same structural rule a physical pencil-and-paper solver
 * follows: once a digit is placed, no peer cell can still be a candidate
 * for it. Applied regardless of whether the placed digit is ultimately
 * correct, since the rule itself doesn't depend on that.
 */
export function clearPeerPencilMarks(marks: PencilMarks, row: number, col: number, digit: number): PencilMarks {
  const next = clonePencilMarks(marks);
  next.delete(`${row}-${col}`); // the cell just filled no longer needs its own notes

  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;

  for (let i = 0; i < 9; i++) {
    removeDigit(next, row, i, digit); // same row
    removeDigit(next, i, col, digit); // same column
  }
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      removeDigit(next, r, c, digit); // same box
    }
  }
  return next;
}

function removeDigit(marks: PencilMarks, row: number, col: number, digit: number): void {
  const key = `${row}-${col}`;
  const set = marks.get(key);
  if (!set || !set.has(digit)) return;
  const updated = new Set(set);
  updated.delete(digit);
  if (updated.size === 0) marks.delete(key);
  else marks.set(key, updated);
}

export function toggleMark(marks: PencilMarks, row: number, col: number, digit: number): PencilMarks {
  const next = clonePencilMarks(marks);
  const key = `${row}-${col}`;
  const set = new Set(next.get(key) ?? []);
  if (set.has(digit)) set.delete(digit);
  else set.add(digit);
  if (set.size === 0) next.delete(key);
  else next.set(key, set);
  return next;
}

export function serializePencilMarks(marks: PencilMarks): Record<string, number[]> {
  const record: Record<string, number[]> = {};
  marks.forEach((set, key) => {
    record[key] = Array.from(set);
  });
  return record;
}

export function deserializePencilMarks(record: Record<string, number[]> | undefined): PencilMarks {
  const marks: PencilMarks = new Map();
  if (!record) return marks;
  for (const key of Object.keys(record)) {
    marks.set(key, new Set(record[key]));
  }
  return marks;
}
