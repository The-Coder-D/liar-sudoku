import { useCallback, useEffect, useState } from "react";
import { cloneGrid, gridsEqual, type Grid } from "./engine/sudoku";
import { generateLiarPuzzle, type LiarPuzzle } from "./engine/liarGenerator";
import { getAccusationChain, getFillHint, type AccusationChain, type FillHint } from "./engine/hints";
import { SudokuGrid, type CellCoord, type Mode } from "./components/SudokuGrid";
import "./App.css";

const DEFAULT_MESSAGE = "One clue below is lying. Find it before you can finish the grid.";

function App() {
  const [puzzle, setPuzzle] = useState<LiarPuzzle | null>(null);
  const [userGrid, setUserGrid] = useState<Grid | null>(null);
  const [liarFound, setLiarFound] = useState(false);
  const [selected, setSelected] = useState<CellCoord | null>(null);
  const [mode, setMode] = useState<Mode>("accuse");
  const [mistakes, setMistakes] = useState(0);
  const [accuseWrongCell, setAccuseWrongCell] = useState<CellCoord | null>(null);
  const [wrongFillCells, setWrongFillCells] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [loading, setLoading] = useState(true);
  const [solved, setSolved] = useState(false);

  // Accusation hints: the full logical contradiction chain, revealed one step per click.
  const [accuseChain, setAccuseChain] = useState<AccusationChain | null>(null);
  const [accuseHintIndex, setAccuseHintIndex] = useState(0);
  const [accuseFullyRevealed, setAccuseFullyRevealed] = useState(false);

  // Fill hints: reasoning first, digit revealed on a second click.
  const [fillHint, setFillHint] = useState<FillHint | null>(null);
  const [fillHintRevealed, setFillHintRevealed] = useState(false);

  const newPuzzle = useCallback(() => {
    setLoading(true);
    setSolved(false);
    setLiarFound(false);
    setMistakes(0);
    setSelected(null);
    setMode("accuse");
    setWrongFillCells(new Set());
    setMessage(DEFAULT_MESSAGE);
    setAccuseHintIndex(0);
    setAccuseFullyRevealed(false);
    setFillHint(null);
    setFillHintRevealed(false);

    // Let the loading state paint before the (occasionally slow) generation runs.
    // TODO: move this to a Web Worker so the UI thread never blocks at all.
    setTimeout(() => {
      const result = generateLiarPuzzle(30);
      setPuzzle(result);
      setUserGrid(cloneGrid(result.puzzle));
      setAccuseChain(getAccusationChain(result));
      setLoading(false);
    }, 50);
  }, []);

  useEffect(() => {
    newPuzzle();
  }, [newPuzzle]);

  if (loading || !puzzle || !userGrid) {
    return (
      <div className="app-shell">
        <div className="loading">Generating a fair puzzle — proving the lie before showing it to you…</div>
      </div>
    );
  }

  const isGivenCell = (row: number, col: number) => puzzle.puzzle[row][col] !== 0;
  const isLiarCell = (row: number, col: number) => row === puzzle.liarRow && col === puzzle.liarCol;
  const isEditable = (row: number, col: number) => !isGivenCell(row, col) || (isLiarCell(row, col) && liarFound);

  const handleCellClick = (row: number, col: number) => {
    if (mode === "accuse") {
      if (!isGivenCell(row, col) || liarFound) return;

      if (isLiarCell(row, col)) {
        setLiarFound(true);
        const cleared = cloneGrid(userGrid);
        cleared[row][col] = 0;
        setUserGrid(cleared);
        setMode("fill");
        setSelected({ row, col });
        setMessage("Found it — that clue was the lie. The cell's cleared, fill it in like normal.");
      } else {
        setMistakes((m) => m + 1);
        setAccuseWrongCell({ row, col });
        setMessage("Not the lie. Every other clue here is consistent with a valid grid.");
        setTimeout(() => setAccuseWrongCell(null), 400);
      }
      return;
    }

    if (!isEditable(row, col)) return;
    setSelected({ row, col });
  };

  const handleDigit = (digit: number) => {
    if (mode !== "fill" || !selected || !isEditable(selected.row, selected.col)) return;

    const next = cloneGrid(userGrid);
    next[selected.row][selected.col] = digit;
    setUserGrid(next);
    setFillHint(null);
    setFillHintRevealed(false);

    setWrongFillCells((prev) => {
      const copy = new Set(prev);
      copy.delete(`${selected.row}-${selected.col}`);
      return copy;
    });

    const isComplete = next.every((row) => row.every((v) => v !== 0));
    if (isComplete && gridsEqual(next, puzzle.trueSolution)) {
      setSolved(true);
      setMessage("Solved — the lie is exposed and the grid checks out.");
    }
  };

  const handleClear = () => {
    if (mode !== "fill" || !selected || !isEditable(selected.row, selected.col)) return;
    const next = cloneGrid(userGrid);
    next[selected.row][selected.col] = 0;
    setUserGrid(next);
    setFillHint(null);
    setFillHintRevealed(false);
  };

  const handleAccuseHint = () => {
    if (!accuseChain) return;

    if (accuseHintIndex < accuseChain.steps.length) {
      const step = accuseChain.steps[accuseHintIndex];
      setMessage(
        `Assuming every clue is true: ${step.reason} That forces row ${step.row + 1}, column ${step.col + 1} to be ${step.value}.`,
      );
      setAccuseHintIndex((i) => i + 1);
      return;
    }

    if (accuseChain.contradiction) {
      const c = accuseChain.contradiction;
      setMessage(
        `Eventually that forces row ${c.row + 1}, column ${c.col + 1} into a corner: ${c.reason} That's impossible — so one of the given clues that fed into this chain must be false. Re-examine those clues and make your accusation.`,
      );
    } else {
      setMessage(
        "This puzzle's contradiction needs a deeper technique than naked/hidden singles can explain — try your own reasoning from here.",
      );
    }
    setAccuseFullyRevealed(true);
  };

  const handleFillHint = () => {
    if (fillHint && !fillHintRevealed) {
      setFillHintRevealed(true);
      setMessage(`Row ${fillHint.row + 1}, column ${fillHint.col + 1} — it's ${fillHint.value}.`);
      setSelected({ row: fillHint.row, col: fillHint.col });
      return;
    }

    const hint = getFillHint(puzzle, userGrid);
    if (!hint) {
      setFillHint(null);
      setMessage(
        "No safe next step found using naked or hidden singles from here — this spot needs a deeper technique. Try your own reasoning, or use Check to catch mistakes.",
      );
      return;
    }
    setFillHint(hint);
    setFillHintRevealed(false);
    setSelected({ row: hint.row, col: hint.col });
    setMessage(`Look at row ${hint.row + 1}, column ${hint.col + 1} — ${hint.reason}`);
  };

  const handleCheck = () => {
    const wrong = new Set<string>();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const v = userGrid[r][c];
        if (v !== 0 && isEditable(r, c) && v !== puzzle.trueSolution[r][c]) {
          wrong.add(`${r}-${c}`);
        }
      }
    }
    setWrongFillCells(wrong);
    setMessage(
      wrong.size === 0
        ? "Everything filled in so far is correct."
        : `${wrong.size} ${wrong.size === 1 ? "entry doesn't" : "entries don't"} fit — marked in red.`,
    );
  };

  const filledCount = userGrid.reduce((sum, row) => sum + row.filter((v) => v !== 0).length, 0);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Liar Sudoku</h1>
          <p className="tagline">One given clue is false. Prove which one, then finish the grid.</p>
        </div>
        <button className="btn btn-primary" onClick={newPuzzle}>
          New puzzle
        </button>
      </header>

      <div className="board-area">
        <SudokuGrid
          puzzle={puzzle.puzzle}
          userGrid={userGrid}
          liarCell={liarFound ? { row: puzzle.liarRow, col: puzzle.liarCol } : null}
          selected={selected}
          mode={mode}
          wrongCells={wrongFillCells}
          accuseWrongCell={accuseWrongCell}
          onCellClick={handleCellClick}
        />

        <aside className="side-panel">
          <div className="mode-toggle" role="group" aria-label="Mode">
            <button
              className={mode === "accuse" ? "mode-btn mode-btn-active accuse" : "mode-btn"}
              onClick={() => !liarFound && setMode("accuse")}
              disabled={liarFound}
            >
              Accuse a clue
            </button>
            <button
              className={mode === "fill" ? "mode-btn mode-btn-active fill" : "mode-btn"}
              onClick={() => setMode("fill")}
            >
              Fill a cell
            </button>
          </div>

          {mode === "accuse" && !liarFound && (
            <button className="btn btn-hint" onClick={handleAccuseHint} disabled={accuseFullyRevealed}>
              {accuseFullyRevealed ? "No further logic hints" : "Why is this a lie?"}
            </button>
          )}

          {mode === "fill" && (
            <div className="number-pad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button key={n} className="num-btn" onClick={() => handleDigit(n)} disabled={!selected}>
                  {n}
                </button>
              ))}
              <button className="num-btn num-btn-clear" onClick={handleClear} disabled={!selected}>
                Clear
              </button>
            </div>
          )}

          {mode === "fill" && (
            <button className="btn btn-hint" onClick={handleFillHint}>
              {fillHint && !fillHintRevealed ? "Reveal digit" : "Get a hint"}
            </button>
          )}

          <p className="message" aria-live="polite">
            {message}
          </p>

          <dl className="stats">
            <div>
              <dt>Filled</dt>
              <dd>{filledCount} / 81</dd>
            </div>
            <div>
              <dt>Wrong accusations</dt>
              <dd>{mistakes}</dd>
            </div>
          </dl>

          <div className="legend">
            <span>
              <i className="swatch swatch-given" /> given clue
            </span>
            <span>
              <i className="swatch swatch-entry" /> your entry
            </span>
            <span>
              <i className="swatch swatch-accuse" /> accusing
            </span>
          </div>

          {solved && <p className="solved-banner">Solved — the lie is exposed and the grid checks out.</p>}

          {mode === "fill" && (
            <button className="btn btn-secondary" onClick={handleCheck}>
              Check my entries
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

export default App;
