# Liar Sudoku

A Sudoku variant where **exactly one given clue is false**. There's no hint
about which one — you have to find it through pure logic, by discovering
that treating it as true creates a contradiction elsewhere on the board.

The repo also includes a Normal Sudoku mode (classic rules, no twist) built
on the exact same engine, and a home screen to pick between the two.

## The fairness guarantee

Every generated puzzle is checked against three conditions before it's
accepted. If any fail, the generator throws the puzzle away and tries again:

1. **Provable** — the full set of given clues, including the fake one, must
   have *zero* valid completions. That's what makes the lie logically
   provable rather than a matter of opinion.
2. **Unambiguous** — no other single clue could be blamed instead. Only one
   accusation is ever correct.
3. **Resolvable** — once the true liar clue is set aside, the remaining
   clues must lead to exactly one valid, correct solution.

## Difficulty tiers

Chosen from actual measurements, not guesswork — see `npm run calibrate`,
which generates several puzzles at each clue count and reports how often
pure logic finds the contradiction, how long that takes, and whether the
remaining grid fully solves via naked/hidden singles alone.

| Tier    | Clues | What the data showed |
|---------|-------|----------------------|
| Gentle  | 36    | Fast, and every sampled puzzle fully solved via simple singles. |
| Sharp   | 30    | The original default — approachable, well-tested. |
| Extreme | 26    | Meaningfully harder: longer contradiction chains, and roughly a third of puzzles need reasoning beyond naked/hidden singles to fully finish. |

**Below 26 clues, generation itself becomes unreliable** — sometimes 10+
seconds, sometimes failing outright even after 30 retries. This is a real
algorithmic wall: as clue count approaches the theoretical ~17-clue minimum
for classic Sudoku, removing any given cell while preserving a *unique*
solution gets rare, and the generator's fairness checks (see below) get
proportionally more expensive to satisfy. `generatePuzzleForDifficulty` in
`difficulty.ts` handles this honestly: if a requested difficulty can't
produce a valid puzzle in time, it automatically backs off to slightly
more clues and tells the player that happened, rather than hanging
indefinitely.

## Running it

```bash
npm install
npm run demo       # generates one puzzle and prints it
npm run stress     # generates 15 puzzles and independently re-verifies all three fairness conditions on each
npm run test:logic # measures how often the human-style solver alone can explain the contradiction and finish the grid
npm run calibrate  # measures how those numbers change across a range of clue counts
```

## Files

- `src/sudoku.ts` — classic Sudoku engine: grid utilities, a solution-counting
  backtracking solver (used to prove uniqueness), full-grid generation, and
  standard fair-puzzle generation (no lie yet).
- `src/liarGenerator.ts` — the actual novel mechanic: takes a fair puzzle and
  tries to corrupt one clue into a provable, unambiguous lie.
- `src/index.ts` — demo script.
- `src/stress.ts` — runs the generator repeatedly and independently
  re-checks every fairness condition from scratch (doesn't trust the
  generator's own internal checks).

## Known limitation (by design, for now)

Generation time is inconsistent (roughly 10ms–5s) because the generator
sometimes has to discard a base puzzle and start over. This is fine because
puzzles will be **pre-generated in a batch and stored in the database**,
never generated live on a page load.

## Playing it (web UI)

A React + TypeScript UI lives in `web/`, built with Vite. It reuses the exact
same engine files (copied into `web/src/engine/`), so the puzzles you play
are generated with the same fairness guarantees described above.

```bash
cd web
npm install
npm run dev
```

Then open the local URL it prints (usually `http://localhost:5173`).

**Home screen:** choose Liar Sudoku, Normal Sudoku, Load Game (disabled —
no save/resume yet, see "Not built yet" below), or Settings (mute the
professor, or replay the Liar Sudoku tutorial).

**Liar Sudoku:** pick Gentle, Sharp, or Extreme at the top, then start in
"Accuse a clue" mode and click any given (bold) digit you suspect is the
lie. A correct accusation clears that cell so you can fill it in; a wrong
one just tells you it's not the lie, without giving anything away. Switch
to "Fill a cell" mode to enter your own digits, and use "Check my entries"
any time to flag mistakes (without revealing the right answer). First-time
visitors get a "How to play" walkthrough automatically (remembered via
`localStorage` so it won't repeat); it's reachable anytime from the header
button too.

**Normal Sudoku:** the same difficulty tiers and engine underneath (same
`clueCount` per tier), but every given clue is trustworthy — no accusation
phase, just fill, hint, and check. No tutorial needed; it's exactly the
classic game.

## Home screen and two game modes

`App.tsx` is a small router between three screens: `HomeScreen`,
`LiarSudokuGame`, and `NormalSudokuGame`. The professor's mute state is
lifted to `App.tsx` itself so it persists across mode switches instead of
resetting each time. `NormalSudokuGame` reuses the same engine, hint
system, celebration animations, and professor as Liar Sudoku — the
generator, `getNormalFillHint`/`buildNormalReferenceGrid` in `hints.ts`,
and `generateNormalPuzzle` in `difficulty.ts` are the only genuinely new
pieces; everything else (grid rendering, technique-aware praise, toasts,
row/column/box celebrations) is shared code, not a parallel copy.

Every screen transition (home → game, game → menu) plays a real entrance
animation, and the menu cards pop in with a staggered delay rather than
appearing all at once. The home screen also has a live background — a
slowly drifting radial glow plus faint numbers rising and fading behind
the content — and the title itself is an animated gradient shimmer with
a small pulsing grid icon, not static text.

The professor got a full redesign: he now has animated wings (a
continuous gentle flap, offset left/right so it reads as one motion
rather than two separate ones), periodic eye blinks, and eyebrows that
are the main carrier of expression across five emotions (happy, neutral,
concerned, thinking, excited) rather than just three mouth shapes. He
thinks while a puzzle generates and gets genuinely excited (not just
happy) on a full solve.

One real bug also got caught and fixed along the way: `<button>` elements
don't inherit text color from the page by default in most browsers (they
use a UA-stylesheet default), which made the disabled "Load Game" card's
title nearly invisible. `.menu-card` now sets `color` explicitly.

The Settings screen (reachable from the home screen) controls genuine,
persisted preferences via `preferences.ts`, not placeholders:
**default difficulty** (which tier both game modes start on), **reduce
motion** (a manual override that disables pulses, bounces, and pop-ins
app-wide, layered on top of — not instead of — respecting the OS-level
`prefers-reduced-motion` setting), muting the professor, and replaying the
Liar Sudoku tutorial.

## The professor

A companion character (owl-motif avatar, in the same suspicion/truth color
language as the rest of the game) who comments on events as you play —
wrong and right accusations, completed rows/columns/boxes, hint requests,
check results, and full solves — plus unprompted tips if you're idle for
too long. He's deliberately not a tutorial: the sidebar message stays
factual, the toast stays a quick flourish, and the professor's voice is
just warmth and framing on top of both.

He's expressive rather than static: his mouth changes shape (happy/neutral/
concerned) to match what's happening, he bounces and briefly glows when he
speaks, and he idles with a gentle continuous float so he doesn't look
frozen between lines. He also reacts contextually beyond simple events —
a distinct first-time greeting on your very first puzzle, quiet commentary
while a puzzle is being generated, and a shift to more encouraging,
hint-pointing lines specifically after three or more wrong accusations in
a row. Click his avatar (bottom-right) anytime to mute or unmute him — the
built-in expert audience for this game won't all want a chatty companion
running the whole time.

