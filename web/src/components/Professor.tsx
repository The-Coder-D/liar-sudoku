import { useEffect, useRef, useState } from "react";
import { sfx } from "../sound";

export type ProfessorEmotion = "happy" | "neutral" | "concerned" | "thinking" | "excited";

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
  const isFirstLine = useRef(true);

  useEffect(() => {
    setReactionKey((k) => k + 1);
    // Skip the chirp on initial mount — a sound firing before the player has
    // interacted at all is jarring (and browsers block it anyway).
    if (isFirstLine.current) {
      isFirstLine.current = false;
      return;
    }
    if (!muted) sfx.chirp();
  }, [line, muted]);

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

interface EmotionShape {
  /** Upper eyelid position: 0 = wide open, higher = more hooded. */
  lidDrop: number;
  browLeft: string;
  browRight: string;
  pupilR: number;
  /** Slight head tilt in degrees, for a bit of body language. */
  tilt: number;
}

const EMOTION_SHAPES: Record<ProfessorEmotion, EmotionShape> = {
  happy: { lidDrop: 1.5, browLeft: "M26 23 Q33 19 40 22", browRight: "M56 22 Q63 19 70 23", pupilR: 4, tilt: 0 },
  neutral: { lidDrop: 0, browLeft: "M26 24 Q33 22 40 24", browRight: "M56 24 Q63 22 70 24", pupilR: 4, tilt: 0 },
  concerned: { lidDrop: 3, browLeft: "M26 28 Q33 22 40 20", browRight: "M56 20 Q63 22 70 28", pupilR: 3.4, tilt: -3 },
  thinking: { lidDrop: 2.5, browLeft: "M26 25 Q33 24 40 25", browRight: "M56 21 Q63 16 70 20", pupilR: 3.6, tilt: 4 },
  excited: { lidDrop: 0, browLeft: "M26 19 Q33 14 40 18", browRight: "M56 18 Q63 14 70 19", pupilR: 5, tilt: 0 },
};

