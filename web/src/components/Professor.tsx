import { useCallback, useEffect, useRef, useState } from "react";
import { sfx } from "../sound";
import { onOwl } from "../professorBus";
import { OWL_MENU_SEEN_KEY } from "../storageKeys";
import {
  pickRandom,
  PROFESSOR_DWELL,
  PROFESSOR_POKE,
  PROFESSOR_ROLL,
  PROFESSOR_TIPS,
  PROFESSOR_WAKE,
  PROFESSOR_YAWN,
} from "../professor";

export type ProfessorEmotion =
  | "happy"
  | "neutral"
  | "concerned"
  | "thinking"
  | "excited"
  | "surprised"
  | "sad"
  | "proud"
  | "sleepy";

/** One entry in the menu that opens when you tap the professor. */
export interface OwlAction {
  id: string;
  label: string;
  /** Optional small second line explaining what it does. */
  detail?: string;
  disabled?: boolean;
  /** May return a sentence for the professor to say out loud (shown even when he's muted — you asked). */
  run: () => string | void;
}

interface ProfessorProps {
  line: string;
  emotion: ProfessorEmotion;
  muted: boolean;
  onToggleMute: () => void;
  /** Game-specific shortcuts shown in the tap menu (hint, check, "what fits here?", ...). */
  actions?: OwlAction[];
  /** Pool for the menu's "Give me a tip" entry. */
  tips?: string[];
  /** On phones, sit in the page flow (a compact row) instead of floating over the board. */
  inlineOnMobile?: boolean;
}

// High-energy faces relax back to a calm one so he doesn't beam for minutes after one good move.
const CALM: Partial<Record<ProfessorEmotion, ProfessorEmotion>> = {
  excited: "happy",
  proud: "happy",
  surprised: "neutral",
  sad: "neutral",
  concerned: "neutral",
};
const CALM_AFTER_MS: Partial<Record<ProfessorEmotion, number>> = {
  excited: 5000,
  proud: 6000,
  surprised: 2200,
  sad: 8000,
  concerned: 9000,
};

const SLEEP_AFTER_MS = 75000;
const DWELL_AFTER_MS = 28000;
const LOCAL_LINE_MS = 6500;

const GESTURE: Record<ProfessorEmotion, string> = {
  happy: "nod",
  neutral: "bounce",
  concerned: "shake",
  thinking: "tilt",
  excited: "cheer",
  surprised: "hop",
  sad: "droop",
  proud: "cheer",
  sleepy: "sleep",
};

