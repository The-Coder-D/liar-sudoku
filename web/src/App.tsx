import { useEffect, useRef, useState } from "react";
import { HomeScreen, type GameMode } from "./HomeScreen";
import { LiarSudokuGame } from "./LiarSudokuGame";
import { NormalSudokuGame } from "./NormalSudokuGame";
import { applyStoredPreferences } from "./preferences";
import { loadSavedGame, type SavedGame } from "./gameSave";
import { Backdrop } from "./components/Backdrop";
import { sfx } from "./sound";
import { haptic } from "./haptics";
import { OfflineBadge } from "./components/InstallPrompt";

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

  // One delegated listener gives every ordinary button a soft tap + a tiny buzz,
  // and a MutationObserver gives modals an open/close sound, without touching each component.
  useEffect(() => {
    const TAP_TARGETS = ".btn:not(.btn-hint), .difficulty-btn, .mode-btn, .professor-menu-item, .modal-dismiss";
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.(TAP_TARGETS) as HTMLButtonElement | null;
      if (!el || el.disabled) return;
      sfx.tap();
      haptic.tap();
    };
    document.addEventListener("click", onClick);

    let overlays = 0;
    const observer = new MutationObserver(() => {
      const count = document.querySelectorAll(".modal-overlay").length;
      if (count > overlays) sfx.modalOpen();
      else if (count < overlays) sfx.modalClose();
      overlays = count;
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("click", onClick);
      observer.disconnect();
    };
  }, []);

  // A little whoosh when moving between home and a game (skipped on first render).
  const firstScreen = useRef(true);
  useEffect(() => {
    if (firstScreen.current) {
      firstScreen.current = false;
      return;
    }
    sfx.whoosh();
  }, [screen]);

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

  const backdropMode = screen === "home" ? "home" : "game";

  let content;
  if (screen === "liar") {
    content = (
      <LiarSudokuGame
        onExit={() => setScreen("home")}
        professorMuted={professorMuted}
        onToggleProfessorMuted={toggleProfessorMuted}
        resume={pendingResume?.mode === "liar" ? pendingResume : undefined}
      />
    );
  } else if (screen === "normal") {
    content = (
      <NormalSudokuGame
        onExit={() => setScreen("home")}
        professorMuted={professorMuted}
        onToggleProfessorMuted={toggleProfessorMuted}
        resume={pendingResume?.mode === "normal" ? pendingResume : undefined}
      />
    );
  } else {
    content = (
      <HomeScreen
        onSelectMode={handleSelectMode}
        onLoadGame={handleLoadGame}
        professorMuted={professorMuted}
        onToggleProfessorMuted={toggleProfessorMuted}
      />
    );
  }

  // The backdrop lives above the screen switch, so it keeps flowing instead of restarting on every navigation.
  return (
    <>
      <Backdrop mode={backdropMode} />
      {content}
      <OfflineBadge />
    </>
  );
}

export default App;
