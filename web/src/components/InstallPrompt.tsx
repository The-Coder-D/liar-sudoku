import { useState } from "react";
import { createPortal } from "react-dom";
import { promptInstall, usePwa } from "../pwa";
import { sfx } from "../sound";

/** Whether to offer install at all: not already installed, and either a native prompt or iOS instructions apply. */
export function useInstallAvailable() {
  const pwa = usePwa();
  return { pwa, available: !pwa.installed && (pwa.canInstall || pwa.isIos) };
}

export function IosInstallModal({ onClose }: { onClose: () => void }) {
  // Portaled to <body>: inside the animated home header, position:fixed would be trapped in that stacking context.
  return createPortal(
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="ios-install-title" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <h2 id="ios-install-title">Install on iPhone / iPad</h2>
        <p className="modal-lede">Add Liar Sudoku to your Home Screen to play full-screen and offline.</p>
        <ol className="install-steps">
          <li>
            Open this page in <strong>Safari</strong>.
          </li>
          <li>
            Tap the <strong>Share</strong> button (the square with an arrow).
          </li>
          <li>
            Scroll and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
          </li>
        </ol>
        <button className="btn btn-primary modal-dismiss" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>,
    document.body,
  );
}

interface InstallButtonProps {
  className?: string;
  label?: string;
}

/** Self-contained install button; renders nothing when install isn't possible/needed. */
export function InstallButton({ className = "btn btn-secondary", label = "Install app" }: InstallButtonProps) {
  const { pwa, available } = useInstallAvailable();
  const [showIos, setShowIos] = useState(false);
  if (!available) return null;

  const onClick = async () => {
    if (pwa.canInstall) {
      const outcome = await promptInstall();
      if (outcome === "accepted") sfx.sparkle();
    } else {
      setShowIos(true);
    }
  };

  return (
    <>
      <button className={className} onClick={onClick}>
        {label}
      </button>
      {showIos && <IosInstallModal onClose={() => setShowIos(false)} />}
    </>
  );
}

/** Small status chip: offline / ready-for-offline. Only shown when it has something useful to say. */
export function OfflineBadge() {
  const { online } = usePwa();
  if (online) return null;
  return (
    <div className="offline-badge" role="status">
      Offline — your game still works
    </div>
  );
}
