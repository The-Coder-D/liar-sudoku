import type { Grid } from "../engine/sudoku";

export interface CellCoord {
  row: number;
  col: number;
}

export type Mode = "fill" | "accuse";

interface SudokuGridProps {
  /** The puzzle as given, including the (undetected) liar clue. 0 = blank. */
  puzzle: Grid;
  /** The player's current board state. */
  userGrid: Grid;
  /** Set once the player correctly identifies the liar clue; null until then. */
  liarCell: CellCoord | null;
  selected: CellCoord | null;
  mode: Mode;
  /** Cells flagged incorrect by the "Check" action, keyed "row-col". */
  wrongCells: Set<string>;
  /** Cell that was just wrongly accused, for a brief shake animation. */
  accuseWrongCell: CellCoord | null;
  /** Cells currently playing the "unit completed" pulse, mapped to a stagger delay in ms. */
  celebratingCells: Map<string, number>;
  onCellClick: (row: number, col: number) => void;
}

export function SudokuGrid({
  puzzle,
  userGrid,
  liarCell,
  selected,
  mode,
  wrongCells,
  accuseWrongCell,
  celebratingCells,
  onCellClick,
}: SudokuGridProps) {
  return (
    <div
      className={celebratingCells.size > 0 ? "sudoku-grid celebrating" : "sudoku-grid"}
      role="grid"
      aria-label="Sudoku puzzle, one given clue is false"
    >
      {userGrid.map((row, r) =>
        row.map((value, c) => {
          const isGiven = puzzle[r][c] !== 0;
          const isLiarResolved = liarCell !== null && liarCell.row === r && liarCell.col === c;
          const isUserEntry = !isGiven && value !== 0;
          const isSelected = selected !== null && selected.row === r && selected.col === c;
          const isWrong = wrongCells.has(`${r}-${c}`);
          const isShaking = accuseWrongCell !== null && accuseWrongCell.row === r && accuseWrongCell.col === c;
          const isAccusable = mode === "accuse" && isGiven && liarCell === null;
          const isFillable = mode === "fill" && value === 0 && (!isGiven || isLiarResolved);
          const celebrateDelay = celebratingCells.get(`${r}-${c}`);
          const isCelebrating = celebrateDelay !== undefined;

          const classes = [
            "cell",
            (c + 1) % 3 === 0 && c !== 8 ? "border-right-strong" : "",
            (r + 1) % 3 === 0 && r !== 8 ? "border-bottom-strong" : "",
            isGiven ? "cell-given" : "",
            isUserEntry ? "cell-user" : "",
            isSelected ? "cell-selected" : "",
            isWrong ? "cell-wrong" : "",
            isShaking ? "cell-shake" : "",
            isAccusable ? "cell-accusable" : "",
            isFillable ? "cell-fillable" : "",
            isLiarResolved ? "cell-liar-resolved" : "",
            isCelebrating ? "cell-celebrate" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={`${r}-${c}`}
              type="button"
              className={classes}
              style={isCelebrating ? { animationDelay: `${celebrateDelay}ms` } : undefined}
              onClick={() => onCellClick(r, c)}
              aria-label={`Row ${r + 1}, column ${c + 1}${value !== 0 ? `, ${value}` : ", empty"}`}
            >
              {value !== 0 ? value : ""}
            </button>
          );
        }),
      )}
    </div>
  );
}