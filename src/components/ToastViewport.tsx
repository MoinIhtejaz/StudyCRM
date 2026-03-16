import type { ToastMessage } from "../hooks/useToasts";

interface ToastViewportProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const toneClassMap: Record<ToastMessage["type"], string> = {
  info: "border-slate-300 bg-white",
  success: "border-emerald-300 bg-emerald-50",
  warning: "border-amber-300 bg-amber-50",
  error: "border-rose-300 bg-rose-50"
};

export const ToastViewport = ({ toasts, onDismiss }: ToastViewportProps) => {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 w-full max-w-sm space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-xl border p-3 shadow-sm ${toneClassMap[toast.type]}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
              <p className="mt-1 text-sm text-slate-700">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
