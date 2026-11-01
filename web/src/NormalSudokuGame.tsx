import { useCallback, useEffect, useRef, useState } from "react";
import { cloneGrid, gridsEqual, type Grid } from "./engine/sudoku";
import { generateNormalPuzzle, DIFFICULTY_PRESETS, type Difficulty } from "./engine/difficulty";
import { buildNormalReferenceGrid, classifyMove, getNormalFillHint, type FillHint } from "./engine/hints";
import { SudokuGrid, type CellCoord } from "./components/SudokuGrid";
import { WinModal } from "./components/WinModal";
import { Toast } from "./components/Toast";
import { Professor, type OwlAction, type ProfessorEmotion } from "./components/Professor";
import { emitOwl } from "./professorBus";
import { getCandidates, isCoarsePointer } from "./owlTools";
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
  PROFESSOR_RESUMED,
  PROFESSOR_NEW_BEST_TIME,
  PROFESSOR_STREAK_CONTINUED,
  PROFESSOR_TIPS,
} from "./professor";
import { getDefaultDifficulty } from "./preferences";
import { sfx } from "./sound";
import { recordSolve } from "./stats";
import { writeSavedGame, clearSavedGame, type SavedGame } from "./gameSave";
import {
  type PencilMarks as PencilMarksType,
  toggleMark,
  clearPeerPencilMarks,
  clonePencilMarks,
  serializePencilMarks,
  deserializePencilMarks,
} from "./pencilMarks";
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
  resume?: Extract<SavedGame, { mode: "normal" }>;
}

