interface ToastProps {
  toast: { id: number; text: string } | null;
}

export function Toast({ toast }: ToastProps) {
  if (!toast) return null;

  return (
    <div key={toast.id} className="toast" role="status" aria-live="polite">
      {toast.text}
    </div>
  );
}