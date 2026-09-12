import { useEffect, useState } from "react";

export type ProfessorEmotion = "happy" | "neutral" | "concerned";

interface ProfessorProps {
  line: string;
  emotion: ProfessorEmotion;
  muted: boolean;
  onToggleMute: () => void;
}

export function Professor({ line, emotion, muted, onToggleMute }: ProfessorProps) {
  // Remounting on text change (via key) restarts both the bubble's fade-in
  // and the avatar's little reaction bounce, so he visibly responds to
  // every new line rather than just quietly swapping text.
  const [reactionKey, setReactionKey] = useState(0);

  useEffect(() => {
    setReactionKey((k) => k + 1);
  }, [line]);

  return (
    <div className="professor">
      {!muted && (
        <div key={reactionKey} className="professor-bubble">
          {line}
        </div>
      )}
      <button
        type="button"
        className={muted ? "professor-avatar professor-avatar-muted" : "professor-avatar"}
        onClick={onToggleMute}
        title={muted ? "Unmute the professor" : "Mute the professor"}
        aria-label={muted ? "Unmute the professor" : "Mute the professor"}
      >
        <div key={reactionKey} className="professor-face-wrap">
          <ProfessorFace emotion={emotion} />
        </div>
      </button>
    </div>
  );
}

/** The face on its own, reusable anywhere a static (non-interactive) version is needed. */
export function ProfessorFace({ emotion = "neutral" }: { emotion?: ProfessorEmotion }) {
  const mouth = {
    happy: "M21 46 Q32 55 43 46",
    neutral: "M23 48 L41 48",
    concerned: "M21 51 Q32 44 43 51",
  }[emotion];

  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M14 12 L21 25 L9 25 Z" fill="var(--color-border-strong)" />
      <path d="M50 12 L55 25 L43 25 Z" fill="var(--color-border-strong)" />
      <circle cx="32" cy="35" r="22" fill="var(--color-panel)" stroke="var(--color-border-strong)" strokeWidth="2" />
      <line x1="29" y1="35" x2="35" y2="35" stroke="var(--color-accent-accuse)" strokeWidth="2" />
      <circle cx="23" cy="35" r="8" fill="var(--color-bg)" stroke="var(--color-accent-accuse)" strokeWidth="2" />
      <circle cx="23" cy="35" r="3" fill="var(--color-accent-truth)" />
      <circle cx="41" cy="35" r="8" fill="var(--color-bg)" stroke="var(--color-accent-accuse)" strokeWidth="2" />
      <circle cx="41" cy="35" r="3" fill="var(--color-accent-truth)" />
      <path d={mouth} fill="none" stroke="var(--color-border-strong)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M22 55 L32 51 L22 47 Z" fill="var(--color-accent-accuse)" />
      <path d="M42 55 L32 51 L42 47 Z" fill="var(--color-accent-accuse)" />
      <circle cx="32" cy="51" r="2.4" fill="var(--color-accent-accuse)" />
    </svg>
  );
}