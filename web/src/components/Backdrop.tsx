import { useEffect, useRef } from "react";
import { onOwl } from "../professorBus";
import "../backdrop.css";

export type BackdropMode = "home" | "game";

type Tone = "teal" | "amber" | "light";

interface Digit {
  x: number;
  y: number;
  /** Spring offset from being pushed by the pointer. */
  ox: number;
  oy: number;
  ovx: number;
  ovy: number;
  size: number;
  /** 0 = far away (small, faint, slow), 1 = close (big, bright, fast). */
  depth: number;
  ch: string;
  rot: number;
  vr: number;
  phase: number;
  tone: Tone;
}

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
  tone: Tone;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  rgb: string;
  ch?: string;
}

const RGB: Record<Tone, string> = {
  teal: "79,166,156",
  amber: "201,138,59",
  light: "226,230,238",
};
const TONES: Tone[] = ["teal", "amber", "light", "teal", "light"];

function motionReduced(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.body.classList.contains("reduced-motion-pref");
  } catch {
    return false;
  }
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * The living background behind every screen: slow colour fields, a drifting grid, a light beam,
 * and a canvas of depth-layered digits and dust that scatter away from your finger or cursor.
 * A soft lamp-like spotlight follows the pointer (and glides to whichever cell you select).
 * It reacts to play too: a burst on a solve, sparks on a finished row, a red flinch on a wrong accusation.
 *
 * Costs: one small canvas, transform-only CSS animations, paused while the tab is hidden,
 * thinned out automatically if frames run slow, and frozen entirely under reduced motion.
 */