function readMenuSeen(): boolean {
  try {
    return window.localStorage.getItem(OWL_MENU_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function Professor({
  line,
  emotion,
  muted,
  onToggleMute,
  actions = [],
  tips = PROFESSOR_TIPS,
  inlineOnMobile = false,
}: ProfessorProps) {
  const [faceKey, setFaceKey] = useState(0);
  const [bubbleKey, setBubbleKey] = useState(0);
  const [face, setFace] = useState<ProfessorEmotion>(emotion);
  const [localLine, setLocalLine] = useState<string | null>(null);
  const [sleeping, setSleeping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [nod, setNod] = useState(0);
  const [menuSeen, setMenuSeen] = useState(readMenuSeen);

  const rootRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const isFirstLine = useRef(true);
  const mutedRef = useRef(muted);
  const baseEmotionRef = useRef(emotion);
  const sleepingRef = useRef(false);
  const menuOpenRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const lastTapRef = useRef(0);
  const placeTimesRef = useRef<number[]>([]);
  const lastRollRef = useRef(0);
  const lastDwellRef = useRef(0);
  const faceTimer = useRef<number | undefined>(undefined);
  const lineTimer = useRef<number | undefined>(undefined);
  const dwellTimer = useRef<number | undefined>(undefined);
  const lookTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  useEffect(() => {
    menuOpenRef.current = menuOpen;
  }, [menuOpen]);

  /** Switch face; high-energy faces (and explicit flashes) fall back to a calm one after a while. */
  const showFace = useCallback((next: ProfessorEmotion, revertMs?: number) => {
    window.clearTimeout(faceTimer.current);
    setFace(next);
    setFaceKey((k) => k + 1);
    const ms = revertMs ?? CALM_AFTER_MS[next];
    if (!ms) return;
    const base = baseEmotionRef.current;
    const to = CALM[next] ?? CALM[base] ?? base;
    faceTimer.current = window.setTimeout(() => setFace(sleepingRef.current ? "sleepy" : to), ms);
  }, []);

  /** A line that isn't from the game: reactions, tip answers. `force` shows it even while muted. */
  const say = useCallback((text: string, force = false) => {
    if (mutedRef.current && !force) return;
    window.clearTimeout(lineTimer.current);
    setLocalLine(text);
    setBubbleKey((k) => k + 1);
    lineTimer.current = window.setTimeout(() => setLocalLine(null), LOCAL_LINE_MS);
  }, []);

  // The game spoke: new bubble, matching face, and a chirp (but not on first mount — browsers block it
  // and a sound before any interaction is jarring).
  useEffect(() => {
    baseEmotionRef.current = emotion;
    setBubbleKey((k) => k + 1);
    setLocalLine(null);
    if (!sleepingRef.current) showFace(emotion);
    if (isFirstLine.current) {
      isFirstLine.current = false;
      return;
    }
    if (!muted) sfx.chirp();
  }, [line, emotion, muted, showFace]);

  const wake = useCallback(() => {
    sleepingRef.current = false;
    setSleeping(false);
    showFace("surprised");
    say(pickRandom(PROFESSOR_WAKE));
  }, [say, showFace]);

  const markActive = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (sleepingRef.current) wake();
  }, [wake]);

  /** Turn the eyes toward a point on screen. They drift back to centre when nothing happens for a bit. */
  const aimAt = useCallback((x: number, y: number) => {
    const el = avatarRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = x - (r.left + r.width / 2);
    const dy = y - (r.top + r.height / 2);
    const dist = Math.hypot(dx, dy) || 1;
    const strength = Math.min(1, dist / 180);
    setLook({ x: (dx / dist) * strength, y: (dy / dist) * strength });
    window.clearTimeout(lookTimer.current);
    lookTimer.current = window.setTimeout(() => setLook({ x: 0, y: 0 }), 4500);
  }, []);

  // Finger / cursor / keyboard: eyes follow, and any input wakes him.
  useEffect(() => {
    let raf = 0;
    let px = 0;
    let py = 0;
    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        if (!sleepingRef.current) aimAt(px, py);
      });
    };
    const onDown = (e: PointerEvent) => {
      markActive();
      aimAt(e.clientX, e.clientY);
    };
    const onKey = () => markActive();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [aimAt, markActive]);

  // Reactions to how you're playing. None of these reveal whether an entry is right.
  useEffect(() => {
    const startDwell = () => {
      window.clearTimeout(dwellTimer.current);
      dwellTimer.current = window.setTimeout(() => {
        const now = Date.now();
        if (sleepingRef.current || menuOpenRef.current || now - lastDwellRef.current < 90000) return;
        lastDwellRef.current = now;
        showFace("thinking", 4000);
        say(pickRandom(PROFESSOR_DWELL));
      }, DWELL_AFTER_MS);
    };

    const off = onOwl((event) => {
      markActive();
      switch (event.type) {
        case "select": {
          const cell = document.querySelectorAll<HTMLElement>(".sudoku-grid .cell")[event.row * 9 + event.col];
          if (cell) {
            const r = cell.getBoundingClientRect();
            aimAt(r.left + r.width / 2, r.top + r.height / 2);
          }
          startDwell();
          break;
        }
        case "place": {
          window.clearTimeout(dwellTimer.current);
          setNod((n) => n + 1);
          const now = Date.now();
          const recent = [...placeTimesRef.current.filter((t) => now - t < 25000), now];
          placeTimesRef.current = recent;
          if (recent.length >= 5 && now - lastRollRef.current > 60000) {
            lastRollRef.current = now;
            placeTimesRef.current = [];
            showFace("excited", 3000);
            say(pickRandom(PROFESSOR_ROLL));
          }
          break;
        }
        case "note":
        case "clear":
          window.clearTimeout(dwellTimer.current);
          break;
        case "hint":
          window.clearTimeout(dwellTimer.current);
          showFace("thinking", 2200);
          break;
        case "solved":
          window.clearTimeout(dwellTimer.current);
          showFace("proud", 7000);
          break;
      }
    });
    return () => {
      off();
      window.clearTimeout(dwellTimer.current);
    };
  }, [aimAt, markActive, say, showFace]);

  // Doze off after a long quiet spell.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (sleepingRef.current || menuOpenRef.current) return;
      if (Date.now() - lastActivityRef.current < SLEEP_AFTER_MS) return;
      sleepingRef.current = true;
      setSleeping(true);
      showFace("sleepy", 0);
      say(pickRandom(PROFESSOR_YAWN));
    }, 5000);
    return () => window.clearInterval(id);
  }, [say, showFace]);

  // Clean up every timer on unmount.
  useEffect(
    () => () => {
      window.clearTimeout(faceTimer.current);
      window.clearTimeout(lineTimer.current);
      window.clearTimeout(dwellTimer.current);
      window.clearTimeout(lookTimer.current);
    },
    [],
  );

  // Close the menu on an outside tap or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const handleAvatarClick = () => {
    if (!menuSeen) {
      setMenuSeen(true);
      try {
        window.localStorage.setItem(OWL_MENU_SEEN_KEY, "1");
      } catch {
        // Best-effort — the badge just reappears next visit.
      }
    }
    const now = Date.now();
    const doubleTap = now - lastTapRef.current < 450;
    lastTapRef.current = now;
    if (doubleTap) {
      // A quick double-tap is a poke, not a menu request.
      setMenuOpen(false);
      showFace("surprised");
      say(pickRandom(PROFESSOR_POKE), true);
      if (!mutedRef.current) sfx.chirp();
      return;
    }
    setMenuOpen((open) => !open);
  };

  const pick = (action: OwlAction) => {
    setMenuOpen(false);
    if (action.disabled) return;
    const reply = action.run();
    if (typeof reply === "string") {
      showFace("happy", 3500);
      say(reply, true);
    }
  };

  const builtIn: OwlAction[] = [
    { id: "tip", label: "Give me a tip", run: () => pickRandom(tips) },
    { id: "mute", label: muted ? "Unmute the professor" : "Mute the professor", run: () => onToggleMute() },
  ];
  const items = [...actions, ...builtIn];

  const text = localLine ?? line;
  const showBubble = !menuOpen && (localLine !== null || (!muted && !sleeping));

  const classes = [
    "professor",
    inlineOnMobile ? "professor-inline" : "",
    sleeping ? "professor-asleep" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} ref={rootRef}>
      {showBubble && (
        <div key={bubbleKey} className="professor-bubble" role="status">
          {text}
        </div>
      )}

      {menuOpen && (
        <div className="professor-menu" role="menu" aria-label="Professor Locke">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="professor-menu-item"
              disabled={item.disabled}
              onClick={() => pick(item)}
            >
              <span className="professor-menu-label">{item.label}</span>
              {item.detail && <span className="professor-menu-detail">{item.detail}</span>}
            </button>
          ))}
        </div>
      )}

      <button
        ref={avatarRef}
        type="button"
        className={muted ? "professor-avatar professor-avatar-muted" : "professor-avatar"}
        onClick={handleAvatarClick}
        title="Tap for help from the professor"
        aria-label="Professor Locke — open his menu"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <div key={faceKey} className="professor-face-wrap" data-gesture={GESTURE[face]}>
          <ProfessorFace emotion={face} look={look} nod={nod} />
        </div>
        {!menuSeen && <span className="professor-badge">tap me</span>}
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
  /** Beak gap in SVG units (surprise). */
  beakOpen?: number;
  /** Eyes shown as relaxed closed arcs (sleep). */
  closed?: boolean;
  tear?: boolean;
  sparkle?: boolean;
  zzz?: boolean;
  /** Wings thrown up in a cheer. */
  wingsUp?: boolean;
}

