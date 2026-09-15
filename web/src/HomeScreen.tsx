import { useState } from "react";
import { Professor } from "./components/Professor";
import { PROFESSOR_HOME_LINES } from "./professor";
import { pickRandom } from "./celebrations";
import { ONBOARDING_KEY } from "./storageKeys";
import { DIFFICULTY_PRESETS, type Difficulty } from "./engine/difficulty";
import {
  getDefaultDifficulty,
  setDefaultDifficulty,
  getReduceMotion,
  setReduceMotion,
  getSoundEnabled,
  setSoundEnabled,
} from "./preferences";
import { sfx } from "./sound";

export type GameMode = "liar" | "normal";

interface HomeScreenProps {
  onSelectMode: (mode: GameMode) => void;
  professorMuted: boolean;
  onToggleProfessorMuted: () => void;
}

// Fixed (not random-on-every-render) so the layout doesn't jump between renders.
const FLOATING_DIGITS = [
  { digit: 4, left: "6%", delay: "0s", duration: "22s", size: "26px" },
  { digit: 7, left: "16%", delay: "4s", duration: "26s", size: "20px" },
  { digit: 2, left: "27%", delay: "8s", duration: "20s", size: "32px" },
  { digit: 9, left: "40%", delay: "2s", duration: "28s", size: "18px" },
  { digit: 1, left: "53%", delay: "10s", duration: "23s", size: "28px" },
  { digit: 6, left: "64%", delay: "5s", duration: "27s", size: "22px" },
  { digit: 3, left: "77%", delay: "1s", duration: "21s", size: "24px" },
  { digit: 8, left: "88%", delay: "9s", duration: "29s", size: "20px" },
  { digit: 5, left: "10%", delay: "13s", duration: "24s", size: "16px" },
  { digit: 9, left: "70%", delay: "14s", duration: "22s", size: "16px" },
];

// Ghost sudoku grids drifting behind everything, at varied sizes/speeds so
// they read as depth rather than a single flat layer.
const DRIFTING_GRIDS = [
  { top: "8%", left: "4%", size: 150, delay: "0s", duration: "48s", spin: "-8deg" },
  { top: "52%", left: "78%", size: 190, delay: "9s", duration: "62s", spin: "10deg" },
  { top: "68%", left: "12%", size: 120, delay: "18s", duration: "54s", spin: "6deg" },
  { top: "18%", left: "68%", size: 110, delay: "27s", duration: "58s", spin: "-12deg" },
];

