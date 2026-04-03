import { For } from "solid-js";
import { toasts } from "./toastStore";
import styles from "./ToastContainer.module.css";

export default function ToastContainer() {
  return (
    <div class={styles.toastContainer}>
      <For each={toasts}>
        {(toast) => (
          <div
            class={`${styles.toast} ${styles[toast.type]}`}
            style={{ "--duration": `${toast.duration || 3000}ms` }}
          >
            {toast.message}
          </div>
        )}
      </For>
    </div>
  );
}
