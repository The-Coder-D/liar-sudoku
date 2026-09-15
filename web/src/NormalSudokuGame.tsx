import { useCallback, useEffect, useRef, useState } from "react";
import { cloneGrid, gridsEqual, type Grid } from "./engine/sudoku";
import { generateNormalPuzzle, DIFFICULTY_PRESETS, type Difficulty } from "./engine/difficulty";
import { buildNormalReferenceGrid, classifyMove, getNormalFillHint, type FillHint } from "./engine/hints";
import { SudokuGrid, type CellCoord } from "./components/SudokuGrid";
import { WinModal } from "./components/WinModal";
import { Toast } from "./components/Toast";
import { Professor, type ProfessorEmotion } from "./components/Professor";
import {
  detectCompletedUnits,
  pickRandom,
  toastForCompletedUnits,
  TOAST_BEYOND_SINGLES_MESSAGES,
  FILL_HIDDEN_SINGLE_MESSAGES,
  FILL_NAKED_SINGLE_MESSAGES,
  FILL_BEYOND_SINGLES_MESSAGES,
  UNIT_COMPLETE_PHRASES,
} from "./celebrations";
import {
  PROFESSOR_DIFFICULTY_LINES,
  PROFESSOR_HINT_USED,
  PROFESSOR_UNIT_COMPLETE,
  PROFESSOR_NORMAL_SOLVED,
  PROFESSOR_CHECK_CLEAN,
  PROFESSOR_CHECK_MISTAKES,
  PROFESSOR_NORMAL_IDLE_TIPS,
  PROFESSOR_NORMAL_GREETING,
} from "./professor";
import { getDefaultDifficulty } from "./preferences";
import { sfx } from "./sound";
import "./App.css";

const DEFAULT_MESSAGE = "Fill the grid. Every clue here is exactly what it claims to be.";

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface NormalSudokuGameProps {
  onExit: () => void;
  professorMuted: boolean;
  onToggleProfessorMuted: () => void;
}

