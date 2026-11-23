import { createContext, useContext } from "react";

export interface ToastAction {
  label: string;
  run: () => void | Promise<void>;
}

export interface Toast {
  message: string;
  tone?: "info" | "error";
  action?: ToastAction;
}

export const ToastContext = createContext<((toast: Toast) => void) | null>(null);

/** Shows a short message at the bottom of the screen, optionally with one action such as Undo. */
export function useToast(): (toast: Toast) => void {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast outside a ToastProvider");
  return show;
}