/** The face on its own, reusable anywhere a static (non-interactive) version is needed. */
export function ProfessorFace({ emotion = "neutral" }: { emotion?: ProfessorEmotion }) {
  const s = EMOTION_SHAPES[emotion];

  return (
    <svg viewBox="0 0 96 88" aria-hidden="true">
      <defs>
        {/* Soft body shading so he reads as rounded rather than flat. */}
        <radialGradient id="owl-body" cx="42%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#3b434f" />
          <stop offset="70%" stopColor="#2a313b" />
          <stop offset="100%" stopColor="#1e242c" />
        </radialGradient>
        <radialGradient id="owl-disc" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#4a5360" />
          <stop offset="100%" stopColor="#333b46" />
        </radialGradient>
        <linearGradient id="owl-wing" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#333b46" />
          <stop offset="100%" stopColor="#222831" />
        </linearGradient>
      </defs>

      {/* Tail */}
      <path d="M40 72 L48 84 L56 72 Z" fill="#242b34" stroke="#1a1f26" strokeWidth="1" />

      {/* Wings — layered feathers, each wing rotating from its shoulder */}
      <g className="professor-wing professor-wing-left">
        <path d="M30 40 Q14 44 11 60 Q14 72 28 68 Z" fill="url(#owl-wing)" stroke="#1a1f26" strokeWidth="1.5" />
        <path d="M27 46 Q17 50 15 60" fill="none" stroke="#454f5c" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M27 53 Q18 57 17 65" fill="none" stroke="#454f5c" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M28 60 Q21 63 20 69" fill="none" stroke="#454f5c" strokeWidth="1.2" strokeLinecap="round" />
      </g>
      <g className="professor-wing professor-wing-right">
        <path d="M66 40 Q82 44 85 60 Q82 72 68 68 Z" fill="url(#owl-wing)" stroke="#1a1f26" strokeWidth="1.5" />
        <path d="M69 46 Q79 50 81 60" fill="none" stroke="#454f5c" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M69 53 Q78 57 79 65" fill="none" stroke="#454f5c" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M68 60 Q75 63 76 69" fill="none" stroke="#454f5c" strokeWidth="1.2" strokeLinecap="round" />
      </g>

      {/* Body */}
      <ellipse cx="48" cy="52" rx="24" ry="26" fill="url(#owl-body)" stroke="#1a1f26" strokeWidth="1.5" />

      {/* Chest feather texture — scalloped rows, the detail that sells "owl" */}
      <g stroke="#3f4855" strokeWidth="1.1" fill="none" opacity="0.9">
        <path d="M36 54 q4 4 8 0 q4 4 8 0 q4 4 8 0" />
        <path d="M34 61 q4 4 8 0 q4 4 8 0 q4 4 8 0" />
        <path d="M36 68 q4 4 8 0 q4 4 8 0 q4 4 8 0" />
      </g>

      {/* Talons */}
      <path d="M40 77 l-3 5 M43 78 l0 5 M46 77 l2 5" stroke="var(--color-accent-accuse)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M50 77 l-2 5 M53 78 l0 5 M56 77 l3 5" stroke="var(--color-accent-accuse)" strokeWidth="1.8" strokeLinecap="round" fill="none" />

      <g style={{ transform: `rotate(${s.tilt}deg)`, transformOrigin: "48px 40px", transition: "transform 400ms ease" }}>
        {/* Ear tufts */}
        <path d="M24 8 Q28 20 36 24 Q30 26 24 22 Z" fill="#2d343e" stroke="#1a1f26" strokeWidth="1.2" />
        <path d="M72 8 Q68 20 60 24 Q66 26 72 22 Z" fill="#2d343e" stroke="#1a1f26" strokeWidth="1.2" />

        {/* Head */}
        <circle cx="48" cy="34" r="27" fill="url(#owl-body)" stroke="#1a1f26" strokeWidth="1.5" />

        {/* Facial disc — the concave heart shape owls actually have */}
        <path
          d="M48 14 Q26 16 25 36 Q24 52 48 58 Q72 52 71 36 Q70 16 48 14 Z"
          fill="url(#owl-disc)"
          stroke="#1a1f26"
          strokeWidth="1.2"
        />

        {/* Brow feather tufts above the glasses */}
        <path d={s.browLeft} fill="none" stroke="#5a6472" strokeWidth="2.6" strokeLinecap="round" />
        <path d={s.browRight} fill="none" stroke="#5a6472" strokeWidth="2.6" strokeLinecap="round" />

        {/* Eyes: sclera, iris, pupil, and a lid that drops for expression */}
        <g className="professor-eye-group">
          <circle cx="37" cy="35" r="10" fill="#0f1319" />
          <circle cx="37" cy="35" r="8.2" fill="var(--color-accent-truth)" opacity="0.85" />
          <circle cx="37" cy="35" r={s.pupilR} fill="#0b0e12" />
          <circle cx="34.6" cy="32.4" r="2.1" fill="#ffffff" opacity="0.75" />
          <path d={`M27 35 a10 10 0 0 1 20 0 z`} fill="#2d343e" style={{ transform: `translateY(${s.lidDrop - 10}px)`, transition: "transform 300ms ease" }} />
        </g>
        <g className="professor-eye-group">
          <circle cx="59" cy="35" r="10" fill="#0f1319" />
          <circle cx="59" cy="35" r="8.2" fill="var(--color-accent-truth)" opacity="0.85" />
          <circle cx="59" cy="35" r={s.pupilR} fill="#0b0e12" />
          <circle cx="56.6" cy="32.4" r="2.1" fill="#ffffff" opacity="0.75" />
          <path d={`M49 35 a10 10 0 0 1 20 0 z`} fill="#2d343e" style={{ transform: `translateY(${s.lidDrop - 10}px)`, transition: "transform 300ms ease" }} />
        </g>

        {/* Spectacles — round frames, bridge, and temple arms */}
        <g stroke="var(--color-accent-accuse)" strokeWidth="2" fill="none">
          <circle cx="37" cy="35" r="11" />
          <circle cx="59" cy="35" r="11" />
          <path d="M48 35 q0 -3 0 0" />
          <line x1="48" y1="34" x2="48" y2="36" />
          <path d="M26 33 L19 30" strokeWidth="1.6" />
          <path d="M70 33 L77 30" strokeWidth="1.6" />
        </g>

        {/* Beak */}
        <path d="M48 41 L43 49 Q48 53 53 49 Z" fill="var(--color-accent-accuse)" stroke="#8f5f26" strokeWidth="0.8" />
        <path d="M48 46 L48 51" stroke="#8f5f26" strokeWidth="0.7" />
      </g>

      {/* Bowtie */}
      <path d="M38 66 L48 61 L38 56 Z" fill="var(--color-accent-accuse)" stroke="#8f5f26" strokeWidth="0.8" />
      <path d="M58 66 L48 61 L58 56 Z" fill="var(--color-accent-accuse)" stroke="#8f5f26" strokeWidth="0.8" />
      <circle cx="48" cy="61" r="2.6" fill="#a86f2c" />
    </svg>
  );
}