## Polish

- **Onboarding modal** — explains the mechanic, the two modes, the hint
  system, and the difficulty tiers. Shown once automatically, reopenable
  anytime via the header button.
- **Win celebration** — a modal on completion showing time and wrong-accusation
  count, with a "Play again" button and, if you didn't just beat Extreme, a
  nudge to try the next difficulty up.
- **Live timer** — counts up while a puzzle is in progress, pauses on
  completion, shown in the stats panel and the win modal.
- **Custom favicon** matching the case-file visual language (a highlighted
  grid cell), plus meta description and Open Graph tags so shared links
  show something meaningful instead of a generic preview.

## The hint system

`src/logicSolver.ts` is a second, completely different solver from the
brute-force one in `sudoku.ts`. The brute-force solver is great at proving
a puzzle is fair, but it can't explain *why* anything is true — it just
tries digits and backtracks on failure. `logicSolver.ts` instead applies
two human solving techniques (naked singles, hidden singles) one step at a
time and narrates each one in plain language, so it can produce an actual
explanation rather than just an answer.

`src/hints.ts` builds two different hints on top of it:

- **Fill hints** — always 100% safe. Computed only from the verified-true
  given clues (the lie is deliberately excluded) plus anything the player
  has already correctly entered. Shown as reasoning first, digit revealed
  on a second click.
- **Accusation hints** — run the solver on the puzzle exactly as shown,
  lie included. Empirically (see `npm run test:logic`), naked/hidden
  singles alone are enough to walk every generated puzzle into a genuine,
  explainable contradiction 20/20 times — which is the actual proof that
  a clue is lying. Revealed one forced step at a time via repeated hint
  clicks, ending in the contradiction itself.

**A quality bug found and fixed while building this:** early testing
showed the generator could occasionally make the fake clue an instantly
*visible* duplicate (e.g. two "7"s plainly sitting in the same row) —
spottable in two seconds with no real deduction, defeating the entire
point. `liarGenerator.ts` now excludes any fake value that would create
a visible duplicate with another given in the same row, column, or box,
so every lie requires genuine multi-step reasoning to catch.

## Save/Load and stats

`gameSave.ts` holds a single global in-progress-game slot (auto-overwritten
by whichever mode/difficulty you're actively playing, cleared entirely on
solve — there's nothing to resume once a puzzle is done). `stats.ts` is
separate and permanent: total puzzles solved, best time per mode per
difficulty, and a daily streak (calendar-day based, using the player's
local date — solving twice in one day doesn't double-count, and missing a
day resets the streak to 1 while keeping the longest-streak record). Both
read/write through try/catch so a private-browsing tab or full storage
degrades gracefully instead of crashing.

The home screen shows a compact streak/total-solved strip whenever you've
solved at least one puzzle, and Settings has a fuller table of best times
across every mode/difficulty combination. "Load Game" is a real, enabled
card once a save exists, showing which game and how far into it you were.

## Not built yet

- **Not deployed anywhere** — currently only runs locally. The single
  biggest gap if the goal is having other people actually play it.
- **Colorblind accessibility** — the given/entry/accusing/wrong states
  currently rely on color alone (teal/amber/off-white/red); no icon or
  shape backup yet.
- Deeper solving techniques (pointing pairs, box-line reduction, X-wing).
  The remaining "stuck" fraction below Gentle difficulty is exactly where
  these would help.
- A real fix for the sub-26-clue generation wall (smarter fake-value
  selection, incremental/cached solving instead of full re-solves per
  check, or accepting slow offline batch generation for that range rather
  than live generation).
- Puzzle generation currently runs in the browser on page load, which
  blocks the UI thread for up to a few seconds in rare cases. Fine for a
  prototype; should move to a Web Worker or a backend endpoint later.
- A daily puzzle (same seed for everyone, once per day) — the single
  biggest lever left for making people come back tomorrow specifically.