export function NormalSudokuGame({ onExit, professorMuted, onToggleProfessorMuted, resume }: NormalSudokuGameProps) {
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

  const [pencilMarks, setPencilMarks] = useState<PencilMarksType>(new Map());
  const [notesMode, setNotesMode] = useState(false);

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

  // Holds the latest handler closures for the keydown listener below, updated
  // by a plain assignment after they're defined (past the loading early
  // return) — see the equivalent comment in LiarSudokuGame.tsx for why.
  const keyboardStateRef = useRef<{
    handleDigit: (digit: number) => void;
    handleClear: () => void;
    selected: CellCoord | null;
  } | null>(null);

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
    setPencilMarks(new Map());
    setNotesMode(false);
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
    if (resume) {
      setPuzzle(resume.puzzle);
      setSolution(resume.solution);
      setUserGrid(resume.userGrid);
      setMistakesCaught(resume.mistakesCaught);
      setDifficulty(resume.difficulty);
      setElapsedSeconds(resume.elapsedSeconds);
      setSolvedTime(null);
      setPencilMarks(deserializePencilMarks(resume.pencilMarks));
      setLoading(false);
      hasGreetedRef.current = true;
      if (!professorMutedRef.current) {
        setProfessorLine(pickRandom(PROFESSOR_RESUMED));
        setProfessorEmotion("happy");
      }
      setMessage(DEFAULT_MESSAGE);
      return;
    }
    startNewPuzzle(getDefaultDifficulty());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startNewPuzzle]);

  // Auto-save into the same single global slot Liar Sudoku uses — whichever
  // mode you played most recently is what "Load Game" resumes.
  useEffect(() => {
    if (loading || !puzzle || !solution || !userGrid) return;
    if (solved) {
      clearSavedGame();
      return;
    }
    const save: SavedGame = {
      mode: "normal",
      difficulty,
      puzzle,
      solution,
      userGrid,
      mistakesCaught,
      elapsedSeconds,
      savedAt: Date.now(),
      pencilMarks: serializePencilMarks(pencilMarks),
    };
    writeSavedGame(save);
  }, [loading, solved, puzzle, solution, userGrid, mistakesCaught, elapsedSeconds, difficulty, pencilMarks]);

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

  // Keyboard play: arrow keys move the selection, digits fill (or toggle a
  // note in Notes mode, handled inside handleDigit itself), Backspace/Delete/0
  // clears, N toggles Notes. Disabled while the win modal is open.
  useEffect(() => {
    if (loading || showWinModal) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const ref = keyboardStateRef.current;
      if (!ref) return;
      const { handleDigit, handleClear, selected } = ref;

      if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const base = selected ?? { row: 0, col: 0 };
        let { row, col } = base;
        if (e.key === "ArrowUp") row = Math.max(0, row - 1);
        else if (e.key === "ArrowDown") row = Math.min(8, row + 1);
        else if (e.key === "ArrowLeft") col = Math.max(0, col - 1);
        else if (e.key === "ArrowRight") col = Math.min(8, col + 1);
        sfx.select();
        setSelected({ row, col });
        return;
      }

      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        noteActivity();
        setNotesMode((m) => !m);
        return;
      }

      if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        if (selected) handleDigit(Number(e.key));
        return;
      }

      if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, showWinModal]);

  // Whatever moves the selection (tap, arrow keys, a hint), the owl glances at that cell.
  useEffect(() => {
    if (selected) emitOwl({ type: "select", row: selected.row, col: selected.col });
  }, [selected]);

  // On phones the pinned control bar can cover the status line, so bring a new hint or result
  // into view (scroll-margin on .message leaves room for the bar). Skips the starting message.
  const lastMessageRef = useRef(message);
  useEffect(() => {
    if (message === lastMessageRef.current) return;
    lastMessageRef.current = message;
    if (message === DEFAULT_MESSAGE || !isCoarsePointer()) return;
    document.querySelector(".message")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [message]);

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
          inlineOnMobile
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

    if (notesMode) {
      sfx.noteToggle();
      emitOwl({ type: "note" });
      setPencilMarks((prev) => toggleMark(prev, row, col, digit));
      return;
    }

    const isCorrect = digit === solution[row][col];
    // Says nothing about correctness, so the owl never gives away a wrong digit.
    emitOwl({ type: "place" });
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
    setPencilMarks((prev) => clearPeerPencilMarks(prev, row, col, digit));

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
      emitOwl({ type: "solved" });
      const { isNewBestTime, streakChanged } = recordSolve("normal", difficulty, elapsedSeconds);
      if (isNewBestTime) {
        professorSay(PROFESSOR_NEW_BEST_TIME, "excited");
      } else if (streakChanged) {
        professorSay(PROFESSOR_STREAK_CONTINUED, "excited");
      } else {
        professorSay(PROFESSOR_NORMAL_SOLVED, "excited");
      }
      return;
    }

    if (!isCorrect) return;

    const { cells, labels } = detectCompletedUnits(next, solution, row, col);
    if (cells.length > 0) {
      triggerCelebration(cells);
      emitOwl({ type: "cheer" });
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
    emitOwl({ type: "clear" });
    if (notesMode) {
      setPencilMarks((prev) => {
        const next = clonePencilMarks(prev);
        next.delete(`${selected.row}-${selected.col}`);
        return next;
      });
      return;
    }
    const next = cloneGrid(userGrid);
    next[selected.row][selected.col] = 0;
    setUserGrid(next);
    setFillHint(null);
    setFillHintRevealed(false);
  };

  // Plain assignment, not a hook — keeps the keydown listener's closures fresh every render.
  keyboardStateRef.current = { handleDigit, handleClear, selected };

  const handleFillHint = () => {
    noteActivity();
    if (fillHint && !fillHintRevealed) {
      setFillHintRevealed(true);
      setMessage(`Row ${fillHint.row + 1}, column ${fillHint.col + 1} — it's ${fillHint.value}.`);
      setSelected({ row: fillHint.row, col: fillHint.col });
      return;
    }

    sfx.hint();
    emitOwl({ type: "hint" });
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

  // What the owl offers when you tap him; each entry reuses an existing game action.
  const owlActions: OwlAction[] = [];
  if (!solved) {
    owlActions.push({
      id: "fits",
      label: "What fits here?",
      detail: selected ? "Digits that don't clash with the selected cell" : "Select a cell first",
      disabled: !selected || !isEditable(selected.row, selected.col),
      run: () => {
        if (!selected) return;
        const options = getCandidates(userGrid, selected.row, selected.col);
        const where = `Row ${selected.row + 1}, column ${selected.col + 1}`;
        if (options.length === 0) return `${where}: nothing fits by the digits showing — one of them must be wrong.`;
        return `${where}: ${options.join(", ")} ${options.length === 1 ? "is the only digit that fits" : "could go here"}.`;
      },
    });
    owlActions.push({ id: "hint", label: "Give me a hint", detail: "Reasoning first, digit on request", run: handleFillHint });
    owlActions.push({ id: "check", label: "Check my entries", detail: "Flags mistakes without showing answers", run: handleCheck });
  }

  return (
    <div className="app-shell">
      <Toast toast={toast} />
      <Professor
        line={professorLine}
        emotion={professorEmotion}
        muted={professorMuted}
        onToggleMute={onToggleProfessorMuted}
        actions={owlActions}
        tips={PROFESSOR_TIPS}
        inlineOnMobile
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
          pencilMarks={pencilMarks}
          onCellClick={handleCellClick}
        />

        <aside className="side-panel">
          {/* On phones this block pins to the bottom of the screen so the number pad stays under your thumb. */}
          <div className="input-dock">
          <button
            className={notesMode ? "btn btn-toggle btn-toggle-on notes-toggle" : "btn btn-toggle notes-toggle"}
            onClick={() => {
              noteActivity();
              setNotesMode((m) => !m);
            }}
            aria-pressed={notesMode}
          >
            ✎ Notes: {notesMode ? "On" : "Off"}
          </button>

          <div className={notesMode ? "number-pad number-pad-notes" : "number-pad"}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button key={n} className="num-btn" onClick={() => handleDigit(n)} disabled={!selected}>
                {n}
              </button>
            ))}
            <button className="num-btn num-btn-clear" onClick={handleClear} disabled={!selected}>
              Clear
            </button>
          </div>

          <button className="btn btn-hint dock-hint-fill" onClick={handleFillHint}>
            {fillHint && !fillHintRevealed ? "Reveal digit" : "Get a hint"}
          </button>
          </div>

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

          <div
            className="progress"
            role="progressbar"
            aria-label="Grid filled"
            aria-valuemin={0}
            aria-valuemax={81}
            aria-valuenow={filledCount}
          >
            <i style={{ width: `${(filledCount / 81) * 100}%` }} />
          </div>

          <div className="legend">
            <span>
              <i className="swatch swatch-given" /> given clue
            </span>
            <span>
              <i className="swatch swatch-entry" /> your entry
            </span>
          </div>

          <p className="keyboard-hint">Keyboard: arrows to move · 1-9 to fill · Backspace to clear · N for notes</p>

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