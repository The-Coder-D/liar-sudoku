/**
 * Undo/redo for the player's own entries (digits and pencil marks).
 *
 * It watches the (userGrid, pencilMarks) pair: any change that didn't come from undo/redo
 * itself pushes the previous state onto the undo stack. A new puzzle (resetKey changes) wipes both stacks.
 * Hints, accusations and the clock are deliberately NOT undoable.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { clonePencilMarks, type PencilMarks } from "./pencilMarks";
import type { Grid } from "./engine/sudoku";

interface Snapshot {
  grid: Grid;
  marks: PencilMarks;
}

const LIMIT = 300;

export function useUndoRedo(
  userGrid: Grid | null,
  pencilMarks: PencilMarks,
  setUserGrid: (g: Grid) => void,
  setPencilMarks: (m: PencilMarks) => void,
  resetKey: unknown,
  enabled: boolean,
) {
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const current = useRef<Snapshot | null>(null);
  const applying = useRef(false);
  const [, bump] = useState(0);

  useEffect(() => {
    past.current = [];
    future.current = [];
    current.current = null;
    bump((n) => n + 1);
  }, [resetKey]);

  useEffect(() => {
    if (!userGrid) return;
    const next: Snapshot = { grid: userGrid, marks: pencilMarks };
    if (applying.current) {
      applying.current = false;
    } else if (current.current && (current.current.grid !== userGrid || current.current.marks !== pencilMarks)) {
      past.current.push(current.current);
      if (past.current.length > LIMIT) past.current.shift();
      future.current = [];
      bump((n) => n + 1);
    }
    current.current = next;
  }, [userGrid, pencilMarks]);

  const restore = useCallback(
    (snap: Snapshot) => {
      applying.current = true;
      setUserGrid(snap.grid.map((row) => [...row]) as Grid);
      setPencilMarks(clonePencilMarks(snap.marks));
    },
    [setUserGrid, setPencilMarks],
  );

  const undo = useCallback(() => {
    if (!enabled || !current.current) return false;
    const prev = past.current.pop();
    if (!prev) return false;
    future.current.push(current.current);
    restore(prev);
    bump((n) => n + 1);
    return true;
  }, [enabled, restore]);

  const redo = useCallback(() => {
    if (!enabled || !current.current) return false;
    const nxt = future.current.pop();
    if (!nxt) return false;
    past.current.push(current.current);
    restore(nxt);
    bump((n) => n + 1);
    return true;
  }, [enabled, restore]);

  // Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z or Ctrl+Y = redo.
  const handlers = useRef({ undo, redo });
  handlers.current = { undo, redo };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        handlers.current.undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        handlers.current.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return { undo, redo, canUndo: enabled && past.current.length > 0, canRedo: enabled && future.current.length > 0 };
}
