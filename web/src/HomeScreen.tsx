import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { exportBackup, importBackup } from "./backup";
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
  getSoundVolume,
  setSoundVolume,
  getHapticsEnabled,
  setHapticsEnabled,
} from "./preferences";
import { sfx } from "./sound";
import { haptic, hapticsSupported } from "./haptics";
import { InstallButton, useInstallAvailable } from "./components/InstallPrompt";
import { loadStats } from "./stats";
import { loadSavedGame, describeSavedGame } from "./gameSave";

export type GameMode = "liar" | "normal";

interface HomeScreenProps {
  onSelectMode: (mode: GameMode) => void;
  onLoadGame: () => void;
  professorMuted: boolean;
  onToggleProfessorMuted: () => void;
}

/** Soft light that follows the pointer across a card (read by .menu-card::before). */
function trackGlow(e: ReactPointerEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - r.left}px`);
  el.style.setProperty("--my", `${e.clientY - r.top}px`);
}

function CardIcon({ kind }: { kind: "liar" | "normal" | "load" | "settings" }) {
  const common = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (kind === "liar") {
    return (
      <svg {...common}>
        <rect x="3.5" y="3.5" width="12" height="12" rx="1.5" />
        <path d="M9.5 3.5v12M3.5 9.5h12" opacity="0.5" />
        <circle cx="16" cy="16" r="4.2" />
        <path d="M19.2 19.2 22 22" />
      </svg>
    );
  }
  if (kind === "normal") {
    return (
      <svg {...common}>
        <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
        <path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17" opacity="0.55" />
      </svg>
    );
  }
  if (kind === "load") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
    </svg>
  );
}

function formatBestTime(seconds: number | null): string {
  if (seconds === null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
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

export function HomeScreen({ onSelectMode, onLoadGame, professorMuted, onToggleProfessorMuted }: HomeScreenProps) {
  const [stats] = useState(() => loadStats());
  const [savedGame] = useState(() => loadSavedGame());
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

  const [volume, setVolumeState] = useState(() => getSoundVolume());
  const [hapticsOn, setHapticsOnState] = useState(() => getHapticsEnabled());
  const { pwa, available: installAvailable } = useInstallAvailable();

  const backupInput = useRef<HTMLInputElement>(null);
  const [backupNote, setBackupNote] = useState<string | null>(null);
  const onBackupFile = async (file: File | undefined) => {
    if (!file) return;
    const result = await importBackup(file);
    setBackupNote(result.message);
    if (result.ok) window.setTimeout(() => window.location.reload(), 900);
  };

  const changeVolume = (v: number) => {
    setSoundVolume(v);
    setVolumeState(v);
  };
  const toggleHaptics = () => {
    const next = !hapticsOn;
    setHapticsEnabled(next);
    setHapticsOnState(next);
    if (next) haptic.success();
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
      <Professor
        line={professorLine}
        emotion="happy"
        muted={professorMuted}
        onToggleMute={onToggleProfessorMuted}
        inlineOnMobile
      />

      <div className="home-header">
        <LogoIcon />
        <h1>Liar Sudoku</h1>
        <p className="tagline">One game where the clues lie to you. One where they don't.</p>
        {installAvailable && (
          <div className="install-pill-wrap">
            <InstallButton className="install-pill" label="⬇ Install · play offline" />
          </div>
        )}
        {stats.totalSolved > 0 && (
          <div className="stats-strip">
            {stats.currentStreak > 0 && (
              <span className="stats-strip-item stats-strip-streak">
                🔥 {stats.currentStreak} day{stats.currentStreak === 1 ? "" : "s"}
              </span>
            )}
            <span className="stats-strip-item">
              {stats.totalSolved} puzzle{stats.totalSolved === 1 ? "" : "s"} solved
            </span>
          </div>
        )}
      </div>

      <div className="menu-grid">
        <button
          className="menu-card menu-card-primary"
          onPointerMove={trackGlow}
          onClick={() => {
            sfx.click();
            onSelectMode("liar");
          }}
          style={{ animationDelay: "0ms" }}
        >
          <span className="menu-card-icon">
            <CardIcon kind="liar" />
          </span>
          <span className="menu-card-title">Liar Sudoku</span>
          <span className="menu-card-desc">One given clue is false. Prove which one, then finish the grid.</span>
          <span className="menu-card-tag">Featured</span>
        </button>

        <button
          className="menu-card"
          onPointerMove={trackGlow}
          onClick={() => {
            sfx.click();
            onSelectMode("normal");
          }}
          style={{ animationDelay: "70ms" }}
        >
          <span className="menu-card-icon">
            <CardIcon kind="normal" />
          </span>
          <span className="menu-card-title">Normal Sudoku</span>
          <span className="menu-card-desc">Classic rules, no twist. A warm-up, or a change of pace.</span>
        </button>

        {savedGame ? (
          <button
            className="menu-card"
            onPointerMove={trackGlow}
            onClick={() => {
              sfx.click();
              onLoadGame();
            }}
            style={{ animationDelay: "140ms" }}
          >
            <span className="menu-card-icon">
              <CardIcon kind="load" />
            </span>
            <span className="menu-card-title">Load Game</span>
            <span className="menu-card-desc">Continue: {describeSavedGame(savedGame)} progress.</span>
          </button>
        ) : (
          <button
            className="menu-card menu-card-disabled"
            disabled
            title="No game in progress yet"
            style={{ animationDelay: "140ms" }}
          >
            <span className="menu-card-icon">
              <CardIcon kind="load" />
            </span>
            <span className="menu-card-title">Load Game</span>
            <span className="menu-card-desc">Nothing to resume yet — start a puzzle and come back to it here.</span>
          </button>
        )}

        <button className="menu-card" onPointerMove={trackGlow} onClick={() => setShowSettings(true)} style={{ animationDelay: "210ms" }}>
          <span className="menu-card-icon">
            <CardIcon kind="settings" />
          </span>
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

            {stats.totalSolved > 0 && (
              <div className="stats-table">
                <div className="stats-table-header">
                  <span />
                  <span>Gentle</span>
                  <span>Sharp</span>
                  <span>Extreme</span>
                </div>
                <div className="stats-table-row">
                  <span>Liar</span>
                  {(["gentle", "sharp", "extreme"] as const).map((d) => (
                    <span key={d}>{formatBestTime(stats.liar[d].bestTimeSeconds)}</span>
                  ))}
                </div>
                <div className="stats-table-row">
                  <span>Normal</span>
                  {(["gentle", "sharp", "extreme"] as const).map((d) => (
                    <span key={d}>{formatBestTime(stats.normal[d].bestTimeSeconds)}</span>
                  ))}
                </div>
                {stats.longestStreak > 1 && (
                  <p className="stats-table-footnote">Longest streak: {stats.longestStreak} days</p>
                )}
              </div>
            )}

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

            <div className="settings-row settings-row-volume">
              <div>
                <strong>Volume</strong>
                <p className="settings-row-desc">{Math.round(volume * 100)}%</p>
              </div>
              <input
                className="volume-slider"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                aria-label="Sound volume"
                disabled={!soundOn}
                onChange={(e) => changeVolume(Number(e.target.value))}
                onPointerUp={() => sfx.place()}
                onKeyUp={() => sfx.place()}
              />
            </div>

            {hapticsSupported() && (
              <div className="settings-row">
                <div>
                  <strong>Vibration</strong>
                  <p className="settings-row-desc">A light buzz on taps, placements and wins.</p>
                </div>
                <button
                  className={hapticsOn ? "btn btn-toggle btn-toggle-on" : "btn btn-toggle"}
                  onClick={toggleHaptics}
                  aria-pressed={hapticsOn}
                >
                  {hapticsOn ? "On" : "Off"}
                </button>
              </div>
            )}

            <div className="settings-row">
              <div>
                <strong>Install &amp; offline</strong>
                <p className="settings-row-desc">
                  {pwa.installed
                    ? "Installed — you're playing the app version."
                    : installAvailable
                      ? "Save Liar Sudoku to your device to play offline, full-screen."
                      : pwa.offlineReady
                        ? "Offline-ready: this browser has saved the game, so it opens without a connection."
                        : "Use your browser's menu (Install app / Add to Home Screen) to install."}
                </p>
              </div>
              {installAvailable && <InstallButton label="Install" />}
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
                <strong>Back up progress</strong>
                <p className="settings-row-desc">
                  {backupNote ?? "Save your stats and current game to a file, or restore them on another device."}
                </p>
              </div>
              <div className="backup-actions">
                <button className="btn btn-secondary" onClick={exportBackup}>
                  Export
                </button>
                <button className="btn btn-secondary" onClick={() => backupInput.current?.click()}>
                  Import
                </button>
                <input
                  ref={backupInput}
                  className="visually-hidden-input"
                  type="file"
                  accept="application/json,.json"
                  aria-label="Import backup file"
                  tabIndex={-1}
                  onChange={(e) => {
                    void onBackupFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>
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