const EMOTION_SHAPES: Record<ProfessorEmotion, EmotionShape> = {
  happy: { lidDrop: 1.5, browLeft: "M26 23 Q33 19 40 22", browRight: "M56 22 Q63 19 70 23", pupilR: 4, tilt: 0 },
  neutral: { lidDrop: 0, browLeft: "M26 24 Q33 22 40 24", browRight: "M56 24 Q63 22 70 24", pupilR: 4, tilt: 0 },
  concerned: { lidDrop: 3, browLeft: "M26 28 Q33 22 40 20", browRight: "M56 20 Q63 22 70 28", pupilR: 3.4, tilt: -3 },
  thinking: { lidDrop: 2.5, browLeft: "M26 25 Q33 24 40 25", browRight: "M56 21 Q63 16 70 20", pupilR: 3.6, tilt: 4 },
  excited: { lidDrop: 0, browLeft: "M26 19 Q33 14 40 18", browRight: "M56 18 Q63 14 70 19", pupilR: 5, tilt: 0, wingsUp: true },
  surprised: { lidDrop: 0, browLeft: "M26 17 Q33 12 40 16", browRight: "M56 16 Q63 12 70 17", pupilR: 2.6, tilt: 0, beakOpen: 2.6 },
  sad: { lidDrop: 4.5, browLeft: "M26 27 Q33 25 40 21", browRight: "M56 21 Q63 25 70 27", pupilR: 3.4, tilt: -5, tear: true },
  proud: { lidDrop: 2, browLeft: "M26 21 Q33 17 40 20", browRight: "M56 20 Q63 17 70 21", pupilR: 4, tilt: 0, sparkle: true, wingsUp: true },
  sleepy: { lidDrop: 0, browLeft: "M26 25 Q33 27 40 25", browRight: "M56 25 Q63 27 70 25", pupilR: 4, tilt: 6, closed: true, zzz: true },
};

