/**
 * The Professor is a companion, not a tutorial. The sidebar message stays
 * factual/instructional; toasts are quick flourishes; the Professor's
 * voice is warmer, a little wry, and closer to a mentor thinking out loud
 * next to you. Lines are deliberately not childish or over-excited — the
 * target player already finds plain Sudoku too easy, so the tone respects
 * that.
 */

export function pickRandom<T>(pool: T[]): T {
  return pool[Math.floor(Math.random() * pool.length)];
}

export const PROFESSOR_FIRST_GREETING = [
  "Welcome. Somewhere on this board, one clue is lying to your face. Let's catch it.",
  "First case, then. Trust nothing you're told — prove everything instead.",
];

export const PROFESSOR_NORMAL_GREETING = [
  "Straight classic Sudoku — no lies hiding this time. Let's see how fast you really are.",
  "Every clue here is exactly what it claims to be. Consider it a warm-up.",
  "No tricks in this one. Just you, the grid, and the clock.",
];

export const PROFESSOR_HOME_LINES = [
  "Two games on offer: one honest, one full of lies. Your call.",
  "Welcome back. What'll it be today?",
  "Classic for a warm-up, or Liar Sudoku if you're after the real challenge.",
];

export const PROFESSOR_LOADING = [
  "Give me a moment — I don't show you a puzzle until I can prove the lie is real.",
  "Building your case file. Every lie I hand you has to be provable, no exceptions.",
  "One second. Checking that this puzzle is fair before you ever see it.",
];

export const PROFESSOR_DIFFICULTY_LINES: Record<"gentle" | "sharp" | "extreme", string[]> = {
  gentle: [
    "Gentle. Good — get comfortable with the mechanic before it gets nasty.",
    "Plenty of clues here. Enjoy the calm while it lasts.",
    "A fair, forgiving case. No excuses now.",
  ],
  sharp: [
    "Sharp. A proper challenge, no hand-holding.",
    "Now we're getting somewhere.",
    "This one'll make you work for it, properly.",
  ],
  extreme: [
    "Extreme. Bold choice. Don't say I didn't warn you.",
    "Showing off, are we? Let's see it, then.",
    "Fewer clues, a deeper lie. This is where it gets interesting.",
  ],
};

export const PROFESSOR_WRONG_ACCUSATION = [
  "Not that one. But you've learned something — that clue's telling the truth.",
  "Wrong guess, but not wasted. You've ruled one out.",
  "No shame in it. Even a wrong accusation narrows things down.",
  "That clue's clean. Cross it off and keep going.",
];

export const PROFESSOR_STRUGGLING = [
  "A few misses now. Try 'Why is this a lie?' — it'll walk the actual proof for you.",
  "This one's being stubborn. No shame in leaning on the logic chain for a moment.",
  "You're narrowing it down whether it feels like it or not. Every wrong guess is information.",
];

export const PROFESSOR_CORRECT_ACCUSATION = [
  "There it is. I was starting to think you'd never catch it.",
  "Caught red-handed. Well reasoned.",
  "That's the one. Now the real work begins — filling the grid.",
  "Exposed. Good instincts.",
];

export const PROFESSOR_HINT_USED = [
  "Using a hint isn't cheating — it's reading the room. Let's have a look.",
  "Even I check my own reasoning sometimes.",
  "No judgment here. Let's think it through together.",
];

export const PROFESSOR_UNIT_COMPLETE = ["Clean work.", "That's one down.", "Satisfying, isn't it?", "Tidy."];

export const PROFESSOR_SOLVED = [
  "Solved. The lie's exposed and the grid holds up. Nicely done.",
  "There we are — every digit earns its place. Good work.",
  "That's a wrap. Go on, feel smug about it for a second.",
];

export const PROFESSOR_NORMAL_SOLVED = [
  "Solved, clean and honest. Good work.",
  "There we are — every digit earns its place.",
  "That's a wrap. No tricks needed on this one, and you still had to earn it.",
];

export const PROFESSOR_CHECK_CLEAN = ["Nothing to fix. You're doing better than you think.", "All clean. Keep going."];

export const PROFESSOR_CHECK_MISTAKES = [
  "A few of those don't fit — but now you know exactly where to look.",
  "Not perfect, but now it's obvious where the trouble is.",
];

export const PROFESSOR_IDLE_TIPS = [
  "Stuck? Look for the row or box with the fewest blanks left — it's usually the most constrained.",
  "Remember: only one clue is lying. Everything else can be trusted completely.",
  "Sometimes the fastest way forward is ruling out what a number can't be.",
  "Take your time. There's a clock, but it's not judging you.",
  "If you're stuck on the lie, \"Why is this a lie?\" will walk the logic for you.",
  "Still there? No rush. Good deduction takes exactly as long as it takes.",
];

export const PROFESSOR_NORMAL_IDLE_TIPS = [
  "Stuck? Look for the row or box with the fewest blanks left — it's usually the most constrained.",
  "Sometimes the fastest way forward is ruling out what a number can't be.",
  "Take your time. There's a clock, but it's not judging you.",
  "Still there? No rush. Good deduction takes exactly as long as it takes.",
];

export const PROFESSOR_RESUMED = [
  "Welcome back — right where you left off.",
  "Ah, continuing. Let's finish what we started.",
  "Back again. The board remembers exactly where you left it.",
];

export const PROFESSOR_NEW_BEST_TIME = [
  "New best time, actually. I'm keeping notes.",
  "Faster than ever — well earned.",
];

export const PROFESSOR_STREAK_CONTINUED = [
  "Another day, another solve. That streak isn't building itself.",
  "Consistency. That's the real skill, if you ask me.",
];
