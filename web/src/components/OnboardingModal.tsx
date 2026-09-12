import { ProfessorFace } from "./Professor";

interface OnboardingModalProps {
  onDismiss: () => void;
}

export function OnboardingModal({ onDismiss }: OnboardingModalProps) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="modal-panel">
        <div className="onboarding-intro">
          <div className="professor-avatar-static">
            <div className="professor-face-wrap">
              <ProfessorFace />
            </div>
          </div>
          <p className="onboarding-intro-text">
            I'll be around while you play, if you want the company — click me anytime to mute or unmute.
          </p>
        </div>

        <h2 id="onboarding-title">How to play Liar Sudoku</h2>

        <div className="modal-section">
          <h3>The twist</h3>
          <p>It's a normal 9x9 Sudoku, except one of the given clues is false. There's no marker for which one — you have to prove it through logic.</p>
        </div>

        <div className="modal-section">
          <h3>1. Accuse a clue</h3>
          <p>Click any bold given digit you suspect is the lie. Guess wrong and you'll just be told it's not the one — nothing is given away. Guess right and that cell clears so you can fill it in.</p>
        </div>

        <div className="modal-section">
          <h3>2. Fill the grid</h3>
          <p>Once the lie is found, switch to "Fill a cell", select a blank, and enter digits with the number pad. "Check my entries" flags mistakes without revealing the right answer.</p>
        </div>

        <div className="modal-section">
          <h3>Stuck? Use a hint</h3>
          <p>"Why is this a lie?" walks through the actual logical proof, one step at a time. "Get a hint" during fill mode shows the reasoning first, then the digit on a second click — your call how much help you want.</p>
        </div>

        <div className="modal-section">
          <h3>Pick your difficulty</h3>
          <p>Gentle, Sharp, or Extreme — fewer clues means a more deeply-buried lie and a harder finish. Extreme occasionally needs reasoning beyond what the hint system knows.</p>
        </div>

        <button className="btn btn-primary modal-dismiss" onClick={onDismiss}>
          Got it, let's play
        </button>
      </div>
    </div>
  );
}