export function Backdrop({ mode }: { mode: BackdropMode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef(mode);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const fx = fxRef.current;
    const spotEl = spotRef.current;
    const ctx = canvas?.getContext("2d");
    // Celebration sparks get their own canvas ABOVE the page, so a burst is seen over the board.
    const fxCtx = fx?.getContext("2d");
    if (!root || !canvas || !fx || !spotEl || !ctx || !fxCtx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let digits: Digit[] = [];
    let motes: Mote[] = [];
    let sparks: Spark[] = [];
    const pointer = { x: 0, y: 0, active: false, lastMove: 0 };
    const parallax = { x: 0, y: 0 };
    const spot = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.4 };
    let focus: { x: number; y: number; until: number } | null = null;
    let raf = 0;
    let last = 0;
    let t = 0;
    let slowStreak = 0;
    let thinned = false;
    let reduced = motionReduced();
    let fxDirty = false;
    const timers: number[] = [];

    const build = () => {
      const area = w * h;
      const nDigits = clamp(Math.round(area / 52000), 9, 26);
      const nMotes = clamp(Math.round(area / 20000), 24, 60);
      digits = Array.from({ length: nDigits }, () => {
        const depth = rand(0.2, 1);
        return {
          x: rand(0, w),
          y: rand(0, h),
          ox: 0,
          oy: 0,
          ovx: 0,
          ovy: 0,
          size: 14 + depth * 28,
          depth,
          ch: String(1 + Math.floor(Math.random() * 9)),
          rot: rand(-0.35, 0.35),
          vr: rand(-0.06, 0.06),
          phase: rand(0, Math.PI * 2),
          tone: TONES[Math.floor(Math.random() * TONES.length)],
        };
      });
      motes = Array.from({ length: nMotes }, () => ({
        x: rand(0, w),
        y: rand(0, h),
        vx: rand(-6, 6),
        vy: rand(-10, -2),
        r: rand(0.8, 2.2),
        phase: rand(0, Math.PI * 2),
        tone: Math.random() < 0.3 ? "amber" : "teal",
      }));
      thinned = false;
      slowStreak = 0;
    };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fx.width = canvas.width;
      fx.height = canvas.height;
      fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      if (reduced) frame(0, true);
    };

    const burst = (cx: number, cy: number, count: number, power: number) => {
      const palette = ["79,166,156", "201,138,59", "244,213,138", "226,230,238"];
      for (let i = 0; i < count; i++) {
        const a = rand(0, Math.PI * 2);
        const sp = rand(0.25, 1) * power;
        sparks.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - power * 0.25,
          life: 0,
          max: rand(1.1, 2.3),
          size: rand(2.4, 5.2),
          rgb: palette[Math.floor(Math.random() * palette.length)],
          ch: Math.random() < 0.28 ? String(1 + Math.floor(Math.random() * 9)) : undefined,
        });
      }
      if (sparks.length > 400) sparks = sparks.slice(sparks.length - 400);
    };

    const gridCenter = () => {
      const g = document.querySelector(".sudoku-grid");
      if (!g) return { x: w / 2, y: h * 0.45 };
      const r = g.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };

    const pulseClass = (cls: string, ms: number) => {
      root.classList.remove(cls);
      void root.offsetWidth; // restart the CSS animation
      root.classList.add(cls);
      timers.push(window.setTimeout(() => root.classList.remove(cls), ms));
    };

    const off = onOwl((e) => {
      if (reduced) return;
      switch (e.type) {
        case "select": {
          const cell = document.querySelectorAll<HTMLElement>(".sudoku-grid .cell")[e.row * 9 + e.col];
          if (cell) {
            const r = cell.getBoundingClientRect();
            focus = { x: r.left + r.width / 2, y: r.top + r.height / 2, until: performance.now() + 3200 };
          }
          break;
        }
        case "place":
          if (focus) burst(focus.x, focus.y, 5, 70);
          break;
        case "cheer": {
          const c = gridCenter();
          burst(c.x, c.y, 34, 260);
          break;
        }
        case "solved": {
          const c = gridCenter();
          burst(c.x, c.y, 160, 520);
          timers.push(window.setTimeout(() => burst(c.x, c.y, 90, 380), 380));
          pulseClass("bd-solved", 3600);
          break;
        }
        case "flinch":
          pulseClass("bd-flinch", 700);
          break;
        default:
          break;
      }
    });

    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
      pointer.lastMove = performance.now();
    };
    const onLeave = () => {
      pointer.active = false;
    };

    const frame = (now: number, staticOnly = false) => {
      const dt = staticOnly ? 0 : clamp((now - last) / 1000, 0, 0.05);
      last = now;
      t += dt;
      const game = modeRef.current === "game";
      const intensity = game ? 0.58 : 1;
      const nowMs = performance.now();
      const recent = pointer.active && nowMs - pointer.lastMove < 4000;

      // Adaptive thinning: if frames keep running slow, quietly halve the particle count once.
      if (!staticOnly && !thinned) {
        slowStreak = dt > 0.034 ? slowStreak + 1 : Math.max(0, slowStreak - 2);
        if (slowStreak > 90) {
          digits = digits.slice(0, Math.ceil(digits.length / 2));
          motes = motes.slice(0, Math.ceil(motes.length / 2));
          thinned = true;
        }
      }

      // Parallax follows the pointer gently; drifts back to centre when idle.
      const px = recent ? (pointer.x / w - 0.5) * -2 : 0;
      const py = recent ? (pointer.y / h - 0.5) * -2 : 0;
      parallax.x += (px - parallax.x) * Math.min(1, dt * 3);
      parallax.y += (py - parallax.y) * Math.min(1, dt * 3);

      // Spotlight target: a selected cell > the pointer > a slow wander of its own.
      let tx: number;
      let ty: number;
      if (focus && nowMs < focus.until) {
        tx = focus.x;
        ty = focus.y;
      } else if (recent) {
        tx = pointer.x;
        ty = pointer.y;
      } else {
        tx = w * (0.5 + 0.3 * Math.sin(t * 0.13));
        ty = h * (0.42 + 0.22 * Math.sin(t * 0.17 + 1));
      }
      const k = staticOnly ? 1 : Math.min(1, dt * 4.5);
      spot.x += (tx - spot.x) * k;
      spot.y += (ty - spot.y) * k;
      spotEl.style.transform = `translate3d(${spot.x.toFixed(1)}px, ${spot.y.toFixed(1)}px, 0)`;

      ctx.clearRect(0, 0, w, h);

      // --- Dust motes and the faint lines joining close ones ---
      ctx.lineWidth = 1;
      for (const m of motes) {
        m.phase += dt * 0.8;
        m.x += (m.vx + Math.sin(m.phase) * 4) * dt;
        m.y += m.vy * dt;
        if (m.y < -10) {
          m.y = h + 10;
          m.x = rand(0, w);
        }
        if (m.x < -10) m.x = w + 10;
        else if (m.x > w + 10) m.x = -10;
      }
      const linkDist = game ? 90 : 120;
      for (let i = 0; i < motes.length; i++) {
        const a = motes[i];
        for (let j = i + 1; j < motes.length; j++) {
          const b = motes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < linkDist * linkDist) {
            const alpha = (1 - Math.sqrt(d2) / linkDist) * 0.13 * intensity;
            ctx.strokeStyle = `rgba(${RGB.teal},${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      for (const m of motes) {
        const tw = 0.55 + 0.45 * Math.sin(m.phase * 2.2);
        ctx.fillStyle = `rgba(${RGB[m.tone]},${(0.55 * tw * intensity).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- Depth-layered digits ---
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const pushR = 150;
      for (const d of digits) {
        d.phase += dt * 0.5;
        d.y -= (5 + d.depth * 15) * dt;
        d.x += Math.sin(d.phase) * 6 * d.depth * dt;
        d.rot += d.vr * dt;
        if (d.y < -50) {
          d.y = h + 50;
          d.x = rand(0, w);
          d.ch = String(1 + Math.floor(Math.random() * 9));
        }
        // Scatter away from the pointer, then spring back.
        if (recent && !staticOnly) {
          const dx = d.x + d.ox - pointer.x;
          const dy = d.y + d.oy - pointer.y;
          const dist = Math.hypot(dx, dy);
          if (dist < pushR && dist > 0.01) {
            const f = (1 - dist / pushR) * 900 * dt * (0.4 + d.depth);
            d.ovx += (dx / dist) * f;
            d.ovy += (dy / dist) * f;
          }
        }
        d.ovx += -d.ox * 5 * dt;
        d.ovy += -d.oy * 5 * dt;
        d.ovx *= 1 - Math.min(1, dt * 3.2);
        d.ovy *= 1 - Math.min(1, dt * 3.2);
        d.ox += d.ovx * dt;
        d.oy += d.ovy * dt;

        const x = d.x + d.ox + parallax.x * 26 * d.depth;
        const y = d.y + d.oy + parallax.y * 20 * d.depth;
        const edge = clamp(Math.min(d.y, h - d.y) / 140, 0, 1);
        const twinkle = 0.78 + 0.22 * Math.sin(d.phase * 3);
        const alpha = (0.05 + d.depth * 0.17) * edge * twinkle * intensity;
        if (alpha < 0.004) continue;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(d.rot);
        ctx.font = `700 ${d.size.toFixed(1)}px "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace`;
        ctx.fillStyle = `rgba(${RGB[d.tone]},${alpha.toFixed(3)})`;
        if (d.depth > 0.86 && !staticOnly) {
          ctx.shadowColor = `rgba(${RGB[d.tone]},${(alpha * 3.2).toFixed(3)})`;
          ctx.shadowBlur = 14;
        }
        ctx.fillText(d.ch, 0, 0);
        ctx.restore();
      }

      // --- Sparks from celebrations (drawn on the overlay canvas) ---
      if (sparks.length > 0 || fxDirty) {
        fxCtx.clearRect(0, 0, w, h);
        fxDirty = sparks.length > 0;
      }
      if (sparks.length > 0) {
        fxCtx.textAlign = "center";
        fxCtx.textBaseline = "middle";
        fxCtx.globalCompositeOperation = "lighter";
        for (const s of sparks) {
          s.life += dt;
          s.vy += 320 * dt;
          s.vx *= 1 - Math.min(1, dt * 1.4);
          s.vy *= 1 - Math.min(1, dt * 0.6);
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          const a = clamp(1 - s.life / s.max, 0, 1);
          if (s.ch) {
            fxCtx.font = `700 ${(s.size * 5.5).toFixed(1)}px "JetBrains Mono", ui-monospace, monospace`;
            fxCtx.fillStyle = `rgba(${s.rgb},${(a * 0.9).toFixed(3)})`;
            fxCtx.fillText(s.ch, s.x, s.y);
          } else {
            fxCtx.fillStyle = `rgba(${s.rgb},${a.toFixed(3)})`;
            fxCtx.beginPath();
            fxCtx.arc(s.x, s.y, s.size * (0.4 + a * 0.6), 0, Math.PI * 2);
            fxCtx.fill();
            fxCtx.fillStyle = `rgba(${s.rgb},${(a * 0.22).toFixed(3)})`;
            fxCtx.beginPath();
            fxCtx.arc(s.x, s.y, s.size * 2.6 * (0.4 + a * 0.6), 0, Math.PI * 2);
            fxCtx.fill();
          }
        }
        fxCtx.globalCompositeOperation = "source-over";
        sparks = sparks.filter((s) => s.life < s.max && s.y < h + 40);
      }
    };

    const loop = (now: number) => {
      frame(now);
      raf = window.requestAnimationFrame(loop);
    };

    const start = () => {
      if (raf || reduced || document.hidden) return;
      last = performance.now();
      raf = window.requestAnimationFrame(loop);
    };
    const stop = () => {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
    };

    const applyMotionPreference = () => {
      reduced = motionReduced();
      root.classList.toggle("bd-still", reduced);
      if (reduced) {
        stop();
        sparks = [];
        fxCtx.clearRect(0, 0, w, h);
        frame(0, true); // one calm, static frame
      } else {
        start();
      }
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    resize();
    applyMotionPreference();

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", applyMotionPreference);
    const bodyObserver = new MutationObserver(applyMotionPreference);
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });

    return () => {
      stop();
      off();
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      mq.removeEventListener("change", applyMotionPreference);
      bodyObserver.disconnect();
    };
  }, []);

  return (
    <>
    <div ref={rootRef} className={`backdrop backdrop-${mode}`} aria-hidden="true">
      <div className="bd-blob bd-blob-teal" />
      <div className="bd-blob bd-blob-amber" />
      <div className="bd-blob bd-blob-indigo" />
      <div className="bd-grid" />
      <div className="bd-beam" />
      <canvas ref={canvasRef} className="bd-canvas" />
      <div ref={spotRef} className="bd-spot" />
      <div className="bd-vignette" />
      <div className="bd-grain" />
      <div className="bd-flash" />
    </div>
    <canvas ref={fxRef} className="bd-fx" aria-hidden="true" />
    </>
  );
}
