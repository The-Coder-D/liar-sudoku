/**
 * Install + offline support. A tiny module-level store (read with usePwa) so the
 * Home pill, the Settings row and the offline badge all agree.
 *
 * - Chrome/Edge/Android fire `beforeinstallprompt`; we keep the event and fire it from our own button.
 * - iOS Safari never fires it, so we show "Share, then Add to Home Screen" instructions instead.
 * - The service worker (public/sw.js) is registered in production builds only, so dev hot reload is never cached.
 */
import { useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface PwaState {
  canInstall: boolean; // a native install prompt is ready
  isIos: boolean;
  installed: boolean; // running as an installed app (standalone)
  online: boolean;
  offlineReady: boolean; // service worker has cached the game
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches === true || nav.standalone === true;
}

function detectIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac with touch.
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
}

let deferred: BeforeInstallPromptEvent | null = null;
let state: PwaState = {
  canInstall: false,
  isIos: detectIos(),
  installed: detectStandalone(),
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  offlineReady: false,
};
const listeners = new Set<() => void>();

function set(patch: Partial<PwaState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

let started = false;
export function initPwa(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    set({ canInstall: true });
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    set({ canInstall: false, installed: true });
  });
  window.addEventListener("online", () => set({ online: true }));
  window.addEventListener("offline", () => set({ online: false }));
  window.matchMedia?.("(display-mode: standalone)").addEventListener?.("change", () => set({ installed: detectStandalone() }));

  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    const url = `${import.meta.env.BASE_URL}sw.js`;
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register(url, { scope: import.meta.env.BASE_URL })
        .then(() => navigator.serviceWorker.ready)
        .then(() => set({ offlineReady: true }))
        .catch(() => {
          /* Offline support is a bonus; the game works fine without it. */
        });
    });
  }
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  const evt = deferred;
  deferred = null;
  set({ canInstall: false });
  await evt.prompt();
  const { outcome } = await evt.userChoice;
  return outcome;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function usePwa(): PwaState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
