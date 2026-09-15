import { useEffect, useState } from "react";
import { HomeScreen, type GameMode } from "./HomeScreen";
import { LiarSudokuGame } from "./LiarSudokuGame";
import { NormalSudokuGame } from "./NormalSudokuGame";
import { applyStoredPreferences } from "./preferences";

type Screen = "home" | GameMode;

function App() {
  const [screen, setScreen] = useState<Screen>("home");
  // Lifted above both game modes and the home screen so muting the professor
  // in one place (e.g. mid-game) persists when you go back to the menu or
  // switch modes, instead of resetting every time.
  const [professorMuted, setProfessorMuted] = useState(false);
  const toggleProfessorMuted = () => setProfessorMuted((m) => !m);

  useEffect(() => {
    applyStoredPreferences();
  }, []);

  if (screen === "liar") {
    return <LiarSudokuGame onExit={() => setScreen("home")} professorMuted={professorMuted} onToggleProfessorMuted={toggleProfessorMuted} />;
  }

  if (screen === "normal") {
    return <NormalSudokuGame onExit={() => setScreen("home")} professorMuted={professorMuted} onToggleProfessorMuted={toggleProfessorMuted} />;
  }

  return <HomeScreen onSelectMode={setScreen} professorMuted={professorMuted} onToggleProfessorMuted={toggleProfessorMuted} />;
}

export default App;
