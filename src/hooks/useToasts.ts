import { useCallback, useMemo, useState } from "react";

export type ToastType = "info" | "success" | "warning" | "error";

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: ToastType;
}

export const useToasts = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((existing) => existing.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const next = { ...toast, id };

    setToasts((existing) => [next, ...existing].slice(0, 6));

    window.setTimeout(() => {
      removeToast(id);
    }, 6500);
  }, [removeToast]);

  return useMemo(
    () => ({
      toasts,
      pushToast,
      removeToast
    }),
    [toasts, pushToast, removeToast]
  );
};
