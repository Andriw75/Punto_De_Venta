import { createSignal } from "solid-js";
import type { Component } from "solid-js";
import ModalCommon from "../ModalCommon";
import LoadingLoop from "../../IconSvg/LoadingLoop";

import styles from "./ConfirmModal.module.css";

interface ConfirmModalProps {
  message: string;
  title: string;
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
      const ok = await props.onConfirm();
      setLoading(false);
      props.onClose();
      return ok;
    } catch (e) {
      setError(String(e));
      setLoading(false);
      return false;
    }
  };

  return (
    <ModalCommon onClose={props.onClose}>
      <h3 class={styles.modalHeader}>{props.title}</h3>
      <p class={styles.modalMessage}>{props.message}</p>
      {error() && <p class={styles.errorText}>{error()}</p>}

      <div class={styles.buttonGroup}>
        <button
          class={`${styles.button} ${styles.cancelButton}`}
          onClick={props.onClose}
          disabled={loading()}
        >
          Cancelar
        </button>

        <button
          class={`${styles.button} ${styles.confirmButton}`}
          onClick={handleConfirm}
          disabled={loading()}
        >
          {loading() ? <LoadingLoop width="1em" height="1em" /> : "Aceptar"}
        </button>
      </div>
    </ModalCommon>
  );
};

export default ConfirmModal;
