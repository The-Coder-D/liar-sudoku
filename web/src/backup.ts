/**
 * Back up / restore progress as a small JSON file, so stats and an in-progress game
 * can move between devices (there is no account system; everything lives in this browser).
 */
import { loadStats, sanitizeStats, saveStats } from "./stats";
import { loadSavedGame, sanitizeSave, writeSavedGame } from "./gameSave";

const FORMAT = "liar-sudoku-backup";

export function exportBackup(): void {
  const data = { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), stats: loadStats(), save: loadSavedGame() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `liar-sudoku-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Returns a human-readable result; throws nothing. Only validated data is written. */
export async function importBackup(file: File): Promise<{ ok: boolean; message: string }> {
  try {
    if (file.size > 1_000_000) return { ok: false, message: "That file is too large to be a Liar Sudoku backup." };
    const data = JSON.parse(await file.text()) as Record<string, unknown>;
    if (!data || data.format !== FORMAT) return { ok: false, message: "That isn't a Liar Sudoku backup file." };
    saveStats(sanitizeStats(data.stats));
    const save = sanitizeSave(data.save);
    if (save) writeSavedGame(save);
    return { ok: true, message: save ? "Restored your stats and saved game." : "Restored your stats." };
  } catch {
    return { ok: false, message: "Couldn't read that file." };
  }
}
