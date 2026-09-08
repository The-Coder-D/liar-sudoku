# Liar Sudoku — Puzzle Engine (v0.1)

A Sudoku variant where **exactly one given clue is false**. There's no hint
about which one — you have to find it through pure logic, by discovering
that treating it as true creates a contradiction elsewhere on the board.

This repo is just the **engine** (solver + generator) — no UI yet. The goal
of this stage was to prove the core mechanic actually works and is fair
before building anything visual on top of it.

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

## Running it

```bash
npm install
npm run demo    # generates one puzzle and prints it
npm run stress  # generates 15 puzzles and independently re-verifies all three conditions on each
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

**How to play:** start in "Accuse a clue" mode and click any given (bold)
digit you suspect is the lie. A correct accusation clears that cell so you
can fill it in; a wrong one just tells you it's not the lie, without giving
anything away. Switch to "Fill a cell" mode to enter your own digits, and
use "Check my entries" any time to flag mistakes (without revealing the
right answer).

## Not built yet

- Difficulty rating by required solving technique (currently every puzzle
  is just "one lie, clue count = 30" — no tuning between easy/hard yet).
- Hint system (surfacing *why* a clue must be false, step by step).
- Puzzle generation currently runs in the browser on page load, which
  blocks the UI thread for up to a few seconds in rare cases. Fine for a
  prototype; should move to a Web Worker or a backend endpoint later.