export function NormalSudokuGame({ onExit, professorMuted, onToggleProfessorMuted }: NormalSudokuGameProps) {
  const [puzzle, setPuzzle] = useState<Grid | null>(null);
  const [solution, setSolution] = useState<Grid | null>(null);
  const [userGrid, setUserGrid] = useState<Grid | null>(null);
  const [selected, setSelected] = useState<CellCoord | null>(null);
  const [mistakesCaught, setMistakesCaught] = useState(0);
  const [wrongFillCells, setWrongFillCells] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [loading, setLoading] = useState(true);
  const [solved, setSolved] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>(() => getDefaultDifficulty());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [solvedTime, setSolvedTime] = useState<number | null>(null);

  const [fillHint, setFillHint] = useState<FillHint | null>(null);
  const [fillHintRevealed, setFillHintRevealed] = useState(false);

  const [celebratingCells, setCelebratingCells] = useState<Map<string, number>>(new Map());

  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const toastIdRef = useRef(0);

  const [professorLine, setProfessorLine] = useState(PROFESSOR_NORMAL_GREETING[0]);
  const [professorEmotion, setProfessorEmotion] = useState<ProfessorEmotion>("happy");
  const professorMutedRef = useRef(professorMuted);
  useEffect(() => {
    professorMutedRef.current = professorMuted;
  }, [professorMuted]);
  const lastActionRef = useRef(Date.now());
  const hasGreetedRef = useRef(false);
  const noteActivity = () => {
    lastActionRef.current = Date.now();
  };
  const professorSay = (pool: string[], emotion: ProfessorEmotion = "neutral") => {
    if (professorMuted) return;
    setProfessorLine(pickRandom(pool));
    setProfessorEmotion(emotion);
  };

  const showToast = (text: string) => {
    toastIdRef.current += 1;
    const id = toastIdRef.current;
    setToast({ id, text });
    window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 1600);
  };

  const triggerCelebration = (cells: [number, number][]) => {
    const map = new Map<string, number>();
    cells.forEach(([r, c], i) => map.set(`${r}-${c}`, i * 35));
    setCelebratingCells(map);
    window.setTimeout(() => setCelebratingCells(new Map()), 700 + cells.length * 35);
  };

  const startNewPuzzle = useCallback((targetDifficulty: Difficulty) => {
    setLoading(true);
    setSolved(false);
    setShowWinModal(false);
    setSelected(null);
    setWrongFillCells(new Set());
    setFillHint(null);
    setFillHintRevealed(false);
    setCelebratingCells(new Map());
    setToast(null);
    setDifficulty(targetDifficulty);
    setElapsedSeconds(0);
    setSolvedTime(null);
    noteActivity();

    // Classic generation is fast (no fairness-proof loop like the liar mechanic needs),
    // so a brief timeout is just to let the loading state paint, not a real wait.
    setTimeout(() => {
      const result = generateNormalPuzzle(targetDifficulty);
      setPuzzle(result.puzzle);
      setSolution(result.solution);
      setUserGrid(cloneGrid(result.puzzle));
      setLoading(false);
      if (!professorMutedRef.current) {
        if (!hasGreetedRef.current) {
          hasGreetedRef.current = true;
          setProfessorLine(pickRandom(PROFESSOR_NORMAL_GREETING));
          setProfessorEmotion("happy");
        } else {
          setProfessorLine(pickRandom(PROFESSOR_DIFFICULTY_LINES[targetDifficulty]));
          setProfessorEmotion("neutral");
        }
      }
      setMessage(DEFAULT_MESSAGE);
    }, 30);
  }, []);

  useEffect(() => {
    startNewPuzzle(getDefaultDifficulty());
  }, [startNewPuzzle]);

  useEffect(() => {
    if (loading || solved) return;
    const id = window.setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [loading, solved]);

  useEffect(() => {
    if (loading || solved) return;
    const id = window.setInterval(() => {
      if (!professorMuted && Date.now() - lastActionRef.current > 18000) {
        setProfessorLine(pickRandom(PROFESSOR_NORMAL_IDLE_TIPS));
        setProfessorEmotion("neutral");
        lastActionRef.current = Date.now();
      }
    }, 4000);
    return () => window.clearInterval(id);
  }, [loading, solved, professorMuted]);

  if (loading || !puzzle || !solution || !userGrid) {
    return (
      <div className="app-shell">
        <div className="loading">
          <span className="spinner" aria-hidden="true" />
          Building your grid…
        </div>
        <Professor
          line={professorLine}
          emotion={professorEmotion}
          muted={professorMuted}
          onToggleMute={onToggleProfessorMuted}
        />
      </div>
    );
  }

  const isEditable = (row: number, col: number) => puzzle[row][col] === 0;

  const handleCellClick = (row: number, col: number) => {
    noteActivity();
    if (!isEditable(row, col)) return;
    sfx.select();
    setSelected({ row, col });
  };

  const handleDigit = (digit: number) => {
    if (!selected || !isEditable(selected.row, selected.col)) return;
    noteActivity();
    const { row, col } = selected;

    const isCorrect = digit === solution[row][col];
    const technique = isCorrect
      ? classifyMove(buildNormalReferenceGrid(puzzle, solution, userGrid), row, col, digit)
      : null;
    const wasHintAlreadyRevealedHere = fillHint && fillHint.row === row && fillHint.col === col && fillHintRevealed;

    if (isCorrect) sfx.place();
    else sfx.wrong();

    const next = cloneGrid(userGrid);
    next[row][col] = digit;
    setUserGrid(next);
    setFillHint(null);
    setFillHintRevealed(false);

    setWrongFillCells((prev) => {
      const copy = new Set(prev);
      copy.delete(`${row}-${col}`);
      return copy;
    });

    const isComplete = next.every((r) => r.every((v) => v !== 0));
    if (isComplete && gridsEqual(next, solution)) {
      setSolved(true);
      setSolvedTime(elapsedSeconds);
      setShowWinModal(true);
      setMessage(`Solved in ${formatTime(elapsedSeconds)} — every digit checks out.`);
      sfx.solved();
      professorSay(PROFESSOR_NORMAL_SOLVED, "excited");
      return;
    }

    if (!isCorrect) return;

    const { cells, labels } = detectCompletedUnits(next, solution, row, col);
    if (cells.length > 0) {
      triggerCelebration(cells);
      showToast(toastForCompletedUnits(labels));
      sfx.unitComplete();
      professorSay(PROFESSOR_UNIT_COMPLETE, "happy");
    }
    const unitNote = labels.length > 0 ? ` Plus ${labels.join(" and ")} — ${pickRandom(UNIT_COMPLETE_PHRASES)}.` : "";

    if (!wasHintAlreadyRevealedHere) {
      if (technique) {
        const pool = technique === "hidden-single" ? FILL_HIDDEN_SINGLE_MESSAGES : FILL_NAKED_SINGLE_MESSAGES;
        setMessage(pickRandom(pool) + unitNote);
        return;
      }
      setMessage(pickRandom(FILL_BEYOND_SINGLES_MESSAGES) + unitNote);
      showToast(pickRandom(TOAST_BEYOND_SINGLES_MESSAGES));
      return;
    }

    if (labels.length > 0) {
      setMessage(`${labels.join(" and ")} — ${pickRandom(UNIT_COMPLETE_PHRASES)}.`);
    }
  };

  const handleClear = () => {
    if (!selected || !isEditable(selected.row, selected.col)) return;
    noteActivity();
    sfx.clear();
    const next = cloneGrid(userGrid);
    next[selected.row][selected.col] = 0;
    setUserGrid(next);
    setFillHint(null);
    setFillHintRevealed(false);
  };

  const handleFillHint = () => {
    noteActivity();
    if (fillHint && !fillHintRevealed) {
      setFillHintRevealed(true);
      setMessage(`Row ${fillHint.row + 1}, column ${fillHint.col + 1} — it's ${fillHint.value}.`);
      setSelected({ row: fillHint.row, col: fillHint.col });
      return;
    }

    sfx.hint();
    professorSay(PROFESSOR_HINT_USED);
    const hint = getNormalFillHint(puzzle, solution, userGrid);
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
    noteActivity();
    const wrong = new Set<string>();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const v = userGrid[r][c];
        if (v !== 0 && isEditable(r, c) && v !== solution[r][c]) {
          wrong.add(`${r}-${c}`);
        }
      }
    }
    setWrongFillCells(wrong);
    if (wrong.size > 0) setMistakesCaught((m) => m + wrong.size);
    professorSay(
      wrong.size === 0 ? PROFESSOR_CHECK_CLEAN : PROFESSOR_CHECK_MISTAKES,
      wrong.size === 0 ? "happy" : "concerned",
    );
    setMessage(
      wrong.size === 0
        ? "Everything filled in so far is correct."
        : `${wrong.size} ${wrong.size === 1 ? "entry doesn't" : "entries don't"} fit — marked in red.`,
    );
  };

  const filledCount = userGrid.reduce((sum, row) => sum + row.filter((v) => v !== 0).length, 0);

  return (
    <div className="app-shell">
      <Toast toast={toast} />
      <Professor
        line={professorLine}
        emotion={professorEmotion}
        muted={professorMuted}
        onToggleMute={onToggleProfessorMuted}
      />
      {showWinModal && (
        <WinModal
          mode="normal"
          difficulty={difficulty}
          time={formatTime(solvedTime ?? elapsedSeconds)}
          mistakes={mistakesCaught}
          onClose={() => setShowWinModal(false)}
          onPlayAgain={() => startNewPuzzle(difficulty)}
          onTryDifficulty={(next) => startNewPuzzle(next)}
        />
      )}

      <header className="app-header">
        <div>
          <h1>Normal Sudoku</h1>
          <p className="tagline">Classic rules. No lies this time — just you and the grid.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={onExit}>
            ← Menu
          </button>
          <button className="btn btn-primary" onClick={() => startNewPuzzle(difficulty)}>
            New puzzle
          </button>
        </div>
      </header>

      <div className="difficulty-toggle" role="group" aria-label="Difficulty">
        {Object.values(DIFFICULTY_PRESETS).map((preset) => (
          <button
            key={preset.id}
            className={difficulty === preset.id ? "difficulty-btn difficulty-btn-active" : "difficulty-btn"}
            onClick={() => startNewPuzzle(preset.id)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="board-area">
        <SudokuGrid
          puzzle={puzzle}
          userGrid={userGrid}
          liarCell={null}
          selected={selected}
          mode="fill"
          wrongCells={wrongFillCells}
          accuseWrongCell={null}
          celebratingCells={celebratingCells}
          onCellClick={handleCellClick}
        />

        <aside className="side-panel">
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

          <button className="btn btn-hint" onClick={handleFillHint}>
            {fillHint && !fillHintRevealed ? "Reveal digit" : "Get a hint"}
          </button>

          <p className="message" aria-live="polite">
            {message}
          </p>

          <dl className="stats">
            <div>
              <dt>Time</dt>
              <dd>{formatTime(elapsedSeconds)}</dd>
            </div>
            <div>
              <dt>Filled</dt>
              <dd>{filledCount} / 81</dd>
            </div>
            <div>
              <dt>Mistakes caught</dt>
              <dd>{mistakesCaught}</dd>
            </div>
          </dl>

          <div className="legend">
            <span>
              <i className="swatch swatch-given" /> given clue
            </span>
            <span>
              <i className="swatch swatch-entry" /> your entry
            </span>
          </div>

          {solved && (
            <div className="solved-banner">
              <strong>Solved!</strong>
              <span>{formatTime(solvedTime ?? elapsedSeconds)}</span>
            </div>
          )}

          <button className="btn btn-secondary" onClick={handleCheck}>
            Check my entries
          </button>
        </aside>
      </div>
    </div>
  );
}
