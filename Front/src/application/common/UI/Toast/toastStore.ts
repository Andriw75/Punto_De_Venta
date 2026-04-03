import { createStore } from "solid-js/store";

export type ToastType = "success" | "info" | "error";

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration?: number;
}

const [toasts, setToasts] = createStore<Toast[]>([]);

let idCounter = 0;

export function addToast(toast: Omit<Toast, "id">) {
  const id = idCounter++;
  setToasts([...toasts, { id, ...toast }]);

  const time = toast.duration ?? 3000;

  setTimeout(() => {
    removeToast(id);
  }, time);

  return id;
}

export function removeToast(id: number) {
  setToasts((t) => t.filter((toast) => toast.id !== id));
}

export { toasts };