/** Max pupil travel inside the eye, in SVG units. */
const PUPIL_X = 1.9;
const PUPIL_Y = 1.6;

interface ProfessorFaceProps {
  emotion?: ProfessorEmotion;
  /** Where he's looking, each axis -1..1 (0,0 = straight ahead). */
  look?: { x: number; y: number };
  /** Bump this number to play a quick head nod. */
  nod?: number;
}

/** The face on its own, reusable anywhere a static (non-interactive) version is needed. */
export function ProfessorFace({ emotion = "neutral", look = { x: 0, y: 0 }, nod = 0 }: ProfessorFaceProps) {
  const s = EMOTION_SHAPES[emotion];
  const pupilShift = `translate(${(look.x * PUPIL_X).toFixed(2)}px, ${(look.y * PUPIL_Y).toFixed(2)}px)`;
  const headShift = `translate(${(look.x * 1.6).toFixed(2)}px, ${(look.y * 1).toFixed(2)}px) rotate(${s.tilt + look.x * 3}deg)`;

  const eye = (cx: number, glintDx: number) => (
    <g className="professor-eye-group">
      {s.closed ? (
        <>
          <circle cx={cx} cy="35" r="10" fill="#3a424d" />
          <path d={`M${cx - 8} 35 Q${cx} 42 ${cx + 8} 35`} fill="none" stroke="#0b0e12" strokeWidth="2.4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx={cx} cy="35" r="10" fill="#0f1319" />
          <g style={{ transform: pupilShift, transition: "transform 140ms ease-out" }}>
            <circle cx={cx} cy="35" r="8.2" fill="var(--color-accent-truth)" opacity="0.85" />
            <circle cx={cx} cy="35" r={s.pupilR} fill="#0b0e12" style={{ transition: "r 250ms ease" }} />
            <circle cx={cx + glintDx} cy="32.4" r="2.1" fill="#ffffff" opacity="0.75" />
          </g>
          <path
            d={`M${cx - 10} 35 a10 10 0 0 1 20 0 z`}
            fill="#2d343e"
            style={{ transform: `translateY(${s.lidDrop - 10}px)`, transition: "transform 300ms ease" }}
          />
        </>
      )}
    </g>
  );

  return (
    <svg viewBox="0 0 96 88" aria-hidden="true" className={s.wingsUp ? "owl-pose-cheer" : undefined}>
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

      {/* Head turns slightly toward whatever he's watching; the inner group replays a nod each time `nod` changes. */}
      <g style={{ transform: headShift, transformOrigin: "48px 40px", transition: "transform 260ms ease-out" }}>
        <g key={nod} className={nod > 0 ? "owl-head-nod" : undefined}>
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
          <path d={s.browLeft} fill="none" stroke="#5a6472" strokeWidth="2.6" strokeLinecap="round" style={{ transition: "d 300ms ease" }} />
          <path d={s.browRight} fill="none" stroke="#5a6472" strokeWidth="2.6" strokeLinecap="round" style={{ transition: "d 300ms ease" }} />

          {/* Eyes: iris + pupil follow `look`; the lid drops for expression; sleepy closes them */}
          {eye(37, -2.4)}
          {eye(59, -2.4)}

          {/* Spectacles — round frames, bridge, and temple arms */}
          <g stroke="var(--color-accent-accuse)" strokeWidth="2" fill="none">
            <circle cx="37" cy="35" r="11" />
            <circle cx="59" cy="35" r="11" />
            <path d="M48 35 q0 -3 0 0" />
            <line x1="48" y1="34" x2="48" y2="36" />
            <path d="M26 33 L19 30" strokeWidth="1.6" />
            <path d="M70 33 L77 30" strokeWidth="1.6" />
          </g>

          {/* Beak (opens a little when surprised) */}
          <path d="M48 41 L43 49 Q48 53 53 49 Z" fill="var(--color-accent-accuse)" stroke="#8f5f26" strokeWidth="0.8" />
          <path d="M48 46 L48 51" stroke="#8f5f26" strokeWidth="0.7" />
          {s.beakOpen ? <ellipse cx="48" cy="51.5" rx="3" ry={s.beakOpen} fill="#5a3a14" /> : null}

          {s.tear ? <path className="owl-tear" d="M31 47 q-2.6 4 0 6.2 q2.6 -2.2 0 -6.2 z" fill="#7fb8d8" /> : null}
        </g>
      </g>

      {/* Bowtie */}
      <path d="M38 66 L48 61 L38 56 Z" fill="var(--color-accent-accuse)" stroke="#8f5f26" strokeWidth="0.8" />
      <path d="M58 66 L48 61 L58 56 Z" fill="var(--color-accent-accuse)" stroke="#8f5f26" strokeWidth="0.8" />
      <circle cx="48" cy="61" r="2.6" fill="#a86f2c" />

      {s.sparkle ? (
        <g fill="#f4d58a">
          <path className="owl-sparkle" d="M13 12 l1.6 3.8 3.8 1.6 -3.8 1.6 -1.6 3.8 -1.6 -3.8 -3.8 -1.6 3.8 -1.6 z" />
          <path className="owl-sparkle owl-sparkle-b" d="M83 8 l1.3 3 3 1.3 -3 1.3 -1.3 3 -1.3 -3 -3 -1.3 3 -1.3 z" />
        </g>
      ) : null}

      {s.zzz ? (
        <g fill="#9fb4c8" fontFamily="var(--font-mono)" fontWeight="700">
          <text className="owl-zzz" x="70" y="18" fontSize="10">
            z
          </text>
          <text className="owl-zzz owl-zzz-b" x="78" y="11" fontSize="8">
            z
          </text>
        </g>
      ) : null}
    </svg>
  );
}
