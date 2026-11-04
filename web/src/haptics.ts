/**
 * Tiny vibration helper for phones. navigator.vibrate is Android/Chromium only
 * (iOS Safari doesn't expose it), so everything is feature-checked and silent
 * where unsupported. Respects the in-game setting.
 */
let enabled = true;

export function setHapticsOn(value: boolean): void {
  enabled = value;
}

function buzz(pattern: number | number[]): void {
  if (!enabled || typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* Some browsers throw without a recent gesture. Not worth surfacing. */
  }
}

export const haptic = {
  tap: () => buzz(8),
  place: () => buzz(12),
  wrong: () => buzz([30, 40, 30]),
  success: () => buzz([15, 30, 15, 30, 40]),
  solved: () => buzz([20, 40, 20, 40, 20, 40, 80]),
};

export const hapticsSupported = (): boolean => typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
