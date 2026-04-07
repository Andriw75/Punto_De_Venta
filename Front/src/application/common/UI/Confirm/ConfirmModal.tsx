import { Show, createSignal, type JSX } from "solid-js";
import type { Component } from "solid-js";
import ModalCommon from "../ModalCommon";
import LoadingLoop from "../../IconSvg/LoadingLoop";

import styles from "./ConfirmModal.module.css";

interface ConfirmModalProps {
  message?: string;
  content?: JSX.Element;
  title: string;
  confirmText?: string;
  cancelText?: string;
  disableConfirm?: boolean;
  onConfirm: () => Promise<boolean | null>;
  onClose: () => void;
}

const ConfirmModal: Component<ConfirmModalProps> = (props) => {
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");

  const handleConfirm = async () => {
    setLoading(true);
    setError("");

    try {
      await props.onConfirm();
      setLoading(false);
      return true;
    } catch (e) {
      setError(String(e));
      setLoading(false);
      return false;
    }
  };

  return (
    <ModalCommon onClose={props.onClose}>
      <h3 class={styles.modalHeader}>{props.title}</h3>
      <Show when={props.message && props.message!.trim().length > 0}>
        <p class={styles.modalMessage}>{props.message}</p>
      </Show>

      <Show when={props.content}>
        <div class={styles.modalBody}>{props.content}</div>
      </Show>

      {error() && <p class={styles.errorText}>{error()}</p>}

      <div class={styles.buttonGroup}>
        <button
          class={`${styles.button} ${styles.cancelButton}`}
          onClick={props.onClose}
          disabled={loading()}
        >
          {props.cancelText ?? "Cancelar"}
        </button>

        <button
          class={`${styles.button} ${styles.confirmButton}`}
          onClick={handleConfirm}
          disabled={loading() || props.disableConfirm}
        >
          {loading() ? <LoadingLoop width="1em" height="1em" /> : props.confirmText ?? "Aceptar"}
        </button>
      </div>
    </ModalCommon>
  );
};

export default ConfirmModal;
