import { useCallback, useEffect, useRef, useState } from "react";
import { cloneGrid, gridsEqual, type Grid } from "./engine/sudoku";
import { type LiarPuzzle } from "./engine/liarGenerator";
import { DIFFICULTY_PRESETS, generatePuzzleForDifficulty, type Difficulty } from "./engine/difficulty";
import { getAccusationChain, getFillHint, buildReferenceGrid, classifyMove, type AccusationChain, type FillHint } from "./engine/hints";
import { SudokuGrid, type CellCoord, type Mode } from "./components/SudokuGrid";
import { OnboardingModal } from "./components/OnboardingModal";
import { WinModal } from "./components/WinModal";
import { Toast } from "./components/Toast";
import { Professor, type ProfessorEmotion } from "./components/Professor";
import {
  detectCompletedUnits,
  pickRandom,
  toastForCompletedUnits,
  ACCUSE_SUCCESS_MESSAGES,
  ACCUSE_SUCCESS_FIRST_TRY_MESSAGES,
  TOAST_ACCUSE_MESSAGES,
  TOAST_ACCUSE_FIRST_TRY_MESSAGES,
  TOAST_BEYOND_SINGLES_MESSAGES,
  FILL_HIDDEN_SINGLE_MESSAGES,
  FILL_NAKED_SINGLE_MESSAGES,
  FILL_BEYOND_SINGLES_MESSAGES,
  UNIT_COMPLETE_PHRASES,
} from "./celebrations";
import {
  PROFESSOR_DIFFICULTY_LINES,
  PROFESSOR_WRONG_ACCUSATION,
  PROFESSOR_STRUGGLING,
  PROFESSOR_CORRECT_ACCUSATION,
  PROFESSOR_HINT_USED,
  PROFESSOR_UNIT_COMPLETE,
  PROFESSOR_SOLVED,
  PROFESSOR_CHECK_CLEAN,
  PROFESSOR_CHECK_MISTAKES,
  PROFESSOR_IDLE_TIPS,
  PROFESSOR_FIRST_GREETING,
  PROFESSOR_LOADING,
} from "./professor";
import "./App.css";

