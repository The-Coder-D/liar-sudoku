import { useEffect, useState } from "react";
import { HomeScreen, type GameMode } from "./HomeScreen";
import { LiarSudokuGame } from "./LiarSudokuGame";
import { NormalSudokuGame } from "./NormalSudokuGame";
import { applyStoredPreferences } from "./preferences";
import { loadSavedGame, type SavedGame } from "./gameSave";

type Screen = "home" | GameMode;

function App() {
  const [screen, setScreen] = useState<Screen>("home");
  // Lifted above both game modes and the home screen so muting the professor
  // in one place (e.g. mid-game) persists when you go back to the menu or
  // switch modes, instead of resetting every time.
  const [professorMuted, setProfessorMuted] = useState(false);
  const toggleProfessorMuted = () => setProfessorMuted((m) => !m);

  // Set only when "Load Game" is explicitly chosen — starting a fresh game
  // from either mode card always clears this, so a stale resume never
  // silently hijacks a "New Game" click.
  const [pendingResume, setPendingResume] = useState<SavedGame | null>(null);

  useEffect(() => {
    applyStoredPreferences();
  }, []);

  const handleSelectMode = (mode: GameMode) => {
    setPendingResume(null);
    setScreen(mode);
  };

  const handleLoadGame = () => {
    const saved = loadSavedGame();
    if (!saved) return;
    setPendingResume(saved);
    setScreen(saved.mode);
  };

  if (screen === "liar") {
    return (
      <LiarSudokuGame
        onExit={() => setScreen("home")}
        professorMuted={professorMuted}
        onToggleProfessorMuted={toggleProfessorMuted}
        resume={pendingResume?.mode === "liar" ? pendingResume : undefined}
      />
    );
  }

  if (screen === "normal") {
    return (
      <NormalSudokuGame
        onExit={() => setScreen("home")}
        professorMuted={professorMuted}
        onToggleProfessorMuted={toggleProfessorMuted}
        resume={pendingResume?.mode === "normal" ? pendingResume : undefined}
      />
    );
  }

  return (
    <HomeScreen
      onSelectMode={handleSelectMode}
      onLoadGame={handleLoadGame}
      professorMuted={professorMuted}
      onToggleProfessorMuted={toggleProfessorMuted}
    />
  );
}

export default App;