/** A faint 9x9 sudoku grid outline, used purely as background texture. */
function GhostGrid({ size }: { size: number }) {
  const lines = [];
  for (let i = 1; i < 9; i++) {
    const pos = (i / 9) * 100;
    const thick = i % 3 === 0;
    lines.push(
      <line key={`v${i}`} x1={pos} y1="0" x2={pos} y2="100" strokeWidth={thick ? 1.1 : 0.5} />,
      <line key={`h${i}`} x1="0" y1={pos} x2="100" y2={pos} strokeWidth={thick ? 1.1 : 0.5} />,
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <rect x="0" y="0" width="100" height="100" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <g stroke="currentColor">{lines}</g>
    </svg>
  );
}

function LogoIcon() {
  return (
    <svg viewBox="0 0 32 32" className="logo-icon" aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="var(--color-panel)" stroke="var(--color-border-strong)" />
      <g stroke="var(--color-border-strong)" strokeWidth="1">
        <line x1="11" y1="4" x2="11" y2="28" />
        <line x1="21" y1="4" x2="21" y2="28" />
        <line x1="4" y1="11" x2="28" y2="11" />
        <line x1="4" y1="21" x2="28" y2="21" />
      </g>
      <rect x="11" y="11" width="10" height="10" fill="var(--color-accent-accuse)" opacity="0.85" />
      <circle cx="16" cy="16" r="2.4" fill="var(--color-bg)" />
    </svg>
  );
}

export function HomeScreen({ onSelectMode, professorMuted, onToggleProfessorMuted }: HomeScreenProps) {
  const [professorLine] = useState(() => pickRandom(PROFESSOR_HOME_LINES));
  const [showSettings, setShowSettings] = useState(false);
  const [tutorialResetNote, setTutorialResetNote] = useState(false);
  const [defaultDifficulty, setDefaultDifficultyState] = useState<Difficulty>(() => getDefaultDifficulty());
  const [reduceMotion, setReduceMotionState] = useState(() => getReduceMotion());
  const [soundOn, setSoundOnState] = useState(() => getSoundEnabled());

  const toggleSound = () => {
    const next = !soundOn;
    setSoundEnabled(next);
    setSoundOnState(next);
    if (next) sfx.click(); // Confirm audibly that sound is back on.
  };

  const resetTutorial = () => {
    window.localStorage.removeItem(ONBOARDING_KEY);
    setTutorialResetNote(true);
  };

  const chooseDefaultDifficulty = (d: Difficulty) => {
    setDefaultDifficulty(d);
    setDefaultDifficultyState(d);
  };

  const toggleReduceMotion = () => {
    const next = !reduceMotion;
    setReduceMotion(next);
    setReduceMotionState(next);
  };

  return (
    <div className="home-shell">
      <div className="home-bg" aria-hidden="true">
        <div className="home-bg-glow" />
        {DRIFTING_GRIDS.map((g, i) => (
          <div
            key={i}
            className="drifting-grid"
            style={{
              top: g.top,
              left: g.left,
              animationDelay: g.delay,
              animationDuration: g.duration,
              ["--spin" as string]: g.spin,
            }}
          >
            <GhostGrid size={g.size} />
          </div>
        ))}
        {FLOATING_DIGITS.map((d, i) => (
          <span
            key={i}
            className="floating-digit"
            style={{ left: d.left, animationDelay: d.delay, animationDuration: d.duration, fontSize: d.size }}
          >
            {d.digit}
          </span>
        ))}
      </div>

      <Professor line={professorLine} emotion="happy" muted={professorMuted} onToggleMute={onToggleProfessorMuted} />

      <div className="home-header">
        <LogoIcon />
        <h1>Liar Sudoku</h1>
        <p className="tagline">One game where the clues lie to you. One where they don't.</p>
      </div>

      <div className="menu-grid">
        <button
          className="menu-card menu-card-primary"
          onClick={() => {
            sfx.click();
            onSelectMode("liar");
          }}
          style={{ animationDelay: "0ms" }}
        >
          <span className="menu-card-title">Liar Sudoku</span>
          <span className="menu-card-desc">One given clue is false. Prove which one, then finish the grid.</span>
        </button>

        <button
          className="menu-card"
          onClick={() => {
            sfx.click();
            onSelectMode("normal");
          }}
          style={{ animationDelay: "70ms" }}
        >
          <span className="menu-card-title">Normal Sudoku</span>
          <span className="menu-card-desc">Classic rules, no twist. A warm-up, or a change of pace.</span>
        </button>

        <button
          className="menu-card menu-card-disabled"
          disabled
          title="Coming soon — no save/resume yet"
          style={{ animationDelay: "140ms" }}
        >
          <span className="menu-card-title">Load Game</span>
          <span className="menu-card-desc">Coming soon. There's no save/resume yet — every puzzle starts fresh.</span>
        </button>

        <button className="menu-card" onClick={() => setShowSettings(true)} style={{ animationDelay: "210ms" }}>
          <span className="menu-card-title">Settings</span>
          <span className="menu-card-desc">Default difficulty, motion, the professor, and the tutorial.</span>
        </button>
      </div>

      {showSettings && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
          onClick={() => setShowSettings(false)}
        >
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h2 id="settings-title">Settings</h2>

            <div className="settings-row">
              <div>
                <strong>Default difficulty</strong>
                <p className="settings-row-desc">Which tier both games start on.</p>
              </div>
              <div className="settings-difficulty-picker">
                {Object.values(DIFFICULTY_PRESETS).map((preset) => (
                  <button
                    key={preset.id}
                    className={defaultDifficulty === preset.id ? "difficulty-btn difficulty-btn-active" : "difficulty-btn"}
                    onClick={() => chooseDefaultDifficulty(preset.id)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-row">
              <div>
                <strong>Sound effects</strong>
                <p className="settings-row-desc">Tones for placing digits, completing lines, and solving.</p>
              </div>
              <button
                className={soundOn ? "btn btn-toggle btn-toggle-on" : "btn btn-toggle"}
                onClick={toggleSound}
                aria-pressed={soundOn}
              >
                {soundOn ? "On" : "Off"}
              </button>
            </div>

            <div className="settings-row">
              <div>
                <strong>Reduce motion</strong>
                <p className="settings-row-desc">
                  Turns off the animated background, pulses, and pop-ins. Useful if motion makes you uncomfortable.
                </p>
              </div>
              <button
                className={reduceMotion ? "btn btn-toggle btn-toggle-on" : "btn btn-toggle"}
                onClick={toggleReduceMotion}
                aria-pressed={reduceMotion}
              >
                {reduceMotion ? "On" : "Off"}
              </button>
            </div>

            <div className="settings-row">
              <div>
                <strong>Professor Locke</strong>
                <p className="settings-row-desc">The companion who comments as you play.</p>
              </div>
              <button
                className={!professorMuted ? "btn btn-toggle btn-toggle-on" : "btn btn-toggle"}
                onClick={onToggleProfessorMuted}
                aria-pressed={!professorMuted}
              >
                {professorMuted ? "Off" : "On"}
              </button>
            </div>

            <div className="settings-row">
              <div>
                <strong>Liar Sudoku tutorial</strong>
                <p className="settings-row-desc">
                  {tutorialResetNote
                    ? "Done — it'll show again next time you start a Liar Sudoku game."
                    : "Shown automatically on your first Liar Sudoku game."}
                </p>
              </div>
              <button className="btn btn-secondary" onClick={resetTutorial}>
                Replay tutorial
              </button>
            </div>

            <button className="btn btn-primary modal-dismiss" onClick={() => setShowSettings(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
