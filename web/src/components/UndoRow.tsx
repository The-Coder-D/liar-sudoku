interface UndoRowProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export function UndoRow({ canUndo, canRedo, onUndo, onRedo }: UndoRowProps) {
  return (
    <div className="undo-row">
      <button className="btn btn-secondary undo-btn" onClick={onUndo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)">
        <span aria-hidden="true">↶</span>
        <span className="undo-label"> Undo</span>
      </button>
      <button className="btn btn-secondary undo-btn" onClick={onRedo} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
        <span className="undo-label">Redo </span>
        <span aria-hidden="true">↷</span>
      </button>
    </div>
  );
}