const DEFAULT_MESSAGE = "One clue below is lying. Find it before you can finish the grid.";
const ONBOARDING_KEY = "liar-sudoku-onboarded";

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

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
  const [showWinModal, setShowWinModal] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("sharp");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [solvedTime, setSolvedTime] = useState<number | null>(null);

  // Accusation hints: the full logical contradiction chain, revealed one step per click.
  const [accuseChain, setAccuseChain] = useState<AccusationChain | null>(null);
  const [accuseHintIndex, setAccuseHintIndex] = useState(0);
  const [accuseFullyRevealed, setAccuseFullyRevealed] = useState(false);

  // Fill hints: reasoning first, digit revealed on a second click.
  const [fillHint, setFillHint] = useState<FillHint | null>(null);
  const [fillHintRevealed, setFillHintRevealed] = useState(false);

  // Cells currently playing the "unit completed" pulse animation, mapped to a stagger delay in ms.
  const [celebratingCells, setCelebratingCells] = useState<Map<string, number>>(new Map());

  // Floating appreciation popup — a quick flourish separate from the persistent status message.
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const toastIdRef = useRef(0);

  // The professor companion: its own voice, separate from the sidebar message and toasts.
  const [professorLine, setProfessorLine] = useState(PROFESSOR_FIRST_GREETING[0]);
  const [professorEmotion, setProfessorEmotion] = useState<ProfessorEmotion>("happy");
  const [professorMuted, setProfessorMuted] = useState(false);
  const professorMutedRef = useRef(false);
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
    setLiarFound(false);
    setMistakes(0);
    setSelected(null);
    setMode("accuse");
    setWrongFillCells(new Set());
    setAccuseHintIndex(0);
    setAccuseFullyRevealed(false);
    setFillHint(null);
    setFillHintRevealed(false);
    setCelebratingCells(new Map());
    setToast(null);
    setDifficulty(targetDifficulty);
    setElapsedSeconds(0);
    setSolvedTime(null);
    noteActivity();
    if (!professorMutedRef.current) {
      setProfessorLine(pickRandom(PROFESSOR_LOADING));
      setProfessorEmotion("neutral");
    }

    // Let the loading state paint before the (occasionally slow) generation runs.
    // TODO: move this to a Web Worker so the UI thread never blocks at all.
    setTimeout(() => {
      const { puzzle: result, actualClueCount, fellBack } = generatePuzzleForDifficulty(targetDifficulty);
      setPuzzle(result);
      setUserGrid(cloneGrid(result.puzzle));
      setAccuseChain(getAccusationChain(result));
      setLoading(false);
      if (!professorMutedRef.current) {
        if (!hasGreetedRef.current) {
          hasGreetedRef.current = true;
          setProfessorLine(pickRandom(PROFESSOR_FIRST_GREETING));
          setProfessorEmotion("happy");
        } else {
          setProfessorLine(pickRandom(PROFESSOR_DIFFICULTY_LINES[targetDifficulty]));
          setProfessorEmotion("neutral");
        }
      }
      setMessage(
        fellBack
          ? `Couldn't build a fair "${DIFFICULTY_PRESETS[targetDifficulty].label}" puzzle in time, so this one has ${actualClueCount} clues instead of the usual ${DIFFICULTY_PRESETS[targetDifficulty].clueCount}. Still fully fair — try again for another shot.`
          : DEFAULT_MESSAGE,
      );
    }, 50);
  }, []);

  useEffect(() => {
    startNewPuzzle("sharp");
  }, [startNewPuzzle]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.localStorage.getItem(ONBOARDING_KEY)) {
      setShowOnboarding(true);
    }
  }, []);

  useEffect(() => {
    if (loading || solved) return;
    const id = window.setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [loading, solved]);

  useEffect(() => {
    if (loading || solved) return;
    const id = window.setInterval(() => {
      if (!professorMuted && Date.now() - lastActionRef.current > 18000) {
        setProfessorLine(pickRandom(PROFESSOR_IDLE_TIPS));
        setProfessorEmotion("neutral");
        lastActionRef.current = Date.now();
      }
    }, 4000);
    return () => window.clearInterval(id);
  }, [loading, solved, professorMuted]);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    window.localStorage.setItem(ONBOARDING_KEY, "1");
  };

  if (loading || !puzzle || !userGrid) {
    return (
      <div className="app-shell">
        <div className="loading">
          <span className="spinner" aria-hidden="true" />
          Generating a fair puzzle — proving the lie before showing it to you…
        </div>
        <Professor
          line={professorLine}
          emotion={professorEmotion}
          muted={professorMuted}
          onToggleMute={() => setProfessorMuted((m) => !m)}
        />
      </div>
    );
  }

  const isGivenCell = (row: number, col: number) => puzzle.puzzle[row][col] !== 0;
  const isLiarCell = (row: number, col: number) => row === puzzle.liarRow && col === puzzle.liarCol;
  const isEditable = (row: number, col: number) => !isGivenCell(row, col) || (isLiarCell(row, col) && liarFound);

  const handleCellClick = (row: number, col: number) => {
    noteActivity();
    if (mode === "accuse") {
      if (!isGivenCell(row, col) || liarFound) return;

      if (isLiarCell(row, col)) {
        setLiarFound(true);
        const cleared = cloneGrid(userGrid);
        cleared[row][col] = 0;
        setUserGrid(cleared);
        setMode("fill");
        setSelected({ row, col });
        professorSay(PROFESSOR_CORRECT_ACCUSATION, "happy");
        if (mistakes === 0) {
          setMessage(pickRandom(ACCUSE_SUCCESS_FIRST_TRY_MESSAGES));
          showToast(pickRandom(TOAST_ACCUSE_FIRST_TRY_MESSAGES));
        } else {
          setMessage(pickRandom(ACCUSE_SUCCESS_MESSAGES));
          showToast(pickRandom(TOAST_ACCUSE_MESSAGES));
        }
      } else {
        const nextMistakes = mistakes + 1;
        setMistakes(nextMistakes);
        setAccuseWrongCell({ row, col });
        setMessage("Not the lie. Every other clue here is consistent with a valid grid.");
        // After a few misses in a row, switch to more encouraging, hint-pointing lines.
        professorSay(nextMistakes >= 3 ? PROFESSOR_STRUGGLING : PROFESSOR_WRONG_ACCUSATION, "concerned");
        setTimeout(() => setAccuseWrongCell(null), 400);
      }
      return;
    }

    if (!isEditable(row, col)) return;
    setSelected({ row, col });
  };

  const handleDigit = (digit: number) => {
    if (mode !== "fill" || !selected || !isEditable(selected.row, selected.col)) return;
    noteActivity();
    const { row, col } = selected;

    const isCorrect = digit === puzzle.trueSolution[row][col];
    // Classify the SPECIFIC move the player just made — not just whether it matches
    // whatever cell getFillHint's scan order happens to find first. A grid can have
    // several valid singles at once; this credits any of them fairly.
    const technique = isCorrect ? classifyMove(buildReferenceGrid(puzzle, userGrid), row, col, digit) : null;
    const wasHintAlreadyRevealedHere = fillHint && fillHint.row === row && fillHint.col === col && fillHintRevealed;

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
    if (isComplete && gridsEqual(next, puzzle.trueSolution)) {
      setSolved(true);
      setSolvedTime(elapsedSeconds);
      setShowWinModal(true);
      setMessage(`Solved in ${formatTime(elapsedSeconds)} — the lie is exposed and the grid checks out.`);
      professorSay(PROFESSOR_SOLVED, "happy");
      return;
    }

    if (!isCorrect) return; // stay quiet on wrong entries — "Check my entries" is the honest way to find out

    const { cells, labels } = detectCompletedUnits(next, puzzle.trueSolution, row, col);
    if (cells.length > 0) {
      triggerCelebration(cells);
      showToast(toastForCompletedUnits(labels));
      professorSay(PROFESSOR_UNIT_COMPLETE, "happy");
    }
    const unitNote = labels.length > 0 ? ` Plus ${labels.join(" and ")} — ${pickRandom(UNIT_COMPLETE_PHRASES)}.` : "";

    if (!wasHintAlreadyRevealedHere) {
      if (technique) {
        const pool = technique === "hidden-single" ? FILL_HIDDEN_SINGLE_MESSAGES : FILL_NAKED_SINGLE_MESSAGES;
        setMessage(pickRandom(pool) + unitNote);
        return;
      }
      // Correct, but neither naked nor hidden singles justify it — genuinely harder than this hint system can explain.
      setMessage(pickRandom(FILL_BEYOND_SINGLES_MESSAGES) + unitNote);
      showToast(pickRandom(TOAST_BEYOND_SINGLES_MESSAGES));
      return;
    }

    if (labels.length > 0) {
      setMessage(`${labels.join(" and ")} — ${pickRandom(UNIT_COMPLETE_PHRASES)}.`);
    }
  };

  const handleClear = () => {
    if (mode !== "fill" || !selected || !isEditable(selected.row, selected.col)) return;
    noteActivity();
    const next = cloneGrid(userGrid);
    next[selected.row][selected.col] = 0;
    setUserGrid(next);
    setFillHint(null);
    setFillHintRevealed(false);
  };

  const handleAccuseHint = () => {
    if (!accuseChain) return;
    noteActivity();
    professorSay(PROFESSOR_HINT_USED);

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
    noteActivity();
    if (fillHint && !fillHintRevealed) {
      setFillHintRevealed(true);
      setMessage(`Row ${fillHint.row + 1}, column ${fillHint.col + 1} — it's ${fillHint.value}.`);
      setSelected({ row: fillHint.row, col: fillHint.col });
      return;
    }

    professorSay(PROFESSOR_HINT_USED);
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
    noteActivity();
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
    professorSay(wrong.size === 0 ? PROFESSOR_CHECK_CLEAN : PROFESSOR_CHECK_MISTAKES, wrong.size === 0 ? "happy" : "concerned");
    setMessage(
      wrong.size === 0
        ? "Everything filled in so far is correct."
        : `${wrong.size} ${wrong.size === 1 ? "entry doesn't" : "entries don't"} fit — marked in red.`,
    );
  };

  const filledCount = userGrid.reduce((sum, row) => sum + row.filter((v) => v !== 0).length, 0);

  return (
    <div className="app-shell">
      {showOnboarding && <OnboardingModal onDismiss={dismissOnboarding} />}
      <Toast toast={toast} />
      <Professor
        line={professorLine}
        emotion={professorEmotion}
        muted={professorMuted}
        onToggleMute={() => setProfessorMuted((m) => !m)}
      />
      {showWinModal && (
        <WinModal
          difficulty={difficulty}
          time={formatTime(solvedTime ?? elapsedSeconds)}
          mistakes={mistakes}
          onClose={() => setShowWinModal(false)}
          onPlayAgain={() => startNewPuzzle(difficulty)}
          onTryDifficulty={(next) => startNewPuzzle(next)}
        />
      )}

      <header className="app-header">
        <div>
          <h1>Liar Sudoku</h1>
          <p className="tagline">One given clue is false. Prove which one, then finish the grid.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={() => setShowOnboarding(true)}>
            How to play
          </button>
          <button className="btn btn-primary" onClick={() => startNewPuzzle(difficulty)}>
            New puzzle
          </button>
        </div>
      </header>

      <div className="difficulty-toggle" role="group" aria-label="Difficulty">
        {(Object.values(DIFFICULTY_PRESETS)).map((preset) => (
          <button
            key={preset.id}
            className={difficulty === preset.id ? "difficulty-btn difficulty-btn-active" : "difficulty-btn"}
            onClick={() => startNewPuzzle(preset.id)}
            title={preset.description}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="board-area">
        <SudokuGrid
          puzzle={puzzle.puzzle}
          userGrid={userGrid}
          liarCell={liarFound ? { row: puzzle.liarRow, col: puzzle.liarCol } : null}
          selected={selected}
          mode={mode}
          wrongCells={wrongFillCells}
          accuseWrongCell={accuseWrongCell}
          celebratingCells={celebratingCells}
          onCellClick={handleCellClick}
        />

        <aside className="side-panel">
          <div className="mode-toggle" role="group" aria-label="Mode">
            <button
              className={mode === "accuse" ? "mode-btn mode-btn-active accuse" : "mode-btn"}
              onClick={() => {
                noteActivity();
                if (!liarFound) setMode("accuse");
              }}
              disabled={liarFound}
            >
              Accuse a clue
            </button>
            <button
              className={mode === "fill" ? "mode-btn mode-btn-active fill" : "mode-btn"}
              onClick={() => {
                noteActivity();
                setMode("fill");
              }}
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
              <dt>Time</dt>
              <dd>{formatTime(elapsedSeconds)}</dd>
            </div>
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

          {solved && (
            <div className="solved-banner">
              <strong>Solved!</strong>
              <span>
                {formatTime(solvedTime ?? elapsedSeconds)} · {mistakes} wrong accusation{mistakes === 1 ? "" : "s"}
              </span>
            </div>
          )}

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