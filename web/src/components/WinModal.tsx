import { DIFFICULTY_PRESETS, type Difficulty } from "../engine/difficulty";

interface WinModalProps {
  difficulty: Difficulty;
  time: string;
  mistakes: number;
  onClose: () => void;
  onPlayAgain: () => void;
  onTryDifficulty: (difficulty: Difficulty) => void;
}

const NEXT_TIER: Partial<Record<Difficulty, Difficulty>> = {
  gentle: "sharp",
  sharp: "extreme",
};

export function WinModal({ difficulty, time, mistakes, onClose, onPlayAgain, onTryDifficulty }: WinModalProps) {
  const nextTier = NEXT_TIER[difficulty];

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="win-title" onClick={onClose}>
      <div className="modal-panel win-panel" onClick={(e) => e.stopPropagation()}>
        <h2 id="win-title">Solved</h2>
        <p className="modal-lede">
          The lie is exposed and every digit checks out — on <strong>{DIFFICULTY_PRESETS[difficulty].label}</strong>.
        </p>

        <dl className="win-stats">
          <div>
            <dt>Time</dt>
            <dd>{time}</dd>
          </div>
          <div>
            <dt>Wrong accusations</dt>
            <dd>{mistakes}</dd>
          </div>
        </dl>

        <div className="win-actions">
          <button className="btn btn-primary" onClick={onPlayAgain}>
            Play again ({DIFFICULTY_PRESETS[difficulty].label})
          </button>
          {nextTier && (
            <button className="btn btn-secondary" onClick={() => onTryDifficulty(nextTier)}>
              Try {DIFFICULTY_PRESETS[nextTier].label}
            </button>
          )}
          {!nextTier && (
            <p className="win-note">You solved it on Extreme — the hardest tier this engine currently builds.</p>
          )}
        </div>

        <button className="btn btn-ghost modal-dismiss" onClick={onClose}>
          Keep looking at the board
        </button>
      </div>
    </div>
  );
}
