# 🦉 Liar Sudoku

**A Sudoku where one of the given clues is a lie. Prove which one, then finish the grid.**

### ▶ [Play it now: liar-sudoku.netlify.app](https://liar-sudoku.netlify.app)

Free, no sign-up, no ads. Works on phones and computers, and you can install it and play offline.

---

## How it works

- **Liar Sudoku:** the puzzle looks like a normal 9×9 Sudoku, but exactly one of the printed clues is false. Nothing marks which one. Use logic to find the liar and accuse it, then solve the rest of the grid.
- **Normal Sudoku:** classic rules, no twist. A warm-up or a change of pace.
- **Professor Locke**, the owl, reacts as you play: he follows your cursor, nods, gets sleepy if you go quiet, and offers tips and hints. Tap him for a menu.

## Features

- Three difficulties: Gentle, Sharp and Extreme
- Pencil notes, hints, and "check my entries"
- Undo / redo (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z)
- Autosave and "Load Game", plus stats and daily streaks
- Animated, reactive background and synthesized sound effects, with a volume slider and optional vibration
- **Installable and offline:** add it to your home screen or desktop and play with no connection
- Built for phones: pinned number pad, tap-to-confirm accusations, landscape layout
- Reduce-motion option; keyboard play on desktop
- Back up your progress to a file and restore it on another device (Settings → Back up progress)
- No accounts, no tracking: everything stays in your own browser

## Install it

- **Android / desktop Chrome or Edge:** tap **Install · play offline** on the home screen (or use the browser menu → Install app).
- **iPhone / iPad:** open the link in Safari → Share → **Add to Home Screen**.

## Run it yourself

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
git clone https://github.com/The-Coder-D/liar-sudoku.git
cd liar-sudoku/web
npm install
npm run dev        # development server
npm run build      # production build into web/dist
```

To test on your phone over Wi-Fi: `npm run dev -- --host`, then open the address it prints.

## Project layout

| Path | What it is |
|---|---|
| `web/` | The game: React 19 + TypeScript + Vite |
| `web/src/engine/` | Puzzle generator, solver and hint logic |
| `web/src/components/` | Board, owl, backdrop and modals |
| `web/public/` | PWA files: `manifest.webmanifest`, `sw.js` (offline), icons, share image |
| `src/` | The original puzzle engine the web version grew from |

Puzzles are generated in a Web Worker so the screen never freezes.

## Deploying

It's a static site. Any static host works (Netlify, Cloudflare, Vercel, GitHub Pages). Build settings: root `web`, command `npm run build`, output `dist`. HTTPS is required for install and offline play. To push an update to people who already installed it, change `VERSION` in `web/public/sw.js`.

## Built with

React 19, TypeScript, Vite, the Web Audio API, a canvas particle background, and a hand-written service worker. No server, no database.

---

Made by [The-Coder-D](https://github.com/The-Coder-D). Feedback and bug reports are welcome in [Issues](https://github.com/The-Coder-D/liar-sudoku/issues).